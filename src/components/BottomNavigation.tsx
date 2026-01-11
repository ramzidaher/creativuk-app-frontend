import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Text } from 'react-native';

export default function BottomNavigation() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme } = useTheme();

  // Get the current route name
  const currentRouteName = route.name;

  // Check if we're in a tab screen
  const isTabScreen = ['Dashboard', 'Opportunities', 'Progress', 'Profile'].includes(currentRouteName);

  // Navigation items
  const navItems = [
    {
      name: 'Dashboard',
      label: 'Dashboard',
      icon: (focused: boolean) => (
        <Ionicons 
          name={focused ? 'home' : 'home-outline'} 
          size={24} 
          color={focused ? '#B4F35B' : '#64748b'} 
        />
      ),
      route: 'MainTabs',
      tabRoute: 'Dashboard',
    },
    {
      name: 'Opportunities',
      label: 'Appointments',
      icon: (focused: boolean) => (
        <MaterialIcons 
          name="business" 
          size={24} 
          color={focused ? '#B4F35B' : '#64748b'} 
        />
      ),
      route: 'MainTabs',
      tabRoute: 'Opportunities',
    },
    {
      name: 'Progress',
      label: 'Progress',
      icon: (focused: boolean) => (
        <FontAwesome5 
          name="cogs" 
          size={24} 
          color={focused ? '#B4F35B' : '#64748b'} 
        />
      ),
      route: 'MainTabs',
      tabRoute: 'Progress',
    },
    {
      name: 'Profile',
      label: 'Profile',
      icon: (focused: boolean) => (
        <Ionicons 
          name={focused ? 'person' : 'person-outline'} 
          size={24} 
          color={focused ? '#B4F35B' : '#64748b'} 
        />
      ),
      route: 'MainTabs',
      tabRoute: 'Profile',
    },
  ];

  const handleNavigation = (item: typeof navItems[0]) => {
    // If we're already in MainTabs, navigate to the specific tab
    // Otherwise, navigate to MainTabs first, then to the specific tab
    if (isTabScreen) {
      // We're in a tab screen, just switch tabs
      navigation.navigate(item.tabRoute);
    } else {
      // We're in a stack screen, navigate to MainTabs with the specific tab
      navigation.navigate('MainTabs', { screen: item.tabRoute });
    }
  };

  // Determine if an item is active
  const isActive = (item: typeof navItems[0]) => {
    if (isTabScreen) {
      return currentRouteName === item.name;
    }
    return false;
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.cardBackground || '#ffffff',
        borderTopColor: theme.cardBorder || '#e2e8f0',
      }
    ]}>
      {navItems.map((item) => {
        const focused = isActive(item);
        return (
          <TouchableOpacity
            key={item.name}
            style={styles.navItem}
            onPress={() => handleNavigation(item)}
            activeOpacity={0.7}
          >
            {item.icon(focused)}
            <Text style={[
              styles.label,
              {
                color: focused ? '#B4F35B' : '#64748b',
                fontWeight: focused ? '600' : '500',
              }
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    height: Platform.OS === 'ios' ? 85 : 65,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
  },
});


















