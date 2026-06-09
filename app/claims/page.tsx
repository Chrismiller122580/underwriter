import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';

export default function ClaimsPage() {
  return (
    <main className="adjuster-page">
      <header className="adjuster-hero">
        <div className="adjuster-hero-inner">
          <div className="adjuster-hero-copy">
            <p className="adjuster-eyebrow">Adjuster Workbench</p>
            <h1 className="adjuster-title">Underwriting Command Center</h1>
            <p className="adjuster-lead">
              Triage claims by priority, review contract rules and AI signals,
              then underwrite with confidence. Run an AI scan before every
              final decision.
            </p>
          </div>
          <div className="adjuster-hero-actions">
            <Link href="/submit" className="button adjuster-cta">
              New Claim Intake
            </Link>
            <ol className="adjuster-workflow">
              <li>Scan</li>
              <li>Review</li>
              <li>Underwrite</li>
            </ol>
          </div>
        </div>
      </header>

      <ClaimsDashboard />
    </main>
  );
}