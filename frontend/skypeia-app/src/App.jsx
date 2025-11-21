﻿// App.jsx — merged version with in-file ConnectedPanel and full app logic
import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import "./App.css";
import { ConnectedIcon, DisconnectedIcon } from "./components/ConnectionIcons";
import Ribbons from "./components/Ribbons";
import { SiBluesky } from "react-icons/si";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Features from "./components/Features";
import Support from "./components/Support";
import Privacy from "./components/Privacy";
import Contact from "./components/Contact";
import ConfettiBlast from "./components/ConfettiBlast";

/*
  SINGLE CHANGEABLE BASE URL — update this if your API host changes.
  Uses HTTPS for fetch and WSS for websockets automatically.
  Changed to localhost as requested.
*/
const API_BASE = (() => {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:3000";
  }
  return "https://skypiea-1.onrender.com";
})();
const WS_SCHEME = API_BASE.startsWith("https://") ? "wss" : "ws";
const WS_BASE = `${WS_SCHEME}://${new URL(API_BASE).host}`;

const RECEIVE_OPTION = { CODE: "code", QR: "qr" };
const HOST_STEPS = { CONFIGURE: "configure", DISPLAY_CODE: "display_code" };
const RECEIVE_STEPS = { SETUP: "setup", CONNECT: "connect", SEND_FILE: "send_file" };

const PRESET_PROFILES = [
  { name: "Gojo Satoru", emoji: "🕶️" },
  { name: "Itachi Uchiha", emoji: "🦅" },
  { name: "Light Yagami", emoji: "📓" },
  { name: "L (Lawliet)", emoji: "🍰" },
  { name: "Levi Ackerman", emoji: "🧹" },
  { name: "Saitama", emoji: "🥚" },
  { name: "Denji", emoji: "🪚" },
  { name: "Naruto Uzumaki", emoji: "🍜" },
];

function hashStringToIndex(str) {
  if (!str) return 0;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h) % PRESET_PROFILES.length;
}

function profileForKey(key) {
  return PRESET_PROFILES[hashStringToIndex(String(key || ""))];
}

/* ===== ConnectedPanel (in-file) ===== */
function ConnectedPanel(props) {
  const {
    persona,
    note,
    ip,
    port,
    showTechDetails,
    onToggleTech,
    file,
    onFileChange,
    onStart,
    isTransmitting,
    disabled,
    ConnectedIcon: ConnectedIconProp,
  } = props;

  const FilePill = ({ file }) =>
    file ? (
      <div className="file-pill">
        <div className="file-name" title={file.name}>
          {file.name.length > 28 ? file.name.slice(0, 24) + "…" : file.name}
        </div>
        <div className="file-size">{file.size ? `${Math.round(file.size / 1024)} KB` : ""}</div>
      </div>
    ) : null;

  const AvatarChipLocal = ({ persona }) => (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(43,70,60,0.06)",
        border: "1px solid rgba(43,70,60,0.12)",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{persona?.emoji || "🟢"}</span>
      <span style={{ fontWeight: 600, color: "#2b463c" }}>{persona?.name || "Peer"}</span>
    </div>
  );

  return (
    <div className="connection-box connected-panel" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Connected to
          </span>
          <AvatarChipLocal persona={persona} />
          <span style={{ marginLeft: 8, verticalAlign: "middle", color: "#2b463c" }}>
            {ConnectedIconProp ? <ConnectedIconProp /> : <ConnectedIcon />}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="linklike" onClick={onToggleTech} aria-expanded={!!showTechDetails} style={{ fontSize: 13 }}>
            {showTechDetails ? "Hide technical details" : "Show technical details"}
          </button>
        </div>
      </div>

      {note && <p className="note" style={{ marginTop: 8 }}>{note}</p>}

      {showTechDetails && (
        <div className="muted tech-details" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div>IP: <strong>{ip || "—"}</strong></div>
            <div>Port: <strong>{port || "—"}</strong></div>
          </div>
        </div>
      )}

      <div className="file-select-row" style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <label className="file-chooser" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          <input
            type="file"
            onChange={(e) => onFileChange && onFileChange(e.target.files?.[0] || null)}
            aria-label="Choose file to send"
            disabled={disabled}
          />
          <span className="file-chooser-btn muted-btn">Choose file</span>
        </label>

        {file ? <FilePill file={file} /> : <div className="muted" style={{ fontSize: 13 }}>No file chosen</div>}
      </div>

      <div className="host-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="primary" onClick={onStart} disabled={disabled || !file || isTransmitting}>
          {isTransmitting ? "Transmitting…" : "Start"}
        </button>
      </div>
    </div>
  );
}
/* ===== end ConnectedPanel ===== */

function ScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanTimerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia not supported");
        return;
      }

      const constraints = {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const vid = videoRef.current;
      if (vid) {
        vid.srcObject = stream;
        vid.autoplay = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.play().catch((e) => {
          console.warn("video play rejected:", e);
        });
      }

      startScanningLoop();
    } catch (err) {
      console.error("Camera start failed:", err);
    }
  };

  const stopCamera = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore stop failures */
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* ignore detach failures */
      }
    }
  };

  const startScanningLoop = () => {
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) {
      console.error("Canvas 2D not available for scanning");
      return;
    }

    const HAVE_ENOUGH =
      typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.HAVE_ENOUGH_DATA === "number"
        ? HTMLMediaElement.HAVE_ENOUGH_DATA
        : 2;

    scanTimerRef.current = setInterval(() => {
      try {
        const vid = videoRef.current;
        if (!vid) return;
        if (typeof vid.readyState !== "number" || vid.readyState < HAVE_ENOUGH) return;

        const vw = vid.videoWidth || vid.clientWidth;
        const vh = vid.videoHeight || vid.clientHeight;
        if (!vw || !vh) return;

        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = typeof jsQR === "function" ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" }) : null;

        if (code && code.data) {
          onDetected(code.data);
          stopCamera();
        }
      } catch (e) {
        console.error("scan loop error:", e);
      }
    }, 200);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="scanner-modal-backdrop" role="dialog" aria-modal="true">
      <div className="scanner-modal">
        <div className="scanner-header">
          <strong>Scan QR</strong>
          <button onClick={handleClose} className="scanner-close">
            Close
          </button>
        </div>

        <div className="scanner-body">
          <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className="scanner-overlay">
            <div className="scanner-status">Scanning…</div>
            <div className="scanner-instruction">Hold QR inside the box</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  
  React.useEffect(() => {
    if (!document.getElementById("connected-panel-styles")) {
      const s = document.createElement("style");
      s.id = "connected-panel-styles";
      s.innerHTML = `
      .connected-panel { padding: 12px; border-radius: 10px; background: #fff; box-shadow: none; }
      .connected-panel .tech-details { font-size: 13px; color: #6b6b6b; padding: 8px 6px; border-radius: 8px; border: 1px dashed rgba(43,70,60,0.06); }
      .file-chooser { display: inline-flex; align-items: center; gap: 8px; position: relative; overflow: hidden; cursor: pointer; }
      .file-chooser input[type="file"] { position: absolute; left: 0; top: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
      .file-chooser .file-chooser-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(43,70,60,0.10); background: #ffffff; cursor: pointer; }
      .file-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:10px; background: rgba(43,70,60,0.04); border:1px solid rgba(43,70,60,0.06); font-size:13px; }
      .file-pill .file-name { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .file-pill .file-size { font-size: 12px; color: #6b6b6b; }
      .linklike { background: none; border: none; color: #2b463c; text-decoration: underline; cursor: pointer; padding: 4px 6px; }

      /* Transmission constraints card matches log-card look */
      .constraints-card { padding: 12px; border-radius: 8px; background: #ffffff; border: 1px solid rgba(43,70,60,0.06); margin-top: 12px; }
      .constraints-card h4 { margin: 0 0 8px 0; color: #2b463c; }
      .constraints-list { margin: 0; padding: 0; list-style: none; font-size: 13px; color: #444; }
      .constraints-list li { 
        display: flex; 
        gap: 8px; 
        align-items: flex-start; 
        padding: 6px 0; 
        border-bottom: 1px dashed rgba(0,0,0,0.03);
        flex-wrap: wrap;
      }
      .constraints-list li:last-child { border-bottom: none; }
      .constraints-key { 
        min-width: 160px; 
        color: #2b463c; 
        background: rgba(177,209,130,0.15); 
        font-weight: 600; 
        padding: 3px 6px; 
        border-radius: 4px;
        flex-shrink: 0;
      }
      .constraints-value { 
        color: #444; 
        background: rgba(43,70,60,0.08); 
        font-weight: 500; 
        padding: 3px 6px; 
        border-radius: 4px;
        flex: 1;
      }
      
      @media (max-width: 768px) {
        .constraints-list li {
          flex-direction: column !important;
          gap: 4px !important;
          align-items: stretch !important;
          padding: 8px 0 !important;
        }
        .constraints-key {
          min-width: auto !important;
          width: 100% !important;
          text-align: center !important;
          font-size: 12px !important;
        }
        .constraints-value {
          width: 100% !important;
          text-align: center !important;
          font-size: 12px !important;
        }
      }

      .log-card { margin-top: 12px; padding: 12px; border-radius: 8px; background: #fff; border: 1px solid rgba(43,70,60,0.06); }
      .log-head { font-weight: 700; color: #2b463c; margin-bottom: 8px; }
      .log-area { max-height: 210px; overflow: auto; background: #fafafa; border-radius: 6px; padding: 8px; font-size: 12px; }

      /* Confirmation Modal Styling */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      }

      .modal-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
      }

      .modal-card h3 {
        margin: 0 0 12px 0;
        color: #2b463c;
        font-size: 18px;
        font-weight: 600;
      }

      .modal-card p {
        margin: 0;
        color: #666;
        font-size: 14px;
        line-height: 1.5;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { 
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      `;
      document.head.appendChild(s);
    }
  }, []);

  // --- full existing app state & logic (copied/preserved from your original file) ---
  const [introText, setIntroText] = useState("");
  const introFull = "Welcome to Skypiea — share files with calm.";
  const typingRef = useRef(0);

  const [mode, setMode] = useState(null);
  const [hostStep, setHostStep] = useState(HOST_STEPS.CONFIGURE);
  const [receiveStep, setReceiveStep] = useState(RECEIVE_STEPS.SETUP);

  const [hostFolder, setHostFolder] = useState("");
  const [availableFolders, setAvailableFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [note, setNote] = useState("");
  const [connection, setConnection] = useState(null);
  const [resolved, setResolved] = useState(null);
  const [saveToDownloads, setSaveToDownloads] = useState(true);
  const [showOptionalDestination, setShowOptionalDestination] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [file, setFile] = useState(null);

  const [log, setLog] = useState("");
  const [progress, setProgress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [receiveOption, setReceiveOption] = useState(RECEIVE_OPTION.CODE);
  const [openScanner, setOpenScanner] = useState(false);
  const [scannedText, setScannedText] = useState("");

  // Refs for websockets/chunks
  const wsRef = useRef(null);
  const hostWsRef = useRef(null);
  const hostChunksRef = useRef({ chunks: [], received: 0, total: 0, filename: "" });
  const pausedRef = useRef(false);
  const stoppedRef = useRef(false);
  const resumeResolveRef = useRef(null);
  const transferIdRef = useRef(null);
  const hostTransferIdRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const [showTechDetails, setShowTechDetails] = useState(false);

  // confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({ title: "", body: "", onConfirm: null });

  // confetti blast state
  const [showConfetti, setShowConfetti] = useState(false);

  // permission denied retry state

  // Typing intro
  useEffect(() => {
    typingRef.current = 0;
    setIntroText("");
    let t;
    function tick() {
      if (typingRef.current <= introFull.length) {
        setIntroText(introFull.slice(0, typingRef.current));
        typingRef.current += 1;
        t = setTimeout(tick, 40 + Math.random() * 60);
      } else {
        clearTimeout(t);
      }
    }
    tick();
    return () => clearTimeout(t);
  }, []);

  const logMsg = (...args) => setLog((l) => `${new Date().toLocaleTimeString()} - ${args.join(" ")}\n` + l);

  const clearError = () => setError(null);

  const validateFolderName = (name) => {
    if (!name) return true;
    return /^[a-zA-Z0-9-_]+$/.test(name);
  };

  // helpers
  async function createFolderOnServer(name) {
    try {
      const res = await fetch(`${API_BASE}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("create failed");
      setAvailableFolders((p) => [name, ...p]);
      setHostFolder(name);
      setNewFolderName("");
    } catch (e) {
      console.error(e);
      setError(e?.message || "create failed");
    }
  }

  // Generate host & open host websocket
  async function generateHost() {
    clearError();
    const dir = hostFolder.trim();
    if (!validateFolderName(dir)) {
      setError("Invalid folder name.");
      return;
    }
    setIsLoading(true);
    setConnection(null);
    setProgress("");
    try {
      const folderToUse = saveToDownloads ? "" : dir;
      const url = folderToUse
        ? `${API_BASE}/connection-info?dir=${encodeURIComponent(folderToUse)}&note=${encodeURIComponent(note)}`
        : `${API_BASE}/connection-info?note=${encodeURIComponent(note)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const j = await res.json();
      const persona = profileForKey(j.connectionData.code || j.connectionData.token);
      const generatedAt = Date.now();
      setConnection({ ...j.connectionData, qrDataUrl: j.qrDataUrl, generatedAt, persona });
      logMsg("Receive ready. Code:", j.connectionData.code);
      
      // Start 5-minute countdown timer
      setTimeRemaining(300); // 5 minutes in seconds
      const countdownInterval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Set 5-minute timeout to abort connection
      connectionTimeoutRef.current = setTimeout(() => {
        clearInterval(countdownInterval);
        setTimeRemaining(null);
        setConnection(null);
        setProgress("");
        
        // Close websocket if open
        if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
          try {
            hostWsRef.current.close();
          } catch (e) {
            console.error("Error closing expired connection:", e);
          }
          hostWsRef.current = null;
        }
        
        logMsg("Connection expired after 5 minutes");
        setError("Connection code expired after 5 minutes. Please generate a new code.");
      }, 5 * 60 * 1000); // 5 minutes

      if (saveToDownloads) {
        try {
          const { token } = j.connectionData;
          // Use central WSS endpoint (WS_BASE) for browsers when hosted
          const hws = new WebSocket(`${WS_BASE}/ws`);
          hws.binaryType = "arraybuffer";
          hostWsRef.current = hws;

          hws.onopen = () => {
            try {
              hws.send(JSON.stringify({ type: "host-register", token }));
            } catch (err) {
              console.error("host register send error:", err);
            }
            logMsg("Receiver websocket registered for direct download");
          };

          hws.onmessage = (ev) => {
            if (typeof ev.data === "string") {
              let m = {};
              try {
                m = JSON.parse(ev.data);
              } catch (parseErr) {
                console.error("Failed to parse host WS message", parseErr);
                return;
              }
              if (m.type === "start") {
                // Clear timeout since connection is established
                if (connectionTimeoutRef.current) {
                  clearTimeout(connectionTimeoutRef.current);
                  connectionTimeoutRef.current = null;
                }
                setTimeRemaining(null);
                
                hostChunksRef.current.chunks = [];
                hostChunksRef.current.received = 0;
                hostChunksRef.current.total = m.totalSize || 0;
                hostChunksRef.current.filename = m.filename || "download.bin";
                setProgress("0%");
                logMsg("Incoming file:", hostChunksRef.current.filename);
              } else if (m.type === "complete") {
                const blob = new Blob(hostChunksRef.current.chunks);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = m.filename || hostChunksRef.current.filename || "download.bin";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setProgress("Done");
                setShowConfetti(true); // Trigger confetti blast on successful download
                logMsg("Download finished:", a.download);
                hostChunksRef.current.chunks = [];
              } else if (m.type === "error") {
                setError(m.message || "Receiver error");
              } else if (m.type === "control" && m.action) {
                if (m.action === "pause") {
                  setIsPaused(true);
                  pausedRef.current = true;
                } else if (m.action === "resume") {
                  setIsPaused(false);
                  pausedRef.current = false;
                } else if (m.action === "stop") {
                  setIsTransmitting(false);
                  setIsPaused(false);
                }
              }
            } else if (ev.data instanceof ArrayBuffer) {
              const arr = new Uint8Array(ev.data);
              hostChunksRef.current.chunks.push(arr);
              hostChunksRef.current.received += arr.byteLength;
              if (hostChunksRef.current.total) {
                setProgress(`${Math.round((hostChunksRef.current.received / hostChunksRef.current.total) * 100)}%`);
              } else {
                setProgress(`${hostChunksRef.current.received} bytes`);
              }
            }
          };

          hws.onerror = (e) => {
            logMsg("Receiver WS error", e?.message || e);
            setError("Receiver websocket failed");
          };

          hws.onclose = () => {
            logMsg("Receiver websocket closed");
          };
        } catch (err) {
          logMsg("Failed to open receiver websocket:", err?.message || err);
          // non-fatal; server-side fallback still works
        }
      }

      setHostStep(HOST_STEPS.DISPLAY_CODE);
    } catch (e) {
      console.error(e);
      logMsg("Failed to create receiver:", e?.message || e);
      setError(e?.message || "Failed to create receiver");
    } finally {
      setIsLoading(false);
    }
  }

  async function resolveCode(overrideCode) {
    clearError();
    const rawCode = overrideCode ?? codeInput;
    const trimmedCode = rawCode ? rawCode.trim() : "";
    if (!trimmedCode) {
      setError("Please enter a code.");
      return;
    }
    if (mode === "send" && !saveToDownloads) {
      setError("To send files, you must acknowledge 'Save to downloads'.");
      return;
    }
    setCodeInput(trimmedCode);
    setIsLoading(true);
    setResolved(null);
    setProgress("");
    try {
      const res = await fetch(`${API_BASE}/resolve?code=${encodeURIComponent(trimmedCode)}`);
      if (!res.ok) {
        if (res.status === 404) {
          // Check if code format looks correct
          const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
          if (!codePattern.test(trimmedCode)) {
            throw new Error(`Invalid code format. Expected format: ABCD-1234 (got: "${trimmedCode}")`);
          } else {
            throw new Error(`Code "${trimmedCode}" not found. Please check if:\n• The code was typed correctly\n• The receiver is still online\n• The code hasn't expired (5-minute limit)`);
          }
        } else {
          throw new Error(`Server error (${res.status}). Please try again.`);
        }
      }
      const j = await res.json();
      const persona = profileForKey(j.connectionData.code || j.connectionData.token);
      setResolved({ ...j.connectionData, persona });
      logMsg("Resolved code to connection info.");
      setReceiveStep(RECEIVE_STEPS.SEND_FILE);
    } catch (e) {
      console.error(e);
      logMsg("Resolve error:", e?.message || e);
      setError(e?.message || "Failed to resolve code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startSend() {
    clearError();
    if (!resolved || !file) {
      setError("Please select a file and ensure code is resolved.");
      return;
    }
    setIsLoading(true);
    setProgress("0%");
    try {
      const ws = new WebSocket(`${WS_BASE}/ws`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const transferId = "t-" + Math.random().toString(36).slice(2, 10);
        transferIdRef.current = transferId;
        pausedRef.current = false;
        stoppedRef.current = false;
        setIsTransmitting(true);
        setIsPaused(false);
        ws.send(
          JSON.stringify({
            type: "init",
            token: resolved.token,
            code: resolved.code,
            transferId,
            filename: file.name,
            totalSize: file.size,
          })
        );
      };

      ws.onmessage = async (ev) => {
        if (typeof ev.data === "string") {
          const msg = JSON.parse(ev.data);
          if (msg.type === "offset") {
            const chunkSize = 512 * 1024;
            let pos = msg.offset || 0;
            try {
              while (pos < file.size) {
                if (stoppedRef.current) break;
                if (pausedRef.current) {
                  setIsPaused(true);
                  await new Promise((resolve) => {
                    resumeResolveRef.current = resolve;
                  });
                  setIsPaused(false);
                  resumeResolveRef.current = null;
                }
                const slice = file.slice(pos, Math.min(pos + chunkSize, file.size));
                const chunk = await slice.arrayBuffer();
                if (ws.readyState !== WebSocket.OPEN) throw new Error("Connection lost");
                ws.send(chunk);
                pos += chunk.byteLength;
                setProgress(`${Math.round((pos / file.size) * 100)}%`);
                await new Promise((r) => setTimeout(r, 1));
              }
              if (!stoppedRef.current) {
                ws.send(JSON.stringify({ type: "done" }));
              } else {
                setProgress("Stopped");
                try {
                  ws.send(JSON.stringify({ type: "control", action: "stop", transferId: transferIdRef.current }));
                } catch (e) {
                  console.error(e);
                }
                ws.close();
              }
            } catch (err) {
              logMsg("Upload error:", err?.message || err);
              setError(err?.message || "Upload failed");
            }
          } else if (msg.type === "complete") {
            logMsg("Transfer complete!");
            setProgress("Done!");
            setIsTransmitting(false);
            setShowConfetti(true); // Trigger confetti blast on successful completion
            ws.close();
          } else if (msg.type === "paused") {
            pausedRef.current = true;
            setIsPaused(true);
            logMsg("Transfer paused");
          } else if (msg.type === "resumed") {
            pausedRef.current = false;
            setIsPaused(false);
            if (resumeResolveRef.current) {
              resumeResolveRef.current();
            }
            logMsg("Transfer resumed");
          } else if (msg.type === "stopped") {
            stoppedRef.current = true;
            setIsTransmitting(false);
            setIsPaused(false);
            setProgress("Stopped by receiver");
            ws.close();
          } else if (msg.type === "error") {
            throw new Error(msg.message);
          }
        }
      };

      ws.onerror = (e) => {
        logMsg("WebSocket error:", e?.message || e);
        setError("Connection error");
      };

      ws.onclose = () => {
        setIsLoading(false);
        setIsTransmitting(false);
        setIsPaused(false);
      };
    } catch (e) {
      console.error(e);
      logMsg("Send error:", e?.message || e);
      setError(e?.message || "Transfer failed");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadFolders() {
      try {
        const res = await fetch(`${API_BASE}/folders`);
        if (res.ok) {
          const j = await res.json();
          setAvailableFolders(j.folders || []);
        }
      } catch (e) {
        console.error("Failed to load folders:", e);
        setError("Failed to load folders");
      }
    }
    loadFolders();

    return () => {
      // cleanup on unmount
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
      } catch (e) {
        console.error("Error closing wsRef on unmount:", e);
      }
      try {
        if (hostWsRef.current?.readyState === WebSocket.OPEN) hostWsRef.current.close();
      } catch (e) {
        console.error("Error closing hostWsRef on unmount:", e);
      }
      
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, []);

  // When user toggles between Scan QR and Use Code, force stop camera immediately
  useEffect(() => {
    if (receiveOption !== RECEIVE_OPTION.QR) {
      setOpenScanner(false);
      setScannedText("");
    }
  }, [receiveOption]);

  // ------- Scanner integration -------
  const handleScannerDetected = (payload) => {
    if (!payload) {
      return;
    }
    setScannedText(payload);
    logMsg("QR scanned:", payload);

    try {
      const parsed = JSON.parse(payload);
      if (parsed && parsed.ip && parsed.port) {
        const persona = profileForKey(parsed.code || parsed.token);
        if (parsed.code) {
          setCodeInput(parsed.code);
        }
        setResolved({ ...parsed, persona });
        setReceiveStep(RECEIVE_STEPS.SEND_FILE);
        setOpenScanner(false);
        return;
      }
    } catch {
      // payload not JSON; fall back to resolve endpoint
    }

    resolveCode(payload);
    setOpenScanner(false);
  };

  // ------- Transfer controls (unchanged logic) -------
  function pauseSending() {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      pausedRef.current = true;
      try {
        wsRef.current.send(JSON.stringify({ type: "control", action: "pause", transferId: transferIdRef.current }));
      } catch (e) {
        console.error("pauseSending send error:", e);
      }
      setIsPaused(true);
    }
  }

  function resumeSending() {
    if (!isTransmitting) return;
    pausedRef.current = false;
    setIsPaused(false);
    if (resumeResolveRef.current) {
      try {
        resumeResolveRef.current();
      } catch (e) {
        console.error("resumeSending resumeResolve error:", e);
      }
      resumeResolveRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "control", action: "resume", transferId: transferIdRef.current }));
      } catch (e) {
        console.error("resumeSending send error:", e);
      }
    }
    logMsg("Resume requested (local + server notified)");
  }

  function stopSending() {
    if (!isTransmitting) {
      window.location.reload();
      return;
    }

    // Pause transmission while showing confirmation dialog
    const wasAlreadyPaused = pausedRef.current;
    if (!wasAlreadyPaused) {
      pausedRef.current = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "control", action: "pause", transferId: transferIdRef.current }));
        } catch (e) {
          console.error("stopSending pause error:", e);
        }
      }
      setIsPaused(true);
    }

    setConfirmPayload({
      title: "Stop transfer?",
      body: "This will cancel the transfer and reload the page. Are you sure? ",
      onConfirm: () => {
        stoppedRef.current = true;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: "control", action: "stop", transferId: transferIdRef.current }));
          } catch (e) {
            console.error("stopSending send error:", e);
          }
          try {
            wsRef.current.close();
          } catch (e) {
            console.error("stopSending close error:", e);
          }
        }
        setIsTransmitting(false);
        setIsPaused(false);
        setProgress("Stopped");
        setConfirmOpen(false);
        setTimeout(() => window.location.reload(), 250);
      },
      onCancel: () => {
        // Resume transmission if it wasn't already paused
        if (!wasAlreadyPaused) {
          pausedRef.current = false;
          setIsPaused(false);
          if (resumeResolveRef.current) {
            try {
              resumeResolveRef.current();
            } catch (e) {
              console.error("stopSending resume error:", e);
            }
            resumeResolveRef.current = null;
          }
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(JSON.stringify({ type: "control", action: "resume", transferId: transferIdRef.current }));
            } catch (e) {
              console.error("stopSending resume send error:", e);
            }
          }
        }
        setConfirmOpen(false);
      },
    });
    setConfirmOpen(true);
  }

  function hostPause() {
    if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
      try {
        hostWsRef.current.send(JSON.stringify({ type: "control", action: "pause", transferId: hostTransferIdRef.current }));
      } catch (e) {
        console.error("hostPause send error:", e);
      }
      setIsPaused(true);
      pausedRef.current = true;
    }
  }
  function hostResume() {
    if (!isTransmitting) return;
    setIsPaused(false);
    pausedRef.current = false;
    if (resumeResolveRef.current) {
      try {
        resumeResolveRef.current();
      } catch (e) {
        console.error("hostResume resumeResolve error:", e);
      }
      resumeResolveRef.current = null;
    }
    if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
      try {
        hostWsRef.current.send(JSON.stringify({ type: "control", action: "resume", transferId: hostTransferIdRef.current }));
      } catch (e) {
        console.error("hostResume send error:", e);
      }
    }
  }
  function hostStop() {
    // Pause transmission while showing confirmation dialog
    const wasAlreadyPaused = pausedRef.current;
    if (!wasAlreadyPaused && isTransmitting) {
      pausedRef.current = true;
      if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
        try {
          hostWsRef.current.send(JSON.stringify({ type: "control", action: "pause", transferId: hostTransferIdRef.current }));
        } catch (e) {
          console.error("hostStop pause error:", e);
        }
      }
      setIsPaused(true);
    }

    setConfirmPayload({
      title: "Stop transfer?",
      body: "This will cancel the transfer and reload the page. Are you sure? ",
      onConfirm: () => {
        if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
          try {
            hostWsRef.current.send(JSON.stringify({ type: "control", action: "stop", transferId: hostTransferIdRef.current }));
          } catch (e) {
            console.error("hostStop send error:", e);
          }
        }
        setIsTransmitting(false);
        setIsPaused(false);
        setProgress("Stopped");
        setConfirmOpen(false);
        setTimeout(() => window.location.reload(), 250);
      },
      onCancel: () => {
        // Resume transmission if it wasn't already paused
        if (!wasAlreadyPaused && isTransmitting) {
          pausedRef.current = false;
          setIsPaused(false);
          if (resumeResolveRef.current) {
            try {
              resumeResolveRef.current();
            } catch (e) {
              console.error("hostStop resume error:", e);
            }
            resumeResolveRef.current = null;
          }
          if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) {
            try {
              hostWsRef.current.send(JSON.stringify({ type: "control", action: "resume", transferId: hostTransferIdRef.current }));
            } catch (e) {
              console.error("hostStop resume send error:", e);
            }
          }
        }
        setConfirmOpen(false);
      },
    });
    setConfirmOpen(true);
  }

  const QRPlaceholder = ({ value = "" }) => {
    const seed = (value || "demo").slice(0, 8).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return (
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
        <rect width="120" height="120" rx="8" fill="#fff" />
        {Array.from({ length: 16 }).map((_, r) =>
          Array.from({ length: 16 }).map((__, c) => {
            const n = (r * 16 + c + seed) % 7;
            const size = 6.5;
            const x = 6 + c * size;
            const y = 6 + r * size;
            const fill = n > 3 ? "#2b463c" : "transparent";
            return <rect key={`${r}-${c}`} x={x} y={y} width={size - 1.4} height={size - 1.4} fill={fill} rx="1" />;
          })
        )}
        <circle cx="60" cy="60" r="18" fill="#b1d182" opacity="0.08" />
      </svg>
    );
  };

  const resetHostForm = () => {
    setHostFolder("");
    setNote("");
    setShowOptionalDestination(false);
    setSaveToDownloads(true);
    setConnection(null);
    setHostStep(HOST_STEPS.CONFIGURE);
    setProgress("");
    setTimeRemaining(null);
    
    // Clear any active timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  let progressNumber = 0;
  if (typeof progress === "string") {
    const m = progress.match(/(\d+)%/);
    progressNumber = m ? Number(m[1]) : progress === "Done" || progress === "Done!" ? 100 : 0;
  } else if (typeof progress === "number") progressNumber = progress;

  const ribbonElement = (
    <div className="preview-inner" aria-hidden>
      <Ribbons baseThickness={30} colors={["#FC8EAC", "#FFD3B6", "#A8E6CF", "#2b463c"]} speedMultiplier={0.5} maxAge={500} enableFade={false} enableShaderEffect={true} />
    </div>
  );

  const AvatarChip = ({ persona }) => (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(43,70,60,0.06)",
        border: "1px solid rgba(43,70,60,0.12)",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{persona?.emoji || "🟢"}</span>
      <span style={{ fontWeight: 600, color: "#2b463c" }}>{persona?.name || "Skypiea Peer"}</span>
    </div>
  );

  // UI: Confirm modal component
  const ConfirmModal = ({ open, title, body, onCancel, onConfirm }) => {
    if (!open) return null;
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <h3>{title}</h3>
          <p style={{ marginTop: 8 }}>{body}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="muted-btn" onClick={onCancel || (() => setConfirmOpen(false))}>
              Cancel
            </button>
            <button className="primary" onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------
  // IMPORTANT: Here is the corrected layout wrapper.
  // We render Header at top, app UI in <main>, Footer at bottom.
  // -------------------
  const mainApp = (
    <div className="site-root">
      <Header />

      <main className="main-content" role="main" aria-label="Skypiea application">
        <div className="app-root">
          <div className="app-container">
            {/* === START: the original app UI (kept intact) === */}
            <header className="app-header">
              <div className="title-area">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <SiBluesky style={{ fontSize: "32px", color: "#2b463c" }} />
                  <h1 className="typing-intro">{introText}</h1>
                </div>
              </div>

              <div className="mode-actions">
                {!mode ? (
                  <>
                    <button className="large-choose host-choose" onClick={() => setMode("send")}>
                      Send
                    </button>
                    <button className="large-choose receive-choose" onClick={() => setMode("receive")}>
                      Receive
                    </button>
                  </>
                ) : (
                  <>
                    <button className={`tab ${mode === "send" ? "active" : ""}`} onClick={() => setMode("send")}>
                      Send
                    </button>
                    <button className={`tab ${mode === "receive" ? "active" : ""}`} onClick={() => setMode("receive")}>
                      Receive
                    </button>
                  </>
                )}
              </div>
            </header>

            <div className="content-grid">
              <section className="left-column">
                {mode === "receive" && (
                  <div className="card animate-in stretch-card">
                    <h2>Receive: Configure Destination</h2>

                    <label
                      className="checkbox-inline"
                      style={{ alignItems: "center", gap: 10, cursor: "pointer" }}
                      onClick={() => {
                        const nv = !saveToDownloads;
                        setSaveToDownloads(nv);
                        if (nv) {
                          setShowOptionalDestination(false);
                          setHostFolder("");
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={saveToDownloads}
                        onChange={(e) => {
                          setSaveToDownloads(e.target.checked);
                          if (e.target.checked) {
                            setShowOptionalDestination(false);
                            setHostFolder("");
                          }
                        }}
                        style={{ marginLeft: 8 }}
                      />
                      <span>Save directly to Downloads (Browser)</span>
                    </label>

                    {!saveToDownloads && (
                      <a href="#" className="opt-link" onClick={(e) => { e.preventDefault(); setShowOptionalDestination((s) => !s); }}>
                        {showOptionalDestination ? "Hide technical details" : "Show technical details"}
                      </a>
                    )}

                    {!saveToDownloads && showOptionalDestination && (
                      <div className="destination-block">
                        <label>Custom Folder Name</label>
                        <input type="text" value={hostFolder} onChange={(e) => setHostFolder(e.target.value)} placeholder="folder_name" />

                        <label>Or choose existing</label>
                        <select value={hostFolder} onChange={(e) => setHostFolder(e.target.value)}>
                          <option value="">(default uploads/)</option>
                          {availableFolders.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>

                        <div className="create-row">
                          <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="create new-folder" />
                          <button
                            className="small-btn"
                            onClick={() => {
                              const n = newFolderName.trim();
                              if (!n) return setError("Enter a folder name");
                              createFolderOnServer(n);
                            }}
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <label>Optional Note</label>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. phone photos" rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(43,70,60,0.10)", resize: "vertical" }} />
                    </div>

                    <div className="host-actions" style={{ marginTop: 12 }}>
                      <button className="primary" onClick={generateHost} disabled={isLoading}>
                        {isLoading ? "Generating..." : "Generate Code & QR"}
                      </button>
                      <button
                        className="muted-btn"
                        onClick={() => {
                          resetHostForm();
                          setError(null);
                        }}
                        disabled={isLoading}
                      >
                        Reset
                      </button>
                    </div>

                    {error && (
                      <div className="error-message" style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        whiteSpace: 'pre-line'
                      }}>
                        ⚠️ {error}
                      </div>
                    )}

                    {connection && hostStep === HOST_STEPS.DISPLAY_CODE && (
                      <div className="connection-box" style={{ marginTop: 12 }}>
                        <div className="code-large">{connection.code}</div>
                        {connection.qrDataUrl && <img src={connection.qrDataUrl} alt="receive-qr" width={120} height={120} style={{ display: "block", margin: "12px auto", borderRadius: "8px" }} />}
                        <div className="meta" style={{ marginBottom: 8 }}>
                          <p>
                            Save to: <strong>{saveToDownloads ? "Browser Downloads" : connection.dir || "uploads/"}</strong>
                          </p>
                          {connection.note && <p className="note">Note: {connection.note}</p>}
                          <p className="time">Created: {new Date(connection.generatedAt || Date.now()).toLocaleTimeString()}</p>
                          {timeRemaining !== null && (
                            <p className="countdown" style={{
                              color: timeRemaining < 60 ? '#dc2626' : '#2b463c',
                              fontWeight: 600,
                              fontSize: '13px'
                            }}>
                              ⏰ Expires in: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>

                        <div className="progress-row">
                          <div className="progress-track">
                            <div className="progress-bar" style={{ width: `${progressNumber}%` }} />
                          </div>
                          <div className="pct">{progress || "0%"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mode === "send" && (
                  <div className="card animate-in">
                    <h2>Send: Connect to Receiver</h2>

                    <label className="checkbox-inline" style={{ alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSaveToDownloads((s) => !s)}>
                      <input type="checkbox" checked={saveToDownloads} onChange={(e) => setSaveToDownloads(e.target.checked)} style={{ marginLeft: 8 }} />
                      <span>I acknowledge receiver enabled "Save to downloads"</span>
                    </label>
                    {!saveToDownloads && <p className="warn">Please check the box to proceed.</p>}

                    <div className="choice-row">
                      <div className={`choice ${receiveOption === RECEIVE_OPTION.CODE ? "on" : ""}`} onClick={() => setReceiveOption(RECEIVE_OPTION.CODE)}>
                        Use Code
                      </div>
                      <div className={`choice ${receiveOption === RECEIVE_OPTION.QR ? "on" : ""}`} onClick={() => setReceiveOption(RECEIVE_OPTION.QR)}>
                        Scan QR
                      </div>
                    </div>

                    {saveToDownloads && receiveOption === RECEIVE_OPTION.CODE && (
                      <>
                        <label>Enter Receiver Code</label>
                        <div className="resolve-row">
                          <input type="text" value={codeInput} onChange={(e) => { setCodeInput(e.target.value); setError(null); }} placeholder="ABCD-1234" />
                          <button className="primary" onClick={() => resolveCode()} disabled={isLoading || !codeInput.trim()}>
                            {isLoading ? "Resolving..." : "Resolve"}
                          </button>
                        </div>
                        {error && (
                          <div className="error-message" style={{
                            marginTop: '8px',
                            padding: '10px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            color: '#dc2626',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-line'
                          }}>
                            ⚠️ {error}
                          </div>
                        )}
                      </>
                    )}

                    {saveToDownloads && receiveOption === RECEIVE_OPTION.QR && (
                      <div className="qr-hint">
                        <p>Open your camera and scan the receiver QR with your device or use the button below to scan via this browser.</p>
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="primary"
                            onClick={() => {
                              setScannedText("");
                              setOpenScanner(true);
                            }}
                            disabled={openScanner}
                          >
                            {openScanner ? "Scanning..." : "Open Camera & Scan QR"}
                          </button>
                          {scannedText && (
                            <div style={{ marginTop: 8, fontSize: 13, color: "#2b463c", wordBreak: "break-word" }}>
                              You scanned: <code>{scannedText}</code>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {receiveStep === RECEIVE_STEPS.SEND_FILE && resolved && (
                      /* Replaced the old connection-box with our ConnectedPanel inline */
                      <ConnectedPanel
                        persona={resolved.persona}
                        note={resolved.note}
                        ip={resolved.ip}
                        port={resolved.port}
                        showTechDetails={showTechDetails}
                        onToggleTech={() => setShowTechDetails((s) => !s)}
                        file={file}
                        onFileChange={(f) => setFile(f)}
                        onStart={() => startSend()}
                        onPause={() => pauseSending()}
                        onResume={() => resumeSending()}
                        onStop={() => stopSending()}
                        isTransmitting={isTransmitting}
                        isPaused={isPaused}
                        disabled={isLoading}
                        ConnectedIcon={ConnectedIcon}
                      />
                    )}

                    {resolved && receiveStep !== RECEIVE_STEPS.SEND_FILE && (
                      <div className="resolved-quick">
                        <p>
                          Resolved: <strong>{resolved.code}</strong>
                        </p>
                        <button
                          className="primary"
                          onClick={() => {
                            setReceiveStep(RECEIVE_STEPS.SEND_FILE);
                          }}
                        >
                          Proceed to Send
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* NEW: Transmission Constraints card placed above the log to match theme */}
                <div className="constraints-card">
  <h4>Transmission Constraints</h4>
  <ul className="constraints-list">
    <li>
      <div className="constraints-key">Both devices online</div>
      <div className="constraints-value">Same WiFi network (local) or internet access (production)</div>
    </li>

    <li>
      <div className="constraints-key">5-minute time limit</div>
      <div className="constraints-value">Connect within 5 minutes after generating QR code</div>
    </li>



    <li>
      <div className="constraints-key">20-minute session</div>
      <div className="constraints-value">Complete file upload within 20 minutes</div>
    </li>

    <li>
      <div className="constraints-key">File size limit</div>
      <div className="constraints-value">Maximum 5GB per transfer</div>
    </li>

    <li>
      <div className="constraints-key">Keep browsers open</div>
      <div className="constraints-value">Don't close tabs or switch apps during transfer</div>
    </li>

    <li>
      <div className="constraints-key">Stable connection</div>
      <div className="constraints-value">Avoid switching WiFi/cellular mid-transfer</div>
    </li>
  </ul>
</div>


                <div className="log-card">
                  <div className="log-head">Transmission Log</div>
                  <pre className="log-area">{log || "No activity yet."}</pre>
                </div>
              </section>

              <aside className="right-column">
                <div className="panel card animate-in">
                  {!mode && (
                    <div className="hero">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <SiBluesky style={{ fontSize: "24px", color: "#2b463c" }} />
                        <h3>Ready when you are</h3>
                      </div>
                      <p className="muted">Choose Send or Receive to begin.</p>
                    </div>
                  )}

                  {mode === "receive" && (
                    <div className="preview">
                      {ribbonElement}

                      {!connection && (
                        <div className="placeholder center-overlay">
                          Waiting for you to generate a code
                          <span style={{ marginLeft: "8px", color: "#8b2a2a" }}>
                            <DisconnectedIcon />
                          </span>
                        </div>
                      )}

                      {connection && (
                        <div className="preview-content">
                          <div className="meta" style={{ textAlign: "center", marginTop: 12 }}>
                            <div>
                              Destination: <strong>{saveToDownloads ? "Browser Downloads" : connection.dir || "uploads/"}</strong>
                            </div>
                            {connection.note && <div className="muted">Note: {connection.note}</div>}

                            <div className="host-controls" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
                              <button className="muted-btn" onClick={hostPause} disabled={!connection || !isTransmitting || isPaused}>
                                Pause
                              </button>
                              <button className="primary" onClick={hostResume} disabled={!connection || !isTransmitting || !isPaused}>
                                Resume
                              </button>
                              <button className="muted-btn" onClick={hostStop} disabled={!connection || !isTransmitting} style={{ borderColor: "#8b2a2a", color: "#8b2a2a" }}>
                                Stop
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "send" && (
                    <div className="preview">
                      {ribbonElement}

                      {!resolved && (
                        <div className="placeholder center-overlay">
                          Resolve a code or scan QR
                          <span style={{ marginLeft: "8px", verticalAlign: "middle", color: "#8b2a2a" }}>
                            <DisconnectedIcon />
                          </span>
                        </div>
                      )}

                      {resolved && (
                        <div className="preview-content">
                          <div className="meta" style={{ marginTop: 8 }}>
                            <div>
                              <span className="muted">Receiver</span>
                              <AvatarChip persona={resolved.persona} />
                              <span style={{ marginLeft: "8px", verticalAlign: "middle", color: "#2b463c" }}>
                                <ConnectedIcon />
                              </span>
                            </div>
                            {resolved.note && <div className="muted">{resolved.note}</div>}
                          </div>

                          <div className="progress-track" style={{ marginTop: 10 }}>
                            <div className="progress-bar" style={{ width: `${progressNumber}%` }} />
                          </div>
                          <div className="progress-label">{progress || "0%"}</div>

                          <div className="host-controls" style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="muted-btn" onClick={pauseSending} disabled={!resolved || !isTransmitting || isPaused}>
                              Pause
                            </button>
                            <button className="primary" onClick={resumeSending} disabled={!resolved || !isTransmitting || !isPaused}>
                              Resume
                            </button>
                            <button className="muted-btn" onClick={stopSending} disabled={!resolved || !isTransmitting} style={{ borderColor: "#8b2a2a", color: "#8b2a2a" }}>
                              Stop
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {/* === END: original app UI === */}
          </div>
        </div>
      </main>

      {/* modals and overlays remain sibling to main (so they can overlay correctly) */}
      <ScannerModal open={openScanner} onClose={() => setOpenScanner(false)} onDetected={handleScannerDetected} />

      <ConfirmModal open={confirmOpen} title={confirmPayload.title} body={confirmPayload.body} onCancel={confirmPayload.onCancel} onConfirm={() => { confirmPayload.onConfirm && confirmPayload.onConfirm(); }} />

      {/* Confetti blast animation for successful transmissions (desktop only) */}
      <ConfettiBlast 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        duration={3000}
      />

      <Footer />
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/features" element={<Features />} />
        <Route path="/support" element={<Support />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        
        <Route path="*" element={mainApp} />
        
      </Routes>
    </BrowserRouter>
  );
}
