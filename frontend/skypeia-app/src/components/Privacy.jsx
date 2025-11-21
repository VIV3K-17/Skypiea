import React from "react";
import Footer from "./Footer";
import { useNavigate } from "react-router-dom";
import Header from "./Header";

export default function Privacy() {
    const navigate = useNavigate();
    React.useEffect(() => {
        if (document.getElementById("privacy-styles")) return;
        const s = document.createElement("style");
        s.id = "privacy-styles";
        s.innerHTML = `
/* Privacy Page Styles */
.privacy-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 20px;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  color: #0f172a;
  line-height: 1.6;
}

.privacy-container h1 {
  font-weight: 800;
  font-size: 32px;
  margin-bottom: 8px;
  color: #0f172a;
}

.privacy-container .updated {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 32px;
}

.privacy-container h2 {
  font-weight: 700;
  font-size: 20px;
  margin-top: 28px;
  margin-bottom: 12px;
  color: #1f2937;
}

.privacy-container h3 {
  font-weight: 600;
  font-size: 16px;
  margin-top: 16px;
  margin-bottom: 8px;
  color: #374151;
}

.privacy-container p, .privacy-container li {
  font-size: 14px;
  margin-bottom: 10px;
  color: #475569;
}

.privacy-container ul, .privacy-container ol {
  margin-left: 20px;
  margin-bottom: 16px;
}

.privacy-container li {
  margin-bottom: 8px;
}

.privacy-container a {
  color: #2b463c;
  text-decoration: none;
  font-weight: 500;
}

.privacy-container a:hover {
  text-decoration: underline;
}

.privacy-intro {
  background: rgba(43, 70, 60, 0.04);
  border-left: 4px solid rgba(43, 70, 60, 0.2);
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #1f2937;
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


.privacy-section {
  margin-bottom: 24px;
}
    `;
        document.head.appendChild(s);
    }, []);

    return (
        <div className="site-root">
            <Header />
            <main className="main-content" role="main">
                <div className="privacy-container">
                    <h1>Privacy Policy</h1>
                    <p className="updated">Last updated: November 2025</p>

                    <div className="privacy-intro">
                        <p>
                            <strong>Skypiea</strong> is a personal, non-commercial file transfer tool designed for simple and secure sharing.
                            This service does not sell, share, or monetize personal information.
                        </p>
                    </div>

                    <div className="privacy-section">
                        <h2>Information We Collect</h2>
                        <p>Skypiea stores only the minimum data required for the system to work:</p>

                        <h3>1. Technical & Security Data</h3>
                        <ul>
                            <li>IP address (temporarily in server logs)</li>
                            <li>Browser type and basic request information</li>
                            <li>Timestamp of requests</li>
                        </ul>
                        <p style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
                            Used only for debugging and security purposes.
                        </p>

                        <h3>2. File Upload Data</h3>
                        <ul>
                            <li>Uploaded files are stored locally on the server</li>
                            <li>Files may be automatically deleted after transfer or expiration</li>
                            <li>No cloud storage or third-party processing is used</li>
                        </ul>

                        <h3>3. Rating Data</h3>
                        <p>To prevent duplicate votes, Skypiea stores:</p>
                        <ul>
                            <li>A random browser ID (localStorage)</li>
                            <li>Your chosen rating (1–5)</li>
                        </ul>
                        <p style={{ fontSize: "12px", color: "#6b7280" }}>
                            This ID does not contain personal or identifiable information.
                        </p>

                        <h3>4. Cookies / Local Storage</h3>
                        <p>Skypiea uses only functional storage:</p>
                        <ul>
                            <li><strong>skypiea_userId</strong> – random ID to prevent duplicate ratings</li>
                            <li><strong>skypiea_rated</strong> – remembers if you rated</li>
                        </ul>
                        <p style={{ fontSize: "12px", color: "#6b7280" }}>
                            These are not used for tracking or advertising.
                        </p>
                    </div>

                    <div className="privacy-section">
                        <h2>What We DO NOT Collect</h2>
                        <ul>
                            <li>Names</li>
                            <li>Emails</li>
                            <li>Phone numbers</li>
                            <li>File contents for analytics</li>
                            <li>Location tracking</li>
                            <li>Third-party analytics or ad trackers</li>
                            <li>Any personal identity data</li>
                        </ul>
                    </div>

                    <div className="privacy-section">
                        <h2>Data Sharing</h2>
                        <p>
                            <strong>No data is shared with any third party.</strong> All data stays on the server hosting Skypiea.
                        </p>
                    </div>

                    <div className="privacy-section">
                        <h2>Your Control</h2>
                        <p>You may request:</p>
                        <ul>
                            <li>Removal of uploaded files</li>
                            <li>Removal of rating records</li>
                            <li>Log deletion (when possible)</li>
                        </ul>
                    </div>

                    <div className="privacy-section">
                        <h2>Security</h2>
                        <p>Skypiea uses:</p>
                        <ul>
                            <li>HTTPS (if enabled on hosting)</li>
                            <li>Resumable uploads with integrity checks (SHA-256)</li>
                            <li>Temporary sessions with expiration</li>
                        </ul>
                        <p style={{ marginTop: 12, color: "#6b7280" }}>
                            However, no system is 100% secure. Use Skypiea for file sharing at your own discretion.
                        </p>
                    </div>

                    <div className="privacy-section">
                        <h2>Changes to This Policy</h2>
                        <p>
                            This Privacy Policy may be updated. Changes will appear on this page with the updated date.
                        </p>
                    </div>

                    <div className="privacy-section">
                        <h2>Questions?</h2>
                        <p>
                            If you have questions or want data removed, please <a href="/contact">contact us</a>.
                        </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                        <button type="button" onClick={() => navigate('/')} className="try-now-btn">
                            Try now
                        </button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
