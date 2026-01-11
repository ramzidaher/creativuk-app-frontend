import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';

interface RouteParams {
  opportunityId: string;
}

export default function EmailConfirmationSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [step, setStep] = useState<'loading' | 'signing' | 'status'>('loading');
  const [error, setError] = useState<string | null>(null);
  
  // Customer details state
  const [customerName, setCustomerName] = useState<string>('Booking Confirmation Signer');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(true);
  
  // Override field for email editing only
  const [overrideCustomerEmail, setOverrideCustomerEmail] = useState<string>('');
  
  // Signing status state
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<'pending' | 'sent' | 'opened' | 'completed' | 'awaiting' | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [signerInfo, setSignerInfo] = useState<any>(null);

  useEffect(() => {
    loadCustomerDetails();
  }, []);

  // Load customer details from opportunity data
  const loadCustomerDetails = async () => {
    try {
      setIsLoadingCustomerDetails(true);
      console.log('🔍 EmailConfirmationSigningScreen: Loading customer details for opportunityId:', opportunityId);
      
      if (opportunityId) {
        const { api } = await import('../utils/api');
        
        // Try to get customer details from customer-details endpoint first
        try {
          const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
          if (customerResponse.success && customerResponse.data) {
            const customerData = customerResponse.data as any;
            const extractedEmail = customerData.email || customerData.contactEmail || '';
            let extractedName = customerData.name || 'Booking Confirmation Signer';
            
            // If name contains "POSTCODE, NAME" format, extract just the name
            if (extractedName && extractedName.includes(', ')) {
              const nameParts = extractedName.split(', ');
              if (nameParts.length >= 2) {
                extractedName = nameParts[1].trim();
              }
            }
            
            setCustomerName(extractedName);
            setCustomerEmail(extractedEmail);
            // Initialize override field with loaded email value
            setOverrideCustomerEmail(extractedEmail);
            
            console.log('✅ Customer details loaded:', { 
              name: extractedName, 
              email: extractedEmail,
              rawData: customerData
            });
            setIsLoadingCustomerDetails(false);
            setStep('signing');
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
          let extractedCustomerName = 'Booking Confirmation Signer';
          
          if (opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              extractedCustomerName = nameParts[1].trim();
            } else if (nameParts.length === 1) {
              extractedCustomerName = nameParts[0].trim();
            }
          }
          
          setCustomerName(extractedCustomerName);
          setCustomerEmail(opportunity.contactEmail || '');
          // Initialize override field with loaded email value
          setOverrideCustomerEmail(opportunity.contactEmail || '');
          console.log('✅ Customer details extracted from opportunity:', { 
            name: extractedCustomerName, 
            email: opportunity.contactEmail
          });
        } else {
          // Fallback parsing
          const opportunity = response.data as any;
          if (opportunity && opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              const name = nameParts[1].trim();
              setCustomerName(name);
            } else if (nameParts.length === 1) {
              const name = nameParts[0].trim();
              setCustomerName(name);
            }
          }
          if (opportunity) {
            const email = opportunity.contactEmail || '';
            setCustomerEmail(email);
            setOverrideCustomerEmail(email);
          }
        }
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      // Keep default customer name
    } finally {
      setIsLoadingCustomerDetails(false);
      setStep('signing');
    }
  };

  // DocuSeal booking confirmation workflow handler
  const handleCreateBookingConfirmationWorkflow = async () => {
    // Prevent multiple clicks - disable immediately
    if (isCreatingWorkflow) {
      return;
    }

    // Use override email if provided, otherwise use loaded value
    const finalCustomerEmail = overrideCustomerEmail.trim() || customerEmail;

    if (!finalCustomerEmail) {
      Alert.alert('Error', 'Customer email is required. Please enter an email address.');
      return;
    }

    // Set loading state immediately to prevent double clicks
    setIsCreatingWorkflow(true);
    setError(null);

    try {
      // Import API once at the start
      const { api } = await import('../utils/api');
      
      console.log('🔍 Creating DocuSeal booking confirmation workflow...');
      
      // Use the new /docuseal/booking-confirmation endpoint
      const bookingConfirmationResponse = await api.post('/docuseal/booking-confirmation', {
        opportunityId,
        customerData: {
          name: customerName,
          email: finalCustomerEmail
        }
      });

      const responseData = bookingConfirmationResponse.data as any;

      if (responseData.success) {
        console.log('✅ DocuSeal booking confirmation workflow created:', responseData.data);
        console.log('📋 Full response data:', JSON.stringify(responseData, null, 2));
        
        // Store submission ID from response
        const data = responseData.data || responseData;
        const receivedSubmissionId = data.submissionId || data.id || data.submission_id;
        
        console.log('🔍 SubmissionId from response:', receivedSubmissionId);
        
        // Always go to status screen after sending (document is sent via email)
        if (receivedSubmissionId) {
          setSubmissionId(receivedSubmissionId);
        }
        setSigningStatus('sent');
        setStep('status');
        
        // Start checking status if we have a valid submission ID
        if (receivedSubmissionId && receivedSubmissionId !== 'unknown') {
          setTimeout(() => {
            checkSigningStatus(receivedSubmissionId);
          }, 1000);
        }
      } else {
        throw new Error(responseData.error || 'Failed to create DocuSeal booking confirmation workflow');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal booking confirmation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create DocuSeal booking confirmation. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  // Check signing status - uses new endpoint that syncs with DocuSeal
  const checkSigningStatus = async (submissionIdToCheck?: string) => {
    const idToCheck = submissionIdToCheck || submissionId;
    
    setIsCheckingStatus(true);
    try {
      const { api } = await import('../utils/api');
      
      // If we have a valid submissionId, use the refresh endpoint
      if (idToCheck && idToCheck !== 'unknown') {
        console.log('🔍 Refreshing status for submissionId:', idToCheck);
        const response = await api.get(`/docuseal/submissions/${idToCheck}/refresh-status`);
        
        if (response.success && response.data) {
          // The response.data might be the entire response object or just the data
          // Handle both cases: response.data.data or response.data
          const statusData = (response.data as any).data || response.data;
          console.log('📊 Status data extracted:', statusData);
          updateStatusFromResponse(statusData);
        }
      } else {
        // If no submissionId, use opportunity endpoint which auto-syncs
        console.log('🔍 Checking status by opportunityId:', opportunityId);
        const response = await api.get(`/docuseal/submissions/opportunity/${opportunityId}`);
        
        if (response.success && response.data) {
          // Response structure: { contract: {...}, disclaimer: {...}, booking-confirmation: {...} }
          const submissionsData = response.data as any;
          
          // Get booking confirmation submission (key is 'booking-confirmation' or 'bookingConfirmation')
          const bookingConfirmationSubmission = submissionsData['booking-confirmation'] || submissionsData.bookingConfirmation;
          
          if (bookingConfirmationSubmission) {
            console.log('✅ Found booking confirmation submission:', bookingConfirmationSubmission);
            // Update submissionId if we found one
            if (bookingConfirmationSubmission.submissionId && !submissionId) {
              setSubmissionId(bookingConfirmationSubmission.submissionId);
            }
            updateStatusFromResponse(bookingConfirmationSubmission);
          } else {
            console.log('⚠️ No booking confirmation submission found in response:', submissionsData);
          }
        }
      }
    } catch (error) {
      console.error('Error checking signing status:', error);
      // Don't show error to user, just log it
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Helper function to update status from API response
  const updateStatusFromResponse = (statusData: any) => {
    console.log('📊 Updating status from response:', JSON.stringify(statusData, null, 2));
    
    // Handle status values: "pending", "completed", "declined", "expired"
    let currentStatus: 'awaiting' | 'sent' | 'opened' | 'completed' | null = null;
    
    // Check overall submission status - handle both direct status and nested data
    const actualStatus = statusData.status || (statusData.data && statusData.data.status);
    if (actualStatus) {
      // Map API status to our status values
      const apiStatus = actualStatus.toLowerCase();
      console.log('📊 API Status:', apiStatus);
      
      if (apiStatus === 'completed') {
        currentStatus = 'completed';
      } else if (apiStatus === 'pending') {
        currentStatus = 'sent'; // Map pending to 'sent' for display
      } else if (apiStatus === 'declined') {
        currentStatus = 'sent'; // Map declined to 'sent' for display
      } else if (apiStatus === 'expired') {
        currentStatus = 'sent'; // Map expired to 'sent' for display
      }
    } else {
      console.log('⚠️ No status found in response. Available keys:', Object.keys(statusData));
    }
    
    // Update submissionId if available (check both direct and nested)
    const actualSubmissionId = statusData.submissionId || (statusData.data && statusData.data.submissionId);
    if (actualSubmissionId && !submissionId) {
      setSubmissionId(actualSubmissionId);
    }
    
    // Extract signer info if available (from refresh-status endpoint)
    const submitters = statusData.submitters || (statusData.data && statusData.data.submitters);
    if (submitters && Array.isArray(submitters) && submitters.length > 0) {
      const customerEmailToCheck = overrideCustomerEmail.trim() || customerEmail;
      const customerSigner = submitters.find((s: any) => 
        s.email && s.email.toLowerCase() === customerEmailToCheck.toLowerCase()
      ) || submitters[0];
      
      setSignerInfo(customerSigner);
      
      // Use signer status if available (more specific)
      if (customerSigner.status) {
        const signerStatus = customerSigner.status.toLowerCase();
        if (signerStatus === 'completed') {
          currentStatus = 'completed';
        } else if (signerStatus === 'opened') {
          currentStatus = 'opened';
        } else if (signerStatus === 'sent' && !currentStatus) {
          currentStatus = 'sent';
        } else if (signerStatus === 'pending' && !currentStatus) {
          currentStatus = 'sent';
        }
      }
    }
    
    // Update status if we determined one
    if (currentStatus) {
      console.log('✅ Setting status to:', currentStatus);
      setSigningStatus(currentStatus as 'pending' | 'sent' | 'opened' | 'completed' | 'awaiting' | null);
    } else {
      console.log('⚠️ Could not determine status from response');
    }
  };

  const handleRefreshStatus = async () => {
    // Use the new endpoint that syncs with DocuSeal
    // This will use refresh-status if we have submissionId, or opportunity endpoint if we don't
    await checkSigningStatus();
  };

  if (step === 'loading') {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Loading booking confirmation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'status') {
    const getStatusIcon = () => {
      switch (signingStatus) {
        case 'completed':
          return 'checkmark-circle';
        case 'opened':
          return 'eye';
        case 'sent':
          return 'mail';
        default:
          return 'time';
      }
    };

    const getStatusColor = () => {
      switch (signingStatus) {
        case 'completed':
          return theme.successButton;
        case 'opened':
          return '#FF9800';
        case 'sent':
          return theme.primaryButton;
        default:
          return theme.secondaryText;
      }
    };

    const getStatusText = () => {
      switch (signingStatus) {
        case 'completed':
          return 'Booking Confirmation Signed';
        case 'opened':
          return 'Email Opened';
        case 'sent':
          return 'Email Sent';
        case 'awaiting':
          return 'Awaiting Send';
        default:
          return 'Checking Status...';
      }
    };

    const getStatusDescription = () => {
      switch (signingStatus) {
        case 'completed':
          return 'The customer has successfully signed the booking confirmation.';
        case 'opened':
          return 'The customer has opened the signing email but has not yet signed.';
        case 'sent':
          return 'The signing email has been sent to the customer. Waiting for them to sign.';
        case 'awaiting':
          return 'The booking confirmation is being prepared. The email will be sent shortly.';
        default:
          return 'Checking signing status...';
      }
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
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
                onPress={() => setStep('signing')}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Signing Status
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Monitor booking confirmation signing progress
                </Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.statusContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.statusContent}>
            {/* Status Icon */}
            <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor() + '20' }]}>
              <Ionicons name={getStatusIcon()} size={64} color={getStatusColor()} />
            </View>

            {/* Status Title */}
            <Text style={[styles.statusTitle, { color: theme.primaryText }]}>
              {getStatusText()}
            </Text>

            {/* Status Description */}
            <Text style={[styles.statusDescription, { color: theme.secondaryText }]}>
              {getStatusDescription()}
            </Text>

            {/* Signer Info */}
            {signerInfo && (
              <View style={[styles.signerInfoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.signerInfoTitle, { color: theme.primaryText }]}>Signer Information</Text>
                <View style={styles.signerInfoRow}>
                  <Ionicons name="person-outline" size={16} color={theme.tertiaryText} />
                  <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                    {signerInfo.name || customerName}
                  </Text>
                </View>
                <View style={styles.signerInfoRow}>
                  <Ionicons name="mail-outline" size={16} color={theme.tertiaryText} />
                  <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                    {signerInfo.email || overrideCustomerEmail || customerEmail}
                  </Text>
                </View>
                {signerInfo.completed_at && (
                  <View style={styles.signerInfoRow}>
                    <Ionicons name="time-outline" size={16} color={theme.tertiaryText} />
                    <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                      Signed: {new Date(signerInfo.completed_at).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Refresh Button */}
            <TouchableOpacity
              style={[
                styles.refreshButton, 
                { backgroundColor: theme.primaryButton },
                (!submissionId || submissionId === 'unknown') && { opacity: 0.7 }
              ]}
              onPress={handleRefreshStatus}
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="refresh" size={20} color="white" />
              )}
              <Text style={styles.refreshButtonText}>
                {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
              </Text>
            </TouchableOpacity>

            {/* Next Button - Show when booking confirmation is signed */}
            {signingStatus === 'completed' && (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: theme.successButton }]}
                onPress={async () => {
                  // Mark email confirmation signing step as completed (step 10)
                  try {
                    const { workflowApi } = await import('../utils/api');
                    await workflowApi.completeStep(opportunityId, 10, {
                      signedAt: new Date().toISOString(),
                      submissionId: submissionId,
                      status: 'completed'
                    });
                    // Navigate to Payment
                    navigation.navigate('Payment', { opportunityId });
                  } catch (error) {
                    console.error('Error completing email confirmation signing step:', error);
                    // Still navigate even if step completion fails
                    navigation.navigate('Payment', { opportunityId });
                  }
                }}
              >
                <Text style={styles.nextButtonText}>Next: Payment</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            )}
            
            {(!submissionId || submissionId === 'unknown') && (
              <View style={[styles.warningContainer, { backgroundColor: 'rgba(255, 165, 0, 0.1)', borderColor: 'rgba(255, 165, 0, 0.3)' }]}>
                <Ionicons name="information-circle-outline" size={16} color="#FFA500" />
                <Text style={[styles.refreshNote, { color: theme.secondaryText }]}>
                  Status checking is limited without a submission ID. The booking confirmation has been sent successfully to the customer.
                </Text>
              </View>
            )}

            {/* Info Message */}
            <View style={[styles.infoMessage, { backgroundColor: theme.tertiaryBackground }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.secondaryText} />
              <Text style={[styles.infoText, { color: theme.secondaryText }]}>
                The customer will receive an email with a link to sign the booking confirmation. You can refresh this page to check if they have signed.
              </Text>
            </View>
            
            {/* Warning if no submissionId */}
            {!submissionId && (
              <View style={[styles.warningContainer, { backgroundColor: '#FF9800' + '20', borderColor: '#FF9800' }]}>
                <Ionicons name="warning-outline" size={16} color="#FF9800" />
                <Text style={[styles.warningText, { color: '#FF9800' }]}>
                  Status checking may be limited. The booking confirmation has been sent successfully.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </SafeAreaView>
    );
  }

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
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Sign Booking Confirmation
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Send booking confirmation for signing
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
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
          <Text style={[styles.errorText, { color: theme.dangerButton }]}>{error}</Text>
        </View>
      )}

      {/* Streamlined Booking Confirmation Signing Interface */}
      <View style={styles.signingContainer}>
        <View style={styles.contractHeader}>
          <View style={[styles.contractIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Ionicons name="mail-outline" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.contractTitle, { color: theme.primaryText }]}>
            Booking Confirmation Signing
          </Text>
          <Text style={[styles.contractSubtitle, { color: theme.secondaryText }]}>
            Send your booking confirmation for digital signing
          </Text>
        </View>

        <View style={[styles.contractInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          {/* Read-only Customer Name */}
          <View style={styles.contractDetailRow}>
            <Ionicons name="person-outline" size={18} color={theme.tertiaryText} />
            <Text style={[styles.customerNameText, { color: theme.primaryText }]}>
              {customerName || 'Customer'}
            </Text>
          </View>

          {/* Editable Customer Email */}
          <View style={styles.emailInputSection}>
            <Text style={[styles.inputLabel, { color: theme.secondaryText }]}>EMAIL:</Text>
            <TextInput
              style={[styles.inputField, { 
                backgroundColor: theme.tertiaryBackground, 
                color: theme.primaryText,
                borderColor: theme.cardBorder
              }]}
              value={overrideCustomerEmail}
              onChangeText={setOverrideCustomerEmail}
              placeholder="Enter email address"
              placeholderTextColor={theme.tertiaryText}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoadingCustomerDetails}
            />
          </View>
          
          {/* Digital signature info */}
          <View style={styles.verificationRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.successButton} />
            <Text style={[styles.verificationText, { color: theme.secondaryText }]}>
              Digital signature with verification
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signButton, { backgroundColor: theme.primaryButton }]}
          onPress={handleCreateBookingConfirmationWorkflow}
          disabled={isCreatingWorkflow || isLoadingCustomerDetails || !overrideCustomerEmail.trim()}
        >
          {isCreatingWorkflow ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="mail-outline" size={24} color="white" />
          )}
          <Text style={styles.signButtonText}>
            {isCreatingWorkflow ? 'Sending...' : 'Send for Signing'}
          </Text>
        </TouchableOpacity>

        <View style={styles.signingFeatures}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Legally binding signature via DocuSeal
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="mail-outline" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Signing link emailed to customer
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Secure digital signature workflow
            </Text>
          </View>
        </View>
        
        {!isLoadingCustomerDetails && !overrideCustomerEmail.trim() && (
          <View style={[styles.warningContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
            <Ionicons name="warning-outline" size={16} color={theme.dangerButton} />
            <Text style={[styles.warningText, { color: theme.dangerButton }]}>
              Customer email is required
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  signingContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  contractHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  contractIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  contractSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  contractInfo: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  contractDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  customerNameText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  emailInputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputField: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  signingFeatures: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    flex: 1,
  },
  statusContainer: {
    flex: 1,
  },
  statusContent: {
    padding: 20,
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  signerInfoCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  signerInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  signerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  signerInfoText: {
    fontSize: 15,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  refreshNote: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
