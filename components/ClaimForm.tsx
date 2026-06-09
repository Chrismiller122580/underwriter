'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { ContractType } from '@/lib/contracts/types';
import {
  EXTRACTABLE_FIELDS,
  type ExtractableField,
} from '@/lib/extract-claim';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/parse-claim-form';
import { FileInput } from './FileInput';
import { PolicyLookup } from './PolicyLookup';
import { ScreenshotAutofill } from './ScreenshotAutofill';

const USE_BLOB_UPLOAD = process.env.NEXT_PUBLIC_USE_BLOB_UPLOAD === 'true';

type FormValues = Record<ExtractableField, string>;
type FieldErrors = Partial<Record<ExtractableField | (typeof FILE_FIELDS)[number], string>>;

const EMPTY_VALUES = Object.fromEntries(
  EXTRACTABLE_FIELDS.map((f) => [f, ''])
) as FormValues;

const VEHICLE_FIELDS: ExtractableField[] = [
  'vin',
  'make',
  'model',
  'year',
  'odometerReading',
];

function validateForm(
  values: FormValues,
  files: Record<string, File | null>,
  contractType: ContractType | 'unknown'
): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of EXTRACTABLE_FIELDS) {
    if (!values[field]?.trim()) {
      errors[field] = 'This field is required.';
    }
  }

  if (contractType === 'unknown') {
    errors.policyNumber = 'Look up or select a valid contract type.';
  }

  if (
    values.policyExpirationDate &&
    values.policyEffectiveDate &&
    values.policyExpirationDate <= values.policyEffectiveDate
  ) {
    errors.policyExpirationDate = 'Expiration date must be after effective date.';
  }

  const repairEstimate = Number(values.repairEstimate);
  if (values.repairEstimate && repairEstimate <= 0) {
    errors.repairEstimate = 'Repair estimate must be greater than zero.';
  }

  const year = Number(values.year);
  if (values.year && (year < 1900 || year > 2100)) {
    errors.year = 'Enter a valid vehicle year.';
  }

  for (const field of FILE_FIELDS) {
    const file = files[field];
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      errors[field] = 'File must be 10 MB or smaller.';
    }
  }

  return errors;
}

function buildFormData(
  values: FormValues,
  files: Record<string, File | null>,
  contractType: ContractType | 'unknown',
  contractVariant: 'standard' | 'manufacturer_extension'
): FormData {
  const formData = new FormData();
  for (const field of EXTRACTABLE_FIELDS) {
    formData.append(field, values[field]);
  }
  formData.append('contractType', contractType);
  formData.append('contractVariant', contractVariant);
  for (const field of FILE_FIELDS) {
    const file = files[field];
    if (file) formData.append(field, file);
  }
  return formData;
}

async function submitWithBlobUpload(
  values: FormValues,
  files: Record<string, File | null>,
  contractType: ContractType | 'unknown',
  contractVariant: 'standard' | 'manufacturer_extension',
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const documents: Record<string, string> = {};
  const fieldsWithFiles = FILE_FIELDS.filter((field) => files[field]);

  for (let i = 0; i < fieldsWithFiles.length; i++) {
    const field = fieldsWithFiles[i];
    const file = files[field]!;

    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
    });

    documents[field] = blob.url;
    onProgress(
      fieldsWithFiles.length > 0
        ? Math.round(((i + 1) / fieldsWithFiles.length) * 85)
        : 85
    );
  }

  const response = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...values,
      contractType,
      contractVariant,
      documents,
    }),
  });

  onProgress(100);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function submitWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/claims');

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      let body: unknown = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { error: xhr.responseText || 'Submission failed' };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.send(formData);
  });
}

export function ClaimForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [contractType, setContractType] = useState<ContractType | 'unknown'>('unknown');
  const [contractVariant, setContractVariant] = useState<
    'standard' | 'manufacturer_extension'
  >('standard');
  const [autofilled, setAutofilled] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [files, setFiles] = useState<Record<string, File | null>>(
    Object.fromEntries(FILE_FIELDS.map((f) => [f, null]))
  );

  function updateField(name: ExtractableField, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setAutofilled((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  function handleAutofill(
    fields: Partial<Record<ExtractableField, string>>,
    meta: { fieldsFound: string[] }
  ) {
    setValues((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(fields)) {
        if (value) next[key as ExtractableField] = value;
      }
      return next;
    });
    setAutofilled(
      (prev) => new Set([...Array.from(prev), ...meta.fieldsFound])
    );
    setErrors({});
  }

  function handleLookupResult(result: {
    valid: boolean;
    contractType: ContractType | 'unknown';
    variant: 'standard' | 'manufacturer_extension';
    coverageDetails?: string;
    vehicle?: {
      vin?: string;
      make?: string;
      model?: string;
      year?: number;
      odometerReading?: number;
    };
  }) {
    if (result.valid && result.contractType !== 'unknown') {
      setContractVariant(result.variant);
    }

    setValues((prev) => {
      const next = { ...prev };
      if (result.coverageDetails) {
        next.coverageDetails = result.coverageDetails;
      }
      if (result.vehicle) {
        if (result.vehicle.vin) next.vin = result.vehicle.vin;
        if (result.vehicle.make) next.make = result.vehicle.make;
        if (result.vehicle.model) next.model = result.vehicle.model;
        if (result.vehicle.year) next.year = String(result.vehicle.year);
        if (result.vehicle.odometerReading != null) {
          next.odometerReading = String(result.vehicle.odometerReading);
        }
      }
      return next;
    });

    const filled = new Set<string>();
    if (result.coverageDetails) filled.add('coverageDetails');
    for (const field of VEHICLE_FIELDS) {
      if (result.vehicle) {
        const key = field as keyof typeof result.vehicle;
        if (result.vehicle[key] != null) filled.add(field);
      }
    }
    if (filled.size > 0) {
      setAutofilled((prev) => new Set([...Array.from(prev), ...Array.from(filled)]));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validationErrors = validateForm(values, files, contractType);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    setErrors({});
    setSubmitting(true);
    setProgress(0);

    try {
      const result = USE_BLOB_UPLOAD
        ? await submitWithBlobUpload(
            values,
            files,
            contractType,
            contractVariant,
            setProgress
          )
        : await submitWithProgress(
            buildFormData(values, files, contractType, contractVariant),
            setProgress
          );

      if (!result.ok) {
        const body = result.body as { error?: string };
        throw new Error(body.error ?? 'Submission failed');
      }

      setProgress(100);
      setMessage({
        type: 'success',
        text: 'Claim submitted successfully. AI underwriting will run before approval.',
      });
      setTimeout(() => router.push('/claims'), 1200);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Submission failed. Please try again.',
      });
      setSubmitting(false);
      setProgress(0);
    }
  }

  return (
    <form className="claim-form" onSubmit={handleSubmit} noValidate>
      <PolicyLookup
        policyNumber={values.policyNumber}
        contractType={contractType}
        onPolicyNumberChange={(v) => updateField('policyNumber', v)}
        onContractTypeChange={setContractType}
        onLookupResult={handleLookupResult}
        disabled={submitting}
      />

      <ScreenshotAutofill onExtracted={handleAutofill} disabled={submitting} />

      <section className="form-section">
        <h2>Policy Information</h2>
        <div className="form-grid">
          <FormField label="Coverage Details" name="coverageDetails" value={values.coverageDetails} onChange={updateField} error={errors.coverageDetails} autofilled={autofilled.has('coverageDetails')} />
          <FormField label="Policy Effective Date" name="policyEffectiveDate" type="date" value={values.policyEffectiveDate} onChange={updateField} error={errors.policyEffectiveDate} autofilled={autofilled.has('policyEffectiveDate')} />
          <FormField label="Policy Expiration Date" name="policyExpirationDate" type="date" value={values.policyExpirationDate} onChange={updateField} error={errors.policyExpirationDate} autofilled={autofilled.has('policyExpirationDate')} />
        </div>
        {errors.policyNumber && <p className="form-error">{errors.policyNumber}</p>}
      </section>

      <section className="form-section">
        <h2>Vehicle Information</h2>
        <div className="form-grid">
          <FormField label="VIN" name="vin" value={values.vin} onChange={updateField} error={errors.vin} autofilled={autofilled.has('vin')} />
          <FormField label="Make" name="make" value={values.make} onChange={updateField} error={errors.make} autofilled={autofilled.has('make')} />
          <FormField label="Model" name="model" value={values.model} onChange={updateField} error={errors.model} autofilled={autofilled.has('model')} />
          <FormField label="Year" name="year" type="number" value={values.year} onChange={updateField} error={errors.year} autofilled={autofilled.has('year')} />
          <FormField label="Odometer Reading" name="odometerReading" type="number" value={values.odometerReading} onChange={updateField} error={errors.odometerReading} autofilled={autofilled.has('odometerReading')} />
        </div>
      </section>

      <section className="form-section">
        <h2>Claimant Information</h2>
        <div className="form-grid">
          <FormField label="Name" name="name" value={values.name} onChange={updateField} error={errors.name} autofilled={autofilled.has('name')} />
          <FormField label="Contact Information" name="contactInformation" value={values.contactInformation} onChange={updateField} error={errors.contactInformation} autofilled={autofilled.has('contactInformation')} />
          <FormField label="Relationship to Vehicle" name="relationshipToVehicle" value={values.relationshipToVehicle} onChange={updateField} error={errors.relationshipToVehicle} autofilled={autofilled.has('relationshipToVehicle')} />
        </div>
      </section>

      <section className="form-section">
        <h2>Incident Details</h2>
        <FormField label="Date of Loss" name="dateOfLoss" type="date" value={values.dateOfLoss} onChange={updateField} error={errors.dateOfLoss} autofilled={autofilled.has('dateOfLoss')} />
        <FormField label="Description of the Incident" name="descriptionOfIncident" type="textarea" value={values.descriptionOfIncident} onChange={updateField} error={errors.descriptionOfIncident} autofilled={autofilled.has('descriptionOfIncident')} />
        <FormField label="Location of Incident" name="locationOfIncident" value={values.locationOfIncident} onChange={updateField} error={errors.locationOfIncident} autofilled={autofilled.has('locationOfIncident')} />
      </section>

      <section className="form-section">
        <h2>Repair Information</h2>
        <FormField label="Repair Estimate ($)" name="repairEstimate" type="number" value={values.repairEstimate} onChange={updateField} error={errors.repairEstimate} autofilled={autofilled.has('repairEstimate')} />
        <FormField label="Detailed Repair Description" name="detailedRepairDescription" type="textarea" value={values.detailedRepairDescription} onChange={updateField} error={errors.detailedRepairDescription} autofilled={autofilled.has('detailedRepairDescription')} />
        <FormField label="Repair Shop Information" name="repairShopInformation" value={values.repairShopInformation} onChange={updateField} error={errors.repairShopInformation} autofilled={autofilled.has('repairShopInformation')} />
      </section>

      <section className="form-section">
        <h2>Supporting Documentation (optional)</h2>
        <p className="form-hint">
          Attach any supporting files you have — none are required at submission.
          Each file must be 10 MB or smaller. Contract type is identified from the
          policy number. If more documentation is needed, AI underwriting will
          request it and check against Freedom Warranty guidelines.
        </p>
        <div className="form-grid">
          {FILE_FIELDS.map((field) => (
            <FileInput
              key={field}
              id={field}
              name={field}
              label={FILE_FIELD_LABELS[field]}
              error={errors[field]}
              onChange={(file) => setFiles((prev) => ({ ...prev, [field]: file }))}
            />
          ))}
        </div>
      </section>

      {submitting && (
        <div className="progress-wrap">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span className="progress-label">Uploading… {progress}%</span>
        </div>
      )}

      {message && (
        <p className={message.type === 'success' ? 'form-success' : 'form-error'}>
          {message.text}
        </p>
      )}

      <button type="submit" className="button" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Claim'}
      </button>
    </form>
  );
}

function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  autofilled,
}: {
  label: string;
  name: ExtractableField;
  type?: string;
  value: string;
  onChange: (name: ExtractableField, value: string) => void;
  error?: string;
  autofilled?: boolean;
}) {
  const className = [error ? 'input-error' : '', autofilled ? 'input-autofilled' : '']
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label}
        {autofilled && <span className="autofill-tag">AI filled</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          required
          className={className}
          onChange={(e) => onChange(name, e.target.value)}
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          required
          className={className}
          onChange={(e) => onChange(name, e.target.value)}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}