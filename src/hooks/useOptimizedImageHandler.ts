import { useCallback, useRef } from 'react';
import { compressImageAuto } from '../utils/imageCompression';

interface ImageFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  base64?: string;
  base64Data?: string;
  isNew?: boolean;
  timestamp?: number;
  isAutoSaved?: boolean;
}

interface OptimizedImageHandlerOptions {
  onImageSaved?: (fieldName: string, imageUrl: string) => void;
  onImageError?: (fieldName: string, error: Error) => void;
}

export const useOptimizedImageHandler = ({ onImageSaved, onImageError }: OptimizedImageHandlerOptions = {}) => {
  const processingQueueRef = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingImagesRef = useRef<Map<string, ImageFile[]>>(new Map());

  // Process images in batches to avoid blocking the UI
  const processImageBatch = useCallback(async (fieldName: string, images: ImageFile[]) => {
    if (processingQueueRef.current.has(fieldName)) {
      return; // Already processing this field
    }

    processingQueueRef.current.add(fieldName);

    try {
      // Process images one by one but with small delays to prevent blocking
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        if (image.base64Data && !image.isAutoSaved) {
          try {
            // Small delay to prevent blocking the UI
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Compress image
            const compressedImage = await compressImageAuto(
              image.base64Data,
              image.mimeType,
              image.size,
              fieldName,
            );
            
            // Here you would typically save to your backend
            // For now, we'll just mark as processed
            image.isAutoSaved = true;
            image.uri = `processed_${image.uri}`;
            
            onImageSaved?.(fieldName, image.uri);
          } catch (error) {
            console.error(`Failed to process image ${i + 1} for ${fieldName}:`, error);
            onImageError?.(fieldName, error as Error);
          }
        }
      }
    } finally {
      processingQueueRef.current.delete(fieldName);
    }
  }, [onImageSaved, onImageError]);

  // Add images to processing queue
  const addImagesToQueue = useCallback((fieldName: string, images: ImageFile[]) => {
    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Add to pending queue
    pendingImagesRef.current.set(fieldName, images);

    // Process batch after a short delay
    batchTimeoutRef.current = setTimeout(() => {
      const pendingImages = Array.from(pendingImagesRef.current.entries());
      pendingImagesRef.current.clear();

      // Process each field's images
      pendingImages.forEach(([fieldName, images]) => {
        processImageBatch(fieldName, images);
      });
    }, 500); // 500ms delay to batch multiple uploads
  }, [processImageBatch]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    processingQueueRef.current.clear();
    pendingImagesRef.current.clear();
  }, []);

  return {
    addImagesToQueue,
    cleanup
  };
};


