'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TUTORIAL_CHANGE_EVENT,
  defaultTutorialState,
  emitTutorialChange,
  getTutorialUserKey,
  readTutorialState,
  shouldAutoOpenTutorial,
  stepsForRole,
  writeTutorialState,
  type StaffRole,
  type TutorialState,
} from '@/lib/onboarding-tutorial';

type OnboardingTutorialProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userKey: string | null;
  role?: StaffRole | string | null;
};

export function OnboardingTutorial({
  open,
  onOpenChange,
  userKey,
  role,
}: OnboardingTutorialProps) {
  const steps = useMemo(() => stepsForRole(role), [role]);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open, role]);

  useEffect(() => {
    setStepIndex((current) => Math.min(current, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const persist = useCallback(
    (state: TutorialState) => {
      writeTutorialState(userKey, state);
    },
    [userKey]
  );

  function closeTutorial(markCompleted: boolean) {
    const next: TutorialState = markCompleted
      ? { completed: true, enabled: false }
      : { completed: false, enabled: false };
    persist(next);
    emitTutorialChange(next);
    onOpenChange(false);
    setStepIndex(0);
  }

  function finishTutorial() {
    closeTutorial(true);
  }

  if (!open || steps.length === 0) return null;

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;

  return (
    <div className="tutorial-overlay" role="presentation">
      <div
        className="tutorial-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
      >
        <div className="tutorial-header">
          <p className="tutorial-eyebrow">Staff guide · {step.section}</p>
          <h2 id="tutorial-title">{step.title}</h2>
          <p className="tutorial-progress" aria-live="polite">
            Step {safeIndex + 1} of {steps.length}
          </p>
        </div>

        <div className="tutorial-body">
          <p id="tutorial-body">{step.body}</p>
          {step.tip && (
            <p className="tutorial-tip">
              <strong>Tip:</strong> {step.tip}
            </p>
          )}
          {step.href && (
            <p className="tutorial-cta">
              <Link href={step.href} className="button button-secondary button-sm">
                {step.hrefLabel ?? 'Open page'}
              </Link>
            </p>
          )}
        </div>

        <div className="tutorial-steps" aria-hidden="true">
          {steps.map((item, index) => (
            <span
              key={item.id}
              className={
                index === safeIndex
                  ? 'tutorial-step-dot active'
                  : index < safeIndex
                    ? 'tutorial-step-dot done'
                    : 'tutorial-step-dot'
              }
            />
          ))}
        </div>

        <div className="tutorial-actions">
          <button
            type="button"
            className="tutorial-skip"
            onClick={() => closeTutorial(true)}
          >
            Skip guide
          </button>
          <div className="tutorial-nav">
            <button
              type="button"
              className="button button-secondary button-sm"
              disabled={safeIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            >
              Back
            </button>
            {isLast ? (
              <button type="button" className="button button-sm" onClick={finishTutorial}>
                Get started
              </button>
            ) : (
              <button
                type="button"
                className="button button-sm"
                onClick={() =>
                  setStepIndex((current) => Math.min(steps.length - 1, current + 1))
                }
              >
                Next
              </button>
            )}
          </div>
        </div>

        {isLast && (
          <p className="tutorial-footer-note">
            Turn this guide back on anytime with the Tutorial toggle in the header.
            It works on Dashboard, Submit Claim, and Supervisor pages—not on public
            claim status.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Optional hook for pages that still need tutorial state without owning the modal.
 * Prefer AppNav-mounted tutorial for open/close UX.
 */
export function useOnboardingTutorial() {
  const [session, setSession] = useState<{
    authenticated: boolean;
    email?: string;
    role?: StaffRole;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [tutorialEnabled, setTutorialEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  const userKey = getTutorialUserKey(session?.email, session?.role);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false }));
  }, []);

  const applyStoredState = useCallback((stored: TutorialState) => {
    setTutorialEnabled(stored.enabled);
    setOpen(shouldAutoOpenTutorial(stored));
  }, []);

  useEffect(() => {
    if (!session?.authenticated || !userKey) {
      setReady(true);
      return;
    }

    applyStoredState(readTutorialState(userKey) ?? defaultTutorialState());
    setReady(true);
  }, [session?.authenticated, userKey, applyStoredState]);

  useEffect(() => {
    if (!userKey) return;

    function handleTutorialChange(event: Event) {
      const detail = (event as CustomEvent<TutorialState>).detail;
      if (!detail) return;
      writeTutorialState(userKey, detail);
      applyStoredState(detail);
    }

    window.addEventListener(TUTORIAL_CHANGE_EVENT, handleTutorialChange);
    return () =>
      window.removeEventListener(TUTORIAL_CHANGE_EVENT, handleTutorialChange);
  }, [userKey, applyStoredState]);

  function setTutorialOpen(next: boolean) {
    setOpen(next);
    if (!userKey) return;

    const stored = readTutorialState(userKey) ?? defaultTutorialState();
    if (!next) {
      const state: TutorialState = stored.completed
        ? { completed: true, enabled: false }
        : { completed: false, enabled: false };
      writeTutorialState(userKey, state);
      setTutorialEnabled(false);
      return;
    }

    const state = { completed: stored.completed, enabled: true };
    writeTutorialState(userKey, state);
    emitTutorialChange(state);
    setTutorialEnabled(true);
  }

  function toggleTutorialEnabled(enabled: boolean) {
    if (!userKey) return;

    const stored = readTutorialState(userKey) ?? defaultTutorialState();
    const state: TutorialState = {
      completed: stored.completed,
      enabled,
    };
    writeTutorialState(userKey, state);
    emitTutorialChange(state);
    setTutorialEnabled(enabled);
    setOpen(enabled);
  }

  return {
    ready,
    isAuthenticated: Boolean(session?.authenticated),
    open,
    tutorialEnabled,
    userKey,
    role: session?.role,
    setTutorialOpen,
    toggleTutorialEnabled,
  };
}
