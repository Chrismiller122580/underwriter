'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
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
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Invalid password');
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Invalid password. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
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

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="button" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}