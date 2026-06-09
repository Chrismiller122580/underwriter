import Link from 'next/link';
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
    <main className="container toolbox-page">
      <div className="card toolbox-shell">
        <div className="page-header">
          <div>
            <p className="badge">Freedom Warranty AI</p>
            <h1 style={{ marginTop: 12 }}>Supervisor Toolbox</h1>
            <p className="page-intro">
              Train Grok with underwriting knowledge, inspect prompts, test
              scenarios, and run bulk AI operations across the claims portfolio.
            </p>
          </div>
        </div>

        <SupervisorToolbox />

        <Link href="/" className="back-link">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}