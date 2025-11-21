import React from "react";
import { useNavigate } from "react-router-dom"; 
import { Link } from "react-router-dom";
import Footer from "./Footer";
import Header from "./Header";
export default function Contact() {
    const navigate = useNavigate();
  React.useEffect(() => {
    if (document.getElementById("contact-styles")) return;
    const s = document.createElement("style");
    s.id = "contact-styles";
    s.innerHTML = `
/* Contact Page Styles */
.contact-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 48px 20px;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  color: #0f172a;
}

.contact-container h1 {
  font-weight: 800;
  font-size: 32px;
  margin-bottom: 12px;
  color: #0f172a;
}

.contact-container > p {
  font-size: 14px;
  color: #475569;
  margin-bottom: 32px;
}

.contact-cards {
  display: grid;
  gap: 24px;
  margin-top: 32px;
}

.contact-card {
  background: linear-gradient(135deg, rgba(43, 70, 60, 0.04), rgba(43, 70, 60, 0.02));
  border: 1px solid rgba(43, 70, 60, 0.1);
  border-radius: 12px;
  padding: 24px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.contact-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(43, 70, 60, 0.08);
}

.contact-card h2 {
  font-weight: 700;
  font-size: 18px;
  color: #1f2937;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.contact-card p {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
  line-height: 1.5;
}

.contact-card a {
  display: inline-block;
  color: #2b463c;
  text-decoration: none;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(43, 70, 60, 0.08);
  transition: background 0.2s;
}

.contact-card a:hover {
  background: rgba(43, 70, 60, 0.16);
  text-decoration: underline;
}

.contact-icon {
  font-size: 20px;
  display: inline-block;
}

.contact-section {
  background: rgba(43, 70, 60, 0.04);
  border-left: 4px solid rgba(43, 70, 60, 0.2);
  padding: 20px;
  border-radius: 6px;
  margin-top: 32px;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.contact-section h3 {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
  font-size: 14px;
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


@media (max-width: 640px) {
  .contact-container {
    padding: 32px 16px;
  }

  .contact-container h1 {
    font-size: 24px;
  }

  .contact-cards {
    gap: 16px;
  }

  .contact-card {
    padding: 16px;
  }

  .contact-card h2 {
    font-size: 16px;
  }
}
    `;
    document.head.appendChild(s);
  }, []);

  return (
    <div className="site-root">
        <Header />
      <main className="main-content" role="main">
        <div className="contact-container">
          <h1>Contact & Support</h1>
          <p>
            Have questions, found a bug, or want to discuss Skypiea? We'd love to hear from you!
          </p>

          <div className="contact-cards">
            {/* Email */}
            <div className="contact-card">
              <h2>
                <span className="contact-icon">📧</span>
                Email
              </h2>
              <p>
                For general inquiries, bug reports, or data removal requests, email us:
              </p>
              <a href="mailto:saivivek0789@gmail.com" target="_blank" rel="noopener noreferrer">
                saivivek0789@gmail.com
              </a>
            </div>

            {/* LinkedIn */}
            <div className="contact-card">
              <h2>
                <span className="contact-icon">💬</span>
                LinkedIn
              </h2>
              <p>
                Connect with us on LinkedIn for updates and professional inquiries:
              </p>
              <a href="https://in.linkedin.com/in/vivek-sesetti-74a6b9324" target="_blank" rel="noopener noreferrer">
                Visit LinkedIn Profile
              </a>
            </div>

            {/* GitHub */}
            <div className="contact-card">
              <h2>
                <span className="contact-icon">🐙</span>
                GitHub
              </h2>
              <p>
                Report issues, view source code, or contribute on GitHub:
              </p>
              <a href="https://github.com/VIV3K-17" target="_blank" rel="noopener noreferrer">
                View GitHub Profile
              </a>
            </div>
          </div>

          <div className="contact-section">
            <h3>What Can We Help With?</h3>
            <ul style={{ marginLeft: 16, lineHeight: 1.8 }}>
              <li><strong>Feature Requests:</strong> Have an idea? We'd love to hear it.</li>
              <li><strong>Bug Reports:</strong> Found something wrong? Let us know the details.</li>
              <li><strong>Data Removal:</strong> Want your uploaded files, logs, or ratings deleted? Contact us.</li>
              <li><strong>Privacy Questions:</strong> Read our <Link to="/privacy" style={{ color: "#2b463c", textDecoration: "underline", fontWeight: 600 }}>Privacy Policy</Link> or ask us directly.</li>
              <li><strong>Security Issues:</strong> Found a vulnerability? Please report it responsibly.</li>
            </ul>
          </div>

          <div className="contact-section">
            <h3>Response Time</h3>
            <p>
              We aim to respond to inquiries within 2-3 business days. During periods of high volume,
              it may take longer. Thank you for your patience!
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
