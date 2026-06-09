'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Session = {
  authenticated: boolean;
  email?: string;
  role?: string;
};

export function AuthNav() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then(setSession)
      .catch(() => setSession({ authenticated: false }));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession({ authenticated: false });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="nav-auth">
      {session?.authenticated ? (
        <>
          {session.role === 'supervisor' && (
            <Link href="/admin/knowledge">AI Knowledge</Link>
          )}
          <span className="nav-role">{session.role}</span>
          <button type="button" className="link-button" onClick={handleLogout}>
            Sign out
          </button>
        </>
      ) : (
        <Link href="/login">Sign in</Link>
      )}
    </div>
  );
}