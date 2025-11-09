/**
 * server.js
 *
 * Simple transfer server for the React client you uploaded.
 *
 * Endpoints:
 *  - GET  /connection-info?dir=&note=
 *  - GET  /resolve?code=XXXX
 *  - GET  /folders
 *  - POST /folders  { name }
 *
 * WebSocket:
 *  - ws://<server-ip>:3000/ws
 *
 * Protocol (JSON messages over text frames):
 *  - From sender -> server: { type: "init", token, code, transferId, filename, totalSize }
 *  - Server -> registered host: { type: "start", transferId, filename, totalSize }
 *  - Binary frames: raw file data forwarded to host (or collected if host==server)
 *  - Sender -> server: JSON { type: "done" } -> server -> host { type: "complete" }
 *  - Control messages forwarded between host and sender: { type: "control", action: "pause"|"resume"|"stop", transferId }
 *
 * This file keeps all state in memory (maps). For production persist to DB or filesystem.
 */

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const qrcode = require("qrcode");
const cors = require("cors");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const UPLOADS_DIR = path.join(__dirname, "uploads");
// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

/**
 * CORS configuration
 *
 * Allow the frontend origin(s) that will call this API.
 * Replace or add origins to `allowedOrigins` as needed.
 *
 * NOTE: If you prefer to allow any origin (development-only), you can set `origin: true`.
 */
const allowedOrigins = [
  "http://localhost:5173",               // dev: Vite / local dev (keep if used)
  "http://localhost:3000",               // dev: other local dev cases
  "https://skypiea-site.onrender.com",   // your deployed frontend site (change if different)
  "https://skypiea1.onrender.com"        // optionally allow same-origin if needed
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin like curl or server-to-server
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // CORS not allowed for this origin
      return callback(new Error("CORS policy: origin not allowed"), false);
    }
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());


// In-memory stores
// code -> connection info
const connections = new Map(); // code -> { token, code, ip, port, dir, note, createdAt }
// token -> websocket of registered host
const hostsByToken = new Map();
// token -> { pendingTransfers: Map<transferId, {...}> } (if you want server-side storing)
const transfersByToken = new Map();

// helper: generate friendly 4-digit code (letters+numbers, uppercase)
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function makeToken() {
  return crypto.randomBytes(18).toString("hex");
}

function getLocalIp() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const info of ifs[name]) {
      if (!info.internal && info.family === "IPv4") {
        return info.address;
      }
    }
  }
  return "127.0.0.1";
}

// Create a QR payload (the client expects ip/port/token/code fields in the payload)
async function makeQrDataUrl(payload) {
  // we'll stringify payload as JSON inside the QR
  try {
    return await qrcode.toDataURL(JSON.stringify(payload), { margin: 1, scale: 6 });
  } catch (e) {
    console.warn("QR encode failed:", e);
    return null;
  }
}

// Create connection info endpoint
app.get("/connection-info", async (req, res) => {
  try {
    const dir = (req.query.dir || "").trim();
    const note = (req.query.note || "").trim();

    // choose a unique code (retry a few times)
    let code;
    for (let i = 0; i < 6; i++) {
      const maybe = makeCode();
      if (!connections.has(maybe)) {
        code = maybe;
        break;
      }
    }
    if (!code) return res.status(500).json({ error: "Failed to generate code" });

    const token = makeToken();
    const ip = getLocalIp();
    const port = PORT;

    const info = {
      token,
      code,
      ip,
      port,
      dir: dir || "",
      note,
      createdAt: Date.now(),
    };

    connections.set(code, info);
    // Also create a token -> code mapping (store inside info)
    transfersByToken.set(token, { transfers: new Map() });

    const qrPayload = { ip, port, token, code, dir: info.dir, note: info.note };
    const qrDataUrl = await makeQrDataUrl(qrPayload);

    return res.json({ connectionData: info, qrDataUrl });
  } catch (err) {
    console.error("connection-info error:", err);
    return res.status(500).json({ error: "server error" });
  }
});

// Resolve code to connection (used by sender)
app.get("/resolve", (req, res) => {
  const code = (req.query.code || "").trim();
  if (!code) return res.status(400).json({ error: "missing code" });
  const info = connections.get(code);
  if (!info) return res.status(404).json({ error: "Code not found" });
  // return same shape as connection-info's connectionData
  return res.json({ connectionData: info });
});

// Simple folders endpoints (create list under ./uploads)
app.get("/folders", (req, res) => {
  try {
    const items = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    res.json({ folders: items });
  } catch (e) {
    console.error("folders err:", e);
    res.json({ folders: [] });
  }
});

app.post("/folders", (req, res) => {
  const name = (req.body && req.body.name || "").trim();
  if (!name || !/^[a-zA-Z0-9-_]+$/.test(name)) {
    return res.status(400).json({ error: "invalid name" });
  }
  const dest = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  return res.json({ ok: true, name });
});

// HTTP server & WebSocket upgrade
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true, path: "/ws", maxPayload: 50 * 1024 * 1024 });

// For safety, limit how long a transfer can stay idle
const TRANSFER_IDLE_MS = 5 * 60 * 1000; // 5 minutes

function safeSend(ws, obj) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch (e) { /* ignore */ }
}

wss.on("connection", (ws, req) => {
  console.log("ws: connection from", req.socket.remoteAddress);

  // connection state:
  // - role: 'sender' | 'host'
  // - token (shared)
  // - currentTransferId
  // - fileWriteStream (if server is saving)
  ws._meta = { role: null, token: null, currentTransferId: null, lastActive: Date.now(), stream: null };

  // heartbeat / activity
  ws.on("pong", () => { ws._meta.lastActive = Date.now(); });

  // periodic ping
  const pingInterval = setInterval(() => {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
      // close if idle too long
      if (Date.now() - ws._meta.lastActive > TRANSFER_IDLE_MS) {
        console.log("ws: idle timeout, terminating");
        ws.terminate();
      }
    } catch (e) { /* ignore */ }
  }, 30 * 1000);

  ws.on("close", () => {
    clearInterval(pingInterval);
    // cleanup host registry if needed
    if (ws._meta.role === "host" && ws._meta.token) {
      const prev = hostsByToken.get(ws._meta.token);
      if (prev === ws) {
        hostsByToken.delete(ws._meta.token);
        console.log("host unregistered for token", ws._meta.token);
      }
    }
    // cleanup stream
    try { if (ws._meta.stream) ws._meta.stream.close?.(); } catch (e) {}
  });

  ws.on("error", (err) => {
    console.warn("ws error", err && err.message);
  });

  ws.on("message", async (data, isBinary) => {
    ws._meta.lastActive = Date.now();
    // If binary frame and we have a host registered, forward it to host
    if (isBinary) {
      const token = ws._meta.token;
      // If the sender connected and we have a registered host for token, forward
      if (token && hostsByToken.has(token)) {
        const hostWs = hostsByToken.get(token);
        if (hostWs && hostWs.readyState === WebSocket.OPEN) {
          // forward raw binary
          try {
            hostWs.send(data, { binary: true }, (err) => {
              if (err) console.error("forward binary error:", err);
            });
          } catch (e) {
            console.error("forward binary exception:", e);
          }
        } else {
          // host not available
          safeSend(ws, { type: "error", message: "Host disconnected" });
        }
      } else {
        // No host registered: server can optionally write file to disk for downloads
        // If the sender itself expects the server to save it, we can write to a temp file (not used in your client by default).
        console.log("binary received but no host registered for token", token);
      }
      return;
    }

    // Otherwise treat message as text JSON
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.warn("invalid json message", e && e.message);
      return safeSend(ws, { type: "error", message: "invalid json" });
    }

    const { type } = msg;
    if (!type) return safeSend(ws, { type: "error", message: "missing type" });

    // --- Host registers to receive direct downloads ---
    if (type === "host-register") {
      const token = msg.token;
      if (!token) return safeSend(ws, { type: "error", message: "missing token" });
      ws._meta.role = "host";
      ws._meta.token = token;
      hostsByToken.set(token, ws);
      console.log("host registered for token", token);
      return safeSend(ws, { type: "registered", token });
    }

    // Sender init: expect token, code, filename, totalSize, transferId
    if (type === "init") {
      const { token, code, transferId, filename, totalSize } = msg;
      if (!token || !code || !transferId) {
        return safeSend(ws, { type: "error", message: "init requires token, code, transferId" });
      }
      ws._meta.role = "sender";
      ws._meta.token = token;
      ws._meta.currentTransferId = transferId;

      // Validate that code exists and maps to token
      const conn = Array.from(connections.values()).find(c => c.code === code && c.token === token);
      if (!conn) {
        console.log("init: code/token mismatch", code, token);
        return safeSend(ws, { type: "error", message: "invalid code or token" });
      }

      // Record transfer info
      const tstore = transfersByToken.get(token) || { transfers: new Map() };
      const transfer = {
        transferId,
        filename: filename || `upload-${Date.now()}`,
        totalSize: totalSize || 0,
        received: 0,
        startedAt: Date.now(),
      };
      tstore.transfers.set(transferId, transfer);
      transfersByToken.set(token, tstore);

      // If a host is connected for this token, tell host to expect start
      const hostWs = hostsByToken.get(token);
      if (hostWs && hostWs.readyState === WebSocket.OPEN) {
        safeSend(hostWs, { type: "start", transferId, filename: transfer.filename, totalSize: transfer.totalSize });
        console.log("forwarded start to host for transfer", transferId);
      } else {
        // no host; server could save to disk — we'll save to uploads/<token>/<filename>
        const tokenDir = path.join(UPLOADS_DIR, token);
        if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
        const outPath = path.join(tokenDir, transfer.filename);
        try {
          ws._meta.stream = fs.createWriteStream(outPath);
          console.log("no host connected; writing incoming file to", outPath);
        } catch (e) {
          console.warn("failed to create write stream", e);
        }
      }

      safeSend(ws, { type: "offset", offset: 0 }); // allow sender to start at 0
      return;
    }

    // done message from sender
    if (type === "done") {
      const token = ws._meta.token;
      const transferId = ws._meta.currentTransferId || msg.transferId;
      if (!token || !transferId) return safeSend(ws, { type: "error", message: "missing transfer context" });

      // Notify host
      const hostWs = hostsByToken.get(token);
      if (hostWs && hostWs.readyState === WebSocket.OPEN) {
        safeSend(hostWs, { type: "complete", transferId, filename: msg.filename || null });
      }

      // finalize server-side write stream
      if (ws._meta.stream) {
        try {
          ws._meta.stream.end();
          ws._meta.stream = null;
        } catch (e) { /* ignore */ }
      }

      // mark transfer complete
      const tstore = transfersByToken.get(token);
      if (tstore && tstore.transfers.has(transferId)) {
        const t = tstore.transfers.get(transferId);
        t.completedAt = Date.now();
      }

      safeSend(ws, { type: "complete", transferId });
      return;
    }

    // control messages: pause/resume/stop forwarded to host or sender depending on who sent it
    if (type === "control") {
      const token = msg.token || ws._meta.token;
      const action = msg.action;
      if (!token || !action) return safeSend(ws, { type: "error", message: "missing control token/action" });

      const hostWs = hostsByToken.get(token);
      // If a host exists and the current ws is not the host, forward control to host.
      // If current ws is host, broadcast to sender(s) (we don't track senders map, so just reply with ack).
      if (ws._meta.role === "host") {
        // host controlling sender side: we can't target specific sender easily; reply ok
        safeSend(ws, { type: "ack", message: `host->control ${action}` });
      } else {
        if (hostWs && hostWs.readyState === WebSocket.OPEN) {
          safeSend(hostWs, { type: "control", action, transferId: msg.transferId });
          safeSend(ws, { type: "ack", message: "forwarded control to host" });
        } else {
          // no host -> ack with error
          safeSend(ws, { type: "error", message: "no host connected to accept control" });
        }
      }
      return;
    }

    // pause/resume/resolved messages from host to sender are application specifics; implement simple forward
    if (type === "paused" || type === "resumed" || type === "stopped" || type === "error") {
      // try forward to sender(s) by token — we don't keep a list per token of senders (could add), but we can broadcast
      // For now, acknowledge
      console.log("status message from ws:", msg.type, msg);
      return;
    }

    // unknown type
    safeSend(ws, { type: "error", message: "unknown type" });
  });
});

// attach upgrade handler so ws path works with same http server
server.on("upgrade", function upgrade(request, socket, head) {
  // You can validate origin or do auth here if needed
  const { url } = request;
  if (url && url.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`HTTP endpoints: http://localhost:${PORT}/connection-info  http://localhost:${PORT}/resolve`);
  console.log(`Uploads stored in ${UPLOADS_DIR}`);
});
