/**
 * Solar/Hybrid inverter manufacturer and model options
 * Used for both Off-Peak (DynamicInputsScreen) and Flux/EPVS (EPVSDynamicInputsScreen) calculators
 */

export const SOLAR_INVERTER_MANUFACTURERS = [
  'S EcoFlow',
];

export const SOLAR_INVERTER_MODELS: Record<string, string[]> = {
  'S EcoFlow': [
    'PowerOcean HD-P1-3K-S1',
    'PowerOcean HD-P1-3.68K-S1',
    'PowerOcean HD-P1-4.6K-S1',
    'PowerOcean HD-P1-5K-S1',
    'PowerOcean HD-P1-6K-S1',
  ],
};

/**
 * Get solar/hybrid inverter models for a specific manufacturer
 */
export function getSolarInverterModels(manufacturer: string): string[] {
  return SOLAR_INVERTER_MODELS[manufacturer] || [];
}

