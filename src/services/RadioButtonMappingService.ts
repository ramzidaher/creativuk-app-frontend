/**
 * RadioButtonMappingService
 * 
 * This service provides the correct radio button names for different calculator types
 * to ensure compatibility between off-peak and flux (EPVS) templates.
 */

export interface RadioButtonMapping {
  energyUse: {
    singleRate: string;
    dualRate: string;
  };
  annualConsumption: {
    yes: string;
    no: string;
  };
  existingSolar: {
    yes: string;
    no: string;
  };
  exportTariff: {
    yes: string;
    no: string;
  };
  batteryWarranty: {
    yes: string;
    no: string;
  };
  solarInverterWarranty: {
    yes: string;
    no: string;
  };
  batteryInverterWarranty: {
    yes: string;
    no: string;
  };
  paymentMethod: {
    cash: string;
    hometree: string;
    newFinance: string;
  };
  batteryType?: {
    selfConsumption: string;
    overnightCharging: string;
    none: string;
  };
}

export class RadioButtonMappingService {
  private static readonly OFF_PEAK_MAPPING: RadioButtonMapping = {
    energyUse: {
      singleRate: 'SingleRate',
      dualRate: 'DualRate'
    },
    annualConsumption: {
      yes: 'AnnualConsumptionYes',
      no: 'AnnualConsumptionNo'
    },
    existingSolar: {
      yes: 'ExistingSolarYes',
      no: 'ExistingSolarNo'
    },
    exportTariff: {
      yes: 'ExportYes',
      no: 'ExportNo'
    },
    batteryWarranty: {
      yes: 'BatteryWarrantyYes',
      no: 'BatteryWarrantyNo'
    },
    solarInverterWarranty: {
      yes: 'SolarInverterWarrantyYes',
      no: 'SolarInverterWarrantyNo'
    },
    batteryInverterWarranty: {
      yes: 'BatteryInverterWarrantyYes',
      no: 'BatteryInverterWarrantyNo'
    },
    paymentMethod: {
      cash: 'Cash',
      hometree: 'NewFinance', // Hometree maps to NewFinance in off-peak
      newFinance: 'NewFinance'
    },
    batteryType: {
      selfConsumption: 'BatterySC',
      overnightCharging: 'BatteryOC',
      none: 'BatteryNone'
    }
  };

  private static readonly EPVS_MAPPING: RadioButtonMapping = {
    energyUse: {
      singleRate: 'SingleRate',
      dualRate: 'DualRate'
    },
    annualConsumption: {
      yes: 'AnnualConsumptionYes',
      no: 'AnnualConsumptionNo'
    },
    existingSolar: {
      yes: 'ExistingSolarYes',
      no: 'ExistingSolarNo'
    },
    exportTariff: {
      yes: 'ExportYes', // Note: This might not exist in all EPVS templates
      no: 'ExportNo'
    },
    batteryWarranty: {
      yes: 'BatteryWarrantyYes',
      no: 'BatteryWarrantyNo'
    },
    solarInverterWarranty: {
      yes: 'SolarInverterWarrantyYes',
      no: 'SolarInverterWarrantyNo'
    },
    batteryInverterWarranty: {
      yes: 'BatteryInverterWarrantyYes',
      no: 'BatteryInverterWarrantyNo'
    },
    paymentMethod: {
      cash: 'Cash',
      hometree: 'NewFinance',
      newFinance: 'NewFinance'
    }
    // Note: EPVS templates don't have batteryType radio buttons
  };

  /**
   * Get the correct radio button mapping for the given calculator type
   */
  static getMapping(calculatorType: 'flux' | 'off-peak' | 'epvs'): RadioButtonMapping {
    if (calculatorType === 'flux' || calculatorType === 'epvs') {
      return this.EPVS_MAPPING;
    }
    return this.OFF_PEAK_MAPPING;
  }

  /**
   * Get the correct radio button names for template selections
   */
  static getRadioButtonsForTemplateSelections(
    selections: {
      solar: boolean;
      battery: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    },
    calculatorType: 'flux' | 'off-peak' | 'epvs'
  ): string[] {
    const mapping = this.getMapping(calculatorType);
    const radioButtons: string[] = [];

    // Always select these for both calculator types
    radioButtons.push(mapping.energyUse.dualRate); // Energy Use
    radioButtons.push(mapping.annualConsumption.yes); // Annual Consumption
    radioButtons.push(mapping.existingSolar.no); // Existing Solar

    // Add export tariff only for off-peak (EPVS templates might not have this)
    if (calculatorType === 'off-peak') {
      radioButtons.push(mapping.exportTariff.yes); // Export Tariff
    }

    // Battery-related selections
    if (selections.battery) {
      radioButtons.push(mapping.batteryWarranty.yes); // Battery Warranty
      
      // Add battery type for off-peak only
      if (calculatorType === 'off-peak' && mapping.batteryType) {
        radioButtons.push(mapping.batteryType.overnightCharging); // Battery Type
      }
    }

    // Solar Hybrid selections
    if (selections.solarHybrid) {
      radioButtons.push(mapping.solarInverterWarranty.yes); // Solar Inverter Warranty
    }

    // Battery Inverter selections
    if (selections.batteryInverter) {
      radioButtons.push(mapping.batteryInverterWarranty.yes); // Battery Inverter Warranty
    }

    // Payment method (default to New Finance)
    radioButtons.push(mapping.paymentMethod.newFinance);

    return radioButtons;
  }

  /**
   * Get radio buttons that are safe to use (exist in both calculator types)
   */
  static getSafeRadioButtons(): string[] {
    return [
      'DualRate', // Energy Use
      'AnnualConsumptionYes', // Annual Consumption
      'ExistingSolarNo', // Existing Solar
      'BatteryWarrantyYes', // Battery Warranty
      'SolarInverterWarrantyYes', // Solar Inverter Warranty
      'BatteryInverterWarrantyYes', // Battery Inverter Warranty
      'NewFinance' // Payment Method
    ];
  }

  /**
   * Get radio buttons that are specific to off-peak templates
   */
  static getOffPeakSpecificRadioButtons(): string[] {
    return [
      'ExportYes', // Export Tariff
      'BatteryOC' // Battery Type
    ];
  }

  /**
   * Detect calculator type from template filename
   */
  static detectCalculatorTypeFromFilename(templateFileName: string): 'flux' | 'off-peak' | 'v44' {
    const lowerFileName = templateFileName.toLowerCase();
    if (lowerFileName.includes('v4.4') || lowerFileName.includes('v44')) {
      return 'v44';
    }
    const epvsIndicators = ['epvs', 'flux', 'creativ'];
    for (const indicator of epvsIndicators) {
      if (lowerFileName.includes(indicator)) {
        return 'flux';
      }
    }
    return 'off-peak';
  }

  /**
   * Get the correct API endpoint for radio button selection
   */
  static getRadioButtonEndpoint(calculatorType: 'flux' | 'off-peak' | 'epvs'): string {
    if (calculatorType === 'flux' || calculatorType === 'epvs') {
      return '/epvs-automation/select-radio-button';
    }
    return '/excel-automation/select-radio-button';
  }
}
