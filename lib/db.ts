import { neon } from '@neondatabase/serverless';

let sqlClient: ReturnType<typeof neon> | null = null;
let schemaReady = false;

export function getSql() {
  if (!sqlClient) {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      throw new Error(
        'POSTGRES_URL is not set. Add Vercel Postgres or copy .env.example to .env.local'
      );
    }
    sqlClient = neon(url);
  }
  return sqlClient;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_information JSONB NOT NULL,
      vehicle_info JSONB NOT NULL,
      claimant_information JSONB NOT NULL,
      incident_details JSONB NOT NULL,
      repair_information JSONB NOT NULL,
      claim_details JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      underwriting JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id TEXT PRIMARY KEY,
      hits INT NOT NULL DEFAULT 1,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_analysis JSONB
  `;

  schemaReady = true;
}