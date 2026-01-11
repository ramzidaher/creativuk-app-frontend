import { API_BASE_URL } from './env';

export const testApiConnection = async () => {
  console.log('🌐 Testing API connection...');
  console.log('🌐 API_BASE_URL:', API_BASE_URL);
  
  try {
    const response = await fetch(`${API_BASE_URL}health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    console.log('🌐 Health check response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API health check successful:', data);
      return true;
    } else {
      console.log('❌ API health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ API connection error:', error);
    return false;
  }
};
