export {
  getFwisConfig,
  isFwisConfigured,
  fillPath,
  type FwisConfig,
} from '@/lib/fwis/config';
export {
  checkFwisConnection,
  fetchFwisPolicy,
  fetchFwisClaim,
  pushFwisDecision,
} from '@/lib/fwis/client';
export type {
  FwisClaimRecord,
  FwisConnectionStatus,
  FwisDecisionPayload,
  FwisPolicyRecord,
  FwisRequestResult,
} from '@/lib/fwis/types';
