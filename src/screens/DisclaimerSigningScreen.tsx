import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface RouteParams {
  opportunityId: string;
}

export default function DisclaimerSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  // Fallback theme if theme is undefined
  const safeTheme = theme || {
    primaryBackground: '#f8f9fa',
    secondaryBackground: '#ffffff',
    tertiaryBackground: '#e9ecef',
    primaryText: '#212529',
    secondaryText: '#495057',
    tertiaryText: '#6c757d',
    cardBackground: '#ffffff',
    cardBorder: '#e9ecef',
    inputBackground: '#ffffff',
    primaryButton: '#10b981',
    secondaryButton: '#059669',
    dangerButton: '#dc3545',
    successButton: '#28a745',
    activeStatus: '#51cf66',
    inactiveStatus: '#ff922b',
    suspendedStatus: '#dc3545',
    progressBackground: '#e9ecef',
    progressFill: '#51cf66',
    shadowColor: '#000000',
    borderColor: '#dee2e6',
    dividerColor: '#e9ecef',
  };
  
  // Step flow: loading -> confirmation -> sending -> verification -> status
  const [step, setStep] = useState<'loading' | 'confirmation' | 'sending' | 'verification' | 'status'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // ScrollView ref for consistent scrolling behavior
  const scrollViewRef = useRef<ScrollView>(null);
  
  // DocuSeal state
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [embeddedFormUrl, setEmbeddedFormUrl] = useState<string | null>(null);
  const [formBuilderToken, setFormBuilderToken] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<'pending' | 'sent' | 'opened' | 'completed' | 'declined'>('pending');
  
  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(true);
  const [sendPhase, setSendPhase] = useState<'creating_template' | 'sending_submission'>('creating_template');
  
  // Customer details state
  const [customerName, setCustomerName] = useState<string>('Disclaimer Signer');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [overrideCustomerEmail, setOverrideCustomerEmail] = useState<string>('');

  const normalizeDocusealUrl = (url?: string | null): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Handle malformed values returned by backend like "https:/.docuseal.eu/..."
    if (trimmed.startsWith('https:/.')) {
      return trimmed.replace('https:/.', 'https://');
    }
    if (trimmed.startsWith('http:/.')) {
      return trimmed.replace('http:/.', 'http://');
    }
    return trimmed;
  };

  useEffect(() => {
    // Load customer details and show confirmation screen
    loadCustomerDetails();
  }, []);

  // Auto-poll status every 5 seconds when on status step
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (step === 'status' && signingStatus !== 'completed' && signingStatus !== 'declined') {
      console.log('🔄 Starting status polling for disclaimer...');
      
      // Initial check after 3 seconds
      const initialTimeout = setTimeout(() => {
        checkSigningStatus();
      }, 3000);
      
      // Then poll every 5 seconds
      pollInterval = setInterval(async () => {
        console.log('🔄 Polling disclaimer status...');
        await checkSigningStatus();
      }, 5000);
      
      return () => {
        console.log('🛑 Stopping disclaimer status polling');
        clearTimeout(initialTimeout);
        if (pollInterval) clearInterval(pollInterval);
      };
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [step, signingStatus, submissionId, opportunityId]);

  // Refresh functionality
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (step === 'status' && submissionId) {
      checkSigningStatus(submissionId).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [step, submissionId]);

  // Load customer details and show confirmation screen
  const loadCustomerDetails = async () => {
    try {
      setIsLoadingCustomerDetails(true);
      console.log('🔍 DisclaimerSigningScreen: Loading customer details for opportunityId:', opportunityId);
      
      let extractedCustomerName = 'Disclaimer Signer';
      let extractedEmail = '';
      
      if (opportunityId) {
        const { api } = await import('../utils/api');
        
        // Try to get customer details from customer-details endpoint first
        try {
          const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
          if (customerResponse.success && customerResponse.data) {
            const customerData = customerResponse.data as any;
            extractedEmail = customerData.email || customerData.contactEmail || '';
            let extractedName = customerData.name || 'Disclaimer Signer';
            
            // If name contains "POSTCODE, NAME" format, extract just the name
            if (extractedName && extractedName.includes(', ')) {
              const nameParts = extractedName.split(', ');
              if (nameParts.length >= 2) {
                extractedName = nameParts[1].trim();
              }
            }
            
            extractedCustomerName = extractedName;
            
            console.log('✅ Customer details loaded from customer-details endpoint:', { 
              name: extractedCustomerName, 
              email: extractedEmail,
              rawData: customerData
            });
            
            setCustomerName(extractedCustomerName);
            setCustomerEmail(extractedEmail);
            // Initialize override field with loaded email value
            setOverrideCustomerEmail(extractedEmail);
            setIsLoadingCustomerDetails(false);
            setStep('confirmation');
            return;
          }
        } catch (customerError) {
          console.log('⚠️ Customer details endpoint failed, falling back to opportunity data', customerError);
        }
        
        // Fallback to opportunity data
        console.log('🌐 Making API call to:', `/opportunities/${opportunityId}`);
        const response = await api.get(`/opportunities/${opportunityId}`);
        console.log('📡 API Response:', response.data);
        
        if ((response.data as any)?.success && (response.data as any)?.data) {
          const opportunity = (response.data as any).data;
          
          // Parse the name field which contains "N12 9JA, Lisa Jones" format
          if (opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              extractedCustomerName = nameParts[1].trim();
            } else if (nameParts.length === 1) {
              extractedCustomerName = nameParts[0].trim();
            }
          }
          
          // Extract email if available - check both email and contactEmail
          extractedEmail = opportunity.email || opportunity.contactEmail || '';
        } else {
          // Fallback parsing
          const opportunity = response.data as any;
          if (opportunity && opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              extractedCustomerName = nameParts[1].trim();
            } else if (nameParts.length === 1) {
              extractedCustomerName = nameParts[0].trim();
            }
          }
          // Check both email and contactEmail fields
          extractedEmail = opportunity?.email || opportunity?.contactEmail || '';
        }
      }
      
      setCustomerName(extractedCustomerName);
      setCustomerEmail(extractedEmail);
      // Initialize override field with loaded email value
      setOverrideCustomerEmail(extractedEmail);
      console.log('✅ Customer name extracted:', extractedCustomerName);
      console.log('✅ Customer email extracted:', extractedEmail);
      setIsLoadingCustomerDetails(false);
      setStep('confirmation');
    } catch (error) {
      console.error('❌ Error loading customer details:', error);
      setError('Failed to load customer details');
      setIsLoadingCustomerDetails(false);
    }
  };

  // Handle creating disclaimer template from confirmation screen
  const handleCreateDisclaimerTemplate = async () => {
    // Use override email if provided, otherwise use loaded value
    const finalCustomerEmail = overrideCustomerEmail.trim() || customerEmail;

    if (!finalCustomerEmail) {
      Alert.alert('Error', 'Customer email is required. Please enter an email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalCustomerEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    await createDisclaimerTemplate(customerName, finalCustomerEmail);
  };

  // Step 1: Create disclaimer template for verification
  const createDisclaimerTemplate = async (name: string, email: string) => {
    if (isSending) return;

    setIsSending(true);
    setSendPhase('creating_template');
    setError(null);
    setStep('sending');

    try {
      const { api } = await import('../utils/api');
      
      console.log('🔍 Creating DocuSeal disclaimer template...');
      
      // Prepare request body for template creation/verification
      const requestBody = {
        opportunityId,
        customerName: name,
        installerName: 'Creativ Energy'
      };
      
      console.log('🔍 Calling route: /docuseal/disclaimer/template');
      console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await api.post('/docuseal/disclaimer/template', requestBody);
      const responseData = response.data as any;

      if (responseData.success) {
        console.log('✅ DocuSeal disclaimer template created:', responseData.data);
        
        const data = responseData.data || responseData;
        const receivedTemplateId = data.templateId || data.id || data.template_id;
        const receivedPreviewUrl = data.previewUrl || data.preview_url;
        const receivedEmbeddedFormUrl = data.embeddedFormUrl || data.embedded_form_url;
        const receivedFormBuilderToken = data.formBuilderToken || data.form_builder_token;
        
        if (receivedTemplateId) setTemplateId(receivedTemplateId);
        const normalizedPreviewUrl = normalizeDocusealUrl(receivedPreviewUrl);
        const normalizedEmbeddedFormUrl = normalizeDocusealUrl(receivedEmbeddedFormUrl);

        if (normalizedPreviewUrl) setPreviewUrl(normalizedPreviewUrl);
        if (normalizedEmbeddedFormUrl) setEmbeddedFormUrl(normalizedEmbeddedFormUrl);
        if (receivedFormBuilderToken) setFormBuilderToken(receivedFormBuilderToken);

        // Move to verification step so surveyor can review template first
        setStep('verification');
      } else {
        throw new Error(responseData.error || 'Failed to create disclaimer template');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal disclaimer template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create disclaimer template';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Step 2: Create submission from verified template and send to customer
  const handleSendFromVerifiedTemplate = async () => {
    if (!templateId || isSending) return;

    const finalCustomerEmail = overrideCustomerEmail.trim() || customerEmail;
    if (!finalCustomerEmail) {
      Alert.alert('Error', 'Customer email is required. Please enter an email address.');
      return;
    }

    setIsSending(true);
    setSendPhase('sending_submission');
    setError(null);
    setStep('sending');

    try {
      const { api } = await import('../utils/api');
      const requestBody = {
        opportunityId,
        customerData: {
          name: customerName,
          email: finalCustomerEmail,
        },
        customerName,
        installerName: 'Creativ Energy',
      };

      console.log('🔍 Calling route:', `/docuseal/template/${templateId}/submit`);
      const response = await api.post(`/docuseal/template/${templateId}/submit`, requestBody);
      const responseData = response.data as any;

      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to send disclaimer from template');
      }

      const data = responseData.data || responseData;
      const receivedSubmissionId = data.submissionId || data.submission_id;
      const receivedSigningUrl = data.signingUrl || data.signing_url;

      if (receivedSubmissionId) setSubmissionId(receivedSubmissionId);
      if (receivedSigningUrl) setSigningUrl(receivedSigningUrl);

      setSigningStatus('sent');
      setStep('status');

      if (receivedSubmissionId && receivedSubmissionId !== 'unknown') {
        setTimeout(() => checkSigningStatus(receivedSubmissionId), 2000);
      }
    } catch (error) {
      console.error('🔍 Error sending disclaimer from verified template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send disclaimer';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      setStep('verification');
    } finally {
      setIsSending(false);
    }
  };

  // Check signing status
  const checkSigningStatus = async (submissionIdToCheck?: string) => {
    const idToCheck = submissionIdToCheck || submissionId;
    
    setIsCheckingStatus(true);
    try {
      const { api } = await import('../utils/api');
      
      if (idToCheck && idToCheck !== 'unknown') {
        console.log('🔍 Refreshing status for submissionId:', idToCheck);
        const response = await api.get(`/docuseal/submissions/${idToCheck}/refresh-status`);
        
        if (response.success && response.data) {
          const statusData = (response.data as any).data || response.data;
          console.log('📊 Status data:', statusData);
          updateStatusFromResponse(statusData);
        }
      } else {
        console.log('🔍 Checking status by opportunityId:', opportunityId);
        const response = await api.get(`/docuseal/submissions/opportunity/${opportunityId}`);
        
        if (response.success && response.data) {
          const submissionsData = response.data as any;
          const disclaimerSubmission = submissionsData.disclaimer;
          
          if (disclaimerSubmission) {
            updateStatusFromResponse(disclaimerSubmission);
          }
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Helper function to get the correct disclaimer step number
  const getDisclaimerStepNumber = async (): Promise<number> => {
    try {
      const { workflowApi } = await import('../utils/api');
      const progressResponse = await workflowApi.getOpportunityProgress(opportunityId);
      if (progressResponse && progressResponse.success && progressResponse.data && progressResponse.data.steps) {
        const disclaimerStep = progressResponse.data.steps.find((s: any) => s.stepType === 'DISCLAIMER_SIGNING');
        if (disclaimerStep && disclaimerStep.stepNumber) {
          console.log('🔍 Found DISCLAIMER_SIGNING step number:', disclaimerStep.stepNumber);
          return disclaimerStep.stepNumber;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch workflow progress for disclaimer step number:', error);
    }
    // Default fallback - disclaimer is typically step 8
    return 8;
  };

  // Update status from response
  const updateStatusFromResponse = (statusData: any) => {
    const status = statusData.status?.toLowerCase() || statusData.submitters?.[0]?.status?.toLowerCase();
    
    if (status === 'completed') {
      setSigningStatus('completed');
      // Stay on status screen - don't navigate to complete step
      // Step will be marked as complete when user clicks "Next" button
    } else if (status === 'opened') {
      setSigningStatus('opened');
    } else if (status === 'declined') {
      setSigningStatus('declined');
    } else if (status === 'sent' || status === 'pending') {
      setSigningStatus('sent');
    }
  };

  // Open signing URL
  const handleOpenSigningUrl = () => {
    if (signingUrl) {
      Linking.openURL(signingUrl);
    }
  };


  const renderLoadingStep = () => (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: safeTheme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
        <View style={[styles.header, { backgroundColor: safeTheme.cardBackground, borderBottomColor: safeTheme.cardBorder }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => navigation.goBack()}
              >
                <Feather name="arrow-left" size={20} color={safeTheme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: safeTheme.primaryText }]}>
                  Loading Disclaimer
                </Text>
                <Text style={[styles.headerSubtitle, { color: safeTheme.secondaryText }]}>
                  Preparing disclaimer document
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
                onPress={toggleTheme}
              >
                <Feather 
                  name={isDark ? "sun" : "moon"} 
                  size={20} 
                  color={safeTheme.secondaryText} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={[styles.stepContainer, { backgroundColor: safeTheme.primaryBackground }]}>
          {error ? (
            <>
              <Ionicons name="alert-circle" size={60} color="#f44336" />
              <Text style={[styles.stepTitle, { color: safeTheme.primaryText }]}>
                Error
              </Text>
              <Text style={[styles.stepDescription, { color: safeTheme.secondaryText }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.completeButton, { backgroundColor: '#4CAF50', marginTop: 20 }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.completeButtonText}>Go Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={[styles.stepTitle, { color: safeTheme.primaryText }]}>
                Loading...
              </Text>
              <Text style={[styles.stepDescription, { color: safeTheme.secondaryText }]}>
                Loading customer details
              </Text>
            </>
          )}
        </View>
    </SafeAreaView>
  );

  const renderConfirmationStep = () => (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: safeTheme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      <View style={[styles.header, { backgroundColor: safeTheme.cardBackground, borderBottomColor: safeTheme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={safeTheme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: safeTheme.primaryText }]}>
                Send Disclaimer
              </Text>
              <Text style={[styles.headerSubtitle, { color: safeTheme.secondaryText }]}>
                Confirm customer details before template verification
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather 
                name={isDark ? "sun" : "moon"} 
                size={20} 
                color={safeTheme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={[
          styles.scrollView,
          { backgroundColor: safeTheme.primaryBackground },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        contentContainerStyle={[
          { padding: 20, paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        <View style={[styles.card, { backgroundColor: safeTheme.cardBackground }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={32} color="#4CAF50" />
            <Text style={[styles.cardTitle, { color: safeTheme.primaryText }]}>
              Customer Information
            </Text>
          </View>

          <View style={[styles.customerInfo, { backgroundColor: safeTheme.tertiaryBackground }]}>
            <Text style={[styles.customerInfoTitle, { color: safeTheme.primaryText }]}>
              Customer Name:
            </Text>
            <Text style={[styles.customerInfoText, { color: safeTheme.secondaryText }]}>
              {customerName}
            </Text>
          </View>

          {/* Email Input Section */}
          <View style={[styles.contractInfo, { backgroundColor: safeTheme.tertiaryBackground, borderColor: safeTheme.cardBorder, marginTop: 15 }]}>
            <Text style={[styles.inputLabel, { color: safeTheme.secondaryText }]}>CUSTOMER EMAIL:</Text>
            <TextInput
              style={[styles.inputField, { 
                backgroundColor: safeTheme.inputBackground, 
                color: safeTheme.primaryText,
                borderColor: safeTheme.cardBorder
              }]}
              value={overrideCustomerEmail}
              onChangeText={setOverrideCustomerEmail}
              placeholder="Enter email address"
              placeholderTextColor={safeTheme.tertiaryText}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isSending}
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.completeButton, 
              { backgroundColor: '#4CAF50', marginTop: 20 },
              (!overrideCustomerEmail.trim()) && { opacity: 0.6 }
            ]}
            onPress={handleCreateDisclaimerTemplate}
            disabled={isSending || !overrideCustomerEmail.trim()}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send-outline" size={24} color="white" />
            )}
            <Text style={[styles.completeButtonText, { marginLeft: 8 }]}>
              {isSending ? 'Preparing...' : 'Create & Verify Disclaimer Template'}
            </Text>
          </TouchableOpacity>

          {/* Info Message */}
          <View style={[styles.infoMessage, { backgroundColor: safeTheme.tertiaryBackground, marginTop: 15 }]}>
            <Ionicons name="information-circle-outline" size={16} color={safeTheme.secondaryText} />
            <Text style={[styles.infoText, { color: safeTheme.secondaryText }]}>
              You will verify the disclaimer template first, then send it to the customer for signing.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderSendingStep = () => (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: safeTheme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
        <View style={[styles.header, { backgroundColor: safeTheme.cardBackground, borderBottomColor: safeTheme.cardBorder }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => navigation.goBack()}
              >
                <Feather name="arrow-left" size={20} color={safeTheme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: safeTheme.primaryText }]}>
                  Disclaimer Workflow
                </Text>
                <Text style={[styles.headerSubtitle, { color: safeTheme.secondaryText }]}>
                  {sendPhase === 'creating_template' ? 'Creating template for verification' : 'Sending verified template to customer'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
                onPress={toggleTheme}
              >
                <Feather 
                  name={isDark ? "sun" : "moon"} 
                  size={20} 
                  color={safeTheme.secondaryText} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
            
        <View style={[styles.stepContainer, { backgroundColor: safeTheme.primaryBackground }]}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={[styles.stepTitle, { color: safeTheme.primaryText }]}>
            {sendPhase === 'creating_template' ? 'Creating Template...' : 'Sending Disclaimer...'}
          </Text>
          <Text style={[styles.stepDescription, { color: safeTheme.secondaryText }]}>
            {sendPhase === 'creating_template'
              ? 'Preparing DocuSeal template so you can verify fields before sending'
              : 'Creating the DocuSeal submission and sending to customer'}
          </Text>
        </View>
    </SafeAreaView>
  );

  const renderVerificationStep = () => (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: safeTheme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      <View style={[styles.header, { backgroundColor: safeTheme.cardBackground, borderBottomColor: safeTheme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => setStep('confirmation')}
            >
              <Feather name="arrow-left" size={20} color={safeTheme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: safeTheme.primaryText }]}>
                Verify Disclaimer Template
              </Text>
              <Text style={[styles.headerSubtitle, { color: safeTheme.secondaryText }]}>
                Review template before sending to customer
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.card, { backgroundColor: safeTheme.cardBackground }]}>
          <Text style={[styles.cardDescription, { color: safeTheme.secondaryText, marginBottom: 12 }]}>
            Confirm field positions, then send the verified template to {overrideCustomerEmail || customerEmail}.
          </Text>
          {formBuilderToken && (
            <View style={[styles.infoMessage, { backgroundColor: safeTheme.tertiaryBackground, marginBottom: 12 }]}>
              <Ionicons name="construct-outline" size={16} color={safeTheme.secondaryText} />
              <Text style={[styles.infoText, { color: safeTheme.secondaryText }]}>
                Builder token received from backend; preview is ready for verification.
              </Text>
            </View>
          )}

          {Platform.OS === 'web' && previewUrl ? (
            <View style={{ width: '100%', minHeight: 520, marginBottom: 16 }}>
              <iframe
                src={normalizeDocusealUrl(previewUrl) || previewUrl}
                style={{
                  width: '100%',
                  height: 520,
                  border: `1px solid ${safeTheme.cardBorder}`,
                  borderRadius: 8,
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                }}
                title="Disclaimer Template Preview"
              />
            </View>
          ) : (
            <View style={[styles.infoMessage, { backgroundColor: safeTheme.tertiaryBackground, marginBottom: 16 }]}>
              <Ionicons name="information-circle-outline" size={16} color={safeTheme.secondaryText} />
              <Text style={[styles.infoText, { color: safeTheme.secondaryText }]}>
                Template preview is available via external link on this device.
              </Text>
            </View>
          )}

          {(previewUrl || embeddedFormUrl) && (
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
              onPress={() => {
                const resolvedUrl = normalizeDocusealUrl(previewUrl || embeddedFormUrl);
                if (resolvedUrl) {
                  Linking.openURL(resolvedUrl);
                }
              }}
            >
              <Ionicons name="open-outline" size={20} color={safeTheme.primaryText} />
              <Text style={[styles.refreshButtonText, { color: safeTheme.primaryText }]}>
                Open Full Template Preview
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: '#4CAF50', marginTop: 12 }]}
            onPress={handleSendFromVerifiedTemplate}
            disabled={isSending || !templateId}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send-outline" size={24} color="white" />
            )}
            <Text style={[styles.completeButtonText, { marginLeft: 8 }]}>
              {isSending ? 'Sending...' : 'Send Verified Template'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderStatusStep = () => {
    const getStatusColor = () => {
      switch (signingStatus) {
        case 'completed': return '#4CAF50';
        case 'opened': return '#2196F3';
        case 'declined': return '#f44336';
        default: return '#FF9800';
      }
    };

    const getStatusIcon = () => {
      switch (signingStatus) {
        case 'completed': return 'checkmark-circle';
        case 'opened': return 'eye';
        case 'declined': return 'close-circle';
        default: return 'time';
      }
    };

    const getStatusText = () => {
      switch (signingStatus) {
        case 'completed': return 'Signed';
        case 'opened': return 'Opened';
        case 'declined': return 'Declined';
        default: return 'Pending';
      }
    };

    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: safeTheme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        }
      ]}>
        <View style={[styles.header, { backgroundColor: safeTheme.cardBackground, borderBottomColor: safeTheme.cardBorder }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => navigation.goBack()}
              >
                <Feather name="arrow-left" size={20} color={safeTheme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: safeTheme.primaryText }]}>
                  Disclaimer Status
                </Text>
                <Text style={[styles.headerSubtitle, { color: safeTheme.secondaryText }]}>
                  Waiting for customer signature
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
                onPress={toggleTheme}
              >
                <Feather 
                  name={isDark ? "sun" : "moon"} 
                  size={20} 
                  color={safeTheme.secondaryText} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={[
            styles.scrollView,
            { backgroundColor: safeTheme.primaryBackground },
            Platform.OS === 'web' && {
              height: '100%',
              maxHeight: '100%',
            }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeTheme.primaryButton} />
          }
          showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
          contentContainerStyle={[
            { paddingBottom: 40 },
            Platform.OS === 'web' && {
              minHeight: '100vh' as any,
              paddingBottom: 100,
            }
          ]}
        >
          <View style={styles.content}>
            <View style={[styles.card, { backgroundColor: safeTheme.cardBackground }]}>
              <View style={styles.cardHeader}>
                <Ionicons name={getStatusIcon()} size={32} color={getStatusColor()} />
                <Text style={[styles.cardTitle, { color: safeTheme.primaryText }]}>
                  {getStatusText()}
                </Text>
              </View>
              
              <Text style={[styles.cardDescription, { color: safeTheme.secondaryText }]}>
                {signingStatus === 'completed' 
                  ? 'The disclaimer has been signed successfully!'
                  : signingStatus === 'opened'
                  ? 'The customer has opened the document and is reviewing it.'
                  : signingStatus === 'declined'
                  ? 'The customer has declined to sign the disclaimer.'
                  : 'The disclaimer has been sent to the customer. Waiting for them to sign.'}
              </Text>

              <View style={styles.customerInfo}>
                <Text style={[styles.customerInfoTitle, { color: safeTheme.primaryText }]}>
                  Document Details:
                </Text>
                <Text style={[styles.customerInfoText, { color: safeTheme.secondaryText }]}>
                  Customer: {customerName}
                </Text>
                <Text style={[styles.customerInfoText, { color: safeTheme.secondaryText }]}>
                  Email: {customerEmail}
                </Text>
                {submissionId && (
                  <Text style={[styles.customerInfoText, { color: safeTheme.secondaryText }]}>
                    Submission ID: {submissionId}
                  </Text>
                )}
              </View>

              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20', borderColor: getStatusColor() }]}>
                <Ionicons name={getStatusIcon()} size={20} color={getStatusColor()} />
                <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                  Status: {getStatusText()}
                </Text>
              </View>

              {/* Refresh Status Button */}
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => checkSigningStatus()}
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <ActivityIndicator color={safeTheme.primaryText} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color={safeTheme.primaryText} />
                    <Text style={[styles.refreshButtonText, { color: safeTheme.primaryText }]}>
                      Refresh Status
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Open Signing Link Button */}
              {signingUrl && signingStatus !== 'completed' && (
                <TouchableOpacity
                  style={[styles.signButton, { backgroundColor: '#2196F3' }]}
                  onPress={handleOpenSigningUrl}
                >
                  <Ionicons name="open-outline" size={24} color="white" />
                  <Text style={styles.signButtonText}>Open Signing Link</Text>
                </TouchableOpacity>
              )}

              {signingStatus === 'completed' && (
                <TouchableOpacity
                  style={[styles.signButton, { backgroundColor: '#4CAF50' }]}
                  onPress={async () => {
                    try {
                      console.log('🔍 Disclaimer completed, marking step as complete and navigating...');
                      
                      // Get the correct step number for disclaimer
                      const { workflowApi } = await import('../utils/api');
                      const disclaimerStepNumber = await getDisclaimerStepNumber();
                      
                      // Mark disclaimer step as completed
                      await workflowApi.completeStep(opportunityId, disclaimerStepNumber, {
                        submissionId: submissionId,
                        signedAt: new Date().toISOString(),
                        status: 'completed'
                      });
                      
                      console.log('✅ Disclaimer step marked as complete, navigating to ContractSigning...');
                      
                      // Navigate to Contract Signing (which includes email confirmation)
                      navigation.navigate('ContractSigning', { opportunityId });
                    } catch (error) {
                      console.error('❌ Error completing disclaimer step:', error);
                      // Still navigate even if step completion fails
                      navigation.navigate('ContractSigning', { opportunityId });
                    }
                  }}
                >
                  <Ionicons name="arrow-forward" size={24} color="white" />
                  <Text style={styles.signButtonText}>Next: Contract and Email Confirmation</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.signatureNote, { color: safeTheme.secondaryText }]}>
                ✨ Status updates automatically every 5 seconds. The customer will receive an email notification when they need to sign.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Render appropriate step
  switch (step) {
    case 'loading':
      return renderLoadingStep();
    case 'confirmation':
      return renderConfirmationStep();
    case 'sending':
      return renderSendingStep();
    case 'verification':
      return renderVerificationStep();
    case 'status':
      return renderStatusStep();
    default:
      return renderLoadingStep();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formCard: {
    borderRadius: 12,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  cardDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  customerInfo: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  customerInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  customerInfoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
  },
  signButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  highlightedSection: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  acknowledgmentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  inlineInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 16,
    minWidth: 80,
    textAlign: 'center',
    marginRight: 8,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
  },
  radioGroup: {
    marginBottom: 15,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  radioText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  templateInfo: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
  },
  templateInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  templateInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 15,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  customerEmailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
    marginTop: 10,
  },
  customerEmailText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
    marginTop: 10,
  },
  warningText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  emailInputContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  emailInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contractInfo: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
    marginTop: 8,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});