'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: 'adjuster' | 'supervisor';
  active: boolean;
  createdAt: string;
};

export function UserManager() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'adjuster' | 'supervisor'>('adjuster');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = (await response.json()) as { users: StaffUser[] };
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? 'Create failed');
      setMessage(`Created ${email}`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('adjuster');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, active: !user.active }),
      });
      if (!response.ok) throw new Error('Update failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <section className="user-manager">
      <div className="toolbox-card">
        <h3>Staff users</h3>
        <p className="form-hint">
          Named accounts for adjusters and supervisors. Seeded defaults use env
          passwords on first boot.
        </p>
        {loading && <p className="claim-panel-meta">Loading…</p>}
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        {!loading && users.length > 0 && (
          <div className="toolbox-table-wrap">
            <table className="toolbox-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.active ? 'Active' : 'Disabled'}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => void toggleActive(user)}
                      >
                        {user.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="toolbox-card">
        <h3>Add user</h3>
        <form className="user-create-form" onSubmit={handleCreate}>
          <div className="form-field">
            <label htmlFor="user-name">Name</label>
            <input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="user-email">Email</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="user-role">Role</label>
            <select
              id="user-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'adjuster' | 'supervisor')
              }
            >
              <option value="adjuster">Adjuster</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="user-password">Temporary password</label>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="button button-sm" disabled={saving}>
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>
    </section>
  );
}
