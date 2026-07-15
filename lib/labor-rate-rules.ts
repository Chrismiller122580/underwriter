/**
 * Labor rate and diagnostic time checks from Freedom Warranty underwriting guidelines:
 * - Class A–D: Regular $85 / Enhanced $110
 * - Class E/X: Regular $126 / Enhanced $165
 * - Diagnostic time max 1.5 hours at contract labor rate
 *
 * Rates/hours are parsed from free-text repair fields when structured fields are absent.
 */

export type VehicleLaborClass = 'A-D' | 'E/X' | 'unknown';

export type LaborRateCheckResult = {
  laborRate: number | null;
  diagnosticHours: number | null;
  vehicleClass: VehicleLaborClass;
  maxRegular: number;
  maxEnhanced: number;
  flags: string[];
  /** Hard stop (currently unused — prefer review for rate disputes). */
  hardDeny: boolean;
  /** Hold for adjuster review. */
  needsReview: boolean;
};

const LUXURY_MAKES = new Set([
  'bmw',
  'mercedes',
  'mercedes-benz',
  'audi',
  'lexus',
  'porsche',
  'jaguar',
  'land rover',
  'range rover',
  'cadillac',
  'lincoln',
  'infiniti',
  'acura',
  'tesla',
  'bentley',
  'rolls-royce',
  'maserati',
  'ferrari',
  'lamborghini',
  'aston martin',
]);

export const LABOR_CAPS = {
  'A-D': { regular: 85, enhanced: 110 },
  'E/X': { regular: 126, enhanced: 165 },
  unknown: { regular: 126, enhanced: 165 }, // use higher ceiling when class unknown
} as const;

export const MAX_DIAGNOSTIC_HOURS = 1.5;

/** Absolute rate that always needs review regardless of class. */
export const ABSURD_LABOR_RATE = 200;

export function inferVehicleLaborClass(
  make: string,
  year?: number
): VehicleLaborClass {
  const normalized = make.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (LUXURY_MAKES.has(normalized)) return 'E/X';
  // Older economy vehicles still A-D; unknown make → unknown
  if (year != null && year > 0) return 'A-D';
  return 'A-D';
}

/**
 * Parse labor rate ($/hr) from free text.
 * Examples: "labor rate $125", "$110/hr", "110 per hour", "labor @ 95"
 */
export function parseLaborRateFromText(text: string): number | null {
  const t = text.toLowerCase();
  const patterns = [
    /labor\s*(?:rate)?\s*(?:@|at|:)?\s*\$?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:\/\s*h(?:r|our)?|per\s*h(?:r|our)?|an\s*hour)?/i,
    /\$\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:\/\s*h(?:r|our)?|per\s*h(?:r|our)?)/i,
    /(\d{2,3}(?:\.\d{1,2})?)\s*(?:\/\s*h(?:r|our)?|per\s*h(?:r|our)?)/i,
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 40 && value <= 400) {
      return value;
    }
  }
  return null;
}

/**
 * Parse diagnostic hours from free text.
 * Examples: "diag 2.0 hrs", "diagnostic time 1.5 hours", "diagnosis: 2 hours"
 */
export function parseDiagnosticHoursFromText(text: string): number | null {
  const t = text.toLowerCase();
  const patterns = [
    /diagnos(?:tic|is)?\s*(?:time|hrs?|hours?)?\s*(?:@|at|:)?\s*(\d+(?:\.\d{1,2})?)\s*(?:h(?:rs?|ours?)?)?/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:h(?:rs?|ours?))\s*(?:of\s*)?diagnos/i,
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 20) {
      return value;
    }
  }
  return null;
}

export function evaluateLaborRateRules(input: {
  make: string;
  year?: number;
  repairDescription?: string;
  repairShopInformation?: string;
  incidentDescription?: string;
}): LaborRateCheckResult {
  const text = [
    input.repairDescription ?? '',
    input.repairShopInformation ?? '',
    input.incidentDescription ?? '',
  ].join('\n');

  const vehicleClass = inferVehicleLaborClass(input.make, input.year);
  const caps = LABOR_CAPS[vehicleClass];
  const laborRate = parseLaborRateFromText(text);
  const diagnosticHours = parseDiagnosticHoursFromText(text);
  const flags: string[] = [];
  let needsReview = false;
  let hardDeny = false;

  flags.push(
    `Labor class ${vehicleClass}: caps Regular $${caps.regular} / Enhanced $${caps.enhanced}; diag max ${MAX_DIAGNOSTIC_HOURS}h`
  );

  if (laborRate != null) {
    flags.push(`Parsed labor rate $${laborRate}/hr from claim text`);

    if (laborRate > ABSURD_LABOR_RATE) {
      flags.push(
        `Labor rate $${laborRate}/hr exceeds absolute review threshold $${ABSURD_LABOR_RATE}`
      );
      needsReview = true;
    } else if (laborRate > caps.enhanced) {
      flags.push(
        `Labor rate $${laborRate}/hr exceeds Enhanced cap $${caps.enhanced} for class ${vehicleClass}`
      );
      needsReview = true;
    } else if (laborRate > caps.regular) {
      flags.push(
        `Labor rate $${laborRate}/hr is above Regular $${caps.regular} (Enhanced up to $${caps.enhanced} may apply)`
      );
    }
  }

  if (diagnosticHours != null) {
    flags.push(`Parsed diagnostic time ${diagnosticHours}h from claim text`);
    if (diagnosticHours > MAX_DIAGNOSTIC_HOURS) {
      flags.push(
        `Diagnostic time ${diagnosticHours}h exceeds max ${MAX_DIAGNOSTIC_HOURS}h at contract labor rate`
      );
      needsReview = true;
    }
  }

  return {
    laborRate,
    diagnosticHours,
    vehicleClass,
    maxRegular: caps.regular,
    maxEnhanced: caps.enhanced,
    flags,
    hardDeny,
    needsReview,
  };
}
