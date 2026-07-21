/**
 * Strict check: the 4 approved combos (always "Yes" on annual usage) must show
 * exactly the fields from the reference Excel screenshots (21 Jul 2026).
 * Run: npx tsx scripts/verify-v44-four-combos.ts
 */
import {
  applyNewTariffDefaults,
  isFieldVisible,
  isSectionVisible,
  resolveFieldLabel,
  sortSectionsByExcelOrder,
  V44Section,
} from '../src/utils/v44Logic';
import {
  V44_CONSUMPTION_MATRIX,
  V44_SECTIONS,
} from '../../../creativuk-app-backend/src/calculator-testing/v44-schema';

// Hidden by design: new-tariff standing charges (47.5p filled in background)
const HIDDEN = new Set([
  'new_standing_charge',
  'flux_standing_charge',
  'if_standing_charge',
]);

const EQUIPMENT = [
  'Panel Manufacturer',
  'Panel Model',
  'Panel Wattage (W)',
  'Number of Roof Areas',
  'Battery Manufacturer',
  'Battery Model',
  'Number of Batteries',
  'Inverter Manufacturer',
  'Inverter Model',
  'No. of Devices',
];

const CASES: Array<{
  name: string;
  radios: Record<string, number>;
  expected: string[];
  expectedAuto: Record<string, string>;
}> = [
  {
    name: 'Image 1 — Self-Consumption | Single Rate | usage Yes',
    radios: { battery_savings: 1, current_tariff: 1, usage_known: 1 },
    expected: [
      ...EQUIPMENT,
      'Unit rate (pence per kWh)',
      'Standing charge (pence per day)',
      'Estimated Annual Usage (kWh)',
      'Export Tariff (pence per kWh)',
    ],
    expectedAuto: { export_tariff_rate: '12' },
  },
  {
    name: 'Image 2 — Self-Consumption | Dual Rate | usage Yes',
    radios: { battery_savings: 1, current_tariff: 2, usage_known: 1 },
    expected: [
      ...EQUIPMENT,
      'Peak rate (pence per kWh)',
      'Off-peak rate (pence per kWh)',
      'Number of off-peak hours',
      'Standing charge (pence per day)',
      'Estimated Peak Usage (kWh)',
      'Estimated Off-Peak Usage (kWh)',
      'Export Tariff (pence per kWh)',
    ],
    expectedAuto: { export_tariff_rate: '12' },
  },
  {
    name: 'Image 3 — Overnight Charging | Single Rate | usage Yes',
    radios: { battery_savings: 2, current_tariff: 1, usage_known: 1 },
    expected: [
      ...EQUIPMENT,
      'Unit rate (pence per kWh)',
      'Standing charge (pence per day)',
      'Estimated Annual Usage (kWh)',
      'Peak / Day Rate (pence per kWh)',
      'Off-Peak / Night Rate (pence per kWh)',
      'No. of Off-Peak Hours',
      'Export Tariff (pence per kWh)',
    ],
    expectedAuto: {
      export_tariff_rate: '12',
      new_peak_rate: '27.73',
      new_offpeak_rate: '7.00',
      new_offpeak_hours: '7',
      new_standing_charge: '47.5',
    },
  },
  {
    name: 'Image 4 — Overnight Charging | Dual Rate | usage Yes',
    radios: { battery_savings: 2, current_tariff: 2, usage_known: 1 },
    expected: [
      ...EQUIPMENT,
      'Peak rate (pence per kWh)',
      'Off-peak rate (pence per kWh)',
      'Number of off-peak hours',
      'Standing charge (pence per day)',
      'Estimated Peak Usage (kWh)',
      'Estimated Off-Peak Usage (kWh)',
      'Peak / Day Rate (pence per kWh)',
      'Off-Peak / Night Rate (pence per kWh)',
      'No. of Off-Peak Hours',
      'Export Tariff (pence per kWh)',
    ],
    expectedAuto: {
      export_tariff_rate: '12',
      new_peak_rate: '36.26',
      new_offpeak_rate: '7.00',
      new_offpeak_hours: '7',
      new_standing_charge: '47.5',
    },
  },
];

let failures = 0;

for (const c of CASES) {
  const radios: Record<string, number> = {
    existing_solar: 2,
    installing_new_solar: 1,
    inverter_new: 1,
    ...c.radios,
  };
  const shown: string[] = [];
  const sections = sortSectionsByExcelOrder(
    V44_SECTIONS as unknown as V44Section[],
  ).filter((s) => {
    if (s.id === 'system_costs' || s.id === 'customer') return false;
    if (s.id === 'new_overnight' && radios.battery_savings === 1) return false;
    return isSectionVisible(s, radios);
  });
  for (const section of sections) {
    for (const f of section.fields) {
      if (HIDDEN.has(f.id)) continue;
      if (!isFieldVisible(f, radios, V44_CONSUMPTION_MATRIX, true)) continue;
      shown.push(resolveFieldLabel(f, radios, true));
    }
  }

  const missing = c.expected.filter((e) => !shown.includes(e));
  const extra = shown.filter((s) => !c.expected.includes(s));

  const defaults = applyNewTariffDefaults(radios, {}, { force: true });
  const autoErrors = Object.entries(c.expectedAuto)
    .filter(([k, v]) => defaults[k] !== v)
    .map(([k, v]) => `${k}: expected ${v}, got ${defaults[k] ?? '(none)'}`);

  const pass = !missing.length && !extra.length && !autoErrors.length;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (missing.length) console.log(`   MISSING: ${missing.join(' | ')}`);
  if (extra.length) console.log(`   EXTRA:   ${extra.join(' | ')}`);
  if (autoErrors.length) console.log(`   AUTO:    ${autoErrors.join(' | ')}`);
  if (!pass) failures++;
}

if (failures) {
  console.error(`\n${failures} combo(s) do not match the reference screenshots`);
  process.exit(1);
}
console.log('\nAll 4 combos match the reference Excel screenshots.');
