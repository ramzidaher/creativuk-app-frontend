// Utility functions for handling routing in production
import { Platform } from 'react-native';

export const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // In production, use the actual domain
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return 'https://app.creativuk.co.uk';
    }
    return 'http://localhost:8081';
  }
  return 'https://app.creativuk.co.uk';
};

export const getApiUrl = (endpoint: string) => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Helper to navigate with proper URL handling
export const navigateWithUrl = (navigation: any, screen: string, params?: any) => {
  if (Platform.OS === 'web') {
    // For web, use the screen name directly - React Navigation will handle URL mapping
    navigation.navigate(screen, params);
  } else {
    // For mobile, use normal navigation
    navigation.navigate(screen, params);
  }
};
