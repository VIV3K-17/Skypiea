// backend/server_nodb.js
// Enhanced: supports transfers up to 5 GB without any database.
// - Removes SQLite dependence; uses filesystem JSON metadata instead
// - Streaming-safe chunk writes (writes incoming request buffers to file at given offset)
// - Session and transfer metadata persisted to JSON files under uploads/ so restarts keep state
// - Maintains original features: ephemeral sessions, pre-allocation, worker SHA, TURN creds, WebSocket signaling
// - Keeps rate limiting, Helmet, CORS, Prometheus metrics, cluster support

require('dotenv').config();

const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const http = require('http');
const { WebSocketServer } = require('ws');
const client = require('prom-client');
const qrcode = require('qrcode');
const { Worker } = require('worker_threads');
// SQLite for dynamic ratings
let Database = null;
try { Database = require('better-sqlite3'); } catch (e) { try { Database = require('sqlite3'); } catch (ee) { Database = null; } }

const USE_CLUSTER = (process.env.USE_CLUSTER || 'false') === 'true';
const NUM_CPUS = os.cpus().length;

if (USE_CLUSTER && cluster.isMaster) {
  console.log(`Master process PID ${process.pid} - starting ${NUM_CPUS} workers`);
  for (let i = 0; i < NUM_CPUS; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} died - restarting...`);
    cluster.fork();
  });
  return;
}

// ========== Config ==========
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = (process.env.TRUST_PROXY || 'false') === 'true';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_ORIGINS = [
  'https://skypiea-2.onrender.com',
  'https://skypieaa.onrender.com',
  'http://localhost:5173'
];
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS || 300000);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1200000);
const CHUNK_LIMIT_BYTES = Number(process.env.CHUNK_LIMIT_BYTES || 500 * 1024 * 1024);
const MAX_ACTIVE_TRANSFERS = Number(process.env.MAX_ACTIVE_TRANSFERS || 100);
const HMAC_SECRET = process.env.HMAC_SECRET || crypto.randomBytes(32).toString('hex');

const ENABLE_TURN = (process.env.ENABLE_TURN || 'true') === 'true';
const TURN_URIS = (process.env.TURN_URIS || '').split(',').filter(Boolean);
const TURN_STATIC_SECRET = process.env.TURN_STATIC_SECRET || '';
const TURN_CREDENTIAL_TTL = Number(process.env.TURN_CREDENTIAL_TTL || 300);

const MAX_TMP_FILE_AGE_MS = Number(process.env.MAX_TMP_FILE_AGE_MS || 7 * 24 * 60 * 60 * 1000);

// simple helper dirs for persisted sessions & metadata (no DB)
const SESSIONS_DIR = path.join(UPLOADS_DIR, '_sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ========== SQLite (ratings) ==========
let ratingsDb = null;
let ratingsStmt = { insert: null, stats: null, checkByIpRecent: null };
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'data.db');
if (Database) {
  try {
    if (Database.name === 'sqlite3') {
      const sqlite3 = Database.verbose();
      ratingsDb = new sqlite3.Database(SQLITE_PATH);
      ratingsDb.serialize(() => {
        ratingsDb.run('CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5), ip TEXT, ua TEXT, created_at INTEGER NOT NULL)');
      });
    } else {
      ratingsDb = new Database(SQLITE_PATH);
      ratingsDb.pragma('journal_mode = WAL');
      ratingsDb.prepare('CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5), ip TEXT, ua TEXT, created_at INTEGER NOT NULL)').run();
      ratingsStmt.insert = ratingsDb.prepare('INSERT INTO ratings (value, ip, ua, created_at) VALUES (?, ?, ?, ?)');
      ratingsStmt.stats = ratingsDb.prepare('SELECT COUNT(*) AS count, AVG(value) AS avg FROM ratings');
      ratingsStmt.checkByIpRecent = ratingsDb.prepare('SELECT COUNT(*) AS c FROM ratings WHERE ip = ? AND created_at > ?');
    }
  } catch (e) {
    console.warn('Ratings DB init failed:', e && e.message);
    ratingsDb = null;
  }
}

// ========== Helpers ==========
function now() { return Date.now(); }
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function makeToken() { return crypto.randomBytes(20).toString('hex'); }
function makeSessionId() { return crypto.randomBytes(16).toString('hex'); }
function sanitizeFilename(name) {
  const base = path.basename(name || '');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || `file-${Date.now()}`;
}
function timingEquals(a, b) {
  try {
    const A = Buffer.from(a);
    const B = Buffer.from(b);
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
  } catch { return false; }
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJsonSafe(p, obj) {
  try { fs.writeFileSync(p, JSON.stringify(obj)); return true; } catch (e) { return false; }
}

// ========== In-memory maps (backed by FS) ==========
const connections = new Map(); // code -> { token, code, createdAt, expiresAt, dir, note }
const hostsByToken = new Map(); // token -> ws
const sendersByToken = new Map(); // token -> Set(ws)
const transfersCache = new Map(); // token -> Map(transferId -> meta)

// helper to persist transfer metadata to token dir
function transferMetaPath(token, transferId) {
  const tokenDir = path.join(UPLOADS_DIR, token);
  if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
  return path.join(tokenDir, `transfer-${transferId}.meta.json`);
}
function loadTransferMeta(token, transferId) {
  const p = transferMetaPath(token, transferId);
  return readJsonSafe(p);
}
function saveTransferMeta(token, transferId, meta) {
  const p = transferMetaPath(token, transferId);
  return writeJsonSafe(p, meta);
}

function sessionPath(sessionId) { return path.join(SESSIONS_DIR, `${sessionId}.json`); }
function saveSession(sess) { return writeJsonSafe(sessionPath(sess.sessionId), sess); }
function loadSession(sessionId) { return readJsonSafe(sessionPath(sessionId)); }
function deleteSession(sessionId) { try { fs.unlinkSync(sessionPath(sessionId)); } catch (e) {} }

// ========== Metrics ==========
const register = client.register;
const uploadsCompleted = new client.Counter({ name: 'uploads_completed_total', help: 'Completed uploads' });
const uploadsReceivedBytes = new client.Counter({ name: 'uploads_received_bytes_total', help: 'Total bytes received' });
const p2pSuccess = new client.Counter({ name: 'p2p_success_total', help: 'P2P success' });
const fallbackHttpCount = new client.Counter({ name: 'fallback_http_total', help: 'HTTP fallback' });

// ========== App & Security ==========
const app = express();
if (TRUST_PROXY) app.set('trust proxy', 1);
app.use(helmet());
app.use((req, res, next) => {
  if (NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains; preload');
  }
  next();
});
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
// small JSON bodies still allowed
app.use(express.json({ limit: '10mb' }));

// ========== Rate limiting ==========
app.use(rateLimit({ windowMs: 60 * 1000, max: 400 }));
const uploadChunkLimiter = rateLimit({ windowMs: 60 * 1000, max: 1000, message: { error: 'Too many upload requests — slow down' } });
app.use('/upload/chunk', uploadChunkLimiter);

// ========== Routes ==========
// Ratings API (SQLite-backed if available)
app.get('/rating', (req, res) => {
  try {
    if (!ratingsDb) return res.json({ avg: null, count: 0 });
    if (ratingsDb.prepare) {
      const row = ratingsStmt.stats.get();
      const avg = row && row.avg != null ? Number(row.avg) : null;
      const count = row && row.count != null ? Number(row.count) : 0;
      return res.json({ avg, count });
    } else {
      ratingsDb.get('SELECT COUNT(*) AS count, AVG(value) AS avg FROM ratings', (err, row) => {
        if (err) return res.status(500).json({ error: 'db error' });
        const avg = row && row.avg != null ? Number(row.avg) : null;
        const count = row && row.count != null ? Number(row.count) : 0;
        return res.json({ avg, count });
      });
    }
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/rating', express.json({ limit: '1mb' }), (req, res) => {
  try {
    if (!ratingsDb) return res.status(500).json({ error: 'ratings not available' });
    const value = Number((req.body && req.body.value) || 0);
    if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ error: 'invalid value' });
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const ua = (req.headers['user-agent'] || '').slice(0, 200);
    const nowTs = Date.now();

    // Optional: basic abuse control - limit to 1 per 10 minutes per IP
    if (ratingsDb.prepare) {
      const recent = ratingsStmt.checkByIpRecent.get(ip, nowTs - 10 * 60 * 1000);
      if (recent && recent.c > 0) return res.status(429).json({ error: 'too many ratings from this IP' });
      ratingsStmt.insert.run(value, ip, ua, nowTs);
      const row = ratingsStmt.stats.get();
      return res.json({ ok: true, avg: row && row.avg != null ? Number(row.avg) : null, count: row && row.count != null ? Number(row.count) : 0 });
    } else {
      ratingsDb.get('SELECT COUNT(*) AS c FROM ratings WHERE ip = ? AND created_at > ?', [ip, nowTs - 10 * 60 * 1000], (err, r) => {
        if (err) return res.status(500).json({ error: 'db error' });
        if (r && r.c > 0) return res.status(429).json({ error: 'too many ratings from this IP' });
        ratingsDb.run('INSERT INTO ratings (value, ip, ua, created_at) VALUES (?, ?, ?, ?)', [value, ip, ua, nowTs], (e2) => {
          if (e2) return res.status(500).json({ error: 'db error' });
          ratingsDb.get('SELECT COUNT(*) AS count, AVG(value) AS avg FROM ratings', (e3, row) => {
            if (e3) return res.status(500).json({ error: 'db error' });
            return res.json({ ok: true, avg: row && row.avg != null ? Number(row.avg) : null, count: row && row.count != null ? Number(row.count) : 0 });
          });
        });
      });
    }
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/connection-info', async (req, res) => {
  try {
    const dir = (req.query.dir || '').trim();
    const note = (req.query.note || '').trim();
    let code;
    for (let i = 0; i < 20; i++) {
      const maybe = makeCode();
      if (!connections.has(maybe)) { code = maybe; break; }
    }
    if (!code) return res.status(500).json({ error: 'failed to generate code' });
    const token = makeToken();
    const createdAt = now();
    const expiresAt = createdAt + TOKEN_TTL_MS;
    const info = { token, code, dir, note, createdAt, expiresAt };
    connections.set(code, info);
    const qrDataUrl = await (async () => {
      try { return await qrcode.toDataURL(JSON.stringify({ code, token }), { margin: 1, scale: 6 }); } catch { return null; }
    })();
    return res.json({ connectionData: info, qrDataUrl });
  } catch (err) {
    console.error('connection-info error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.get('/resolve', (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'missing code' });
  const info = connections.get(code);
  if (!info) return res.status(404).json({ error: 'code not found or expired' });
  if (!transfersCache.has(info.token)) transfersCache.set(info.token, new Map());
  return res.json({ connectionData: info });
});

app.get('/folders', (req, res) => {
  try {
    const items = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_sessions').map(d => d.name);
    res.json({ folders: items });
  } catch (e) { res.json({ folders: [] }); }
});
app.post('/folders', (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name || !/^[a-zA-Z0-9-_]+$/.test(name)) return res.status(400).json({ error: 'invalid name' });
  const dest = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  return res.json({ ok: true, name });
});

// upload/start - create ephemeral session and pre-allocate tmp file
app.post('/upload/start', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const { token, transferId, filename, totalSize } = req.body || {};
    if (!token || !transferId) return res.status(400).json({ error: 'missing token or transferId' });
    const sessionId = makeSessionId();
    const createdAt = now();
    const expiresAt = createdAt + SESSION_TTL_MS;

    const tokenDir = path.join(UPLOADS_DIR, token);
    if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });

    const tmpPath = path.join(tokenDir, `transfer-${transferId}.tmp`);

    // persist session to FS
    const sess = { sessionId, token, transferId, filename: sanitizeFilename(filename || `upload-${transferId}`), totalSize: Number(totalSize || 0), createdAt, expiresAt };
    saveSession(sess);

    // persist transfer meta
    const meta = { id: transferId, token, filename: sanitizeFilename(filename || `upload-${transferId}`), totalSize: Number(totalSize || 0), received: 0, status: 'started', sha256: null, created_at: createdAt, updated_at: createdAt };
    saveTransferMeta(token, transferId, meta);

    if (Number(totalSize) > 0) {
      try {
        await fs.promises.truncate(tmpPath, Number(totalSize));
      } catch (e) {
        try { await fs.promises.open(tmpPath, 'a').then(fh => fh.close()); } catch (ee) {}
      }
    } else {
      try { await fs.promises.open(tmpPath, 'a').then(fh => fh.close()); } catch (e) {}
    }

    return res.json({ ok: true, sessionId, expiresAt });
  } catch (err) {
    console.error('upload/start error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// upload/chunk - streaming write to tmp file at offset (no large buffering)
app.post('/upload/chunk', async (req, res) => {
  // Enforce content-type
  if (req.headers['content-type'] !== 'application/octet-stream') {
    return res.status(415).json({ error: 'content-type must be application/octet-stream' });
  }

  try {
    const sessionId = req.headers['x-upload-session'] || req.query.sessionId;
    const offsetHeader = req.headers['x-offset'] || req.query.offset;
    const chunkSha = (req.headers['x-chunk-sha256'] || '').trim();
    if (!sessionId) return res.status(401).json({ error: 'missing session' });
    if (!offsetHeader) return res.status(400).json({ error: 'missing offset' });
    const offset = Number(offsetHeader);
    if (Number.isNaN(offset) || offset < 0) return res.status(400).json({ error: 'invalid offset' });

    const sessRow = loadSession(sessionId);
    if (!sessRow) return res.status(401).json({ error: 'invalid or expired session' });
    if (sessRow.expiresAt < now()) { deleteSession(sessionId); return res.status(401).json({ error: 'session expired' }); }

    const transferId = sessRow.transferId;
    const token = sessRow.token;
    const tokenDir = path.join(UPLOADS_DIR, token);
    if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
    const tmpPath = path.join(tokenDir, `transfer-${transferId}.tmp`);

    // open file descriptor for writing at specific offsets
    const fd = await fs.promises.open(tmpPath, 'r+');

    // we'll stream incoming request and write in pieces to file at moving position
    let position = offset;
    const hash = crypto.createHash('sha256');
    let totalBytes = 0;

    // enforce per-request size by counting bytes and failing if too large
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > CHUNK_LIMIT_BYTES) {
        // destroy request and FD
        try { fd.close(); } catch (e) {}
        req.destroy();
      }
    });

    // sequentially write buffers as they arrive (note: writes are queued and order preserved)
    req.on('data', (chunk) => {
      hash.update(chunk);
      // use fs.write with position to avoid buffering entire chunk
      // don't await here; collect promises to ensure finish
      fs.write(fd.fd, chunk, 0, chunk.length, position, (err, written) => {
        if (err) console.error('write error', err);
      });
      position += chunk.length;
    });

    req.on('end', async () => {
      try {
        await fd.close();
      } catch (e) {}

      // verify chunk sha if provided
      const actualSha = hash.digest('hex');
      if (chunkSha && actualSha !== chunkSha) {
        return res.status(400).json({ error: 'chunk sha mismatch', actualSha });
      }

      // update transfer meta persisted
      const meta = loadTransferMeta(token, transferId) || { id: transferId, received: 0 };
      meta.received = (meta.received || 0) + totalBytes;
      meta.updated_at = now();
      saveTransferMeta(token, transferId, meta);

      uploadsReceivedBytes.inc(totalBytes);

      return res.json({ ok: true, transferId, offsetReceived: offset, bytes: totalBytes, chunkSha: actualSha });
    });

    req.on('error', async (err) => {
      try { await fd.close(); } catch (e) {}
      console.error('request stream error', err);
      return res.status(500).json({ error: 'stream error' });
    });

  } catch (err) {
    console.error('upload/chunk error', err);
    return res.status(500).json({ error: 'server write error' });
  }
});

// compute SHA-256 in worker thread
function computeFileShaInWorker(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('worker_threads');
      const fs = require('fs');
      const crypto = require('crypto');
      (async () => {
        try {
          const stream = fs.createReadStream(workerData.path, { highWaterMark: 8 * 1024 * 1024 });
          const hash = crypto.createHash('sha256');
          for await (const chunk of stream) {
            hash.update(chunk);
          }
          parentPort.postMessage({ sha: hash.digest('hex') });
        } catch (e) {
          parentPort.postMessage({ error: ''+e });
        }
      })();
    `, { eval: true, workerData: { path: filePath } });

    worker.once('message', (m) => {
      if (m && m.sha) resolve(m.sha);
      else reject(new Error(m && m.error ? m.error : 'worker error'));
    });
    worker.once('error', (err) => { reject(err); });
    worker.once('exit', (code) => { if (code !== 0) { /* handled elsewhere */ } });
  });
}

// upload/complete - verify SHA and finalize
app.post('/upload/complete', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const { sessionId, expectedSha256, finalFilename } = req.body || {};
    if (!sessionId || !expectedSha256) return res.status(400).json({ error: 'missing params' });

    const sessRow = loadSession(sessionId);
    if (!sessRow) return res.status(401).json({ error: 'invalid or expired session' });

    const token = sessRow.token;
    const transferId = sessRow.transferId;
    const tokenDir = path.join(UPLOADS_DIR, token);
    const tmpPath = path.join(tokenDir, `transfer-${transferId}.tmp`);
    if (!fs.existsSync(tmpPath)) return res.status(404).json({ error: 'file not found' });

    let computed;
    try { computed = await computeFileShaInWorker(tmpPath); } catch (err) { console.error('sha worker error', err); return res.status(500).json({ error: 'hash computation failed' }); }

    if (!timingEquals(computed, expectedSha256)) { return res.status(400).json({ error: 'final sha mismatch', computed }); }

    const finalName = sanitizeFilename(finalFilename || `upload-${transferId}`);
    const finalPath = path.join(tokenDir, finalName);
    await fs.promises.rename(tmpPath, finalPath);

    // update meta
    const stat = fs.statSync(finalPath);
    const meta = loadTransferMeta(token, transferId) || {};
    meta.status = 'completed'; meta.sha256 = computed; meta.completed_at = now(); meta.size = stat.size; meta.updated_at = now();
    saveTransferMeta(token, transferId, meta);

    // save a receipt file
    const rcptId = `rcpt_${transferId}_${Date.now()}`;
    const rcptPath = path.join(tokenDir, `${rcptId}.json`);
    writeJsonSafe(rcptPath, { id: rcptId, transferId, created_at: now(), finalName, size: stat.size });

    deleteSession(sessionId);
    uploadsCompleted.inc();

    const hostWs = hostsByToken.get(token);
    if (hostWs && hostWs.readyState === hostWs.OPEN) {
      try { hostWs.send(JSON.stringify({ type: 'complete', transferId, finalName, size: stat.size })); } catch (e) {}
    }

    return res.json({ ok: true, transferId, finalName, size: stat.size, sha256: computed });
  } catch (err) {
    console.error('upload/complete error', err);
    return res.status(500).json({ error: 'Could not finalize file' });
  }
});

// TURN creds
app.get('/turn/credentials', (req, res) => {
  if (!TURN_STATIC_SECRET || !TURN_URIS.length) return res.status(500).json({ error: 'TURN server not configured' });
  const ttl = TURN_CREDENTIAL_TTL;
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiry}:${crypto.randomBytes(6).toString('hex')}`;
  const hmac = crypto.createHmac('sha1', TURN_STATIC_SECRET).update(username).digest('base64');
  return res.json({ uris: TURN_URIS, username, credential: hmac, ttl });
});

// ========== WebSocket signaling ==========
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: Number(process.env.WS_MAX_PAYLOAD_BYTES || 200 * 1024 * 1024), perMessageDeflate: false });

wss.on('connection', (ws, req) => {
  try { ws._socket.setNoDelay(true); ws._socket.setKeepAlive(true, 60000); } catch (e) {}
  ws._meta = { role: null, token: null, currentTransferId: null, lastActive: now(), stream: null };

  ws.on('pong', () => ws._meta.lastActive = now());

  const pingInterval = setInterval(() => {
    try {
      if (ws.readyState === ws.OPEN) ws.ping();
      if (Date.now() - ws._meta.lastActive > 10 * 60 * 1000) ws.terminate();
    } catch (e) {}
  }, 30 * 1000);

  ws.on('close', () => clearInterval(pingInterval));
  ws.on('error', (err) => console.warn('ws error', err && err.message));

  ws.on('message', async (data, isBinary) => {
    ws._meta.lastActive = now();

    if (isBinary) {
      const token = ws._meta.token;
      if (!token) return ws.send(JSON.stringify({ type: 'error', message: 'no token' }));
      const host = hostsByToken.get(token);
      if (host && host.readyState === host.OPEN) {
        try { host.send(data, { binary: true }); } catch (e) {}
      } else {
        if (ws._meta.stream) {
          const ok = ws._meta.stream.write(data);
          if (!ok) ws.send(JSON.stringify({ type: 'backpressure' }));
          else ws.send(JSON.stringify({ type: 'ack-chunk', bytes: data.length }));
        } else {
          console.log('binary frame but no stream/host for token', token);
        }
      }
      return;
    }

    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return ws.send(JSON.stringify({ type: 'error', message: 'invalid json' })); }
    const type = msg.type;

    if (type === 'host-register') {
      const token = msg.token;
      if (!token) return ws.send(JSON.stringify({ type: 'error', message: 'missing token' }));
      ws._meta.role = 'host'; ws._meta.token = token; hostsByToken.set(token, ws);
      ws.send(JSON.stringify({ type: 'registered', token }));
      return;
    }

    if (type === 'init') {
      const { token, code, transferId, filename, totalSize, wantP2P } = msg;
      if (!token || !code || !transferId) return ws.send(JSON.stringify({ type: 'error', message: 'init requires token, code, transferId' }));
      const conn = Array.from(connections.values()).find(c => c.code === code && c.token === token);
      if (!conn) return ws.send(JSON.stringify({ type: 'error', message: 'invalid code or token' }));

      let tmap = transfersCache.get(token);
      if (!tmap) { tmap = new Map(); transfersCache.set(token, tmap); }
      if (tmap.size >= MAX_ACTIVE_TRANSFERS) return ws.send(JSON.stringify({ type: 'error', message: 'too many active transfers' }));

      ws._meta.role = 'sender'; ws._meta.token = token; ws._meta.currentTransferId = transferId;
      let transferMeta = { transferId, filename: sanitizeFilename(filename || `upload-${Date.now()}`), totalSize: totalSize || 0, received: 0, startedAt: now(), wantP2P: !!wantP2P };
      tmap.set(transferId, transferMeta);

      const hostWs = hostsByToken.get(token);
      if (hostWs && hostWs.readyState === hostWs.OPEN) {
        hostWs.send(JSON.stringify({ type: 'start', transferId, filename: transferMeta.filename, totalSize: transferMeta.totalSize }));
      } else {
        const tokenDir = path.join(UPLOADS_DIR, token);
        if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
        const outPath = path.join(tokenDir, transferMeta.filename);
        try {
          const stream = fs.createWriteStream(outPath, { flags: 'w', highWaterMark: 4 * 1024 * 1024 });
          ws._meta.stream = stream;
        } catch (e) { console.warn('create stream failed', e); }
      }

      ws.send(JSON.stringify({ type: 'offset', offset: 0, transferId }));
      return;
    }

    if (type === 'webrtc-offer' || type === 'webrtc-answer' || type === 'webrtc-candidate') {
      const token = msg.token || ws._meta.token;
      if (!token) return ws.send(JSON.stringify({ type: 'error', message: 'missing token' }));
      const hostWs = hostsByToken.get(token);
      if (ws._meta.role === 'host') {
        const sset = sendersByToken.get(token);
        if (sset) for (const s of sset) { try { s.send(JSON.stringify(msg)); } catch (e) {} }
      } else {
        if (hostWs && hostWs.readyState === hostWs.OPEN) {
          try { hostWs.send(JSON.stringify(msg)); } catch (e) {}
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'no host connected' }));
        }
      }
      return;
    }

    if (type === 'control') {
      const token = msg.token || ws._meta.token; const action = msg.action;
      if (!token || !action) return ws.send(JSON.stringify({ type: 'error', message: 'missing control' }));
      const hostWs = hostsByToken.get(token);
      if (ws._meta.role === 'host') {
        const sset = sendersByToken.get(token);
        if (sset) for (const s of sset) try { s.send(JSON.stringify(msg)); } catch (e) {}
        ws.send(JSON.stringify({ type: 'ack', message: `host->control ${action}` }));
      } else {
        if (hostWs && hostWs.readyState === hostWs.OPEN) { hostWs.send(JSON.stringify(msg)); ws.send(JSON.stringify({ type: 'ack', message: 'forwarded control' })); } else ws.send(JSON.stringify({ type: 'error', message: 'no host connected' }));
      }
      return;
    }

    if (type === 'done') {
      const token = ws._meta.token; const transferId = ws._meta.currentTransferId || msg.transferId;
      if (!token || !transferId) return ws.send(JSON.stringify({ type: 'error', message: 'missing context' }));
      const hostWs = hostsByToken.get(token);
      if (hostWs && hostWs.readyState === hostWs.OPEN) hostWs.send(JSON.stringify({ type: 'complete', transferId, filename: msg.filename || null }));
      if (ws._meta.stream) { try { await new Promise(r => ws._meta.stream.end(() => r())); ws._meta.stream = null; } catch (e) {} }
      const tmap = transfersCache.get(token); if (tmap && tmap.has(transferId)) tmap.get(transferId).completedAt = now();
      ws.send(JSON.stringify({ type: 'complete', transferId }));
      return;
    }

    ws.send(JSON.stringify({ type: 'error', message: 'unknown type' }));
  });
});

server.on('upgrade', (request, socket, head) => {
  if (!request.url || !request.url.startsWith('/ws')) { socket.destroy(); return; }
  wss.handleUpgrade(request, socket, head, (ws) => { wss.emit('connection', ws, request); });
});

// ========== Periodic cleanup ==========
setInterval(() => {
  try {
    const ts = now();
    // expire sessions
    fs.readdirSync(SESSIONS_DIR).forEach(file => {
      if (!file.endsWith('.json')) return;
      const p = path.join(SESSIONS_DIR, file);
      const obj = readJsonSafe(p);
      if (!obj) { try { fs.unlinkSync(p); } catch (e) {} ; return; }
      if (obj.expiresAt && obj.expiresAt < ts) { try { fs.unlinkSync(p); } catch (e) {} }
    });

    // expire connections
    for (const [code, info] of connections.entries()) {
      if (info.expiresAt && info.expiresAt < ts) connections.delete(code);
    }

    // cleanup old tmp files
    fs.readdirSync(UPLOADS_DIR, { withFileTypes: true }).forEach(dirent => {
      if (!dirent.isDirectory()) return;
      if (dirent.name === '_sessions') return;
      const dirPath = path.join(UPLOADS_DIR, dirent.name);
      fs.readdirSync(dirPath).forEach(file => {
        if (!file.includes('transfer-')) return;
        const p = path.join(dirPath, file);
        try {
          const stat = fs.statSync(p);
          if (Date.now() - stat.mtimeMs > MAX_TMP_FILE_AGE_MS) fs.unlinkSync(p);
        } catch (e) {}
      });
    });
  } catch (err) {
    console.warn('cleanup job error', err);
  }
}, 60 * 60 * 1000);

// ========== Start server ==========
server.listen(PORT, () => {
  console.log(`Transfer server listening on port ${PORT} [pid:${process.pid}]`);
  console.log(`NODE_ENV=${NODE_ENV} TRUST_PROXY=${TRUST_PROXY} USE_CLUSTER=${USE_CLUSTER}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  console.log(`TURN enabled: ${ENABLE_TURN} URIs: ${TURN_URIS.join(',')}`);
});
