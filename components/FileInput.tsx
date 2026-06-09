'use client';

type FileInputProps = {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  onChange: (file: File | null) => void;
};

export function FileInput({
  id,
  name,
  label,
  required,
  error,
  onChange,
}: FileInputProps) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        type="file"
        id={id}
        name={name}
        required={required}
        className={error ? 'input-error' : undefined}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}