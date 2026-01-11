import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage interface for consistent API across platforms
interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Use AsyncStorage for mobile and localStorage for web
export const getStorageInstance = (): StorageInterface | null => {
  console.log('Storage: Determining storage type...');
  console.log('Storage: Window available:', typeof window !== 'undefined');
  console.log('Storage: Document available:', typeof document !== 'undefined');
  
  // Check if we're in a web environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.log('Storage: Using localStorage (web environment)');
    return {
      getItem: async (key: string) => {
        try {
          return window.localStorage.getItem(key);
        } catch (error) {
          console.error('Storage: Error getting item from localStorage:', error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (error) {
          console.error('Storage: Error setting item in localStorage:', error);
        }
      },
      removeItem: async (key: string) => {
        try {
          window.localStorage.removeItem(key);
        } catch (error) {
          console.error('Storage: Error removing item from localStorage:', error);
        }
      }
    };
  }
  
  // Use AsyncStorage for React Native
  console.log('Storage: Using AsyncStorage (React Native environment)');
  return {
    getItem: async (key: string) => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error('Storage: Error getting item from AsyncStorage:', error);
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error('Storage: Error setting item in AsyncStorage:', error);
      }
    },
    removeItem: async (key: string) => {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error('Storage: Error removing item from AsyncStorage:', error);
      }
    }
  };
};

// Convenience functions for direct usage
export const getStorage = async (key: string): Promise<string | null> => {
  const storage = getStorageInstance();
  if (!storage) {
    console.error('Storage: No storage available');
    return null;
  }
  return await storage.getItem(key);
};

export const setStorage = async (key: string, value: string): Promise<void> => {
  const storage = getStorageInstance();
  if (!storage) {
    console.error('Storage: No storage available');
    return;
  }
  await storage.setItem(key, value);
};

export const removeStorage = async (key: string): Promise<void> => {
  const storage = getStorageInstance();
  if (!storage) {
    console.error('Storage: No storage available');
    return;
  }
  await storage.removeItem(key);
};
