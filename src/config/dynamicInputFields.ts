/**
 * Client-side field definitions for DynamicInputsScreen
 * This allows instant display without waiting for Excel API calls
 */

/** Options for dropdown-with-override (e.g. "5", "6", … "20" for 5p–20p) */
export function rangeOptions(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

export interface InputFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  required: boolean;
  cellReference: string; // Excel cell reference for backend
  /** Static dropdown options; when set with allowOverride, renders as dropdown + editable number (override) */
  dropdownOptions?: string[];
  /** If true and dropdownOptions set, user can type a custom value instead of picking from list */
  allowOverride?: boolean;
  /** Shown below the field (e.g. "Use current rates") */
  helperText?: string;
  enabledBy?: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  }; // Field is enabled if ANY of these template options are true
  disabledBy?: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  }; // Field is disabled if ANY of these template options are true
  dependsOn?: string; // Cascading dropdown - depends on this field ID
  alwaysShowForFlux?: boolean; // For Flux calculator, always show regardless of template selection
  // Radio button conditional logic
  enabledByRadio?: {
    // Format: { radioGroupTitle: [array of shapeName values that enable this field] }
    // e.g., { '⚡ Energy Use': ['SingleRate'] } means field enabled when SingleRate is selected
    [radioGroupTitle: string]: string[];
  };
  disabledByRadio?: {
    [radioGroupTitle: string]: string[];
  };
}

/**
 * Master list of all dynamic input fields
 * Fields are shown/hidden based on selectedTemplateOptions
 */
export const DYNAMIC_INPUT_FIELDS: InputFieldDefinition[] = [
  // SOLAR PANEL FIELDS - Shown when solar is selected (Image 2)
  {
    id: 'panel_manufacturer',
    label: 'Panel Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'C10', // Update with actual cell reference
    enabledBy: { solar: true },
  },
  {
    id: 'panel_model',
    label: 'Panel Model',
    type: 'dropdown',
    required: true,
    cellReference: 'C11',
    enabledBy: { solar: true },
    dependsOn: 'panel_manufacturer',
  },
  {
    id: 'number_of_arrays',
    label: 'No. of Arrays',
    type: 'number',
    required: true,
    cellReference: 'C12',
    enabledBy: { solar: true },
  },

  // BATTERY FIELDS - Always shown for Flux calculator, or when battery is selected (Image 1)
  {
    id: 'battery_manufacturer',
    label: 'Battery Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'C20',
    enabledBy: { battery: true },
    alwaysShowForFlux: true, // Always show for Flux calculator
  },
  {
    id: 'battery_model',
    label: 'Battery Model',
    type: 'dropdown',
    required: true,
    cellReference: 'C21',
    enabledBy: { battery: true },
    dependsOn: 'battery_manufacturer',
    alwaysShowForFlux: true,
  },
  {
    id: 'battery_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'C24',
    enabledBy: { battery: true },
    alwaysShowForFlux: true,
  },
  {
    id: 'battery_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'C25',
    enabledBy: { battery: true },
    alwaysShowForFlux: true,
  },

  // SOLAR/HYBRID INVERTER FIELDS - Always shown when solarHybrid is selected (Image 3)
  {
    id: 'solar_inverter_manufacturer',
    label: 'Solar/Hybrid Inverter Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'C30',
    enabledBy: { solarHybrid: true },
  },
  {
    id: 'solar_inverter_model',
    label: 'Solar/Hybrid Inverter Model',
    type: 'dropdown',
    required: true,
    cellReference: 'C31',
    enabledBy: { solarHybrid: true },
    dependsOn: 'solar_inverter_manufacturer',
  },
  {
    id: 'solar_inverter_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'C34',
    enabledBy: { solarHybrid: true },
  },
  {
    id: 'solar_inverter_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'C35',
    enabledBy: { solarHybrid: true },
  },

  // BATTERY INVERTER FIELDS - Always shown when batteryInverter is selected (Image 4)
  {
    id: 'battery_inverter_manufacturer',
    label: 'Battery Inverter Manufacturer',
    type: 'dropdown',
    required: true,
    cellReference: 'C40',
    enabledBy: { batteryInverter: true },
  },
  {
    id: 'battery_inverter_model',
    label: 'Battery Inverter Model',
    type: 'dropdown',
    required: true,
    cellReference: 'C41',
    enabledBy: { batteryInverter: true },
    dependsOn: 'battery_inverter_manufacturer',
  },
  {
    id: 'battery_inverter_extended_warranty_years',
    label: 'Extended warranty period',
    type: 'number',
    required: false,
    cellReference: 'C44',
    enabledBy: { batteryInverter: true },
  },
  {
    id: 'battery_inverter_replacement_cost',
    label: 'Replacement Cost',
    type: 'number',
    required: false,
    cellReference: 'C45',
    enabledBy: { batteryInverter: true },
  },

  // OFF-PEAK SPECIFIC: CURRENT ELECTRICITY TARIFF (ENERGY USE section) — dropdown with override
  {
    id: 'current_single_day_rate',
    label: 'Single / Day Rate (p/kWh)',
    type: 'number',
    required: false,
    cellReference: 'C50',
    dropdownOptions: rangeOptions(10, 35), // 10p to 35p
    allowOverride: true,
    enabledByRadio: { '⚡ Energy Use': ['SingleRate', 'DualRate'] },
  },
  {
    id: 'current_night_rate',
    label: 'Night Rate (p/kWh)',
    type: 'number',
    required: false,
    cellReference: 'C51',
    dropdownOptions: rangeOptions(5, 20), // 5p to 20p
    allowOverride: true,
    enabledByRadio: { '⚡ Energy Use': ['DualRate'] },
  },
  {
    id: 'current_off_peak_hours',
    label: 'No. of Off-Peak Hours',
    type: 'number',
    required: false,
    cellReference: 'C52',
    dropdownOptions: rangeOptions(1, 10), // 1 to 10 hr
    allowOverride: true,
    enabledByRadio: { '⚡ Energy Use': ['DualRate'] },
  },

  // OFF-PEAK SPECIFIC: NEW ELECTRICITY TARIFF (ENERGY USE section) — dropdown with override
  {
    id: 'new_day_rate',
    label: 'Day Rate (p/kWh)',
    type: 'number',
    required: false,
    cellReference: 'C53',
    dropdownOptions: rangeOptions(10, 35), // 10p to 35p
    allowOverride: true,
    enabledByRadio: { '🔋 Battery Type': ['BatteryOC'] },
  },
  {
    id: 'new_night_rate',
    label: 'Night Rate (p/kWh)',
    type: 'number',
    required: false,
    cellReference: 'C54',
    dropdownOptions: rangeOptions(5, 20), // 5p to 20p
    allowOverride: true,
    enabledByRadio: { '🔋 Battery Type': ['BatteryOC'] },
  },

  // OFF-PEAK: ELECTRICITY CONSUMPTION fields - Based ONLY on Annual Consumption (Yes/No)
  // Logic (for both Single Rate and Dual Rate):
  //   - If Yes → enable: Estimated Annual Usage (kWh), disable: Standing Charge, Annual Spend
  //   - If No → enable: Standing Charge, Annual Spend, disable: Estimated Annual Usage
  {
    id: 'estimated_annual_usage',
    label: 'Estimated Annual Usage (kWh)',
    type: 'number',
    required: false,
    cellReference: 'C55',
    // Off-Peak: Enabled when Annual Consumption is Yes (for both Single and Dual Rate)
    enabledByRadio: { 
      '📊 Annual Consumption': ['AnnualConsumptionYes'] // Only when Yes is selected (works for both Single and Dual Rate)
    },
    disabledByRadio: { 
      '📊 Annual Consumption': ['AnnualConsumptionNo'] // Disabled when No is selected
    },
  },
  {
    id: 'standing_charge',
    label: 'Standing Charge (pence per day)',
    type: 'number',
    required: false,
    cellReference: 'C56',
    // Off-Peak: 
    //   - Single Rate + Yes → disabled
    //   - Single Rate + No → enabled
    //   - Dual Rate + Yes → disabled
    //   - Dual Rate + No → enabled
    // Flux: Enabled when AnnualUsageYes OR AnnualUsageNo (both cases)
    enabledByRadio: { 
      '📊 Annual Consumption': ['AnnualConsumptionNo'], // Off-Peak: only when No (for both Single and Dual Rate)
      '📊 Annual Usage': ['AnnualConsumptionYes', 'AnnualConsumptionNo'] // Flux: both Yes and No
    },
    disabledByRadio: {
      // Off-Peak Single Rate + Yes: disabled
      // We need to check BOTH Single Rate AND Annual Consumption Yes
      // But we can't do AND in disabledByRadio, so we handle this in enabledByRadio above
    },
  },
  {
    id: 'annual_spend',
    label: 'Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'C57',
    // Off-Peak: Enabled when Annual Consumption is No (for both Single and Dual Rate)
    enabledByRadio: { 
      '📊 Annual Consumption': ['AnnualConsumptionNo'] // Only when No is selected (works for both Single and Dual Rate)
    },
    disabledByRadio: { 
      '📊 Annual Consumption': ['AnnualConsumptionYes'] // Disabled when Yes is selected
    },
  },

  // NOTE: estimated_peak_annual_usage and estimated_off_peak_annual_usage are Flux-only fields
  // They are defined in epvsDynamicInputFields.ts, not here
  {
    id: 'total_annual_spend',
    label: 'Total Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'C60',
    // For Flux: Enabled when Single Rate + No (checked in Flux-specific logic)
    // For Off-Peak: Not used (Off-Peak uses annual_spend for Single Rate)
    enabledByRadio: { 
      '📊 Annual Usage': ['AnnualConsumptionNo'] // Flux only
    },
    disabledByRadio: { 
      '📊 Annual Usage': ['AnnualConsumptionYes'] // Flux only
    },
  },
  {
    id: 'peak_annual_spend',
    label: 'Peak Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'C61',
    // Off-Peak: Enabled when Dual Rate + No is selected
    enabledByRadio: { 
      '⚡ Energy Use': ['DualRate'], // Only for Dual Rate (Off-Peak)
      '📊 Annual Consumption': ['AnnualConsumptionNo'] // Only when No is selected
    },
    disabledByRadio: { 
      '⚡ Energy Use': ['SingleRate'], // Disabled for Single Rate
      '📊 Annual Consumption': ['AnnualConsumptionYes'] // Disabled when Yes is selected
    },
  },
  {
    id: 'off_peak_annual_spend',
    label: 'Off-Peak Annual Spend (£)',
    type: 'number',
    required: false,
    cellReference: 'C62',
    // Off-Peak: Enabled when Dual Rate + No is selected
    enabledByRadio: { 
      '⚡ Energy Use': ['DualRate'], // Only for Dual Rate (Off-Peak)
      '📊 Annual Consumption': ['AnnualConsumptionNo'] // Only when No is selected
    },
    disabledByRadio: { 
      '⚡ Energy Use': ['SingleRate'], // Disabled for Single Rate
      '📊 Annual Consumption': ['AnnualConsumptionYes'] // Disabled when Yes is selected
    },
  },

  // OFF-PEAK: EXPORT TARIFF — dropdown 10p–15p, note: use current rates
  {
    id: 'export_tariff_rate',
    label: 'Import/Export Tariff Rate (p/kWh)',
    type: 'number',
    required: false,
    cellReference: 'C63',
    dropdownOptions: rangeOptions(10, 15),
    allowOverride: true,
    helperText: 'Use current rates',
    enabledByRadio: { '⚡ Import/Export Tariff': ['ExportYes'] },
    disabledByRadio: { '⚡ Import/Export Tariff': ['ExportNo'] },
  },

  // OFF-PEAK & FLUX: EXISTING SYSTEM
  {
    id: 'existing_sem',
    label: 'Existing SEM',
    type: 'text',
    required: false,
    cellReference: 'C64',
    // Enabled when ExistingSolarYes, disabled when ExistingSolarNo
    // For Off-Peak: '☀️ Existing Solar', For Flux: '👤 Existing Customer'
    enabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarYes'],
      '👤 Existing Customer': ['ExistingSolarYes'] 
    },
    disabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarNo'],
      '👤 Existing Customer': ['ExistingSolarNo'] 
    },
  },
  {
    id: 'approximate_commissioning_date',
    label: 'Approximate Commissioning Date',
    type: 'date',
    required: false,
    cellReference: 'C65',
    // Enabled when ExistingSolarYes, disabled when ExistingSolarNo
    // For Off-Peak: '☀️ Existing Solar', For Flux: '👤 Existing Customer'
    enabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarYes'],
      '👤 Existing Customer': ['ExistingSolarYes'] 
    },
    disabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarNo'],
      '👤 Existing Customer': ['ExistingSolarNo'] 
    },
  },
  {
    id: 'percentage_above_sem',
    label: 'Percentage of above SEM used to quote self-consumption savings at time of installation',
    type: 'number',
    required: false,
    cellReference: 'C66',
    // Enabled when ExistingSolarYes, disabled when ExistingSolarNo
    // For Off-Peak: '☀️ Existing Solar', For Flux: '👤 Existing Customer'
    enabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarYes'],
      '👤 Existing Customer': ['ExistingSolarYes'] 
    },
    disabledByRadio: { 
      '☀️ Existing Solar': ['ExistingSolarNo'],
      '👤 Existing Customer': ['ExistingSolarNo'] 
    },
  },
];

/**
 * Get fields that should be enabled based on template selection, calculator type, and radio button selections
 * 
 * ORDER OF EVALUATION (per flow document):
 * 1. Hide calculator-specific fields (Flux hides Off-Peak fields, Off-Peak hides Flux fields)
 * 2. Select template → apply ONE-TO-ONE baseline (template → group mapping)
 * 3. If Off-Peak → apply battery radio override (No Battery → disable BATTERY group)
 * 4. Apply Electricity Consumption radio logic (Off-Peak or Flux rules)
 * 5. If Off-Peak → apply Current/New Tariff and Export Tariff rules
 * 6. Apply Existing System radio logic
 * 7. Apply per-group Extended Warranty logic
 */
export function getEnabledFields(
  selectedTemplateOptions?: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  },
  calculatorType?: 'flux' | 'off-peak' | 'epvs',
  radioButtonSelections?: Record<string, string> // Radio button selections from CalculatorScreen (e.g., {'🔋 Battery Type': 'BatteryNone'})
): InputFieldDefinition[] {
  // For Flux calculator, always show battery fields regardless of template selection
  const isFlux = calculatorType === 'flux' || calculatorType === 'epvs';
  
  // For Off-Peak, check battery radio button selection
  const isOffPeak = calculatorType === 'off-peak';
  const batteryRadioSelection = radioButtonSelections?.['🔋 Battery Type'];
  const noBatterySelected = isOffPeak && batteryRadioSelection === 'BatteryNone';
  const batteryEnabledByRadio = isOffPeak && (batteryRadioSelection === 'BatterySC' || batteryRadioSelection === 'BatteryOC');

  console.log('🔍 getEnabledFields - Battery logic:', {
    isOffPeak,
    isFlux,
    batteryRadioSelection,
    noBatterySelected,
    batteryEnabledByRadio,
    radioButtonSelections
  });

  if (!selectedTemplateOptions && !isFlux) {
    // If no template options and not Flux, show only common fields
    return DYNAMIC_INPUT_FIELDS.filter(
      field => !field.enabledBy && !field.disabledBy && !field.alwaysShowForFlux
    );
  }

  return DYNAMIC_INPUT_FIELDS.filter(field => {
    // ====== STEP 0: Flux-specific: Hide Off-Peak only fields ======
    // Flux should NOT show Current/New Electricity Tariff or Export Tariff fields
    if (isFlux) {
      const offPeakOnlyFields = [
        'current_single_day_rate',
        'current_night_rate',
        'current_off_peak_hours',
        'new_day_rate',
        'new_night_rate',
        'export_tariff_rate',
        'annual_spend' // Off-Peak only, Flux uses total_annual_spend
      ];
      
      if (offPeakOnlyFields.includes(field.id)) {
        console.log(`🚫 Hiding Off-Peak-only field ${field.id} for Flux calculator`);
        return false;
      }
    }
    
    // ====== STEP 0.5: Off-Peak-specific: Hide Flux-only fields ======
    // Off-Peak should NOT show Flux-specific consumption fields
    // These fields (estimated_peak_annual_usage, estimated_off_peak_annual_usage) are Flux-only
    if (isOffPeak) {
      const fluxOnlyFields = [
        'estimated_peak_annual_usage',
        'estimated_off_peak_annual_usage',
        'total_annual_spend',
        'peak_annual_spend',
        'off_peak_annual_spend'
      ];
      
      if (fluxOnlyFields.includes(field.id)) {
        console.log(`🚫 Hiding Flux-only field ${field.id} for Off-Peak calculator`);
        return false;
      }
    }
    
    // ====== STEP 1: Off-Peak specific: Battery fields logic based on radio button selection ======
    if (isOffPeak && field.enabledBy?.battery) {
      // For Off-Peak, battery fields are NOT controlled by template selection
      // They are ONLY controlled by battery radio button selection
      console.log(`🔍 Checking battery field ${field.id}:`, {
        isOffPeak,
        batteryRadioSelection,
        noBatterySelected,
        batteryEnabledByRadio,
        fieldId: field.id
      });
      
      if (noBatterySelected) {
        console.log(`🚫 Hiding battery field ${field.id} because "No Battery" is selected`);
        return false;
      }
      // If "Self-Consumption Battery" or "Overnight Charging Battery" is selected, show battery fields
      if (batteryEnabledByRadio) {
        console.log(`✅ Showing battery field ${field.id} because battery radio selected: ${batteryRadioSelection}`);
        // Battery fields are enabled by radio, continue to check other conditions
        // But we need to bypass the template-based enabledBy check for battery fields in Off-Peak
        // Continue to check radio button conditions and warranty logic below
      } else {
        // If no battery radio selection yet, don't show battery fields (wait for user selection)
        console.log(`🚫 Hiding battery field ${field.id} - no battery radio selection or invalid selection. Selection value: "${batteryRadioSelection}", type: ${typeof batteryRadioSelection}`);
        return false;
      }
    }
    
    // ====== STEP 2: Check radio button enabledBy conditions ======
    if (field.enabledByRadio && Object.keys(field.enabledByRadio).length > 0) {
      // For consumption fields (except standing_charge), require ALL conditions to be met (AND logic)
      // For standing_charge, use special OR logic: (DualRate) OR (SingleRate AND No)
      // For other fields, check if any condition is met (OR logic)
      const isConsumptionField = [
        'estimated_annual_usage', 'estimated_peak_annual_usage', 'estimated_off_peak_annual_usage',
        'standing_charge', 'annual_spend', 'total_annual_spend', 'peak_annual_spend', 'off_peak_annual_spend'
      ].includes(field.id);
      
      let radioConditionMet: boolean;
      
      // Special handling for standing_charge (Off-Peak): Only enabled when Annual Consumption is No
      // Standing charge should NOT show when Annual Consumption is Yes (for both Single and Dual Rate)
      if (field.id === 'standing_charge' && isOffPeak) {
        const annualConsumption = radioButtonSelections?.['📊 Annual Consumption'] || 
                                 radioButtonSelections?.['📊 Annual Usage'];
        
        // Enabled if: Annual Consumption is No (for both Single and Dual Rate)
        // Disabled if: Annual Consumption is Yes (for both Single and Dual Rate)
        radioConditionMet = annualConsumption === 'AnnualConsumptionNo';
      } else if (isConsumptionField) {
        // Other consumption fields require ALL enabledByRadio conditions to be met (AND logic)
        radioConditionMet = Object.entries(field.enabledByRadio).every(([radioGroupTitle, allowedValues]) => {
          let selectedValue = radioButtonSelections?.[radioGroupTitle];
          
          // Handle both "📊 Annual Usage" and "📊 Annual Consumption" group titles
          if (!selectedValue && radioGroupTitle === '📊 Annual Usage') {
            selectedValue = radioButtonSelections?.['📊 Annual Consumption'];
          } else if (!selectedValue && radioGroupTitle === '📊 Annual Consumption') {
            selectedValue = radioButtonSelections?.['📊 Annual Usage'];
          }
          
          return selectedValue && allowedValues.includes(selectedValue);
        });
      } else {
        // Other fields require ANY condition to be met (OR logic)
        radioConditionMet = Object.entries(field.enabledByRadio).some(([radioGroupTitle, allowedValues]) => {
          const selectedValue = radioButtonSelections?.[radioGroupTitle];
          return selectedValue && allowedValues.includes(selectedValue);
        });
      }
      
      if (!radioConditionMet) {
        // For battery fields in Off-Peak, if battery radio is selected, still show them (already handled above)
        if (isOffPeak && field.enabledBy?.battery && batteryEnabledByRadio) {
          // Continue to check other conditions
        } else {
          // Radio condition not met, hide field
          console.log(`🚫 Hiding field ${field.id} - radio condition not met`, {
            isConsumptionField,
            enabledByRadio: field.enabledByRadio,
            radioButtonSelections
          });
          return false;
        }
      }
    }
    
    // ====== STEP 3: Check radio button disabledBy conditions ======
    if (field.disabledByRadio && Object.keys(field.disabledByRadio).length > 0) {
      // For consumption fields, require ALL disabledByRadio conditions to be met (AND logic)
      // For other fields, check if any condition disables (OR logic)
      const isConsumptionField = [
        'estimated_annual_usage', 'estimated_peak_annual_usage', 'estimated_off_peak_annual_usage',
        'standing_charge', 'annual_spend', 'total_annual_spend', 'peak_annual_spend', 'off_peak_annual_spend'
      ].includes(field.id);
      
      let radioConditionDisables: boolean;
      if (isConsumptionField) {
        // Consumption fields: ALL conditions must be met to disable (AND logic)
        radioConditionDisables = Object.entries(field.disabledByRadio).every(([radioGroupTitle, disallowedValues]) => {
          let selectedValue = radioButtonSelections?.[radioGroupTitle];
          
          // Handle both "📊 Annual Usage" and "📊 Annual Consumption" group titles
          if (!selectedValue && radioGroupTitle === '📊 Annual Usage') {
            selectedValue = radioButtonSelections?.['📊 Annual Consumption'];
          } else if (!selectedValue && radioGroupTitle === '📊 Annual Consumption') {
            selectedValue = radioButtonSelections?.['📊 Annual Usage'];
          }
          
          return selectedValue && disallowedValues.includes(selectedValue);
        });
      } else {
        // Other fields: ANY condition can disable (OR logic)
        radioConditionDisables = Object.entries(field.disabledByRadio).some(([radioGroupTitle, disallowedValues]) => {
          const selectedValue = radioButtonSelections?.[radioGroupTitle];
          return selectedValue && disallowedValues.includes(selectedValue);
        });
      }
      
      // Special case for standing_charge: Disable when Annual Consumption is Yes (for both Single and Dual Rate)
      if (field.id === 'standing_charge' && isOffPeak && !radioConditionDisables) {
        const annualConsumption = radioButtonSelections?.['📊 Annual Consumption'] || 
                                 radioButtonSelections?.['📊 Annual Usage'];
        if (annualConsumption === 'AnnualConsumptionYes') {
          radioConditionDisables = true;
        }
      }
      
      if (radioConditionDisables) {
        console.log(`🚫 Hiding field ${field.id} - disabled by radio condition`, {
          isConsumptionField,
          disabledByRadio: field.disabledByRadio,
          radioButtonSelections
        });
        return false;
      }
    }
    
    // ====== STEP 4: Flux-specific: Always show battery fields for Flux calculator ======
    if (isFlux && field.alwaysShowForFlux) {
      // Still check radio conditions for extended warranty fields
      if (field.id.includes('extended_warranty_years')) {
        // Extended warranty fields need radio button check, handled below
      } else {
        return true;
      }
    }

    // ====== STEP 5: Check enabledBy condition (template-based) ======
    // Only check template conditions if field has template-based enabledBy
    // Fields with only radio conditions (like electricity tariff fields) don't need template match
    if (field.enabledBy) {
      const shouldEnable = Object.entries(field.enabledBy).some(
        ([key, value]) => selectedTemplateOptions?.[key as keyof typeof selectedTemplateOptions] === value
      );
      if (!shouldEnable) {
        // For Flux, still show battery fields even if battery option is not explicitly selected
        if (isFlux && field.alwaysShowForFlux) {
          // Still need to check radio conditions for warranty fields
          if (field.id.includes('extended_warranty_years')) {
            // Check warranty radio condition below
          } else {
            return true;
          }
        }
        // For Off-Peak, battery fields are controlled by radio button, not template selection
        // Step 1 already handled the battery field visibility logic
        if (isOffPeak && field.enabledBy?.battery) {
          // Battery fields were already handled in Step 1
          // If "No Battery" is selected, Step 1 already returned false
          // If battery radio is selected, Step 1 allowed it to continue
          // So here we just need to continue (don't hide it based on template selection)
          // But wait, if we're here and shouldEnable is false, that means template selection doesn't match
          // But for Off-Peak battery fields, we don't care about template selection - radio button controls it
          // So we continue
        } else if (!field.enabledByRadio || Object.keys(field.enabledByRadio).length === 0) {
          // If field has no radio conditions and template condition not met, hide it
          // But if field has radio conditions, they've already been checked, so continue
          return false;
        }
        // If field has radio conditions, they've already been checked above, so continue
      }
    } else if (!field.enabledByRadio || Object.keys(field.enabledByRadio).length === 0) {
      // Field has no template conditions and no radio conditions
      // For Off-Peak, show common fields (like export tariff which might not have enabledByRadio initially)
      // For Flux, show common fields
      // This is a fallback for fields that should always show
      if (!isFlux && !isOffPeak) {
        return false; // Don't show fields with no conditions unless it's a known calculator type
      }
    }

    // ====== STEP 6: Check disabledBy condition (template-based) ======
    if (field.disabledBy) {
      const shouldDisable = Object.entries(field.disabledBy).some(
        ([key, value]) => selectedTemplateOptions?.[key as keyof typeof selectedTemplateOptions] === value
      );
      if (shouldDisable) {
        // For Flux, still show battery fields even if disabled
        if (isFlux && field.alwaysShowForFlux) {
          // Still need to check radio conditions for warranty fields
          if (field.id.includes('extended_warranty_years')) {
            // Check warranty radio condition below
          } else {
            return true;
          }
        } else {
          return false;
        }
      }
    }

    // ====== STEP 7: Check extended warranty radio conditions ======
    // Extended warranty fields are controlled by per-group radio buttons
    if (field.id.includes('extended_warranty_years')) {
      let warrantyRadioGroup = '';
      let warrantyEnabledValue = '';
      
      if (field.id.includes('battery_extended_warranty')) {
        warrantyRadioGroup = '🛡️ Battery Warranty';
        warrantyEnabledValue = 'BatteryWarrantyYes';
      } else if (field.id.includes('solar_inverter_extended_warranty')) {
        warrantyRadioGroup = '🛡️ Solar Inverter Warranty';
        warrantyEnabledValue = 'SolarInverterWarrantyYes';
      } else if (field.id.includes('battery_inverter_extended_warranty')) {
        warrantyRadioGroup = '🛡️ Battery Inverter Warranty';
        warrantyEnabledValue = 'BatteryInverterWarrantyYes';
      }
      
      if (warrantyRadioGroup && warrantyEnabledValue) {
        const warrantyValue = radioButtonSelections?.[warrantyRadioGroup];
        if (warrantyValue !== warrantyEnabledValue) {
          console.log(`🚫 Hiding extended warranty field ${field.id} - warranty radio is not "Yes"`);
          return false;
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
export function toInputField(
  fieldDef: InputFieldDefinition,
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

