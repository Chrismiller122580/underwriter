'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { writeLoginBanner } from '@/lib/login-banner';

type LoginRole = 'adjuster' | 'supervisor';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /** Shared-password bootstrap only. adjuster === reviewer in the product. */
  const [role, setRole] = useState<LoginRole>('supervisor');
  const [useSharedPassword, setUseSharedPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: useSharedPassword ? '' : email.trim(),
          password: password.trim(),
          // Named users: role comes from DB. Shared password: send chosen role.
          ...(useSharedPassword ? { role } : {}),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        role?: LoginRole;
        name?: string;
        email?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Invalid credentials');
      }

      if (data.role === 'adjuster' || data.role === 'supervisor') {
        writeLoginBanner({
          role: data.role,
          name: data.name,
          email: data.email,
          at: Date.now(),
        });
      }

      // Supervisors land in the toolbox unless they asked for a specific next page.
      // Claim detail deep-links always honor `next`.
      const destination =
        data.role === 'supervisor' &&
        (redirectTo === '/claims' ||
          redirectTo === '/' ||
          redirectTo === '/admin/knowledge')
          ? '/admin/toolbox'
          : redirectTo;

      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please try again.'
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      <p className="form-hint">
        Sign in with your staff email and password. Seeded defaults use{' '}
        <code>adjuster@fwcut.local</code> (Reviewer) /{' '}
        <code>supervisor@fwcut.local</code>. Reviewer = claim underwriting.
        Supervisor = underwriting <strong>plus</strong> Admin Tools. Role comes
        from your account — not a toggle — unless you use the shared password
        option below.
      </p>

      {!useSharedPassword && (
        <div className="form-field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={!useSharedPassword}
            autoComplete="username"
            placeholder="you@company.com"
          />
        </div>
      )}

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <label className="login-shared-toggle">
        <input
          type="checkbox"
          checked={useSharedPassword}
          onChange={(e) => {
            setUseSharedPassword(e.target.checked);
            setError(null);
          }}
        />{' '}
        Use shared role password (legacy bootstrap)
      </label>

      {useSharedPassword && (
        <>
          <div className="login-role-toggle" role="group" aria-label="Sign in as">
            <button
              type="button"
              className={role === 'adjuster' ? 'login-role active' : 'login-role'}
              onClick={() => {
                setRole('adjuster');
                setError(null);
              }}
            >
              Reviewer
            </button>
            <button
              type="button"
              className={
                role === 'supervisor' ? 'login-role active' : 'login-role'
              }
              onClick={() => {
                setRole('supervisor');
                setError(null);
              }}
            >
              Supervisor
            </button>
          </div>
          <p className="form-hint">
            Matches <code>ADJUSTER_PASSWORD</code> /{' '}
            <code>SUPERVISOR_PASSWORD</code> when named users are unavailable.
            <strong> Reviewer</strong> = claim underwriting (adjuster). Choose{' '}
            <strong>Supervisor</strong> for Admin Tools.
          </p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="button" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
