﻿// App.jsx — merged version with in-file ConnectedPanel and full app logic
import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import "./App.css";
import { ConnectedIcon, DisconnectedIcon } from "./components/ConnectionIcons";
import Ribbons from "./components/Ribbons";
import { SiBluesky } from "react-icons/si";
import { FaFeatherAlt } from "react-icons/fa";
import { FaQrcode, FaUpload, FaClock } from "react-icons/fa";
import { GiHeavyHelm } from "react-icons/gi";
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
  return "https://skypiea-2.onrender.com";
})();
const WS_SCHEME = API_BASE.startsWith("https://") ? "wss" : "ws";
const WS_BASE = `${WS_SCHEME}://${new URL(API_BASE).host}`;
const MAX_TRANSFER_BYTES = 5 * 1024 * 1024 * 1024;
const WS_CHUNK_BYTES = 4 * 1024 * 1024;
const WS_BUFFER_HIGH_WATER = 16 * 1024 * 1024;
const CHAT_MAX_LINES = 1000;
const CHAT_MODE = { FEATHER: "feather", BOULDER: "boulder" };
const CHAT_MODE_STORAGE_KEY = "skypiea_chat_mode";

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

function participantProfilesForSession(seed) {
  const senderIdx = hashStringToIndex(`${seed}-sender`);
  let receiverIdx = hashStringToIndex(`${seed}-receiver`);
  if (receiverIdx === senderIdx) {
    receiverIdx = (receiverIdx + 1) % PRESET_PROFILES.length;
  }
  return {
    sender: PRESET_PROFILES[senderIdx],
    receiver: PRESET_PROFILES[receiverIdx],
  };
}

function formatBytes(n) {
  const size = Number(n || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, exp);
  return `${value.toFixed(exp === 0 ? 0 : exp === 1 ? 1 : 2)} ${units[exp]}`;
}

function lineCountOfText(text) {
  const normalized = String(text == null ? "" : text).replace(/\r\n/g, "\n");
  if (!normalized.length) return 1;
  return normalized.split("\n").length;
}

function lineCountOfMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return 0;
  return messages.reduce((acc, msg) => acc + lineCountOfText(msg?.text || ""), 0);
}

/* ===== ConnectedPanel (in-file) ===== */
function ConnectedPanel(props) {
  const {
    persona,
    note,
    ip,
    port,
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
      <span style={{ fontWeight: 600, color: "#2b463c" }}>{persona?.name || "Receiver"}</span>
    </div>
  );

  const hasIpOrPort = Boolean(ip || port);

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

      </div>

      {note && <p className="note" style={{ marginTop: 8 }}>{note}</p>}

      {hasIpOrPort && (
        <div className="muted tech-details" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {ip && <div>IP: <strong>{ip}</strong></div>}
            {port && <div>Port: <strong>{port}</strong></div>}
          </div>
        </div>
      )}

      {note && <p className="note" style={{ marginTop: 8 }}>{note}</p>}

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

function ChatPanel({
  visible,
  onClose,
  allowClose = true,
  mode,
  isConnected,
  lineCount,
  maxLines,
  messages,
  draft,
  chatError,
  onModeChange,
  onDraftChange,
  onSend,
  onDraftKeyDown,
  onDeleteHistory,
  localUserName,
  peerUserName,
}) {
  const [copiedMsgId, setCopiedMsgId] = useState("");
  const threadRef = useRef(null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const copyMessageText = async (msg) => {
    const text = String(msg?.text || "");
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedMsgId(String(msg.id));
      setTimeout(() => {
        setCopiedMsgId((prev) => (prev === String(msg.id) ? "" : prev));
      }, 1200);
    } catch (e) {
      console.error("copy message failed:", e);
    }
  };

  if (!visible) return null;

  return (
    <div className="card animate-in chat-card" aria-live="polite">
      <div className="chat-head">
        <div className="chat-title-wrap">
          <h2>Direct Chat</h2>
          <span className={`chat-connection-dot ${isConnected ? "online" : "offline"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {allowClose && (
          <button type="button" className="chat-close-btn" onClick={onClose} aria-label="Close chat">
            Close
          </button>
        )}
      </div>

      <div className="chat-meta-row">
        <div className="chat-meta-left">
          <div className="chat-mode-switch" role="radiogroup" aria-label="Chat persistence mode">
            <button
              type="button"
              className={`chat-mode-btn ${mode === CHAT_MODE.FEATHER ? "active" : ""}`}
              role="radio"
              aria-checked={mode === CHAT_MODE.FEATHER}
              onClick={() => onModeChange(CHAT_MODE.FEATHER)}
            >
              <FaFeatherAlt style={{ marginRight: 6, verticalAlign: "middle" }} />
              Feather
            </button>
            <button
              type="button"
              className={`chat-mode-btn ${mode === CHAT_MODE.BOULDER ? "active" : ""}`}
              role="radio"
              aria-checked={mode === CHAT_MODE.BOULDER}
              onClick={() => onModeChange(CHAT_MODE.BOULDER)}
            >
              <GiHeavyHelm style={{ marginRight: 6, verticalAlign: "middle" }} />
              Boulder
            </button>
          </div>
          <span className="chat-line-count">{lineCount}/{maxLines} lines</span>
        </div>
        <button type="button" className="chat-delete" onClick={onDeleteHistory}>Delete History</button>
      </div>

      <div ref={threadRef} className="chat-thread" role="log" aria-label="Chat messages">
        {!messages.length && <div className="chat-empty">No messages yet. Start a conversation.</div>}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender === "self" ? "self" : msg.sender === "system" ? "system" : "peer"}`}
          >
            <div className="chat-bubble-head">
              <span className="chat-bubble-author">
                {msg.sender === "self" ? localUserName : msg.sender === "system" ? "System" : peerUserName}
              </span>
              <button
                type="button"
                className="chat-copy-btn"
                aria-label="Copy message"
                onClick={() => copyMessageText(msg)}
              >
                {copiedMsgId === String(msg.id) ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="chat-bubble-text">{msg.text}</div>
          </div>
        ))}
      </div>

      {chatError && <div className="chat-error">{chatError}</div>}

      <div className="chat-compose">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onDraftKeyDown}
          rows={3}
        />
        <button type="button" className="primary" onClick={onSend} disabled={!isConnected || !String(draft || "").trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

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

  const decodeQrFromImageFile = async (file) => {
    if (!file) return;
    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let canvas = canvasRef.current;
          if (!canvas) {
            canvas = document.createElement("canvas");
            canvasRef.current = canvas;
          }
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(imageUrl);
            return;
          }

          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = typeof jsQR === "function" ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" }) : null;
          if (code && code.data) {
            onDetected(code.data);
            stopCamera();
          } else {
            console.warn("No QR found in uploaded image");
          }
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        console.error("Failed to load uploaded image");
      };
      img.src = imageUrl;
    } catch (e) {
      console.error("decodeQrFromImageFile failed:", e);
    }
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

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <label className="muted-btn" style={{ cursor: "pointer", display: "inline-block" }}>
              Upload QR Image
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => decodeQrFromImageFile(e.target.files?.[0] || null)}
              />
            </label>
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
  const senderChatWsRef = useRef(null);
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
  const [speedText, setSpeedText] = useState("");
  const bytesSentRef = useRef(0);
  const speedWindowRef = useRef({ at: 0, bytes: 0 });


  const [chatMode, setChatMode] = useState(CHAT_MODE.FEATHER);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLineCount, setChatLineCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("connect");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const seenChatIdsRef = useRef(new Set());

  const activeChatToken = (mode === "receive" ? connection?.token : resolved?.token) || "";
  const activeChatCode = (mode === "receive" ? connection?.code : resolved?.code) || "";
  const activeChatSessionKey = activeChatToken && activeChatCode ? `${activeChatToken}_${activeChatCode}` : "";
  const participantProfiles = participantProfilesForSession(activeChatToken || activeChatCode || "skypiea-session");
  const senderDisplayName = participantProfiles.sender.name;
  const receiverDisplayName = participantProfiles.receiver.name;
  const localChatName = mode === "send" ? participantProfiles.sender.name : participantProfiles.receiver.name;
  const peerChatName = mode === "send" ? participantProfiles.receiver.name : participantProfiles.sender.name;

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

  const getActiveChatSocket = () => {
    if (mode === "receive") {
      if (hostWsRef.current && hostWsRef.current.readyState === WebSocket.OPEN) return hostWsRef.current;
      return null;
    }
    if (senderChatWsRef.current && senderChatWsRef.current.readyState === WebSocket.OPEN) return senderChatWsRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current;
    return null;
  };

  const ingestChatMessage = useCallback((payload) => {
    if (!payload) return;
    const incomingId = String(payload.msgId || payload.id || `${payload.ts || Date.now()}-${Math.random()}`);
    if (seenChatIdsRef.current.has(incomingId)) return;

    const text = String(payload.text || "").trim();
    if (!text) return;
    const incomingLines = lineCountOfText(text);

    setChatMessages((prev) => {
      const nextLineCount = lineCountOfMessages(prev) + incomingLines;
      if (nextLineCount > CHAT_MAX_LINES) {
        setChatError("Chat reached the 1000-line cap. Delete history or switch to Feather for fresh chat.");
        return prev;
      }

      seenChatIdsRef.current.add(incomingId);
      const senderRole = String(payload.senderRole || "").toLowerCase();
      const selfRole = mode === "receive" ? "host" : "sender";
      const sender = senderRole === selfRole || payload.sender === "self" ? "self" : "peer";
      return [...prev, { id: incomingId, text, ts: Number(payload.ts) || Date.now(), sender }];
    });
  }, [mode]);

  const openSenderChatSocket = useCallback((token) => {
    if (!token) return;
    try {
      if (senderChatWsRef.current && senderChatWsRef.current.readyState === WebSocket.OPEN) {
        senderChatWsRef.current.close();
      }
    } catch (e) {
      console.error("senderChatWs close error:", e);
    }

    const socket = new WebSocket(`${WS_BASE}/ws`);
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({ type: "sender-register", token }));
      } catch (e) {
        console.error("sender-register send error:", e);
      }
    };
    socket.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "chat-message") {
        ingestChatMessage(msg);
      }
    };
    socket.onerror = (e) => {
      console.error("sender chat websocket error:", e);
    };
    socket.onclose = () => {
      if (senderChatWsRef.current === socket) senderChatWsRef.current = null;
    };
    senderChatWsRef.current = socket;
  }, [ingestChatMessage]);

  const sendChatMessage = () => {
    const text = String(chatDraft || "").trim();
    if (!text) return;
    if (!activeChatToken) {
      setChatError("Create or resolve a connection before sending chat.");
      return;
    }

    const socket = getActiveChatSocket();
    if (!socket) {
      setChatError("Chat socket is offline. Connect both users first.");
      return;
    }

    const incomingLines = lineCountOfText(text);
    const nextLineCount = lineCountOfMessages(chatMessages) + incomingLines;
    if (nextLineCount > CHAT_MAX_LINES) {
      setChatError("This message exceeds the 1000-line cap. Delete history before continuing.");
      return;
    }

    const msgId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ts = Date.now();
    seenChatIdsRef.current.add(msgId);
    setChatMessages((prev) => [...prev, { id: msgId, text, ts, sender: "self" }]);
    setChatDraft("");
    setChatError("");

    try {
      socket.send(JSON.stringify({ type: "chat-message", token: activeChatToken, text, ts, msgId }));
    } catch (e) {
      console.error("chat send failed:", e);
      setChatError("Failed to send message. Try again.");
    }
  };

  const appendSystemChatMessage = useCallback((text) => {
    const body = String(text || "").trim();
    if (!body) return;
    const incomingLines = lineCountOfText(body);
    const msgId = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setChatMessages((prev) => {
      const nextLineCount = lineCountOfMessages(prev) + incomingLines;
      if (nextLineCount > CHAT_MAX_LINES) {
        setChatError("Chat reached the 1000-line cap. Delete history or switch to Feather for fresh chat.");
        return prev;
      }
      seenChatIdsRef.current.add(msgId);
      return [...prev, { id: msgId, text: body, ts: Date.now(), sender: "system" }];
    });
  }, []);

  const handleChatDraftKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const clearChatHistory = () => {
    setChatMessages([]);
    setChatLineCount(0);
    setChatError("");
    seenChatIdsRef.current = new Set();
  };

  const closeChatMode = () => {
    if (chatMode === CHAT_MODE.FEATHER) {
      clearChatHistory();
    }
    setChatOpen(false);
  };

  const openChatMode = () => {
    setChatOpen(true);
  };

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(CHAT_MODE_STORAGE_KEY);
      if (savedMode === CHAT_MODE.BOULDER || savedMode === CHAT_MODE.FEATHER) {
        setChatMode(savedMode);
      }
    } catch (e) {
      console.error("chat mode load failed:", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_MODE_STORAGE_KEY, chatMode);
    } catch (e) {
      console.error("chat mode save failed:", e);
    }
  }, [chatMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updateViewport);
      return () => media.removeEventListener("change", updateViewport);
    }
    media.addListener(updateViewport);
    return () => media.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    const lc = lineCountOfMessages(chatMessages);
    setChatLineCount(lc);
  }, [chatMessages]);

  useEffect(() => {
    if (!activeChatSessionKey) {
      clearChatHistory();
    }
  }, [activeChatSessionKey]);

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
        ? `${API_BASE}/connection-info?dir=${encodeURIComponent(folderToUse)}`
        : `${API_BASE}/connection-info`;

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
              if (m.type === "chat-message") {
                ingestChatMessage(m);
                return;
              }
              if (m.type === "start") {
                // Clear timeout since connection is established
                if (connectionTimeoutRef.current) {
                  clearTimeout(connectionTimeoutRef.current);
                  connectionTimeoutRef.current = null;
                }
                setTimeRemaining(null);
                hostTransferIdRef.current = m.transferId || null;
                
                hostChunksRef.current.chunks = [];
                hostChunksRef.current.received = 0;
                hostChunksRef.current.total = m.totalSize || 0;
                hostChunksRef.current.filename = m.filename || "download.bin";
                setProgress("0%");
                logMsg("Incoming file:", hostChunksRef.current.filename);
                appendSystemChatMessage("File transfer started");
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
                appendSystemChatMessage("Transfer completed");
                hostChunksRef.current.chunks = [];
              } else if (m.type === "error") {
                setError(m.message || "Receiver error");
              } else if (m.type === "control" && m.action) {
                if (m.action === "pause") {
                  setIsPaused(true);
                  pausedRef.current = true;
                  appendSystemChatMessage("Transfer paused");
                } else if (m.action === "resume") {
                  setIsPaused(false);
                  pausedRef.current = false;
                  appendSystemChatMessage("Transfer resumed");
                } else if (m.action === "stop") {
                  setIsTransmitting(false);
                  setIsPaused(false);
                  appendSystemChatMessage("Transfer stopped");
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
          const codePattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%&*])[A-Za-z!@#$%&*]{4}$/;
          if (!codePattern.test(trimmedCode)) {
            throw new Error(`Invalid code format. Use 4 characters with lower + upper + special (example: aB#x).`);
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
      openSenderChatSocket(j.connectionData.token);
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
    if (file.size > MAX_TRANSFER_BYTES) {
      setError(`File too large. Maximum allowed size is ${formatBytes(MAX_TRANSFER_BYTES)}.`);
      return;
    }
    setIsLoading(true);
    setProgress("0%");
    setSpeedText("");
    try {
      const ws = new WebSocket(`${WS_BASE}/ws`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const transferId = "t-" + Math.random().toString(36).slice(2, 10);
        transferIdRef.current = transferId;
        pausedRef.current = false;
        stoppedRef.current = false;
        bytesSentRef.current = 0;
        speedWindowRef.current = { at: performance.now(), bytes: 0 };
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
          if (msg.type === "chat-message") {
            ingestChatMessage(msg);
          } else if (msg.type === "offset") {
            const chunkSize = WS_CHUNK_BYTES;
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
                while (ws.bufferedAmount > WS_BUFFER_HIGH_WATER) {
                  await new Promise((r) => setTimeout(r, 8));
                }
                ws.send(chunk);
                pos += chunk.byteLength;
                bytesSentRef.current += chunk.byteLength;
                const nowAt = performance.now();
                const windowMs = nowAt - speedWindowRef.current.at;
                speedWindowRef.current.bytes += chunk.byteLength;
                if (windowMs >= 350) {
                  const bps = speedWindowRef.current.bytes / (windowMs / 1000);
                  setSpeedText(`${formatBytes(bps)}/s`);
                  speedWindowRef.current = { at: nowAt, bytes: 0 };
                }
                setProgress(`${Math.round((pos / file.size) * 100)}%`);
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
            setSpeedText("");
            setIsTransmitting(false);
            setShowConfetti(true); // Trigger confetti blast on successful completion
            appendSystemChatMessage("Transfer completed");
            ws.close();
          } else if (msg.type === "paused") {
            pausedRef.current = true;
            setIsPaused(true);
            logMsg("Transfer paused");
            appendSystemChatMessage("Transfer paused");
          } else if (msg.type === "resumed") {
            pausedRef.current = false;
            setIsPaused(false);
            if (resumeResolveRef.current) {
              resumeResolveRef.current();
            }
            logMsg("Transfer resumed");
            appendSystemChatMessage("Transfer resumed");
          } else if (msg.type === "stopped") {
            stoppedRef.current = true;
            setIsTransmitting(false);
            setIsPaused(false);
            setProgress("Stopped by receiver");
            appendSystemChatMessage("Transfer stopped");
            ws.close();
          } else if (msg.type === "control" && msg.action) {
            if (msg.action === "pause") {
              pausedRef.current = true;
              setIsPaused(true);
              appendSystemChatMessage("Transfer paused");
            } else if (msg.action === "resume") {
              pausedRef.current = false;
              setIsPaused(false);
              if (resumeResolveRef.current) {
                resumeResolveRef.current();
              }
              appendSystemChatMessage("Transfer resumed");
            } else if (msg.action === "stop") {
              stoppedRef.current = true;
              setIsTransmitting(false);
              setIsPaused(false);
              setProgress("Stopped by receiver");
              appendSystemChatMessage("Transfer stopped");
              ws.close();
            }
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
        setSpeedText("");
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
        } else {
          logMsg("Folders endpoint unavailable:", String(res.status));
        }
      } catch (e) {
        console.error("Failed to load folders:", e);
        // Do not block app usage when backend is offline during initial page load.
        // Folder management is optional until transfer setup.
        logMsg("Backend not reachable at", API_BASE, "- folder list disabled until server is online");
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
      try {
        if (senderChatWsRef.current?.readyState === WebSocket.OPEN) senderChatWsRef.current.close();
      } catch (e) {
        console.error("Error closing senderChatWsRef on unmount:", e);
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

  useEffect(() => {
    if (mode !== "send" || !resolved?.token) {
      try {
        if (senderChatWsRef.current?.readyState === WebSocket.OPEN) senderChatWsRef.current.close();
      } catch (e) {
        console.error("senderChatWs close error:", e);
      }
      return;
    }

    if (!senderChatWsRef.current || senderChatWsRef.current.readyState !== WebSocket.OPEN) {
      openSenderChatSocket(resolved.token);
    }
  }, [mode, resolved?.token, openSenderChatSocket]);

  // ------- Scanner integration -------
  const handleScannerDetected = (payload) => {
    if (!payload) {
      return;
    }
    setScannedText(payload);
    logMsg("QR scanned:", payload);

    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        if (parsed.code || parsed.token) {
          const normalizedCode = String(parsed.code || "").trim();
          if (normalizedCode) {
            setCodeInput(normalizedCode);
            setOpenScanner(false);
            resolveCode(normalizedCode);
            return;
          }
        }
        if (parsed.ip && parsed.port) {
          const persona = profileForKey(parsed.code || parsed.token);
          if (parsed.code) {
            setCodeInput(parsed.code);
          }
          setResolved({ ...parsed, persona });
          setReceiveStep(RECEIVE_STEPS.SEND_FILE);
          setOpenScanner(false);
          return;
        }
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

  const resetHostForm = () => {
    setHostFolder("");
    setShowOptionalDestination(false);
    setSaveToDownloads(true);
    setConnection(null);
    setHostStep(HOST_STEPS.CONFIGURE);
    setProgress("");
    setTimeRemaining(null);
    setSpeedText("");
    
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

  const hasChatContext = Boolean(activeChatToken && activeChatCode);
  const chatSocketOpen = Boolean(getActiveChatSocket());
  const transferDone = progress === "Done" || progress === "Done!" || progressNumber >= 100;
  const connectionReady = Boolean(connection || resolved);
  const connectionStatus = chatSocketOpen || isTransmitting ? "Connected" : mode ? "Waiting" : "Disconnected";
  const activeStep = transferDone ? 3 : connectionReady || isTransmitting ? 2 : 1;

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
      <span style={{ fontWeight: 600, color: "#2b463c" }}>{persona?.name || "Receiver"}</span>
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
      <Header connectionStatus={connectionStatus} activeStep={activeStep} />

      <main className="main-content" role="main" aria-label="Skypiea application">
        <div className="app-root">
          <div className="app-container">
            {/* === START: the original app UI (kept intact) === */}
            <header className="dashboard-toolbar card animate-in">
              <div className="toolbar-copy">
                <h1 className="typing-intro typing-intro-live">{introText}</h1>
                <p>No login. Temporary secure session. Keep both devices open.</p>
              </div>

              <div className="mode-actions">
                {!mode ? (
                  <>
                    <button className="large-choose host-choose" onClick={() => setMode("send")}>Send</button>
                    <button className="large-choose receive-choose" onClick={() => setMode("receive")}>Receive</button>
                  </>
                ) : (
                  <>
                    <button className={`tab ${mode === "send" ? "active" : ""}`} onClick={() => setMode("send")}>Send</button>
                    <button className={`tab ${mode === "receive" ? "active" : ""}`} onClick={() => setMode("receive")}>Receive</button>
                  </>
                )}
              </div>
            </header>

            <div className="mobile-dashboard-tabs" role="tablist" aria-label="Mobile sections">
              <button type="button" role="tab" aria-selected={mobileTab === "connect"} className={mobileTab === "connect" ? "active" : ""} onClick={() => setMobileTab("connect")}>
                <FaQrcode aria-hidden />
                <span>Connect</span>
              </button>
              <button type="button" role="tab" aria-selected={mobileTab === "transfer"} className={mobileTab === "transfer" ? "active" : ""} onClick={() => setMobileTab("transfer")}>
                <FaUpload aria-hidden />
                <span>Transfer</span>
              </button>
              <button type="button" role="tab" aria-selected={mobileTab === "logs"} className={mobileTab === "logs" ? "active" : ""} onClick={() => setMobileTab("logs")}>
                <FaClock aria-hidden />
                <span>Logs</span>
              </button>
            </div>

            <div className="content-grid">
              <section className={`left-column mobile-pane mobile-tab-${mobileTab} ${mobileTab === "connect" || mobileTab === "transfer" || mobileTab === "logs" ? "is-mobile-active" : ""}`}>
                {mode === "receive" && (
                  <div className={`card animate-in stretch-card transfer-panel mobile-pane ${mobileTab === "connect" || mobileTab === "transfer" ? "is-mobile-active" : ""}`}>
                    <h2>{isMobileViewport ? (mobileTab === "connect" ? "Step 1: Connect" : "Step 2: Transfer") : "Receive: Configure Destination"}</h2>

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
                  <div className={`card animate-in transfer-panel mobile-pane ${mobileTab === "connect" || mobileTab === "transfer" ? "is-mobile-active" : ""}`}>
                    <h2>{isMobileViewport ? (mobileTab === "connect" ? "Step 1: Connect" : "Step 2: Transfer") : "Send: Connect to Receiver"}</h2>

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
                          <input type="text" value={codeInput} onChange={(e) => { setCodeInput(e.target.value); setError(null); }} placeholder="aB#x" />
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
                      <>
                        {/* Replaced the old connection-box with our ConnectedPanel inline */}
                        <ConnectedPanel
                          persona={resolved.persona}
                          ip={resolved.ip}
                          port={resolved.port}
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

                        {speedText && <div style={{ fontSize: 12, color: "#0f766e", marginTop: 8 }}>Live speed: {speedText}</div>}
                      </>
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

                <div className={`log-card mobile-pane ${mobileTab === "logs" ? "is-mobile-active" : ""}`}>
                  <div className="log-head">Transmission Log</div>
                  <pre className="log-area">{log || "No activity yet."}</pre>
                </div>

                <div className={`constraints-card compact mobile-pane ${mobileTab === "logs" ? "is-mobile-active" : ""}`}>
                  <h4>Transmission Constraints</h4>
                  <ul className="constraints-list">
                    <li><div className="constraints-key">Both online</div><div className="constraints-value">Both devices must stay online</div></li>
                    <li><div className="constraints-key">Network</div><div className="constraints-value">Same WiFi or internet access</div></li>
                    <li><div className="constraints-key">Connection</div><div className="constraints-value">Code expires in 5 minutes</div></li>
                    <li><div className="constraints-key">Transfer</div><div className="constraints-value">20-minute transfer window</div></li>
                    <li><div className="constraints-key">Max size</div><div className="constraints-value">5GB per file</div></li>
                  </ul>
                </div>
              </section>

              <aside className={`right-column mobile-pane ${mobileTab === "connect" ? "is-mobile-active" : ""}`}>
                <div className={`panel card animate-in connection-hero mobile-pane ${mobileTab === "connect" ? "is-mobile-active" : ""}`}>
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

                            <div className="hero-status-line">
                              <span>{connectionStatus}</span>
                              <span>{receiverDisplayName}</span>
                            </div>
                            <div className="hero-status-line">
                              <span>Sender: {senderDisplayName}</span>
                              <span>Receiver: {receiverDisplayName}</span>
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
                          </div>

                          <div className="progress-track" style={{ marginTop: 10 }}>
                            <div className="progress-bar" style={{ width: `${progressNumber}%` }} />
                          </div>
                          <div className="progress-label">{progress || "0%"}</div>
                          {speedText && <div className="muted">Speed: {speedText}</div>}

                          <div className="hero-status-line" style={{ marginTop: 8 }}>
                            <span>Sender: {senderDisplayName}</span>
                            <span>Receiver: {receiverDisplayName}</span>
                          </div>

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

      <button
        type="button"
        className="chat-fab"
        onClick={openChatMode}
        aria-label="Open chat"
      >
        <span className="chat-fab-icon">
          {chatMode === CHAT_MODE.FEATHER ? <FaFeatherAlt /> : <GiHeavyHelm />}
        </span>
        <span className="chat-fab-label">Chat</span>
      </button>

      <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
        <button type="button" className={mobileTab === "connect" ? "active" : ""} onClick={() => setMobileTab("connect")}>
          <FaQrcode aria-hidden />
          <span>Connect</span>
        </button>
        <button type="button" className={mobileTab === "transfer" ? "active" : ""} onClick={() => setMobileTab("transfer")}>
          <FaUpload aria-hidden />
          <span>Transfer</span>
        </button>
        <button type="button" className={chatOpen ? "active" : ""} onClick={openChatMode}>
          <span>Chat</span>
        </button>
        <button type="button" className={mobileTab === "logs" ? "active" : ""} onClick={() => setMobileTab("logs")}>
          <FaClock aria-hidden />
          <span>Logs</span>
        </button>
      </nav>

      {chatOpen && (
        <div className="chat-dialog-backdrop" onClick={closeChatMode} role="dialog" aria-modal="true" aria-label="Direct chat dialog">
          <div className="chat-dialog-shell" onClick={(e) => e.stopPropagation()}>
            {hasChatContext ? (
              <ChatPanel
                visible={true}
                allowClose={true}
                onClose={closeChatMode}
                mode={chatMode}
                isConnected={chatSocketOpen}
                lineCount={chatLineCount}
                maxLines={CHAT_MAX_LINES}
                messages={chatMessages}
                draft={chatDraft}
                chatError={chatError}
                onModeChange={setChatMode}
                onDraftChange={setChatDraft}
                onSend={sendChatMessage}
                onDraftKeyDown={handleChatDraftKeyDown}
                onDeleteHistory={clearChatHistory}
                localUserName={localChatName}
                peerUserName={peerChatName}
              />
            ) : (
              <div className="card animate-in chat-card">
                <div className="chat-head">
                  <div className="chat-title-wrap">
                    <h2>Direct Chat</h2>
                    <span className="chat-connection-dot offline">Disconnected</span>
                  </div>
                  <button type="button" className="chat-close-btn" onClick={closeChatMode} aria-label="Close chat">
                    Close
                  </button>
                </div>
                <div className="chat-thread" role="log" aria-label="Chat messages">
                  <div className="chat-empty">Connect sender and receiver first to start direct chat.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
