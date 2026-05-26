/**
 * Battery manufacturer and model options
 * Used for both Off-Peak (DynamicInputsScreen) and Flux/EPVS (EPVSDynamicInputsScreen) calculators
 */

export const BATTERY_MANUFACTURERS = [
  'EcoFlow',
];

export const BATTERY_MODELS: Record<string, string[]> = {
  'EcoFlow': [
    'PowerOcean LFP - 5.1 kWh',
    'PowerOcean LFP - 10.2 kWh',
    'PowerOcean LFP - 15.3 kWh',
    'PowerOcean LFP - 30.6 kWh',
  ],
};

/**
 * Get battery models for a specific manufacturer
 */
export function getBatteryModels(manufacturer: string): string[] {
  return BATTERY_MODELS[manufacturer] || [];
}

































