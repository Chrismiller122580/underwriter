import { redirect } from 'next/navigation';
import { SupervisorToolbox } from '@/components/SupervisorToolbox';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';

export default async function SupervisorToolboxPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect('/login?next=/admin/toolbox&role=supervisor');
  }

  if (!canManageKnowledge(session.role)) {
    redirect('/claims');
  }

  return (
    <main className="container-wide page-main">
      <div className="card toolbox-shell">
        <div className="page-header page-header-stack">
          <div>
            <p className="badge">Freedom Warranty AI</p>
            <h1 className="page-title">Supervisor Toolbox</h1>
            <p className="page-intro">
              Train Grok with underwriting knowledge, inspect prompts, test
              scenarios, and run bulk AI operations across the claims portfolio.
            </p>
          </div>
        </div>

        <SupervisorToolbox />
      </div>
    </main>
  );
}