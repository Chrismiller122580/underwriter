import {
  fillPath,
  getFwisConfig,
  type FwisConfig,
} from '@/lib/fwis/config';
import type {
  FwisClaimRecord,
  FwisConnectionStatus,
  FwisDecisionPayload,
  FwisIntakeBundle,
  FwisPolicyRecord,
  FwisRequestResult,
} from '@/lib/fwis/types';
import {
  mapFwisClaimPayload,
  mapFwisPolicyPayload,
} from '@/lib/fwis/mappers';
import {
  fwisRecordsToFormImport,
  type FwisFormImport,
} from '@/lib/fwis/to-form';
import { logger } from '@/lib/logger';

function buildAuthHeaders(cfg: FwisConfig): Record<string, string> {
  if (!cfg.apiKey) return {};

  if (cfg.authStyle === 'api_key_header') {
    return { [cfg.apiKeyHeader]: cfg.apiKey };
  }

  if (cfg.authStyle === 'raw_authorization') {
    return { Authorization: cfg.apiKey };
  }

  // bearer (default)
  return { Authorization: `Bearer ${cfg.apiKey}` };
}

async function fwisFetch(
  path: string,
  init: RequestInit = {},
  cfg = getFwisConfig()
): Promise<FwisRequestResult<unknown>> {
  if (!cfg.apiKey) {
    return {
      ok: false,
      status: 0,
      error: 'FWIS_API_KEY is not set',
    };
  }

  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...buildAuthHeaders(cfg),
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `FWIS HTTP ${response.status}`,
        notFound: response.status === 404,
        bodyPreview: text.slice(0, 400),
      };
    }

    return { ok: true, data: json ?? {}, status: response.status };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `FWIS request timed out after ${cfg.timeoutMs}ms`
          : error.message
        : 'FWIS request failed';
    return { ok: false, status: 0, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkFwisConnection(): Promise<FwisConnectionStatus> {
  const cfg = getFwisConfig();
  const checkedAt = new Date().toISOString();

  if (!cfg.apiKey) {
    return {
      configured: false,
      enabled: false,
      baseUrl: cfg.baseUrl,
      authStyle: cfg.authStyle,
      pushDecisions: cfg.pushDecisions,
      reachable: null,
      message:
        'FWIS_API_KEY not set. Add the key from Freedom Warranty to enable live integration.',
      checkedAt,
    };
  }

  if (!cfg.enabled) {
    return {
      configured: true,
      enabled: false,
      baseUrl: cfg.baseUrl,
      authStyle: cfg.authStyle,
      pushDecisions: cfg.pushDecisions,
      reachable: null,
      message: 'FWIS is configured but FWIS_ENABLED=false',
      checkedAt,
    };
  }

  // Try health path first, then root as a soft probe
  const pathsToTry = [cfg.paths.health, '/', cfg.paths.policyByNumber.replace('{policyNumber}', 'PING')];

  for (const path of pathsToTry) {
    // Skip policy probe if still has braces somehow
    if (path.includes('{')) continue;

    const result = await fwisFetch(path, { method: 'GET' }, cfg);
    if (result.ok) {
      return {
        configured: true,
        enabled: true,
        baseUrl: cfg.baseUrl,
        authStyle: cfg.authStyle,
        pushDecisions: cfg.pushDecisions,
        reachable: true,
        message: `Connected to FWIS (${path})`,
        checkedAt,
        httpStatus: result.status,
        pathTried: path,
      };
    }

    // 401/403 means host is reachable but auth/path may need tuning
    if (result.status === 401 || result.status === 403) {
      return {
        configured: true,
        enabled: true,
        baseUrl: cfg.baseUrl,
        authStyle: cfg.authStyle,
        pushDecisions: cfg.pushDecisions,
        reachable: true,
        message: `FWIS responded ${result.status} on ${path} — check auth style (bearer vs X-API-Key) or path`,
        checkedAt,
        httpStatus: result.status,
        pathTried: path,
      };
    }

    // 404 on health — try next
    if (result.notFound) continue;

    // Network / other errors
    if (result.status === 0) {
      return {
        configured: true,
        enabled: true,
        baseUrl: cfg.baseUrl,
        authStyle: cfg.authStyle,
        pushDecisions: cfg.pushDecisions,
        reachable: false,
        message: result.error,
        checkedAt,
        pathTried: path,
      };
    }
  }

  return {
    configured: true,
    enabled: true,
    baseUrl: cfg.baseUrl,
    authStyle: cfg.authStyle,
    pushDecisions: cfg.pushDecisions,
    reachable: null,
    message:
      'API key is set but health endpoints returned 404. Update FWIS_PATH_* once Freedom shares route docs.',
    checkedAt,
    pathTried: cfg.paths.health,
  };
}

export async function fetchFwisPolicy(
  policyNumber: string
): Promise<FwisRequestResult<FwisPolicyRecord>> {
  const cfg = getFwisConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { ok: false, status: 0, error: 'FWIS is not enabled or API key missing' };
  }

  const path = fillPath(cfg.paths.policyByNumber, {
    policyNumber: policyNumber.trim(),
  });

  logger.info('FWIS policy lookup', { policyNumber: policyNumber.trim() });
  const result = await fwisFetch(path, { method: 'GET' }, cfg);
  if (!result.ok) return result;

  return {
    ok: true,
    status: result.status,
    data: mapFwisPolicyPayload(result.data, policyNumber.trim()),
  };
}

export async function fetchFwisClaim(
  claimId: string
): Promise<FwisRequestResult<FwisClaimRecord>> {
  const cfg = getFwisConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { ok: false, status: 0, error: 'FWIS is not enabled or API key missing' };
  }

  const path = fillPath(cfg.paths.claimById, { claimId: claimId.trim() });
  const result = await fwisFetch(path, { method: 'GET' }, cfg);
  if (!result.ok) return result;

  return {
    ok: true,
    status: result.status,
    data: mapFwisClaimPayload(result.data, claimId.trim()),
  };
}

function unwrapClaimPayload(data: unknown, fallbackId: string): FwisClaimRecord {
  // Search endpoints may return { items: [...] } or [ ... ]
  if (Array.isArray(data) && data.length > 0) {
    return mapFwisClaimPayload(data[0], fallbackId);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['items', 'results', 'claims', 'data']) {
      const arr = obj[key];
      if (Array.isArray(arr) && arr.length > 0) {
        return mapFwisClaimPayload(arr[0], fallbackId);
      }
    }
  }
  return mapFwisClaimPayload(data, fallbackId);
}

/**
 * Load claim by human claim number (and optional contract number).
 * Tries: combined search → claim-by-number → claim-by-id (same token).
 */
export async function fetchFwisClaimByNumbers(
  claimNumber: string,
  contractNumber?: string
): Promise<FwisRequestResult<FwisClaimRecord>> {
  const cfg = getFwisConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { ok: false, status: 0, error: 'FWIS is not enabled or API key missing' };
  }

  const claim = claimNumber.trim();
  const contract = contractNumber?.trim() ?? '';
  const attempts: string[] = [];

  if (contract) {
    attempts.push(
      fillPath(cfg.paths.claimSearch, {
        contractNumber: contract,
        claimNumber: claim,
        policyNumber: contract,
      })
    );
  }
  attempts.push(fillPath(cfg.paths.claimByNumber, { claimNumber: claim }));
  attempts.push(fillPath(cfg.paths.claimById, { claimId: claim }));

  let lastError: FwisRequestResult<FwisClaimRecord> = {
    ok: false,
    status: 0,
    error: 'No claim paths configured',
  };

  for (const path of attempts) {
    logger.info('FWIS claim lookup attempt', { path, claim, contract });
    const result = await fwisFetch(path, { method: 'GET' }, cfg);
    if (result.ok) {
      return {
        ok: true,
        status: result.status,
        data: unwrapClaimPayload(result.data, claim),
      };
    }
    lastError = result;
    // Continue on 404; stop on auth errors
    if (result.status === 401 || result.status === 403) {
      return result;
    }
  }

  return lastError;
}

/**
 * Primary intake path: contract (policy) number + claim number → full form package.
 * Supersedes screenshot autofill when FWIS is connected.
 */
export async function importClaimFromFwis(
  contractNumber: string,
  claimNumber: string
): Promise<{
  bundle: FwisIntakeBundle;
  form: FwisFormImport | null;
}> {
  const contract = contractNumber.trim();
  const claim = claimNumber.trim();
  const errors: string[] = [];

  const [policyResult, claimResult] = await Promise.all([
    fetchFwisPolicy(contract),
    fetchFwisClaimByNumbers(claim, contract),
  ]);

  let policy: FwisPolicyRecord | null = null;
  let claimRec: FwisClaimRecord | null = null;

  if (policyResult.ok) {
    policy = policyResult.data;
  } else {
    errors.push(`Policy/contract: ${policyResult.error}`);
    if (policyResult.bodyPreview) {
      errors.push(`Policy response: ${policyResult.bodyPreview.slice(0, 120)}`);
    }
  }

  if (claimResult.ok) {
    claimRec = claimResult.data;
    // Ensure policy number is set from contract input if missing
    if (!claimRec.policyNumber) {
      claimRec = { ...claimRec, policyNumber: contract };
    }
  } else {
    errors.push(`Claim: ${claimResult.error}`);
    if (claimResult.bodyPreview) {
      errors.push(`Claim response: ${claimResult.bodyPreview.slice(0, 120)}`);
    }
  }

  const bundle: FwisIntakeBundle = {
    contractNumber: contract,
    claimNumber: claim,
    policy,
    claim: claimRec,
    loaded: Boolean(policy || claimRec),
    errors,
  };

  if (!bundle.loaded) {
    return { bundle, form: null };
  }

  const form = fwisRecordsToFormImport(contract, claim, policy, claimRec);
  return { bundle, form };
}

export async function pushFwisDecision(
  payload: FwisDecisionPayload
): Promise<FwisRequestResult<unknown>> {
  const cfg = getFwisConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return { ok: false, status: 0, error: 'FWIS is not enabled or API key missing' };
  }
  if (!cfg.pushDecisions) {
    return {
      ok: false,
      status: 0,
      error: 'FWIS_PUSH_DECISIONS is false — decision not sent',
    };
  }

  const claimKey = payload.fwisClaimId || payload.localClaimId;
  const path = fillPath(cfg.paths.pushDecision, { claimId: claimKey });

  logger.info('FWIS push decision', {
    claimId: claimKey,
    decision: payload.decision,
  });

  return fwisFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    cfg
  );
}
