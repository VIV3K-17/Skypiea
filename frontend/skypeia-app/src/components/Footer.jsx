import React from "react";
import { SocialIcon } from "react-social-icons";
import { Link } from "react-router-dom";

/**
 * FooterLarge.jsx
 * - Glass blur footer with Skypiea branding, dynamic cookie-based rating
 * - Baseline: 4.0 / 100 ratings
 * - Once the user votes, the interactive rating controls are removed
 *   to prevent repeated ratings (cookie-based).
 */

export default function FooterLarge({ year = new Date().getFullYear() }) {
  React.useEffect(() => {
    if (document.getElementById("footer-large-styles")) return;
    const s = document.createElement("style");
    s.id = "footer-large-styles";
    s.innerHTML = `
/* FooterLarge styles */
.footer-large {
  backdrop-filter: blur(10px) saturate(130%);
  -webkit-backdrop-filter: blur(10px) saturate(130%);
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(248,249,250,0.6));
  border-top: 1px solid rgba(17,24,39,0.04);
  color: #0f172a;
  padding: 48px 20px;
  box-sizing: border-box;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

/* Layout */
.footer-large__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Brand (left) */
.brand-row {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 420px;
}
.brand-badge {
  flex: 0 0 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-text .brand-name {
  font-weight: 800;
  font-size: 20px;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.2px;
  line-height: 1.1;
}
.brand-text .brand-tag {
  margin-top: 6px;
  color: #475569;
  font-size: 14px;
  line-height: 1.4;
}

/* Center rating text (dynamic) */
.footer-mid {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.rating-stars {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.rating-stars .avg-block {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rating-display {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rating-numeric {
  font-weight: 800;
  color: #111827;
  font-size: 20px;
}
.rating-count {
  font-size: 13px;
  color: #6b7280;
}

/* star buttons */
.star-row {
  display: inline-flex;
  gap: 8px;
  margin-top: 10px;
}
.star-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: transform 0.12s ease, background 0.12s ease;
}
.star-btn:focus {
  outline: 2px solid rgba(43,70,60,0.14);
  transform: translateY(-2px);
}
.star-svg {
  width: 22px;
  height: 22px;
  display: block;
}
.star-empty path { fill: #e6e7eb; }
.star-filled path { fill: #f59e0b; }

.star-hint {
  font-size: 13px;
  color: #475569;
  margin-top: 8px;
}

/* small confirmation */
.rating-toast {
  margin-top: 8px;
  font-size: 13px;
  color: #0f5132;
  background: rgba(34,197,94,0.08);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(16,185,129,0.08);
}

/* Right links */
.footer-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.footer-links {
  display: flex;
  gap: 14px;
  align-items: center;
}
.footer-links a {
  color: #0f172a;
  text-decoration: none;
  font-size: 14px;
  padding: 6px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}
.footer-links a:hover {
  text-decoration: underline;
  color: #2b463c;
}

/* Bottom section */
.footer-large__bottom {
  margin-top: 32px;
  border-top: 1px solid rgba(17,24,39,0.04);
  padding-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  gap: 12px;
}
.copyright {
  color: #475569;
  font-size: 14px;
  display: flex;
  align-items: center;
}
.social-icons {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* SocialIcon wrapper */
.social {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  box-shadow: 0 4px 12px rgba(19,29,24,0.04);
  background: rgba(255,255,255,0.52);
  border: 1px solid rgba(17,24,39,0.03);
}
.social:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(19,29,24,0.08);
}
.social svg,
.social img {
  width: 20px !important;
  height: 20px !important;
  display: block;
}

/* Small screens */
@media (max-width: 920px) {
  .footer-large__top {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    padding: 0 12px;
  }
  .footer-right {
    justify-content: center;
  }
  .footer-large__bottom {
    flex-direction: column;
    gap: 10px;
    align-items: center;
    padding: 0 12px;
  }
}
    `;
    document.head.appendChild(s);
  }, []);

  const productContext =
    "Skypiea is a secure, privacy-focused file transfer service. We support end-to-end peer-to-peer transfers when possible and encrypted server-relay fallback. Short-lived tokens, per-chunk verification, and simple browser UX make sharing files fast and reliable.";

  const socials = [
    { url: "https://www.instagram.com/__vivek__zx/#", label: "Instagram" },
    { url: "https://in.linkedin.com/in/vivek-sesetti-74a6b9324", label: "LinkedIn" },
    { url: "https://github.com/VIV3K-17", label: "GitHub" },
  ];

  //
  // Dynamic rating via backend (SQLite)
  const API_BASE = "http://localhost:3000";
  const STORAGE_KEY = "skypiea_rating_voted";
  const [displayAvg, setDisplayAvg] = React.useState(0);
  const [displayCount, setDisplayCount] = React.useState(0);
  const [userRating, setUserRating] = React.useState(null);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [showInteractive, setShowInteractive] = React.useState(true);
  
  // Modal state for rating confirmation
  const [ratingModalOpen, setRatingModalOpen] = React.useState(false);
  const [ratingModalMessage, setRatingModalMessage] = React.useState("");

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/rating`);
      const data = await res.json();
      const avg = typeof data.avg === "number" ? Number(data.avg.toFixed(2)) : 0;
      const cnt = typeof data.count === "number" ? data.count : 0;
      setDisplayAvg(avg);
      setDisplayCount(cnt);
    } catch { void 0; }
  };

  React.useEffect(() => {
    const voted = localStorage.getItem(STORAGE_KEY);
    setShowInteractive(!voted);
    fetchStats();
  }, []);

  const handleVote = async (n) => {
    if (!n || n < 1 || n > 5) return;
    try {
      const res = await fetch(`${API_BASE}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: n })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRatingModalMessage(err && err.error ? err.error : "Could not submit rating");
        setRatingModalOpen(true);
        return;
      }
      const data = await res.json();
      setUserRating(n);
      setShowInteractive(false);
      localStorage.setItem(STORAGE_KEY, "1");
      const avg = typeof data.avg === "number" ? Number(data.avg.toFixed(2)) : displayAvg;
      const cnt = typeof data.count === "number" ? data.count : displayCount + 1;
      setDisplayAvg(avg);
      setDisplayCount(cnt);
      setRatingModalMessage("Thanks for rating Skypiea! Your feedback helps us improve.");
      setRatingModalOpen(true);
    } catch {
      setRatingModalMessage("Network error while submitting rating");
      setRatingModalOpen(true);
    }
  };

  const handleKey = (e, n) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      handleVote(n);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const newV = Math.max(1, (hoverRating || userRating || 0) - 1);
      setHoverRating(newV);
    }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const newV = Math.min(5, (hoverRating || userRating || 0) + 1);
      setHoverRating(newV);
    }
  };

  // star SVG component
  const Star = ({ filled }) => (
    <svg viewBox="0 0 24 24" className={`star-svg ${filled ? "star-filled" : "star-empty"}`} aria-hidden>
      <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.789 1.402 8.17L12 18.896l-7.336 3.873 1.402-8.17L.132 9.211l8.2-1.193z" />
    </svg>
  );

  return (
    <footer className="footer-large" role="contentinfo" aria-label="Site footer">
      <div className="footer-large__top">
        {/* LEFT */}
        <div className="footer-left">
          <div className="brand-row">
            <div className="brand-text">
              <div className="brand-name">Skypiea</div>
              <p className="brand-tag">{productContext}</p>
            </div>
          </div>
        </div>

        {/* CENTER - dynamic rating */}
        <div className="footer-mid">
          <div className="rating-stars" aria-live="polite">
            <div className="avg-block">
              <div className="rating-display">
                <div aria-hidden style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const starValue = i + 1;
                    const rounded = Math.round(displayAvg);
                    return <Star key={i} filled={starValue <= rounded} />;
                  })}
                </div>
                <div>
                  <div className="rating-numeric" aria-label={`Average rating ${displayAvg} out of 5`}>{displayAvg}</div>
                  <div className="rating-count">{displayCount.toLocaleString()} ratings</div>
                </div>
              </div>
            </div>

            {/* Interactive stars when not yet voted */}
            {showInteractive ? (
              <>
                <div className="star-row" role="radiogroup" aria-label="Rate Skypiea">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const n = i + 1;
                    const isFilled = hoverRating ? n <= hoverRating : false;
                    return (
                      <button
                        key={n}
                        className="star-btn"
                        role="radio"
                        aria-checked={false}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        onClick={() => handleVote(n)}
                        onKeyDown={(e) => handleKey(e, n)}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        title={`Rate ${n} star${n > 1 ? "s" : ""}`}
                      >
                        <svg viewBox="0 0 24 24" className="star-svg" aria-hidden>
                          <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.789 1.402 8.17L12 18.896l-7.336 3.873 1.402-8.17L.132 9.211l8.2-1.193z"
                            fill={isFilled ? "#f59e0b" : "#e6e7eb"} />
                        </svg>
                      </button>
                    );
                  })}
                </div>
                <div className="star-hint">Click a star to rate Skypiea</div>
              </>
            ) : (
              <div className="star-hint" aria-hidden>
                {userRating ? `Thanks — you rated ${userRating} star${userRating > 1 ? "s" : ""}.` : "Thanks for your rating."}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="footer-right">
          <nav className="footer-links" aria-label="Footer links">
            
            <Link to="/privacy">Privacy</Link>
            <Link to="/contact">Contact</Link>
          </nav>
        </div>
      </div>

      <div className="footer-large__bottom">
        <div className="copyright">© {year} Skypiea. All rights reserved.</div>
        <div className="social-icons" aria-label="Skypiea social links">
          {socials.map((s) => (
            <a
              key={s.url}
              className="social"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              title={s.label}
            >
              <SocialIcon url={s.url} style={{ height: 20, width: 20 }} fgColor="#ffffff" bgColor="#111827" />
            </a>
          ))}
        </div>
      </div>

      {/* Rating confirmation modal (reused from App.jsx ConfirmModal style) */}
      {ratingModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Rating Submitted</h3>
            <p style={{ marginTop: 8 }}>{ratingModalMessage}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="primary" onClick={() => setRatingModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
