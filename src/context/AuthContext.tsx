import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { authApi, tokenExpirationEvents } from '../utils/api';
import { testStorage, testLocalStorage, testCurrentStorage } from '../utils/test-storage';
import { testApiConnection } from '../utils/test-api';

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SURVEYOR';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  ghlUserId?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'SURVEYOR';
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordConfirm: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      if (response.success && response.data) {
        setUser(response.data.user);
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  };

  const register = async (userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'SURVEYOR';
  }) => {
    try {
      const response = await authApi.register(userData);
      if (response.success && response.data) {
        setUser(response.data.user);
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    }
  };

  const logout = async () => {
    console.log('AuthContext: Logging out user');
    await authApi.logout();
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Password change failed' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const response = await authApi.resetPassword(email);
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Password reset failed' };
    }
  };

  const resetPasswordConfirm = async (token: string, newPassword: string) => {
    try {
      const response = await authApi.resetPasswordConfirm(token, newPassword);
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Password reset confirmation failed' };
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // If profile fetch fails, user might be logged out
        console.log('AuthContext: Profile fetch failed, clearing user');
        setUser(null);
      }
    } catch (error) {
      console.error('AuthContext: Failed to refresh user:', error);
      // If it's an authentication error, clear the user
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        console.log('AuthContext: Authentication failed, clearing user');
        setUser(null);
      } else {
        setUser(null);
      }
    }
  };

  // Handle token expiration
  useEffect(() => {
    const handleTokenExpiration = async () => {
      console.log('AuthContext: Token expired, logging out user');
      
      // Clear user state immediately - this will trigger navigation to login screen
      setUser(null);
      
      // Perform additional cleanup
      try {
        await authApi.logout();
      } catch (error) {
        console.log('AuthContext: Error during logout cleanup:', error);
      }
    };

    // Add listener for token expiration
    tokenExpirationEvents.addListener(handleTokenExpiration);

    // Cleanup listener on unmount
    return () => {
      tokenExpirationEvents.removeListener(handleTokenExpiration);
    };
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Initializing authentication...');
        
        // Skip extensive testing for faster initialization
        // Only check if user is already authenticated
        const isAuth = await authApi.isAuthenticated();
        console.log('AuthContext: Is authenticated:', isAuth);
        if (isAuth) {
          const storedUser = await authApi.getUser();
          console.log('AuthContext: Stored user:', storedUser ? 'found' : 'not found');
          if (storedUser) {
            setUser(storedUser);
          } else {
            // Try to refresh user data from server (with timeout)
            console.log('AuthContext: Refreshing user from server...');
            try {
              await Promise.race([
                refreshUser(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ]);
            } catch (error) {
              console.log('AuthContext: User refresh failed or timed out:', error);
              // Continue without user data
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        console.log('AuthContext: Initialization complete, setting loading to false');
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    changePassword,
    resetPassword,
    resetPasswordConfirm,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
