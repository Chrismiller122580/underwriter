export type TutorialState = {
  completed: boolean;
  enabled: boolean;
};

export type StaffRole = 'adjuster' | 'supervisor';

export type TutorialSection =
  | 'Workbench'
  | 'Queue'
  | 'Decisioning'
  | 'Intake'
  | 'Supervisor';

export type TutorialStep = {
  id: string;
  section: TutorialSection;
  title: string;
  body: string;
  tip?: string;
  /** Optional deep-link shown as a CTA on this step */
  href?: string;
  hrefLabel?: string;
  /** If set, only these roles see the step. Omit = all staff. */
  roles?: StaffRole[];
};

const STORAGE_PREFIX = 'fwcut_tutorial';

function storageKey(userKey: string) {
  return `${STORAGE_PREFIX}:${userKey}`;
}

export function getTutorialUserKey(email?: string, role?: string): string | null {
  if (!email) return null;
  return `${email}:${role ?? 'staff'}`;
}

export function readTutorialState(userKey: string | null): TutorialState | null {
  if (!userKey || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return {
      completed: Boolean(parsed.completed),
      enabled: Boolean(parsed.enabled),
    };
  } catch {
    return null;
  }
}

export function writeTutorialState(
  userKey: string | null,
  state: TutorialState
): void {
  if (!userKey || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userKey), JSON.stringify(state));
}

export function defaultTutorialState(): TutorialState {
  return { completed: false, enabled: true };
}

export function shouldAutoOpenTutorial(state: TutorialState): boolean {
  return !state.completed || state.enabled;
}

export const TUTORIAL_CHANGE_EVENT = 'fwcut-tutorial-change';

export function emitTutorialChange(state: TutorialState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TUTORIAL_CHANGE_EVENT, { detail: state })
  );
}

/** Full staff tutorial catalog (adjuster + supervisor extras). */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    section: 'Workbench',
    title: 'Welcome to the workbench',
    body:
      'This is your underwriting command center. Claims arrive after staff intake. You triage by priority, gather missing documents, then decide with rules and AI.',
    tip: 'Use Dashboard for the queue and Submit Claim for new intake. Supervisors also get the Toolbox.',
    href: '/claims',
    hrefLabel: 'Open Dashboard',
  },
  {
    id: 'queues',
    section: 'Queue',
    title: 'Work the action queues',
    body:
      'Start with Action needed and No AI scan. Sidebar counts show volume by focus. Filter by contract type, sort by priority/risk/amount, and search by name, policy, VIN, or repair text.',
    tip: 'Clear the queue top-down: scan first, then underwrite or request info.',
    href: '/claims',
    hrefLabel: 'Open Dashboard',
  },
  {
    id: 'claim-card',
    section: 'Queue',
    title: 'Read the claim card',
    body:
      'Expand a claim for contract context, documentation, AI insights, and history. Check attachments and guideline flags before you act.',
    tip: 'If docs are thin or conflict, request info instead of forcing a decision.',
  },
  {
    id: 'ai-scan',
    section: 'Decisioning',
    title: 'Run AI Scan first',
    body:
      'Use Run AI Scan so Grok can score risk, coverage fit, fraud signals, missing documents, and guideline conflicts. Underwriting expects a scan on the claim.',
    tip: 'Re-run the scan after new documents or large claim changes.',
  },
  {
    id: 'ai-underwrite',
    section: 'Decisioning',
    title: 'Review, then AI Underwrite',
    body:
      'When ready, run AI Underwrite for the combined contract rules + AI decision. Final auto-approve only passes when guardrails allow (risk, confidence, no fraud/info gaps).',
    tip: 'Approved and denied claims cannot be re-underwritten through the AI path.',
  },
  {
    id: 'request-info',
    section: 'Decisioning',
    title: 'Request more information',
    body:
      'If something is missing, use Request info to set needs_info with a checklist (and optional note). Claimants and staff can follow up; clear the request when documents arrive.',
    tip: 'AI may suggest checklist items after a scan—edit before sending.',
  },
  {
    id: 'manual-decision',
    section: 'Decisioning',
    title: 'Manual decision & history',
    body:
      'Override or finalize with Manual decision (approve, deny, or send to review) and a required reason. Activity history logs scans, underwrites, info requests, and decisions for audit.',
    tip: 'Prefer a clear reason—future reviewers rely on the timeline.',
  },
  {
    id: 'intake',
    section: 'Intake',
    title: 'Submit new claims',
    body:
      'Use Submit Claim for staff intake. Prefer FWIS import with contract number + claim number when available. Policy lookup sets the plan type; screenshot autofill is a fallback when FWIS is unavailable.',
    tip: 'Intake is staff-only—you must be signed in.',
    href: '/submit',
    hrefLabel: 'Open Submit Claim',
  },
  {
    id: 'supervisor-toolbox',
    section: 'Supervisor',
    title: 'Supervisor Toolbox',
    body:
      'Supervisors open the Toolbox for portfolio overview, bulk AI operations, sandbox scenarios, and training controls that shape how Grok assists adjusters.',
    tip: 'Adjusters do not see this area—keep training and bulk tools here.',
    href: '/admin/toolbox',
    hrefLabel: 'Open Toolbox',
    roles: ['supervisor'],
  },
  {
    id: 'supervisor-knowledge',
    section: 'Supervisor',
    title: 'Train knowledge & prompts',
    body:
      'Upload underwriting knowledge documents and preview the system prompt Grok receives. Active knowledge is injected into AI underwriting context.',
    tip: 'Deactivate outdated docs so they stop influencing decisions.',
    href: '/admin/toolbox',
    hrefLabel: 'Open Toolbox',
    roles: ['supervisor'],
  },
  {
    id: 'supervisor-users',
    section: 'Supervisor',
    title: 'Manage staff users',
    body:
      'Create named adjuster and supervisor accounts. Prefer named users in production over shared env passwords.',
    tip: 'Supervisors can manage users; adjusters cannot.',
    href: '/admin/toolbox',
    hrefLabel: 'Open Toolbox',
    roles: ['supervisor'],
  },
];

export function stepsForRole(role?: StaffRole | string | null): TutorialStep[] {
  const resolved: StaffRole =
    role === 'supervisor' ? 'supervisor' : 'adjuster';

  return TUTORIAL_STEPS.filter((step) => {
    if (!step.roles || step.roles.length === 0) return true;
    return step.roles.includes(resolved);
  });
}
