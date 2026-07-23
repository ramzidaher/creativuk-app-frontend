// Enhanced configuration for the mobile app
// This provides dynamic URL management and easy testing capabilities

import { DEVELOPMENT_CONFIG, getCurrentBackendUrl } from '../config/development.js';

function isLocalhostHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('192.168.') ||
    hostname.includes('10.0.')
  );
}

/** Expo / Metro web dev (localhost:8081, etc.) */
function isExpoDevServer() {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    isLocalhostHost(window.location.hostname) &&
    (window.location.port === '8081' ||
      window.location.port === '19006' ||
      window.location.port === '19000' ||
      window.location.port === '19001' ||
      window.location.port === '19002' ||
      !window.location.port)
  );
}

/** ngrok tunnels expire — never trust saved ngrok URLs */
function isStaleSavedUrl(url) {
  if (!url || typeof url !== 'string') {
    return true;
  }
  return /ngrok-free\.app|ngrok\.io|ngrok\.app/i.test(url);
}

// URL Management System
class URLManager {
  constructor() {
    this.storageKey = 'creativ_solar_api_url';
    // Use development config for easy URL switching
    this.defaultUrl = getCurrentBackendUrl(); // Dynamic URL from development config
    this.fallbackUrl = '/api/'; // Relative URL for production deployment
    this.overrideUrl = null;
  }

  // Get the current API URL with fallback logic
  getApiUrl() {
    // 1. Check for override (highest priority)
    if (this.overrideUrl) {
      console.log('🔧 Using override URL:', this.overrideUrl);
      return this.overrideUrl;
    }

    const expoDev = isExpoDevServer();

    // 2. Expo web dev — always use development.js ACTIVE_URL (ignore stale localStorage/ngrok)
    if (expoDev && DEVELOPMENT_CONFIG.DEV_MODE) {
      const devUrl = getCurrentBackendUrl();
      console.log('🔧 Expo dev server — using development config URL:', devUrl);
      return devUrl;
    }

    // 3. Check localStorage for saved URL (skip dead ngrok tunnels)
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedUrl = window.localStorage.getItem(this.storageKey);
      if (savedUrl && isStaleSavedUrl(savedUrl)) {
        window.localStorage.removeItem(this.storageKey);
        console.warn('🔧 Removed stale ngrok API URL from localStorage:', savedUrl);
      } else if (savedUrl) {
        console.log('🔧 Using saved URL:', savedUrl);
        return savedUrl;
      }
    }

    // 4. Check window.__ENV__ for web environment
    if (typeof window !== 'undefined' && window.__ENV__?.API_BASE_URL) {
      const envUrl = window.__ENV__.API_BASE_URL;
      if (!isStaleSavedUrl(envUrl)) {
        console.log('🔧 Using window.__ENV__ URL:', envUrl);
        return envUrl;
      }
      console.warn('🔧 Ignoring stale window.__ENV__ API URL:', envUrl);
    }

    // 5. Auto-detect environment and use appropriate URL
    if (typeof window !== 'undefined') {
      const isLocalhost = isLocalhostHost(window.location.hostname);
      
      // Check if this is a production build (has been built for deployment)
      const scriptTags = document.querySelectorAll('script[src*="_expo"]');
      const isProductionBuild = scriptTags.length > 0 && 
                               Array.from(scriptTags).some(script => 
                                 script.src.includes('_expo/static/js/web/')
                               );
      
      if (DEVELOPMENT_CONFIG.DEV_MODE && isLocalhost) {
        console.log('🔧 Development mode detected, using configured URL:', this.defaultUrl);
        return this.defaultUrl;
      }
      
      if (expoDev) {
        console.log('🔧 Expo development server detected, using configured URL:', this.defaultUrl);
        return this.defaultUrl;
      } else if (isLocalhost && !isProductionBuild) {
        console.log('🔧 Local development detected, using configured URL:', this.defaultUrl);
        return this.defaultUrl;
      } else if (isLocalhost && isProductionBuild) {
        console.log('🔧 Local testing of production build detected, using relative URL:', this.fallbackUrl);
        return this.fallbackUrl;
      } else {
        console.log('🔧 Production environment detected, using relative URL:', this.fallbackUrl);
        return this.fallbackUrl;
      }
    }

    // 6. Use default URL as final fallback
    console.log('🔧 Using default URL:', this.defaultUrl);
    return this.defaultUrl;
  }

  // Set a temporary override URL (for testing)
  setOverrideUrl(url) {
    this.overrideUrl = url;
    console.log('🔧 Override URL set to:', url);
  }

  // Clear override URL
  clearOverrideUrl() {
    this.overrideUrl = null;
    console.log('🔧 Override URL cleared');
  }

  // Save URL to localStorage
  saveUrl(url) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.storageKey, url);
      console.log('🔧 URL saved to localStorage:', url);
    }
  }

  // Get all available URLs for debugging
  getAllUrls() {
    return {
      override: this.overrideUrl,
      localStorage: typeof window !== 'undefined' ? window.localStorage?.getItem(this.storageKey) : null,
      windowEnv: typeof window !== 'undefined' ? window.__ENV__?.API_BASE_URL : null,
      default: this.defaultUrl,
      current: this.getApiUrl()
    };
  }

  // Test URL connectivity
  async testUrl(url) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log('❌ URL test failed for:', url, error.message);
      return false;
    }
  }

  // Auto-detect working URL from a list
  async autoDetectUrl(urls) {
    console.log('🔍 Auto-detecting working URL from:', urls);
    
    for (const url of urls) {
      console.log('🔍 Testing URL:', url);
      const isWorking = await this.testUrl(url);
      if (isWorking) {
        console.log('✅ Found working URL:', url);
        this.saveUrl(url);
        return url;
      }
    }
    
    console.log('❌ No working URLs found, using default');
    return this.defaultUrl;
  }

  // Auto-detect working URL with HTTPS/HTTP fallback
  async autoDetectWithFallback() {
    console.log('🔍 Auto-detecting URL with HTTPS/HTTP fallback...');
    
    // Try HTTPS first
    console.log('🔍 Testing HTTPS URL:', this.defaultUrl);
    const httpsWorking = await this.testUrl(this.defaultUrl);
    if (httpsWorking) {
      console.log('✅ HTTPS URL working:', this.defaultUrl);
      this.saveUrl(this.defaultUrl);
      return this.defaultUrl;
    }
    
    // Fallback to HTTP
    console.log('🔍 HTTPS failed, testing HTTP fallback:', this.fallbackUrl);
    const httpWorking = await this.testUrl(this.fallbackUrl);
    if (httpWorking) {
      console.log('✅ HTTP fallback working:', this.fallbackUrl);
      this.saveUrl(this.fallbackUrl);
      return this.fallbackUrl;
    }
    
    console.log('❌ Both HTTPS and HTTP failed, using default');
    return this.defaultUrl;
  }
}

// Create global URL manager instance
export const urlManager = new URLManager();

export const CONFIG = {
  // API Configuration - now uses dynamic URL manager
  get API_BASE_URL() {
    return urlManager.getApiUrl();
  },
  
  // Test users
  TEST_USERS: [
    {
      username: 'andrew.hughes',
      password: 'password123',
      name: 'Andrew Hughes'
    },
    {
      username: 'admin',
      password: 'admin123',
      name: 'System Administrator'
    },
    {
      username: 'ion.zacon',
      password: 'password123',
      name: 'Ion Zacon'
    }
  ],
  
  // Debug settings
  DEBUG: {
    LOG_API_CALLS: true,
    LOG_STORAGE_OPERATIONS: true,
    LOG_AUTH_FLOW: true
  },

  // URL management
  URL_MANAGER: urlManager
};

// Convenience functions for easy URL management
export const updateApiUrl = (newUrl) => {
  urlManager.saveUrl(newUrl);
  console.log('🔧 Updated API URL to:', newUrl);
  return newUrl;
};

export const setOverrideUrl = (url) => {
  urlManager.setOverrideUrl(url);
  return url;
};

export const clearOverrideUrl = () => {
  urlManager.clearOverrideUrl();
};

export const getApiUrl = () => {
  return urlManager.getApiUrl();
};

export const testApiUrl = (url) => {
  return urlManager.testUrl(url);
};

export const autoDetectUrl = (urls) => {
  return urlManager.autoDetectUrl(urls);
};

export const autoDetectWithFallback = () => {
  return urlManager.autoDetectWithFallback();
};

export const getAllUrls = () => {
  return urlManager.getAllUrls();
};

// Development helper - add to window for easy access in browser console
if (typeof window !== 'undefined') {
  // Import development config functions
  import('../config/development.js').then(({ switchBackendUrl, listAvailableUrls, addCustomUrl, getCurrentBackendUrl }) => {
    window.CreativSolarConfig = {
      updateApiUrl,
      setOverrideUrl,
      clearOverrideUrl,
      getApiUrl,
      testApiUrl,
      autoDetectUrl,
      autoDetectWithFallback,
      getAllUrls,
      urlManager,
      // Development URL switching functions
      switchBackendUrl,
      listAvailableUrls,
      addCustomUrl,
      getCurrentBackendUrl
    };
    
    console.log('🔧 CreativSolarConfig available in browser console');
    console.log('🔧 URL Switching Commands:');
    console.log('  - CreativSolarConfig.switchBackendUrl("PRODUCTION") // Use production backend');
    console.log('  - CreativSolarConfig.switchBackendUrl("LOCAL") // Use local backend');
    console.log('  - CreativSolarConfig.switchBackendUrl("RELATIVE") // Use relative path');
    console.log('  - CreativSolarConfig.listAvailableUrls() // List all available URLs');
    console.log('  - CreativSolarConfig.addCustomUrl("NAME", "URL") // Add custom URL');
    console.log('🔧 Other Commands:');
    console.log('  - CreativSolarConfig.setOverrideUrl("/api/")');
    console.log('  - CreativSolarConfig.updateApiUrl("/api/")');
    console.log('  - CreativSolarConfig.autoDetectWithFallback() // Auto-detect working URL');
    console.log('  - CreativSolarConfig.getAllUrls()');
    console.log('  - CreativSolarConfig.testApiUrl("/api/")');
  });
}
