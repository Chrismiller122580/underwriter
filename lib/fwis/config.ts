/**
 * Freedom Warranty Information System (FWIS) connection settings.
 * Base default targets fwis.freedomwarranty.com — paths are overridable
 * until Freedom provides final OpenAPI routes.
 */

export type FwisAuthStyle = 'bearer' | 'api_key_header' | 'raw_authorization';

export type FwisConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string | null;
  /** Header name for the API key when authStyle is api_key_header */
  apiKeyHeader: string;
  authStyle: FwisAuthStyle;
  /** Request timeout in ms */
  timeoutMs: number;
  /**
   * Path templates. Use `{policyNumber}` / `{claimId}` placeholders.
   * Freedom may change these — keep env-driven.
   */
  paths: {
    health: string;
    policyByNumber: string;
    claimById: string;
    pushDecision: string;
  };
  /** When true, underwrite/manual decide will attempt to push back to FWIS */
  pushDecisions: boolean;
};

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function getFwisConfig(): FwisConfig {
  const apiKey =
    process.env.FWIS_API_KEY?.trim() ||
    process.env.FREEDOM_WARRANTY_API_KEY?.trim() ||
    null;

  const baseUrl = (
    process.env.FWIS_BASE_URL?.trim() ||
    'https://fwis.freedomwarranty.com'
  ).replace(/\/+$/, '');

  const authStyleRaw = (
    process.env.FWIS_AUTH_STYLE?.trim() || 'bearer'
  ).toLowerCase();
  const authStyle: FwisAuthStyle =
    authStyleRaw === 'api_key_header' || authStyleRaw === 'raw_authorization'
      ? authStyleRaw
      : 'bearer';

  // Enabled when key present, unless explicitly disabled
  const enabled =
    envBool('FWIS_ENABLED', Boolean(apiKey)) && Boolean(apiKey);

  return {
    enabled,
    baseUrl,
    apiKey,
    apiKeyHeader: process.env.FWIS_API_KEY_HEADER?.trim() || 'X-API-Key',
    authStyle,
    timeoutMs: Math.min(
      Math.max(Number(process.env.FWIS_TIMEOUT_MS ?? 15_000) || 15_000, 3000),
      60_000
    ),
    paths: {
      health:
        process.env.FWIS_PATH_HEALTH?.trim() || '/api/health',
      policyByNumber:
        process.env.FWIS_PATH_POLICY?.trim() ||
        '/api/v1/policies/{policyNumber}',
      claimById:
        process.env.FWIS_PATH_CLAIM?.trim() || '/api/v1/claims/{claimId}',
      pushDecision:
        process.env.FWIS_PATH_DECISION?.trim() ||
        '/api/v1/claims/{claimId}/decisions',
    },
    pushDecisions: envBool('FWIS_PUSH_DECISIONS', false),
  };
}

export function isFwisConfigured(): boolean {
  const cfg = getFwisConfig();
  return Boolean(cfg.apiKey && cfg.baseUrl);
}

export function fillPath(
  template: string,
  vars: Record<string, string>
): string {
  let path = template;
  for (const [key, value] of Object.entries(vars)) {
    path = path.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
  }
  return path.startsWith('/') ? path : `/${path}`;
}
