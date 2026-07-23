/**
 * Client-side v4.4 logic gates — mirrors Excel Toggle* / Worksheet_Change.
 * Schema from GET /calculator-testing/schema is the cell/field source of truth.
 */

export type VisibilityRule = { group: string; in: number[] };

export type V44RadioOption = {
  value: number;
  label: string;
  shapeName: string;
  hiddenFromReps?: boolean;
};

export type V44RadioGroup = {
  id: string;
  question: string;
  linkCell: string;
  options: V44RadioOption[];
  defaultValue: number;
  hiddenFromReps?: boolean;
};

export type V44Field = {
  id: string;
  label: string;
  repLabel?: string;
  cell: string;
  type: 'text' | 'number' | 'date' | 'dropdown';
  dropdownSource?: string;
  staticOptions?: string[];
  dependsOn?: string;
  visibleWhen?: VisibilityRule[];
  labelByState?: Record<string, string>;
  hiddenFromReps?: boolean;
  required?: boolean;
};

export type V44Section = {
  id: string;
  title: string;
  visibleWhen?: VisibilityRule[];
  note?: string;
  fields: V44Field[];
};

/** Questions page radio group ids — Excel Inputs sheet order (top → bottom) */
export const V44_QUESTIONS_GROUP_IDS = [
  'battery_savings',
  'current_tariff',
] as const;

/** Rep-visible battery savings options in Excel visual order (SC, Flux, Overnight) */
export const V44_REP_BATTERY_SAVINGS = [1, 3, 2];

/**
 * Shown but not selectable by reps. Octopus Flux (3) stays visible while we
 * confirm whether it remains available at launch.
 */
export const V44_REP_DISABLED_BATTERY_SAVINGS = [3];

export function isBatterySavingsOptionDisabled(value: number): boolean {
  return V44_REP_DISABLED_BATTERY_SAVINGS.includes(value);
}

/**
 * Fixed panel for all v4.4 sales — must match the Excel Panels catalog row
 * (Eurener Nexa Matte TOPCon N-type, 460–500 W range, sold at 475 W).
 * Reps do not choose panel manufacturer/model/wattage in the app.
 */
export const V44_DEFAULT_PANEL = {
  manufacturer: 'Eurener',
  model: 'Nexa Matte TOPCon N-type (460W - 500W)',
  wattage: '475',
} as const;

/** @deprecated Use V44_DEFAULT_PANEL — kept for any legacy allowlist checks */
export const V44_SUPPORTED_PANELS = {
  manufacturers: [V44_DEFAULT_PANEL.manufacturer],
  modelIncludes: ['Nexa Matte'],
  wattages: [V44_DEFAULT_PANEL.wattage],
} as const;

export function isSupportedPanelManufacturer(manufacturer: string): boolean {
  return (
    manufacturer.trim().toLowerCase() ===
    V44_DEFAULT_PANEL.manufacturer.toLowerCase()
  );
}

export function isSupportedPanelModel(model: string): boolean {
  return model.trim() === V44_DEFAULT_PANEL.model;
}

/** Always apply the standard 475 W Nexa panel when installing new solar. */
export function applyDefaultPanelInputs(
  radios: Record<string, number>,
  inputs: Record<string, string>,
): Record<string, string> {
  if (v44Radio(radios, 'installing_new_solar') !== 1) {
    const next = { ...inputs };
    delete next.panel_manufacturer;
    delete next.panel_model;
    delete next.panel_wattage;
    return next;
  }
  return {
    ...inputs,
    panel_manufacturer: V44_DEFAULT_PANEL.manufacturer,
    panel_model: V44_DEFAULT_PANEL.model,
    panel_wattage: V44_DEFAULT_PANEL.wattage,
  };
}

/**
 * Batteries currently available to sales reps. Keep the full Excel/backend
 * catalog intact; this allowlist controls only the rep-facing v4.4 inputs.
 */
export const V44_SUPPORTED_BATTERY = {
  manufacturer: 'EcoFlow',
  model: 'PowerOcean LFP',
} as const;

export function isSupportedBatteryManufacturer(manufacturer: string): boolean {
  return (
    manufacturer.trim().toLowerCase() ===
    V44_SUPPORTED_BATTERY.manufacturer.toLowerCase()
  );
}

export function isSupportedBatteryModel(model: string): boolean {
  return model.trim().toLowerCase() === V44_SUPPORTED_BATTERY.model.toLowerCase();
}

/**
 * Original/current EcoFlow PowerOcean inverter range exposed to reps.
 * The workbook retains all models, including OCEAN 2 and unsupported sizes.
 * Excel calls the smallest model 3.68kW; the rep-facing label is 3.6 kW.
 */
export const V44_SUPPORTED_INVERTER = {
  manufacturer: 'EcoFlow',
  capacitiesKw: [3.68, 5, 6],
} as const;

export function isSupportedInverterManufacturer(manufacturer: string): boolean {
  return (
    manufacturer.trim().toLowerCase() ===
    V44_SUPPORTED_INVERTER.manufacturer.toLowerCase()
  );
}

export function isSupportedInverter(
  manufacturer: string,
  model: string,
  capacityKw: number | null,
): boolean {
  return (
    isSupportedInverterManufacturer(manufacturer) &&
    /^PowerOcean\s/i.test(model.trim()) &&
    capacityKw != null &&
    V44_SUPPORTED_INVERTER.capacitiesKw.some(
      (supported) => Math.abs(supported - capacityKw) < 0.001,
    )
  );
}

export function inverterDisplayName(model: string): string {
  const match = model.match(/^PowerOcean\s+([\d.]+)\s*kW$/i);
  if (!match) return model;
  const size = Number(match[1]);
  const label = Math.abs(size - 3.68) < 0.001 ? '3.6' : String(size);
  return `PowerOcean ${label} kW`;
}

export const V44_TEMPLATE_FILE =
  'EPVS Member Calculator v4.4.1 - (Creativ) 15th July 2026 Main.xlsm';

/** Default export tariff (pence) — pre-filled, user may override */
export const V44_EXPORT_TARIFF_DEFAULT = '12';

/**
 * 100Green overnight / new tariff defaults (pence per kWh).
 * Applied when Battery Charging Overnight is selected.
 * Dual day rate (36.26) still needs confirming against the approved tariff
 * sheet before launch.
 */
export const V44_100GREEN_RATES = {
  single: { day: '27.73', night: '7.00' },
  dual: { day: '36.26', night: '7.00' },
} as const;

/** 100Green off-peak duration (hours) — same for single and dual rate */
export const V44_100GREEN_OFFPEAK_HOURS = '7';

/**
 * Standing charge fallback (pence/day) when the rep leaves current tariff blank.
 * The CURRENT tariff standing charge is visible and entered manually by the rep.
 */
export const V44_STANDING_CHARGE_DEFAULT = '47.5';

/** New overnight-tariff standing charge (pence/day) — hidden from reps, always 44. */
export const V44_NEW_STANDING_CHARGE_DEFAULT = '44';

/**
 * Pre-fill New Electricity Tariff + Export based on battery savings basis.
 * - Overnight (2) / Levelise (5): 100Green day/night from Single vs Dual current tariff
 * - Self-Consumption (1): NO new tariff (customer stays on current tariff); export 12
 * - Export (SC / Overnight / Cosy / None / Levelise): default 12p
 *
 * When `force` is true (e.g. savings basis just changed), overwrite the target fields.
 * Otherwise only fill empty fields so user overrides stick.
 */
export function applyNewTariffDefaults(
  radios: Record<string, number>,
  inputs: Record<string, string>,
  options?: { force?: boolean },
): Record<string, string> {
  const force = options?.force === true;
  const next = { ...inputs };
  const savings = v44Radio(radios, 'battery_savings');
  const tariff = v44Radio(radios, 'current_tariff', 1);

  const setIf = (key: string, value: string) => {
    if (force || !String(next[key] ?? '').trim()) {
      next[key] = value;
    }
  };

  // Export always defaults to 12p when that section is in play
  if (savings === 1 || savings === 2 || savings === 5 || savings === 6 || savings === 7) {
    setIf('export_tariff_rate', V44_EXPORT_TARIFF_DEFAULT);
  }

  if (savings === 2 || savings === 5) {
    const green =
      tariff === 2 ? V44_100GREEN_RATES.dual : V44_100GREEN_RATES.single;
    setIf('new_peak_rate', green.day);
    setIf('new_offpeak_rate', green.night);
    setIf('new_offpeak_hours', V44_100GREEN_OFFPEAK_HOURS);
    next.new_standing_charge = V44_NEW_STANDING_CHARGE_DEFAULT;
  }

  // These modes are not currently selectable by reps, but keep their hidden
  // workbook values consistent if an existing record uses them.
  if (savings === 3 || savings === 8) {
    next.flux_standing_charge = V44_STANDING_CHARGE_DEFAULT;
  }
  if (savings === 4) {
    next.if_standing_charge = V44_STANDING_CHARGE_DEFAULT;
  }

  // Self-Consumption (1) has no New Electricity Tariff — clear any stale values
  // so hidden fields aren't submitted to the workbook.
  if (savings === 1) {
    delete next.new_peak_rate;
    delete next.new_offpeak_rate;
    delete next.new_offpeak_hours;
    delete next.new_standing_charge;
  }

  return next;
}

/** Coerce saved / URL radio values — strict `=== 1` fails on string `"1"`. */
export function v44Radio(
  radios: Record<string, unknown>,
  key: string,
  fallback = -1,
): number {
  const raw = radios[key];
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

export function normalizeV44Radios(
  radios: Record<string, unknown>,
  groups?: V44RadioGroup[],
): Record<string, number> {
  const base = groups ? defaultRadios(groups) : {};
  if (!radios || typeof radios !== 'object') return base;

  for (const [key, val] of Object.entries(radios)) {
    const n = Number(val);
    if (!Number.isNaN(n)) {
      base[key] = n;
      continue;
    }
    if (typeof val === 'string' && groups) {
      for (const g of groups) {
        const opt = g.options.find((o) => o.shapeName === val);
        if (opt) {
          base[g.id] = opt.value;
          break;
        }
      }
    }
  }

  base.usage_known = 1;
  return base;
}

export function rulesPass(
  rules: VisibilityRule[] | undefined,
  radios: Record<string, number>,
): boolean {
  if (!rules?.length) return true;
  return rules.every((r) => r.in.includes(v44Radio(radios, r.group)));
}

export function resolveFieldLabel(
  field: V44Field,
  radios: Record<string, number>,
  repView = true,
): string {
  if (repView && field.repLabel) return field.repLabel;
  if (field.labelByState) {
    const tariff = v44Radio(radios, 'current_tariff', 1);
    const usage = v44Radio(radios, 'usage_known', 1);
    const exact = field.labelByState[`${tariff}-${usage}`];
    if (exact) return exact;
    const wildcard = field.labelByState[`${tariff}-*`];
    if (wildcard) return wildcard;
  }
  return field.label;
}

export function isConsumptionField(fieldId: string): boolean {
  return (
    fieldId.startsWith('consumption_') || fieldId.startsWith('spend_')
  );
}

export function isFieldVisible(
  field: V44Field,
  radios: Record<string, number>,
  consumptionMatrix: Record<string, string[]>,
  repView = true,
): boolean {
  if (repView && field.hiddenFromReps) return false;
  if (!rulesPass(field.visibleWhen, radios)) return false;

  if (isConsumptionField(field.id)) {
    const key = `${radios.current_tariff ?? 1}-${radios.usage_known ?? 1}`;
    const allowed = consumptionMatrix[key] || [];
    if (!allowed.includes(field.id)) return false;
    // labelByState further restricts which states show the field
    if (field.labelByState) {
      const exact = field.labelByState[key];
      const wild = field.labelByState[`${radios.current_tariff ?? 1}-*`];
      if (!exact && !wild) return false;
    }
  } else if (field.labelByState) {
    const key = `${radios.current_tariff ?? 1}-${radios.usage_known ?? 1}`;
    const tariff = radios.current_tariff ?? 1;
    if (!field.labelByState[key] && !field.labelByState[`${tariff}-*`]) {
      // rate fields with only labelByState for display — still visible if visibleWhen passed
      // only hide if labelByState keys exist and none match
      const anyMatch = Object.keys(field.labelByState).some((k) => {
        if (k.endsWith('-*')) return k.startsWith(`${tariff}-`);
        return k === key;
      });
      if (!anyMatch) return false;
    }
  }

  return true;
}

/**
 * Authoritative rep-facing gate for the four supported combinations.
 *
 * Annual usage is always "Yes", so Single Rate uses annual usage and Dual
 * Rate uses peak/off-peak usage. New Overnight fields appear only for
 * Overnight Charging; export appears for both supported savings methods.
 * This deliberately overrides stale backend schema visibility.
 */
export function isApprovedV44RepFieldVisible(
  field: V44Field,
  radios: Record<string, number>,
  consumptionMatrix: Record<string, string[]>,
): boolean {
  const batterySavings = v44Radio(radios, 'battery_savings');
  const currentTariff = v44Radio(radios, 'current_tariff');
  const isSelfConsumption = batterySavings === 1;
  const isOvernightCharging = batterySavings === 2;
  const isSingleRate = currentTariff === 1;
  const isDualRate = currentTariff === 2;

  switch (field.id) {
    case 'current_rate_1':
      // Same Excel field: Unit Rate for Single, Peak Rate for Dual.
      return isSingleRate || isDualRate;
    case 'current_rate_2':
    case 'current_rate_3':
      return isDualRate;
    case 'standing_charge':
      return isSingleRate || isDualRate;
    case 'occupancy_archetype':
    case 'spend_1':
    case 'spend_2':
    case 'spend_3':
      return false;
    case 'consumption_1':
      return isSingleRate;
    case 'consumption_2':
    case 'consumption_3':
      return isDualRate;
    case 'new_peak_rate':
    case 'new_offpeak_rate':
    case 'new_offpeak_hours':
      return isOvernightCharging;
    case 'new_standing_charge':
      // Hidden from reps — auto-filled at 44p in the background.
      return false;
    case 'export_tariff_rate':
      return isSelfConsumption || isOvernightCharging;
    case 'flux_day_rate_import':
    case 'flux_day_rate_export':
    case 'flux_flux_rate_import':
    case 'flux_flux_rate_export':
    case 'flux_peak_rate_import':
    case 'flux_peak_rate_export':
    case 'flux_standing_charge':
    case 'if_peak_rate_import':
    case 'if_peak_rate_export':
    case 'if_offpeak_rate_import':
    case 'if_offpeak_rate_export':
    case 'if_standing_charge':
      return false;
    case 'panel_manufacturer':
    case 'panel_model':
    case 'panel_wattage':
      // Fixed Eurener Nexa 475 W — applied automatically in the background.
      return false;
    default:
      return isFieldVisible(field, radios, consumptionMatrix, true);
  }
}

export function isSectionVisible(
  section: V44Section,
  radios: Record<string, number>,
): boolean {
  return rulesPass(section.visibleWhen, radios);
}

/** Rep-facing section gates — do not rely on stale backend schema visibleWhen. */
export function isApprovedV44RepSectionVisible(
  section: V44Section,
  radios: Record<string, number>,
): boolean {
  const isSelfConsumption = v44Radio(radios, 'battery_savings') === 1;
  const isOvernightCharging = v44Radio(radios, 'battery_savings') === 2;

  switch (section.id) {
    case 'system_costs':
    case 'customer':
      return false;
    case 'new_overnight':
      return isOvernightCharging;
    case 'export_tariff':
      return isSelfConsumption || isOvernightCharging;
    case 'standard_flux':
    case 'intelligent_flux':
      return false;
    default:
      return isSectionVisible(section, radios);
  }
}

/** Fields to clear when a radio group changes */
export function fieldsClearedByRadioChange(
  groupId: string,
  sections: V44Section[],
  radiosBefore: Record<string, number>,
  radiosAfter: Record<string, number>,
  consumptionMatrix: Record<string, string[]>,
): string[] {
  const clear = new Set<string>();
  for (const section of sections) {
    const wasVisible = isSectionVisible(section, radiosBefore);
    const nowVisible = isSectionVisible(section, radiosAfter);
    if (wasVisible && !nowVisible) {
      section.fields.forEach((f) => clear.add(f.id));
    }
    for (const field of section.fields) {
      const was = isFieldVisible(field, radiosBefore, consumptionMatrix);
      const now = isFieldVisible(field, radiosAfter, consumptionMatrix);
      if (was && !now) clear.add(field.id);
    }
  }
  // Excel clears rate block on tariff change, consumption on usage change
  if (groupId === 'current_tariff') {
    ['current_rate_1', 'current_rate_2', 'current_rate_3', 'standing_charge'].forEach(
      (id) => clear.add(id),
    );
  }
  if (groupId === 'usage_known') {
    [
      'consumption_1',
      'consumption_2',
      'consumption_3',
      'spend_1',
      'spend_2',
      'spend_3',
      'occupancy_archetype',
    ].forEach((id) => clear.add(id));
  }
  return [...clear];
}

/** Cascade clears (Worksheet_Change) */
export const V44_CASCADE_CLEARS: Record<string, string[]> = {
  panel_manufacturer: ['panel_model', 'panel_wattage'],
  panel_model: ['panel_wattage'],
  battery_manufacturer: ['battery_model'],
  inverter_manufacturer: ['inverter_model'],
};

export function applyCascadeClear(
  fieldId: string,
  inputs: Record<string, string>,
): Record<string, string> {
  const next = { ...inputs };
  const toClear = V44_CASCADE_CLEARS[fieldId] || [];
  for (const id of toClear) {
    delete next[id];
    // transitive
    Object.assign(next, applyCascadeClear(id, next));
  }
  return next;
}

export function defaultRadios(groups: V44RadioGroup[]): Record<string, number> {
  const radios: Record<string, number> = {};
  for (const g of groups) {
    radios[g.id] = g.defaultValue;
  }
  // Meeting / plan defaults
  radios.existing_solar = 2; // No existing system — question removed from UI
  radios.installing_new_solar = 1;
  radios.inverter_new = 1;
  radios.usage_known = 1;
  return radios;
}

export function radiosFromProgress(
  radioButtonSelections?: Record<string, string>,
  groups?: V44RadioGroup[],
): Record<string, number> {
  return normalizeV44Radios(radioButtonSelections ?? {}, groups);
}

export function radiosToProgress(
  radios: Record<string, number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(radios)) {
    out[k] = String(v);
  }
  return out;
}

/** Filter options for Questions page. Depends on other answers (Excel parity). */
export function questionGroupOptions(
  group: V44RadioGroup,
  radios: Record<string, number> = {},
): V44RadioOption[] {
  if (group.id === 'battery_savings') {
    return group.options
      .filter((o) => V44_REP_BATTERY_SAVINGS.includes(o.value))
      .sort(
        (a, b) =>
          V44_REP_BATTERY_SAVINGS.indexOf(a.value) -
          V44_REP_BATTERY_SAVINGS.indexOf(b.value),
      );
  }
  if (group.id === 'usage_known') {
    // Split by Spend / Usage are not in use — Yes / No only.
    return group.options.filter((o) => o.value === 1 || o.value === 2);
  }
  if (group.id === 'current_tariff') {
    // Octopus Cosy (3) hidden for now — Single / Dual only.
    return group.options.filter((o) => o.value === 1 || o.value === 2);
  }
  return group.options.filter((o) => !o.hiddenFromReps);
}

/** Excel Inputs sheet section order (by row). Used to keep app fields aligned. */
export const V44_EXCEL_SECTION_ORDER = [
  'customer',
  'existing_system',
  'solar_pv',
  'battery',
  'inverter',
  'current_tariff',
  'new_overnight',
  'standard_flux',
  'intelligent_flux',
  'export_tariff',
  'system_costs',
] as const;

export function sortSectionsByExcelOrder(sections: V44Section[]): V44Section[] {
  const rank = (id: string) => {
    const i = (V44_EXCEL_SECTION_ORDER as readonly string[]).indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...sections].sort((a, b) => rank(a.id) - rank(b.id));
}
