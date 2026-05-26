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

    if (!byField[fieldName]) {
      byField[fieldName] = [];
    }

    byField[fieldName].push({
      uri: url,
      name: img.fileName || img.originalName || `${fieldName}_${byField[fieldName].length + 1}.jpg`,
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

/** Fetch all survey images from API (source of truth) and return uploadedFiles map. */
export async function fetchSurveyImagesByField(opportunityId: string): Promise<Record<string, SurveyImageFile[]>> {
  const response = await surveyApi.getSurveyImages(opportunityId);
  if (!response.success || !Array.isArray(response.data)) {
    return {};
  }
  return mapApiImagesToUploadedFiles(response.data);
}
