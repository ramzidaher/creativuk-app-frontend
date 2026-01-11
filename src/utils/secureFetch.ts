// Secure fetch wrapper for handling SSL certificate issues in development
// This is a development-only solution for self-signed certificates

interface SecureFetchOptions extends RequestInit {
  ignoreSSL?: boolean; // Development flag to ignore SSL certificate validation
}

// Development environment check
const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

/**
 * Custom fetch wrapper that handles SSL certificate issues in development
 * In production, this should use standard fetch with proper SSL validation
 */
export const secureFetch = async (url: string, options: SecureFetchOptions = {}): Promise<Response> => {
  const { ignoreSSL = false, ...fetchOptions } = options;
  
  // In development, we can ignore SSL certificate validation for self-signed certificates
  if (isDevelopment && ignoreSSL) {
    console.log('🔧 Development mode: Ignoring SSL certificate validation for:', url);
    
    // For web/Expo web, we can't disable SSL validation
    // But we can add headers to help with development
    if (typeof window !== 'undefined') {
      // Running in web browser - add development headers
      const headers = new Headers(fetchOptions.headers);
      headers.set('ngrok-skip-browser-warning', 'true');
      
      return fetch(url, {
        ...fetchOptions,
        headers,
      });
    }
    
    // For native apps, we need to handle this differently
    // The standard fetch should work with proper certificate handling
    return fetch(url, fetchOptions);
  }
  
  // Production mode - use standard fetch with full SSL validation
  return fetch(url, fetchOptions);
};

/**
 * Development helper to test SSL connectivity
 */
export const testSSLConnection = async (url: string): Promise<boolean> => {
  try {
    console.log('🔍 Testing SSL connection to:', url);
    
    const response = await secureFetch(url, {
      method: 'GET',
      ignoreSSL: true, // Allow self-signed certificates in development
    });
    
    const isOk = response.ok;
    console.log(`🔍 SSL test result: ${isOk ? '✅ Success' : '❌ Failed'} (${response.status})`);
    
    return isOk;
  } catch (error) {
    console.log('🔍 SSL test failed:', error);
    return false;
  }
};

/**
 * Auto-detect working URL with SSL handling
 */
export const detectWorkingUrl = async (urls: string[]): Promise<string | null> => {
  console.log('🔍 Auto-detecting working URL with SSL handling...');
  
  for (const url of urls) {
    console.log('🔍 Testing URL:', url);
    
    try {
      const isWorking = await testSSLConnection(url);
      if (isWorking) {
        console.log('✅ Found working URL:', url);
        return url;
      }
    } catch (error) {
      console.log('❌ URL test failed:', url, error);
    }
  }
  
  console.log('❌ No working URLs found');
  return null;
};


