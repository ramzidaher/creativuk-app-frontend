import { useCallback, useRef, useState } from 'react';
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
  cloudinaryUrl?: string;
  fieldName?: string;
}

interface ImageUploadProgress {
  total: number;
  completed: number;
  currentField: string;
  isUploading: boolean;
}

interface EnhancedImageHandlerOptions {
  onImageSaved?: (fieldName: string, imageUrl: string) => void;
  onImageError?: (fieldName: string, error: Error) => void;
  onUploadProgress?: (progress: ImageUploadProgress) => void;
  pageAutoSave: any; // The pageAutoSave hook
}

export const useEnhancedImageHandler = ({ 
  onImageSaved, 
  onImageError, 
  onUploadProgress,
  pageAutoSave 
}: EnhancedImageHandlerOptions) => {
  const [uploadProgress, setUploadProgress] = useState<ImageUploadProgress>({
    total: 0,
    completed: 0,
    currentField: '',
    isUploading: false
  });
  
  const uploadQueueRef = useRef<Map<string, ImageFile[]>>(new Map());
  const processingRef = useRef<boolean>(false);

  // Process upload queue
  const processUploadQueue = useCallback(async () => {
    if (processingRef.current || uploadQueueRef.current.size === 0) {
      return;
    }

    processingRef.current = true;
    const queueEntries = Array.from(uploadQueueRef.current.entries());
    uploadQueueRef.current.clear();

    const totalImages = queueEntries.reduce((sum, [, images]) => sum + images.length, 0);
    let completedImages = 0;

    setUploadProgress({
      total: totalImages,
      completed: 0,
      currentField: queueEntries[0]?.[0] || '',
      isUploading: true
    });

    try {
      for (const [fieldName, images] of queueEntries) {
        setUploadProgress(prev => ({ ...prev, currentField: fieldName }));

        for (const image of images) {
          if (image.base64Data && !image.isAutoSaved) {
            try {
              // Compress image with optimized settings
              const compressedImage = await compressImageAuto(image.base64Data);

              // Save compressed image
              const saveResult = await pageAutoSave.saveImage(fieldName, {
                base64Data: compressedImage.base64,
                fileName: image.name,
                mimeType: compressedImage.format,
                fileSize: compressedImage.size
              });

              if (saveResult.success && saveResult.imageUrl) {
                image.cloudinaryUrl = saveResult.imageUrl;
                image.isAutoSaved = true;
                onImageSaved?.(fieldName, saveResult.imageUrl);
              }
            } catch (error) {
              console.error(`Failed to save image for ${fieldName}:`, error);
              onImageError?.(fieldName, error as Error);
            }
          }

          completedImages++;
          setUploadProgress(prev => ({ ...prev, completed: completedImages }));
          onUploadProgress?.({
            total: totalImages,
            completed: completedImages,
            currentField: fieldName,
            isUploading: true
          });

          // Small delay to prevent blocking
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      setUploadProgress({
        total: 0,
        completed: 0,
        currentField: '',
        isUploading: false
      });
      processingRef.current = false;
    }
  }, [pageAutoSave, onImageSaved, onImageError, onUploadProgress]);

  // Add images to upload queue
  const queueImageUpload = useCallback((fieldName: string, images: ImageFile[]) => {
    const imagesToUpload = images.filter(img => img.base64Data && !img.isAutoSaved);
    
    if (imagesToUpload.length > 0) {
      uploadQueueRef.current.set(fieldName, imagesToUpload);
      
      // Process queue with a delay to allow for batching
      setTimeout(() => {
        processUploadQueue();
      }, 200);
    }
  }, [processUploadQueue]);

  // Restore images from server
  const restoreImagesForField = useCallback(async (fieldName: string): Promise<ImageFile[]> => {
    try {
      // Load auto-saved data to get image URLs
      const autoSaveData = await pageAutoSave.loadAutoSaveData();
      
      if (autoSaveData.success && autoSaveData.data?.images?.[fieldName]) {
        const savedImages = autoSaveData.data.images[fieldName];
        
        return savedImages.map((savedImage: any) => ({
          uri: savedImage.url || savedImage.cloudinaryUrl,
          name: savedImage.fileName,
          size: savedImage.fileSize || 0,
          mimeType: savedImage.mimeType || 'image/jpeg',
          isAutoSaved: true,
          cloudinaryUrl: savedImage.url || savedImage.cloudinaryUrl,
          fieldName: fieldName,
          timestamp: new Date(savedImage.uploadedAt || Date.now()).getTime()
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to restore images for ${fieldName}:`, error);
      return [];
    }
  }, [pageAutoSave]);

  // Restore all images for current page
  const restoreImagesForPage = useCallback(async (pageNumber: number): Promise<{ [fieldName: string]: ImageFile[] }> => {
    const imageFieldsByPage: { [key: number]: string[] } = {
      4: ['energyBill'],
      5: ['epcCertificate'],
      6: ['frontDoor', 'frontProperty', 'targetRoofs', 'propertySides'],
      7: ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 'garage', 'fuseBoard', 'batteryInverterLocation'],
      8: ['evLocation', 'evCharger', 'shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature']
    };

    const fieldsForPage = imageFieldsByPage[pageNumber] || [];
    const restoredImages: { [fieldName: string]: ImageFile[] } = {};

    for (const fieldName of fieldsForPage) {
      restoredImages[fieldName] = await restoreImagesForField(fieldName);
    }

    return restoredImages;
  }, [restoreImagesForField]);

  // Get upload progress
  const getUploadProgress = useCallback(() => uploadProgress, [uploadProgress]);

  // Clear upload queue
  const clearUploadQueue = useCallback(() => {
    uploadQueueRef.current.clear();
    processingRef.current = false;
    setUploadProgress({
      total: 0,
      completed: 0,
      currentField: '',
      isUploading: false
    });
  }, []);

  return {
    queueImageUpload,
    restoreImagesForField,
    restoreImagesForPage,
    getUploadProgress,
    clearUploadQueue,
    uploadProgress
  };
};
