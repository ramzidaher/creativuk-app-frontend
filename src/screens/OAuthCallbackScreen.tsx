import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as Linking from 'expo-linking';

export default function OAuthCallbackScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login } = useAuth();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      console.log('OAuthCallbackScreen: Starting OAuth callback handling');
      
      // Get the token from route params or URL parameters
      let token = null;
      let error = null;

      // First try to get from route params (if passed directly)
      if (route.params) {
        const params = route.params as any;
        token = params.token;
        error = params.error;
        console.log('OAuthCallbackScreen: Got params from route:', { token: token ? 'present' : 'missing', error });
      }

      // If not in route params, try to get from URL (for web/Expo)
      if (!token && typeof window !== 'undefined') {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          token = urlParams.get('token');
          error = urlParams.get('error');
          console.log('OAuthCallbackScreen: Got params from URL:', { token: token ? 'present' : 'missing', error });
        } catch (e) {
          console.log('OAuthCallbackScreen: Could not parse URL params:', e);
        }
      }

      // If still no token, try to get from initial URL (for deep links)
      if (!token) {
        try {
          const initialURL = await Linking.getInitialURL();
          if (initialURL) {
            console.log('OAuthCallbackScreen: Checking initial URL:', initialURL);
            const url = new URL(initialURL);
            token = url.searchParams.get('token');
            error = url.searchParams.get('error');
            console.log('OAuthCallbackScreen: Got params from initial URL:', { token: token ? 'present' : 'missing', error });
          }
        } catch (e) {
          console.log('OAuthCallbackScreen: Could not get initial URL:', e);
        }
      }

      // If still no token, check for temporary token in localStorage
      if (!token && typeof window !== 'undefined') {
        try {
          const tempToken = localStorage.getItem('temp_oauth_token');
          if (tempToken) {
            console.log('OAuthCallbackScreen: Found temporary token in localStorage');
            token = tempToken;
            localStorage.removeItem('temp_oauth_token'); // Clean up
          }
        } catch (e) {
          console.log('OAuthCallbackScreen: Could not check localStorage:', e);
        }
      }

      console.log('OAuthCallbackScreen: Final params:', { token: token ? 'present' : 'missing', error });

      if (error) {
        console.log('OAuthCallbackScreen: OAuth error detected:', error);
        setStatus('Authentication failed');
        Alert.alert('Authentication Failed', 'OAuth authentication was cancelled or failed.');
        setTimeout(() => {
          navigation.navigate('Login' as never);
        }, 2000);
        return;
      }

      if (!token) {
        console.log('OAuthCallbackScreen: No token received');
        setStatus('No token received');
        Alert.alert('Authentication Error', 'No authentication token received. Please try logging in again.');
        setTimeout(() => {
          navigation.navigate('Login' as never);
        }, 2000);
        return;
      }

      console.log('OAuthCallbackScreen: Token received, calling login function');
      setStatus('Authenticating...');
      
      // Call login function
      await login(token);
      
      console.log('OAuthCallbackScreen: Login successful, navigating to Dashboard');
      setStatus('Authentication successful!');
      
      // Navigate to dashboard with a slight delay to ensure state is updated
      setTimeout(() => {
        navigation.navigate('MainTabs' as never);
      }, 1500);

    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('Authentication failed');
      Alert.alert(
        'Authentication Error', 
        'Failed to complete authentication. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login' as never)
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#89df2b" />
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.subtitle}>
          Please wait while we complete your authentication...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
}); 