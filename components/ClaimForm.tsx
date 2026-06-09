'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  FILE_FIELD_LABELS,
  FILE_FIELDS,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/parse-claim-form';
import { FileInput } from './FileInput';

const USE_BLOB_UPLOAD = process.env.NEXT_PUBLIC_USE_BLOB_UPLOAD === 'true';

type FieldErrors = Record<string, string>;

function validateForm(formData: FormData, files: Record<string, File | null>): FieldErrors {
  const errors: FieldErrors = {};

  const required = [
    'policyNumber',
    'coverageDetails',
    'policyEffectiveDate',
    'policyExpirationDate',
    'vin',
    'make',
    'model',
    'year',
    'odometerReading',
    'name',
    'contactInformation',
    'relationshipToVehicle',
    'dateOfLoss',
    'descriptionOfIncident',
    'locationOfIncident',
    'repairEstimate',
    'detailedRepairDescription',
    'repairShopInformation',
  ];

  for (const field of required) {
    const value = formData.get(field);
    if (!value || String(value).trim() === '') {
      errors[field] = 'This field is required.';
    }
  }

  const effective = formData.get('policyEffectiveDate');
  const expiration = formData.get('policyExpirationDate');
  if (effective && expiration && String(expiration) <= String(effective)) {
    errors.policyExpirationDate = 'Expiration date must be after effective date.';
  }

  const repairEstimate = Number(formData.get('repairEstimate'));
  if (formData.get('repairEstimate') && repairEstimate <= 0) {
    errors.repairEstimate = 'Repair estimate must be greater than zero.';
  }

  const year = Number(formData.get('year'));
  if (formData.get('year') && (year < 1900 || year > 2100)) {
    errors.year = 'Enter a valid vehicle year.';
  }

  for (const field of FILE_FIELDS) {
    const file = files[field];
    if (!file) {
      errors[field] = 'A file is required.';
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors[field] = 'File must be 10 MB or smaller.';
    }
  }

  return errors;
}

function formDataToPayload(formData: FormData) {
  return Object.fromEntries(
    Array.from(formData.entries()).filter(([, value]) => typeof value === 'string')
  );
}

async function submitWithBlobUpload(
  formData: FormData,
  files: Record<string, File | null>,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const documents: Record<string, string> = {};
  const totalFiles = FILE_FIELDS.length;

  for (let i = 0; i < FILE_FIELDS.length; i++) {
    const field = FILE_FIELDS[i];
    const file = files[field];
    if (!file) throw new Error(`Missing file: ${field}`);

    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
    });

    documents[field] = blob.url;
    onProgress(Math.round(((i + 1) / totalFiles) * 85));
  }

  const payload = {
    ...formDataToPayload(formData),
    documents,
  };

  const response = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [files, setFiles] = useState<Record<string, File | null>>(
    Object.fromEntries(FILE_FIELDS.map((f) => [f, null]))
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const validationErrors = validateForm(formData, files);

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
        ? await submitWithBlobUpload(formData, files, setProgress)
        : await submitWithProgress(formData, setProgress);

      if (!result.ok) {
        const body = result.body as { error?: string };
        throw new Error(body.error ?? 'Submission failed');
      }

      setProgress(100);
      setMessage({ type: 'success', text: 'Claim submitted successfully. Redirecting…' });
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
      <section className="form-section">
        <h2>Policy Information</h2>
        <div className="form-grid">
          <FormField label="Policy Number" name="policyNumber" error={errors.policyNumber} />
          <FormField label="Coverage Details" name="coverageDetails" error={errors.coverageDetails} />
          <FormField label="Policy Effective Date" name="policyEffectiveDate" type="date" error={errors.policyEffectiveDate} />
          <FormField label="Policy Expiration Date" name="policyExpirationDate" type="date" error={errors.policyExpirationDate} />
        </div>
      </section>

      <section className="form-section">
        <h2>Vehicle Information</h2>
        <div className="form-grid">
          <FormField label="VIN" name="vin" error={errors.vin} />
          <FormField label="Make" name="make" error={errors.make} />
          <FormField label="Model" name="model" error={errors.model} />
          <FormField label="Year" name="year" type="number" error={errors.year} />
          <FormField label="Odometer Reading" name="odometerReading" type="number" error={errors.odometerReading} />
        </div>
      </section>

      <section className="form-section">
        <h2>Claimant Information</h2>
        <div className="form-grid">
          <FormField label="Name" name="name" error={errors.name} />
          <FormField label="Contact Information" name="contactInformation" error={errors.contactInformation} />
          <FormField label="Relationship to Vehicle" name="relationshipToVehicle" error={errors.relationshipToVehicle} />
        </div>
      </section>

      <section className="form-section">
        <h2>Incident Details</h2>
        <FormField label="Date of Loss" name="dateOfLoss" type="date" error={errors.dateOfLoss} />
        <FormField label="Description of the Incident" name="descriptionOfIncident" type="textarea" error={errors.descriptionOfIncident} />
        <FormField label="Location of Incident" name="locationOfIncident" error={errors.locationOfIncident} />
      </section>

      <section className="form-section">
        <h2>Repair Information</h2>
        <FormField label="Repair Estimate ($)" name="repairEstimate" type="number" error={errors.repairEstimate} />
        <FormField label="Detailed Repair Description" name="detailedRepairDescription" type="textarea" error={errors.detailedRepairDescription} />
        <FormField label="Repair Shop Information" name="repairShopInformation" error={errors.repairShopInformation} />
      </section>

      <section className="form-section">
        <h2>Supporting Documentation</h2>
        <p className="form-hint">Each file must be 10 MB or smaller.</p>
        <div className="form-grid">
          {FILE_FIELDS.map((field) => (
            <FileInput
              key={field}
              id={field}
              name={field}
              label={FILE_FIELD_LABELS[field]}
              required
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
  error,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
}) {
  const id = name;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea id={id} name={name} required className={error ? 'input-error' : undefined} />
      ) : (
        <input
          type={type}
          id={id}
          name={name}
          required
          className={error ? 'input-error' : undefined}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}