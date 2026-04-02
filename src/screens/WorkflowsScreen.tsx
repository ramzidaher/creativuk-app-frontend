// Modern Workflows Screen with Enhanced Design
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OpportunityOutcomeType, OpportunityStatus } from '../types';
import { opportunityOutcomesApi, workflowApi } from '../utils/api';

const { width, height } = Dimensions.get('window');

interface WorkflowItem {
  id: string;
  ghlOpportunityId: string;
  customerName?: string;
  address?: string;
  currentStep: number;
  totalSteps: number;
  status: OpportunityStatus;
  startedAt: string;
  lastActivityAt: string;
  stepTitle: string;
  stepDescription: string;
  progressPercentage: number;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  contactPostcode?: string;
  monetaryValue?: number;
  stageName?: string;
  userInfo?: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
  };
  outcomeStatus?: OpportunityOutcomeType | null; // Won/Quote (LOST) status for admin view
}

export default function WorkflowsScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const fetchIdRef = useRef(0);

  const filteredWorkflows = activeWorkflows.filter((workflow) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const name = (workflow.customerName || '').toLowerCase();
    const address = (workflow.contactAddress || workflow.address || '').toLowerCase();
    const postcode = (workflow.contactPostcode || '').toLowerCase();
    const stage = (workflow.stepTitle || workflow.stageName || '').toLowerCase();
    const status = (workflow.status || '').toLowerCase();
    return (
      name.includes(q) ||
      address.includes(q) ||
      postcode.includes(q) ||
      stage.includes(q) ||
      status.includes(q)
    );
  });


  const fetchActiveWorkflows = async () => {
    const thisFetchId = ++fetchIdRef.current;
    try {
      setLoading(true);
      
      // Add a small delay to ensure loading state is visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const workflowsResponse = await workflowApi.getUserWorkflows();
      if (thisFetchId !== fetchIdRef.current) return;
      
      if (workflowsResponse.success && workflowsResponse.data) {
        const workflows = workflowsResponse.data.map((workflow: any, index: number) => {
          
          let currentStepData = workflow.steps?.find((step: any) => step.stepNumber === workflow.currentStep);
          if (user?.role === 'ADMIN' && currentStepData?.stepType === 'EXPRESS_CONSENT') {
            currentStepData = { ...currentStepData, stepType: 'BOOKING_CONFIRMATION' };
          }
          const stepTitle = currentStepData ? getStepTitle(currentStepData.stepType) : 'Unknown Step';
          const stepDescription = currentStepData ? getStepDescription(currentStepData.stepType) : 'Processing progress step';
          
          // Use the opportunity details directly from the backend
          let opportunityDetails = workflow.opportunityDetails || {};
          let customerName = opportunityDetails.customerName || '';
          
          // If customerName is empty or still a fallback, check other possible locations
          if (!customerName || customerName.trim() === '' || (customerName.startsWith('Customer ') && customerName.length <= 15)) {
            if (workflow.contact?.name) {
              customerName = workflow.contact.name;
            } else if (workflow.contact?.firstName && workflow.contact?.lastName) {
              customerName = `${workflow.contact.firstName} ${workflow.contact.lastName}`;
            } else if (workflow.name) {
              customerName = workflow.name;
            } else {
              customerName = `Customer ${workflow.ghlOpportunityId.slice(-6)}`;
            }
          }
    
          return {
            id: workflow.id,
            ghlOpportunityId: workflow.ghlOpportunityId,
            customerName: customerName,
            address: opportunityDetails.address || 'Address not available',
            currentStep: workflow.currentStep,
            totalSteps: workflow.totalSteps,
            status: workflow.status,
            startedAt: workflow.startedAt,
            lastActivityAt: workflow.lastActivityAt,
            stepTitle,
            stepDescription,
            progressPercentage: Math.round((workflow.currentStep / workflow.totalSteps) * 100),
            contactEmail: opportunityDetails.contactEmail,
            contactPhone: opportunityDetails.contactPhone,
            contactAddress: opportunityDetails.address,
            contactPostcode: opportunityDetails.contactPostcode,
            monetaryValue: opportunityDetails.monetaryValue,
            stageName: opportunityDetails.stageName,
            userInfo: workflow.userInfo, // Include user info for admin views
          };
        });
        
        // Fetch outcome status for admin users
        if (user?.role === 'ADMIN' && workflows.length > 0) {
          try {
            const outcomeStatuses = await Promise.all(
              workflows.map(async (workflow: WorkflowItem) => {
                try {
                  const outcomeResponse = await opportunityOutcomesApi.getOutcomeByOpportunityId(workflow.ghlOpportunityId);
                  if (outcomeResponse.success && outcomeResponse.data) {
                    return {
                      ...workflow,
                      outcomeStatus: outcomeResponse.data.outcome || null,
                    };
                  }
                  return {
                    ...workflow,
                    outcomeStatus: null,
                  };
                } catch {
                  return {
                    ...workflow,
                    outcomeStatus: null,
                  };
                }
              })
            );
            
            // Use setTimeout to ensure UI updates happen on next tick
            setTimeout(() => {
              if (thisFetchId !== fetchIdRef.current) return;
              setActiveWorkflows(outcomeStatuses);
            }, 0);
          } catch {
            // Still set workflows even if outcome fetch fails
            setTimeout(() => {
              if (thisFetchId !== fetchIdRef.current) return;
              setActiveWorkflows(workflows);
            }, 0);
          }
        } else {
          setTimeout(() => {
            if (thisFetchId !== fetchIdRef.current) return;
            setActiveWorkflows(workflows);
          }, 0);
        }
      } else {
        if (thisFetchId !== fetchIdRef.current) return;
        // Handle case where API returns success but no data
        if (workflowsResponse.success && (!workflowsResponse.data || workflowsResponse.data.length === 0)) {
          setActiveWorkflows([]);
        } else {
          Alert.alert('Error', workflowsResponse.error || 'Failed to load progress');
        }
      }
    } catch (error) {
      if (thisFetchId === fetchIdRef.current) {
        Alert.alert('Error', 'Failed to load progress');
      }
    } finally {
      if (thisFetchId === fetchIdRef.current) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveWorkflows();
    setRefreshing(false);
  };

  // Single source of fetch: on focus (includes initial mount when screen is first focused)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchActiveWorkflows();
    });
    return unsubscribe;
  }, [navigation]);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  const getStatusColor = (status: OpportunityStatus) => {
    switch (status) {
      case OpportunityStatus.IN_PROGRESS:
        return '#B4F35B';
      case OpportunityStatus.COMPLETED:
        return '#10b981';
      case OpportunityStatus.PAUSED:
        return '#f59e0b';
      case OpportunityStatus.CANCELLED:
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusIcon = (status: OpportunityStatus) => {
    switch (status) {
      case OpportunityStatus.IN_PROGRESS:
        return '🔄';
      case OpportunityStatus.COMPLETED:
        return '✅';
      case OpportunityStatus.PAUSED:
        return '⏸️';
      case OpportunityStatus.CANCELLED:
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStepTitle = (stepType: string) => {
    switch (stepType) {
      case 'SITE_SURVEY':
        return 'Site Survey';
      case 'OPEN_SOLAR':
        return 'OpenSolar';
      case 'CALCULATOR':
        return 'Calculator';
      case 'SOLAR_PROJECTION':
        return 'Solar Projection';
      case 'PROPOSAL_GENERATION':
        return 'Contract Generation';
      case 'DISCLAIMER_SIGNING':
        return 'Energy Bill Disclaimer';
      case 'CONTRACT_SIGNING':
        return 'Contract Signing';
      case 'EXPRESS_CONSENT':
        return 'Express Consent Signing';
      case 'BOOKING_CONFIRMATION':
      case 'EMAIL_CONFIRMATION': // backward-compatible name used in some backends
        return 'Booking Confirmation Signing';
      case 'PAYMENT':
        return 'Payment';
      case 'INSTALLATION_SCHEDULING':
        return 'Installation Scheduling';
      case 'INSTALLATION_BOOKING':
        return 'Installation Booking';
      case 'WELCOME_EMAIL':
        return 'Welcome Email';
      case 'FOLLOW_UP':
        return 'Follow Up';
      case 'INITIAL_CONTACT':
        return 'Initial Contact';
      case 'QUOTE_PREPARATION':
        return 'Quote Preparation';
      case 'PERMIT_APPLICATION':
        return 'Permit Application';
      case 'INSTALLATION':
        return 'Installation';
      case 'INSPECTION':
        return 'Inspection';
      case 'SYSTEM_ACTIVATION':
        return 'System Activation';
      case 'CUSTOMER_TRAINING':
        return 'Customer Training';
      case 'WARRANTY_SETUP':
        return 'Warranty Setup';
      case 'PAYMENT_PROCESSING':
        return 'Payment Processing';
      case 'DOCUMENTATION':
        return 'Documentation';
      case 'QUALITY_CHECK':
        return 'Quality Check';
      case 'HANDOVER':
        return 'Project Handover';
      default:
        return 'In Progress';
    }
  };

  const getStepDescription = (stepType: string) => {
    switch (stepType) {
      case 'SITE_SURVEY':
        return 'Conduct the on-site survey and assessment';
      case 'OPEN_SOLAR':
        return 'Access OpenSolar platform for design';
      case 'CALCULATOR':
        return 'Choose between Off Peak and Flux options';
      case 'SOLAR_PROJECTION':
        return 'Review solar projection data and financial analysis';
      case 'PROPOSAL_GENERATION':
        return 'Generate contract and proposal documents';
      case 'DISCLAIMER_SIGNING':
        return 'Sign disclaimer form (if customer has no energy bill)';
      case 'CONTRACT_SIGNING':
        return 'Sign the installation contract';
      case 'INSTALLATION_SCHEDULING':
        return 'Schedule the installation date';
      case 'EXPRESS_CONSENT':
        return 'Sign the express consent form for work to commence';
      case 'BOOKING_CONFIRMATION':
      case 'EMAIL_CONFIRMATION': // backward-compatible name used in some backends
        return 'Sign the booking confirmation letter';
      case 'PAYMENT':
        return 'Process payment for the installation';
      case 'INSTALLATION_BOOKING':
        return 'Book the installation appointment';
      case 'WELCOME_EMAIL':
        return 'Send welcome email to customer';
      case 'FOLLOW_UP':
        return 'Post-installation follow up and support';
      case 'INITIAL_CONTACT':
        return 'Initial customer contact and consultation';
      case 'QUOTE_PREPARATION':
        return 'Prepare detailed quote and pricing';
      case 'PERMIT_APPLICATION':
        return 'Submit permits and approvals';
      case 'INSTALLATION':
        return 'Install solar panels and equipment';
      case 'INSPECTION':
        return 'System inspection and testing';
      case 'SYSTEM_ACTIVATION':
        return 'Activate and commission the system';
      case 'CUSTOMER_TRAINING':
        return 'Train customer on system operation';
      case 'WARRANTY_SETUP':
        return 'Set up warranty and maintenance';
      case 'PAYMENT_PROCESSING':
        return 'Process payments and financing';
      case 'DOCUMENTATION':
        return 'Complete project documentation';
      case 'QUALITY_CHECK':
        return 'Final quality check and verification';
      case 'HANDOVER':
        return 'Project handover and completion';
      default:
        return 'Processing current step';
    }
  };

  const handleWorkflowPress = (workflow: WorkflowItem) => {
    // Navigate to the SolarWorkflow screen (same as "Start Progress" button)
    navigation.navigate('SolarWorkflow', { 
      opportunityId: workflow.ghlOpportunityId 
    });
  };

  const handleStartNewWorkflow = () => {
    // Navigate to opportunities screen to select an opportunity to start workflow
    navigation.navigate('Opportunities');
  };



  const renderWorkflowCard = (workflow: WorkflowItem, index: number) => (
    <View key={workflow.id} style={[
      styles.workflowCard, 
      { 
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
        shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
      }
    ]}>
      <TouchableOpacity
        style={styles.workflowCardContent}
        onPress={() => handleWorkflowPress(workflow)}
        activeOpacity={0.8}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.customerInfo}>
            <Text style={[
              styles.customerName, 
              { 
                color: theme.primaryText,
                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(255, 255, 255, 0.3)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.2)'
              }
            ]}>{workflow.customerName}</Text>
            
            {/* User Information for Admin */}
            {user?.role === 'ADMIN' && (
              <View style={[styles.userInfoContainer, { 
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                marginTop: 6
              }]}>
                <Feather name="user" size={14} color="#3b82f6" />
                <Text style={[styles.userInfoText, { 
                  color: '#3b82f6',
                  fontWeight: '600',
                  fontSize: width < 768 ? 12 : 13
                }]}>
                  {workflow.userInfo ? 
                    `${workflow.userInfo.name} (${workflow.userInfo.role})` : 
                    'User info not available'
                  }
                </Text>
              </View>
            )}
            
            {/* Stage and Value Information */}
            <View style={styles.detailsRow}>
              {workflow.stageName && (
                <Text style={[styles.stageName, { color: '#8b5cf6' }]}>{workflow.stageName}</Text>
              )}
              {workflow.monetaryValue && (
                <Text style={[styles.monetaryValue, { color: '#10b981' }]}>Value: £{workflow.monetaryValue.toLocaleString()}</Text>
              )}
            </View>
            
            {/* Outcome Status for Admin */}
            {user?.role === 'ADMIN' && (
              <View style={[
                styles.outcomeStatusBadge,
                {
                  backgroundColor: workflow.outcomeStatus === OpportunityOutcomeType.WON 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                    ? 'rgba(239, 68, 68, 0.1)'
                    : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(148, 163, 184, 0.1)',
                  borderColor: workflow.outcomeStatus === OpportunityOutcomeType.WON 
                    ? '#10b981' 
                    : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                    ? '#ef4444'
                    : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                    ? '#f59e0b'
                    : '#94a3b8',
                }
              ]}>
                <Feather 
                  name={
                    workflow.outcomeStatus === OpportunityOutcomeType.WON 
                      ? "check-circle" 
                      : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                      ? "x-circle"
                      : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                      ? "alert-circle"
                      : "clock"
                  } 
                  size={14} 
                  color={
                    workflow.outcomeStatus === OpportunityOutcomeType.WON 
                      ? '#10b981' 
                      : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                      ? '#ef4444'
                      : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                      ? '#f59e0b'
                      : '#94a3b8'
                  } 
                />
                <Text style={[
                  styles.outcomeStatusText,
                  {
                    color: workflow.outcomeStatus === OpportunityOutcomeType.WON 
                      ? '#10b981' 
                      : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                      ? '#ef4444'
                      : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                      ? '#f59e0b'
                      : '#94a3b8',
                  }
                ]}>
                  {workflow.outcomeStatus === OpportunityOutcomeType.WON 
                    ? 'Won' 
                    : workflow.outcomeStatus === OpportunityOutcomeType.LOST
                    ? 'Quote'
                    : workflow.outcomeStatus === OpportunityOutcomeType.ABANDONED
                    ? 'Abandoned'
                    : workflow.outcomeStatus === OpportunityOutcomeType.IN_PROGRESS
                    ? 'In Progress'
                    : 'In Progress'}
                </Text>
              </View>
            )}
            
            {/* Location Information */}
            {(workflow.contactAddress || workflow.contactPostcode) && (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={theme.secondaryText} />
                <Text style={[styles.locationText, { color: theme.secondaryText }]}>
                  {workflow.contactAddress || 'Address not available'}
                  {workflow.contactPostcode && `, ${workflow.contactPostcode}`}
                </Text>
              </View>
            )}
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(workflow.status) + '20' }
          ]}>
            <Text style={styles.statusIcon}>{getStatusIcon(workflow.status)}</Text>
            <Text style={[styles.statusText, { color: getStatusColor(workflow.status) }]}>
              {workflow.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressBackground, 
                { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(226, 232, 240, 0.6)' }
              ]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${workflow.progressPercentage}%`,
                      backgroundColor: getStatusColor(workflow.status)
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.secondaryText }]}>
                {workflow.progressPercentage}%
              </Text>
            </View>
            <Text style={[styles.progressLabel, { color: theme.secondaryText }]}>
              Step {workflow.currentStep} of {workflow.totalSteps}
            </Text>
            {/* Current Step Name */}
            <Text style={[styles.stepName, { color: theme.primaryText }]}>
              {workflow.stepTitle}
            </Text>
            <Text style={[styles.stepDescription, { color: theme.secondaryText }]}>
              {workflow.stepDescription}
            </Text>
          </View>
        </View>

        {/* Card Footer */}
        <View style={[styles.cardFooter, { borderTopColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(226, 232, 240, 0.6)' }]}>
          <View style={styles.lastActivityContainer}>
            <Feather name="clock" size={14} color={theme.secondaryText} />
            <Text style={[styles.lastActivity, { color: theme.secondaryText }]}>
              {new Date(workflow.lastActivityAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[
      styles.container, 
      { backgroundColor: theme.cardBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.secondaryText }]}>
              {isAuthenticated ? `Welcome back, ${user?.name || 'User'}` : 'Welcome'}
            </Text>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
              {user?.role === 'ADMIN' ? 'All Progress' : 'My Progress'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              {user?.role === 'ADMIN' 
                ? 'Monitor all solar installation progress across the team' 
                : 'Manage your solar installation progress'
              }
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={onRefresh}
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
        {/* Search bar */}
        <View style={[styles.searchBarContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(248, 250, 252, 0.9)', borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.8)' }]}>
          <Feather name="search" size={20} color={theme.secondaryText} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.primaryText }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, address, postcode, step..."
            placeholderTextColor={theme.tertiaryText || theme.secondaryText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.searchClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x-circle" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <Feather name="loader" size={48} color={theme.secondaryText} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading progress...</Text>
          </View>
        </View>
      ) : (
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryButton} />
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
              minHeight: '100vh' as any,
              paddingBottom: 100,
            }
          ]}
        >
          {activeWorkflows.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.cardBackground }]}>
                <Feather name="briefcase" size={64} color={theme.secondaryText} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>No Active Progress</Text>
              <Text style={[styles.emptyDescription, { color: theme.secondaryText }]}>
                Start a new progress to begin working with customers
              </Text>
              <TouchableOpacity
                style={[styles.startNewButton, { backgroundColor: theme.primaryButton }]}
                onPress={handleStartNewWorkflow}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={20} color="#ffffff" />
                <Text style={styles.startNewButtonText}>Start New Progress</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.workflowsContainer}>
              {filteredWorkflows.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: theme.cardBackground }]}>
                    <Feather name="search" size={64} color={theme.secondaryText} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>No matches</Text>
                  <Text style={[styles.emptyDescription, { color: theme.secondaryText }]}>
                    No progress matches "{searchQuery}". Try a different search.
                  </Text>
                  <TouchableOpacity
                    style={[styles.startNewButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => setSearchQuery('')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.startNewButtonText}>Clear search</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredWorkflows.map((workflow, index) => renderWorkflowCard(workflow, index))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backgroundImageStyle: {
    position: 'absolute',
    top: height * 0.3,
    left: 0,
    width: width,
    height: height * 0.4,
    opacity: 0.1,
    zIndex: -1,
  },
  
  // Enhanced Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 28,
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
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
  },
  searchClear: {
    padding: 4,
    marginLeft: 4,
  },
  greeting: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 16,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: width < 768 ? 28 : 36,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
    fontWeight: '500',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
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

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: width < 768 ? 16 : 20,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  startNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  startNewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Workflow Cards
  workflowsContainer: {
    paddingTop: 20,
  },
  workflowCard: {
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  workflowCardContent: {
    padding: width < 768 ? 20 : 24,
  },
  cardHeader: {
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: width < 768 ? 'flex-start' : 'flex-start',
    marginBottom: 20,
    gap: width < 768 ? 12 : 0,
  },
  customerInfo: {
    flex: 1,
    marginRight: width < 768 ? 0 : 16,
  },
  customerName: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
    lineHeight: width < 768 ? 28 : 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: width < 768 ? 16 : 20,
    paddingVertical: width < 768 ? 10 : 12,
    borderRadius: 20,
    overflow: 'hidden',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stageName: {
    fontSize: width < 768 ? 11 : 12,
    color: '#8b5cf6',
    fontWeight: '500',
    marginTop: 2,
  },
  monetaryValue: {
    fontSize: width < 768 ? 11 : 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  locationText: {
    fontSize: width < 768 ? 11 : 12,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  userInfoText: {
    fontSize: width < 768 ? 11 : 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width < 768 ? 10 : 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    minWidth: width < 768 ? 70 : 80,
    justifyContent: 'center',
    alignSelf: width < 768 ? 'flex-start' : 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    fontSize: width < 768 ? 11 : 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress Section
  progressSection: {
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: width < 768 ? 13 : 14,
    fontWeight: '600',
    color: '#64748b',
    minWidth: width < 768 ? 35 : 40,
    textAlign: 'right',
  },
  progressLabel: {
    fontSize: width < 768 ? 12 : 13,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  stepName: {
    fontSize: width < 768 ? 14 : 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: width < 768 ? 12 : 13,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  lastActivityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastActivity: {
    fontSize: width < 768 ? 12 : 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Outcome Status Badge
  outcomeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  outcomeStatusText: {
    fontSize: width < 768 ? 11 : 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },





});
