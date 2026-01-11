import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { autoSaveApi } from '../utils/api';

interface AutoSaveData {
  [pageKey: string]: any;
  lastPage?: string;
  images?: { [fieldName: string]: any[] };
}

interface AutoSaveOptions {
  opportunityId: string;
  debounceMs?: number;
}

export const useAutoSave = ({ opportunityId, debounceMs = 1000 }: AutoSaveOptions) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Load auto-saved data from server
  const loadAutoSaveData = useCallback(async (): Promise<{ success: boolean; data: AutoSaveData }> => {
    try {
      const response = await autoSaveApi.getAutoSaveData(opportunityId);
      
      if (response.success && response.data) {
        // The actual auto-saved data is nested in response.data.data
        const autoSaveData = response.data.data || {};
        console.log('📥 Loaded auto-save data:', Object.keys(autoSaveData).length, 'fields');
        return { success: true, data: autoSaveData };
      }
      
      return { success: true, data: {} };
    } catch (error) {
      console.error('❌ Error loading auto-save data:', error);
      return { success: false, data: {} };
    }
  }, [opportunityId]);

  // Save field to server with debouncing
  const saveField = useCallback(async (fieldName: string, fieldValue: any, skipLastPageUpdate = false): Promise<{ success: boolean }> => {
    try {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for debounced save
      return new Promise((resolve) => {
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const response = await autoSaveApi.autoSaveField({
              opportunityId,
              fieldName,
              fieldValue,
              skipLastPageUpdate
            });

            if (response.success) {
              resolve({ success: true });
            } else {
              console.error(`❌ Failed to auto-save field: ${fieldName}`, response.error);
              resolve({ success: false });
            }
          } catch (error) {
            console.error(`❌ Error auto-saving field: ${fieldName}`, error);
            resolve({ success: false });
          }
        }, debounceMs);
      });
    } catch (error) {
      console.error(`❌ Error setting up auto-save for field: ${fieldName}`, error);
      return { success: false };
    }
  }, [opportunityId, debounceMs]);

  // Save entire page to server
  const savePage = useCallback(async (pageName: string, pageData: any): Promise<{ success: boolean }> => {
    try {
      const response = await autoSaveApi.autoSaveField({
        opportunityId,
        pageName,
        pageData,
        skipLastPageUpdate: false
      });

      if (response.success) {
        return { success: true };
      } else {
        console.error(`❌ Failed to auto-save page: ${pageName}`, response.error);
        return { success: false };
      }
    } catch (error) {
      console.error(`❌ Error auto-saving page: ${pageName}`, error);
      return { success: false };
    }
  }, [opportunityId]);

  // Save image to server
  const saveImage = useCallback(async (fieldName: string, imageData: { base64Data: string; fileName: string; mimeType: string; fileSize: number }): Promise<{ success: boolean; imageUrl?: string }> => {
    try {
      const response = await autoSaveApi.autoSaveImage({
        opportunityId,
        fieldName,
        base64Data: imageData.base64Data,
        fileName: imageData.fileName,
        mimeType: imageData.mimeType,
        fileSize: imageData.fileSize
      });

      if (response.success) {
        return { success: true, imageUrl: response.data?.imageUrl };
      } else {
        console.error(`❌ Failed to auto-save image for field: ${fieldName}`, response.error);
        return { success: false };
      }
    } catch (error) {
      console.error(`❌ Error auto-saving image for field: ${fieldName}`, error);
      return { success: false };
    }
  }, [opportunityId]);

  // Update last page
  const updateLastPage = useCallback(async (pageName: string): Promise<boolean> => {
    try {
      const response = await autoSaveApi.autoSaveField({
        opportunityId,
        fieldName: 'lastPage',
        fieldValue: pageName,
        skipLastPageUpdate: false
      });

      if (response.success) {
        return true;
      } else {
        console.error(`❌ Failed to update last page: ${pageName}`, response.error);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error updating last page: ${pageName}`, error);
      return false;
    }
  }, [opportunityId]);

  // Clear auto-save data from server
  const clearAutoSaveData = useCallback(async (): Promise<{ success: boolean }> => {
    try {
      const response = await autoSaveApi.clearAutoSaveData(opportunityId);
      
      if (response.success) {
        return { success: true };
      } else {
        console.error('❌ Failed to clear auto-save data from server', response.error);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Error clearing auto-save data from server:', error);
      return { success: false };
    }
  }, [opportunityId]);

  // Flush pending saves (save immediately)
  const flushPendingSaves = useCallback(async (): Promise<{ success: boolean }> => {
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Error flushing pending saves:', error);
      return { success: false };
    }
  }, []);

  // Transfer auto-save data to survey
  const transferToSurvey = useCallback(async (): Promise<{ success: boolean; data?: any }> => {
    try {
      const response = await autoSaveApi.transferToSurvey(opportunityId);
      
      if (response.success) {
        return { success: true, data: response.data?.surveyData };
      } else {
        console.error('❌ Failed to transfer auto-save data to survey', response.error);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Error transferring auto-save data to survey:', error);
      return { success: false };
    }
  }, [opportunityId]);

  return {
    saveField,
    savePage,
    saveImage,
    updateLastPage,
    loadAutoSaveData,
    clearAutoSaveData,
    flushPendingSaves,
    transferToSurvey
  };
};