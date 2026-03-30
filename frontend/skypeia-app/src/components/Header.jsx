import React from "react";
import { SiBluesky } from "react-icons/si";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/support", label: "Support" },
  { to: "/privacy", label: "Privacy" },
  { to: "/contact", label: "Contact" },
];

const STEP_LABELS = ["Connect", "Transfer", "Complete"];

export default function Header({ connectionStatus = "Disconnected", activeStep = 1 }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const safeStep = Math.max(1, Math.min(3, Number(activeStep || 1)));

  return (
    <header className="sk-header" role="banner" aria-label="Skypiea header">
      <div className="sk-header__inner">
        <Link className="sk-brand" to="/" aria-label="Skypiea home" onClick={() => setMenuOpen(false)}>
          <span className="sk-brand__logo" aria-hidden>
            <SiBluesky />
          </span>
          <span className="sk-brand__text">
            <strong>Skypiea</strong>
          </span>
        </Link>

        <nav className="sk-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sk-header__meta">
          <span className={`sk-status sk-status--${String(connectionStatus).toLowerCase()}`}>
            <span className="sk-status__dot" aria-hidden />
            {connectionStatus}
          </span>

          <ol className="sk-steps" aria-label="Transfer progress steps">
            {STEP_LABELS.map((label, index) => {
              const stepNum = index + 1;
              const done = stepNum < safeStep;
              const current = stepNum === safeStep;
              return (
                <li key={label} className={`sk-step ${done ? "done" : ""} ${current ? "current" : ""}`}>
                  <span className="sk-step__num">{stepNum}</span>
                  <span className="sk-step__label">{label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <button
          type="button"
          className="sk-menu-btn"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          Menu
        </button>
      </div>

      {menuOpen && (
        <div className="sk-mobile-menu" role="menu" aria-label="Mobile navigation">
          {NAV_LINKS.map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
