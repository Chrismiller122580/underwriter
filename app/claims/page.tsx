import Link from 'next/link';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';
import { LoginWelcomeBanner } from '@/components/LoginWelcomeBanner';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';
import { formatRoleLabel } from '@/lib/roles';

export default async function ClaimsPage() {
  const session = await getSessionFromCookies();
  const isSupervisor = Boolean(
    session && canManageKnowledge(session.role)
  );
  const roleLabel = session
    ? formatRoleLabel(session.role)
    : 'Reviewer';

  return (
    <main className="adjuster-page">
      <LoginWelcomeBanner />
      <header
        className={`adjuster-hero${isSupervisor ? ' adjuster-hero-supervisor' : ''}`}
      >
        <div className="adjuster-hero-inner">
          <div className="adjuster-hero-copy">
            <p className="adjuster-eyebrow">
              {isSupervisor
                ? 'Supervisor Workbench'
                : 'Reviewer Workbench'}
            </p>
            <h1 className="adjuster-title">Underwriting Command Center</h1>
            <p className="adjuster-lead">
              {isSupervisor ? (
                <>
                  You are signed in as a <strong>Supervisor</strong>. Work the
                  claim queue below, or open{' '}
                  <strong>Admin Tools</strong> for portfolio overview, knowledge
                  training, staff users, and bulk AI operations. Open any claim
                  for a shareable full workspace.
                </>
              ) : (
                <>
                  You are signed in as a <strong>{roleLabel}</strong>. Triage
                  claims by priority, open a claim for full context, review
                  contract rules and AI signals, then underwrite. Run an AI scan
                  before every final decision.
                </>
              )}
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
              <li>Open claim</li>
              <li>Scan</li>
              <li>Underwrite</li>
            </ol>
          </div>
        </div>
      </header>

      <ClaimsDashboard />
    </main>
  );
}
