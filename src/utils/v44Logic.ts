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
  'existing_solar',
  'battery_savings',
  'current_tariff',
  'usage_known',
] as const;

/** Rep-visible battery savings options in Excel visual order (SC, Flux, Overnight) */
export const V44_REP_BATTERY_SAVINGS = [1, 3, 2];

export const V44_TEMPLATE_FILE =
  'EPVS Member Calculator v4.4.1 - (Creativ) 15th July 2026 Main.xlsm';

/** Default export tariff (pence) — pre-filled, user may override */
export const V44_EXPORT_TARIFF_DEFAULT = '12';

/**
 * 100Green overnight / new tariff defaults (pence per kWh).
 * Applied when Battery Charging Overnight is selected.
 */
export const V44_100GREEN_RATES = {
  single: { day: '27.73', night: '7.00' },
  dual: { day: '36.26', night: '7.00' },
} as const;

/**
 * Pre-fill New Electricity Tariff + Export based on battery savings basis.
 * - Overnight (2) / Levelise (5): 100Green day/night from Single vs Dual current tariff
 * - Self-Consumption (1): copy current day rate; clear night rate; export 12
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
  const savings = radios.battery_savings;
  const tariff = radios.current_tariff ?? 1;

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
  }

  if (savings === 1) {
    // Copy current day/peak into New Electricity Tariff; night not applicable
    const currentDay = String(next.current_rate_1 ?? '').trim();
    if (force) {
      if (currentDay) next.new_peak_rate = currentDay;
      delete next.new_offpeak_rate;
      delete next.new_offpeak_hours;
    } else {
      if (currentDay) setIf('new_peak_rate', currentDay);
      // Ensure night stays clear for SC
      if (!String(next.new_offpeak_rate ?? '').trim()) {
        delete next.new_offpeak_rate;
      }
    }
  }

  return next;
}

export function rulesPass(
  rules: VisibilityRule[] | undefined,
  radios: Record<string, number>,
): boolean {
  if (!rules?.length) return true;
  return rules.every((r) => r.in.includes(radios[r.group] ?? -1));
}

export function resolveFieldLabel(
  field: V44Field,
  radios: Record<string, number>,
  repView = true,
): string {
  if (repView && field.repLabel) return field.repLabel;
  if (field.labelByState) {
    const tariff = radios.current_tariff ?? 1;
    const usage = radios.usage_known ?? 1;
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

export function isSectionVisible(
  section: V44Section,
  radios: Record<string, number>,
): boolean {
  return rulesPass(section.visibleWhen, radios);
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
  radios.installing_new_solar = 1;
  radios.inverter_new = 1;
  radios.usage_known = 1;
  return radios;
}

export function radiosFromProgress(
  radioButtonSelections?: Record<string, string>,
  groups?: V44RadioGroup[],
): Record<string, number> {
  const base = groups ? defaultRadios(groups) : {};
  if (!radioButtonSelections) return base;
  for (const [key, val] of Object.entries(radioButtonSelections)) {
    const n = Number(val);
    if (!Number.isNaN(n)) {
      base[key] = n;
    } else if (groups) {
      // shape name fallback
      for (const g of groups) {
        const opt = g.options.find((o) => o.shapeName === val);
        if (opt) {
          base[g.id] = opt.value;
          break;
        }
      }
    }
  }
  return base;
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

/** Filter options for Questions page */
export function questionGroupOptions(
  group: V44RadioGroup,
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
