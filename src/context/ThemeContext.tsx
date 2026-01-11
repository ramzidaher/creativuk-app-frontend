import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  // Background colors
  primaryBackground: string;
  secondaryBackground: string;
  tertiaryBackground: string;
  
  // Text colors
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  
  // Card colors
  cardBackground: string;
  cardBorder: string;
  
  // Input colors
  inputBackground: string;
  
  // Button colors
  primaryButton: string;
  secondaryButton: string;
  dangerButton: string;
  successButton: string;
  warningButton: string;
  
  // Status colors
  activeStatus: string;
  inactiveStatus: string;
  suspendedStatus: string;
  
  // Progress colors
  progressBackground: string;
  progressFill: string;
  
  // Shadow colors
  shadowColor: string;
  
  // Border colors
  borderColor: string;
  dividerColor: string;
}

const lightTheme: ThemeColors = {
  primaryBackground: '#f8f9fa',
  secondaryBackground: '#ffffff',
  tertiaryBackground: '#e9ecef',
  
  primaryText: '#212529',
  secondaryText: '#495057',
  tertiaryText: '#6c757d',
  
  cardBackground: '#ffffff',
  cardBorder: '#e9ecef',
  
  inputBackground: '#ffffff',
  
  primaryButton: '#10b981',
  secondaryButton: '#059669',
  dangerButton: '#dc3545',
  successButton: '#28a745',
  warningButton: '#f59e0b',
  
  activeStatus: '#51cf66',
  inactiveStatus: '#ff922b',
  suspendedStatus: '#dc3545',
  
  progressBackground: '#e9ecef',
  progressFill: '#51cf66',
  
  shadowColor: '#000000',
  
  borderColor: '#dee2e6',
  dividerColor: '#e9ecef',
};

const darkTheme: ThemeColors = {
  primaryBackground: '#121212',
  secondaryBackground: '#1e1e1e',
  tertiaryBackground: '#2d2d2d',
  
  primaryText: '#ffffff',
  secondaryText: '#e0e0e0',
  tertiaryText: '#b0b0b0',
  
  cardBackground: '#2d2d2d',
  cardBorder: '#404040',
  
  inputBackground: '#2d2d2d',
  
  primaryButton: '#059669',
  secondaryButton: '#047857',
  dangerButton: '#FF453A',
  successButton: '#30D158',
  warningButton: '#FF9F0A',
  
  activeStatus: '#30D158',
  inactiveStatus: '#FF9F0A',
  suspendedStatus: '#FF453A',
  
  progressBackground: '#404040',
  progressFill: '#30D158',
  
  shadowColor: '#000000',
  
  borderColor: '#404040',
  dividerColor: '#2d2d2d',
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  
  const isDark = themeMode === 'system' 
    ? systemColorScheme === 'dark'
    : themeMode === 'dark';
  
  const theme = isDark ? darkTheme : lightTheme;
  
  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };
  
  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
  };
  
  return (
    <ThemeContext.Provider value={{
      theme,
      themeMode,
      isDark,
      toggleTheme,
      setThemeMode: handleSetThemeMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}; 