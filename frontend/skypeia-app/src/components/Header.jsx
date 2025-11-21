// HeaderSimple.jsx
import React from "react";
import { SiBluesky } from "react-icons/si";
import { Link } from "react-router-dom";

/**
 * HeaderSimple.jsx
 * - Brand (logo + text) placed at the very left
 * - Nav links placed at the very right
 * - Glass blur background using backdrop-filter
 * - Responsive: shows hamburger on small screens
 * - SSR-safe width handling (useEffect sets width on client)
 */

function useWindowWidth() {
  const [width, setWidth] = React.useState(
    typeof window === "undefined" ? 1200 : window.innerWidth
  );
  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    // update once on mount (in case initial value was placeholder)
    setWidth(window.innerWidth);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export default function HeaderSimple() {
  const width = useWindowWidth();
  const isMobile = width <= 860;
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (document.getElementById("header-simple-styles")) return;
    const s = document.createElement("style");
    s.id = "header-simple-styles";
    s.innerHTML = `
/* HeaderSimple - left brand, right nav, glass blur background */
.header-simple {
  position: sticky;
  top: 0;
  z-index: 60;
  width: 100%;
  box-sizing: border-box;
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
  background: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(250,250,247,0.45));
  border-bottom: 1px solid rgba(17,24,39,0.06);
}

/* Centered inner container */
.header-simple__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between; /* left brand, right nav */
  gap: 12px;
  box-sizing: border-box;
  min-height: 64px;
}

/* Brand (left-most) */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #153225;
  flex-shrink: 0;
}
.logo-mark {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(177,209,130,0.12), rgba(43,70,60,0.04));
  color: #2b463c;
  font-size: 26px;
  flex: 0 0 54px;
  box-shadow: 0 6px 18px rgba(19,29,24,0.05);
  border: 1px solid rgba(43,70,60,0.06);
}

.brand-name {
  font-weight: 800;
  font-size: 28px !important;
  color: #153225;
  letter-spacing: -0.3px;
}


.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
  min-width: 0;
}

.brand-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* Right navigation (right-most) */
.header-nav {
  display: flex;
  gap: 22px;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto; /* ensures it sits to the very right */
}
.header-nav a {
  color: #213632;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease;
}
.header-nav a:hover, .header-nav a:focus {
  background: rgba(43,70,60,0.04);
  color: #2b463c;
  transform: translateY(-1px);
}

/* Mobile hamburger */
.hamburger-btn {
  display: none;
  background: transparent;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
}
.hamburger-line {
  width: 20px;
  height: 2px;
  background: #213632;
  border-radius: 2px;
  display: block;
  position: relative;
}
.hamburger-line::before,
.hamburger-line::after {
  content: "";
  position: absolute;
  left: 0;
  width: 20px;
  height: 2px;
  background: #213632;
  border-radius: 2px;
}
.hamburger-line::before { top: -6px; }
.hamburger-line::after { top: 6px; }

/* Mobile menu popover */
.mobile-menu {
  position: absolute;
  right: 20px;
  top: calc(100% + 8px);
  min-width: 180px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,247,0.98));
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(19,29,24,0.12);
  border: 1px solid rgba(17,24,39,0.06);
  padding: 8px;
  z-index: 200;
}
.mobile-menu a {
  display: block;
  padding: 10px 12px;
  font-weight: 600;
  color: #213632;
  text-decoration: none;
  border-radius: 8px;
}
.mobile-menu a:hover { background: rgba(43,70,60,0.04); color: #2b463c; }

/* Responsive rules */
@media (max-width: 860px) {
  .header-nav { display: none; } /* hide desktop nav on small screens */
  .hamburger-btn { display: inline-flex; align-items: center; }
  .brand-name { font-size: 16px; }
  .logo-mark { width: 40px; height: 40px; }
}
`;
    document.head.appendChild(s);
  }, []);

  // hide mobile menu when resizing to desktop
  React.useEffect(() => {
    if (!isMobile && menuOpen) setMenuOpen(false);
  }, [isMobile, menuOpen]);

  // const handleNav = (label) => {
  //   // placeholder nav handler; replace with your router navigation if needed
  //   setMenuOpen(false);
  //   // example: scroll to section if it exists
  //   const id = label.toLowerCase();
  //   const el = document.getElementById(id);
  //   if (el) {
  //     el.scrollIntoView({ behavior: "smooth" });
  //     return;
  //   }
  //   // fallback
  //   console.log("Nav clicked:", label);
  // };

  return (
    <header className="header-simple" role="banner" aria-label="Skypiea header">
      <div className="header-simple__inner">
        {/* LEFT: brand (locked to very left) */}
        <Link
          className="brand"
          to="/"
          aria-label="Skypiea home"
        >
          <span className="logo-mark" aria-hidden>
            <SiBluesky />
          </span>
          <span className="brand-text">
            <span className="brand-name">Skypiea</span>
           
          </span>
  </Link>

        {/* RIGHT: nav (locked to very right) */}
        {!isMobile && (
          <nav className="header-nav" aria-label="Primary navigation">
            <Link to="/features" onClick={() => setMenuOpen(false)}>
              Features
            </Link>
            <Link to="/support" onClick={() => setMenuOpen(false)}>
              Support
            </Link>
            
          </nav>
        )}

        {/* Mobile hamburger (right-most) */}
        {isMobile && (
          <>
            <button
              className="hamburger-btn"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Open menu"
              onClick={() => setMenuOpen((s) => !s)}
              title="Menu"
            >
              <span className="hamburger-line" />
            </button>

            {menuOpen && (
              <div className="mobile-menu" role="menu" aria-label="Mobile navigation">
                <Link to="/features" role="menuitem" onClick={() => { setMenuOpen(false); }}>
                  Features
                </Link>
                <Link to="/support" role="menuitem" onClick={() => { setMenuOpen(false); }}>
                  Support
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
