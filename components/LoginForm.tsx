'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type LoginRole = 'adjuster' | 'supervisor';

export function LoginForm({
  redirectTo,
  defaultRole = 'adjuster',
}: {
  redirectTo: string;
  defaultRole?: LoginRole;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<LoginRole>(defaultRole);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useSharedPassword, setUseSharedPassword] = useState(false);

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
          role,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        role?: LoginRole;
        name?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Invalid credentials');
      }

      const destination =
        data.role === 'supervisor' &&
        (redirectTo === '/claims' || redirectTo === '/admin/knowledge')
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
        Sign in with your staff email and password. New installs seed
        adjuster@fwcut.local and supervisor@fwcut.local from env passwords.
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
              Adjuster
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
            Matches ADJUSTER_PASSWORD / SUPERVISOR_PASSWORD when named users are
            unavailable.
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
