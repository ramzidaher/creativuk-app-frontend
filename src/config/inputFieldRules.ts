export interface InputFieldRule {
  fieldId: string;
  disabledFor: string[]; // Array of radio button shape names that disable this field
  enabledFor?: string[]; // Array of radio button shape names that enable this field (optional)
}

export interface RadioButtonGroup {
  title: string;
  description: string;
  options: {
    label: string;
    endpoint: string;
    shapeName: string;
  }[];
}

// Define which input fields should be disabled for each radio button selection
export const inputFieldRules: InputFieldRule[] = [
  // ENERGY USE - CURRENT ELECTRICITY TARIFF
  {
    fieldId: 'single_day_rate',
    disabledFor: ['DualRate'], // Disable when Dual Rate is selected
  },
  {
    fieldId: 'night_rate',
    disabledFor: ['SingleRate'], // Disable when Single Rate is selected
  },
  {
    fieldId: 'off_peak_hours',
    disabledFor: ['SingleRate'], // Disable when Single Rate is selected
  },

  // ENERGY USE - NEW ELECTRICITY TARIFF
  {
    fieldId: 'new_day_rate',
    disabledFor: ['DualRate'], // Disable when Dual Rate is selected
  },
  {
    fieldId: 'new_night_rate',
    disabledFor: ['SingleRate'], // Disable when Single Rate is selected
  },

  // ENERGY USE - EXPORT TARIFF
  {
    fieldId: 'export_tariff_rate',
    disabledFor: ['ExportNo'], // Disable when Export Tariff No is selected
  },

  // EXISTING SYSTEM
  {
    fieldId: 'existing_sem',
    disabledFor: ['ExistingSolarNo'], // Disable when No Existing Solar is selected
  },
  {
    fieldId: 'commissioning_date',
    disabledFor: ['ExistingSolarNo'], // Disable when No Existing Solar is selected
  },
  {
    fieldId: 'sem_percentage',
    disabledFor: ['ExistingSolarNo'], // Disable when No Existing Solar is selected
  },

  // NEW SYSTEM - BATTERY (all battery-related fields)
  {
    fieldId: 'battery_manufacturer',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_model',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_warranty_years',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_extended_warranty_years',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_replacement_cost',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_inverter_manufacturer',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_inverter_model',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_inverter_warranty_years',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_inverter_extended_warranty_years',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },
  {
    fieldId: 'battery_inverter_replacement_cost',
    disabledFor: ['BatteryNone'], // Disable when No Battery is selected
  },

  // ANNUAL CONSUMPTION - if user doesn't have consumption data
  {
    fieldId: 'annual_usage',
    disabledFor: ['AnnualConsumptionNo'], // Disable when No Annual Consumption is selected
  },
  {
    fieldId: 'standing_charge',
    disabledFor: ['AnnualConsumptionNo'], // Disable when No Annual Consumption is selected
  },
  {
    fieldId: 'annual_spend',
    disabledFor: ['AnnualConsumptionNo'], // Disable when No Annual Consumption is selected
  },

  // WARRANTY FIELDS - based on warranty selections
  {
    fieldId: 'battery_warranty_years',
    disabledFor: ['BatteryWarrantyNo'], // Disable when Battery Warranty No is selected
  },
  {
    fieldId: 'battery_extended_warranty_years',
    disabledFor: ['BatteryWarrantyNo'], // Disable when Battery Warranty No is selected
  },
  {
    fieldId: 'battery_replacement_cost',
    disabledFor: ['BatteryWarrantyNo'], // Disable when Battery Warranty No is selected
  },
  {
    fieldId: 'solar_inverter_warranty_years',
    disabledFor: ['SolarInverterWarrantyNo'], // Disable when Solar Inverter Warranty No is selected
  },
  {
    fieldId: 'solar_inverter_extended_warranty_years',
    disabledFor: ['SolarInverterWarrantyNo'], // Disable when Solar Inverter Warranty No is selected
  },
  {
    fieldId: 'solar_inverter_replacement_cost',
    disabledFor: ['SolarInverterWarrantyNo'], // Disable when Solar Inverter Warranty No is selected
  },
  {
    fieldId: 'battery_inverter_warranty_years',
    disabledFor: ['BatteryInverterWarrantyNo'], // Disable when Battery Inverter Warranty No is selected
  },
  {
    fieldId: 'battery_inverter_extended_warranty_years',
    disabledFor: ['BatteryInverterWarrantyNo'], // Disable when Battery Inverter Warranty No is selected
  },
  {
    fieldId: 'battery_inverter_replacement_cost',
    disabledFor: ['BatteryInverterWarrantyNo'], // Disable when Battery Inverter Warranty No is selected
  },
];

// Helper function to determine if a field should be disabled based on selected radio buttons
export function isFieldDisabled(fieldId: string, selectedOptions: Record<string, string>): boolean {
  const rule = inputFieldRules.find(r => r.fieldId === fieldId);
  if (!rule) return false; // No rule means field is always enabled

  // Check if any of the selected radio buttons should disable this field
  const selectedShapeNames = Object.values(selectedOptions);
  const shouldDisable = selectedShapeNames.some(shapeName => 
    rule.disabledFor.includes(shapeName)
  );

  // If there's an enabledFor rule, check if any selected options enable the field
  if (rule.enabledFor && rule.enabledFor.length > 0) {
    const shouldEnable = selectedShapeNames.some(shapeName => 
      rule.enabledFor!.includes(shapeName)
    );
    return !shouldEnable; // Field is disabled if no enabling option is selected
  }

  return shouldDisable;
}

// Helper function to get all field IDs that should be disabled for given selections
export function getDisabledFields(selectedOptions: Record<string, string>): string[] {
  const disabledFields: string[] = [];
  
  // Get all unique field IDs from rules
  const allFieldIds = [...new Set(inputFieldRules.map(rule => rule.fieldId))];
  
  allFieldIds.forEach(fieldId => {
    if (isFieldDisabled(fieldId, selectedOptions)) {
      disabledFields.push(fieldId);
    }
  });
  
  return disabledFields;
}
