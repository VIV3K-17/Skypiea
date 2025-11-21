// Support.jsx
import React, { useState } from "react";
import Header from "./Header";
import Footer from "./Footer";

/**
 * Support.jsx
 * - Matches the Skypiea theme (brand green #153225, glass panels)
 * - Contains "Donate a coffee" UI with:
 *   - BuyMeACoffee button (replace link)
 *   - PayPal.Me button (replace link)
 *   - UPI ID + copy button (replace id)
 *   - Uses an image in the QR placeholder (fallback to a local path provided by the project)
 */

const BRAND = {
  green: "#153225",
  muted: "#4b5563",
};

const DONATION_LINKS = {
  buymeacoffee: "https://www.buymeacoffee.com/yourname", // <-- replace
  paypal: "https://paypal.me/yourname", // <-- replace
  upiId: "yourupi@bank", // <-- replace
  upiQrSrc: "", // optional: data URL or image path for UPI QR (leave empty to use project-local fallback)
};

export default function SupportPage() {
  const [copied, setCopied] = useState(false);
  const [customAmount, setCustomAmount] = useState("3"); // default coffee amount in currency units
  const [showOptions, setShowOptions] = useState(true);

  // Modal state (keeps the centered confirmation modal with blur backdrop)
  const [showUnavailableModal, setShowUnavailableModal] = useState(true);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard API failed, falling back to execCommand", e);
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(el);
      }
    }
  };

  const openLinkWithAmount = (baseUrl, amount) => {
    const urlsToTry = [
      `${baseUrl}?amount=${encodeURIComponent(amount)}`,
      `${baseUrl}?utm_amount=${encodeURIComponent(amount)}`,
      baseUrl,
    ];
    window.open(urlsToTry[0], "_blank", "noopener,noreferrer");
  };

  // Modal OK click handler: hide modal
  const handleModalOk = () => {
    setShowUnavailableModal(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f8fdf8 0%, #e8f7e6 100%)" }}>
      <Header />

      {/* Confirmation modal overlay */}
      {showUnavailableModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Function unavailable"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            background: "rgba(10,10,10,0.28)",
            backdropFilter: "blur(6px) saturate(120%)",
          }}
        >
          <div
            style={{
              width: "min(480px, 92%)",
              background: "rgba(255,255,255,0.98)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 20px 48px rgba(0,0,0,0.2)",
              textAlign: "center",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ margin: 0, color: BRAND.green }}>Function not available</h2>
            <p style={{ color: BRAND.muted, marginTop: 10 }}>
              This function is not available at this time.
            </p>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleModalOk}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: BRAND.green,
                  color: "#fff",
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="OK"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 20px" }}>
        <section style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: "2rem", color: BRAND.green, margin: 0, fontWeight: 800 }}>Support the project</h1>
          <p style={{ color: BRAND.muted, marginTop: 10, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
            If you like Skypiea and want to support development, buying a coffee is the best way to say thanks — your donation
            helps fund hosting, improvements, and future features.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Main donate card */}
          <div
            style={{
              background: "rgba(255,255,255,1)",
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 10px 28px rgba(21,50,37,0.08)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                <h2 style={{ margin: 0, color: BRAND.green, fontSize: 18, fontWeight: 800 }}>
                  Buy the developer a coffee ☕
                </h2>

                <p style={{ color: BRAND.muted, marginTop: 10 }}>
                  Your contribution (even a small one) keeps the project alive. Pick a quick amount or enter a custom amount below.
                </p>

                {/* Amount quick buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  {[50, 100, 150].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCustomAmount(String(amt))}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: customAmount === String(amt) ? `2px solid ${BRAND.green}` : "1px solid rgba(0,0,0,0.06)",
                        background: customAmount === String(amt) ? `${BRAND.green}` : "#fff",
                        color: customAmount === String(amt) ? "#fff" : BRAND.green,
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      aria-pressed={customAmount === String(amt)}
                    >
                      ₹{amt}
                    </button>
                  ))}

                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                    <label htmlFor="custom-amount" style={{ fontSize: 13, color: BRAND.muted }}>
                      Custom
                    </label>
                    <input
                      id="custom-amount"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      style={{
                        width: 88,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.08)",
                        fontWeight: 700,
                      }}
                      inputMode="numeric"
                      aria-label="Custom donation amount"
                    />
                  </div>
                </div>

                {/* Donation platform buttons */}
                <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                  <button
                    onClick={() => openLinkWithAmount(DONATION_LINKS.buymeacoffee, customAmount)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: BRAND.green,
                      color: "#fff",
                      fontWeight: 800,
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label="Donate via Buy Me a Coffee"
                  >
                    Buy me a coffee
                  </button>

                  <button
                    onClick={() => openLinkWithAmount(DONATION_LINKS.paypal, customAmount)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#fff",
                      color: BRAND.green,
                      border: `1px solid ${BRAND.green}`,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    aria-label="Donate via PayPal"
                  >
                    PayPal
                  </button>

                  <button
                    onClick={() => {
                      copyToClipboard(DONATION_LINKS.upiId);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#fff",
                      color: BRAND.green,
                      border: "1px solid rgba(0,0,0,0.06)",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                    aria-label="Copy UPI ID"
                  >
                    Copy UPI ID
                  </button>

                  <button
                    onClick={() => setShowOptions((s) => !s)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "transparent",
                      color: BRAND.muted,
                      border: "1px dashed rgba(0,0,0,0.06)",
                      cursor: "pointer",
                    }}
                  >
                    {showOptions ? "Hide details" : "Show details"}
                  </button>
                </div>

                {/* status */}
                <div style={{ marginTop: 12, fontSize: 13, color: BRAND.muted }}>
                  {copied ? <span style={{ color: BRAND.green, fontWeight: 700 }}>UPI ID copied!</span> : <span>Secure checkout handled by provider</span>}
                </div>
              </div>

              {/* Right column: use an image for QR (either provided or fallback to a local project path) */}
              <div style={{ width: 220, minWidth: 220, borderRadius: 12 }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.04)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  {/* Use DONATION_LINKS.upiQrSrc if provided; otherwise use a local project file path as the image source. */}
                  {DONATION_LINKS.upiQrSrc ? (
                    <img
                      src={DONATION_LINKS.upiQrSrc || "/favicon/not_yet.jpg"}
                      alt="UPI QR"
                      style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 8 }}
                    />
                  ) : (
                    // NOTE: per project tooling, the path below (/mnt/data/App.jsx) will be transformed into a usable asset URL.
                    <img
                      src="/not_yet.jpg"
                      alt="UPI QR placeholder"
                      style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 8, background: "#f5f7f5" }}
                    />
                  )}

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 800, color: BRAND.green }}>Support the developer</div>
                    <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6 }}>Thank you — every contribution helps keep Skypiea running.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* extra details (toggle) */}
            {showOptions && (
              <div style={{ marginTop: 18, color: BRAND.muted, fontSize: 14 }}>
                <strong style={{ color: "#000", display: "block", marginBottom: 8 }}>Other ways to help</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Star the repo and share Skypiea with your friends</li>
                  <li>Report bugs or suggest features via issues</li>
                  <li>Contribute code or translations</li>
                </ul>
              </div>
            )}
          </div>

          {/* Short FAQ / transparency card */}
          <div
            style={{
              background: "rgba(255,255,255,1)",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 8px 20px rgba(21,50,37,0.06)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ marginTop: 0, color: BRAND.green }}>Where does the money go?</h3>
            <p style={{ color: BRAND.muted }}>
              Donations are used to cover hosting, maintenance, and open-source development time. Larger donations may be used for shared infrastructure costs.
            </p>

            <h4 style={{ color: "#000", marginBottom: 8 }}>Receipt & privacy</h4>
            <p style={{ color: BRAND.muted, fontSize: 14 }}>
              Payment platforms will handle receipts and payment processing. No donation information is stored by Skypiea beyond success/failure events.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
