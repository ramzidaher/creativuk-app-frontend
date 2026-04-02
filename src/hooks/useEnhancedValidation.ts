import { useCallback } from 'react';

interface ValidationField {
  fieldName: string;
  displayName: string;
  pageNumber: number;
  isRequired: boolean;
  fieldType: 'text' | 'dropdown' | 'image' | 'date' | 'checkbox';
  validationRule?: (value: any) => boolean;
  errorMessage?: string;
  minImages?: number; // For image fields with custom minimum (default 2)
}

interface ValidationResult {
  isValid: boolean;
  missingFields: ValidationField[];
  fieldsToHighlight: Set<string>;
  pageErrors: { [pageNumber: number]: ValidationField[] };
}

export type SurveyValidationOptions = {
  /** Field names to skip (e.g. admin-only UX hides homeowner questions on page 1) */
  skipFieldNames?: string[];
};

export const useEnhancedValidation = () => {
  // Define all survey fields with their locations and requirements
  const surveyFields: ValidationField[] = [
    // Page 1 - Suitability Assessment
    { fieldName: 'customerFirstName', displayName: 'Customer First Name', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'customerLastName', displayName: 'Customer Last Name', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'renewableExecutiveFirstName', displayName: 'Renewable Executive First Name', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'renewableExecutiveLastName', displayName: 'Renewable Executive Last Name', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'addressLine1', displayName: 'Address Line 1', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'postcode', displayName: 'Postcode', pageNumber: 1, isRequired: true, fieldType: 'text' },
    { fieldName: 'homeOwnersAvailable', displayName: 'Home Owners Available', pageNumber: 1, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'date', displayName: 'Assessment Date', pageNumber: 1, isRequired: true, fieldType: 'date' },

    // Page 2 - Solar Installation Reasons
    { fieldName: 'selectedReasons', displayName: 'Solar Installation Reasons', pageNumber: 2, isRequired: true, fieldType: 'checkbox', 
      validationRule: (value) => Array.isArray(value) && value.length >= 1 },

    // Page 3 - Property Information
    { fieldName: 'property', displayName: 'Property Type', pageNumber: 3, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'propertyType', displayName: 'Type of Property', pageNumber: 3, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'movingPlans', displayName: 'Moving Plans in Next 2 Years', pageNumber: 3, isRequired: true, fieldType: 'dropdown' },

    // Page 4 - Heating & Energy Information
    { fieldName: 'heatingType', displayName: 'Heating Type', pageNumber: 4, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'additionalFeatures', displayName: 'Additional Features', pageNumber: 4, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'prepaidMeter', displayName: 'Pre-paid Meter', pageNumber: 4, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'phaseMeter', displayName: 'Phase Meter Type', pageNumber: 4, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'hasEnergyBill', displayName: 'Do you have an energy bill?', pageNumber: 4, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'energyCompany', displayName: 'Energy Company', pageNumber: 4, isRequired: true, fieldType: 'text' },
    { fieldName: 'electricPricePerUnit', displayName: 'Electric Price Per Unit', pageNumber: 4, isRequired: true, fieldType: 'text' },
    { fieldName: 'annualElectricUsage', displayName: 'Annual Electric Usage', pageNumber: 4, isRequired: true, fieldType: 'text' },
    { fieldName: 'energyBill', displayName: 'Energy Bill Images', pageNumber: 4, isRequired: true, fieldType: 'image' },

    // Page 5 - EPC & Solar Funding
    { fieldName: 'epcRating', displayName: 'EPC Rating', pageNumber: 5, isRequired: false, fieldType: 'dropdown' },
    { fieldName: 'previousSolarFunding', displayName: 'Previous Solar Funding', pageNumber: 5, isRequired: true, fieldType: 'dropdown' },

    // Page 6 - Financial & Installation Information
    { fieldName: 'financialIssues', displayName: 'Financial Issues', pageNumber: 6, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'creditRating', displayName: 'Credit Rating', pageNumber: 6, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'installationAvailability', displayName: 'Installation Availability', pageNumber: 6, isRequired: true, fieldType: 'dropdown' },

    // Page 7 - Property Assessment (Images)
    { fieldName: 'frontDoor', displayName: 'Front Door Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'frontProperty', displayName: 'Front Property Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'targetRoofs', displayName: 'Target Roofs Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'roofAngle', displayName: 'Roof Angle Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'roofTileCloseup', displayName: 'Roof Tile Closeup Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'internalCeilingPictures', displayName: 'Internal Ceiling Pictures', pageNumber: 7, isRequired: true, fieldType: 'image', minImages: 4 },
    { fieldName: 'roofTileType', displayName: 'Roof Tile Type', pageNumber: 7, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'fuseBoard', displayName: 'Fuse Board Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'electricMeter', displayName: 'Electric Meter Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'batteryInverterLocation', displayName: 'Battery & Inverter Location Images', pageNumber: 7, isRequired: true, fieldType: 'image' },
    { fieldName: 'solarBatteryStorage', displayName: 'Solar/Battery Storage', pageNumber: 7, isRequired: true, fieldType: 'dropdown' },

    // Page 8 - Installation Assessment
    { fieldName: 'evChargerRequired', displayName: 'EV Charger Required', pageNumber: 8, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'optimisersRequired', displayName: 'Optimisers Required', pageNumber: 8, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'scaffoldingRequired', displayName: 'Scaffolding Required', pageNumber: 8, isRequired: true, fieldType: 'dropdown' },
    { fieldName: 'scaffoldingThroughHouse', displayName: 'Scaffolding Through House', pageNumber: 8, isRequired: true, fieldType: 'dropdown' },
  ];

  // Validate a specific page
  const validatePage = useCallback((pageNumber: number, formData: any, uploadedFiles: any, options?: SurveyValidationOptions): ValidationResult => {
    const skipNames = new Set(options?.skipFieldNames ?? []);
    const pageFields = surveyFields.filter(field => field.pageNumber === pageNumber);
    const missingFields: ValidationField[] = [];
    const fieldsToHighlight = new Set<string>();

    for (const field of pageFields) {
      if (skipNames.has(field.fieldName)) continue;
      if (!field.isRequired) continue;

      // Special case: Energy bill images are only required if hasEnergyBill is "Yes"
      if (field.fieldName === 'energyBill' && pageNumber === 4) {
        const pageData = formData.page4;
        const hasEnergyBill = pageData?.hasEnergyBill;
        
        // If hasEnergyBill is "No", skip validation for energy bill images
        if (hasEnergyBill === 'No') {
          continue;
        }
      }

      let isValid = false;
      let fieldValue: any;

      if (field.fieldType === 'image') {
        // Check uploaded files for image fields
        const images = uploadedFiles[field.fieldName] || [];
        const minRequired = field.minImages ?? 2;
        isValid = Array.isArray(images) && images.length >= minRequired;
        fieldValue = images;
      } else {
        // Check form data for other field types
        const pageData = formData[`page${pageNumber}`];
        fieldValue = pageData?.[field.fieldName];

        if (field.validationRule) {
          isValid = field.validationRule(fieldValue);
        } else {
          isValid = fieldValue !== undefined && 
                   fieldValue !== null && 
                   fieldValue !== '' && 
                   fieldValue !== 'Please Select';
        }
      }

      if (!isValid) {
        missingFields.push(field);
        fieldsToHighlight.add(field.fieldName);
      }
    }

    // Group errors by page
    const pageErrors: { [pageNumber: number]: ValidationField[] } = {};
    pageErrors[pageNumber] = missingFields;

    return {
      isValid: missingFields.length === 0,
      missingFields,
      fieldsToHighlight,
      pageErrors
    };
  }, []);

  // Validate all pages
  const validateAllPages = useCallback((formData: any, uploadedFiles: any, options?: SurveyValidationOptions): ValidationResult => {
    const allMissingFields: ValidationField[] = [];
    const allFieldsToHighlight = new Set<string>();
    const pageErrors: { [pageNumber: number]: ValidationField[] } = {};

    for (let pageNum = 1; pageNum <= 8; pageNum++) {
      const pageValidation = validatePage(pageNum, formData, uploadedFiles, options);
      
      if (!pageValidation.isValid) {
        allMissingFields.push(...pageValidation.missingFields);
        pageValidation.fieldsToHighlight.forEach(field => allFieldsToHighlight.add(field));
        pageErrors[pageNum] = pageValidation.missingFields;
      }
    }

    return {
      isValid: allMissingFields.length === 0,
      missingFields: allMissingFields,
      fieldsToHighlight: allFieldsToHighlight,
      pageErrors
    };
  }, [validatePage]);

  // Get field information by field name
  const getFieldInfo = useCallback((fieldName: string): ValidationField | undefined => {
    return surveyFields.find(field => field.fieldName === fieldName);
  }, []);

  // Get all required fields for a page
  const getRequiredFieldsForPage = useCallback((pageNumber: number): ValidationField[] => {
    return surveyFields.filter(field => field.pageNumber === pageNumber && field.isRequired);
  }, []);

  // Generate detailed validation report
  const generateValidationReport = useCallback((formData: any, uploadedFiles: any, options?: SurveyValidationOptions) => {
    const validation = validateAllPages(formData, uploadedFiles, options);
    
    const report = {
      isValid: validation.isValid,
      totalMissingFields: validation.missingFields.length,
      pageBreakdown: Object.entries(validation.pageErrors).map(([pageNum, fields]) => ({
        pageNumber: parseInt(pageNum),
        missingFieldsCount: fields.length,
        missingFields: fields.map(field => ({
          name: field.displayName,
          type: field.fieldType,
          location: `Page ${field.pageNumber}`
        }))
      })).filter(page => page.missingFieldsCount > 0)
    };

    return report;
  }, [validateAllPages]);

  return {
    validatePage,
    validateAllPages,
    getFieldInfo,
    getRequiredFieldsForPage,
    generateValidationReport,
    surveyFields
  };
};


