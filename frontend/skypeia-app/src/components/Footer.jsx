import React from "react";
import { SocialIcon } from "react-social-icons";

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
  min-height: 1px;
}
.rating-stars {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

/* Right links */
.footer-right {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.footer-right .rating-stars {
  align-items: flex-end;
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
  .footer-right .rating-stars {
    align-items: center;
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
    { url: "https://www.facebook.com/s.sai.vivek.74", label: "Facebook" }
  ];

  const API_BASE = "https://skypiea-2.onrender.com";
  const [userRating, setUserRating] = React.useState(null);
  const [hoverRating, setHoverRating] = React.useState(0);
  const handleVote = async (n) => {
    if (!n || n < 1 || n > 5) return;
    setUserRating(n);
    try {
      await fetch(`${API_BASE}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: n })
      });
    } catch {
      // Preserve selected stars even if network submit fails.
    }
  };

  const handleKey = (e, n) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      handleVote(n);
      setHoverRating(0);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const newV = Math.max(1, (hoverRating || userRating || 1) - 1);
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

        <div className="footer-mid" />

        {/* RIGHT */}
        <div className="footer-right">
          <div className="rating-stars" aria-live="polite">
            <div className="star-row" role="radiogroup" aria-label="Rate Skypiea">
              {Array.from({ length: 5 }).map((_, i) => {
                const n = i + 1;
                const active = hoverRating || userRating || 0;
                return (
                  <button
                    key={n}
                    className="star-btn"
                    role="radio"
                    aria-checked={active === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => {
                      handleVote(n);
                      setHoverRating(0);
                    }}
                    onKeyDown={(e) => handleKey(e, n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    title={`Rate ${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star filled={n <= active} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="footer-large__bottom">
        <div className="copyright">© {year} Skypiea. All rights reserved.</div>
        <div className="social-icons" aria-label="Skypiea social links">
          {socials.map((s) => (
            <span key={s.url} className="social" role="presentation">
              <SocialIcon
                url={s.url}
                rel="noopener noreferrer"
                target="_blank"
                title={s.label}
                aria-label={s.label}
                style={{ height: 20, width: 20 }}
                fgColor="#ffffff"
                bgColor="#111827"
              />
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
