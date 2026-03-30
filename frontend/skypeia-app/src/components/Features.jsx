// Features.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

const BRAND = {
  green: "#153225",
  textMuted: "#4b5563",
};

const features = [
  {
    title: "Fast browser transfers",
    summary: "Send files directly between devices with low setup friction and smooth progress.",
    bullets: [
      "Chunked streaming for large files",
      "Live progress and speed indicators",
      "Pause, resume, and stop controls",
    ],
  },
  {
    title: "Reliable connection flow",
    summary: "Connect quickly with short codes or QR and keep transfers stable across networks.",
    bullets: [
      "Code + QR based pairing",
      "Expiry-aware connection lifecycle",
      "Fallback-friendly websocket transport",
    ],
  },
  {
    title: "Integrated direct chat",
    summary: "Coordinate transfers in real-time with a focused chat experience built into the flow.",
    bullets: [
      "Floating chat button + dialog",
      "Copyable messages with sender identity",
      "Feather/Boulder retention modes",
    ],
  },
  {
    title: "Privacy-first by default",
    summary: "Skypiea keeps the transfer journey lightweight with minimal retained data.",
    bullets: [
      "Short-lived session behavior",
      "Optional history persistence modes",
      "Simple, transparent controls",
    ],
  },
  {
    title: "Cross-device ready",
    summary: "Use desktop and mobile browsers without installs and still keep the same workflow.",
    bullets: [
      "Responsive sender/receiver panels",
      "Camera QR scanning support",
      "Consistent UI on small screens",
    ],
  },
  {
    title: "Built for iteration",
    summary: "Clear UX states and modular components make the product easy to evolve.",
    bullets: [
      "Component-driven architecture",
      "Feature pages for support and privacy",
      "Clean extension path for future updates",
    ],
  },
];

export default function FeaturesPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fdf8 0%, #e8f7e6 100%)",
      }}
    >
      <Header />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 20px" }}>
        {/* Page header */}
        <section style={{ textAlign: "center", marginBottom: 40 }}>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: BRAND.green,
              marginBottom: 10,
            }}
          >
            Features
          </h1>
          <p
            style={{
              color: BRAND.textMuted,
              fontSize: 16,
              maxWidth: 700,
              margin: "0 auto",
            }}
          >
            Explore the current Skypiea experience across transfer, chat, privacy, and reliability.
          </p>
        </section>

        {/* Features grid */}
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-inner">
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-summary">{f.summary}</p>
                <ul className="feature-list">
                  {f.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
                {i < features.length - 2 ? (
                  <div className="feature-btn">
                    {/* <button type="button" onClick={() => navigate('/')} className="try-now-btn">
                      Try now
                    </button> */}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Centered CTA for the last two cards */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button type="button" onClick={() => navigate('/')} className="try-now-btn">
            Try now
          </button>
        </div>

        {/* Inline styling */}
        <style>{`
          .features-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 28px;
            justify-content: center;
          }

          @media (min-width: 768px) {
            .features-grid {
              grid-template-columns: repeat(2, 350px);
              gap: 32px;
              justify-content: center;
            }
          }

          .feature-card {
            width: 350px;
            height: 400px;
            border-radius: 16px;
            overflow: hidden;
            background: #ffffff;
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 6px 20px rgba(21,50,37,0.06);
            transition: transform 0.25s ease, box-shadow 0.25s ease;
          }

          .feature-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 50px rgba(21,50,37,0.18);
          }

          .feature-inner {
            height: 100%;
            width: 100%;
            padding: 1.75rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #ffffff;
          }

          .feature-title {
            font-size: 1.125rem;
            font-weight: 700;
            color: ${BRAND.green};
            margin-bottom: 0.5rem;
          }

          .feature-summary {
            color: ${BRAND.textMuted};
            margin-bottom: 0.75rem;
            font-size: 0.95rem;
          }

          .feature-list {
            list-style: disc;
            padding-left: 1.2rem;
            color: #374151;
            font-size: 0.9rem;
            line-height: 1.6;
          }

          .feature-btn {
            text-align: center;
            margin-top: 1rem;
          }

          .try-now-btn {
            padding: 10px 18px;
            border-radius: 10px;
            background: linear-gradient(180deg,#153225,#1b3b2f);
            color: #fff;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 6px 18px rgba(21,50,37,0.14);
            transition: transform 0.15s ease, filter 0.15s ease;
          }

          .try-now-btn:hover {
            filter: brightness(1.05);
            transform: translateY(-1px);
          }

          @media (max-width: 767px) {
            .feature-card {
              width: 100%;
              max-width: 350px;
              margin: 0 auto;
            }
          }
        `}</style>
      </main>

      <Footer />
    </div>
  );
}
