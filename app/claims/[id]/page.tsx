import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ClaimDetailClient } from '@/components/ClaimDetailClient';
import {
  canManageKnowledge,
  canUnderwrite,
  getSessionFromCookies,
} from '@/lib/auth';
import { isValidClaimId } from '@/lib/claims-store';

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionFromCookies();

  if (!session || !canUnderwrite(session.role)) {
    redirect(`/login?next=${encodeURIComponent(`/claims/${id}`)}`);
  }

  if (!isValidClaimId(id)) {
    notFound();
  }

  const isSupervisor = canManageKnowledge(session.role);

  return (
    <main className="adjuster-page claim-detail-page">
      <header className="adjuster-hero claim-detail-hero">
        <div className="adjuster-hero-inner">
          <div className="adjuster-hero-copy">
            <p className="adjuster-eyebrow">
              {isSupervisor ? 'Supervisor · Claim detail' : 'Reviewer · Claim detail'}
            </p>
            <h1 className="adjuster-title">Claim workspace</h1>
            <p className="adjuster-lead">
              Full context for underwriting — rules, documents, AI scan, and
              decisions. Share this URL with other staff working the same claim.
            </p>
          </div>
          <div className="adjuster-hero-actions">
            <Link href="/claims" className="button button-secondary adjuster-cta">
              Queue
            </Link>
            {isSupervisor ? (
              <Link
                href="/admin/toolbox"
                className="button button-secondary adjuster-cta"
              >
                Admin Tools
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="claim-detail-main">
        <ClaimDetailClient claimId={id} />
      </div>
    </main>
  );
}
