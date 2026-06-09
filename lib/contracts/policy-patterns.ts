import {
  getContractDisplayName,
  POLICY_PREFIXES,
} from './registry';
import type { ParsedPolicyNumber } from './types';

export function normalizePolicyNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function parsePolicyNumber(input: string): ParsedPolicyNumber {
  const normalized = normalizePolicyNumber(input);

  if (!normalized) {
    return {
      valid: false,
      contractType: 'unknown',
      variant: 'standard',
      displayName: null,
      prefix: null,
      accountId: null,
      confidence: 0,
      source: 'policy_number',
    };
  }

  for (const entry of POLICY_PREFIXES) {
    if (normalized.startsWith(entry.prefix)) {
      const accountId = normalized.slice(entry.prefix.length) || null;
      return {
        valid: true,
        contractType: entry.type,
        variant: entry.variant,
        displayName: entry.label,
        prefix: entry.prefix,
        accountId,
        confidence: 1,
        source: 'policy_number',
      };
    }
  }

  return {
    valid: false,
    contractType: 'unknown',
    variant: 'standard',
    displayName: null,
    prefix: null,
    accountId: null,
    confidence: 0,
    source: 'policy_number',
  };
}

export function defaultCoverageDetails(parsed: ParsedPolicyNumber): string {
  if (!parsed.valid || parsed.contractType === 'unknown') return '';
  return getContractDisplayName(parsed.contractType, parsed.variant);
}