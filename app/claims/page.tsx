import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';

export default function ClaimsPage() {
  return (
    <main className="container-wide page-main">
      <div className="card adjuster-portal-shell">
        <div className="page-header page-header-stack">
          <div>
            <p className="badge">Adjuster Workbench</p>
            <h1 className="page-title">Underwriting Command Center</h1>
            <p className="page-intro">
              Prioritized claim queue with contract context, documentation gaps,
              AI risk signals, and one-click underwriting. AI analysis is required
              before approval — use information requests to gather missing files.
            </p>
          </div>
          <Link href="/submit" className="button">
            New Claim Intake
          </Link>
        </div>

        <ClaimsDashboard />
      </div>
    </main>
  );
}