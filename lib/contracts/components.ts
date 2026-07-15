import type {
  ContractType,
  ContractTypeOrUnknown,
  ContractVariant,
} from './types';

/**
 * Keyword-based component coverage derived from Freedom Warranty Section 2
 * language in contracts/classic.html, vital.html, drive.html, complete.html.
 *
 * Matching is conservative: unclear free-text never hard-denies solely for
 * missing a keyword — only clear non-covered / excluded hits deny.
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

/** Shared stated-plan non-covered / maintenance & wear (Section 2(b) style). */
const STATED_NOT_COVERED: ComponentEntry[] = [
  {
    label: 'Brake wear items',
    keywords: [
      'brake pad',
      'brake pads',
      'brake shoe',
      'brake shoes',
      'brake rotor',
      'brake rotors',
      'brake drum',
      'brake drums',
      'disc brake',
      'drum brake',
    ],
  },
  {
    label: 'Tires / wheels / TPMS',
    keywords: [
      'tire',
      'tires',
      'wheel balance',
      'wheel balancing',
      'alignment only',
      'wheel alignment',
      'tire pressure sensor',
      'tpms',
    ],
  },
  {
    label: 'Battery (12V / hybrid cell)',
    keywords: [
      'battery replacement',
      'car battery',
      'battery cables',
      'hybrid battery',
      'hybrid cell',
    ],
  },
  {
    label: 'Wiper blades / washer',
    keywords: ['wiper blade', 'wiper blades', 'windshield washer fluid'],
  },
  {
    label: 'Filters / fluids / tune-up / software',
    keywords: [
      'oil change',
      'oil filter',
      'air filter',
      'cabin filter',
      'fuel filter',
      'spark plug',
      'spark plugs',
      'glow plug',
      'tune-up',
      'tune up',
      'coolant flush',
      'fluid flush',
      'software update',
      'recalibration',
    ],
  },
  {
    label: 'Manual clutch wear items',
    keywords: [
      'clutch disc',
      'clutch plate',
      'clutch assembly',
      'pressure plate',
      'throw out bearing',
      'throw-out bearing',
      'friction disc',
    ],
  },
  {
    label: 'Exhaust / emissions wear',
    keywords: [
      'muffler',
      'tailpipe',
      'tail pipe',
      'exhaust pipe',
      'catalytic converter',
      'exhaust manifold',
      'header',
      'headers',
    ],
  },
  {
    label: 'Glass / bulbs / lighting',
    keywords: [
      'windshield',
      'window glass',
      'broken glass',
      'side mirror glass',
      'headlight bulb',
      'tail light bulb',
      'light bulb',
      'headlamp bulb',
    ],
  },
  {
    label: 'Cosmetic / body / interior trim',
    keywords: [
      'paint',
      'body panel',
      'body damage',
      'dent',
      'upholstery',
      'carpet',
      'carpeting',
      'molding',
      'weather stripping',
      'bumper cover',
    ],
  },
  {
    label: 'Seals/gaskets only (unless with covered repair)',
    keywords: [
      'valve cover gasket only',
      'oil pan gasket only',
      'seal leak only',
      'gasket only',
    ],
  },
  {
    label: 'Sludge / neglect / overheating abuse',
    keywords: [
      'sludge',
      'lack of oil',
      'no oil changes',
      'overheating abuse',
      'continued use after overheating',
    ],
  },
];

/** Classic Section 2(a) — stated components (FWCL). */
const CLASSIC_COVERED: ComponentEntry[] = [
  {
    label: 'Engine (internal lubricated parts)',
    keywords: [
      'engine',
      'piston',
      'pistons',
      'connecting rod',
      'crankshaft',
      'camshaft',
      'push rod',
      'valve spring',
      'rocker arm',
      'timing gear',
      'timing chain',
      'timing belt',
      'oil pump',
      'intake manifold',
      'cylinder head',
      'head gasket',
      'cylinder head gasket',
      'engine block',
      'harmonic balancer',
      'flywheel',
      'flexplate',
      'turbo',
      'turbocharger',
      'supercharger',
    ],
  },
  {
    label: 'Transmission',
    keywords: [
      'transmission',
      'torque converter',
      'vacuum modulator',
      'transmission mount',
      'transaxle',
    ],
  },
  {
    label: 'Transfer case (4x4 / AWD)',
    keywords: ['transfer case', 'transfer unit'],
  },
  {
    label: 'Drive axle / differential',
    keywords: [
      'drive axle',
      'axle shaft',
      'cv joint',
      'cv axle',
      'constant velocity',
      'universal joint',
      'u-joint',
      'drive shaft',
      'driveshaft',
      'differential',
      'locking hub',
    ],
  },
  {
    label: 'Cooling system',
    keywords: ['radiator', 'fan clutch', 'water pump', 'cooling fan'],
  },
  {
    label: 'Air conditioning',
    keywords: [
      'a/c compressor',
      'ac compressor',
      'air conditioning compressor',
      'condenser',
      'evaporator',
      'expansion valve',
      'blower motor',
      'orifice tube',
      'receiver dryer',
      'receiver/dryer',
    ],
  },
  {
    label: 'Electrical (charging / starting / switches)',
    keywords: [
      'alternator',
      'voltage regulator',
      'starter motor',
      'starter solenoid',
      'starter',
      'ignition switch',
      'wiper motor',
      'headlamp switch',
      'turn signal switch',
      'cruise control transducer',
      'washer pump',
      'rear defogger switch',
    ],
  },
];

/**
 * Vital / Drive Section 2(a) — broader stated lists than Classic.
 * (Fuel, steering, more electrical; mounts often limited.)
 */
const VITAL_DRIVE_COVERED: ComponentEntry[] = [
  ...CLASSIC_COVERED,
  {
    label: 'Fuel system',
    keywords: [
      'fuel pump',
      'fuel injection pump',
      'injection pump',
      'metal fuel delivery',
      'fuel injector',
    ],
  },
  {
    label: 'Steering',
    keywords: [
      'power steering pump',
      'steering rack',
      'rack and pinion',
      'steering gear',
      'power steering',
    ],
  },
  {
    label: 'Powertrain sensors (optional upgrade context)',
    keywords: [
      'oxygen sensor',
      'o2 sensor',
      'maf sensor',
      'map sensor',
      'crank sensor',
      'crankshaft sensor',
      'cam sensor',
      'camshaft sensor',
      'abs sensor',
    ],
  },
];

/**
 * Complete exclusionary list (Section 2 items 1a + maintenance wear).
 * Manufacturer's Extension (FWCPM): 1b entertainment/sensor-style exclusions do not apply.
 */
const COMPLETE_EXCLUSIONS_CORE: ComponentEntry[] = [
  ...STATED_NOT_COVERED,
  {
    label: 'Airbags / seat belts / restraints',
    keywords: ['airbag', 'air bag', 'seat belt', 'seatbelt', 'restraint system'],
  },
  {
    label: 'Aftermarket / modified parts',
    keywords: [
      'aftermarket',
      'chip tune',
      'lift kit',
      'racing',
      'remote starter',
    ],
  },
  {
    label: 'Keyless entry / alarms',
    keywords: [
      'keyless entry',
      'keyless lock',
      'alarm system',
      'remote start',
    ],
  },
  {
    label: 'Hoses / belts (non-timing) / fluids',
    keywords: [
      'radiator hose',
      'heater hose',
      'serpentine belt only',
      'accessory belt',
      'fluid only',
    ],
  },
];

/** Complete 1b exclusions (standard Complete only, not Mfr Extension). */
const COMPLETE_EXCLUSIONS_1B: ComponentEntry[] = [
  {
    label: 'Entertainment / navigation / screens',
    keywords: [
      'radio',
      'cd player',
      'bluetooth',
      'gps',
      'navigation',
      'infotainment',
      'led screen',
      'speaker',
      'amplifier',
    ],
  },
  {
    label: 'Sensors (any kind — base Complete)',
    keywords: [
      'sensor',
      'sensors',
      'cam sensor',
      'ignition coil',
      'fuel injector',
    ],
  },
  {
    label: 'Shocks / struts / adjustable suspension',
    keywords: [
      'shock absorber',
      'shocks',
      'strut assembly',
      'struts',
      'ride height',
      'air suspension',
    ],
  },
  {
    label: 'Instrument cluster / gauges',
    keywords: [
      'instrument cluster',
      'digital cluster',
      'gauge cluster',
      'speedometer cluster',
    ],
  },
];

const COVERED_BY_TYPE: Record<
  Exclude<ContractType, 'complete'>,
  ComponentEntry[]
> = {
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
  incidentDescription = '',
  variant: ContractVariant = 'standard'
): ComponentCoverageResult {
  const text = normalize(`${repairDescription} ${incidentDescription}`);
  const flags: string[] = [];

  if (!text || contractType === 'unknown') {
    return {
      status: 'unclear',
      matchedLabel: null,
      matchedKeywords: [],
      flags:
        contractType === 'unknown'
          ? ['Cannot evaluate component coverage without contract type']
          : ['Empty repair description — component coverage unclear'],
      hardDeny: false,
    };
  }

  if (contractType === 'complete') {
    const exclusionList =
      variant === 'manufacturer_extension'
        ? COMPLETE_EXCLUSIONS_CORE
        : [...COMPLETE_EXCLUSIONS_CORE, ...COMPLETE_EXCLUSIONS_1B];

    if (variant === 'manufacturer_extension') {
      flags.push(
        "Manufacturer's Extension: Section 1b entertainment/sensor exclusions do not apply"
      );
    }

    const excluded = findMatches(text, exclusionList);
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
      `Stated-component plan: matches Section 2(a) covered list (${labels.join(', ')})`
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
    `Stated-component plan (${contractType}): component not matched to Section 2(a) list — AI/adjuster verification required`
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
    completeExclusions: [
      ...COMPLETE_EXCLUSIONS_CORE,
      ...COMPLETE_EXCLUSIONS_1B,
    ].map((e) => e.label),
  };
}
