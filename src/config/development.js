// Development configuration
// This file can be easily modified to switch between different backend URLs

export const DEVELOPMENT_CONFIG = {
  // Backend URL options for local development
  BACKEND_URLS: {
    // Production backend (default for testing)
    PRODUCTION: 'https://app.creativuk.co.uk/api/',
    
    // Local Nest backend (port 3010 — avoids conflict with other apps on :3000)
    LOCAL: 'http://127.0.0.1:3010/',

    // Windows Excel server — DEV Nest (creativ-backend-dev on 3010)
    // Prod on that box stays on 3000 and is untouched.
    // Public IP (Azure); LAN was 10.0.0.4 — use public when not on that network.
    WINDOWS_DEV: 'http://172.187.217.251:3010/',
    
    // Relative path (for production build testing)
    RELATIVE: '/api/',
    
    // Custom URL (add your own)
    CUSTOM: 'https://your-custom-backend.com/api/'
  },
  
  // Current active URL - change this to switch backends
  ACTIVE_URL: 'WINDOWS_DEV', // Options: PRODUCTION, LOCAL, WINDOWS_DEV, RELATIVE, CUSTOM
  DEV_MODE: true,
  
  // Auto-detect working URL on startup
  AUTO_DETECT: false,
  
  // Show debug logs
  DEBUG: true
};

// Helper function to get the current backend URL
export const getCurrentBackendUrl = () => {
  const config = DEVELOPMENT_CONFIG;
  const selectedUrl = config.BACKEND_URLS[config.ACTIVE_URL];
  
  if (config.DEBUG) {
    console.log('🔧 Development Config:', {
      activeUrl: config.ACTIVE_URL,
      selectedUrl: selectedUrl,
      devMode: config.DEV_MODE
    });
  }
  
  return selectedUrl;
};

// Helper function to switch backend URL
export const switchBackendUrl = (urlKey) => {
  if (DEVELOPMENT_CONFIG.BACKEND_URLS[urlKey]) {
    DEVELOPMENT_CONFIG.ACTIVE_URL = urlKey;
    console.log('🔧 Switched to backend URL:', urlKey, '=', DEVELOPMENT_CONFIG.BACKEND_URLS[urlKey]);
    return DEVELOPMENT_CONFIG.BACKEND_URLS[urlKey];
  } else {
    console.error('❌ Invalid URL key:', urlKey);
    console.log('Available options:', Object.keys(DEVELOPMENT_CONFIG.BACKEND_URLS));
    return null;
  }
};

// Helper function to add custom URL
export const addCustomUrl = (name, url) => {
  DEVELOPMENT_CONFIG.BACKEND_URLS[name.toUpperCase()] = url;
  console.log('🔧 Added custom URL:', name, '=', url);
  return url;
};

// Helper function to list all available URLs
export const listAvailableUrls = () => {
  console.log('🔧 Available backend URLs:');
  Object.entries(DEVELOPMENT_CONFIG.BACKEND_URLS).forEach(([key, url]) => {
    const isActive = key === DEVELOPMENT_CONFIG.ACTIVE_URL ? ' (ACTIVE)' : '';
    console.log(`  ${key}: ${url}${isActive}`);
  });
  return DEVELOPMENT_CONFIG.BACKEND_URLS;
};
