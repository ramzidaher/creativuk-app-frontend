/**
 * Client-side field definitions for EPVSDynamicInputsScreen (Flux calculator)
 * This allows instant display without waiting for Excel API calls
 * Fields are shown/hidden based on selectedTemplateOptions and radio button selections
 */

import { rangeOptions } from './dynamicInputFields';

export interface EPVSInputFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  required: boolean;
  cellReference: string; // Excel cell reference for backend
  /** Static dropdown options; when set with allowOverride, renders as dropdown (primary) + editable override */
  dropdownOptions?: string[];
  /** If true and dropdownOptions set, user can type a custom value as override */
  allowOverride?: boolean;
  /** Shown below the field */
  helperText?: string;
  enabledBy?: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  }; // Field is enabled if ANY of these template options are true
  // Radio button conditional logic
  enabledByRadioButton?: {
    groupTitle: string; // Radio button group title (e.g., '⚡ Energy Use')
    enabledFor: string[]; // Shape names that enable this field (e.g., ['DualRate'])
  }[];
  disabledByRadioButton?: {
    groupTitle: string;
    disabledFor: string[]; // Shape names that disable this field (e.g., ['SingleRate'])
  }[];
  dependsOn?: string; // Cascading dropdown - depends on this field ID
  alwaysShowForFlux?: boolean; // For Flux calculator, always show regardless of template selection
}

/**
 * Master list of all EPVS dynamic input fields
 * Fields are shown/hidden based on template selections and radio button selections
 */
export const EPVS_DYNAMIC_INPUT_FIELDS: EPVSInputFieldDefinition[] = [
  // FLUX: CURRENT ELECTRICITY TARIFF FIELDS - Based on Energy Use radio button (dropdown primary, override secondary)
  {
    id: 'current_single_peak_rate',
    label: 'Single / Peak Rate (pence per kWh)',
    type: 'number',
    required: false,
    cellReference: 'H20',
    dropdownOptions: rangeOptions(10, 35), // 10p to 35p
    allowOverride: true,
    enabledByRadioButton: [
      { groupTitle: '⚡ Energy Use', enabledFor: ['SingleRate', 'DualRate'] }
    ]
  },
  {
    id: 'current_off_peak_rate',
    label: 'Off-Peak Rate (pence per kWh)',
    type: 'number',
    required: false,
    cellReference: 'H21',
    dropdownOptions: rangeOptions(5, 20), // 5p to 20p
    allowOverride: true,
    enabledByRadioButton: [
      { groupTitle: '⚡ Energy Use', enabledFor: ['DualRate'] }
    ],
    disabledByRadioButton: [
      { groupTitle: '⚡ Energy Use', disabledFor: ['SingleRate'] }
    ]
  },
  {
    id: 'current_off_peak_hours',
    label: 'No. of Off-Peak Hours',
    type: 'number',
    required: false,
    cellReference: 'H22',
    dropdownOptions: rangeOptions(1, 10), // 1 to 10 hr
    allowOverride: true,
    enabledByRadioButton: [
      { groupTitle: '⚡ Energy Use', enabledFor: ['DualRate'] }
    ],
    disabledByRadioButton: [
      { groupTitle: '⚡ Energy Use', disabledFor: ['SingleRate'] }
    ]
  },

  // FLUX SPECIFIC: NO NEW ELECTRICITY TARIFF - Not present in Flux
  // FLUX SPECIFIC: NO EXPORT TARIFF - Not present in Flux

  // FLUX: ELECTRICITY CONSUMPTION FIELDS - Based on Energy Use (Single/Dual Rate) AND Annual Usage (Yes/No)
  // Logic:
  // DUAL RATE:
  //   - If Yes → enable: Estimated Peak Annual Usage, Estimated Off-Peak Annual Usage, Standing Charge
  //   - If No → enable: Peak Annual Spend, Off-Peak Annual Spend, Standing Charge
  // SINGLE RATE:
  //   - If Yes → enable: Estimated Annual Usage, Standing Charge
  //   - If No → enable: Total Annual Spend, Standing Charge
  {
    id: 'estimated_annual_usage',
    label: 'Estimated Annual Usage (kWh)',
    type: 'number',
    required: false,
    cellReference: 'H26',
    // Enabled when Single Rate + Yes is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['SingleRate'] // Only for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionYes'] // Only when Yes is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['DualRate'] // Disabled for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionNo'] // Disabled when No is selected
      }
    ]
  },
  {
    id: 'estimated_peak_annual_usage',
    label: 'Estimated Peak Annual Usage (kWh)',
    type: 'number',
    required: false,
    cellReference: 'H27',
    // Enabled when Dual Rate + Yes is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['DualRate'] // Only for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionYes'] // Only when Yes is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['SingleRate'] // Disabled for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionNo'] // Disabled when No is selected
      }
    ]
  },
  {
    id: 'estimated_off_peak_annual_usage',
    label: 'Estimated Off-Peak Annual Usage (kWh)',
    type: 'number',
    required: false,
    cellReference: 'H28',
    // Enabled when Dual Rate + Yes is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['DualRate'] // Only for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionYes'] // Only when Yes is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['SingleRate'] // Disabled for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionNo'] // Disabled when No is selected
      }
    ]
  },
  {
    id: 'standing_charge',
    label: 'Standing Charge (pence per day)',
    type: 'number',
    required: false,
    cellReference: 'H29',
    // Always enabled regardless of selections
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['SingleRate', 'DualRate'] // Enabled for both
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionYes', 'AnnualConsumptionNo'] // Enabled for both
      }
    ]
  },
  {
    id: 'total_annual_spend',
    label: 'Total Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'H30',
    // Enabled when Single Rate + No is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['SingleRate'] // Only for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionNo'] // Only when No is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['DualRate'] // Disabled for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionYes'] // Disabled when Yes is selected
      }
    ]
  },
  {
    id: 'peak_annual_spend',
    label: 'Peak Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'H31',
    // Enabled when Dual Rate + No is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['DualRate'] // Only for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionNo'] // Only when No is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['SingleRate'] // Disabled for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionYes'] // Disabled when Yes is selected
      }
    ]
  },
  {
    id: 'off_peak_annual_spend',
    label: 'Off-Peak Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'H32',
    // Enabled when Dual Rate + No is selected
    enabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        enabledFor: ['DualRate'] // Only for Dual Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        enabledFor: ['AnnualConsumptionNo'] // Only when No is selected
      }
    ],
    disabledByRadioButton: [
      {
        groupTitle: '⚡ Energy Use',
        disabledFor: ['SingleRate'] // Disabled for Single Rate
      },
      {
        groupTitle: '📊 Annual Usage',
        disabledFor: ['AnnualConsumptionYes'] // Disabled when Yes is selected
      }
    ]
  },

  // EXISTING SYSTEM FIELDS - Based on Existing Customer radio button (Image 3)
  {
    id: 'existing_sem',
    label: 'Existing SEM',
    type: 'number',
    required: false,
    cellReference: 'H34',
    enabledByRadioButton: [
      {
        groupTitle: '👤 Existing Customer',
        enabledFor: ['ExistingSolarYes'] // Only shows when Yes is selected
      }
    ]
  },
  {
    id: 'commissioning_date',
    label: 'Approximate Commissioning Date',
    type: 'date',
    required: false,
    cellReference: 'H35',
    enabledByRadioButton: [
      {
        groupTitle: '👤 Existing Customer',
        enabledFor: ['ExistingSolarYes'] // Only shows when Yes is selected
      }
    ]
  },
  {
    id: 'sem_percentage',
    label: 'Percentage of above SEM used to quote self-consumption savings at time of installation (if unknown use 50%)',
    type: 'number',
    required: false,
    cellReference: 'H36',
    enabledByRadioButton: [
      {
        groupTitle: '👤 Existing Customer',
        enabledFor: ['ExistingSolarYes'] // Only shows when Yes is selected
      }
    ]
  },

  // SOLAR PANEL FIELDS - Shown when solar is selected
  {
    id: 'panel_manufacturer',
    label: 'Panel Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'H41',
    enabledBy: { solar: true },
  },
  {
    id: 'panel_model',
    label: 'Panel Model',
    type: 'dropdown',
    required: true,
    cellReference: 'H42',
    enabledBy: { solar: true },
    dependsOn: 'panel_manufacturer',
  },
  {
    id: 'number_of_arrays',
    label: 'No. of Arrays',
    type: 'number',
    required: true,
    cellReference: 'H43',
    enabledBy: { solar: true },
  },

  // BATTERY FIELDS - Always shown for Flux calculator (or when battery is selected)
  {
    id: 'battery_manufacturer',
    label: 'Battery Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'H45',
    enabledBy: { battery: true },
    alwaysShowForFlux: true, // Always show for Flux calculator
  },
  {
    id: 'battery_model',
    label: 'Battery Model',
    type: 'dropdown',
    required: true,
    cellReference: 'H46',
    enabledBy: { battery: true },
    dependsOn: 'battery_manufacturer',
    alwaysShowForFlux: true,
  },
  {
    id: 'battery_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'H49',
    enabledBy: { battery: true },
    alwaysShowForFlux: true,
    enabledByRadioButton: [
      {
        groupTitle: '🔋 Battery Warranty',
        enabledFor: ['BatteryWarrantyYes'] // Only enabled when Yes is selected
      }
    ]
  },
  {
    id: 'battery_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'H50',
    enabledBy: { battery: true },
    alwaysShowForFlux: true,
  },

  // SOLAR/HYBRID INVERTER FIELDS - Shown when solarHybrid is selected
  {
    id: 'solar_inverter_manufacturer',
    label: 'Solar/Hybrid Inverter Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'H52',
    enabledBy: { solarHybrid: true },
  },
  {
    id: 'solar_inverter_model',
    label: 'Solar/Hybrid Inverter Model',
    type: 'dropdown',
    required: true,
    cellReference: 'H53',
    enabledBy: { solarHybrid: true },
    dependsOn: 'solar_inverter_manufacturer',
  },
  {
    id: 'solar_inverter_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'H56',
    enabledBy: { solarHybrid: true },
    enabledByRadioButton: [
      {
        groupTitle: '☀️ Solar/Hybrid Warranty',
        enabledFor: ['SolarInverterWarrantyYes'] // Only enabled when Yes is selected
      }
    ]
  },
  {
    id: 'solar_inverter_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'H57',
    enabledBy: { solarHybrid: true },
  },

  // BATTERY INVERTER FIELDS - Shown when batteryInverter is selected
  {
    id: 'battery_inverter_manufacturer',
    label: 'Battery Inverter Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'H59',
    enabledBy: { batteryInverter: true },
  },
  {
    id: 'battery_inverter_model',
    label: 'Battery Inverter Model',
    type: 'dropdown',
    required: true,
    cellReference: 'H60',
    enabledBy: { batteryInverter: true },
    dependsOn: 'battery_inverter_manufacturer',
  },
  {
    id: 'battery_inverter_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'H63',
    enabledBy: { batteryInverter: true },
    enabledByRadioButton: [
      {
        groupTitle: '🔌 Battery Inverter Warranty',
        enabledFor: ['BatteryInverterWarrantyYes'] // Only enabled when Yes is selected
      }
    ]
  },
  {
    id: 'battery_inverter_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'H64',
    enabledBy: { batteryInverter: true },
  },
];

/**
 * Get fields that should be enabled based on template selection, calculator type, and radio button selections
 */
export function getEPVSEnabledFields(
  selectedTemplateOptions?: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  },
  calculatorType?: 'flux' | 'off-peak' | 'epvs',
  radioButtonSelections?: Record<string, string> // Maps group title to shapeName (e.g., {'📊 Annual Usage': 'AnnualConsumptionYes'})
): EPVSInputFieldDefinition[] {
  const isFlux = calculatorType === 'flux' || calculatorType === 'epvs';

  console.log('🔍 getEPVSEnabledFields - Flux logic:', {
    isFlux,
    selectedTemplateOptions,
    selectedTemplateOptionsType: typeof selectedTemplateOptions,
    selectedTemplateOptionsKeys: selectedTemplateOptions ? Object.keys(selectedTemplateOptions) : [],
    selectedTemplateOptionsStringified: selectedTemplateOptions ? JSON.stringify(selectedTemplateOptions, null, 2) : 'null/undefined',
    calculatorType,
    radioButtonSelections: radioButtonSelections ? JSON.stringify(radioButtonSelections) : 'null/undefined',
    radioButtonSelectionsType: typeof radioButtonSelections,
    radioButtonSelectionsKeys: radioButtonSelections ? Object.keys(radioButtonSelections) : []
  });

  if (!selectedTemplateOptions && !isFlux) {
    return EPVS_DYNAMIC_INPUT_FIELDS.filter(
      field => !field.enabledBy && !field.disabledByRadioButton && !field.alwaysShowForFlux && !field.enabledByRadioButton
    );
  }

  // Validate radioButtonSelections - ensure it's an object, not a string
  let validRadioButtonSelections: Record<string, string> | undefined;
  if (radioButtonSelections) {
    if (typeof radioButtonSelections === 'object' && radioButtonSelections !== null && !Array.isArray(radioButtonSelections)) {
      validRadioButtonSelections = radioButtonSelections;
    } else if (typeof radioButtonSelections === 'string' && radioButtonSelections !== '[object Object]') {
      try {
        validRadioButtonSelections = JSON.parse(radioButtonSelections);
      } catch (e) {
        console.warn('⚠️ Could not parse radioButtonSelections, treating as invalid:', e);
        validRadioButtonSelections = undefined;
      }
    } else {
      console.warn('⚠️ radioButtonSelections is invalid type, treating as undefined');
      validRadioButtonSelections = undefined;
    }
  }

  return EPVS_DYNAMIC_INPUT_FIELDS.filter(field => {
    // ====== STEP 1: Check disabledByRadioButton condition FIRST (highest priority) ======
    // If a field is disabled by radio button, completely exclude it from the list
    if (field.disabledByRadioButton && validRadioButtonSelections) {
      const shouldDisable = field.disabledByRadioButton.some(rule => {
        let selectedValue = validRadioButtonSelections![rule.groupTitle];
        
        // Handle both "📊 Annual Usage" and "📊 Annual Consumption" group titles
        if (!selectedValue && rule.groupTitle === '📊 Annual Usage') {
          selectedValue = validRadioButtonSelections!['📊 Annual Consumption'];
        } else if (!selectedValue && rule.groupTitle === '📊 Annual Consumption') {
          selectedValue = validRadioButtonSelections!['📊 Annual Usage'];
        }
        
        return selectedValue && rule.disabledFor.includes(selectedValue);
      });
      if (shouldDisable) {
        console.log(`🚫 Hiding EPVS field ${field.id} - disabled by radio condition`);
        return false; // Completely exclude this field
      }
    }

    // ====== STEP 2: Check enabledByRadioButton condition ======
    // If a field has enabledByRadioButton, ALL conditions must be met (not just SOME)
    // This allows fields to require BOTH Energy Use AND Annual Usage selections
    if (field.enabledByRadioButton && validRadioButtonSelections) {
      // Check that ALL enabledByRadioButton conditions are met
      // Support both "📊 Annual Usage" and "📊 Annual Consumption" group titles
      const allConditionsMet = field.enabledByRadioButton.every(rule => {
        let selectedValue = validRadioButtonSelections![rule.groupTitle];
        
        // Handle both "📊 Annual Usage" and "📊 Annual Consumption" group titles
        if (!selectedValue && rule.groupTitle === '📊 Annual Usage') {
          selectedValue = validRadioButtonSelections!['📊 Annual Consumption'];
        } else if (!selectedValue && rule.groupTitle === '📊 Annual Consumption') {
          selectedValue = validRadioButtonSelections!['📊 Annual Usage'];
        }
        
        return selectedValue && rule.enabledFor.includes(selectedValue);
      });
      if (!allConditionsMet) {
        console.log(`🚫 Hiding EPVS field ${field.id} - not all radio conditions met`, {
          enabledByRadioButton: field.enabledByRadioButton,
          validRadioButtonSelections,
          allConditionsMet
        });
        return false; // Completely exclude this field if not all conditions are met
      }
    }

    // ====== STEP 3: Flux-specific: Always show battery fields for Flux calculator ======
    if (isFlux && field.alwaysShowForFlux) {
      // Still need to check radio button conditions for extended warranty fields
      if (field.enabledByRadioButton && validRadioButtonSelections) {
        const shouldEnable = field.enabledByRadioButton.some(rule => {
          const selectedValue = validRadioButtonSelections![rule.groupTitle];
          return selectedValue && rule.enabledFor.includes(selectedValue);
        });
        if (!shouldEnable) {
          // Extended warranty fields need "Yes" to be selected
          return false;
        }
      }
      return true;
    }

    // ====== STEP 4: Check enabledBy condition (template-based) ======
    if (field.enabledBy) {
      // If no template options provided but field has enabledBy, only show if it has alwaysShowForFlux
      if (!selectedTemplateOptions) {
        console.log(`🔍 EPVS field ${field.id} - no template options provided, checking alwaysShowForFlux`);
        if (isFlux && field.alwaysShowForFlux) {
          // Still need to check radio button conditions for warranty fields
          if (field.enabledByRadioButton && validRadioButtonSelections) {
            const shouldEnableRadio = field.enabledByRadioButton.some(rule => {
              const selectedValue = validRadioButtonSelections![rule.groupTitle];
              return selectedValue && rule.enabledFor.includes(selectedValue);
            });
            return shouldEnableRadio;
          }
          return true;
        }
        // If no template options and no alwaysShowForFlux, hide the field
        console.log(`🚫 EPVS field ${field.id} - no template options and no alwaysShowForFlux, hiding`);
        return false;
      }
      
      const shouldEnable = Object.entries(field.enabledBy).some(
        ([key, value]) => {
          // Try multiple ways to access the template value
          // 1. Direct property access
          let templateValue = selectedTemplateOptions?.[key as keyof typeof selectedTemplateOptions];
          
          // 2. If undefined, try lowercase key
          if (templateValue === undefined && selectedTemplateOptions) {
            const lowerKey = key.toLowerCase();
            templateValue = (selectedTemplateOptions as any)[lowerKey];
          }
          
          // 3. If still undefined, check all keys case-insensitively
          if (templateValue === undefined && selectedTemplateOptions) {
            const matchingKey = Object.keys(selectedTemplateOptions).find(k => k.toLowerCase() === key.toLowerCase());
            if (matchingKey) {
              templateValue = (selectedTemplateOptions as any)[matchingKey];
            }
          }
          
          // Handle both boolean true and string "true" comparisons
          const matches = templateValue === value || (templateValue === true && value === true) || (String(templateValue) === String(value) && value === true);
          console.log(`🔍 EPVS field ${field.id} - checking ${key}: templateValue=${templateValue} (${typeof templateValue}), expected=${value} (${typeof value}), matches=${matches}`);
          console.log(`🔍 EPVS field ${field.id} - available keys in templateOptions:`, selectedTemplateOptions ? Object.keys(selectedTemplateOptions) : []);
          return matches;
        }
      );
      
      if (!shouldEnable) {
        console.log(`🚫 EPVS field ${field.id} - template condition not met:`, {
          enabledBy: field.enabledBy,
          selectedTemplateOptions,
          selectedTemplateOptionsType: typeof selectedTemplateOptions,
          selectedTemplateOptionsKeys: selectedTemplateOptions ? Object.keys(selectedTemplateOptions) : [],
          isFlux,
          alwaysShowForFlux: field.alwaysShowForFlux
        });
        
        // For Flux, still show battery fields even if battery option is not explicitly selected
        if (isFlux && field.alwaysShowForFlux) {
          // Still need to check radio button conditions for warranty fields
          if (field.enabledByRadioButton && validRadioButtonSelections) {
            const shouldEnableRadio = field.enabledByRadioButton.some(rule => {
              const selectedValue = validRadioButtonSelections![rule.groupTitle];
              return selectedValue && rule.enabledFor.includes(selectedValue);
            });
            return shouldEnableRadio;
          }
          return true;
        }
        return false;
      } else {
        console.log(`✅ EPVS field ${field.id} - template condition met, field enabled`);
      }
    }

    // ====== STEP 5: If field has enabledByRadioButton but no radio selections exist, hide it ======
    // Fields that require radio button conditions should not show if no selections are available
    if (field.enabledByRadioButton && (!validRadioButtonSelections || Object.keys(validRadioButtonSelections).length === 0)) {
      console.log(`🚫 Hiding EPVS field ${field.id} - requires radio button selection but none available`);
      return false;
    }

    // ====== STEP 6: For consumption fields, ensure they have radio button conditions ======
    // Electricity consumption fields MUST have radio button conditions - hide if they don't meet them
    const consumptionFields = [
      'estimated_annual_usage', 'estimated_peak_annual_usage', 'estimated_off_peak_annual_usage',
      'standing_charge', 'total_annual_spend', 'peak_annual_spend', 'off_peak_annual_spend'
    ];
    if (consumptionFields.includes(field.id)) {
      // These fields MUST have radio button conditions and meet them
      if (!field.enabledByRadioButton || !field.disabledByRadioButton) {
        // If a consumption field doesn't have proper conditions, check if it should be visible
        if (field.enabledByRadioButton) {
          // Has enabledBy but might not meet condition - already checked above
          // Continue to final check
        } else {
          // Consumption field without enabledByRadioButton should not show unless it's always disabled
          if (!field.disabledByRadioButton) {
            console.log(`🚫 Hiding EPVS consumption field ${field.id} - missing radio button conditions`);
            return false;
          }
        }
      }
    }

    // Field passed all checks
    return true;
  });
}

/**
 * Convert field definition to InputField format for the component
 */
export function toEPVSInputField(
  fieldDef: EPVSInputFieldDefinition,
  value: string = '',
  dropdownOptions: string[] = []
): {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  value: string;
  required: boolean;
  enabled: boolean;
  cellReference: string;
  dropdownOptions?: string[];
  allowOverride?: boolean;
  helperText?: string;
} {
  const options = fieldDef.type === 'dropdown' && dropdownOptions.length > 0
    ? dropdownOptions
    : (fieldDef.dropdownOptions ?? []);
  return {
    id: fieldDef.id,
    label: fieldDef.label,
    type: fieldDef.type,
    value,
    required: fieldDef.required,
    enabled: true,
    cellReference: fieldDef.cellReference,
    ...(options.length > 0 ? { dropdownOptions: options } : {}),
    ...(fieldDef.allowOverride === true ? { allowOverride: true } : {}),
    ...(fieldDef.helperText ? { helperText: fieldDef.helperText } : {}),
  };
}





