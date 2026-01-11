import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { testStorage } from '../utils/test-storage';
import { testAuth } from '../utils/test-auth';
import { testApiConnection } from '../utils/test-api';
import { CONFIG, updateApiUrl, getApiUrl } from '../utils/config';

export default function DebugAuthScreen() {
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [testResults, setTestResults] = useState<string[]>([]);
  const { login, logout, isAuthenticated, user } = useAuth();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runAllTests = async () => {
    setTestResults([]);
    addResult('🧪 Starting all tests...');

    try {
      // Test API connection
      addResult('🌐 Testing API connection...');
      const apiTest = await testApiConnection();
      addResult(apiTest ? '✅ API connection successful' : '❌ API connection failed');

      // Test storage
      addResult('💾 Testing storage...');
      const storageTest = await testStorage();
      addResult(storageTest ? '✅ Storage test successful' : '❌ Storage test failed');

      // Test authentication
      addResult('🔐 Testing authentication...');
      const authTest = await testAuth();
      addResult(authTest ? '✅ Authentication test successful' : '❌ Authentication test failed');

      // Test current auth state
      addResult('👤 Checking current auth state...');
      const currentAuth = await isAuthenticated();
      addResult(currentAuth ? '✅ User is authenticated' : '❌ User is not authenticated');

    } catch (error) {
      addResult(`❌ Test error: ${error.message}`);
    }
  };

  const testLogin = async (username: string, password: string) => {
    addResult(`🔐 Testing login with ${username}...`);
    try {
      const result = await login(username, password);
      if (result.success) {
        addResult('✅ Login successful');
      } else {
        addResult(`❌ Login failed: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Login error: ${error.message}`);
    }
  };

  const updateApiUrlAndTest = async () => {
    addResult(`🔧 Updating API URL to: ${apiUrl}`);
    updateApiUrl(apiUrl);
    
    // Test the new URL
    addResult('🌐 Testing new API URL...');
    const apiTest = await testApiConnection();
    addResult(apiTest ? '✅ New API URL works' : '❌ New API URL failed');
  };

  const clearStorage = async () => {
    addResult('🗑️ Clearing storage...');
    try {
      await logout();
      addResult('✅ Storage cleared');
    } catch (error) {
      addResult(`❌ Clear storage error: ${error.message}`);
    }
  };

  return (
    <ScrollView 
      style={[
        styles.container,
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
      showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
      nestedScrollEnabled={true}
      scrollEnabled={true}
      bounces={Platform.OS !== 'web'}
      alwaysBounceVertical={Platform.OS !== 'web'}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={Platform.OS !== 'web'}
    >
      <Text style={styles.title}>🔧 Debug Authentication</Text>
      
      {/* Current Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Text style={styles.statusText}>API URL: {getApiUrl()}</Text>
        <Text style={styles.statusText}>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</Text>
        <Text style={styles.statusText}>User: {user?.username || 'None'}</Text>
      </View>

      {/* API URL Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="Enter new API URL"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.button} onPress={updateApiUrlAndTest}>
          <Text style={styles.buttonText}>Update API URL & Test</Text>
        </TouchableOpacity>
      </View>

      {/* Test Users */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Users</Text>
        {CONFIG.TEST_USERS.map((testUser, index) => (
          <TouchableOpacity
            key={index}
            style={styles.testUserButton}
            onPress={() => testLogin(testUser.username, testUser.password)}
          >
            <Text style={styles.testUserText}>
              Login as {testUser.name} ({testUser.username})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Test Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Actions</Text>
        <TouchableOpacity style={styles.button} onPress={runAllTests}>
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={clearStorage}>
          <Text style={styles.buttonText}>Clear Storage</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Results</Text>
        <View style={styles.resultsContainer}>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>
              {result}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  testUserButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  testUserText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    maxHeight: 200,
  },
  resultText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
