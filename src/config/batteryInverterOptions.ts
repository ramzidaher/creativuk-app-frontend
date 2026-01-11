/**
 * Battery inverter manufacturer and model options
 * Used for both Off-Peak (DynamicInputsScreen) and Flux/EPVS (EPVSDynamicInputsScreen) calculators
 */

export const BATTERY_INVERTER_MANUFACTURERS = [
  'B Growatt',
  'B Lux Power',
  'B Sunsynk',
];

export const BATTERY_INVERTER_MODELS: Record<string, string[]> = {
  'B Growatt': [
    'MIN 2500-6000 TL-XH',
    'MIN 2500-5000 TL-XA',
    'MOD 3000-10000TL3-XH',
    'SPH 3000-6000TL BL-UP',
    'SPH 4000-10000TL3 BH-UP',
    'SPA 4000-10000TL3 BH-UP',
    'MIN 3000-11400TL-XH-US',
  ],
  'B Lux Power': [
    'LXP 3600ACS',
  ],
  'B Sunsynk': [
    '3.6kW Hybrid Inverter',
    '5kW Hybrid Inverter',
    '7kW Hybrid Inverter',
    '8kW Hybrid Inverter',
    '16kW Hybrid Inverter',
  ],
};

/**
 * Get battery inverter models for a specific manufacturer
 */
export function getBatteryInverterModels(manufacturer: string): string[] {
  return BATTERY_INVERTER_MODELS[manufacturer] || [];
}

































