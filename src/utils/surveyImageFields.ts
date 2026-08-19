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

/** Customer slots that still land on the surveyor's existing survey field. */
export const CUSTOMER_FIELD_TO_SURVEY_FIELD: Record<string, string> = {
  energyBillFront: 'energyBill',
  energyBillRear: 'energyBill',
  frontRoof: 'targetRoofs',
  sideRoof: 'propertySides',
  rearRoof: 'otherRoofPictures',
};

export function surveyFieldForCustomerField(fieldName: string): string {
  return CUSTOMER_FIELD_TO_SURVEY_FIELD[fieldName] ?? fieldName;
}

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

/** Fields customers can upload via public link (Zoom / remote appointments). */
export const CUSTOMER_SURVEY_UPLOAD_FIELDS = [
  'energyBillFront',
  'energyBillRear',
  'frontDoor',
  'frontProperty',
  'frontRoof',
  'sideRoof',
  'rearRoof',
  'otherBuildings',
  'roofTileCloseup',
  'fuseBoard',
  'electricMeter',
  'batteryInverterLocation',
  'shadingIssues',
] as const;

export type CustomerSurveyUploadField = (typeof CUSTOMER_SURVEY_UPLOAD_FIELDS)[number];

export const CUSTOMER_SURVEY_UPLOAD_FIELD_LABELS: Record<
  CustomerSurveyUploadField,
  { label: string; hint: string; minRequired: number; page: number }
> = {
  energyBillFront: {
    label: 'Front of energy bill',
    hint: 'Photograph the whole front of the bill, including name and address.',
    minRequired: 1,
    page: 4,
  },
  energyBillRear: {
    label: 'Back of energy bill',
    hint: 'Photograph the whole back of the bill, including the rates and usage.',
    minRequired: 1,
    page: 4,
  },
  frontDoor: {
    label: 'Front door',
    hint: 'Clear photo showing your front door and house number.',
    minRequired: 2,
    page: 6,
  },
  frontProperty: {
    label: 'Front of property',
    hint: 'Photo of the full front of the house from the street.',
    minRequired: 2,
    page: 6,
  },
  frontRoof: {
    label: 'Front roof',
    hint: 'Photo of the roof at the front of the house.',
    minRequired: 1,
    page: 6,
  },
  sideRoof: {
    label: 'Side roof',
    hint: 'Photo of the roof on the side of the house.',
    minRequired: 1,
    page: 6,
  },
  rearRoof: {
    label: 'Rear roof',
    hint: 'Photo of the roof at the back of the house.',
    minRequired: 1,
    page: 6,
  },
  otherBuildings: {
    label: 'Flat roofs or other buildings',
    hint: 'Only if you have them — flat roofs, garages, or other buildings.',
    minRequired: 0,
    page: 7,
  },
  roofTileCloseup: {
    label: 'Close-up of roof tile',
    hint: 'Stand close so we can see the tile clearly. You do not need to know the tile type.',
    minRequired: 1,
    page: 7,
  },
  fuseBoard: {
    label: 'Fuse board',
    hint: 'A clear photo of where the fuse board is.',
    minRequired: 1,
    page: 7,
  },
  electricMeter: {
    label: 'Electric meter',
    hint: 'A clear photo of where the electric meter is.',
    minRequired: 1,
    page: 7,
  },
  batteryInverterLocation: {
    label: 'Battery and inverter location options',
    hint: 'Take a few photos of possible spots outside, next to the house. This can be front or rear. Ideally close to the electric meter box, but that is recommended rather than required.',
    minRequired: 0,
    page: 7,
  },
  shadingIssues: {
    label: 'Possible roof shading',
    hint: 'Photos of anything that might shade the roof — for example trees, the house next door, or a chimney stack.',
    minRequired: 4,
    page: 8,
  },
};

export const CUSTOMER_SURVEY_PAGE_TITLES: Record<number, string> = {
  4: 'Energy & bills',
  6: 'Property exterior',
  7: 'Roofs and electrics',
  8: 'Possible shading',
};

const EXAMPLE_BILL = require('../../assets/survey-examples/energy-bill-example.jpg');
const EXAMPLE_DOOR = require('../../assets/survey-examples/front-door-example.jpg');
const EXAMPLE_FRONT = require('../../assets/survey-examples/front-property-example.jpg');
const EXAMPLE_ROOF = require('../../assets/survey-examples/roof-panels-example.jpg');
const EXAMPLE_SIDE = require('../../assets/survey-examples/side-property-example.jpg');

export const CUSTOMER_SURVEY_UPLOAD_EXAMPLES: Partial<
  Record<CustomerSurveyUploadField, { image: any; caption: string }>
> = {
  energyBillFront: {
    image: EXAMPLE_BILL,
    caption: 'Whole front of the bill, including name and address.',
  },
  energyBillRear: {
    image: EXAMPLE_BILL,
    caption: 'Whole back of the bill, including the rates and usage.',
  },
  frontDoor: {
    image: EXAMPLE_DOOR,
    caption: 'Stand close enough that the door and house number are both clear.',
  },
  frontProperty: {
    image: EXAMPLE_FRONT,
    caption: 'Step back so the full front of the house is in the photo, including the roof.',
  },
  frontRoof: {
    image: EXAMPLE_ROOF,
    caption: 'Photograph the roof at the front of the house.',
  },
  sideRoof: {
    image: EXAMPLE_ROOF,
    caption: 'Photograph the roof on the side of the house.',
  },
  rearRoof: {
    image: EXAMPLE_ROOF,
    caption: 'Photograph the roof at the back of the house.',
  },
  otherBuildings: {
    image: EXAMPLE_SIDE,
    caption: 'Only if you have them — a flat roof, garage, or other building.',
  },
  roofTileCloseup: {
    image: EXAMPLE_ROOF,
    caption: 'Get close enough that the tile is easy to see.',
  },
  fuseBoard: {
    image: EXAMPLE_FRONT,
    caption: 'Show where the fuse board is, with the whole board in the photo if you can.',
  },
  electricMeter: {
    image: EXAMPLE_FRONT,
    caption: 'Show where the electric meter is.',
  },
  batteryInverterLocation: {
    image: EXAMPLE_SIDE,
    caption: 'Outside spots next to the house. Ideally near the electric meter box.',
  },
  shadingIssues: {
    image: EXAMPLE_ROOF,
    caption: 'Trees, the house next door, a chimney stack, or anything else that might shade the roof.',
  },
};
