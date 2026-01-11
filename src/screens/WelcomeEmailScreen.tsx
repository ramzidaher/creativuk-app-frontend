import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
}

export default function WelcomeEmailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, opportunity: passedOpportunity } = route.params as RouteParams;
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [useCustomEmail, setUseCustomEmail] = useState(false);

  useEffect(() => {
    loadCustomerDetails();
  }, [opportunityId]);

  const loadCustomerDetails = async () => {
    try {
      setIsLoadingCustomer(true);
      
      // Get customer details from CRM
      const { api } = await import('../utils/api');
      const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
      
      if (customerResponse.success && customerResponse.data) {
        setCustomerDetails(customerResponse.data);
        setCustomEmail(customerResponse.data.email || '');
      } else {
        // Fallback to opportunity data if CRM lookup fails
        const fallbackCustomer = {
          name: passedOpportunity?.name || 'Customer',
          email: passedOpportunity?.contactEmail || '',
          address: passedOpportunity?.contactAddress || '',
          postcode: passedOpportunity?.contactPostcode || ''
        };
        setCustomerDetails(fallbackCustomer);
        setCustomEmail(fallbackCustomer.email || '');
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      
      // Show modal with available data
      const fallbackCustomer = {
        name: passedOpportunity?.name || 'Customer',
        email: passedOpportunity?.contactEmail || '',
        address: passedOpportunity?.contactAddress || '',
        postcode: passedOpportunity?.contactPostcode || ''
      };
      setCustomerDetails(fallbackCustomer);
      setCustomEmail(fallbackCustomer.email || '');
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const handleSendWelcomeEmail = async () => {
    try {
      setIsSendingEmail(true);
      
      const emailToUse = useCustomEmail ? customEmail : customerDetails?.email;
      
      if (!emailToUse) {
        Alert.alert('Error', 'Please provide a valid email address to send the welcome email.');
        return;
      }
      
      // Send welcome email with opportunity and user IDs
      const { api } = await import('../utils/api');
      const emailResponse = await api.post('/email/send-welcome', {
        customerName: customerDetails?.name || 'Customer',
        customerEmail: emailToUse,
        ghlOpportunityId: opportunityId,
        ghlUserId: user?.ghlUserId || 'default' // Use the user's GHL user ID
      });
      
      if (emailResponse.success) {
        // Check if the backend returned step completion data
        if (emailResponse.data?.stepCompletionData) {
          // Backend handled the step completion automatically
          console.log('Step completed automatically by backend');
        } else {
          // Fallback: manually complete the step if backend didn't handle it
          const { workflowApi } = await import('../utils/api');
          await workflowApi.completeStep(opportunityId, 12, { // Use step number 12 directly
            emailSent: true,
            customerEmail: emailToUse,
            sentAt: new Date().toISOString(),
            usedCustomEmail: useCustomEmail
          });
        }
        
        // Show success message and auto-navigate after a brief delay
        Alert.alert(
          '✅ Welcome Email Sent!', 
          `Welcome email has been successfully sent to ${emailToUse}. Redirecting to next step...`,
          [],
          { cancelable: false }
        );
        
        // Auto-navigate after 2 seconds
        setTimeout(() => {
          navigation.navigate('FinishAppointment', { 
            opportunityId: opportunityId,
            opportunity: passedOpportunity
          });
        }, 2000);
      } else {
        throw new Error('Failed to send welcome email');
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
      Alert.alert('Error', 'Failed to send welcome email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (isLoadingCustomer) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading customer details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }
    ]}>
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Send Welcome Email</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Send installation details to customer
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

      <ScrollView 
        style={[
          styles.scrollView, 
          { backgroundColor: 'transparent' },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          { 
            paddingBottom: 40,
            marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
          },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
            marginBottom: 65, // Add margin for BottomNavigation on web
          }
        ]}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Feather name="mail" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Welcome Email</Text>
          <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
            Send a welcome email to the customer with installation details and helpful links
          </Text>
        </View>

        {/* Customer Details Card */}
        {customerDetails && (
          <View style={[styles.customerCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.customerHeader}>
              <View style={[styles.customerIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                <Feather name="user" size={20} color={theme.primaryButton} />
              </View>
              <View style={styles.customerInfo}>
                <Text style={[styles.customerTitle, { color: theme.primaryText }]}>Customer Information</Text>
                <Text style={[styles.customerSubtitle, { color: theme.secondaryText }]}>
                  Review and customize email details
                </Text>
              </View>
            </View>

            <View style={styles.customerDetailsContainer}>
              <View style={styles.customerDetailRow}>
                <Feather name="user" size={16} color={theme.secondaryText} />
                <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Name:</Text>
                <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                  {customerDetails.name || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.customerDetailRow}>
                <Feather name="mail" size={16} color={theme.secondaryText} />
                <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Email:</Text>
                <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                  {customerDetails.email || 'No email address'}
                </Text>
              </View>
              
              {customerDetails.address && (
                <View style={styles.customerDetailRow}>
                  <Feather name="map-pin" size={16} color={theme.secondaryText} />
                  <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Address:</Text>
                  <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                    {customerDetails.address}
                    {customerDetails.postcode && `, ${customerDetails.postcode}`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Email Override Section */}
        <View style={[styles.emailOverrideCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.emailOverrideHeader}>
            <View style={[styles.emailOverrideIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="edit-3" size={20} color={theme.primaryButton} />
            </View>
            <View style={styles.emailOverrideInfo}>
              <Text style={[styles.emailOverrideTitle, { color: theme.primaryText }]}>Email Override</Text>
              <Text style={[styles.emailOverrideSubtitle, { color: theme.secondaryText }]}>
                Use a different email address if needed
              </Text>
            </View>
          </View>

          <View style={styles.emailOverrideContent}>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: useCustomEmail ? theme.primaryButton : theme.cardBackground, borderColor: theme.cardBorder }]}
              onPress={() => setUseCustomEmail(!useCustomEmail)}
            >
              <View style={styles.toggleContent}>
                <Feather 
                  name={useCustomEmail ? "check-circle" : "circle"} 
                  size={20} 
                  color={useCustomEmail ? '#ffffff' : theme.secondaryText} 
                />
                <Text style={[styles.toggleText, { color: useCustomEmail ? '#ffffff' : theme.primaryText }]}>
                  Use custom email address
                </Text>
              </View>
            </TouchableOpacity>

            {useCustomEmail && (
              <View style={styles.customEmailContainer}>
                <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Custom Email Address</Text>
                <TextInput
                  style={[
                    styles.emailInput,
                    { 
                      backgroundColor: theme.primaryBackground,
                      borderColor: theme.cardBorder,
                      color: theme.primaryText
                    }
                  ]}
                  value={customEmail}
                  onChangeText={setCustomEmail}
                  placeholder="Enter email address"
                  placeholderTextColor={theme.secondaryText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}
          </View>
        </View>

        {/* Warning Card */}
        {!customerDetails?.email && !useCustomEmail && (
          <View style={[styles.warningCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text style={[styles.warningText, { color: '#92400e' }]}>
              No email address found. Please provide a valid email address before sending.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.sendButton, 
              { 
                backgroundColor: (customerDetails?.email || useCustomEmail) ? theme.primaryButton : '#9ca3af',
                opacity: isSendingEmail ? 0.7 : 1
              }
            ]}
            onPress={handleSendWelcomeEmail}
            disabled={!customerDetails?.email && !useCustomEmail || isSendingEmail}
            activeOpacity={0.8}
          >
            {isSendingEmail ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="mail" size={20} color="#ffffff" />
            )}
            <Text style={[styles.sendButtonText, { color: '#ffffff' }]}>
              {isSendingEmail ? 'Sending...' : 'Send Welcome Email'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            onPress={handleBack}
            disabled={isSendingEmail}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: theme.secondaryText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  } as any,
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  } as any,
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '500',
  },
  
  // Modern Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
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
    gap: width < 768 ? 12 : 16,
  },
  backButton: {
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
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
    fontSize: width < 768 ? 24 : 28,
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
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
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
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  
  // Customer Card
  customerCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  customerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  customerInfo: {
    flex: 1,
  },
  customerTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  customerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  customerDetailsContainer: {
    gap: 16,
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
  },
  customerDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  
  // Email Override Card
  emailOverrideCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  emailOverrideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  emailOverrideIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emailOverrideInfo: {
    flex: 1,
  },
  emailOverrideTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  emailOverrideSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  emailOverrideContent: {
    gap: 16,
  },
  toggleButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  customEmailContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 48,
  },
  
  // Warning Card
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  
  // Action Buttons
  actionButtonsContainer: {
    gap: 16,
    marginTop: 20,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 16 : 18,
    borderRadius: 16,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 16 : 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
