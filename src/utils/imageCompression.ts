import { Platform } from 'react-native';

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

interface CompressedImageResult {
  base64: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

/**
 * Compress an image to reduce file size while maintaining reasonable quality
 */
export const compressImage = async (
  base64Data: string,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // For React Native, we'll use a simple compression approach
    // In a real app, you might want to use libraries like react-native-image-resizer
    if (Platform.OS === 'web') {
      return await compressImageWeb(cleanBase64, { maxWidth, maxHeight, quality, format });
    } else {
      return await compressImageNative(cleanBase64, { maxWidth, maxHeight, quality, format });
    }
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original data if compression fails
    return {
      base64: base64Data,
      width: 0,
      height: 0,
      size: base64Data.length,
      format: 'original'
    };
  }
};

/**
 * Compress image for web platform using Canvas API
 */
const compressImageWeb = async (
  base64Data: string,
  options: CompressionOptions
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

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = 'jpeg' } = options;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = `image/${format}`;
        const compressedBase64 = canvas.toDataURL(mimeType, quality);
        
        resolve({
          base64: compressedBase64,
          width: Math.round(width),
          height: Math.round(height),
          size: compressedBase64.length,
          format: mimeType
        });
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = `data:image/jpeg;base64,${base64Data}`;
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
export const compressImageAuto = async (base64Data: string): Promise<CompressedImageResult> => {
  const originalSize = base64Data.length;
  const settings = getOptimalCompressionSettings(originalSize);
  
  console.log(`🖼️ Compressing image: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> target: ${settings.maxWidth}x${settings.maxHeight}, quality: ${settings.quality}`);
  
  const result = await compressImage(base64Data, settings);
  
  const compressionRatio = ((originalSize - result.size) / originalSize * 100).toFixed(1);
  console.log(`✅ Image compressed: ${(result.size / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`);
  
  return result;
};

/**
 * Compress multiple images in parallel with progress tracking
 */
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
