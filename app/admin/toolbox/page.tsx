import { redirect } from 'next/navigation';
import { LoginWelcomeBanner } from '@/components/LoginWelcomeBanner';
import { SupervisorToolbox } from '@/components/SupervisorToolbox';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';

export default async function SupervisorToolboxPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect('/login?next=/admin/toolbox');
  }

  if (!canManageKnowledge(session.role)) {
    redirect('/claims');
  }

  return (
    <main className="container-wide page-main">
      <LoginWelcomeBanner />
      <div className="card toolbox-shell">
        <div className="page-header page-header-stack">
          <div>
            <p className="badge">Freedom Warranty AI</p>
            <h1 className="page-title">Admin Tools</h1>
            <p className="page-intro">
              Supervisor command center — train Grok with underwriting knowledge,
              manage staff users, inspect prompts, test scenarios, and run bulk AI
              operations across the claims portfolio. Open any recent claim for a
              full shareable underwriting workspace.
            </p>
          </div>
        </div>

        <SupervisorToolbox />
      </div>
    </main>
  );
}