/**
 * Audit: for every combo of rep-selectable answers, print the sections/fields
 * the app will show, using the real frontend gating logic + backend schema.
 * Run: npx tsx scripts/audit-v44-logic.ts
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

const HIDDEN = new Set([
  'new_standing_charge',
  'flux_standing_charge',
  'if_standing_charge',
]);

const savingsOptions = [
  [1, 'Self-Consumption'],
  [2, 'Overnight Charging'],
] as const;
const tariffOptions = [
  [1, 'Single Rate'],
  [2, 'Dual Rate'],
] as const;
const usageOptions = [
  [1, 'Yes'],
  [2, 'No'],
] as const;

for (const [savings, savingsLabel] of savingsOptions) {
  for (const [tariff, tariffLabel] of tariffOptions) {
    for (const [usage, usageLabel] of usageOptions) {
      if (tariff !== 2 && usage >= 3) continue; // split = dual only
      const radios: Record<string, number> = {
        existing_solar: 2,
        installing_new_solar: 1,
        inverter_new: 1,
        battery_savings: savings,
        current_tariff: tariff,
        usage_known: usage,
      };
      console.log(
        `\n=== ${savingsLabel} | ${tariffLabel} | usage: ${usageLabel} ===`,
      );
      const sections = sortSectionsByExcelOrder(
        V44_SECTIONS as unknown as V44Section[],
      ).filter((s) => {
        if (s.id === 'system_costs' || s.id === 'customer') return false;
        if (s.id === 'new_overnight' && radios.battery_savings === 1)
          return false;
        return isSectionVisible(s, radios);
      });
      for (const section of sections) {
        const fields = section.fields.filter(
          (f) =>
            !HIDDEN.has(f.id) &&
            isFieldVisible(f, radios, V44_CONSUMPTION_MATRIX, true),
        );
        if (!fields.length) continue;
        console.log(`  [${section.title}]`);
        for (const f of fields) {
          console.log(`    - ${resolveFieldLabel(f, radios, true)}`);
        }
      }
      const defaults = applyNewTariffDefaults(radios, {}, { force: true });
      console.log(
        `  auto: ${Object.entries(defaults)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
      );
    }
  }
}
