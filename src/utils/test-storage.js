import AsyncStorage from '@react-native-async-storage/async-storage';

export const testStorage = async () => {
  console.log('Testing AsyncStorage...');
  
  try {
    // Test writing
    await AsyncStorage.setItem('test-key', 'test-value');
    console.log('✅ Write test passed');
    
    // Test reading
    const value = await AsyncStorage.getItem('test-key');
    console.log('✅ Read test passed, value:', value);
    
    // Test reading non-existent key
    const nonExistent = await AsyncStorage.getItem('non-existent');
    console.log('✅ Non-existent read test passed, value:', nonExistent);
    
    // Test removing
    await AsyncStorage.removeItem('test-key');
    const afterRemove = await AsyncStorage.getItem('test-key');
    console.log('✅ Remove test passed, value after remove:', afterRemove);
    
    return true;
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    return false;
  }
};

// Test localStorage for web
export const testLocalStorage = async () => {
  console.log('Testing localStorage...');
  
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('❌ localStorage not available (not in web environment)');
      return false;
    }
    
    // Test writing
    window.localStorage.setItem('test-key', 'test-value');
    console.log('✅ localStorage write test passed');
    
    // Test reading
    const value = window.localStorage.getItem('test-key');
    console.log('✅ localStorage read test passed, value:', value);
    
    // Test reading non-existent key
    const nonExistent = window.localStorage.getItem('non-existent');
    console.log('✅ localStorage non-existent read test passed, value:', nonExistent);
    
    // Test removing
    window.localStorage.removeItem('test-key');
    const afterRemove = window.localStorage.getItem('test-key');
    console.log('✅ localStorage remove test passed, value after remove:', afterRemove);
    
    return true;
  } catch (error) {
    console.error('❌ localStorage test failed:', error);
    return false;
  }
};

// Test the current storage implementation
export const testCurrentStorage = async () => {
  console.log('Testing current storage implementation...');
  
  try {
    // Import the getStorage function from api.ts
    const { getStorage } = await import('./api');
    
    const storage = getStorage();
    console.log('Storage type:', typeof storage);
    console.log('Storage available:', !!storage);
    
    if (!storage) {
      console.log('❌ No storage available');
      return false;
    }
    
    // Test writing
    await storage.setItem('test-key', 'test-value');
    console.log('✅ Current storage write test passed');
    
    // Test reading
    const value = await storage.getItem('test-key');
    console.log('✅ Current storage read test passed, value:', value);
    
    // Test removing
    await storage.removeItem('test-key');
    const afterRemove = await storage.getItem('test-key');
    console.log('✅ Current storage remove test passed, value after remove:', afterRemove);
    
    return true;
  } catch (error) {
    console.error('❌ Current storage test failed:', error);
    return false;
  }
};
