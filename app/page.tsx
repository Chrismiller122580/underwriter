import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container page-main page-main-home">
      <div className="card">
        <p className="badge">FWCUT Underwriter</p>
        <h1 className="page-title">Claims Underwriting Platform</h1>
        <p className="page-intro">
          Submit vehicle warranty claims, upload supporting documents, and run
          automated policy validation — all from your browser.
        </p>

        <div className="hero-actions">
          <Link href="/submit" className="button">
            Submit a Claim
          </Link>
          <Link href="/login" className="button button-secondary">
            Staff Sign In
          </Link>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>Claim Intake</h3>
            <p>Structured form for policy, vehicle, incident, and repair details.</p>
          </div>
          <div className="feature-card">
            <h3>Document Upload</h3>
            <p>Attach ownership proof, maintenance records, and inspection reports.</p>
          </div>
          <div className="feature-card">
            <h3>AI Underwriting</h3>
            <p>Grok-powered risk scoring, fraud detection, and smart approve/deny recommendations.</p>
          </div>
        </div>
      </div>
    </main>
  );
}