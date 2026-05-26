/**
 * Single source of truth: image upload fields as defined in SurveyScreen.tsx (ModernFileUpload).
 * Keep in sync when adding/removing survey photo fields.
 */
export type SurveyPageKey = 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'page6' | 'page7' | 'page8';

export type SurveyImageFieldConfig = {
  field: string;
  page: SurveyPageKey;
  /** Minimum images (matches ModernFileUpload minRequired / submit rules). */
  minRequired: number;
  /** Included in Admin Tools → Fill placeholder images. */
  placeholderFill: boolean;
  /** Skip when Admin Tools “Skip energy bill” is on. */
  skipWhenNoEnergyBill?: boolean;
  /** Only on survey page 8 when evChargerRequired === 'Yes' (still filled by Admin Tools for testing). */
  evChargerOnly?: boolean;
};

/** Every ModernFileUpload field in the live survey UI, in page order. */
export const SURVEY_IMAGE_UPLOAD_FIELDS: SurveyImageFieldConfig[] = [
  // Page 4 – Energy & installation (energy bill upload lives on page 4 in UI)
  { field: 'energyBill', page: 'page4', minRequired: 2, placeholderFill: true, skipWhenNoEnergyBill: true },

  // Page 5 – EPC
  { field: 'epcCertificate', page: 'page5', minRequired: 2, placeholderFill: true },

  // Page 6 – Property exterior
  { field: 'frontDoor', page: 'page6', minRequired: 2, placeholderFill: true },
  { field: 'frontProperty', page: 'page6', minRequired: 2, placeholderFill: true },
  { field: 'targetRoofs', page: 'page6', minRequired: 2, placeholderFill: true },
  { field: 'propertySides', page: 'page6', minRequired: 2, placeholderFill: true },

  // Page 7 – Roof & electrical
  { field: 'roofAngle', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'otherRoofPictures', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'roofTileCloseup', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'internalCeilingPictures', page: 'page7', minRequired: 4, placeholderFill: true },
  { field: 'fuseBoard', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'electricMeter', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'garage', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'otherBuildings', page: 'page7', minRequired: 2, placeholderFill: true },
  { field: 'batteryInverterLocation', page: 'page7', minRequired: 2, placeholderFill: true },

  // Page 8 – Installation (EV uploads conditional in UI; admin fill includes them)
  { field: 'evLocation', page: 'page8', minRequired: 2, placeholderFill: true, evChargerOnly: true },
  { field: 'evCharger', page: 'page8', minRequired: 2, placeholderFill: true, evChargerOnly: true },
  { field: 'shadingIssues', page: 'page8', minRequired: 2, placeholderFill: true },
  { field: 'scaffolding', page: 'page8', minRequired: 2, placeholderFill: true },
];

export const ALL_SURVEY_IMAGE_FIELDS = SURVEY_IMAGE_UPLOAD_FIELDS.map((f) => f.field);

export const SURVEY_IMAGE_FIELD_PAGES: Record<string, SurveyPageKey> = Object.fromEntries(
  SURVEY_IMAGE_UPLOAD_FIELDS.map((f) => [f.field, f.page])
) as Record<string, SurveyPageKey>;

export function getPageForSurveyImageField(fieldName: string): SurveyPageKey {
  return SURVEY_IMAGE_FIELD_PAGES[fieldName] || 'page7';
}

export function getSurveyImageFieldConfig(fieldName: string): SurveyImageFieldConfig | undefined {
  return SURVEY_IMAGE_UPLOAD_FIELDS.find((f) => f.field === fieldName);
}

/** Fields enforced on submit (required * in survey UI). */
export const SURVEY_SUBMIT_REQUIRED_IMAGE_FIELDS = SURVEY_IMAGE_UPLOAD_FIELDS.filter(
  (f) =>
    [
      'energyBill',
      'frontDoor',
      'frontProperty',
      'targetRoofs',
      'roofAngle',
      'roofTileCloseup',
      'internalCeilingPictures',
      'fuseBoard',
      'electricMeter',
      'garage',
      'otherBuildings',
      'batteryInverterLocation',
    ].includes(f.field)
);

/** Contract generation checks (subset). */
export const SURVEY_CONTRACT_REQUIRED_IMAGE_FIELDS: { field: string; minRequired: number }[] = [
  { field: 'energyBill', minRequired: 1 },
  { field: 'frontDoor', minRequired: 1 },
  { field: 'frontProperty', minRequired: 1 },
  { field: 'targetRoofs', minRequired: 1 },
  { field: 'roofAngle', minRequired: 1 },
  { field: 'roofTileCloseup', minRequired: 1 },
  { field: 'internalCeilingPictures', minRequired: 4 },
  { field: 'electricMeter', minRequired: 1 },
  { field: 'fuseBoard', minRequired: 1 },
  { field: 'batteryInverterLocation', minRequired: 1 },
];

export function getPlaceholderFillFields(options?: {
  skipEnergyBill?: boolean;
  includeEvFields?: boolean;
}): SurveyImageFieldConfig[] {
  return SURVEY_IMAGE_UPLOAD_FIELDS.filter((f) => {
    if (!f.placeholderFill) return false;
    if (options?.skipEnergyBill && f.skipWhenNoEnergyBill) return false;
    if (!options?.includeEvFields && f.evChargerOnly) return false;
    return true;
  });
}

export function getImageFieldsForSurveyPage(
  pageNumber: number,
  formData?: { page8?: { evChargerRequired?: string } }
): string[] {
  const pageKey = `page${pageNumber}` as SurveyPageKey;
  return SURVEY_IMAGE_UPLOAD_FIELDS.filter((f) => {
    if (f.page !== pageKey) return false;
    if (f.evChargerOnly && formData?.page8?.evChargerRequired !== 'Yes') return false;
    return true;
  }).map((f) => f.field);
}
