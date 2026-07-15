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
  fetchFwisClaimByNumbers,
  importClaimFromFwis,
  pushFwisDecision,
} from '@/lib/fwis/client';
export {
  fwisRecordsToFormImport,
  type FwisFormImport,
} from '@/lib/fwis/to-form';
export type {
  FwisClaimRecord,
  FwisConnectionStatus,
  FwisDecisionPayload,
  FwisIntakeBundle,
  FwisPolicyRecord,
  FwisRequestResult,
} from '@/lib/fwis/types';
