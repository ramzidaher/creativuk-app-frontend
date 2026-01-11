interface ImageFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  base64?: string;
  base64Data?: string;
  isNew?: boolean;
  timestamp?: number;
  fieldName?: string;
}

interface BatchUploadOptions {
  maxImagesPerField?: number; // Maximum images per field (default: 2)
  maxTotalImages?: number; // Maximum total images (default: 10)
  maxTotalSizeBytes?: number; // Maximum total size in bytes (default: 100MB)
}

/**
 * Filter and limit images to prevent payload too large errors
 */
export const filterImagesForSubmission = (
  uploadedFiles: { [fieldName: string]: ImageFile[] },
  options: BatchUploadOptions = {}
): { [fieldName: string]: ImageFile[] } => {
  const {
    maxImagesPerField = 2, // Limit to 2 images per field
    maxTotalImages = 10, // Limit to 10 total images
    maxTotalSizeBytes = 100 * 1024 * 1024 // 100MB total limit
  } = options;

  console.log(`🔍 Filtering images for submission...`);
  console.log(`📊 Original images:`, Object.keys(uploadedFiles).map(field => ({
    field,
    count: uploadedFiles[field]?.length || 0
  })));

  const filteredFiles: { [fieldName: string]: ImageFile[] } = {};
  let totalImages = 0;
  let totalSize = 0;

  // Process each field
  for (const [fieldName, images] of Object.entries(uploadedFiles)) {
    if (!images || images.length === 0) continue;

    // Sort images by size (smallest first) and take only the best ones
    const sortedImages = images
      .filter(img => img.base64 && img.base64.length > 0) // Only include images with data
      .sort((a, b) => (a.base64?.length || 0) - (b.base64?.length || 0)) // Sort by size
      .slice(0, maxImagesPerField); // Take only the smallest images

    if (sortedImages.length > 0) {
      // Check if adding these images would exceed limits
      const fieldSize = sortedImages.reduce((sum, img) => sum + (img.base64?.length || 0), 0);
      
      if (totalImages + sortedImages.length <= maxTotalImages && 
          totalSize + fieldSize <= maxTotalSizeBytes) {
        filteredFiles[fieldName] = sortedImages;
        totalImages += sortedImages.length;
        totalSize += fieldSize;
      } else {
        console.log(`⚠️ Skipping field ${fieldName} - would exceed limits`);
      }
    }
  }

  console.log(`📊 Filtered images:`, Object.keys(filteredFiles).map(field => ({
    field,
    count: filteredFiles[field]?.length || 0
  })));
  console.log(`📊 Total: ${totalImages} images, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

  return filteredFiles;
};

/**
 * Estimate the total size of images in bytes
 */
export const estimateImageBatchSize = (images: ImageFile[]): number => {
  return images.reduce((total, image) => {
    return total + (image.base64?.length || image.size || 0);
  }, 0);
};

/**
 * Check if images would exceed backend limits
 */
export const wouldExceedBackendLimits = (images: ImageFile[], limitBytes: number = 200 * 1024 * 1024): boolean => {
  const totalSize = estimateImageBatchSize(images);
  return totalSize > limitBytes;
};
