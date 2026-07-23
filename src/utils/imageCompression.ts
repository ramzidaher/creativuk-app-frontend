import { Platform } from 'react-native';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  sourceMimeType?: string;
}

interface CompressedImageResult {
  base64: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

/** Max base64 payload per image upload (~2MB encoded) to stay under IIS limits. */
export const MAX_SURVEY_UPLOAD_BASE64_LENGTH = 2.5 * 1024 * 1024;

export class SurveyUploadTooLargeError extends Error {
  constructor(public fileName: string) {
    super(
      `Photo "${fileName}" is still too large after compression. Upload one photo at a time, or save it as JPEG and try again.`,
    );
    this.name = 'SurveyUploadTooLargeError';
  }
}

export class SurveyUploadCompressionError extends Error {
  constructor(public fileName: string, reason?: string) {
    super(
      reason ||
        `Could not process "${fileName}". Save it as JPEG or PNG and try again (HEIC may not be supported in the browser).`,
    );
    this.name = 'SurveyUploadCompressionError';
  }
}

function resolveSourceMimeType(mimeType?: string): string {
  if (mimeType?.startsWith('image/')) {
    return mimeType;
  }
  return 'image/jpeg';
}

function base64PayloadLength(base64: string): number {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  return clean.length;
}

/**
 * Compress an image to reduce file size while maintaining reasonable quality
 */
export const compressImage = async (
  base64Data: string,
  options: CompressionOptions = {},
  fallbackToOriginal = true,
): Promise<CompressedImageResult> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'jpeg',
    sourceMimeType,
  } = options;

  try {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z+]+;base64,/, '');

    if (Platform.OS === 'web') {
      return await compressImageWeb(cleanBase64, {
        maxWidth,
        maxHeight,
        quality,
        format,
        sourceMimeType,
      });
    }

    return await compressImageNative(cleanBase64, { maxWidth, maxHeight, quality, format });
  } catch (error) {
    console.error('Image compression failed:', error);
    if (!fallbackToOriginal) {
      throw error;
    }
    return {
      base64: base64Data,
      width: 0,
      height: 0,
      size: base64Data.length,
      format: 'original',
    };
  }
};

async function compressImageFromBlobUrl(
  blobUrl: string,
  options: CompressionOptions,
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        let { width, height } = img;
        const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = 'jpeg' } = options;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = `image/${format}`;
        const compressedBase64 = canvas.toDataURL(mimeType, quality);

        resolve({
          base64: compressedBase64,
          width: Math.round(width),
          height: Math.round(height),
          size: compressedBase64.length,
          format: mimeType,
        });
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image from blob URL'));
    img.src = blobUrl;
  });
}

/**
 * Compress image for web platform using Canvas API
 */
const compressImageWeb = async (
  base64Data: string,
  options: CompressionOptions,
): Promise<CompressedImageResult> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        let { width, height } = img;
        const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = 'jpeg' } = options;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = `image/${format}`;
        const compressedBase64 = canvas.toDataURL(mimeType, quality);

        resolve({
          base64: compressedBase64,
          width: Math.round(width),
          height: Math.round(height),
          size: compressedBase64.length,
          format: mimeType,
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      const sourceMime = resolveSourceMimeType(options.sourceMimeType);
      img.src = `data:${sourceMime};base64,${base64Data}`;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Compress image for native platforms (React Native)
 * This is a simplified version - in production, use react-native-image-resizer
 */
const compressImageNative = async (
  base64Data: string,
  options: CompressionOptions
): Promise<CompressedImageResult> => {
  // For native platforms, we'll implement a basic compression
  // In production, you should use react-native-image-resizer or similar library
  
  const { quality = 0.8 } = options;
  
  // Simple base64 compression by reducing quality (this is a basic approach)
  // In a real app, you'd use proper image compression libraries
  const compressedSize = Math.round(base64Data.length * quality);
  
  return {
    base64: base64Data, // In production, this would be the actual compressed image
    width: 0, // Would be calculated from actual image
    height: 0, // Would be calculated from actual image
    size: compressedSize,
    format: 'image/jpeg'
  };
};

/**
 * Get optimal compression settings based on image size - ULTRA AGGRESSIVE FOR BACKEND LIMITS
 */
export const getOptimalCompressionSettings = (originalSize: number): CompressionOptions => {
  if (originalSize > 2 * 1024 * 1024) { // > 2MB - Ultra aggressive compression
    return { maxWidth: 800, maxHeight: 600, quality: 0.4, format: 'jpeg' };
  } else if (originalSize > 1 * 1024 * 1024) { // > 1MB - Very aggressive compression
    return { maxWidth: 1024, maxHeight: 768, quality: 0.5, format: 'jpeg' };
  } else if (originalSize > 500 * 1024) { // > 500KB - Aggressive compression
    return { maxWidth: 1280, maxHeight: 720, quality: 0.6, format: 'jpeg' };
  } else {
    return { maxWidth: 1600, maxHeight: 900, quality: 0.7, format: 'jpeg' };
  }
};

/**
 * Compress image with automatic quality adjustment
 */
export const compressImageAuto = async (
  base64Data: string,
  mimeType?: string,
  byteSize?: number,
): Promise<CompressedImageResult> => {
  const originalSize = byteSize ?? base64Data.length;
  const settings = getOptimalCompressionSettings(originalSize);

  console.log(
    `🖼️ Compressing image: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> target: ${settings.maxWidth}x${settings.maxHeight}, quality: ${settings.quality}`,
  );

  let result = await compressImage(base64Data, { ...settings, sourceMimeType: mimeType }, false);

  if (base64PayloadLength(result.base64) > MAX_SURVEY_UPLOAD_BASE64_LENGTH) {
    console.log('🖼️ Still too large, applying ultra compression...');
    result = await compressImage(
      base64Data,
      { maxWidth: 640, maxHeight: 480, quality: 0.35, format: 'jpeg', sourceMimeType: mimeType },
      false,
    );
  }

  const compressionRatio = ((originalSize - result.size) / originalSize * 100).toFixed(1);
  console.log(
    `✅ Image compressed: ${(result.size / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`,
  );

  return result;
};

/**
 * Compress multiple images in parallel with progress tracking
 */
export interface SurveyUploadFile {
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  base64?: string;
  base64Data?: string;
  isNew?: boolean;
  timestamp?: number;
  isCompressed?: boolean;
  originalSize?: number;
}

function stripDataUrlPrefix(data: string): string {
  return data.includes(',') ? data.split(',')[1] : data;
}

function isPdfUpload(file: Pick<SurveyUploadFile, 'mimeType' | 'name'>): boolean {
  return (
    file.mimeType === 'application/pdf' ||
    (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf'))
  );
}

/**
 * Compress a survey upload file before sending to the API (skips PDFs and already-compressed files).
 */
export async function compressSurveyUploadFile<T extends SurveyUploadFile>(file: T): Promise<T> {
  if (file.isCompressed || isPdfUpload(file)) {
    if (isPdfUpload(file) && (file.size ?? 0) > 8 * 1024 * 1024) {
      throw new SurveyUploadTooLargeError(file.name || 'PDF');
    }
    return file;
  }

  const raw = file.base64Data || file.base64 || '';
  if (!raw) {
    throw new SurveyUploadCompressionError(file.name || 'image', 'Missing image data.');
  }

  const originalBase64 = stripDataUrlPrefix(raw);
  if (!originalBase64) {
    throw new SurveyUploadCompressionError(file.name || 'image', 'Missing image data.');
  }

  let compressedResult: CompressedImageResult;

  try {
    if (Platform.OS === 'web' && file.uri?.startsWith('blob:')) {
      const settings = getOptimalCompressionSettings(file.size ?? originalBase64.length);
      compressedResult = await compressImageFromBlobUrl(file.uri, settings);
      if (base64PayloadLength(compressedResult.base64) > MAX_SURVEY_UPLOAD_BASE64_LENGTH) {
        compressedResult = await compressImageFromBlobUrl(file.uri, {
          maxWidth: 640,
          maxHeight: 480,
          quality: 0.35,
          format: 'jpeg',
        });
      }
    } else {
      compressedResult = await compressImageAuto(originalBase64, file.mimeType, file.size);
    }
  } catch (error) {
    console.warn('Survey upload compression failed:', file.name, error);
    throw new SurveyUploadCompressionError(
      file.name || 'image',
      error instanceof Error ? error.message : undefined,
    );
  }

  const cleanBase64 = stripDataUrlPrefix(compressedResult.base64);
  if (base64PayloadLength(cleanBase64) > MAX_SURVEY_UPLOAD_BASE64_LENGTH) {
    throw new SurveyUploadTooLargeError(file.name || 'image');
  }

  const compressedDataUrl = compressedResult.base64.includes(',')
    ? compressedResult.base64
    : `data:${compressedResult.format};base64,${compressedResult.base64}`;

  return {
    ...file,
    uri: compressedDataUrl,
    size: compressedResult.size,
    mimeType: compressedResult.format,
    base64: compressedDataUrl,
    base64Data: cleanBase64,
    isCompressed: true,
    originalSize: originalBase64.length,
  };
}

export async function compressSurveyUploadFiles<T extends SurveyUploadFile>(
  files: T[],
): Promise<T[]> {
  return Promise.all(files.map(compressSurveyUploadFile));
}

export const compressImagesBatch = async (
  images: Array<{ base64: string; fieldName: string; fileName?: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ fieldName: string; fileName?: string; result: CompressedImageResult }>> => {
  const totalImages = images.length;
  let completedImages = 0;
  
  console.log(`🖼️ Starting batch compression of ${totalImages} images...`);
  
  const compressionPromises = images.map(async (image, index) => {
    try {
      const result = await compressImageAuto(image.base64);
      completedImages++;
      
      if (onProgress) {
        onProgress(completedImages, totalImages);
      }
      
      console.log(`✅ Compressed image ${index + 1}/${totalImages}: ${image.fieldName}`);
      
      return {
        fieldName: image.fieldName,
        fileName: image.fileName,
        result
      };
    } catch (error) {
      console.error(`❌ Failed to compress image ${image.fieldName}:`, error);
      completedImages++;
      
      if (onProgress) {
        onProgress(completedImages, totalImages);
      }
      
      // Return original data if compression fails
      return {
        fieldName: image.fieldName,
        fileName: image.fileName,
        result: {
          base64: image.base64,
          width: 0,
          height: 0,
          size: image.base64.length,
          format: 'original'
        }
      };
    }
  });
  
  const results = await Promise.all(compressionPromises);
  
  const totalOriginalSize = images.reduce((sum, img) => sum + img.base64.length, 0);
  const totalCompressedSize = results.reduce((sum, result) => sum + result.result.size, 0);
  const totalCompressionRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1);
  
  console.log(`🎉 Batch compression complete: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB -> ${(totalCompressedSize / 1024 / 1024).toFixed(2)}MB (${totalCompressionRatio}% reduction)`);
  
  return results;
};
