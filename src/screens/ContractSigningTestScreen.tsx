import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface Agreement {
  id: string;
  name: string;
  status: string;
  createdDate: string;
  participants: string[];
  signingUrl?: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdDate: string;
  accountId: string;
}

interface AdobeSignConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  baseUrl: string;
}

export default function ContractSigningTestScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'agreements' | 'users'>('agreements');
  const [config, setConfig] = useState<AdobeSignConfig>({
    clientId: '',
    clientSecret: '',
    accessToken: '',
    baseUrl: 'https://api.na1.adobesign.com'
  });
  const [testDocument, setTestDocument] = useState<{
    name: string;
    email: string;
    documentName: string;
  }>({
    name: 'Test Customer',
    email: 'ramzi.daher@gmail.com',
    documentName: 'Solar Installation Contract'
  });

  // Load saved configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      // In a real app, you'd load from secure storage
      // For demo purposes, we'll use default values
      setConfig({
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET',
        accessToken: 'YOUR_ACCESS_TOKEN',
        baseUrl: 'https://api.na1.adobesign.com'
      });
    } catch (error) {
      console.log('No saved configuration found');
    }
  };

  const saveConfiguration = async () => {
    try {
      // In a real app, you'd save to secure storage
      console.log('Configuration saved:', config);
      setShowConfigModal(false);
      Alert.alert('Success', 'Configuration saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration');
    }
  };

  const getBaseUris = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.na1.adobesign.com/restapi/v6/baseUris', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Base URIs', JSON.stringify(data, null, 2));
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get base URIs: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestAgreement = async () => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      // First, upload a transient document (in real app, you'd upload an actual PDF)
      const documentResponse = await fetch(`${config.baseUrl}/restapi/v6/transientDocuments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // In a real implementation, you'd upload an actual PDF file
          // For demo purposes, we'll simulate this
        }),
      });

      if (!documentResponse.ok) {
        throw new Error('Failed to upload document');
      }

      const documentData = await documentResponse.json();
      const transientDocumentId = documentData.transientDocumentId;

      // Create the agreement
      const agreementData = {
        fileInfos: [{
          transientDocumentId: transientDocumentId
        }],
        name: testDocument.documentName,
        participantSetsInfo: [{
          memberInfos: [{
            email: testDocument.email
          }],
          order: 1,
          role: 'SIGNER'
        }],
        signatureType: 'ESIGN',
        state: 'IN_PROCESS'
      };

      const agreementResponse = await fetch(`${config.baseUrl}/restapi/v6/agreements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agreementData),
      });

      if (agreementResponse.ok) {
        const agreement = await agreementResponse.json();
        Alert.alert('Success', `Agreement created successfully!\nID: ${agreement.id}`);
        
        // Add to local state
        const newAgreement: Agreement = {
          id: agreement.id,
          name: testDocument.documentName,
          status: 'OUT_FOR_SIGNATURE',
          createdDate: new Date().toISOString(),
          participants: [testDocument.email]
        };
        setAgreements(prev => [newAgreement, ...prev]);
      } else {
        const error = await agreementResponse.text();
        Alert.alert('Error', `Failed to create agreement: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to create agreement: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getAgreements = async () => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.baseUrl}/restapi/v6/agreements`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const agreementList = data.userAgreementList?.map((agreement: any) => ({
          id: agreement.id,
          name: agreement.name,
          status: agreement.status,
          createdDate: agreement.createdDate,
          participants: agreement.participantSetsInfo?.map((set: any) => 
            set.memberInfos?.map((member: any) => member.email)
          ).flat() || []
        })) || [];
        
        setAgreements(agreementList);
        Alert.alert('Success', `Retrieved ${agreementList.length} agreements`);
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get agreements: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get agreements: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getSigningUrl = async (agreementId: string) => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.baseUrl}/restapi/v6/agreements/${agreementId}/signingUrls`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const signingUrl = data.signingUrlSetInfos?.[0]?.signingUrls?.[0]?.esignUrl;
        
        if (signingUrl) {
          Alert.alert(
            'Signing URL',
            `Signing URL: ${signingUrl}`,
            [
              { text: 'Copy URL', onPress: () => console.log('URL copied:', signingUrl) },
              { text: 'OK' }
            ]
          );
        } else {
          Alert.alert('No Signing URL', 'No signing URL available for this agreement');
        }
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get signing URL: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get signing URL: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadPdfForSigning = async () => {
    console.log('🔍 Upload PDF for Signing button pressed!');
    
    // Check if we have the integration key
    const integrationKey = '3AAABLblqZhCbYCgzCoL...'; // Your integration key
    console.log('🔍 Integration Key available:', !!integrationKey);
    console.log('🔍 Integration Key value:', integrationKey.substring(0, 20) + '...');
    
    if (!integrationKey || integrationKey.includes('YOUR_INTEGRATION_KEY')) {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign Integration Key first.');
      return;
    }
    
    console.log('✅ Integration key found, starting upload process directly...');
    
    setLoading(true);
    try {
      console.log('🔍 Starting PDF upload and signing process...');
      
      // Prepare the request body
      const requestBody = {
        filePath: "src/excel-file-calculator/opportunities/pdfs/Off Peak Calculator - 3vVkN8gcoStefQKUlYAT.pdf",
        signerEmail: testDocument.email,
        agreementName: testDocument.documentName
      };
      
      console.log('🔍 Sending request to backend...');
      
      const response = await fetch(` /api/adobe-sign/upload-and-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 Upload and sign response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Upload and sign successful:', result);
        
        // Get the signing URL since agreement is OUT_FOR_SIGNATURE
        try {
          const signingResponse = await fetch(`/api/adobe-sign/agreement-signing-url/${result.agreementId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (signingResponse.ok) {
            const signingData = await signingResponse.json();
            console.log('✅ Signing URL retrieved:', signingData);
            
            Alert.alert(
              'Success!', 
              `Agreement created successfully!\n\nAgreement ID: ${result.agreementId}\n\nStatus: OUT_FOR_SIGNATURE\n\nSigning URL: ${signingData.signingUrl || 'Check email for signing link'}`,
              [
                {
                  text: 'Open Signing URL',
                  onPress: () => {
                    if (signingData.signingUrl) {
                      window.open(signingData.signingUrl, '_blank');
                    }
                  }
                },
                {
                  text: 'OK',
                  onPress: () => {
                    // Refresh agreements list
                    getAgreements();
                  }
                }
              ]
            );
          } else {
            Alert.alert(
              'Success!', 
              `Agreement created successfully!\n\nAgreement ID: ${result.agreementId}\n\nStatus: OUT_FOR_SIGNATURE\n\nNote: Using ramzi.daher@gmail.com - check your Adobe Sign dashboard for the signing link.`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    // Refresh agreements list
                    getAgreements();
                  }
                }
              ]
            );
          }
        } catch (signingError) {
          console.log('⚠️ Could not get signing URL:', signingError);
          Alert.alert(
            'Success!', 
            `Agreement created successfully!\n\nAgreement ID: ${result.agreementId}\n\nStatus: OUT_FOR_SIGNATURE\n\nNote: Using ramzi.daher@gmail.com - check your Adobe Sign dashboard for the signing link.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Refresh agreements list
                  getAgreements();
                }
              }
            ]
          );
        }
      } else {
        const errorData = await response.json();
        console.log('❌ Upload and sign failed:', errorData);
        Alert.alert('Upload Failed', `Upload and sign workflow failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('❌ Upload and sign error:', error);
      Alert.alert('Error', `Upload and sign workflow failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getAgreementStatus = async (agreementId: string) => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.baseUrl}/restapi/v6/agreements/${agreementId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Agreement Status', JSON.stringify(data, null, 2));
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get agreement status: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get agreement status: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getUsers = async () => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.baseUrl}/restapi/v6/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userList = data.userInfoList?.map((userInfo: any) => ({
          id: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.firstName || '',
          lastName: userInfo.lastName || '',
          status: userInfo.status || 'ACTIVE',
          createdDate: userInfo.createdDate || new Date().toISOString(),
          accountId: userInfo.accountId || ''
        })) || [];
        
        setUsers(userList);
        Alert.alert('Success', `Retrieved ${userList.length} users`);
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get users: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get users: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getUserDetails = async (userId: string) => {
    if (!config.accessToken || config.accessToken === 'YOUR_ACCESS_TOKEN') {
      Alert.alert('Configuration Required', 'Please configure your Adobe Sign credentials first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.baseUrl}/restapi/v6/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('User Details', JSON.stringify(data, null, 2));
      } else {
        const error = await response.text();
        Alert.alert('Error', `Failed to get user details: ${error}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get user details: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const renderAgreementCard = (agreement: Agreement) => (
    <View key={agreement.id} style={[styles.agreementCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <View style={styles.agreementHeader}>
        <Text style={[styles.agreementName, { color: theme.primaryText }]}>{agreement.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(agreement.status) }]}>
          <Text style={styles.statusText}>{agreement.status}</Text>
        </View>
      </View>
      
      <Text style={[styles.agreementId, { color: theme.secondaryText }]}>ID: {agreement.id}</Text>
      <Text style={[styles.agreementDate, { color: theme.secondaryText }]}>
        Created: {new Date(agreement.createdDate).toLocaleDateString()}
      </Text>
      
      <View style={styles.participantsContainer}>
        <Text style={[styles.participantsLabel, { color: theme.secondaryText }]}>Participants:</Text>
        {agreement.participants.map((email, index) => (
          <Text key={index} style={[styles.participantEmail, { color: theme.primaryText }]}>{email}</Text>
        ))}
      </View>

      <View style={styles.agreementActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
          onPress={() => getSigningUrl(agreement.id)}
        >
          <Feather name="external-link" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Get Signing URL</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.secondaryButton }]}
          onPress={() => getAgreementStatus(agreement.id)}
        >
          <Feather name="info" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>Status</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OUT_FOR_SIGNATURE': return '#f59e0b';
      case 'SIGNED': return '#10b981';
      case 'CANCELLED': return '#ef4444';
      case 'EXPIRED': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#10b981';
      case 'INACTIVE': return '#ef4444';
      case 'PENDING': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const renderUserCard = (user: User) => (
    <View key={user.id} style={[styles.userCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.primaryText }]}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={[styles.userEmail, { color: theme.secondaryText }]}>{user.email}</Text>
        </View>
        <View style={[styles.userStatusBadge, { backgroundColor: getUserStatusColor(user.status) }]}>
          <Text style={styles.userStatusText}>{user.status}</Text>
        </View>
      </View>
      
      <Text style={[styles.userId, { color: theme.secondaryText }]}>ID: {user.id}</Text>
      <Text style={[styles.userDate, { color: theme.secondaryText }]}>
        Created: {new Date(user.createdDate).toLocaleDateString()}
      </Text>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
          onPress={() => getUserDetails(user.id)}
        >
          <Feather name="user" size={16} color="#ffffff" />
          <Text style={styles.actionButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[
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
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Contract Signing Test</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Test Adobe Acrobat Sign REST API integration
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.content}>
          {/* Configuration Section */}
          <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={24} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Configuration</Text>
            </View>
            <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
              Configure your Adobe Sign API credentials to test the integration
            </Text>
            
            <TouchableOpacity
              style={[styles.configButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => setShowConfigModal(true)}
            >
              <Feather name="edit" size={16} color="#ffffff" />
              <Text style={styles.configButtonText}>Configure API Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Test Document Section */}
          <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={24} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Test Document</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Customer Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={testDocument.name}
                onChangeText={(text) => setTestDocument(prev => ({ ...prev, name: text }))}
                placeholder="Enter customer name"
                placeholderTextColor={theme.secondaryText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Customer Email</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={testDocument.email}
                onChangeText={(text) => setTestDocument(prev => ({ ...prev, email: text }))}
                placeholder="Enter customer email"
                placeholderTextColor={theme.secondaryText}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Document Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={testDocument.documentName}
                onChangeText={(text) => setTestDocument(prev => ({ ...prev, documentName: text }))}
                placeholder="Enter document name"
                placeholderTextColor={theme.secondaryText}
              />
            </View>
          </View>

          {/* API Test Actions */}
          <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.sectionHeader}>
              <Feather name="zap" size={24} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>API Tests</Text>
            </View>
            
            <View style={styles.buttonGrid}>
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#f59e0b' }]}
                onPress={uploadPdfForSigning}
                disabled={loading}
              >
                <Feather name="upload" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Upload & Sign PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: theme.primaryButton }]}
                onPress={getBaseUris}
                disabled={loading}
              >
                <Feather name="globe" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Get Base URIs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#10b981' }]}
                onPress={createTestAgreement}
                disabled={loading}
              >
                <Feather name="plus" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Create Agreement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#3b82f6' }]}
                onPress={getAgreements}
                disabled={loading}
              >
                <Feather name="list" size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Get Agreements</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Agreements List */}
          {agreements.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={24} color={theme.primaryButton} />
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Agreements ({agreements.length})</Text>
              </View>
              
              {agreements.map(renderAgreementCard)}
            </View>
          )}

          {/* Loading Overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={[styles.loadingContainer, { backgroundColor: theme.cardBackground }]}>
                <ActivityIndicator size="large" color={theme.primaryButton} />
                <Text style={[styles.loadingText, { color: theme.primaryText }]}>Processing...</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Configuration Modal */}
      <Modal
        visible={showConfigModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.primaryBackground }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
            <TouchableOpacity onPress={() => setShowConfigModal(false)}>
              <Text style={[styles.modalCancel, { color: theme.primaryButton }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>API Configuration</Text>
            <TouchableOpacity onPress={saveConfiguration}>
              <Text style={[styles.modalSave, { color: theme.primaryButton }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Client ID</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={config.clientId}
                onChangeText={(text) => setConfig(prev => ({ ...prev, clientId: text }))}
                placeholder="Enter your Adobe Sign Client ID"
                placeholderTextColor={theme.secondaryText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Client Secret</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={config.clientSecret}
                onChangeText={(text) => setConfig(prev => ({ ...prev, clientSecret: text }))}
                placeholder="Enter your Adobe Sign Client Secret"
                placeholderTextColor={theme.secondaryText}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Access Token</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={config.accessToken}
                onChangeText={(text) => setConfig(prev => ({ ...prev, accessToken: text }))}
                placeholder="Enter your Adobe Sign Access Token"
                placeholderTextColor={theme.secondaryText}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Base URL</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, color: theme.primaryText, borderColor: theme.borderColor }]}
                value={config.baseUrl}
                onChangeText={(text) => setConfig(prev => ({ ...prev, baseUrl: text }))}
                placeholder="Enter the Adobe Sign API base URL"
                placeholderTextColor={theme.secondaryText}
              />
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}>
              <Feather name="info" size={20} color={theme.primaryButton} />
              <Text style={[styles.infoText, { color: theme.secondaryText }]}>
                To get your credentials, visit the Adobe Sign API page in your account settings and generate API credentials.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  section: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  sectionDescription: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  configButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    minWidth: 140,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  agreementCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  agreementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agreementName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  agreementId: {
    fontSize: 14,
    marginBottom: 4,
  },
  agreementDate: {
    fontSize: 14,
    marginBottom: 12,
  },
  participantsContainer: {
    marginBottom: 16,
  },
  participantsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  participantEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  agreementActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  userStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  userStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  userId: {
    fontSize: 12,
    marginBottom: 4,
  },
  userDate: {
    fontSize: 12,
    marginBottom: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
