import { ClaimStatusLookup } from '@/components/ClaimStatusLookup';
import { ThemeToggle } from '@/components/ThemeToggle';
import Link from 'next/link';

export default function ClaimStatusPage() {
  return (
    <main className="container page-main">
      <div className="page-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="card status-card">
        <p className="badge">Claimants &amp; shops</p>
        <h1 className="page-title">Check claim status</h1>
        <p className="page-intro">
          Enter the tracking code from your submission confirmation and the
          claimant&apos;s last name. No login required.
        </p>
        <ClaimStatusLookup />
        <p className="form-hint" style={{ marginTop: 24 }}>
          Staff?{' '}
          <Link href="/login">Sign in to the adjuster portal</Link>
        </p>
      </div>
    </main>
  );
}
