export type SurveyPageKey = 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'page6' | 'page7' | 'page8';

/** All survey image upload fields and which page they belong to. */
export const SURVEY_IMAGE_FIELD_PAGES: Record<string, SurveyPageKey> = {
  energyBill: 'page4',
  epcCertificate: 'page5',
  frontDoor: 'page6',
  frontProperty: 'page6',
  targetRoofs: 'page6',
  propertySides: 'page6',
  roofAngle: 'page7',
  otherRoofPictures: 'page7',
  roofTileCloseup: 'page7',
  internalCeilingPictures: 'page7',
  otherBuildings: 'page7',
  electricMeter: 'page7',
  garage: 'page7',
  fuseBoard: 'page7',
  batteryInverterLocation: 'page7',
  evLocation: 'page8',
  evCharger: 'page8',
  shadingIssues: 'page8',
  scaffolding: 'page8',
  customerSignature: 'page8',
  renewableExecutiveSignature: 'page8',
};

export const ALL_SURVEY_IMAGE_FIELDS = Object.keys(SURVEY_IMAGE_FIELD_PAGES);

export function getPageForSurveyImageField(fieldName: string): SurveyPageKey {
  return SURVEY_IMAGE_FIELD_PAGES[fieldName] || 'page7';
}

/** Fields required for submit / contract (minimum counts). */
export const SURVEY_REQUIRED_IMAGE_FIELDS: { field: string; minRequired: number }[] = [
  { field: 'energyBill', minRequired: 2 },
  { field: 'frontDoor', minRequired: 2 },
  { field: 'frontProperty', minRequired: 2 },
  { field: 'targetRoofs', minRequired: 2 },
  { field: 'roofAngle', minRequired: 2 },
  { field: 'roofTileCloseup', minRequired: 2 },
  { field: 'internalCeilingPictures', minRequired: 4 },
  { field: 'electricMeter', minRequired: 2 },
  { field: 'fuseBoard', minRequired: 2 },
  { field: 'batteryInverterLocation', minRequired: 2 },
];
