import type { ContractType, ContractTypeOrUnknown } from './types';

/**
 * Keyword-based component coverage for Freedom Warranty plan families.
 * Matching is intentionally conservative: unclear free-text never hard-denies
 * solely for missing a keyword — only clear non-covered / excluded hits deny.
 */

export type ComponentMatchStatus =
  | 'covered'
  | 'not_covered'
  | 'excluded'
  | 'unclear';

export type ComponentCoverageResult = {
  status: ComponentMatchStatus;
  matchedLabel: string | null;
  matchedKeywords: string[];
  flags: string[];
  /** When true, rules should deny as non_covered */
  hardDeny: boolean;
};

type ComponentEntry = {
  label: string;
  keywords: string[];
};

/** Items almost never covered under stated warranty plans (maintenance / wear). */
const STATED_NOT_COVERED: ComponentEntry[] = [
  {
    label: 'Brake pads / shoes / rotors (wear)',
    keywords: [
      'brake pad',
      'brake pads',
      'brake shoe',
      'brake shoes',
      'brake rotor',
      'brake rotors',
      'disc brake',
      'drum brake',
    ],
  },
  {
    label: 'Tires / wheels',
    keywords: ['tire', 'tires', 'wheel balance', 'alignment only'],
  },
  {
    label: 'Battery / battery cables',
    keywords: ['battery replacement', 'car battery', 'battery cables'],
  },
  {
    label: 'Wiper blades / washer',
    keywords: ['wiper blade', 'wiper blades', 'windshield washer'],
  },
  {
    label: 'Filters / fluids / tune-up',
    keywords: [
      'oil change',
      'oil filter',
      'air filter',
      'cabin filter',
      'fuel filter',
      'spark plug',
      'tune-up',
      'coolant flush',
    ],
  },
  {
    label: 'Clutch wear items',
    keywords: ['clutch disc', 'clutch plate', 'throw out bearing'],
  },
  {
    label: 'Exhaust muffler / pipes (wear)',
    keywords: ['muffler', 'tailpipe', 'exhaust pipe'],
  },
  {
    label: 'Glass / mirrors / bulbs',
    keywords: [
      'windshield',
      'window glass',
      'side mirror',
      'headlight bulb',
      'tail light bulb',
    ],
  },
  {
    label: 'Cosmetic / body / interior trim',
    keywords: [
      'paint',
      'body panel',
      'dent',
      'upholstery',
      'carpet',
      'door handle cosmetic',
    ],
  },
];

/** Classic — basic stated powertrain (Section 2 style core list). */
const CLASSIC_COVERED: ComponentEntry[] = [
  {
    label: 'Engine (internal lubricated parts)',
    keywords: [
      'engine',
      'cylinder head',
      'head gasket',
      'piston',
      'crankshaft',
      'camshaft',
      'timing chain',
      'timing belt',
      'oil pump',
      'valve train',
      'rod bearing',
      'main bearing',
    ],
  },
  {
    label: 'Transmission',
    keywords: [
      'transmission',
      'transaxle',
      'torque converter',
      'valve body',
      'transmission pump',
    ],
  },
  {
    label: 'Drive axle / differential',
    keywords: [
      'drive axle',
      'axle shaft',
      'differential',
      'cv joint',
      'cv axle',
      'transfer case',
    ],
  },
  {
    label: 'Turbo / supercharger (if listed)',
    keywords: ['turbo', 'turbocharger', 'supercharger'],
  },
];

/** Vital / Drive — broader stated lists (electrical, A/C, cooling, etc.). */
const VITAL_DRIVE_COVERED: ComponentEntry[] = [
  ...CLASSIC_COVERED,
  {
    label: 'Cooling system',
    keywords: [
      'water pump',
      'radiator',
      'thermostat',
      'cooling fan',
      'fan clutch',
    ],
  },
  {
    label: 'Electrical (charging / starting)',
    keywords: ['alternator', 'starter', 'voltage regulator'],
  },
  {
    label: 'Air conditioning',
    keywords: [
      'a/c compressor',
      'ac compressor',
      'air conditioning compressor',
      'condenser',
      'evaporator',
    ],
  },
  {
    label: 'Fuel system',
    keywords: ['fuel pump', 'fuel injector', 'injection pump'],
  },
  {
    label: 'Steering',
    keywords: [
      'power steering pump',
      'steering rack',
      'rack and pinion',
      'steering gear',
    ],
  },
  {
    label: 'Sensors (powertrain)',
    keywords: [
      'oxygen sensor',
      'o2 sensor',
      'maf sensor',
      'map sensor',
      'crank sensor',
      'cam sensor',
      'abs sensor',
    ],
  },
];

/**
 * Complete (exclusionary) — components typically listed as exclusions.
 * If matched → deny. Everything else is presumed covered at rule level.
 */
const COMPLETE_EXCLUSIONS: ComponentEntry[] = [
  ...STATED_NOT_COVERED,
  {
    label: 'Maintenance neglect items',
    keywords: ['sludge', 'lack of oil', 'no oil changes', 'overheating abuse'],
  },
  {
    label: 'Aftermarket / modified parts',
    keywords: ['aftermarket', 'chip tune', 'lift kit', 'racing'],
  },
  {
    label: 'Seals and gaskets (unless upgrade)',
    keywords: ['valve cover gasket', 'oil pan gasket', 'seal leak only'],
  },
  {
    label: 'Suspension wear',
    keywords: [
      'shock absorber',
      'strut assembly',
      'ball joint',
      'control arm bushing',
      'sway bar link',
    ],
  },
  {
    label: 'Entertainment / navigation',
    keywords: ['radio', 'infotainment', 'navigation unit', 'speaker'],
  },
];

const COVERED_BY_TYPE: Record<Exclude<ContractType, 'complete'>, ComponentEntry[]> = {
  classic: CLASSIC_COVERED,
  vital: VITAL_DRIVE_COVERED,
  drive: VITAL_DRIVE_COVERED,
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findMatches(
  text: string,
  entries: ComponentEntry[]
): { entry: ComponentEntry; keyword: string }[] {
  const hits: { entry: ComponentEntry; keyword: string }[] = [];
  for (const entry of entries) {
    for (const keyword of entry.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        hits.push({ entry, keyword });
        break;
      }
    }
  }
  return hits;
}

/**
 * Evaluate whether the repair description appears covered for the contract type.
 */
export function evaluateComponentCoverage(
  contractType: ContractTypeOrUnknown,
  repairDescription: string,
  incidentDescription = ''
): ComponentCoverageResult {
  const text = normalize(`${repairDescription} ${incidentDescription}`);
  const flags: string[] = [];

  if (!text || contractType === 'unknown') {
    return {
      status: 'unclear',
      matchedLabel: null,
      matchedKeywords: [],
      flags: contractType === 'unknown'
        ? ['Cannot evaluate component coverage without contract type']
        : ['Empty repair description — component coverage unclear'],
      hardDeny: false,
    };
  }

  if (contractType === 'complete') {
    const excluded = findMatches(text, COMPLETE_EXCLUSIONS);
    if (excluded.length > 0) {
      const labels = Array.from(new Set(excluded.map((h) => h.entry.label)));
      flags.push(
        `Exclusionary plan: repair matches exclusion list (${labels.join(', ')})`
      );
      return {
        status: 'excluded',
        matchedLabel: labels[0] ?? null,
        matchedKeywords: excluded.map((h) => h.keyword),
        flags,
        hardDeny: true,
      };
    }
    flags.push(
      'Exclusionary plan: no clear Section 2 exclusion keywords matched — verify full exclusion list'
    );
    return {
      status: 'covered',
      matchedLabel: null,
      matchedKeywords: [],
      flags,
      hardDeny: false,
    };
  }

  const notCovered = findMatches(text, STATED_NOT_COVERED);
  if (notCovered.length > 0) {
    const labels = Array.from(new Set(notCovered.map((h) => h.entry.label)));
    flags.push(
      `Stated-component plan: repair appears non-covered (${labels.join(', ')})`
    );
    return {
      status: 'not_covered',
      matchedLabel: labels[0] ?? null,
      matchedKeywords: notCovered.map((h) => h.keyword),
      flags,
      hardDeny: true,
    };
  }

  const coveredList = COVERED_BY_TYPE[contractType] ?? [];
  const covered = findMatches(text, coveredList);
  if (covered.length > 0) {
    const labels = Array.from(new Set(covered.map((h) => h.entry.label)));
    flags.push(
      `Stated-component plan: matches covered list (${labels.join(', ')})`
    );
    return {
      status: 'covered',
      matchedLabel: labels[0] ?? null,
      matchedKeywords: covered.map((h) => h.keyword),
      flags,
      hardDeny: false,
    };
  }

  flags.push(
    `Stated-component plan (${contractType}): component not matched to covered list — AI/adjuster verification required`
  );
  return {
    status: 'unclear',
    matchedLabel: null,
    matchedKeywords: [],
    flags,
    hardDeny: false,
  };
}

/** Export lists for supervisor contract intel / tests. */
export function getComponentCatalogSummary() {
  return {
    classicCovered: CLASSIC_COVERED.map((e) => e.label),
    vitalDriveCovered: VITAL_DRIVE_COVERED.map((e) => e.label),
    statedNotCovered: STATED_NOT_COVERED.map((e) => e.label),
    completeExclusions: COMPLETE_EXCLUSIONS.map((e) => e.label),
  };
}
