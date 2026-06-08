import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const SALES_KNOWLEDGE_BASE_URL = 'https://creativenergy.mintlify.app/sales';

interface ProfileMenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconType: 'feather' | 'material';
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  isAdminOnly?: boolean;
  isDestructive?: boolean;
}

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const profileMenuItems: ProfileMenuItem[] = [
    {
      id: 'account',
      title: 'Account Settings',
      subtitle: 'Manage your account information',
      icon: 'user',
      iconType: 'feather',
      onPress: () => {
        Alert.alert('Coming Soon', 'Account settings will be available soon.');
      },
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Configure notification preferences',
      icon: 'bell',
      iconType: 'feather',
      onPress: () => {
        Alert.alert('Coming Soon', 'Notification settings will be available soon.');
      },
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      subtitle: 'Manage your privacy settings',
      icon: 'shield',
      iconType: 'feather',
      onPress: () => {
        Alert.alert('Coming Soon', 'Privacy settings will be available soon.');
      },
    },
    {
      id: 'opportunities',
      title: 'Opportunity management',
      subtitle: 'View and manage your opportunities',
      icon: 'briefcase',
      iconType: 'feather',
      onPress: () => navigation.navigate('OpportunityManagement'),
      isAdminOnly: true,
    },
    {
      id: 'statistics',
      title: 'Statistics & Analytics',
      subtitle: 'View your progress and performance',
      icon: 'bar-chart',
      iconType: 'feather',
      onPress: () => navigation.navigate('StatisticsAnalytics'),
    },
    {
      id: 'admin',
      title: 'Admin Panel',
      subtitle: 'System administration and analytics',
      icon: 'settings',
      iconType: 'feather',
      onPress: () => navigation.navigate('AdminPanel'),
      isAdminOnly: true,
      showBadge: true,
      badgeText: 'ADMIN',
    },
    {
      id: 'tools',
      title: 'Tools',
      subtitle: 'Fill survey placeholder images by opportunity ID',
      icon: 'tool',
      iconType: 'feather',
      onPress: () => navigation.navigate('AdminTools'),
      isAdminOnly: true,
    },
    {
      id: 'support',
      title: 'Support & Help',
      subtitle: 'Sales guides and knowledge base',
      icon: 'help-circle',
      iconType: 'feather',
      onPress: async () => {
        try {
          const canOpen = await Linking.canOpenURL(SALES_KNOWLEDGE_BASE_URL);
          if (canOpen) {
            await Linking.openURL(SALES_KNOWLEDGE_BASE_URL);
          } else {
            Alert.alert(
              'Knowledge base',
              `Open this link in your browser:\n${SALES_KNOWLEDGE_BASE_URL}`
            );
          }
        } catch {
          Alert.alert(
            'Knowledge base',
            `Open this link in your browser:\n${SALES_KNOWLEDGE_BASE_URL}`
          );
        }
      },
    },
    {
      id: 'about',
      title: 'About',
      subtitle: 'App version and information',
      icon: 'info',
      iconType: 'feather',
      onPress: () => {
        Alert.alert(
          'About',
          'Creativ Solar App\nVersion 1.0.0\n\nBuilt with React Native and Expo',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'logout',
      title: 'Logout',
      subtitle: 'Sign out of your account',
      icon: 'log-out',
      iconType: 'feather',
      onPress: handleLogout,
      isDestructive: true,
    },
  ];

  // Filter menu items based on user role
  const visibleMenuItems = profileMenuItems.filter(item => {
    if (item.isAdminOnly && user?.role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  const renderMenuItem = (item: ProfileMenuItem) => {
    const IconComponent = item.iconType === 'feather' ? Feather : MaterialIcons;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.menuItem,
          { 
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
          item.isDestructive && { borderColor: theme.dangerButton + '30' }
        ]}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[
            styles.menuItemIcon,
            { 
              backgroundColor: item.isDestructive 
                ? theme.dangerButton + '20' 
                : theme.primaryButton + '20' 
            }
          ]}>
            <IconComponent
              name={item.icon as any}
              size={24}
              color={item.isDestructive ? theme.dangerButton : theme.primaryButton}
            />
          </View>
          <View style={styles.menuItemContent}>
            <View style={styles.menuItemTitleRow}>
              <Text style={[
                styles.menuItemTitle,
                { color: item.isDestructive ? theme.dangerButton : theme.primaryText }
              ]}>
                {item.title}
              </Text>
              {item.showBadge && (
                <View style={[
                  styles.badge,
                  { backgroundColor: theme.primaryButton }
                ]}>
                  <Text style={styles.badgeText}>{item.badgeText}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.menuItemSubtitle, { color: theme.secondaryText }]}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.tertiaryText}
        />
      </TouchableOpacity>
    );
  };

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
      {/* Header */}
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
          <Text style={[styles.title, { color: theme.primaryText }]}>Profile</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Manage your account and settings</Text>
        </View>
      </View>

      <ScrollView
        style={[
          styles.scrollView,
          { backgroundColor: 'transparent' },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        contentContainerStyle={[
          { paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryButton} />
        }
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
      >
        {/* User Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="user" size={32} color={theme.primaryButton} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: theme.primaryText }]}>
                {user?.name || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.secondaryText }]}>
                {user?.email || 'user@example.com'}
              </Text>
              <View style={styles.userBadges}>
                <View style={[
                  styles.roleBadge,
                  { 
                    backgroundColor: user?.role === 'ADMIN' 
                      ? theme.dangerButton + '20' 
                      : theme.primaryButton + '20' 
                  }
                ]}>
                  <Feather 
                    name={user?.role === 'ADMIN' ? 'shield' : 'user-check'} 
                    size={12} 
                    color={user?.role === 'ADMIN' ? theme.dangerButton : theme.primaryButton} 
                  />
                  <Text style={[
                    styles.roleBadgeText,
                    { color: user?.role === 'ADMIN' ? theme.dangerButton : theme.primaryButton }
                  ]}>
                    {user?.role || 'USER'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: theme.successButton + '20' }]}>
                  <Feather name="check-circle" size={12} color={theme.successButton} />
                  <Text style={[styles.statusBadgeText, { color: theme.successButton }]}>
                    Active
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={[styles.themeCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.themeHeader}>
            <View style={styles.themeInfo}>
              <Text style={[styles.themeTitle, { color: theme.primaryText }]}>Appearance</Text>
              <Text style={[styles.themeSubtitle, { color: theme.secondaryText }]}>
                Switch between light and dark themes
              </Text>
            </View>
            <View style={[styles.themeToggle, { backgroundColor: theme.inputBackground }]}>
              <Feather 
                name="sun" 
                size={16} 
                color={isDark ? theme.secondaryText : '#f59e0b'} 
                style={{ marginRight: 8 }}
              />
              <TouchableOpacity
                style={[
                  styles.toggleSwitch,
                  {
                    backgroundColor: isDark ? theme.primaryButton : theme.secondaryButton,
                  }
                ]}
                onPress={toggleTheme}
              >
                <View style={[
                  styles.toggleKnob,
                  {
                    backgroundColor: '#ffffff',
                    transform: [{ translateX: isDark ? 20 : 2 }],
                  }
                ]} />
              </TouchableOpacity>
              <Feather 
                name="moon" 
                size={16} 
                color={isDark ? '#8b5cf6' : theme.secondaryText} 
                style={{ marginLeft: 8 }}
              />
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: theme.primaryText }]}>Settings</Text>
          {visibleMenuItems.map(renderMenuItem)}
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Profile Card
  profileCard: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 12,
    opacity: 0.8,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Theme Card
  themeCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flex: 1,
  },
  themeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    padding: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },

  // Menu Section
  menuSection: {
    marginBottom: 20,
  },
  menuSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  menuItemSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;


