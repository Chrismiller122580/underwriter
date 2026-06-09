import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';

export default function ClaimsPage() {
  return (
    <main className="container page-main">
      <div className="card">
        <div className="page-header">
          <div>
            <p className="badge">AI-Powered Dashboard</p>
            <h1 className="page-title">Claims Intelligence</h1>
            <p className="page-intro">
              Review submissions, run AI underwriting, and act on information
              requests and guideline flags.
            </p>
          </div>
          <Link href="/submit" className="button">
            Submit New Claim
          </Link>
        </div>

        <ClaimsDashboard />
      </div>
    </main>
  );
}