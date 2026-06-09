import { defaultCoverageDetails, parsePolicyNumber } from '@/lib/contracts/policy-patterns';
import type { PolicyLookupResult } from '@/lib/contracts/types';

export function lookupPolicy(policyNumber: string): PolicyLookupResult {
  const parsed = parsePolicyNumber(policyNumber);

  if (!parsed.valid) {
    return { ...parsed };
  }

  return {
    ...parsed,
    coverageDetails: defaultCoverageDetails(parsed),
    // Vehicle data from portal/DB integration — phase 2
  };
}