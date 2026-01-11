import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAlert?: boolean;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  fallback, 
  showAlert = true 
}) => {
  const { user } = useAuth();
  const { theme } = useTheme();

  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin) {
    if (showAlert) {
      Alert.alert(
        'Access Denied',
        'You need administrator privileges to access this feature.',
        [{ text: 'OK' }]
      );
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.content, { backgroundColor: theme.cardBackground }]}>
          <Feather name="shield-off" size={48} color={theme.error} />
          <Text style={[styles.title, { color: theme.text }]}>
            Access Restricted
          </Text>
          <Text style={[styles.message, { color: theme.secondaryText }]}>
            This feature requires administrator privileges.
          </Text>
          <Text style={[styles.role, { color: theme.secondaryText }]}>
            Your role: {user?.role || 'Unknown'}
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  role: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default AdminGuard;


