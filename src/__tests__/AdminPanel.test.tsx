import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import { useAdminPermissions } from '../hooks/useAdminPermissions';

// Mock the API
jest.mock('../utils/api', () => ({
  api: {
    getUsers: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    resetUserPassword: jest.fn(),
    getGHLStatus: jest.fn(),
    syncGHLUsers: jest.fn(),
    assignGHLUser: jest.fn(),
  },
  systemSettingsApi: {
    getSystemSettings: jest.fn(),
    updateSystemSetting: jest.fn(),
  },
  adminAnalyticsApi: {
    getSystemAnalytics: jest.fn(),
    getSystemLogs: jest.fn(),
    getUserActivitySummary: jest.fn(),
    getSystemPerformanceMetrics: jest.fn(),
  },
}));

// Mock the navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

// Mock the useNavigation hook
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

// Mock the useAdminPermissions hook
jest.mock('../hooks/useAdminPermissions', () => ({
  useAdminPermissions: jest.fn(),
}));

const mockUser = {
  id: '1',
  username: 'admin',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  isEmailVerified: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockPermissions = {
  canManageUsers: true,
  canManageGHL: true,
  canAccessAnalytics: true,
  canViewSystemLogs: true,
  canManageSettings: true,
  canViewWinLoss: true,
  canCreateUsers: true,
  canEditUsers: true,
  canDeleteUsers: true,
  canResetPasswords: true,
  canSuspendUsers: true,
  canActivateUsers: true,
  isAdmin: true,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <ThemeProvider>
          {component}
        </ThemeProvider>
      </AuthProvider>
    </NavigationContainer>
  );
};

describe('AdminPanelScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAdminPermissions as jest.Mock).mockReturnValue(mockPermissions);
  });

  it('renders admin panel for admin users', async () => {
    renderWithProviders(<AdminPanelScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });
  });

  it('shows all admin tabs for admin users', async () => {
    renderWithProviders(<AdminPanelScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Users')).toBeTruthy();
      expect(screen.getByText('GHL Management')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
      expect(screen.getByText('Win/Loss')).toBeTruthy();
      expect(screen.getByText('Analytics')).toBeTruthy();
      expect(screen.getByText('Logs')).toBeTruthy();
    });
  });

  it('shows create user button for admin users', async () => {
    renderWithProviders(<AdminPanelScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeTruthy();
    });
  });

  it('switches between tabs correctly', async () => {
    renderWithProviders(<AdminPanelScreen />);
    
    await waitFor(() => {
      const analyticsTab = screen.getByText('Analytics');
      fireEvent.press(analyticsTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('System Overview')).toBeTruthy();
    });
  });

  it('shows access denied for non-admin users', async () => {
    (useAdminPermissions as jest.Mock).mockReturnValue({
      ...mockPermissions,
      isAdmin: false,
    });

    renderWithProviders(<AdminPanelScreen />);
    
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeTruthy();
    });
  });
});

describe('useAdminPermissions', () => {
  it('returns correct permissions for admin users', () => {
    const permissions = useAdminPermissions();
    
    expect(permissions.isAdmin).toBe(true);
    expect(permissions.canManageUsers).toBe(true);
    expect(permissions.canAccessAnalytics).toBe(true);
    expect(permissions.canViewSystemLogs).toBe(true);
  });
});


