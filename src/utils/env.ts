// Enhanced environment configuration for mobile app
// This now uses the dynamic URL manager for better URL handling
import { CONFIG, urlManager } from './config';

const getApiBaseUrl = (): string => {
  // Use the new URL manager which handles all the logic
  return urlManager.getApiUrl();
};

export const API_BASE_URL = getApiBaseUrl();

// Enhanced logging for debugging
console.log('🔧 Environment config:');
console.log('🔧 - API_BASE_URL:', API_BASE_URL);
console.log('🔧 - Environment type:', (typeof window !== 'undefined' && typeof document !== 'undefined') ? 'web' : 'mobile');
console.log('🔧 - Process env available:', typeof process !== 'undefined' && !!process.env);
console.log('🔧 - Window env available:', typeof window !== 'undefined' && !!(window as any).__ENV__);
console.log('🔧 - Platform detection:');
console.log('🔧   - window available:', typeof window !== 'undefined');
console.log('🔧   - document available:', typeof document !== 'undefined');
console.log('🔧   - navigator available:', typeof navigator !== 'undefined');
console.log('🔧   - React Native environment:', typeof global !== 'undefined' && !!(global as any).__fbBatchedBridge);

// Log all available URLs for debugging
console.log('🔧 All available URLs:', urlManager.getAllUrls());

// Export the URL manager for direct access
export { urlManager };
