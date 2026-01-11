import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface DocuSignTestResult {
  success: boolean;
  message: string;
  data?: any;
  consentUrl?: string;
}

export default function DocuSignTestScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<DocuSignTestResult | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(user?.email || '');
  const [recipientName, setRecipientName] = useState(user?.name || '');

  const testDocuSignConnection = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const { api } = await import('../utils/api');
      const response = await api.get('/docusign/test-connection');
      const result = response.data;
      
      setTestResult(result);

      if (result.success) {
        Alert.alert('Success!', result.message);
      } else {
        if (result.consentUrl) {
          Alert.alert(
            'Consent Required', 
            'User consent is required for DocuSign integration. Would you like to open the consent URL?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Consent URL', 
                onPress: () => {
                  // In a real app, you would open this URL in a browser
                  console.log('Consent URL:', result.consentUrl);
                  Alert.alert('Consent URL', `Please visit this URL to grant consent:\n\n${result.consentUrl}`);
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', result.message);
        }
      }
    } catch (error) {
      console.error('DocuSign test error:', error);
      setTestResult({
        success: false,
        message: `Connection failed: ${error.message}`,
      });
      Alert.alert('Error', `Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestEnvelope = async () => {
    if (!recipientEmail || !recipientName) {
      Alert.alert('Error', 'Please enter recipient email and name');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const { api } = await import('../utils/api');
      const response = await api.post('/docusign/create-test-envelope', {
        recipientEmail,
        recipientName,
      });
      const result = response.data;
      
      setTestResult(result);

      if (result.success) {
        Alert.alert('Success!', `Test envelope created: ${result.envelopeId}`);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('DocuSign envelope creation error:', error);
      setTestResult({
        success: false,
        message: `Envelope creation failed: ${error.message}`,
      });
      Alert.alert('Error', `Envelope creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
          DocuSign Test
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
          Test DocuSign integration and create test documents
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Connection Test Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Connection Test
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Test the DocuSign API connection and authentication
          </Text>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primaryButton }]}
            onPress={testDocuSignConnection}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Test Envelope Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Create Test Envelope
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Create a test document for signing
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Recipient Email
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="Enter recipient email"
              placeholderTextColor={theme.secondaryText}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Recipient Name
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Enter recipient name"
              placeholderTextColor={theme.secondaryText}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.secondaryButton }]}
            onPress={createTestEnvelope}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Create Test Envelope</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Test Results */}
        {testResult && (
          <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Ionicons 
                name={testResult.success ? "checkmark-circle" : "close-circle"} 
                size={24} 
                color={testResult.success ? "#10b981" : "#ef4444"} 
              />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                Test Results
              </Text>
            </View>
            
            <View style={[styles.resultContainer, { backgroundColor: testResult.success ? '#10b98120' : '#ef444420' }]}>
              <Text style={[styles.resultMessage, { color: testResult.success ? '#10b981' : '#ef4444' }]}>
                {testResult.message}
              </Text>
              
              {testResult.consentUrl && (
                <View style={styles.resultData}>
                  <Text style={[styles.resultDataTitle, { color: theme.primaryText }]}>
                    Consent URL:
                  </Text>
                  <Text style={[styles.resultDataText, { color: theme.secondaryText }]}>
                    {testResult.consentUrl}
                  </Text>
                </View>
              )}
              
              {testResult.data && (
                <View style={styles.resultData}>
                  <Text style={[styles.resultDataTitle, { color: theme.primaryText }]}>
                    Response Data:
                  </Text>
                  <Text style={[styles.resultDataText, { color: theme.secondaryText }]}>
                    {JSON.stringify(testResult.data, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Configuration Info */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Configuration Info
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            DocuSign Integration Key: fbec1223-7683-4544-8510-80ec297f6993
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Account ID: 42299021
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Environment: Demo (for testing)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  resultContainer: {
    borderRadius: 8,
    padding: 16,
  },
  resultMessage: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  resultData: {
    marginTop: 12,
  },
  resultDataTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultDataText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
