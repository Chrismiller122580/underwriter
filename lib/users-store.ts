import { ensureSchema, getSql } from '@/lib/db';
import type { UserRole } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  active: boolean;
  created_at: string;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listUsers(): Promise<UserRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, role, password_hash, active, created_at
    FROM users
    ORDER BY created_at ASC
  `) as UserRow[];
  return rows.map(mapUser);
}

export async function findUserByEmail(
  email: string
): Promise<(UserRecord & { passwordHash: string }) | null> {
  await ensureSchema();
  const sql = getSql();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const rows = (await sql`
    SELECT id, email, name, role, password_hash, active, created_at
    FROM users
    WHERE lower(email) = ${normalized}
    LIMIT 1
  `) as UserRow[];

  if (rows.length === 0) return null;
  const row = rows[0];
  return { ...mapUser(row), passwordHash: row.password_hash };
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<UserRecord | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.active) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}): Promise<UserRecord> {
  await ensureSchema();
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new Error('Email and name are required');
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const passwordHash = hashPassword(input.password);
  const rows = (await sql`
    INSERT INTO users (email, name, role, password_hash, active)
    VALUES (
      ${email},
      ${name},
      ${input.role},
      ${passwordHash},
      true
    )
    RETURNING id, email, name, role, password_hash, active, created_at
  `) as UserRow[];

  return mapUser(rows[0]);
}

export async function setUserActive(
  id: string,
  active: boolean
): Promise<UserRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE users
    SET active = ${active}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id, email, name, role, password_hash, active, created_at
  `) as UserRow[];
  if (rows.length === 0) return null;
  return mapUser(rows[0]);
}

export async function countUsers(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT COUNT(*)::int AS count FROM users`) as {
    count: number;
  }[];
  return rows[0]?.count ?? 0;
}

/**
 * Seed default staff accounts from env passwords when the users table is empty.
 * Safe to call repeatedly — only inserts when count is 0.
 */
export async function seedDefaultUsersIfEmpty(): Promise<void> {
  const count = await countUsers();
  if (count > 0) return;

  const adjusterPassword = process.env.ADJUSTER_PASSWORD?.trim();
  const supervisorPassword =
    process.env.SUPERVISOR_PASSWORD?.trim() || adjusterPassword;

  if (!adjusterPassword) {
    logger.warn('No users seeded — set ADJUSTER_PASSWORD to bootstrap accounts');
    return;
  }

  try {
    await createUser({
      email: 'adjuster@fwcut.local',
      name: 'Default Adjuster',
      role: 'adjuster',
      password: adjusterPassword,
    });
    if (supervisorPassword) {
      await createUser({
        email: 'supervisor@fwcut.local',
        name: 'Default Supervisor',
        role: 'supervisor',
        password: supervisorPassword,
      });
    }
    logger.info('Seeded default staff users from env passwords');
  } catch (error) {
    logger.error('Failed to seed default users', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
