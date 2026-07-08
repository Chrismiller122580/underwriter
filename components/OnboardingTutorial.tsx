'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  TUTORIAL_CHANGE_EVENT,
  defaultTutorialState,
  emitTutorialChange,
  getTutorialUserKey,
  readTutorialState,
  shouldAutoOpenTutorial,
  writeTutorialState,
  type TutorialState,
} from '@/lib/onboarding-tutorial';

type Session = {
  authenticated: boolean;
  email?: string;
  role?: 'adjuster' | 'supervisor';
};

type TutorialStep = {
  title: string;
  body: string;
  tip?: string;
};

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the workbench',
    body:
      'This is your underwriting command center. Claims land here after staff intake, and you triage them by priority before making a decision.',
    tip: 'Use the sidebar counts to see what needs attention first.',
  },
  {
    title: 'Work the action queue',
    body:
      'Start with Action needed and No AI scan. Each claim card shows contract context, documentation status, and AI flags when you expand it.',
    tip: 'Search by name, policy number, VIN, or repair description from the toolbar.',
  },
  {
    title: 'Run AI Scan first',
    body:
      'Before underwriting, run AI Scan on a claim. Grok assesses risk, coverage fit, missing documents, and guideline conflicts.',
    tip: 'Claims without a scan are blocked from final underwriting.',
  },
  {
    title: 'Review, then underwrite',
    body:
      'Check contract rules, attached documents, and AI recommendations. When ready, run AI Underwrite for the combined rule + AI decision.',
    tip: 'Approved and denied claims cannot be re-underwritten.',
  },
  {
    title: 'Submit new claims',
    body:
      'Use New Claim Intake to enter claims on behalf of customers. Policy lookup identifies the contract type; screenshot autofill speeds data entry.',
    tip: 'Claim submission is staff-only — sign in is required.',
  },
];

type OnboardingTutorialProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userKey: string | null;
};

export function OnboardingTutorial({
  open,
  onOpenChange,
  userKey,
}: OnboardingTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);

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

  if (!open) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

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
          <p className="tutorial-eyebrow">New user guide</p>
          <h2 id="tutorial-title">{step.title}</h2>
          <p className="tutorial-progress" aria-live="polite">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="tutorial-body">
          <p id="tutorial-body">{step.body}</p>
          {step.tip && (
            <p className="tutorial-tip">
              <strong>Tip:</strong> {step.tip}
            </p>
          )}
        </div>

        <div className="tutorial-steps" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={
                index === stepIndex
                  ? 'tutorial-step-dot active'
                  : index < stepIndex
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
              disabled={stepIndex === 0}
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
                  setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))
                }
              >
                Next
              </button>
            )}
          </div>
        </div>

        {isLast && (
          <p className="tutorial-footer-note">
            Intake lives at{' '}
            <Link href="/submit" className="tutorial-inline-link">
              Submit Claim
            </Link>
            . Turn this guide back on anytime with the Tutorial toggle in the header.
          </p>
        )}
      </div>
    </div>
  );
}

export function useOnboardingTutorial() {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [tutorialEnabled, setTutorialEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  const userKey = getTutorialUserKey(session?.email, session?.role);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data: Session) => setSession(data))
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
    setTutorialOpen,
    toggleTutorialEnabled,
  };
}