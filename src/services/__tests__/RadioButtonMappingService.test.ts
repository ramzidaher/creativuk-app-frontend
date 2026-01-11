/**
 * Tests for RadioButtonMappingService
 * 
 * This test file verifies that the RadioButtonMappingService correctly
 * maps radio button names for different calculator types.
 */

import { RadioButtonMappingService } from '../RadioButtonMappingService';

describe('RadioButtonMappingService', () => {
  const mockSelections = {
    solar: true,
    battery: true,
    solarHybrid: true,
    batteryInverter: false
  };

  describe('getMapping', () => {
    it('should return EPVS mapping for flux calculator type', () => {
      const mapping = RadioButtonMappingService.getMapping('flux');
      expect(mapping.energyUse.dualRate).toBe('DualRate');
      expect(mapping.annualConsumption.yes).toBe('AnnualConsumptionYes');
      expect(mapping.existingSolar.no).toBe('ExistingSolarNo');
    });

    it('should return EPVS mapping for epvs calculator type', () => {
      const mapping = RadioButtonMappingService.getMapping('epvs');
      expect(mapping.energyUse.dualRate).toBe('DualRate');
      expect(mapping.annualConsumption.yes).toBe('AnnualConsumptionYes');
      expect(mapping.existingSolar.no).toBe('ExistingSolarNo');
    });

    it('should return off-peak mapping for off-peak calculator type', () => {
      const mapping = RadioButtonMappingService.getMapping('off-peak');
      expect(mapping.energyUse.dualRate).toBe('DualRate');
      expect(mapping.annualConsumption.yes).toBe('AnnualConsumptionYes');
      expect(mapping.existingSolar.no).toBe('ExistingSolarNo');
      expect(mapping.exportTariff.yes).toBe('ExportYes');
      expect(mapping.batteryType?.overnightCharging).toBe('BatteryOC');
    });
  });

  describe('getRadioButtonsForTemplateSelections', () => {
    it('should return correct radio buttons for flux calculator', () => {
      const radioButtons = RadioButtonMappingService.getRadioButtonsForTemplateSelections(
        mockSelections,
        'flux'
      );

      expect(radioButtons).toContain('DualRate');
      expect(radioButtons).toContain('AnnualConsumptionYes');
      expect(radioButtons).toContain('ExistingSolarNo');
      expect(radioButtons).toContain('BatteryWarrantyYes');
      expect(radioButtons).toContain('SolarInverterWarrantyYes');
      expect(radioButtons).toContain('NewFinance');
      
      // Should not contain off-peak specific radio buttons
      expect(radioButtons).not.toContain('ExportYes');
      expect(radioButtons).not.toContain('BatteryOC');
    });

    it('should return correct radio buttons for off-peak calculator', () => {
      const radioButtons = RadioButtonMappingService.getRadioButtonsForTemplateSelections(
        mockSelections,
        'off-peak'
      );

      expect(radioButtons).toContain('DualRate');
      expect(radioButtons).toContain('AnnualConsumptionYes');
      expect(radioButtons).toContain('ExistingSolarNo');
      expect(radioButtons).toContain('ExportYes'); // Off-peak specific
      expect(radioButtons).toContain('BatteryWarrantyYes');
      expect(radioButtons).toContain('BatteryOC'); // Off-peak specific
      expect(radioButtons).toContain('SolarInverterWarrantyYes');
      expect(radioButtons).toContain('NewFinance');
    });
  });

  describe('getRadioButtonEndpoint', () => {
    it('should return EPVS endpoint for flux calculator', () => {
      const endpoint = RadioButtonMappingService.getRadioButtonEndpoint('flux');
      expect(endpoint).toBe('/epvs-automation/select-radio-button');
    });

    it('should return EPVS endpoint for epvs calculator', () => {
      const endpoint = RadioButtonMappingService.getRadioButtonEndpoint('epvs');
      expect(endpoint).toBe('/epvs-automation/select-radio-button');
    });

    it('should return Excel endpoint for off-peak calculator', () => {
      const endpoint = RadioButtonMappingService.getRadioButtonEndpoint('off-peak');
      expect(endpoint).toBe('/excel-automation/select-radio-button');
    });
  });

  describe('detectCalculatorTypeFromFilename', () => {
    it('should detect flux for EPVS template filenames', () => {
      expect(RadioButtonMappingService.detectCalculatorTypeFromFilename('EPVS Calculator Creativ - 06.02 - Solar Only.xlsm')).toBe('flux');
      expect(RadioButtonMappingService.detectCalculatorTypeFromFilename('flux-template.xlsm')).toBe('flux');
      expect(RadioButtonMappingService.detectCalculatorTypeFromFilename('creativ-template.xlsm')).toBe('flux');
    });

    it('should detect off-peak for non-EPVS template filenames', () => {
      expect(RadioButtonMappingService.detectCalculatorTypeFromFilename('Off peak V2.1 Eon SEG - Solar Only.xlsm')).toBe('off-peak');
      expect(RadioButtonMappingService.detectCalculatorTypeFromFilename('standard-template.xlsm')).toBe('off-peak');
    });
  });

  describe('getSafeRadioButtons', () => {
    it('should return radio buttons that exist in both calculator types', () => {
      const safeButtons = RadioButtonMappingService.getSafeRadioButtons();
      
      expect(safeButtons).toContain('DualRate');
      expect(safeButtons).toContain('AnnualConsumptionYes');
      expect(safeButtons).toContain('ExistingSolarNo');
      expect(safeButtons).toContain('BatteryWarrantyYes');
      expect(safeButtons).toContain('SolarInverterWarrantyYes');
      expect(safeButtons).toContain('BatteryInverterWarrantyYes');
      expect(safeButtons).toContain('NewFinance');
    });
  });

  describe('getOffPeakSpecificRadioButtons', () => {
    it('should return radio buttons specific to off-peak templates', () => {
      const offPeakButtons = RadioButtonMappingService.getOffPeakSpecificRadioButtons();
      
      expect(offPeakButtons).toContain('ExportYes');
      expect(offPeakButtons).toContain('BatteryOC');
    });
  });
});
