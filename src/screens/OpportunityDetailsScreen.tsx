import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Opportunity, Appointment } from '../types';
import { api, workflowApi } from '../utils/api';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId?: string;
  opportunity?: Opportunity;
}

/** Returns true if the value is a valid opportunity object (not URL-serialized "[object Object]" or missing). */
function isValidOpportunity(obj: unknown): obj is Opportunity {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    'id' in (obj as Record<string, unknown>) &&
    typeof (obj as Opportunity).id === 'string' &&
    (obj as Opportunity).id.length > 0
  );
}

export default function OpportunityDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as RouteParams;
  const { opportunityId, opportunity: paramOpportunity } = params;
  const { isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Load opportunity data and workflow
    loadOpportunityDetails();
  }, []);


  // Helper function to determine if workflow is already started
  const isWorkflowStarted = () => {
    if (!workflowProgress) {
      console.log('🔧 isWorkflowStarted: No workflowProgress, returning false');
      return false;
    }
    
    // A workflow is considered started if:
    // 1. Status is IN_PROGRESS (primary check)
    // 2. Status is COMPLETED (workflow finished)
    // 3. Status is PAUSED (workflow was started but paused)
    // 4. It has a startedAt field (fallback check)
    const isStarted = !!(
      workflowProgress.status === 'IN_PROGRESS' ||
      workflowProgress.status === 'COMPLETED' ||
      workflowProgress.status === 'PAUSED' ||
      workflowProgress.startedAt
    );
    
    console.log('🔧 isWorkflowStarted: Checking workflow status:', {
      status: workflowProgress.status,
      startedAt: workflowProgress.startedAt,
      isStarted
    });
    
    return isStarted;
  };

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  const loadOpportunityDetails = async () => {
    setLoading(true);
    try {
      // Resolve opportunity: use param if valid, otherwise fetch by opportunityId (clean URLs use only ID)
      let passedOpportunity: Opportunity;
      if (isValidOpportunity(paramOpportunity)) {
        passedOpportunity = paramOpportunity;
      } else if (opportunityId) {
        const res = await api.get<Opportunity>(`/opportunities/${opportunityId}`);
        passedOpportunity = res.data;
      } else {
        Alert.alert('Error', 'Missing opportunity. Please open this page from the opportunities list.');
        setLoading(false);
        return;
      }

      console.log('🔧 Loading opportunity details for:', passedOpportunity?.id ?? opportunityId);
      
      // Manual opportunities often have customerAddress directly; normalize so we show location without waiting for /details
      const oppAny = passedOpportunity as Record<string, unknown>;
      const manualAddress = oppAny.customerAddress as string | undefined;
      if (manualAddress && !passedOpportunity.contactAddress && !passedOpportunity.address) {
        passedOpportunity = {
          ...passedOpportunity,
          contactAddress: passedOpportunity.contactAddress || manualAddress,
          address: passedOpportunity.address || manualAddress,
        };
      }
      
      // Log location-related fields specifically
      console.log('📍 Location data check:');
      console.log('   - contactAddress:', passedOpportunity.contactAddress);
      console.log('   - contactPostcode:', passedOpportunity.contactPostcode);
      console.log('   - address:', passedOpportunity.address);
      
      // If no address data or notes, fetch from API (GHL flow; manual may already have it above)
      if (!passedOpportunity.contactAddress && !passedOpportunity.address) {
        console.log('🔍 No address data found, fetching from API...');
        console.log('🔍 Making API call to:', `/opportunities/${passedOpportunity.id}/details`);
        try {
          const detailsResponse = await api.get(`/opportunities/${passedOpportunity.id}/details`);
          console.log('📍 Details API response data:', detailsResponse.data);
          
          if (detailsResponse.data) {
            const detailsData = detailsResponse.data as {
              contactAddress: string | null;
              contactPostcode: string | null;
              address: string | null;
              notes: string | null;
              customFields: any[] | null;
            };
            
            const enhancedOpportunity = {
              ...passedOpportunity,
              contactAddress: detailsData.contactAddress || undefined,
              contactPostcode: detailsData.contactPostcode || passedOpportunity.contactPostcode,
              address: detailsData.address || undefined,
              notes: detailsData.notes || undefined,
              customFields: detailsData.customFields || undefined
            };
            console.log('📍 Enhanced opportunity with details:', enhancedOpportunity);
            setOpportunity(enhancedOpportunity);
            return;
          }
        } catch (detailsError: any) {
          console.warn('⚠️ Failed to fetch details:', detailsError);
          console.warn('⚠️ Details error details:', {
            message: detailsError.message,
            status: detailsError.response?.status,
            data: detailsError.response?.data
          });
          // Continue with original opportunity data
        }
      }
      
      setOpportunity(passedOpportunity);
      
      // Check for existing workflow progress
      try {
        console.log('🔧 Checking for existing workflow progress for opportunity:', passedOpportunity.id);
        const progressResponse = await workflowApi.getOpportunityProgress(passedOpportunity.id);
        if (progressResponse.success && progressResponse.data) {
          console.log('🔧 Found existing workflow progress:', progressResponse.data);
          setWorkflowProgress(progressResponse.data);
        } else {
          console.log('🔧 No existing workflow progress found');
          setWorkflowProgress(null);
        }
      } catch (workflowError) {
        console.error('Error checking workflow progress:', workflowError);
        setWorkflowProgress(null);
      }
    } catch (error) {
      console.error('Error loading opportunity details:', error);
      Alert.alert('Error', 'Failed to load opportunity details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = () => {
    console.log('🔧 handleStartWorkflow called');
    console.log('🔧 opportunity:', opportunity);
    console.log('🔧 navigation object:', navigation);
    
    if (!opportunity) {
      console.log('❌ No opportunity found');
      Alert.alert('Error', 'No opportunity data available');
      return;
    }
    
    if (!navigation) {
      console.log('❌ Navigation object not available');
      Alert.alert('Error', 'Navigation not available');
      return;
    }
    
    console.log('🔧 About to show custom modal...');
    setShowWorkflowModal(true);
    console.log('🔧 Custom modal should now be visible');
  };

  const handleWorkflowConfirm = () => {
    console.log('🔧 User confirmed, navigating to SolarWorkflow with opportunityId:', opportunity?.id);
    setShowWorkflowModal(false);
    
    // Try direct navigation
    try {
      console.log('🔧 Attempting direct navigation...');
      navigation.navigate('SolarWorkflow', { 
        opportunityId: opportunity!.id,
        opportunity: opportunity // Pass the full opportunity data
      });
      console.log('🔧 Direct navigation command sent successfully');
    } catch (error) {
      console.error('❌ Direct navigation error:', error);
      Alert.alert('Navigation Error', 'Failed to navigate to progress screen');
    }
  };

  const handleWorkflowCancel = () => {
    console.log('🔧 User cancelled workflow start');
    setShowWorkflowModal(false);
  };


  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading opportunity details...</Text>
      </View>
    );
  }

  if (!opportunity) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.primaryBackground }]}>
        <Text style={[styles.errorText, { color: theme.dangerButton }]}>Opportunity not found</Text>
      </View>
    );
  }

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
      {/* Background Logo */}
      <Image
        source={require('../../assets/creativ NB.png')}
        style={styles.backgroundLogo}
        resizeMode="contain"
      />
      
      {/* Modern Header */}
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
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Opportunity Details</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                View opportunity information and progress
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={loadOpportunityDetails}
            >
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
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

      {/* Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={[
          styles.scrollView,
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadOpportunityDetails} tintColor={theme.primaryButton} />
        }
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          { paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any, // Ensure content is taller than viewport
            paddingBottom: 100, // Extra padding for web
          }
        ]}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconContainer, { backgroundColor: theme.primaryButton + '15' }]}>
              <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton }]}>
                <Feather name="briefcase" size={32} color="#ffffff" />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: theme.primaryText }]}>
              {opportunity.name || 'Opportunity Details'}
            </Text>
            <Text style={[styles.heroDescription, { color: theme.secondaryText }]}>
              {opportunity.type === 'ai' ? 'AI Generated Opportunity' : 'Manual Entry Opportunity'}
            </Text>
          </View>

          {/* Opportunity Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="info" size={20} color={theme.secondaryText} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Opportunity Information</Text>
            </View>
            
            <View style={[styles.detailCard, { 
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
              borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
              shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
            }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Type:</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: opportunity.type === 'ai' ? theme.primaryButton : theme.secondaryButton }
                ]}>
                  <Feather 
                    name={opportunity.type === 'ai' ? 'zap' : 'edit-3'} 
                    size={12} 
                    color="#ffffff" 
                  />
                  <Text style={styles.statusBadgeText}>{opportunity.type?.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Created:</Text>
                <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                  {new Date(opportunity.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Stage:</Text>
                <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.stageName || 'New'}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Name:</Text>
                <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.name || 'Unnamed'}</Text>
              </View>
              
              {opportunity.contactName && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Contact:</Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.contactName}</Text>
                </View>
              )}
              
              {opportunity.contactEmail && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Email:</Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.contactEmail}</Text>
                </View>
              )}
              
              {opportunity.contactPhone && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Phone:</Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.contactPhone}</Text>
                </View>
              )}
              
              {opportunity.monetaryValue && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Value:</Text>
                  <Text style={[styles.detailValue, { color: theme.primaryButton, fontWeight: '700' }]}>
                    £{opportunity.monetaryValue.toLocaleString()}
                  </Text>
                </View>
              )}
              
              {/* Location Information */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Location:</Text>
                <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                  {(() => {
                    const oppAny = opportunity as Record<string, unknown>;
                    const location = opportunity.contactAddress || opportunity.address || (oppAny.customerAddress as string) || 'Location not available';
                    return location;
                  })()}
                </Text>
              </View>
              
              {opportunity.contactPostcode && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Postcode:</Text>
                  <Text style={[styles.detailValue, { color: theme.primaryText }]}>{opportunity.contactPostcode}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Appointment Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Appointment Information</Text>
            </View>
            
            <View style={[styles.appointmentCard, { 
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
              borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
              shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
            }]}>
              {opportunity.hasAppointment ? (
                <>
                  <View style={styles.appointmentHeader}>
                    <View style={styles.appointmentStatusContainer}>
                      <MaterialIcons name="event-available" size={20} color={theme.successButton} />
                      <Text style={[styles.appointmentStatus, { color: theme.primaryText }]}>Has Appointment</Text>
                    </View>
                    <View style={[
                      styles.classificationBadge,
                      opportunity.classification === 'CONFIRMED' ? { backgroundColor: theme.successButton } :
                      opportunity.classification === 'MULTIPLE' ? { backgroundColor: theme.secondaryButton } :
                      { backgroundColor: theme.dangerButton }
                    ]}>
                      <Text style={styles.classificationText}>
                        {opportunity.classification === 'CONFIRMED' ? '✅ Confirmed' :
                         opportunity.classification === 'MULTIPLE' ? '❓ Multiple' :
                         '❌ No Appointment'}
                      </Text>
                    </View>
                  </View>
                  
                  {opportunity.appointmentDetails && (
                    <View style={styles.appointmentDetails}>
                      <View style={styles.appointmentDetailRow}>
                        <Feather name="calendar" size={16} color={theme.secondaryText} />
                        <Text style={[styles.appointmentDetailText, { color: theme.secondaryText }]}>
                          {opportunity.appointmentDetails.title || 'Appointment'}
                        </Text>
                      </View>
                      
                      {opportunity.appointmentDetails.date && (
                        <View style={styles.appointmentDetailRow}>
                          <Feather name="clock" size={16} color={theme.secondaryText} />
                          <Text style={[styles.appointmentDetailText, { color: theme.secondaryText }]}>
                            {new Date(opportunity.appointmentDetails.date).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      
                      {opportunity.appointmentDetails.status && (
                        <View style={styles.appointmentDetailRow}>
                          <Feather name="check-circle" size={16} color={theme.secondaryText} />
                          <Text style={[styles.appointmentDetailText, { color: theme.secondaryText }]}>
                            Status: {opportunity.appointmentDetails.status}
                          </Text>
                        </View>
                      )}
                      
                      {opportunity.confidence && (
                        <View style={styles.appointmentDetailRow}>
                          <Feather name="shield" size={16} color={theme.secondaryText} />
                          <Text style={[styles.appointmentDetailText, { color: theme.secondaryText }]}>
                            Confidence: {opportunity.confidence}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {opportunity.appointmentCount && (
                    <View style={styles.appointmentDetailRow}>
                      <Feather name="list" size={16} color={theme.secondaryText} />
                      <Text style={[styles.appointmentDetailText, { color: theme.secondaryText }]}>
                        Total Appointments: {opportunity.appointmentCount}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.noAppointmentContainer}>
                  <View style={[styles.noAppointmentIcon, { backgroundColor: theme.secondaryButton + '15' }]}>
                    <MaterialIcons name="event-busy" size={32} color={theme.secondaryButton} />
                  </View>
                  <Text style={[styles.noAppointmentTitle, { color: theme.primaryText }]}>No Appointment</Text>
                  <Text style={[styles.noAppointmentText, { color: theme.secondaryText }]}>
                    {opportunity.reason || 'No appointment has been scheduled for this opportunity.'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Notes Section */}
          {(opportunity.notes || opportunity.customFields) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={20} color={theme.secondaryText} />
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Notes & Details</Text>
              </View>
              
              <View style={[styles.detailCard, { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
                shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
              }]}>
                {opportunity.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={[styles.notesLabel, { color: theme.secondaryText }]}>Notes:</Text>
                    <Text style={[styles.notesText, { color: theme.primaryText }]}>{opportunity.notes}</Text>
                  </View>
                )}
                
                {opportunity.customFields && opportunity.customFields.length > 0 && (
                  <View style={styles.customFieldsContainer}>
                    <Text style={[styles.notesLabel, { color: theme.secondaryText }]}>Property Details:</Text>
                    {opportunity.customFields.map((field: any, index: number) => {
                      // Skip fields with empty or null values
                      if (!field.value || field.value === '' || field.value === 'null') {
                        return null;
                      }
                      
                      // Create a readable label based on common field patterns
                      let readableLabel = 'Additional Information';
                      const value = field.value;
                      
                      // Map field IDs to specific form labels from the image
                      // This maps GoHighLevel custom field IDs to the form questions
                      const fieldIdToLabel: { [key: string]: string } = {
                        // Property ownership fields
                        '8LfI7IvurEGCVdd06zLN': 'Do You Own The Property?', // "Yes I'm the owner"
                        'qQ7mXZNwhrystjzhon0X': 'Are You The Sole Or Joint Owner Of The Property?', // "Sole Owner"
                        
                        // Property details
                        '7tbK0Nq90gT5LFy9dmy2': 'What Is The Property Type?', // "House"
                        'n75xt7iCxzSC24MAXK8R': 'How Many Occupants Are In The Property?', // "4"
                        
                        // Financial fields
                        'XEaaTwJo2jfX7y6G0mGo': 'What Is Your Monthly Electric Spend?', // "£100 - £200"
                        
                        // Age and employment
                        'xCITZ52WLBFkQqsfLn5E': 'Are You Under The Age Of 75?', // "Yes"
                        'gvzjBODUDUc8oEfxVMCt': 'Are You Currently Employed, Retired, Self Employed?', // "Employed"
                        
                        // Appointment confirmation
                        'iApX0bkAF94ZAD5C28LI': 'Can You Confirm All Homeowners Have 1 Hour And 30 Minutes For The Appointment', // "Yes"
                        'SlXtpQ6yqTf0kEnbpe28': 'Please Can You Confirm All Homeowners Will Be Available?' // ["Yes"]
                      };
                      
                      // Check if this field ID matches one of our form fields
                      const mappedLabel = fieldIdToLabel[field.id];
                      if (mappedLabel) {
                        readableLabel = mappedLabel;
                      } else {
                        // Skip fields that don't match our specific form
                        return null;
                      }
                      
                      return (
                        <View key={index} style={styles.customFieldRow}>
                          <Text style={[styles.customFieldLabel, { color: theme.secondaryText }]}>
                            {readableLabel}:
                          </Text>
                          <Text style={[styles.customFieldValue, { color: theme.primaryText }]}>
                            {Array.isArray(value) ? value.join(', ') : value}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Workflow Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={20} color={theme.secondaryText} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Progress</Text>
            </View>
            
            <TouchableOpacity
              style={styles.workflowButton}
              activeOpacity={0.8}
              onPress={() => {
                console.log('🔧 Workflow button pressed');
                handleStartWorkflow();
              }}
            >
              <LinearGradient
                colors={[theme.primaryButton, theme.successButton]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.workflowGradient}
              >
                <View style={styles.workflowContent}>
                  <Feather name="sun" size={24} color="#ffffff" />
                  <Text style={styles.workflowText}>
                    {isWorkflowStarted() ? 'Continue Solar Progress' : 'Start Solar Progress'}
                  </Text>
                </View>
                <Text style={styles.workflowSubtext}>
                  {isWorkflowStarted() 
                    ? 'Continue the solar installation process for this opportunity'
                    : 'Begin the solar installation process for this opportunity'
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Enhanced Workflow Modal */}
      <Modal
        visible={showWorkflowModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleWorkflowCancel}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          {/* Transparent background with blur effect */}
          <View style={styles.modalBackground} />
          
          {/* Close button */}
          <TouchableOpacity
            onPress={handleWorkflowCancel}
            style={styles.modalCloseButton}
          >
            <Feather name="x" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Simple image container */}
          <View style={styles.modalImageContainer}>
            <Image
              source={require('../../assets/Creativ-App-SolarStorage1.jpg')}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>

          {/* Action buttons with improved styling */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleWorkflowCancel}
              activeOpacity={0.8}
            >
              <Feather name="x" size={18} color="#ffffff" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleWorkflowConfirm}
              activeOpacity={0.8}
            >
              <Feather name="play" size={18} color="#ffffff" />
              <Text style={styles.confirmButtonText}>
                {isWorkflowStarted() ? 'Continue Progress' : 'Start Progress'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundLogo: {
    position: 'absolute',
    top: height * 0.5 - (width * 0.25),
    left: width * 0.5 - (width * 0.25),
    width: width * 0.5,
    height: width * 0.5,
    opacity: 0.06,
    zIndex: 0,
  },
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
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  content: {
    padding: 24,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
    paddingTop: 32,
  },
  heroIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroDescription: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: width * 0.85,
    opacity: 0.9,
  },
  section: {
    marginBottom: 32,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra spacing for web scrolling
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  detailCard: {
    padding: 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 8, // Extra spacing between cards on web
      minHeight: 100, // Ensure cards have minimum height
    }),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  appointmentCard: {
    padding: 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appointmentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appointmentStatus: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  classificationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  classificationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  appointmentDetails: {
    marginTop: 8,
    marginBottom: 16,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  appointmentDetailText: {
    fontSize: 16,
    flex: 1,
    letterSpacing: -0.2,
  },
  noAppointmentContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noAppointmentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noAppointmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  noAppointmentText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  notesText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  customFieldsContainer: {
    marginTop: 16,
  },
  customFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  customFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.2,
  },
  customFieldValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
    letterSpacing: -0.2,
  },
  workflowButton: {
    borderRadius: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  workflowGradient: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  workflowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  workflowText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  workflowSubtext: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  
  // Enhanced Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingHorizontal: 20,
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 20,
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalImageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    maxHeight: '70%', // Limit height to prevent overlap
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    opacity: 1,
  },
  modalButtons: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 16,
    zIndex: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  confirmButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
}); 
