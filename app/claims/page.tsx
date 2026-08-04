import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';

export default async function ClaimsPage() {
  const session = await getSessionFromCookies();
  const isSupervisor = Boolean(
    session && canManageKnowledge(session.role)
  );

  return (
    <main className="adjuster-page">
      <header className="adjuster-hero">
        <div className="adjuster-hero-inner">
          <div className="adjuster-hero-copy">
            <p className="adjuster-eyebrow">Reviewer Workbench</p>
            <h1 className="adjuster-title">Underwriting Command Center</h1>
            <p className="adjuster-lead">
              Triage claims by priority, review contract rules and AI signals,
              then underwrite with confidence. Run an AI scan before every
              final decision. Reviewer and adjuster are the same staff role.
            </p>
          </div>
          <div className="adjuster-hero-actions">
            <Link href="/submit" className="button adjuster-cta">
              New Claim Intake
            </Link>
            {isSupervisor ? (
              <Link
                href="/admin/toolbox"
                className="button button-secondary adjuster-cta"
              >
                Admin Tools
              </Link>
            ) : null}
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