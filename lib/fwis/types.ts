/**
 * Normalized FWIS shapes. Real API fields will be mapped into these
 * in `mappers.ts` once Freedom shares the response schema.
 */

export type FwisConnectionStatus = {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  authStyle: string;
  pushDecisions: boolean;
  /** true when a health (or probe) request succeeded */
  reachable: boolean | null;
  message: string;
  checkedAt: string;
  httpStatus?: number;
  pathTried?: string;
};

/** Policy / contract record as we want it inside FWCUT */
export type FwisPolicyRecord = {
  policyNumber: string;
  contractType?: string | null;
  contractVariant?: string | null;
  status?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  coverageDetails?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  odometerAtEffective?: number | null;
  raw?: unknown;
};

/** Claim record pulled from FWIS */
export type FwisClaimRecord = {
  fwisClaimId: string;
  /** Human-facing claim number (may equal fwisClaimId) */
  claimNumber?: string | null;
  policyNumber?: string | null;
  status?: string | null;
  claimantName?: string | null;
  contact?: string | null;
  relationship?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  odometer?: number | null;
  odometerAtEffective?: number | null;
  dateOfLoss?: string | null;
  description?: string | null;
  location?: string | null;
  repairEstimate?: number | null;
  repairDescription?: string | null;
  shop?: string | null;
  raw?: unknown;
};

/** Full import package for claim intake (supersedes screenshot autofill). */
export type FwisIntakeBundle = {
  contractNumber: string;
  claimNumber: string;
  policy: FwisPolicyRecord | null;
  claim: FwisClaimRecord | null;
  /** True when at least one remote payload was returned */
  loaded: boolean;
  errors: string[];
};

export type FwisDecisionPayload = {
  fwisClaimId?: string;
  localClaimId: string;
  trackingCode?: string;
  decision: 'approved' | 'denied' | 'under_review' | 'needs_info' | string;
  reason: string;
  source: 'ai' | 'manual' | 'rules' | string;
  decidedBy?: string;
  decidedAt: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
};

export type FwisRequestResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      status: number;
      error: string;
      /** true when path/endpoint not found — config may need updating */
      notFound?: boolean;
      bodyPreview?: string;
    };
