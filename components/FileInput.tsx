'use client';

type FileInputProps = {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  /** Shown under the control when files are already selected / attached. */
  selectedSummary?: string;
  onChange: (files: File[]) => void;
};

export function FileInput({
  id,
  name,
  label,
  required,
  multiple = false,
  disabled = false,
  error,
  hint,
  selectedSummary,
  onChange,
}: FileInputProps) {
  return (
    <div
      className={`form-field file-input-field${error ? ' has-error' : ''}${
        disabled ? ' is-disabled' : ''
      }`}
    >
      <label htmlFor={id}>{label}</label>
      {hint && <p className="file-input-hint">{hint}</p>}
      <input
        type="file"
        id={id}
        name={name}
        required={required}
        multiple={multiple}
        disabled={disabled}
        className={error ? 'input-error' : undefined}
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          onChange(list);
        }}
      />
      {selectedSummary && (
        <span className="file-input-selected">{selectedSummary}</span>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
