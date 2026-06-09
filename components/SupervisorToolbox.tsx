'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiInsights } from '@/components/AiInsights';
import { KnowledgeManager } from '@/components/KnowledgeManager';
import { CONTRACT_TYPES } from '@/lib/contracts/types';
import { KNOWLEDGE_CATEGORY_LABELS, type KnowledgeCategory } from '@/lib/knowledge-types';

type TabId =
  | 'overview'
  | 'knowledge'
  | 'sandbox'
  | 'contracts'
  | 'prompt'
  | 'bulk';

type OverviewData = {
  ai: { enabled: boolean; model: string; visionModel: string };
  claims: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    denied: number;
    withAnalysis: number;
    needsInfo: number;
    guidelineFlags: number;
    avgRiskScore: number | null;
    highRisk: number;
    byContractType: Record<string, number>;
    recent: {
      id: string;
      name: string;
      status: string;
      contractType: string;
      amount: number;
      riskScore: number | null;
      recommendation: string | null;
      createdAt: string;
    }[];
  };
  knowledge: {
    total: number;
    active: number;
    inactive: number;
    totalExtractedChars: number;
    byCategory: Record<KnowledgeCategory, number>;
  };
  contracts: {
    prefixes: { prefix: string; type: string; coverage: string }[];
    waitingPeriods: { types: string[]; days: number; miles: number }[];
    documentTypes: string[];
  };
};

type SandboxResult = {
  claimId: string;
  contractType?: string;
  ruleResult: { decision: string; reason: string; flags: string[] };
  aiAnalysis: Parameters<typeof AiInsights>[0]['analysis'] & {
    informationRequests?: string[];
    guidelineConflicts?: string[];
  };
};

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Command Center', hint: 'Live AI and claims intelligence' },
  { id: 'knowledge', label: 'Knowledge Base', hint: 'Train Grok with your documents' },
  { id: 'sandbox', label: 'AI Sandbox', hint: 'Test scenarios before production' },
  { id: 'contracts', label: 'Contract Intel', hint: 'Prefixes, waiting periods, rules' },
  { id: 'prompt', label: 'Prompt Inspector', hint: 'See exactly what Grok receives' },
  { id: 'bulk', label: 'Bulk AI Ops', hint: 'Re-run analysis across claims' },
];

const DEFAULT_SCENARIO = {
  policyNumber: 'FWVL041518',
  contractType: 'vital',
  repairEstimate: 4200,
  detailedRepairDescription: 'Engine cylinder head gasket failure.',
  descriptionOfIncident: 'Engine overheated during highway driving.',
  odometerReading: 62000,
  dateOfLoss: '2025-05-15',
};

export function SupervisorToolbox() {
  const [tab, setTab] = useState<TabId>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/overview');
      if (!response.ok) throw new Error('Failed to load overview');
      setOverview((await response.json()) as OverviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function seedKnowledge() {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/seed-knowledge', { method: 'POST' });
      const body = (await response.json()) as {
        seeded?: string[];
        skipped?: string[];
        failed?: { title: string; error: string }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Seed failed');
      setMessage(
        `Seeded ${body.seeded?.length ?? 0} docs` +
          (body.skipped?.length ? `, skipped ${body.skipped.length} existing` : '') +
          (body.failed?.length ? `, ${body.failed.length} failed` : '') +
          '.'
      );
      await loadOverview();
      if (tab !== 'knowledge') setTab('knowledge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    }
  }

  return (
    <div className="supervisor-toolbox">
      <aside className="toolbox-sidebar">
        <div className="toolbox-sidebar-header">
          <p className="badge">Supervisor Toolbox</p>
          <p className="toolbox-tagline">Freedom Warranty AI command center</p>
        </div>
        <nav className="toolbox-nav">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'toolbox-nav-item active' : 'toolbox-nav-item'}
              onClick={() => setTab(item.id)}
            >
              <span className="toolbox-nav-label">{item.label}</span>
              <span className="toolbox-nav-hint">{item.hint}</span>
            </button>
          ))}
        </nav>
        <div className="toolbox-sidebar-actions">
          <Link href="/claims" className="button button-secondary">
            Claims dashboard
          </Link>
        </div>
      </aside>

      <div className="toolbox-panel">
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}

        {tab === 'overview' && (
          <OverviewPanel
            overview={overview}
            loading={loading}
            onRefresh={loadOverview}
            onSeed={seedKnowledge}
            onOpenKnowledge={() => setTab('knowledge')}
          />
        )}
        {tab === 'knowledge' && <KnowledgeManager />}
        {tab === 'sandbox' && <SandboxPanel onMessage={setMessage} />}
        {tab === 'contracts' && <ContractsPanel overview={overview} />}
        {tab === 'prompt' && <PromptPanel />}
        {tab === 'bulk' && (
          <BulkPanel onComplete={() => { setMessage('Bulk analysis finished.'); loadOverview(); }} />
        )}
      </div>
    </div>
  );
}

function OverviewPanel({
  overview,
  loading,
  onRefresh,
  onSeed,
  onOpenKnowledge,
}: {
  overview: OverviewData | null;
  loading: boolean;
  onRefresh: () => void;
  onSeed: () => Promise<void>;
  onOpenKnowledge: () => void;
}) {
  const [seeding, setSeeding] = useState(false);

  if (loading || !overview) {
    return <p className="form-hint">Loading command center…</p>;
  }

  return (
    <section>
      <div className="toolbox-panel-header">
        <div>
          <h2>AI Command Center</h2>
          <p className="form-hint">
            Grok-powered underwriting with contract-aware rules, optional claimant
            documents, and supervisor-trained knowledge.
          </p>
        </div>
        <div className="toolbox-header-actions">
          <button type="button" className="button button-secondary" onClick={onRefresh}>
            Refresh
          </button>
          <button
            type="button"
            className="button"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                await onSeed();
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? 'Seeding…' : 'Seed bundled knowledge'}
          </button>
        </div>
      </div>

      <div className="toolbox-status-grid">
        <StatusCard
          title="Grok AI"
          value={overview.ai.enabled ? 'Online' : 'Heuristic fallback'}
          tone={overview.ai.enabled ? 'good' : 'warn'}
          detail={`Model ${overview.ai.model}`}
        />
        <StatusCard
          title="Knowledge base"
          value={`${overview.knowledge.active} active`}
          detail={`${overview.knowledge.totalExtractedChars.toLocaleString()} chars in prompts`}
        />
        <StatusCard
          title="Needs information"
          value={String(overview.claims.needsInfo)}
          tone={overview.claims.needsInfo > 0 ? 'warn' : undefined}
          detail="Claims with AI information requests"
        />
        <StatusCard
          title="Guideline flags"
          value={String(overview.claims.guidelineFlags)}
          tone={overview.claims.guidelineFlags > 0 ? 'warn' : undefined}
          detail="Potential underwriting conflicts"
        />
      </div>

      <div className="stats-grid">
        <Stat label="Total claims" value={overview.claims.total} />
        <Stat label="Pending" value={overview.claims.pending} />
        <Stat label="Under review" value={overview.claims.underReview} />
        <Stat label="AI analyzed" value={overview.claims.withAnalysis} />
        <Stat label="High risk" value={overview.claims.highRisk} />
        <Stat
          label="Avg risk"
          value={overview.claims.avgRiskScore?.toString() ?? '—'}
        />
      </div>

      <div className="toolbox-split">
        <div className="toolbox-card">
          <h3>Quick actions</h3>
          <ul className="toolbox-action-list">
            <li>
              <button type="button" className="link-button" onClick={onOpenKnowledge}>
                Upload underwriting PDFs or plan HTML
              </button>
            </li>
            <li>Run AI Sandbox to test a denial or review scenario</li>
            <li>Use Prompt Inspector to verify Grok context per contract type</li>
            <li>Bulk re-analyze claims after updating knowledge</li>
          </ul>
        </div>

        <div className="toolbox-card">
          <h3>Knowledge by category</h3>
          <ul className="toolbox-kv-list">
            {Object.entries(overview.knowledge.byCategory).map(([category, count]) => (
              <li key={category}>
                <span>{KNOWLEDGE_CATEGORY_LABELS[category as KnowledgeCategory]}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="toolbox-card">
        <h3>Recent claims</h3>
        <div className="toolbox-table-wrap">
          <table className="toolbox-table">
            <thead>
              <tr>
                <th>Claimant</th>
                <th>Contract</th>
                <th>Amount</th>
                <th>Status</th>
                <th>AI</th>
              </tr>
            </thead>
            <tbody>
              {overview.claims.recent.map((claim) => (
                <tr key={claim.id}>
                  <td>{claim.name}</td>
                  <td>{claim.contractType}</td>
                  <td>${claim.amount.toLocaleString()}</td>
                  <td>{claim.status.replace('_', ' ')}</td>
                  <td>
                    {claim.riskScore != null
                      ? `${claim.riskScore}/10 ${claim.recommendation ?? ''}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SandboxPanel({ onMessage }: { onMessage: (msg: string) => void }) {
  const [mode, setMode] = useState<'scenario' | 'claim'>('scenario');
  const [claimId, setClaimId] = useState('');
  const [scenarioJson, setScenarioJson] = useState(
    JSON.stringify(DEFAULT_SCENARIO, null, 2)
  );
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSandbox() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const body =
        mode === 'claim'
          ? { mode: 'claim', claimId }
          : {
              mode: 'scenario',
              scenario: JSON.parse(scenarioJson) as Record<string, unknown>,
            };

      const response = await fetch('/api/admin/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as SandboxResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Sandbox failed');
      setResult(data);
      onMessage('Sandbox analysis complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sandbox failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <div className="toolbox-panel-header">
        <div>
          <h2>AI Sandbox</h2>
          <p className="form-hint">
            Test Grok underwriting against a custom scenario or an existing claim
            without changing production status.
          </p>
        </div>
      </div>

      <div className="login-role-toggle" style={{ maxWidth: 360 }}>
        <button
          type="button"
          className={mode === 'scenario' ? 'login-role active' : 'login-role'}
          onClick={() => setMode('scenario')}
        >
          Custom scenario
        </button>
        <button
          type="button"
          className={mode === 'claim' ? 'login-role active' : 'login-role'}
          onClick={() => setMode('claim')}
        >
          Existing claim
        </button>
      </div>

      {mode === 'claim' ? (
        <div className="form-field">
          <label htmlFor="sandbox-claim-id">Claim ID</label>
          <input
            id="sandbox-claim-id"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="Paste claim UUID from dashboard"
          />
        </div>
      ) : (
        <div className="form-field">
          <label htmlFor="sandbox-json">Scenario JSON</label>
          <textarea
            id="sandbox-json"
            rows={14}
            value={scenarioJson}
            onChange={(e) => setScenarioJson(e.target.value)}
            className="toolbox-code-input"
          />
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="button" disabled={running} onClick={runSandbox}>
        {running ? 'Running Grok analysis…' : 'Run sandbox analysis'}
      </button>

      {result && (
        <div className="toolbox-results">
          <div className="toolbox-card">
            <h3>Contract rules</h3>
            <p>
              <strong>{result.ruleResult.decision}</strong> — {result.ruleResult.reason}
            </p>
            {result.ruleResult.flags.length > 0 && (
              <ul>
                {result.ruleResult.flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </div>
          <AiInsights analysis={result.aiAnalysis} />
        </div>
      )}
    </section>
  );
}

function ContractsPanel({ overview }: { overview: OverviewData | null }) {
  if (!overview) return <p className="form-hint">Loading contract intelligence…</p>;

  return (
    <section>
      <div className="toolbox-panel-header">
        <div>
          <h2>Contract Intelligence</h2>
          <p className="form-hint">
            Policy number prefixes drive contract type. AI and rules use these
            mappings on every claim.
          </p>
        </div>
      </div>

      <div className="toolbox-card">
        <h3>Policy prefixes (longest match first)</h3>
        <div className="toolbox-table-wrap">
          <table className="toolbox-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Contract</th>
                <th>Coverage model</th>
                <th>Claims on file</th>
              </tr>
            </thead>
            <tbody>
              {overview.contracts.prefixes.map((row) => (
                <tr key={row.prefix}>
                  <td>
                    <code>{row.prefix}</code>
                  </td>
                  <td>{row.type}</td>
                  <td>{row.coverage}</td>
                  <td>{overview.claims.byContractType[row.type] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbox-split">
        <div className="toolbox-card">
          <h3>Waiting periods</h3>
          <ul>
            {overview.contracts.waitingPeriods.map((period) => (
              <li key={period.types.join('-')}>
                <strong>{period.types.join(', ')}</strong>: {period.days} days AND{' '}
                {period.miles.toLocaleString()} miles
              </li>
            ))}
          </ul>
        </div>
        <div className="toolbox-card">
          <h3>Optional claimant documents</h3>
          <p className="form-hint">
            Not required at intake. AI requests missing docs when guidelines need them.
          </p>
          <ul>
            {overview.contracts.documentTypes.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PromptPanel() {
  const [contractType, setContractType] = useState('vital');
  const [variant, setVariant] = useState('standard');
  const [prompt, setPrompt] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(
    () => `/api/admin/prompt-preview?contractType=${contractType}&variant=${variant}`,
    [contractType, variant]
  );

  const loadPrompt = useCallback(async () => {
    setLoading(true);
    const response = await fetch(previewUrl);
    const data = (await response.json()) as { prompt: string; charCount: number };
    setPrompt(data.prompt);
    setCharCount(data.charCount);
    setLoading(false);
  }, [previewUrl]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  return (
    <section>
      <div className="toolbox-panel-header">
        <div>
          <h2>Prompt Inspector</h2>
          <p className="form-hint">
            Preview the full Grok system prompt including supervisor knowledge,
            contract context, and underwriting guidelines.
          </p>
        </div>
        <span className="knowledge-count">{charCount.toLocaleString()} characters</span>
      </div>

      <div className="form-grid" style={{ maxWidth: 520 }}>
        <div className="form-field">
          <label htmlFor="prompt-contract">Contract type</label>
          <select
            id="prompt-contract"
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
          >
            {CONTRACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
            <option value="unknown">unknown</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="prompt-variant">Variant</label>
          <select
            id="prompt-variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
          >
            <option value="standard">standard</option>
            <option value="manufacturer_extension">manufacturer_extension</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="form-hint">Loading prompt…</p>
      ) : (
        <pre className="toolbox-prompt-preview">{prompt}</pre>
      )}
    </section>
  );
}

function BulkPanel({ onComplete }: { onComplete: () => void }) {
  const [scope, setScope] = useState<'unanalyzed' | 'pending' | 'under_review' | 'all'>(
    'unanalyzed'
  );
  const [limit, setLimit] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    processed: number;
    failed: number;
    results: { claimId: string; ok: boolean; riskScore?: number; recommendation?: string; error?: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBulk() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/bulk-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, limit }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Bulk analyze failed');
      setResult(data);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk analyze failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <div className="toolbox-panel-header">
        <div>
          <h2>Bulk AI Operations</h2>
          <p className="form-hint">
            Re-run Grok analysis after uploading new knowledge. Processes up to 25
            claims per batch.
          </p>
        </div>
      </div>

      <div className="form-grid" style={{ maxWidth: 520 }}>
        <div className="form-field">
          <label htmlFor="bulk-scope">Scope</label>
          <select
            id="bulk-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="unanalyzed">Claims without AI analysis</option>
            <option value="pending">Pending claims</option>
            <option value="under_review">Under review claims</option>
            <option value="all">All claims</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="bulk-limit">Batch size</label>
          <input
            id="bulk-limit"
            type="number"
            min={1}
            max={25}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="button" disabled={running} onClick={runBulk}>
        {running ? 'Running bulk analysis…' : 'Run bulk AI analysis'}
      </button>

      {result && (
        <div className="toolbox-card" style={{ marginTop: 16 }}>
          <p>
            Matched <strong>{result.matched}</strong>, processed{' '}
            <strong>{result.processed}</strong>, failed <strong>{result.failed}</strong>
          </p>
          <ul>
            {result.results.map((item) => (
              <li key={item.claimId}>
                <code>{item.claimId.slice(0, 8)}…</code>{' '}
                {item.ok
                  ? `risk ${item.riskScore}/10 → ${item.recommendation}`
                  : `error: ${item.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatusCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className={`toolbox-status-card${tone ? ` tone-${tone}` : ''}`}>
      <span className="toolbox-status-title">{title}</span>
      <strong className="toolbox-status-value">{value}</strong>
      <span className="toolbox-status-detail">{detail}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}