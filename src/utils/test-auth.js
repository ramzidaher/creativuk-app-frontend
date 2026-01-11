import { authApi } from './api';

export const testAuth = async () => {
  console.log('🧪 Testing authentication flow...');
  
  try {
    // Test with a known user
    const testUser = {
      username: 'andrew.hughes',
      password: 'password123'
    };
    
    console.log('🧪 Attempting login with:', testUser.username);
    
    const result = await authApi.login(testUser.username, testUser.password);
    
    if (result.success) {
      console.log('✅ Login successful!');
      console.log('✅ User data:', result.data?.user?.username);
      
      // Test if we can retrieve the stored token
      const isAuth = await authApi.isAuthenticated();
      console.log('✅ Authentication check after login:', isAuth);
      
      return true;
    } else {
      console.log('❌ Login failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Auth test error:', error);
    return false;
  }
};
