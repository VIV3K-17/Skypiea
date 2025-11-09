// src/components/Footer.jsx
import React from "react";

export default function Footer({ year = new Date().getFullYear() }) {
  return (
    <footer className="footer-root" aria-label="Site footer">
      <div className="footer-inner">
        <div className="footer-left">© {year} Skypiea. All rights reserved.</div>

        <div className="footer-right">
          <div className="rating" aria-hidden>
            <svg width="92" height="28" viewBox="0 0 92 28" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="0.5" y="0.5" width="91" height="27" rx="6" fill="none" stroke="#e6e6e6" />
              <text x="46" y="20" textAnchor="middle" fontSize="13" fill="#f59e0b" fontWeight="700">★★★★★</text>
            </svg>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              <strong style={{ color: "#111827" }}>Best File Transfer Platform</strong>
              <div style={{ fontSize: 12 }}>4.9/5 from 2,300+ reviews</div>
            </div>
          </div>

          <nav className="footer-links" aria-label="Footer links">
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Cookies</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
