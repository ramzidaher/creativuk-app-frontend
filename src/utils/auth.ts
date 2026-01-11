import { User } from '../types';

// Use localStorage instead of AsyncStorage for web compatibility
const getStorage = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
};

export const auth = {
  async setToken(token: string): Promise<void> {
    console.log('auth.setToken: Storing token');
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem('token', token);
        console.log('auth.setToken: Token stored in localStorage');
        
        // Verify the token was stored correctly
        const storedToken = storage.getItem('token');
        if (storedToken === token) {
          console.log('auth.setToken: Token verification successful');
        } else {
          console.error('auth.setToken: Token verification failed');
          throw new Error('Token storage verification failed');
        }
      } catch (error) {
        console.error('auth.setToken: Failed to store token:', error);
        throw error;
      }
    } else {
      console.log('auth.setToken: No storage available');
      throw new Error('No storage available');
    }
  },

  async getToken(): Promise<string | null> {
    console.log('auth.getToken: Retrieving token');
    const storage = getStorage();
    if (storage) {
      try {
        const token = storage.getItem('token');
        console.log('auth.getToken: Token from localStorage:', token ? 'present' : 'missing');
        return token;
      } catch (error) {
        console.error('auth.getToken: Error retrieving token:', error);
        return null;
      }
    }
    console.log('auth.getToken: No storage available');
    return null;
  },

  async removeToken(): Promise<void> {
    console.log('auth.removeToken: Removing token');
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem('token');
        console.log('auth.removeToken: Token removed from localStorage');
      } catch (error) {
        console.error('auth.removeToken: Error removing token:', error);
        throw error;
      }
    } else {
      console.log('auth.removeToken: No storage available');
    }
  },

  async clearAllTokens(): Promise<void> {
    console.log('auth.clearAllTokens: Clearing all tokens');
    const storage = getStorage();
    if (storage) {
      try {
        storage.clear();
        console.log('auth.clearAllTokens: All tokens cleared from localStorage');
      } catch (error) {
        console.error('auth.clearAllTokens: Error clearing tokens:', error);
        throw error;
      }
    } else {
      console.log('auth.clearAllTokens: No storage available');
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token && this.isTokenValid(token);
  },

  isTokenValid(token: string): boolean {
    try {
      console.log('auth.isTokenValid: Validating token');
      
      if (!token || typeof token !== 'string') {
        console.log('auth.isTokenValid: Invalid token format');
        return false;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('auth.isTokenValid: Invalid JWT format');
        return false;
      }

      const payload = parts[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      
      console.log('auth.isTokenValid: Token payload:', decoded);
      
      // Check if token is expired (if exp field exists)
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        console.log('auth.isTokenValid: Token expired');
        return false;
      }
      
      // For tokens without expiration, check if they're not too old (24 hours from issuance)
      if (!decoded.exp && decoded.iat) {
        const tokenAge = currentTime - decoded.iat;
        const maxAge = 24 * 60 * 60; // 24 hours in seconds
        if (tokenAge > maxAge) {
          console.log('auth.isTokenValid: Token too old (no expiration)');
          return false;
        }
      }
      
      // If no iat field, consider token valid (backend might not set it)
      if (!decoded.iat) {
        console.log('auth.isTokenValid: No iat field, considering token valid');
        return true;
      }
      
      // For tokens with iat, check if they're not too old (24 hours from issuance)
      const tokenAge = currentTime - decoded.iat;
      const maxAge = 24 * 60 * 60; // 24 hours in seconds
      if (tokenAge > maxAge) {
        console.log('auth.isTokenValid: Token too old');
        return false;
      }
      
      console.log('auth.isTokenValid: Token is valid');
      return true;
    } catch (error) {
      console.log('auth.isTokenValid: Token validation failed:', error);
      return false;
    }
  },

  getUserFromToken(token: string): User {
    try {
      console.log('auth.getUserFromToken: Extracting user from token');
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      console.log('auth.getUserFromToken: User data:', decoded);
      return decoded;
    } catch (error) {
      console.log('auth.getUserFromToken: Failed to extract user:', error);
      return {};
    }
  },

  decodeJwt(token: string): User {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return decoded;
    } catch {
      return {};
    }
  },

  async getCurrentUser(): Promise<User> {
    const token = await this.getToken();
    if (token && this.isTokenValid(token)) {
      return this.decodeJwt(token);
    }
    return {};
  },

  // Debug function to test token storage
  async debugTokenStorage(): Promise<void> {
    console.log('auth.debugTokenStorage: Testing token storage');
    const testToken = 'test.token.here';
    
    try {
      await this.setToken(testToken);
      const retrievedToken = await this.getToken();
      console.log('auth.debugTokenStorage: Test token retrieved:', retrievedToken === testToken ? 'SUCCESS' : 'FAILED');
      
      if (retrievedToken === testToken) {
        await this.removeToken();
        console.log('auth.debugTokenStorage: Test token removed successfully');
      }
    } catch (error) {
      console.error('auth.debugTokenStorage: Test failed:', error);
    }
  },
}; 