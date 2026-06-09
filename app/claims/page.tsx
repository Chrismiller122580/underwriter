import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';

export default function ClaimsPage() {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <p className="badge">AI-Powered Dashboard</p>
            <h1 style={{ marginTop: 12 }}>Claims Intelligence</h1>
          </div>
          <Link href="/submit" className="button">
            Submit New Claim
          </Link>
        </div>

        <ClaimsDashboard />

        <Link href="/" className="back-link">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}