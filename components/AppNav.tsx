'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Session = {
  authenticated: boolean;
  email?: string;
  role?: 'adjuster' | 'supervisor';
};

type NavItem = {
  href: string;
  label: string;
};

const PUBLIC_LINKS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/submit', label: 'Submit Claim' },
];

const STAFF_LINKS: NavItem[] = [{ href: '/claims', label: 'Dashboard' }];

const SUPERVISOR_LINKS: NavItem[] = [
  { href: '/admin/toolbox', label: 'Supervisor Toolbox' },
];

function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setSessionLoaded(false);
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then(setSession)
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setSessionLoaded(true));
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession({ authenticated: false });
    router.push('/');
    router.refresh();
  }

  const isAuthenticated = Boolean(session?.authenticated);
  const isSupervisor = session?.role === 'supervisor';
  const isPublicHome = pathname === '/';
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return null;
  }

  if (isPublicHome && sessionLoaded && !isAuthenticated) {
    return null;
  }

  const visibleLinks = [
    ...PUBLIC_LINKS.filter(
      (item) => !(isPublicHome && item.href === '/')
    ),
    ...(isAuthenticated ? STAFF_LINKS : []),
    ...(isSupervisor ? SUPERVISOR_LINKS : []),
  ];

  function renderLink(item: NavItem) {
    const active = isActivePath(item.href, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={active ? 'nav-link active' : 'nav-link'}
        aria-current={active ? 'page' : undefined}
      >
        {item.label}
      </Link>
    );
  }

  const loginHref = pathname.startsWith('/admin')
    ? '/login?next=/admin/toolbox&role=supervisor'
    : '/login';

  return (
    <header className="app-header">
      <div className="nav-inner">
        <Link href="/" className="nav-brand" aria-label="FWCUT home">
          <span className="nav-brand-mark">FW</span>
          <span className="nav-brand-text">CUT Underwriter</span>
        </Link>

        <button
          type="button"
          className="nav-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-menu-bar" />
          <span className="nav-menu-bar" />
          <span className="nav-menu-bar" />
          <span className="sr-only">Toggle navigation</span>
        </button>

        <div className="nav-desktop">
          <nav className="nav-links" aria-label="Primary">
            {visibleLinks.map(renderLink)}
          </nav>

          <div className="nav-auth">
            {isAuthenticated ? (
              <>
                <span
                  className={
                    isSupervisor ? 'nav-role nav-role-supervisor' : 'nav-role'
                  }
                >
                  {session?.role}
                </span>
                <button
                  type="button"
                  className="nav-signout"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href={loginHref}
                className={
                  isActivePath('/login', pathname) ? 'nav-link active' : 'nav-link'
                }
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav
        id="primary-navigation"
        className={menuOpen ? 'nav-mobile open' : 'nav-mobile'}
        aria-label="Primary mobile"
      >
        <div className="nav-mobile-inner">
          <div className="nav-links">{visibleLinks.map(renderLink)}</div>
          <div className="nav-auth">
            {isAuthenticated ? (
              <>
                <span
                  className={
                    isSupervisor ? 'nav-role nav-role-supervisor' : 'nav-role'
                  }
                >
                  {session?.role}
                </span>
                <button
                  type="button"
                  className="nav-signout"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href={loginHref}
                className={
                  isActivePath('/login', pathname) ? 'nav-link active' : 'nav-link'
                }
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}