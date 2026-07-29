/**
 * Battery manufacturer and model options
 * Used for both Off-Peak (DynamicInputsScreen) and Flux/EPVS (EPVSDynamicInputsScreen) calculators
 */

export const BATTERY_MANUFACTURERS = [
  'EcoFlow',
];

export const BATTERY_MODELS: Record<string, string[]> = {
  EcoFlow: [
    'Ocean 2 - 5 kWh',
    'Ocean 2 - 10 kWh',
    'Ocean 2 - 15 kWh',
    'Ocean 2 - 20 kWh',
    'Ocean 2 - 25 kWh',
    'Ocean 2 - 30 kWh',
  ],
};

/**
 * Get battery models for a specific manufacturer
 */
export function getBatteryModels(manufacturer: string): string[] {
  return BATTERY_MODELS[manufacturer] || [];
}
