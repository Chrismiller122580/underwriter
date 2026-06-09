import Link from 'next/link';
import { AuthNav } from './AuthNav';

export function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        FWCUT
      </Link>
      <div className="nav-links">
        <Link href="/submit">Submit Claim</Link>
        <Link href="/claims">Dashboard</Link>
        <AuthNav />
      </div>
    </nav>
  );
}