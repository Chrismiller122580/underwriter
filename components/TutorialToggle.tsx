'use client';

type TutorialToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
};

export function TutorialToggle({
  enabled,
  onChange,
  className,
}: TutorialToggleProps) {
  return (
    <label
      className={['tutorial-toggle', className].filter(Boolean).join(' ')}
      title="Show the new-user tutorial guide"
    >
      <span className="tutorial-toggle-label">Tutorial</span>
      <input
        type="checkbox"
        className="tutorial-toggle-input"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label="Show tutorial guide"
      />
      <span className="tutorial-toggle-track" aria-hidden="true">
        <span className="tutorial-toggle-thumb" />
      </span>
    </label>
  );
}