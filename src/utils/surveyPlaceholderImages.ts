import { Platform } from 'react-native';
import { surveyApi } from './api';

/** Image fields required for survey submit / contract generation (per-field minimum). */
export const SURVEY_PLACEHOLDER_IMAGE_FIELDS: { field: string; minRequired: number; page: string }[] = [
  { field: 'energyBill', minRequired: 2, page: 'page4' },
  { field: 'frontDoor', minRequired: 2, page: 'page6' },
  { field: 'frontProperty', minRequired: 2, page: 'page6' },
  { field: 'targetRoofs', minRequired: 2, page: 'page6' },
  { field: 'roofAngle', minRequired: 2, page: 'page7' },
  { field: 'roofTileCloseup', minRequired: 2, page: 'page7' },
  { field: 'internalCeilingPictures', minRequired: 4, page: 'page7' },
  { field: 'electricMeter', minRequired: 2, page: 'page7' },
  { field: 'fuseBoard', minRequired: 2, page: 'page7' },
  { field: 'batteryInverterLocation', minRequired: 2, page: 'page7' },
];

const FALLBACK_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUSEhIVFhUVFRUYFxgXGBgXGBgYGBgYGBgYGBgYGBggHSolHR0lHxUtLy0tKy4vFx8+ODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIQAxAAAAGwAP/Z';

function createCanvasPlaceholder(fieldLabel: string, index: number): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(24, 24, canvas.width - 48, canvas.height - 48);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLACEHOLDER', canvas.width / 2, canvas.height / 2 - 24);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(fieldLabel, canvas.width / 2, canvas.height / 2 + 16);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`#${index + 1}`, canvas.width / 2, canvas.height / 2 + 48);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return base64;
  } catch {
    return null;
  }
}

export function createPlaceholderImageFile(fieldName: string, index: number) {
  const label = fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  const base64 = createCanvasPlaceholder(label, index) || FALLBACK_JPEG_BASE64;
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const timestamp = Date.now();

  return {
    uri: dataUrl,
    name: `placeholder_${fieldName}_${index + 1}_${timestamp}.jpg`,
    mimeType: 'image/jpeg',
    type: 'image/jpeg',
    size: Math.round((base64.length * 3) / 4),
    base64: dataUrl,
    base64Data: base64,
    isNew: true,
    isPlaceholder: true,
    timestamp,
  };
}

export type FillSurveyPlaceholdersOptions = {
  skipEnergyBill?: boolean;
  onProgress?: (message: string, current: number, total: number) => void;
};

export type FillSurveyPlaceholdersResult = {
  success: boolean;
  opportunityId: string;
  uploadedCount: number;
  errors: string[];
};

export async function ensureSurveyExists(opportunityId: string): Promise<void> {
  const trimmed = opportunityId.trim();
  const existing = await surveyApi.getSurvey(trimmed);
  if (existing.success && existing.data) {
    return;
  }
  const created = await surveyApi.createSurvey(trimmed);
  if (!created.success) {
    throw new Error(created.error || 'Could not create survey for this opportunity');
  }
}

export async function fillSurveyWithPlaceholderImages(
  rawOpportunityId: string,
  options: FillSurveyPlaceholdersOptions = {}
): Promise<FillSurveyPlaceholdersResult> {
  const opportunityId = rawOpportunityId.trim();
  if (!opportunityId) {
    return { success: false, opportunityId: '', uploadedCount: 0, errors: ['Opportunity ID is required'] };
  }

  const errors: string[] = [];
  let uploadedCount = 0;

  const fieldsToFill = SURVEY_PLACEHOLDER_IMAGE_FIELDS.filter(
    ({ field }) => !(options.skipEnergyBill && field === 'energyBill')
  );

  const totalUploads = fieldsToFill.reduce((sum, { minRequired }) => sum + minRequired, 0);
  let current = 0;

  options.onProgress?.('Ensuring survey exists…', 0, totalUploads);
  await ensureSurveyExists(opportunityId);

  for (const { field, minRequired } of fieldsToFill) {
    const placeholders = Array.from({ length: minRequired }, (_, i) =>
      createPlaceholderImageFile(field, i)
    );

    options.onProgress?.(`Uploading ${field}…`, current, totalUploads);

    try {
      const response = await surveyApi.uploadImagesAndGetUrls(opportunityId, field, placeholders);
      const isSuccess = response?.success === true;
      const urls =
        (response?.data as { data?: { urls?: string[] } })?.data?.urls ||
        (response?.data as { urls?: string[] })?.urls;

      if (!isSuccess || !urls?.length) {
        errors.push(`${field}: ${response?.error || 'Upload failed'}`);
      } else {
        uploadedCount += urls.length;
        current += placeholders.length;
        options.onProgress?.(`Uploaded ${field}`, current, totalUploads);

        const pageKey =
          field === 'energyBill' ? 'page4' : ['frontDoor', 'frontProperty', 'targetRoofs'].includes(field) ? 'page6' : 'page7';

        await surveyApi.saveSurveyPage(opportunityId, {
          [pageKey]: { [`${field}Files`]: urls },
        });
      }
    } catch (err) {
      errors.push(`${field}: ${err instanceof Error ? err.message : 'Upload error'}`);
    }
  }

  return {
    success: errors.length === 0,
    opportunityId,
    uploadedCount,
    errors,
  };
}
