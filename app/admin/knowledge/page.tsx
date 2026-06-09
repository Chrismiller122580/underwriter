import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KnowledgeManager } from '@/components/KnowledgeManager';
import { canManageKnowledge, getSessionFromCookies } from '@/lib/auth';

export default async function KnowledgeAdminPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect('/login?next=/admin/knowledge');
  }

  if (!canManageKnowledge(session.role)) {
    redirect('/claims');
  }

  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <div className="page-header">
          <div>
            <p className="badge">Supervisor Tools</p>
            <h1 style={{ marginTop: 12 }}>AI Underwriting Knowledge</h1>
            <p className="page-intro">
              Upload underwriting guides and reference documents. Active uploads
              are included in Grok AI prompts for every claim analysis and
              underwrite run.
            </p>
          </div>
          <Link href="/claims" className="button button-secondary">
            Back to claims
          </Link>
        </div>

        <KnowledgeManager />

        <Link href="/" className="back-link">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}