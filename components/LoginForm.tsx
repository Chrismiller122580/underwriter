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
  const [role, setRole] = useState<LoginRole>(defaultRole);
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ password: password.trim(), role }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        role?: LoginRole;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Invalid password');
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
        err instanceof Error ? err.message : 'Invalid password. Please try again.'
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
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
          className={role === 'supervisor' ? 'login-role active' : 'login-role'}
          onClick={() => {
            setRole('supervisor');
            setError(null);
          }}
        >
          Supervisor
        </button>
      </div>

      <p className="form-hint">
        {role === 'supervisor'
          ? 'Supervisor access includes AI knowledge uploads and full underwriting tools.'
          : 'Adjuster access includes the claims dashboard and underwriting tools.'}
      </p>

      <div className="form-field">
        <label htmlFor="password">
          {role === 'supervisor' ? 'Supervisor password' : 'Adjuster password'}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="button" disabled={loading}>
        {loading
          ? 'Signing in…'
          : role === 'supervisor'
            ? 'Sign in as Supervisor'
            : 'Sign in as Adjuster'}
      </button>
    </form>
  );
}