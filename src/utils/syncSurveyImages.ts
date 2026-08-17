import { surveyApi } from './api';
import { SURVEY_IMAGE_UPLOAD_FIELDS, getPageForSurveyImageField } from './surveyImageFields';

export type SurveyImageFile = {
  uri: string;
  name: string;
  mimeType: string;
  type?: string;
  size: number;
  isFromServer: boolean;
  timestamp: number;
};

export function mapApiImagesToUploadedFiles(images: any[]): Record<string, SurveyImageFile[]> {
  const byField: Record<string, SurveyImageFile[]> = {};

  for (const img of images) {
    const fieldName = img.fieldName || img.field;
    if (!fieldName) continue;

    const url = img.filePath || img.url || img.uri;
    if (!url) continue;

    const surveyField =
      fieldName === 'energyBillFront' || fieldName === 'energyBillRear' ? 'energyBill' : fieldName;

    if (!byField[surveyField]) {
      byField[surveyField] = [];
    }

    byField[surveyField].push({
      uri: url,
      name: img.fileName || img.originalName || `${surveyField}_${byField[surveyField].length + 1}.jpg`,
      mimeType: img.mimeType || 'image/jpeg',
      type: img.mimeType || 'image/jpeg',
      size: img.fileSize || 0,
      isFromServer: true,
      timestamp: Date.now(),
    });
  }

  return byField;
}

export function buildPageFilesPatch(byField: Record<string, SurveyImageFile[]>): Record<string, Record<string, string[]>> {
  const pages: Record<string, Record<string, string[]>> = {};

  for (const { field: fieldName } of SURVEY_IMAGE_UPLOAD_FIELDS) {
    const files = byField[fieldName];
    if (!files?.length) continue;

    const pageKey = getPageForSurveyImageField(fieldName);
    if (!pages[pageKey]) {
      pages[pageKey] = {};
    }
    pages[pageKey][`${fieldName}Files`] = files.map((f) => f.uri);
  }

  return pages;
}

function normalizeImagesPayload(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { images?: unknown[] }).images)) {
    return (data as { images: unknown[] }).images;
  }
  return [];
}

export function urlsToSurveyImageFiles(
  fieldName: string,
  urls: string[],
  sourceMeta?: Array<{ name?: string; mimeType?: string; size?: number }>,
): SurveyImageFile[] {
  return urls.map((url, index) => ({
    uri: url,
    name:
      sourceMeta?.[index]?.name ||
      `${fieldName}_${index + 1}.jpg`,
    mimeType: sourceMeta?.[index]?.mimeType || 'image/jpeg',
    type: sourceMeta?.[index]?.mimeType || 'image/jpeg',
    size: sourceMeta?.[index]?.size || 0,
    isFromServer: true,
    timestamp: Date.now() + index,
  }));
}

/** Fetch all survey images from API (source of truth) and return uploadedFiles map. */
export async function fetchSurveyImagesByField(
  opportunityId: string,
  options?: { skipCache?: boolean },
): Promise<Record<string, SurveyImageFile[]>> {
  const response = await surveyApi.getSurveyImages(opportunityId, {
    skipCache: options?.skipCache ?? true,
  });
  if (!response.success) {
    return {};
  }
  const images = normalizeImagesPayload(response.data);
  if (images.length === 0) {
    return {};
  }
  return mapApiImagesToUploadedFiles(images);
}

/** Fetch images for one field (used right after upload). */
export async function fetchSurveyImagesForField(
  opportunityId: string,
  fieldName: string,
  options?: { skipCache?: boolean },
): Promise<SurveyImageFile[]> {
  const response = await surveyApi.getSurveyImagesByField(opportunityId, fieldName, {
    skipCache: options?.skipCache ?? true,
  });
  if (!response.success) {
    return [];
  }
  const images = normalizeImagesPayload(response.data);
  return mapApiImagesToUploadedFiles(images)[fieldName] || [];
}
