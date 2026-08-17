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

/** Fields customers can upload via public link (online appointments). */
export const CUSTOMER_SURVEY_UPLOAD_FIELDS = [
  'energyBill',
  'frontDoor',
  'frontProperty',
  'targetRoofs',
  'propertySides',
] as const;

export type CustomerSurveyUploadField = (typeof CUSTOMER_SURVEY_UPLOAD_FIELDS)[number];

export const CUSTOMER_SURVEY_UPLOAD_FIELD_LABELS: Record<
  CustomerSurveyUploadField,
  { label: string; hint: string; minRequired: number; page: number }
> = {
  energyBill: {
    label: 'Energy bill',
    hint: 'Photo of your latest electricity bill (all pages if multi-page)',
    minRequired: 2,
    page: 4,
  },
  frontDoor: {
    label: 'Front door',
    hint: 'Clear photo showing your front door and house number',
    minRequired: 2,
    page: 6,
  },
  frontProperty: {
    label: 'Front of property',
    hint: 'Photo of the full front of the house from the street',
    minRequired: 2,
    page: 6,
  },
  targetRoofs: {
    label: 'Roof(s) for panels',
    hint: 'Photo of the roof area where solar panels will go',
    minRequired: 2,
    page: 6,
  },
  propertySides: {
    label: 'Side of property',
    hint: 'Photo of the side of the house if relevant',
    minRequired: 2,
    page: 6,
  },
};

export const CUSTOMER_SURVEY_PAGE_TITLES: Record<number, string> = {
  4: 'Energy & bills',
  6: 'Property exterior',
};

export const CUSTOMER_SURVEY_UPLOAD_EXAMPLES: Record<
  CustomerSurveyUploadField,
  { image: any; caption: string }
> = {
  energyBill: {
    image: require('../../assets/survey-examples/energy-bill-example.jpg'),
    caption: 'Photograph the whole bill so usage and the total are readable. Include every page.',
  },
  frontDoor: {
    image: require('../../assets/survey-examples/front-door-example.jpg'),
    caption: 'Stand close enough that the door and house number are both clear.',
  },
  frontProperty: {
    image: require('../../assets/survey-examples/front-property-example.jpg'),
    caption: 'Step back so the full front of the house is in the photo, including the roof.',
  },
  targetRoofs: {
    image: require('../../assets/survey-examples/roof-panels-example.jpg'),
    caption: 'Capture the roof slope where panels would go. Take extra photos if there is more than one roof.',
  },
  propertySides: {
    image: require('../../assets/survey-examples/side-property-example.jpg'),
    caption: 'Photograph the side of the house, including the passageway if there is one.',
  },
};
