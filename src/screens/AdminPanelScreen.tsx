import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import AdminWinLossDashboard from '../components/AdminWinLossDashboard';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { api, systemSettingsApi } from '../utils/api';
// Define types locally since they might not be exported from types
enum UserRole {
  ADMIN = 'ADMIN',
  SURVEYOR = 'SURVEYOR',
}

enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

const { width } = Dimensions.get('window');

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  ghlUserId?: string | null;
  surveyorAreas?: string[];
  surveyorLocation?: string;
  maxTravelTime?: number;
  ghlAssignment?: {
    success: boolean;
    ghlUserId?: string | null;
    ghlUserName?: string;
    message: string;
    requiresManualAssignment?: boolean;
  };
}

interface GHLUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

interface GHLStatus {
  total: number;
  withGhlId: number;
  withoutGhlId: number;
  users: Array<{
    id: string;
    username: string;
    name: string;
    ghlUserId: string | null;
    role: string;
    hasGhlId: boolean;
  }>;
}

interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

const AdminPanelScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const permissions = useAdminPermissions();
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  
  // Modal states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showGHLModal, setShowGHLModal] = useState(false);
  const [showGHLStatusModal, setShowGHLStatusModal] = useState(false);
  const [showManualAssignmentModal, setShowManualAssignmentModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'SURVEYOR' as UserRole,
    surveyorAreas: [] as string[],
    surveyorLocation: '',
    maxTravelTime: undefined as number | undefined,
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // GHL management state
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  const [ghlStatus, setGhlStatus] = useState<GHLStatus | null>(null);
  const [selectedUserForGHL, setSelectedUserForGHL] = useState<User | null>(null);
  const [manualAssignmentData, setManualAssignmentData] = useState({
    ghlUserId: '',
    ghlUserName: '',
  });
  const [isLoadingGHL, setIsLoadingGHL] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'ghl' | 'settings' | 'winloss'>('users');
  
  // System settings state
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [stepNavigationEnabled, setStepNavigationEnabled] = useState(true);

  // User data viewing state - removed individual user data viewing

  // Check if user is admin
  if (!permissions.isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
          <View style={styles.headerRight} />
        </View>
        <AdminGuard showAlert={false}>
          <View />
        </AdminGuard>
      </SafeAreaView>
    );
  }

  const fetchUsers = async (page = 1, search = '', role = '', status = '') => {
    try {
      setLoading(true);
      
      // Use the same endpoint as GHL Management tab for accurate GHL data
      const response = await api.get('/user/ghl-status');
      
      if (response.success && response.data) {
        const ghlStatus = response.data as GHLStatus;
        
        // Convert GHL status users to User format for the Users tab
        let usersFromGHL = ghlStatus.users.map(ghlUser => ({
          id: ghlUser.id,
          username: ghlUser.username,
          email: '', // GHL status doesn't include email, we'll need to get it separately
          name: ghlUser.name,
          role: ghlUser.role as UserRole,
          status: 'ACTIVE' as UserStatus, // Default status since GHL status doesn't include this
          isEmailVerified: true, // Default value
          createdAt: new Date().toISOString(), // Default value
          updatedAt: new Date().toISOString(), // Default value
          lastLoginAt: undefined,
          ghlUserId: ghlUser.ghlUserId, // Keep original GHL ID
          ghlAssignment: ghlUser.hasGhlId ? {
            success: true,
            ghlUserId: ghlUser.ghlUserId,
            message: 'GHL ID assigned'
          } : undefined
        }));
        
        // Apply search and filter logic
        if (search) {
          usersFromGHL = usersFromGHL.filter(user => 
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.username.toLowerCase().includes(search.toLowerCase())
          );
        }
        
        if (role) {
          usersFromGHL = usersFromGHL.filter(user => user.role === role);
        }
        
        // Apply pagination
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = usersFromGHL.slice(startIndex, endIndex);
        
        setUsers(paginatedUsers);
        setTotalPages(Math.ceil(usersFromGHL.length / limit));
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers(1, searchTerm, selectedRole, selectedStatus);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUsers(1, '', '', '');
    // Also fetch GHL status on mount to ensure we have latest data
    fetchGHLStatus();
    
    // Test API connectivity
    console.log('Admin Panel loaded, testing API connectivity...');
    console.log('Current user:', user);
  }, []);

  const handleSearch = () => {
    fetchUsers(1, searchTerm, selectedRole, selectedStatus);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchUsers(page, searchTerm, selectedRole, selectedStatus);
    }
  };

  const handleEditUser = async (updatedUser: Partial<User>) => {
    if (!editingUser) return;

    try {
      // Prepare update data - editingUser is already updated by the form inputs
      const updateData: Partial<User> = {
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        surveyorAreas: updatedUser.surveyorAreas && updatedUser.surveyorAreas.length > 0 ? updatedUser.surveyorAreas : undefined,
        surveyorLocation: updatedUser.surveyorLocation && updatedUser.surveyorLocation.trim() ? updatedUser.surveyorLocation.trim() : undefined,
        maxTravelTime: updatedUser.maxTravelTime || undefined,
      };
      
      console.log(`Attempting to update user ${editingUser.id}:`, updateData);
      const response = await api.put<User>(`/auth/admin/users/${editingUser.id}`, updateData);
      
      console.log('Update user response:', response);
      
      if (response.success) {
        Alert.alert('Success', 'User updated successfully');
        setShowEditModal(false);
        setEditingUser(null);
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
      } else {
        console.error('Failed to update user:', response);
        Alert.alert('Error', `Failed to update user: ${(response as any).error || (response as any).message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      Alert.alert('Error', `Failed to update user: ${error.message || 'Network error'}`);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser || !newPassword) return;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match. Please try again.');
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      console.log(`Attempting to reset password for user ${editingUser.id}`);
      const response = await api.post(`/auth/admin/users/${editingUser.id}/reset-password`, {
        newPassword,
      });
      
      console.log('Reset password response:', response);
      
      if (response.success) {
        Alert.alert('Success', 'Password reset successfully');
        setShowPasswordModal(false);
        setEditingUser(null);
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        console.error('Failed to reset password:', response);
        Alert.alert('Error', `Failed to reset password: ${(response as any).error || (response as any).message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', `Failed to reset password: ${error.message || 'Network error'}`);
    }
  };

  const handleStatusChange = async (userId: string, action: 'activate' | 'deactivate' | 'suspend') => {
    const user = users.find(u => u.id === userId);
    const userName = user?.name || user?.username || 'this user';
    
    const actionText = action === 'activate' ? 'activate' : action === 'deactivate' ? 'deactivate' : 'suspend';
    const actionPast = action === 'activate' ? 'activated' : action === 'deactivate' ? 'deactivated' : 'suspended';
    
    Alert.alert(
      `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      `Are you sure you want to ${actionText} ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              console.log(`Attempting to ${action} user ${userId}`);
              const response = await api.post(`/auth/admin/users/${userId}/${action}`, {});
              
              console.log(`Response for ${action}:`, response);
              
              if (response.success) {
                Alert.alert('Success', `${userName} has been ${actionPast} successfully`);
                fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
              } else {
                console.error(`Failed to ${action} user:`, response);
                Alert.alert('Error', `Failed to ${actionText} user: ${(response as any).error || (response as any).message || 'Unknown error'}`);
              }
            } catch (error: any) {
              console.error(`Error ${action}ing user:`, error);
              Alert.alert('Error', `Failed to ${actionText} user: ${error.message || 'Network error'}`);
            }
          }
        }
      ]
    );
  };

  const handleDeleteUser = async (userId: string) => {
    console.log('Delete button clicked for user:', userId);
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserToDelete(user);
      setShowDeleteConfirmModal(true);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      console.log(`Attempting to delete user ${userToDelete.id}`);
      const response = await api.delete(`/auth/users/${userToDelete.id}`);
      
      console.log('Delete response:', response);
      
      if (response.success) {
        Alert.alert('Success', 'User deleted successfully');
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
      } else {
        console.error('Failed to delete user:', response);
        Alert.alert('Error', `Failed to delete user: ${(response as any).error || (response as any).message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      Alert.alert('Error', `Failed to delete user: ${error.message || 'Network error'}`);
    } finally {
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    }
  };

  // Secure user creation with validation
  const validateCreateUserData = () => {
    const { username, email, password, confirmPassword, name, role } = createUserData;
    
    // Required fields
    if (!username.trim() || !email.trim() || !password || !name.trim()) {
      Alert.alert('Validation Error', 'All fields are required');
      return false;
    }

    // Username validation
    if (username.length < 3 || username.length > 50) {
      Alert.alert('Validation Error', 'Username must be between 3 and 50 characters');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    // Password validation
    if (password.length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return false;
    }

    // Name validation
    if (name.length < 2 || name.length > 100) {
      Alert.alert('Validation Error', 'Name must be between 2 and 100 characters');
      return false;
    }

    return true;
  };

  const handleCreateUser = async () => {
    if (!validateCreateUserData()) {
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await api.post('/auth/users', {
        username: createUserData.username.trim(),
        email: createUserData.email.trim(),
        password: createUserData.password,
        name: createUserData.name.trim(),
        role: createUserData.role,
        surveyorAreas: createUserData.surveyorAreas.length > 0 ? createUserData.surveyorAreas : undefined,
        surveyorLocation: createUserData.surveyorLocation.trim() || undefined,
        maxTravelTime: createUserData.maxTravelTime || undefined,
      });

      if (response.success) {
        const userData = response.data as any;
        let alertMessage = 'User created successfully';
        
        // Check if GHL assignment was successful
        if (userData.ghlAssignment) {
          if (userData.ghlAssignment.success) {
            alertMessage += `\n\n✅ GHL User ID automatically assigned: ${userData.ghlAssignment.ghlUserName} (${userData.ghlAssignment.ghlUserId})`;
          } else {
            alertMessage += `\n\n⚠️ GHL User ID could not be automatically assigned: ${userData.ghlAssignment.message}`;
            if (userData.ghlAssignment.requiresManualAssignment) {
              alertMessage += '\n\nYou can manually assign it later using the GHL Management section.';
            }
          }
        }
        
        Alert.alert('Success', alertMessage);
        setShowCreateUserModal(false);
        setCreateUserData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          name: '',
          role: UserRole.SURVEYOR,
          surveyorAreas: [],
          surveyorLocation: '',
          maxTravelTime: undefined,
        });
        // Refresh users using the same data source
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
        fetchGHLStatus();
      } else {
        Alert.alert('Error', response.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      Alert.alert('Error', 'Failed to create user. Please try again.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // GHL Management Functions
  const fetchGHLUsers = async () => {
    try {
      setIsLoadingGHL(true);
      const response = await api.get('/user/ghl-users');
      
      if (response.success && response.data) {
        setGhlUsers((response.data as any).users || []);
      } else {
        Alert.alert('Error', 'Failed to fetch GHL users');
      }
    } catch (error) {
      console.error('Error fetching GHL users:', error);
      Alert.alert('Error', 'Failed to fetch GHL users');
    } finally {
      setIsLoadingGHL(false);
    }
  };

  const fetchGHLStatus = async () => {
    try {
      setIsLoadingGHL(true);
      const response = await api.get('/user/ghl-status');
      
      if (response.success && response.data) {
        setGhlStatus(response.data as GHLStatus);
      } else {
        Alert.alert('Error', 'Failed to fetch GHL status');
      }
    } catch (error) {
      console.error('Error fetching GHL status:', error);
      Alert.alert('Error', 'Failed to fetch GHL status');
    } finally {
      setIsLoadingGHL(false);
    }
  };

  const syncGHLUsers = async () => {
    try {
      setIsLoadingGHL(true);
      const response = await api.get('/user/ghl-sync');
      
      if (response.success) {
        Alert.alert('Success', 'GHL users synced successfully');
        fetchGHLStatus();
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
      } else {
        Alert.alert('Error', response.error || 'Failed to sync GHL users');
      }
    } catch (error) {
      console.error('Error syncing GHL users:', error);
      Alert.alert('Error', 'Failed to sync GHL users');
    } finally {
      setIsLoadingGHL(false);
    }
  };

  const handleManualGHLAssignment = async () => {
    if (!selectedUserForGHL) return;
    
    if (!manualAssignmentData.ghlUserId && !manualAssignmentData.ghlUserName) {
      Alert.alert('Error', 'Please provide either GHL User ID or GHL User Name');
      return;
    }

    try {
      setIsLoadingGHL(true);
      const response = await api.post(`/user/assign-ghl-id-manual/${selectedUserForGHL.id}`, {
        ghlUserId: manualAssignmentData.ghlUserId || undefined,
        ghlUserName: manualAssignmentData.ghlUserName || undefined,
      });

      if (response.success) {
        Alert.alert('Success', (response.data as any).message || 'GHL user ID assigned successfully');
        setShowManualAssignmentModal(false);
        setSelectedUserForGHL(null);
        setManualAssignmentData({ ghlUserId: '', ghlUserName: '' });
        // Refresh users using the same data source
        fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
        fetchGHLStatus();
      } else {
        Alert.alert('Error', response.error || 'Failed to assign GHL user ID');
      }
    } catch (error) {
      console.error('Error assigning GHL user ID:', error);
      Alert.alert('Error', 'Failed to assign GHL user ID');
    } finally {
      setIsLoadingGHL(false);
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'ACTIVE':
        return '#4CAF50';
      case 'INACTIVE':
        return '#FF9800';
      case 'SUSPENDED':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return '#E91E63';
      case 'SURVEYOR':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  // System Settings Functions
  const fetchSystemSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const response = await systemSettingsApi.getAllSettings();
      
      if (response.success && response.data) {
        setSystemSettings(response.data);
        
        // Find and set the step navigation setting
        const stepNavSetting = response.data.find((setting: any) => setting.key === 'step_navigation_enabled');
        if (stepNavSetting) {
          try {
            const value = JSON.parse(stepNavSetting.value);
            setStepNavigationEnabled(value);
          } catch {
            setStepNavigationEnabled(true); // Default to true if parsing fails
          }
        }
      } else {
        Alert.alert('Error', 'Failed to fetch system settings');
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      Alert.alert('Error', 'Failed to fetch system settings');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const updateStepNavigationSetting = async (enabled: boolean) => {
    try {
      console.log('🔧 AdminPanel: Starting step navigation setting update:', enabled);
      setIsLoadingSettings(true);
      
      const response = await systemSettingsApi.upsertSetting(
        'step_navigation_enabled',
        JSON.stringify(enabled),
        'Allow users to navigate to any workflow step regardless of completion status',
        'workflow',
        true
      );
      
      console.log('🔧 AdminPanel: API response:', response);
      
      if (response.success) {
        setStepNavigationEnabled(enabled);
        console.log('🔧 AdminPanel: Setting updated successfully, new value:', enabled);
        Alert.alert('Success', `Step navigation ${enabled ? 'enabled' : 'disabled'} successfully`);
      } else {
        console.error('🔧 AdminPanel: API returned error:', response.error);
        Alert.alert('Error', `Failed to update step navigation setting: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('🔧 AdminPanel: Error updating step navigation setting:', error);
      Alert.alert('Error', `Failed to update step navigation setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🔧 AdminPanel: Setting loading state to false');
      setIsLoadingSettings(false);
    }
  };

  // User Data Functions - removed individual user data viewing

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.borderColor }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.primaryText} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.primaryText }]}>Admin Panel</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>User & GHL Management</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        {permissions.canManageUsers && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'users' && styles.activeTab, { borderColor: theme.primaryButton }]}
            onPress={() => {
              setActiveTab('users');
              // Use the same data source as GHL Management tab
              fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
            }}
          >
            <Feather name="users" size={20} color={activeTab === 'users' ? theme.primaryButton : theme.secondaryText} />
            <Text style={[styles.tabText, { color: activeTab === 'users' ? theme.primaryButton : theme.secondaryText }]}>
              Users
            </Text>
          </TouchableOpacity>
        )}
        
        {permissions.canManageGHL && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ghl' && styles.activeTab, { borderColor: theme.primaryButton }]}
            onPress={() => {
              setActiveTab('ghl');
              // Refresh GHL status when switching to GHL tab
              fetchGHLStatus();
            }}
          >
            <Feather name="link" size={20} color={activeTab === 'ghl' ? theme.primaryButton : theme.secondaryText} />
            <Text style={[styles.tabText, { color: activeTab === 'ghl' ? theme.primaryButton : theme.secondaryText }]}>
              GHL Management
            </Text>
          </TouchableOpacity>
        )}
        
        {permissions.canManageSettings && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.activeTab, { borderColor: theme.primaryButton }]}
            onPress={() => {
              setActiveTab('settings');
              // Fetch system settings when switching to settings tab
              fetchSystemSettings();
            }}
          >
            <Feather name="settings" size={20} color={activeTab === 'settings' ? theme.primaryButton : theme.secondaryText} />
            <Text style={[styles.tabText, { color: activeTab === 'settings' ? theme.primaryButton : theme.secondaryText }]}>
              Settings
            </Text>
          </TouchableOpacity>
        )}
        
        {permissions.canViewWinLoss && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'winloss' && styles.activeTab, { borderColor: theme.primaryButton }]}
            onPress={() => {
              setActiveTab('winloss');
            }}
          >
            <Feather name="trending-up" size={20} color={activeTab === 'winloss' ? theme.primaryButton : theme.secondaryText} />
            <Text style={[styles.tabText, { color: activeTab === 'winloss' ? theme.primaryButton : theme.secondaryText }]}>
              Win/Loss
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {activeTab === 'users' ? (
          <>
            {permissions.canCreateUsers && (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => setShowCreateUserModal(true)}
              >
                <Feather name="user-plus" size={20} color="white" />
                <Text style={styles.primaryActionButtonText}>Create User</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => navigation.navigate('ContactAppointments')}
            >
              <Feather name="calendar" size={20} color="white" />
              <Text style={styles.primaryActionButtonText}>Appointments</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => {
                setShowGHLStatusModal(true);
                fetchGHLStatus();
              }}
            >
              <Feather name="bar-chart-2" size={20} color="white" />
              <Text style={styles.primaryActionButtonText}>GHL Status</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: theme.successButton }]}
              onPress={() => {
                setShowGHLModal(true);
                fetchGHLUsers();
              }}
            >
              <Feather name="users" size={20} color="white" />
              <Text style={styles.primaryActionButtonText}>GHL Users</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: theme.primaryButton }]}
              onPress={async () => {
                await syncGHLUsers();
                // Refresh users using the same data source
                fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
              }}
              disabled={isLoadingGHL}
            >
              <Feather name="refresh-cw" size={20} color="white" />
              <Text style={styles.primaryActionButtonText}>
                {isLoadingGHL ? 'Syncing...' : 'Sync GHL'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: theme.successButton }]}
              onPress={() => {
                fetchGHLStatus();
                // Refresh users using the same data source
                fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
              }}
              disabled={isLoadingGHL}
            >
              <Feather name="refresh-cw" size={20} color="white" />
              <Text style={styles.primaryActionButtonText}>
                {isLoadingGHL ? 'Refreshing...' : 'Refresh Status'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Search and Filters - Only show for Users tab */}
      {activeTab === 'users' && (
        <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.inputBackground, color: theme.primaryText, borderColor: theme.cardBorder }]}
            placeholder="Search users..."
            placeholderTextColor={theme.secondaryText}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
          
          <View style={styles.filterContainer}>
            <TextInput
              style={[styles.filterInput, { backgroundColor: theme.inputBackground, color: theme.primaryText, borderColor: theme.cardBorder }]}
              placeholder="Role (ADMIN/SURVEYOR)"
              placeholderTextColor={theme.secondaryText}
              value={selectedRole}
              onChangeText={setSelectedRole}
            />
            <TextInput
              style={[styles.filterInput, { backgroundColor: theme.inputBackground, color: theme.primaryText, borderColor: theme.cardBorder }]}
              placeholder="Status (ACTIVE/INACTIVE/SUSPENDED)"
              placeholderTextColor={theme.secondaryText}
              value={selectedStatus}
              onChangeText={setSelectedStatus}
            />
          </View>
          
          <TouchableOpacity style={[styles.searchButton, { backgroundColor: theme.primaryButton }]} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
        </View>
      )}

      {/* Content based on active tab */}
      {activeTab === 'users' ? (
        <View style={styles.contentContainer}>
          <ScrollView
            style={[
              styles.userList, 
              { backgroundColor: 'transparent' },
              Platform.OS === 'web' && {
                height: '100%',
                maxHeight: '100%',
              }
            ]}
            contentContainerStyle={[
              { paddingBottom: 100 },
              Platform.OS === 'web' && {
                minHeight: '100vh' as any,
                paddingBottom: 120,
              }
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryButton} />
            }
            showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            bounces={Platform.OS !== 'web'}
            alwaysBounceVertical={Platform.OS !== 'web'}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS !== 'web'}
          >
            <View style={styles.content}>
              {users.map((user) => (
            <View key={user.id} style={[styles.userCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.userCardHeader}>
                <View style={[styles.userAvatar, { backgroundColor: getRoleColor(user.role) + '20' }]}>
                  <Feather name="user" size={24} color={getRoleColor(user.role)} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.primaryText }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: theme.secondaryText }]}>{user.email}</Text>
                  <Text style={[styles.userUsername, { color: theme.tertiaryText }]}>@{user.username}</Text>
                </View>
                <View style={styles.userStatusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(user.status) }]} />
                </View>
              </View>
              
              <View style={styles.userBadges}>
                <View style={[styles.badge, { backgroundColor: getRoleColor(user.role) }]}>
                  <Feather name={user.role === 'ADMIN' ? 'shield' : 'user-check'} size={12} color="white" />
                  <Text style={styles.badgeText}>{user.role}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getStatusColor(user.status) }]}>
                  <Feather name={user.status === 'ACTIVE' ? 'check-circle' : user.status === 'INACTIVE' ? 'pause-circle' : 'x-circle'} size={12} color="white" />
                  <Text style={styles.badgeText}>{user.status}</Text>
                </View>
                {/* GHL Status Badge */}
                <View style={[styles.badge, { backgroundColor: (user.ghlUserId || user.ghlAssignment?.success) ? '#4CAF50' : '#FF9800' }]}>
                  <Feather name={(user.ghlUserId || user.ghlAssignment?.success) ? 'link' : 'link-2'} size={12} color="white" />
                  <Text style={styles.badgeText}>
                    {(user.ghlUserId || user.ghlAssignment?.success) ? `GHL ✓` : 'No GHL'}
                  </Text>
                </View>
              </View>
              
              {(user.ghlUserId || user.ghlAssignment?.success) && (
                <View style={[styles.ghlIdContainer, { backgroundColor: theme.inputBackground }]}>
                  <Feather name="hash" size={14} color={theme.tertiaryText} />
                  <Text style={[styles.ghlIdText, { color: theme.tertiaryText }]}>
                    GHL ID: {user.ghlUserId ? user.ghlUserId.substring(0, 8) + '...' : 'Assigned'}
                  </Text>
                </View>
              )}
              
              <View style={[styles.userFooter, { borderTopColor: theme.cardBorder }]}>
                <View style={styles.userDateContainer}>
                  <Feather name="calendar" size={14} color={theme.tertiaryText} />
                  <Text style={[styles.userDate, { color: theme.tertiaryText }]}>
                    Created: {new Date(user.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {user.lastLoginAt && (
                  <View style={styles.userLastLoginContainer}>
                    <Feather name="clock" size={14} color={theme.tertiaryText} />
                    <Text style={[styles.userLastLogin, { color: theme.tertiaryText }]}>
                      Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => {
                    setEditingUser(user);
                    setShowEditModal(true);
                  }}
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.passwordButton]}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      // On web, Alert.alert may not work properly, so go directly to modal
                      console.log('Setting editingUser and showing password modal for:', user.id);
                      setEditingUser(user);
                      setShowPasswordModal(true);
                      console.log('Password modal should now be visible');
                    } else {
                      // On mobile, use Alert for confirmation
                      Alert.alert(
                        'Reset Password',
                        `Are you sure you want to reset the password for ${user.name || user.username}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Reset',
                            style: 'default',
                            onPress: () => {
                              console.log('Setting editingUser and showing password modal for:', user.id);
                              setEditingUser(user);
                              setShowPasswordModal(true);
                              console.log('Password modal should now be visible');
                            }
                          }
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.actionButtonText}>Reset Password</Text>
                </TouchableOpacity>

                {/* GHL Assignment Button */}
                {!(user.ghlUserId || user.ghlAssignment?.success) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                    onPress={() => {
                      setSelectedUserForGHL(user);
                      setShowManualAssignmentModal(true);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Assign GHL</Text>
                  </TouchableOpacity>
                )}

                {user.status !== 'ACTIVE' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.activateButton]}
                    onPress={() => handleStatusChange(user.id, 'activate')}
                  >
                    <Text style={styles.actionButtonText}>Activate</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => {
                    console.log('Delete button pressed for user:', user.id);
                    handleDeleteUser(user.id);
                  }}
                >
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>

                {/* View Data button removed - now available in Statistics & Analytics */}
              </View>
            </View>
            ))}
            
            {/* Pagination - Only show for Users tab */}
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
                onPress={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </TouchableOpacity>
              
              <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </Text>
              
              <TouchableOpacity
                style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
                onPress={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Text style={styles.pageButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
        </View>
      ) : activeTab === 'ghl' ? (
        /* GHL Management Content */
        <View style={styles.contentContainer}>
          <ScrollView 
            style={[
              styles.userList, 
              { backgroundColor: 'transparent' },
              Platform.OS === 'web' && {
                height: '100%',
                maxHeight: '100%',
              }
            ]}
            contentContainerStyle={[
              { paddingBottom: 100 },
              Platform.OS === 'web' && {
                minHeight: '100vh' as any,
                paddingBottom: 120,
              }
            ]}
            showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            bounces={Platform.OS !== 'web'}
            alwaysBounceVertical={Platform.OS !== 'web'}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS !== 'web'}
          >
            <View style={styles.content}>
              <View style={[styles.ghlOverviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.ghlOverviewTitle, { color: theme.primaryText }]}>GHL Integration Overview</Text>
            <Text style={[styles.ghlOverviewText, { color: theme.secondaryText }]}>
              Manage GoHighLevel user assignments and monitor integration status.
            </Text>
            
            <View style={styles.ghlStatsContainer}>
              <View style={[styles.ghlStatCard, { backgroundColor: theme.primaryButton + '10', borderColor: theme.primaryButton + '30' }]}>
                <Feather name="users" size={24} color={theme.primaryButton} />
                <Text style={[styles.ghlStatNumber, { color: theme.primaryText }]}>
                  {ghlStatus?.total || 0}
                </Text>
                <Text style={[styles.ghlStatLabel, { color: theme.secondaryText }]}>Total Users</Text>
              </View>
              
              <View style={[styles.ghlStatCard, { backgroundColor: theme.successButton + '10', borderColor: theme.successButton + '30' }]}>
                <Feather name="check-circle" size={24} color={theme.successButton} />
                <Text style={[styles.ghlStatNumber, { color: theme.primaryText }]}>
                  {ghlStatus?.withGhlId || 0}
                </Text>
                <Text style={[styles.ghlStatLabel, { color: theme.secondaryText }]}>With GHL ID</Text>
              </View>
              
              <View style={[styles.ghlStatCard, { backgroundColor: theme.dangerButton + '10', borderColor: theme.dangerButton + '30' }]}>
                <Feather name="alert-circle" size={24} color={theme.dangerButton} />
                <Text style={[styles.ghlStatNumber, { color: theme.primaryText }]}>
                  {ghlStatus?.withoutGhlId || 0}
                </Text>
                <Text style={[styles.ghlStatLabel, { color: theme.secondaryText }]}>Missing GHL ID</Text>
              </View>
            </View>
          </View>
          </View>
          
          <View style={[styles.ghlInfoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.ghlInfoTitle, { color: theme.primaryText }]}>GHL Integration Features</Text>
            <View style={styles.ghlFeatureList}>
              <View style={styles.ghlFeatureItem}>
                <Feather name="zap" size={20} color={theme.successButton} />
                <Text style={[styles.ghlFeatureText, { color: theme.secondaryText }]}>
                  Automatic GHL user ID assignment during user creation
                </Text>
              </View>
              <View style={styles.ghlFeatureItem}>
                <Feather name="search" size={20} color={theme.primaryButton} />
                <Text style={[styles.ghlFeatureText, { color: theme.secondaryText }]}>
                  Smart name and email matching with GHL users
                </Text>
              </View>
              <View style={styles.ghlFeatureItem}>
                <Feather name="settings" size={20} color={theme.primaryButton} />
                <Text style={[styles.ghlFeatureText, { color: theme.secondaryText }]}>
                  Manual assignment options when automatic fails
                </Text>
              </View>
              <View style={styles.ghlFeatureItem}>
                <Feather name="refresh-cw" size={20} color={theme.primaryButton} />
                <Text style={[styles.ghlFeatureText, { color: theme.secondaryText }]}>
                  Bulk sync and status monitoring
                </Text>
              </View>
            </View>
          </View>

          {/* GHL Users List */}
          {ghlUsers.length > 0 && (
            <View style={[styles.ghlUsersListCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.ghlUsersListTitle, { color: theme.primaryText }]}>Available GHL Users</Text>
              <Text style={[styles.ghlUsersListSubtitle, { color: theme.secondaryText }]}>
                {ghlUsers.length} users available for assignment
              </Text>
              
              <View style={styles.ghlUsersGrid}>
                {ghlUsers.slice(0, 6).map((ghlUser) => (
                  <View key={ghlUser.id} style={[styles.ghlUserCard, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}>
                    <View style={[styles.ghlUserAvatar, { backgroundColor: theme.primaryButton + '20' }]}>
                      <Feather name="user" size={20} color={theme.primaryButton} />
                    </View>
                    <Text style={[styles.ghlUserCardName, { color: theme.primaryText }]} numberOfLines={1}>
                      {ghlUser.fullName}
                    </Text>
                    <Text style={[styles.ghlUserCardEmail, { color: theme.secondaryText }]} numberOfLines={1}>
                      {ghlUser.email}
                    </Text>
                    <Text style={[styles.ghlUserCardId, { color: theme.tertiaryText }]} numberOfLines={1}>
                      ID: {ghlUser.id.substring(0, 8)}...
                    </Text>
                  </View>
                ))}
              </View>
              
              {ghlUsers.length > 6 && (
                <Text style={[styles.ghlUsersMoreText, { color: theme.secondaryText }]}>
                  And {ghlUsers.length - 6} more users available...
                </Text>
              )}
            </View>
          )}

          {/* GHL Status Details */}
          {ghlStatus && ghlStatus.users && (
            <View style={[styles.ghlStatusDetailsCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.ghlStatusDetailsTitle, { color: theme.primaryText }]}>User GHL Status Details</Text>
              <Text style={[styles.ghlStatusDetailsSubtitle, { color: theme.secondaryText }]}>
                Detailed breakdown of GHL assignments
              </Text>
              
              <View style={styles.ghlStatusDetailsList}>
                {ghlStatus.users.slice(0, 5).map((user) => (
                  <View key={user.id} style={[styles.ghlStatusDetailItem, { borderColor: theme.cardBorder }]}>
                    <View style={styles.ghlStatusDetailInfo}>
                      <Text style={[styles.ghlStatusDetailName, { color: theme.primaryText }]}>{user.name}</Text>
                      <Text style={[styles.ghlStatusDetailRole, { color: theme.secondaryText }]}>
                        @{user.username} • {user.role}
                      </Text>
                    </View>
                    <View style={[
                      styles.ghlStatusDetailBadge, 
                      { backgroundColor: user.hasGhlId ? theme.successButton + '20' : theme.dangerButton + '20' }
                    ]}>
                      <Feather 
                        name={user.hasGhlId ? "check-circle" : "alert-circle"} 
                        size={16} 
                        color={user.hasGhlId ? theme.successButton : theme.dangerButton} 
                      />
                      <Text style={[
                        styles.ghlStatusDetailBadgeText, 
                        { color: user.hasGhlId ? theme.successButton : theme.dangerButton }
                      ]}>
                        {user.hasGhlId ? 'GHL ✓' : 'No GHL'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              
              {ghlStatus.users.length > 5 && (
                <Text style={[styles.ghlStatusMoreText, { color: theme.secondaryText }]}>
                  And {ghlStatus.users.length - 5} more users...
                </Text>
              )}
            </View>
          )}
          </ScrollView>
        </View>
      ) : activeTab === 'settings' ? (
        /* System Settings Content */
        <View style={styles.contentContainer}>
          <ScrollView 
            style={[
              styles.userList, 
              { backgroundColor: 'transparent' },
              Platform.OS === 'web' && {
                height: '100%',
                maxHeight: '100%',
              }
            ]}
            contentContainerStyle={[
              { paddingBottom: 100 },
              Platform.OS === 'web' && {
                minHeight: '100vh' as any,
                paddingBottom: 120,
              }
            ]}
            showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            bounces={Platform.OS !== 'web'}
            alwaysBounceVertical={Platform.OS !== 'web'}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS !== 'web'}
          >
            <View style={styles.content}>
              {/* Settings Overview Card */}
              <View style={[styles.settingsOverviewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.settingsOverviewTitle, { color: theme.primaryText }]}>System Settings</Text>
                <Text style={[styles.settingsOverviewText, { color: theme.secondaryText }]}>
                  Configure system-wide settings and features.
                </Text>
              </View>

              {/* Step Navigation Setting */}
              <View style={[styles.settingCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.primaryText }]}>Step Navigation Control</Text>
                    <Text style={[styles.settingDescription, { color: theme.secondaryText }]}>
                      Control whether users can navigate to any workflow step regardless of completion status
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.settingToggle,
                      {
                        backgroundColor: stepNavigationEnabled ? theme.successButton : theme.dangerButton,
                        opacity: isLoadingSettings ? 0.5 : 1,
                      }
                    ]}
                    onPress={() => updateStepNavigationSetting(!stepNavigationEnabled)}
                    disabled={isLoadingSettings}
                  >
                    <View style={[
                      styles.settingToggleKnob,
                      {
                        backgroundColor: '#ffffff',
                        transform: [{ translateX: stepNavigationEnabled ? 24 : 2 }],
                      }
                    ]} />
                  </TouchableOpacity>
                </View>
                
                <View style={[styles.settingStatus, { backgroundColor: theme.inputBackground }]}>
                  <Feather 
                    name={stepNavigationEnabled ? "check-circle" : "x-circle"} 
                    size={16} 
                    color={stepNavigationEnabled ? theme.successButton : theme.dangerButton} 
                  />
                  <Text style={[styles.settingStatusText, { color: theme.secondaryText }]}>
                    Step navigation is currently {stepNavigationEnabled ? 'enabled' : 'disabled'}
                  </Text>
                </View>
                
                <View style={styles.settingDetails}>
                  <Text style={[styles.settingDetailsTitle, { color: theme.primaryText }]}>What this controls:</Text>
                  <View style={styles.settingDetailsList}>
                    <View style={styles.settingDetailItem}>
                      <Feather name="arrow-right" size={14} color={theme.secondaryText} />
                      <Text style={[styles.settingDetailText, { color: theme.secondaryText }]}>
                        When enabled: Users can navigate to any step regardless of completion
                      </Text>
                    </View>
                    <View style={styles.settingDetailItem}>
                      <Feather name="arrow-right" size={14} color={theme.secondaryText} />
                      <Text style={[styles.settingDetailText, { color: theme.secondaryText }]}>
                        When disabled: Users can only access current step and completed steps
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {isLoadingSettings && (
                <View style={styles.settingsLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primaryButton} />
                  <Text style={[styles.settingsLoadingText, { color: theme.secondaryText }]}>
                    Updating settings...
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      ) : activeTab === 'winloss' ? (
        /* Win/Loss Dashboard Content */
        <View style={styles.contentContainer}>
          <AdminWinLossDashboard 
            onUserSelect={(userId) => {
              // Could navigate to user details or show user-specific stats
              console.log('Selected user:', userId);
            }}
          />
        </View>
      ) : null}

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal && !!editingUser}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modal}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Edit User</Text>
            
            {editingUser && (
              <>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Name"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.name}
                  onChangeText={(text) => setEditingUser({ ...editingUser, name: text })}
                />
                
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Email"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.email}
                  onChangeText={(text) => setEditingUser({ ...editingUser, email: text })}
                />
                
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Username"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.username}
                  onChangeText={(text) => setEditingUser({ ...editingUser, username: text })}
                />
                
                <View style={styles.roleSelector}>
                  <Text style={styles.roleLabel}>Role:</Text>
                  <View style={styles.roleButtons}>
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        editingUser.role === UserRole.SURVEYOR && styles.roleButtonActive
                      ]}
                      onPress={() => setEditingUser({ ...editingUser, role: UserRole.SURVEYOR })}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        editingUser.role === UserRole.SURVEYOR && styles.roleButtonTextActive
                      ]}>Surveyor</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.roleButton,
                        editingUser.role === UserRole.ADMIN && styles.roleButtonActive
                      ]}
                      onPress={() => setEditingUser({ ...editingUser, role: UserRole.ADMIN })}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        editingUser.role === UserRole.ADMIN && styles.roleButtonTextActive
                      ]}>Admin</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Surveyor Areas (comma-separated, e.g., London, Manchester)"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.surveyorAreas?.join(', ') || ''}
                  onChangeText={(text) => {
                    const areas = text.split(',').map(a => a.trim()).filter(a => a.length > 0);
                    setEditingUser({ ...editingUser, surveyorAreas: areas });
                  }}
                  autoCapitalize="words"
                />
                
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Surveyor Location (e.g., London, UK)"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.surveyorLocation || ''}
                  onChangeText={(text) => setEditingUser({ ...editingUser, surveyorLocation: text })}
                  autoCapitalize="words"
                />
                
                <TextInput
                  style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="Max Travel Time (minutes)"
                  placeholderTextColor={theme.tertiaryText}
                  defaultValue={editingUser.maxTravelTime ? editingUser.maxTravelTime.toString() : ''}
                  onChangeText={(text) => {
                    const num = text.trim() === '' ? undefined : parseInt(text, 10);
                    setEditingUser({ ...editingUser, maxTravelTime: isNaN(num as number) ? undefined : num });
                  }}
                  keyboardType="numeric"
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={() => handleEditUser(editingUser)}
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={showPasswordModal && !!editingUser}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setNewPassword('');
          setConfirmPassword('');
          setShowNewPassword(false);
          setShowConfirmPassword(false);
          setEditingUser(null);
        }}
      >
        <View style={[styles.modal, { zIndex: 9999 }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Reset Password</Text>
            
            <Text style={[styles.modalText, { color: theme.secondaryText }]}>
              Enter a new password for {editingUser?.name || editingUser?.username}
            </Text>
            
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.modalInput, styles.passwordInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                placeholder="New Password"
                placeholderTextColor={theme.tertiaryText}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Feather 
                  name={showNewPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.secondaryText} 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.modalInput, styles.passwordInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                placeholder="Confirm Password"
                placeholderTextColor={theme.tertiaryText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Feather 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.secondaryText} 
                />
              </TouchableOpacity>
            </View>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <Text style={[styles.errorText, { color: '#F44336' }]}>
                Passwords do not match
              </Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.secondaryButton }]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                  setEditingUser(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.primaryText }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.primaryButton }]}
                onPress={handleResetPassword}
                disabled={!newPassword || !confirmPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && userToDelete && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Delete</Text>
            
            <Text style={styles.modalText}>
              Are you sure you want to delete user "{userToDelete.name || userToDelete.username}"? 
              This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  setUserToDelete(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDeleteUser}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <View style={styles.modal}>
          <View style={[styles.modalContent, styles.createUserModalContent]}>
            <Text style={styles.modalTitle}>Create New User</Text>
            
            <ScrollView style={styles.createUserForm}>
              <TextInput
                style={styles.modalInput}
                placeholder="Username"
                value={createUserData.username}
                onChangeText={(text) => setCreateUserData({...createUserData, username: text})}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Email"
                value={createUserData.email}
                onChangeText={(text) => setCreateUserData({...createUserData, email: text})}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Full Name"
                value={createUserData.name}
                onChangeText={(text) => setCreateUserData({...createUserData, name: text})}
                autoCapitalize="words"
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Password (min 8 characters)"
                value={createUserData.password}
                onChangeText={(text) => setCreateUserData({...createUserData, password: text})}
                secureTextEntry
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Confirm Password"
                value={createUserData.confirmPassword}
                onChangeText={(text) => setCreateUserData({...createUserData, confirmPassword: text})}
                secureTextEntry
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Surveyor Areas (comma-separated, e.g., London, Manchester)"
                value={createUserData.surveyorAreas.join(', ')}
                onChangeText={(text) => {
                  const areas = text.split(',').map(a => a.trim()).filter(a => a.length > 0);
                  setCreateUserData({...createUserData, surveyorAreas: areas});
                }}
                autoCapitalize="words"
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Surveyor Location (e.g., London, UK)"
                value={createUserData.surveyorLocation}
                onChangeText={(text) => setCreateUserData({...createUserData, surveyorLocation: text})}
                autoCapitalize="words"
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Max Travel Time (minutes)"
                value={createUserData.maxTravelTime ? createUserData.maxTravelTime.toString() : ''}
                onChangeText={(text) => {
                  const num = text.trim() === '' ? undefined : parseInt(text, 10);
                  setCreateUserData({...createUserData, maxTravelTime: isNaN(num as number) ? undefined : num});
                }}
                keyboardType="numeric"
              />
              
              <View style={styles.roleSelector}>
                <Text style={styles.roleLabel}>Role:</Text>
                <View style={styles.roleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      createUserData.role === UserRole.SURVEYOR && styles.roleButtonActive
                    ]}
                    onPress={() => setCreateUserData({...createUserData, role: UserRole.SURVEYOR})}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      createUserData.role === UserRole.SURVEYOR && styles.roleButtonTextActive
                    ]}>Surveyor</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      createUserData.role === UserRole.ADMIN && styles.roleButtonActive
                    ]}
                    onPress={() => setCreateUserData({...createUserData, role: UserRole.ADMIN})}
                  >
                    <Text style={[
                      styles.roleButtonText,
                      createUserData.role === UserRole.ADMIN && styles.roleButtonTextActive
                    ]}>Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateUserModal(false);
                  setCreateUserData({
                    username: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    name: '',
                    role: UserRole.SURVEYOR,
                    surveyorAreas: [],
                    surveyorLocation: '',
                    maxTravelTime: undefined,
                  });
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, isCreatingUser && styles.disabledButton]}
                onPress={handleCreateUser}
                disabled={isCreatingUser}
              >
                <Text style={styles.modalButtonText}>
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* GHL Status Modal */}
      {showGHLStatusModal && (
        <View style={styles.modal}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>GHL Integration Status</Text>
            
            {isLoadingGHL ? (
              <ActivityIndicator size="large" color={theme.primaryButton} />
            ) : ghlStatus ? (
              <ScrollView style={styles.ghlStatusContent}>
                <View style={styles.ghlStatusSummary}>
                  <Text style={[styles.ghlStatusText, { color: theme.primaryText }]}>
                    Total Users: {ghlStatus.total}
                  </Text>
                  <Text style={[styles.ghlStatusText, { color: theme.successButton }]}>
                    With GHL ID: {ghlStatus.withGhlId}
                  </Text>
                  <Text style={[styles.ghlStatusText, { color: theme.dangerButton }]}>
                    Missing GHL ID: {ghlStatus.withoutGhlId}
                  </Text>
                </View>
                
                <Text style={[styles.ghlStatusSubtitle, { color: theme.secondaryText }]}>User Details:</Text>
                {ghlStatus.users.map((user) => (
                  <View key={user.id} style={[styles.ghlStatusUser, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.ghlStatusUserName, { color: theme.primaryText }]}>{user.name}</Text>
                    <Text style={[styles.ghlStatusUserRole, { color: theme.secondaryText }]}>@{user.username} ({user.role})</Text>
                    <View style={[styles.ghlStatusBadge, { backgroundColor: user.hasGhlId ? theme.successButton : theme.dangerButton }]}>
                      <Text style={styles.ghlStatusBadgeText}>
                        {user.hasGhlId ? 'GHL ✓' : 'No GHL'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.errorText, { color: theme.dangerButton }]}>Failed to load GHL status</Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowGHLStatusModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* GHL Users Modal */}
      {showGHLModal && (
        <View style={styles.modal}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Available GHL Users</Text>
            
            {isLoadingGHL ? (
              <ActivityIndicator size="large" color={theme.primaryButton} />
            ) : (
              <ScrollView style={styles.ghlUsersContent}>
                {ghlUsers.length > 0 ? (
                  ghlUsers.map((ghlUser) => (
                    <View key={ghlUser.id} style={[styles.ghlUserItem, { borderColor: theme.cardBorder }]}>
                      <Text style={[styles.ghlUserName, { color: theme.primaryText }]}>{ghlUser.fullName}</Text>
                      <Text style={[styles.ghlUserEmail, { color: theme.secondaryText }]}>{ghlUser.email}</Text>
                      <Text style={[styles.ghlUserId, { color: theme.tertiaryText }]}>ID: {ghlUser.id}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.errorText, { color: theme.dangerButton }]}>No GHL users found</Text>
                )}
              </ScrollView>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowGHLModal(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Manual GHL Assignment Modal */}
      {showManualAssignmentModal && selectedUserForGHL && (
        <View style={styles.modal}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Assign GHL User ID</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              Assign GHL user ID to: {selectedUserForGHL.name}
            </Text>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.primaryText, borderColor: theme.cardBorder }]}
              placeholder="GHL User ID (optional)"
              placeholderTextColor={theme.secondaryText}
              value={manualAssignmentData.ghlUserId}
              onChangeText={(text) => setManualAssignmentData({...manualAssignmentData, ghlUserId: text})}
            />
            
            <Text style={[styles.modalInputLabel, { color: theme.secondaryText }]}>OR</Text>
            
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.primaryText, borderColor: theme.cardBorder }]}
              placeholder="GHL User Name (optional)"
              placeholderTextColor={theme.secondaryText}
              value={manualAssignmentData.ghlUserName}
              onChangeText={(text) => setManualAssignmentData({...manualAssignmentData, ghlUserName: text})}
            />
            
            <Text style={[styles.modalHelpText, { color: theme.tertiaryText }]}>
              Provide either the GHL User ID or the GHL User Name. The system will search for a match.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowManualAssignmentModal(false);
                  setSelectedUserForGHL(null);
                  setManualAssignmentData({ ghlUserId: '', ghlUserName: '' });
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, isLoadingGHL && styles.disabledButton]}
                onPress={handleManualGHLAssignment}
                disabled={isLoadingGHL}
              >
                <Text style={styles.modalButtonText}>
                  {isLoadingGHL ? 'Assigning...' : 'Assign'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* User Data Modal removed - now available in Statistics & Analytics */}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerText: {
    alignItems: 'center',
  },
  title: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 1,
  },
  activeTab: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    minWidth: width < 768 ? '45%' : '30%',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 50,
  },
  searchContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  searchInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  filterInput: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: width < 768 ? 16 : 24,
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
    }),
  },
  userList: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 4,
  },
  userCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderWidth: 1,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userStatusIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  ghlIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  ghlIdText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  userDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userLastLoginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userDate: {
    fontSize: 12,
    color: '#999',
  },
  userLastLogin: {
    fontSize: 12,
    color: '#999',
  },
  userActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  passwordButton: {
    backgroundColor: '#FF9800',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#FF9800',
  },
  suspendButton: {
    backgroundColor: '#F44336',
  },
  deleteButton: {
    backgroundColor: '#E91E63',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  pageButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  pageButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContent: {
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  passwordInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    paddingRight: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
    zIndex: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  createUserButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  createUserButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createUserModalContent: {
    maxHeight: '80%',
  },
  createUserForm: {
    maxHeight: 400,
  },
  roleSelector: {
    marginBottom: 16,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  roleButtonText: {
    fontWeight: 'bold',
    color: '#666',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  // GHL Management Styles
  ghlOverviewCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ghlOverviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ghlOverviewText: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  ghlStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  ghlStatCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  ghlStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  ghlStatLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  ghlInfoCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ghlInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ghlFeatureList: {
    gap: 12,
  },
  ghlFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ghlFeatureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // GHL Modal Styles
  ghlStatusContent: {
    maxHeight: 400,
  },
  ghlStatusSummary: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  ghlStatusText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  ghlStatusSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  ghlStatusUser: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  ghlStatusUserName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  ghlStatusUserRole: {
    fontSize: 14,
    flex: 1,
  },
  ghlStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ghlStatusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ghlUsersContent: {
    maxHeight: 400,
  },
  ghlUserItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  ghlUserName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ghlUserEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  ghlUserId: {
    fontSize: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInputLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: '600',
  },
  modalHelpText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  
  // New GHL Components Styles
  ghlUsersListCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ghlUsersListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ghlUsersListSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  ghlUsersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  ghlUserCard: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  ghlUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ghlUserCardName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  ghlUserCardEmail: {
    fontSize: 12,
    marginBottom: 2,
    textAlign: 'center',
  },
  ghlUserCardId: {
    fontSize: 10,
    textAlign: 'center',
  },
  ghlUsersMoreText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  ghlStatusDetailsCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ghlStatusDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ghlStatusDetailsSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  ghlStatusDetailsList: {
    gap: 8,
  },
  ghlStatusDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  ghlStatusDetailInfo: {
    flex: 1,
  },
  ghlStatusDetailName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ghlStatusDetailRole: {
    fontSize: 14,
    opacity: 0.8,
  },
  ghlStatusDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ghlStatusDetailBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ghlStatusMoreText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  // System Settings Styles
  settingsOverviewCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsOverviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  settingsOverviewText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  settingCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  settingToggle: {
    width: 50,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    padding: 2,
  },
  settingToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  settingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  settingStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingDetails: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  settingDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingDetailsList: {
    gap: 8,
  },
  settingDetailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  settingDetailText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  settingsLoadingContainer: {
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  settingsLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },


  // User Data Modal Styles removed - functionality moved to Statistics & Analytics
});

export default AdminPanelScreen; 
