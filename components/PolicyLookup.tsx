'use client';

import { useState } from 'react';
import { CONTRACT_TYPES, type ContractType } from '@/lib/contracts/types';
import { getContractDisplayName } from '@/lib/contracts/registry';

type LookupResult = {
  valid: boolean;
  contractType: ContractType | 'unknown';
  variant: 'standard' | 'manufacturer_extension';
  displayName: string | null;
  prefix: string | null;
  accountId: string | null;
  coverageDetails?: string;
  vehicle?: {
    vin?: string;
    make?: string;
    model?: string;
    year?: number;
    odometerReading?: number;
  };
};

type PolicyLookupProps = {
  policyNumber: string;
  contractType: ContractType | 'unknown';
  onPolicyNumberChange: (value: string) => void;
  onContractTypeChange: (type: ContractType | 'unknown') => void;
  onLookupResult: (result: LookupResult) => void;
  disabled?: boolean;
};

export function PolicyLookup({
  policyNumber,
  contractType,
  onPolicyNumberChange,
  onContractTypeChange,
  onLookupResult,
  disabled,
}: PolicyLookupProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [detected, setDetected] = useState<LookupResult | null>(null);

  async function handleLookup() {
    if (!policyNumber.trim()) {
      setMessage({ type: 'error', text: 'Enter a policy number first.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/claims/lookup-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyNumber: policyNumber.trim() }),
      });

      const data = (await response.json()) as LookupResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Lookup failed');
      }

      setDetected(data);
      onLookupResult(data);

      if (data.valid && data.contractType !== 'unknown') {
        onContractTypeChange(data.contractType);
        setMessage({
          type: 'success',
          text: `Identified ${data.displayName ?? data.contractType} from prefix ${data.prefix}. Vehicle and remaining fields can be filled via screenshot or manually.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Unrecognized policy number. Expected prefix FWCL, FWVL, FWDR, FWCP, or FWCPM.',
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lookup failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-section policy-lookup">
      <h2>Policy Lookup</h2>
      <p className="form-hint">
        Enter the contract/policy number (e.g. FWVL041518). The prefix identifies
        the contract type — no policy document upload needed.
      </p>

      <div className="policy-lookup-row">
        <div className="form-field" style={{ flex: 1 }}>
          <label htmlFor="policyNumber">Policy / Contract Number</label>
          <input
            id="policyNumber"
            name="policyNumber"
            type="text"
            value={policyNumber}
            required
            disabled={disabled || loading}
            placeholder="FWVL041518"
            onChange={(e) => {
              onPolicyNumberChange(e.target.value);
              setDetected(null);
              setMessage(null);
            }}
          />
        </div>
        <button
          type="button"
          className="button"
          disabled={disabled || loading || !policyNumber.trim()}
          onClick={handleLookup}
        >
          {loading ? 'Looking up…' : 'Look Up Policy'}
        </button>
      </div>

      <div className="form-field">
        <label htmlFor="contractType">Contract Type</label>
        <select
          id="contractType"
          value={contractType}
          disabled={disabled}
          onChange={(e) => {
            onContractTypeChange(e.target.value as ContractType | 'unknown');
            setDetected(null);
          }}
        >
          <option value="unknown">Unknown — select manually</option>
          {CONTRACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {getContractDisplayName(type)}
            </option>
          ))}
        </select>
      </div>

      {detected?.valid && detected.displayName && (
        <p className="contract-detected-badge">
          {detected.displayName}
          {detected.variant === 'manufacturer_extension' && (
            <span className="contract-variant-tag">Mfr Extension</span>
          )}
        </p>
      )}

      {message && (
        <p
          className={
            message.type === 'error'
              ? 'form-error'
              : message.type === 'success'
                ? 'form-success'
                : 'form-hint'
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}