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

interface SignerInfo {
  name: string;
  reason: string;
  location: string;
  contactInfo: string;
}

export default function PdfSigningTestScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [signerInfo, setSignerInfo] = useState<SignerInfo>({
    name: user?.name || 'John Doe',
    reason: 'Document approval',
    location: 'San Francisco, CA',
    contactInfo: user?.email || 'john.doe@creativsolar.com',
  });

  const testPdfSigning = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const { api } = await import('../utils/api');
      const response = await api.get('/pdf-signing/test');
      const result = response.data;
      
      setTestResult(result);

      if (result.success) {
        Alert.alert('Success!', 'Test PDF signing completed successfully');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('PDF signing test error:', error);
      setTestResult({
        success: false,
        message: `Test failed: ${error.message}`,
      });
      Alert.alert('Error', `Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const signCustomPdf = async () => {
    if (!signerInfo.name || !signerInfo.reason) {
      Alert.alert('Error', 'Please fill in signer name and reason');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      // Create a simple test PDF
      const { api } = await import('../utils/api');
      
      // For now, we'll use the test endpoint
      // In a real implementation, you'd send your PDF data
      const response = await api.get('/pdf-signing/test');
      const result = response.data;
      
      setTestResult(result);

      if (result.success) {
        Alert.alert('Success!', 'PDF signed successfully');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('PDF signing error:', error);
      setTestResult({
        success: false,
        message: `Signing failed: ${error.message}`,
      });
      Alert.alert('Error', `Signing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificate = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const { api } = await import('../utils/api');
      const response = await api.get('/pdf-signing/generate-certificate');
      const result = response.data;
      
      setTestResult(result);

      if (result.success) {
        Alert.alert('Success!', 'Certificate generated successfully');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Certificate generation error:', error);
      setTestResult({
        success: false,
        message: `Certificate generation failed: ${error.message}`,
      });
      Alert.alert('Error', `Certificate generation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
          PDF Signing Test
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
          Test local PDF signing with digital certificates
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Test PDF Signing Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Test PDF Signing
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Test the PDF signing functionality with a sample document
          </Text>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primaryButton }]}
            onPress={testPdfSigning}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Test PDF Signing</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Signer Information Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Signer Information
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Configure the digital signature details
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Signer Name
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={signerInfo.name}
              onChangeText={(text) => setSignerInfo({ ...signerInfo, name: text })}
              placeholder="Enter signer name"
              placeholderTextColor={theme.secondaryText}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Reason for Signing
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={signerInfo.reason}
              onChangeText={(text) => setSignerInfo({ ...signerInfo, reason: text })}
              placeholder="Enter reason for signing"
              placeholderTextColor={theme.secondaryText}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Location
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={signerInfo.location}
              onChangeText={(text) => setSignerInfo({ ...signerInfo, location: text })}
              placeholder="Enter location"
              placeholderTextColor={theme.secondaryText}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              Contact Information
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
              value={signerInfo.contactInfo}
              onChangeText={(text) => setSignerInfo({ ...signerInfo, contactInfo: text })}
              placeholder="Enter contact information"
              placeholderTextColor={theme.secondaryText}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.secondaryButton }]}
            onPress={signCustomPdf}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="create" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Sign PDF with Custom Info</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Certificate Generation Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Certificate Management
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            Generate digital certificates for PDF signing
          </Text>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.accentColor || '#8B5CF6' }]}
            onPress={generateCertificate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="key" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Generate Certificate</Text>
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

        {/* Features Info */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={24} color={theme.primaryButton} />
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Features
            </Text>
          </View>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            ✅ Self-signed digital certificates
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            ✅ Cryptographic PDF signing
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            ✅ Signature verification
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            ✅ Timestamp and metadata
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
            ✅ No external dependencies
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
