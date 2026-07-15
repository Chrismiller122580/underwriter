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
);

CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_policy_number
  ON claims ((lower(policy_information->>'policyNumber')));

-- Optional: open adjuster information request checklist
-- ALTER TABLE claims ADD COLUMN IF NOT EXISTS info_request JSONB;

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  hits INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);