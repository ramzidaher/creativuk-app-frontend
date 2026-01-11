import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, adminOpportunityDetailsApi } from '../utils/api';

const { width } = Dimensions.get('window');

const AdminUsersListScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Try the new endpoint first
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunities();
      
      // If 404, fallback to existing endpoint
      if (!response.success && response.error?.includes('404')) {
        console.log('⚠️ New endpoint not available, falling back to existing endpoint...');
        response = await adminAnalyticsApi.getAllUsers();
        
        if (response.success) {
          const usersData = response.data?.data || response.data || [];
          const usersArray = Array.isArray(usersData) ? usersData : [];
          
          const transformedUsers = usersArray.map((user: any) => ({
            ...user,
            opportunitiesCount: 0,
            opportunities: [],
          }));
          
          setUsers(transformedUsers);
          return;
        }
      }
      
      if (response.success) {
        const data = response.data?.data || response.data || [];
        const usersArray = Array.isArray(data) ? data : [];
        
        const transformedUsers = usersArray.map((item: any) => ({
          ...item.user,
          opportunitiesCount: item.totalOpportunities || (item.opportunities?.length || 0),
          opportunities: item.opportunities || [],
        }));
        
        setUsers(transformedUsers);
      } else {
        console.error('❌ Failed to load users:', response.error);
        if (!response.error?.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load users');
        }
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleUserClick = (user: any) => {
    navigation.navigate('AdminUserOpportunities', { userId: user.id || user.userId, userName: user.name || user.username });
  };

  const renderUserItem = (user: any, index: number) => {
    if (!user) return null;
    
    const userName = user.name || user.username || user.email || 'Unknown User';
    const userEmail = user.email || 'No email';
    const userRole = user.role || 'Unknown';
    const opportunitiesCount = user.opportunitiesCount || user.opportunities?.length || 0;
    
    return (
      <TouchableOpacity
        key={`user-${user.id || user.userId || index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        onPress={() => handleUserClick(user)}
        activeOpacity={0.7}
      >
        <View style={styles.dataItemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
              {userName}
            </Text>
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
              {userEmail}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: theme.primaryButton + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: theme.primaryButton }
            ]}>
              {userRole}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Opportunities:</Text> {opportunitiesCount}
          </Text>
        </View>
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.primaryButton, fontSize: 12 }]}>
            Tap to view opportunities →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading users...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminGuard>
      <SafeAreaView 
        style={[
          styles.container, 
          { backgroundColor: theme.primaryBackground },
          Platform.OS === 'web' && {
            height: '100vh',
            maxHeight: '100vh',
          }
        ]}
      >
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
            <Text style={[styles.title, { color: theme.primaryText }]}>All Users</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>View users and their opportunities</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryButton} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.dataSection}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Users ({users.length})
            </Text>
            {users.length > 0 ? (
              users.map((user: any, index: number) => renderUserItem(user, index))
            ) : (
              <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
                <Feather name="users" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
                <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                  No users found.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
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
  },
  headerText: {
    alignItems: 'center',
  },
  title: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  dataSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  dataItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dataItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dataItemSubtitle: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AdminUsersListScreen;



















