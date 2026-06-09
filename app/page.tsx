import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <p className="badge">FWCUT Underwriter</p>
        <h1 style={{ marginTop: 12 }}>Claims Underwriting Platform</h1>
        <p className="page-intro">
          Submit vehicle warranty claims, upload supporting documents, and run
          automated policy validation — all from your browser.
        </p>

        <div className="hero-actions">
          <Link href="/submit" className="button">
            Submit a Claim
          </Link>
          <Link href="/claims" className="button button-secondary">
            View Dashboard
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
            <h3>Auto Underwriting</h3>
            <p>Policy date validation and claim approval workflow built in.</p>
          </div>
        </div>
      </div>
    </main>
  );
}