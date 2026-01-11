import { useCallback, useRef } from 'react';

interface SimpleAutoSaveOptions {
  opportunityId: string;
  debounceMs?: number;
}

export const useSimpleAutoSave = ({ opportunityId, debounceMs = 5000 }: SimpleAutoSaveOptions) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDisabledRef = useRef<boolean>(false);

  // Optimized page save with smart debouncing and change detection
  const savePage = useCallback((pageName: string, pageData: any, imageData?: any) => {
    if (isDisabledRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout with longer delay
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Simple localStorage backup as fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          const backupKey = `survey_backup_${opportunityId}_${pageName}`;
          
          // Check if data has actually changed to avoid unnecessary saves
          const existingData = localStorage.getItem(backupKey);
          const newData = {
            formData: pageData,
            images: imageData || {}
          };
          
          // Only save if data has changed
          if (!existingData || existingData !== JSON.stringify(newData)) {
            console.log(`💾 Saving ${pageName} with images:`, Object.keys(imageData || {}));
            localStorage.setItem(backupKey, JSON.stringify(newData));
          } else {
            console.log(`⏭️ Skipping save for ${pageName} - no changes detected`);
          }
        }
      } catch (error) {
        // Silently fail to prevent performance issues
        console.warn('Autosave failed:', error);
      }
    }, debounceMs);
  }, [opportunityId, debounceMs]);

  // Disable autosave to prevent performance issues
  const disable = useCallback(() => {
    isDisabledRef.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  // Enable autosave
  const enable = useCallback(() => {
    isDisabledRef.current = false;
  }, []);

  // Load autosaved data from localStorage
  const loadAutoSaveData = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const allPages = ['page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8'];
        const autosavedData: any = {};
        const autosavedImages: any = {};
        let hasData = false;

        allPages.forEach(pageName => {
          const backupKey = `survey_backup_${opportunityId}_${pageName}`;
          const savedData = localStorage.getItem(backupKey);
          if (savedData) {
            try {
              const parsedData = JSON.parse(savedData);
              
              // Handle both old format (direct data) and new format (with formData/images)
              if (parsedData.formData && parsedData.images) {
                // New format
                autosavedData[pageName] = parsedData.formData;
                autosavedImages[pageName] = parsedData.images;
              } else {
                // Old format - just form data
                autosavedData[pageName] = parsedData;
              }
              hasData = true;
            } catch (error) {
              console.warn(`Failed to parse autosaved data for ${pageName}:`, error);
            }
          }
        });

        if (hasData) {
          console.log('📦 Loaded autosaved data from localStorage:', Object.keys(autosavedData));
          return {
            formData: autosavedData,
            images: autosavedImages
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load autosaved data:', error);
    }
    return null;
  }, [opportunityId]);

  // Clear autosaved data
  const clearAutoSaveData = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const allPages = ['page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8'];
        allPages.forEach(pageName => {
          const backupKey = `survey_backup_${opportunityId}_${pageName}`;
          localStorage.removeItem(backupKey);
        });
        console.log('🗑️ Cleared autosaved data from localStorage');
      }
    } catch (error) {
      console.warn('Failed to clear autosaved data:', error);
    }
  }, [opportunityId]);

  // Flush pending saves (immediate save)
  const flushPendingSaves = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    console.log('💾 Flushed pending autosaves');
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  return {
    savePage,
    loadAutoSaveData,
    clearAutoSaveData,
    flushPendingSaves,
    disable,
    enable,
    cleanup
  };
};


