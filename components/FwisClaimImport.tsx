'use client';

import { FormEvent, useState } from 'react';
import type { ContractType, ContractVariant } from '@/lib/contracts/types';
import type { ExtractableField } from '@/lib/extract-claim';

export type FwisImportResult = {
  fields: Partial<Record<ExtractableField, string>>;
  fieldsFound: string[];
  contractType: ContractType | 'unknown';
  contractVariant: ContractVariant;
  fwisClaimId: string | null;
  fwisContractNumber: string;
  fwisClaimNumber: string;
  warnings: string[];
};

type FwisClaimImportProps = {
  disabled?: boolean;
  onImported: (result: FwisImportResult) => void;
};

/**
 * Primary claim intake path: load contract + claim from FWIS.
 * Supersedes portal screenshot autofill when the API is available.
 */
export function FwisClaimImport({ disabled, onImported }: FwisClaimImportProps) {
  const [contractNumber, setContractNumber] = useState('');
  const [claimNumber, setClaimNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [lastMeta, setLastMeta] = useState<{
    fwisClaimId: string | null;
    warnings: string[];
  } | null>(null);

  async function handleImport(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setLastMeta(null);

    try {
      const response = await fetch('/api/fwis/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractNumber: contractNumber.trim(),
          claimNumber: claimNumber.trim(),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        form?: FwisImportResult;
        bundle?: { errors?: string[] };
      };

      if (!response.ok || !data.form) {
        const extra = data.bundle?.errors?.length
          ? ` ${data.bundle.errors.join(' · ')}`
          : '';
        throw new Error((data.error ?? 'Import failed') + extra);
      }

      onImported(data.form);
      setLastMeta({
        fwisClaimId: data.form.fwisClaimId,
        warnings: data.form.warnings ?? [],
      });
      setMessage({
        type: 'success',
        text: `Loaded ${data.form.fieldsFound.length} fields from FWIS (claim ${data.form.fwisClaimNumber}). Review and submit — screenshots are not required.`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'FWIS import failed',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-section fwis-import-section">
      <div className="fwis-import-header">
        <div>
          <p className="badge">Primary intake · Freedom FWIS</p>
          <h2>Import from FWIS</h2>
          <p className="form-hint">
            Enter the <strong>contract number</strong> and{' '}
            <strong>claim number</strong> from Freedom Warranty. Live API data
            fills the form and replaces portal screenshot autofill.
          </p>
        </div>
      </div>

      <form className="fwis-import-form" onSubmit={handleImport}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="fwis-contract">Contract / policy number</label>
            <input
              id="fwis-contract"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value.toUpperCase())}
              placeholder="e.g. FWVL041518"
              required
              disabled={disabled || loading}
              autoComplete="off"
            />
          </div>
          <div className="form-field">
            <label htmlFor="fwis-claim">Claim number</label>
            <input
              id="fwis-claim"
              value={claimNumber}
              onChange={(e) => setClaimNumber(e.target.value)}
              placeholder="FWIS claim number"
              required
              disabled={disabled || loading}
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="submit"
          className="button"
          disabled={
            disabled ||
            loading ||
            !contractNumber.trim() ||
            !claimNumber.trim()
          }
        >
          {loading ? 'Loading from FWIS…' : 'Load claim from FWIS'}
        </button>
      </form>

      {message && (
        <p
          className={
            message.type === 'success'
              ? 'form-success'
              : message.type === 'error'
                ? 'form-error'
                : 'form-hint'
          }
        >
          {message.text}
        </p>
      )}

      {lastMeta?.fwisClaimId && (
        <p className="form-hint">
          FWIS claim id: <code>{lastMeta.fwisClaimId}</code>
        </p>
      )}

      {lastMeta?.warnings && lastMeta.warnings.length > 0 && (
        <ul className="fwis-import-warnings">
          {lastMeta.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
