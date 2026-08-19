import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Modal,
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
import { api, opportunitiesApi, systemSettingsApi, workflowApi } from '../utils/api';
import BottomNavigation from '../components/BottomNavigation';
import CalculatorProgressService, { PricingOverrideOption } from '../services/CalculatorProgressService';
import { normalizeRouteParams, resolveOpportunityIdFromRoute } from '../utils/deepLinkParams';
import AppointmentVisitTypePanel from '../components/AppointmentVisitTypePanel';

const { width, height } = Dimensions.get('window');

/** Steps surveyors cannot re-run on legacy Off Peak opportunities (calculator entry stays open). */
const LEGACY_REGENERATION_STEP_TYPES = new Set([
  'SOLAR_PROJECTION',
  'FOLLOW_UP',
  'PROPOSAL_GENERATION',
  'INSTALLATION_SCHEDULING',
  'CONTRACT_SIGNING',
]);

const LEGACY_REGENERATION_MESSAGE =
  'This customer uses the previous Off Peak calculator. Proposal, HomeTree, contract, and calculator regeneration are only available to administrators.';

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
}

export default function SolarWorkflowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = normalizeRouteParams(route.params as Record<string, unknown>);
  const opportunityId =
    resolveOpportunityIdFromRoute(route.params, 'solar-workflow') ??
    (params.opportunityId as string | undefined) ??
    '';
  const passedOpportunity = (route.params as RouteParams)?.opportunity;
  const { user, isAuthenticated } = useAuth();
  const isAdminUser = user?.role === 'ADMIN';
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [opportunity, setOpportunity] = useState<any | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<any[]>([]);
  const [workflowProgress, setWorkflowProgress] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [pricingOverrideOptions, setPricingOverrideOptions] = useState<PricingOverrideOption[]>([]);
  const [loadingPricingOverrides, setLoadingPricingOverrides] = useState(false);
  const [selectedCalculatorType, setSelectedCalculatorType] = useState<'off-peak' | 'flux' | 'epvs' | null>(null);
  const [overridePriceInput, setOverridePriceInput] = useState('');
  const [isApplyingOverride, setIsApplyingOverride] = useState(false);

  const legacyRegenerationBlocked = !!workflowProgress?.legacyRegenerationBlocked;

  const blockLegacyRegenerationStep = (stepType?: string): boolean => {
    if (!legacyRegenerationBlocked || !stepType) {
      return false;
    }
    if (!LEGACY_REGENERATION_STEP_TYPES.has(stepType)) {
      return false;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(LEGACY_REGENERATION_MESSAGE);
    } else {
      Alert.alert('Previous calculator', LEGACY_REGENERATION_MESSAGE);
    }
    return true;
  };
  
  // Welcome Email state removed - now using dedicated WelcomeEmailScreen
  
  // Payment state (removed - now using dedicated PaymentScreen)
  
  // OpenSolar state
  const [openSolarProjectId, setOpenSolarProjectId] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Step navigation control
  const [stepNavigationEnabled, setStepNavigationEnabled] = useState(true);
  
  // Job status state
  const [jobStatus, setJobStatus] = useState<'WON' | 'LOST' | 'IN_PROGRESS' | null>('IN_PROGRESS'); // Default to IN_PROGRESS
  const [jobStatusLoading, setJobStatusLoading] = useState(false);
  
  // Outcome selection state
  const [showOutcomeSelection, setShowOutcomeSelection] = useState(false);
  const [isProcessingOutcome, setIsProcessingOutcome] = useState(false);
  const [isTrainingOpportunity, setIsTrainingOpportunity] = useState(false);

  const getCustomerDetailsForCalculator = () => {
    const name =
      opportunity?.name ||
      customerInfo?.name ||
      passedOpportunity?.name ||
      '';
    const address =
      opportunity?.contactAddress ||
      passedOpportunity?.contactAddress ||
      '';
    const postcode =
      opportunity?.contactPostcode ||
      passedOpportunity?.contactPostcode ||
      customerInfo?.postcode ||
      '';
    if (!name && !address && !postcode) {
      return undefined;
    }
    return {
      customerName: name,
      address: address || '',
      postcode: postcode || '',
    };
  };

  useEffect(() => {
    // Load all data in parallel for faster loading
    Promise.all([
      loadData(),
      loadStepNavigationSetting(),
      loadJobStatus()
    ]).catch(error => {
      console.error('🔍 SolarWorkflowScreen: Error loading initial data:', error);
    });
  }, [opportunityId, user?.role]);

  // Refresh step navigation setting when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔍 SolarWorkflowScreen: Screen focused, refreshing step navigation setting and job status');
      // Load in parallel for faster refresh
      Promise.all([
        loadStepNavigationSetting(),
        loadJobStatus()
      ]).catch(error => {
        console.error('🔍 SolarWorkflowScreen: Error refreshing data on focus:', error);
      });
    });

    return unsubscribe;
  }, [navigation]);

  // Test API endpoints function
  const testApiEndpoints = async () => {
    try {
      console.log('🔍 SolarWorkflowScreen: Testing API endpoints...');
      
      // Test health check
      const { healthCheck } = await import('../utils/api');
      const isHealthy = await healthCheck();
      console.log('🔍 SolarWorkflowScreen: Health check result:', isHealthy);
      
      // Test workflow steps
      const stepsResponse = await workflowApi.getWorkflowSteps();
      console.log('🔍 SolarWorkflowScreen: Direct workflow steps test:', {
        success: stepsResponse.success,
        data: stepsResponse.data,
        error: stepsResponse.error
      });
      
      // Test opportunity progress
      const progressResponse = await workflowApi.getOpportunityProgress(opportunityId);
      console.log('🔍 SolarWorkflowScreen: Direct progress test:', {
        success: progressResponse.success,
        data: progressResponse.data,
        error: progressResponse.error
      });
      
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: API test error:', error);
    }
  };

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  // Refresh data when screen comes into focus (e.g., after survey completion or when returning from Survey).
  // This ensures workflow steps are recalculated so the Energy Bill Disclaimer step appears if the user
  // changed hasEnergyBill from Yes to No and saved/submitted.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔍 SolarWorkflowScreen: Screen focused, refreshing data...');
      loadData();
    });

    return unsubscribe;
  }, [navigation]);

  // Add periodic health check to detect backend restarts
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        const { healthCheck } = await import('../utils/api');
        const isHealthy = await healthCheck();
        if (!isHealthy) {
          console.log('🔧 Backend health check failed, will retry on next interaction');
        }
      } catch (error) {
        console.error('🔧 Health check error:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, []);

    // Ensure modal is never shown for steps that have direct navigation
    useEffect(() => {
      const currentStepInfo = workflowSteps.find(step => step.stepNumber === currentStep);
      const directNavigationSteps = ['SITE_SURVEY', 'OPEN_SOLAR', 'CALCULATOR', 'SOLAR_PROJECTION', 'FOLLOW_UP', 'PROPOSAL_GENERATION', 'DISCLAIMER_SIGNING', 'CONTRACT_SIGNING', 'EXPRESS_CONSENT', 'EMAIL_CONFIRMATION', 'PAYMENT', 'INSTALLATION_SCHEDULING', 'INSTALLATION_BOOKING', 'WELCOME_EMAIL'];
      
      if (currentStepInfo && directNavigationSteps.includes(currentStepInfo.stepType)) {
        setShowStepModal(false);
      }
    }, [currentStep, workflowSteps]);

  // Load step navigation setting
  const loadStepNavigationSetting = async () => {
    try {
      console.log('🔍 SolarWorkflowScreen: Loading step navigation setting...');
      const response = await systemSettingsApi.getSettingValue('step_navigation_enabled');
      
      if (response.success && response.data !== null) {
        try {
          const enabled = JSON.parse(response.data || 'true');
          setStepNavigationEnabled(enabled);
          console.log('🔍 SolarWorkflowScreen: Step navigation setting loaded:', enabled);
        } catch (parseError) {
          console.error('🔍 SolarWorkflowScreen: Error parsing step navigation setting:', parseError);
          setStepNavigationEnabled(true); // Default to enabled
        }
      } else {
        console.log('🔍 SolarWorkflowScreen: Step navigation setting not found, defaulting to enabled');
        setStepNavigationEnabled(true); // Default to enabled
      }
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: Error loading step navigation setting:', error);
      setStepNavigationEnabled(true); // Default to enabled
    }
  };

  const checkIfDisclaimerNeeded = async (): Promise<boolean> => {
    try {
      console.log('🔍 SolarWorkflowScreen: Checking if disclaimer is needed for opportunity:', opportunityId);
      const { resolveDisclaimerNeededForOpportunity } = await import('../utils/disclaimerDisplay');
      return await resolveDisclaimerNeededForOpportunity(opportunityId);
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: Error checking disclaimer requirement:', error);
      return true;
    }
  };

  const isDisclaimerWorkflowComplete = () =>
    Boolean(
      workflowProgress?.disclaimerCompleted ||
        workflowProgress?.stepData?.disclaimerCompletedAt,
    );

  // Helper function to determine if workflow is already started
  const isWorkflowStarted = () => {
    if (!workflowProgress) {
      console.log('🔍 SolarWorkflowScreen: isWorkflowStarted - No workflowProgress, returning false');
      return false;
    }
    
    // A workflow is considered started if:
    // 1. It has a startedAt field
    // 2. Current step is greater than 1 (meaning progress has been made)
    // 3. There are any completed steps
    // 4. The workflow has been initialized (has steps data)
    const hasStartedAt = !!workflowProgress.startedAt;
    const hasProgress = !!(workflowProgress.currentStep && workflowProgress.currentStep > 1);
    const hasCompletedSteps = !!(workflowProgress.steps && workflowProgress.steps.some((step: any) => step.status === 'COMPLETED'));
    const hasSteps = !!(workflowProgress.steps && workflowProgress.steps.length > 0);
    
    const isStarted = !!(hasStartedAt || hasProgress || hasCompletedSteps || hasSteps);
    
    console.log('🔍 SolarWorkflowScreen: isWorkflowStarted check:', {
      hasStartedAt,
      hasProgress,
      hasCompletedSteps,
      hasSteps,
      currentStep: workflowProgress.currentStep,
      stepsCount: workflowProgress.steps?.length || 0,
      isStarted
    });
    
    return isStarted;
  };

  const loadData = async () => {
    try {
      console.log('🔍 SolarWorkflowScreen: Starting loadData with opportunityId:', opportunityId);
      setLoading(true);
      
      // Load workflow steps
      console.log('🔍 SolarWorkflowScreen: Calling getWorkflowSteps API...');
      const stepsResponse = await workflowApi.getWorkflowSteps();
      console.log('🔍 SolarWorkflowScreen: getWorkflowSteps response:', {
        success: stepsResponse.success,
        data: stepsResponse.data,
        error: stepsResponse.error
      });
      
      if (stepsResponse.success && stepsResponse.data) {
        console.log('🔍 SolarWorkflowScreen: Raw workflow steps from API:', stepsResponse.data);
        
        // Transform the steps to match the new workflow structure
        const transformedSteps = stepsResponse.data.map((step: any) => {
          console.log('🔍 SolarWorkflowScreen: Processing step:', step);
          
          // Handle step type transformations
          switch (step.stepType) {
            case 'SITE_SURVEY':
              return {
                ...step,
                title: 'Survey',
                description: 'Conduct the on-site survey',
                stepType: 'SITE_SURVEY'
              };
            case 'OPEN_SOLAR':
              return {
                ...step,
                title: 'Link OpenSolar Design',
                description:
                  'Enter the OpenSolar project ID or property address to link the design you created before the appointment',
                stepType: 'OPEN_SOLAR'
              };
            case 'CALCULATOR':
              return {
                ...step,
                title: 'Calculate',
                description: 'Enter system details and generate the proposal',
                stepType: 'CALCULATOR'
              };
            case 'SOLAR_PROJECTION':
              return {
                ...step,
                title: 'Solar Projection',
                description: 'Review detailed solar projection data and financial analysis',
                stepType: 'SOLAR_PROJECTION'
              };
            case 'FOLLOW_UP':
              return {
                ...step,
                title: 'Proposal',
                description: 'Present the final proposal to the customer',
                stepType: 'FOLLOW_UP'
              };
            case 'PROPOSAL_GENERATION':
              return {
                ...step,
                title: 'Contract Generation',
                description: 'Generate contract and proposal documents',
                stepType: 'PROPOSAL_GENERATION'
              };
            case 'INSTALLATION_SCHEDULING':
              return {
                ...step,
                title: 'Hometree',
                description: 'View contract data and fill in the Hometree quote',
                stepType: 'INSTALLATION_SCHEDULING'
              };
            case 'INSTALLATION_BOOKING':
              return {
                ...step,
                title: 'Book Installation',
                description: 'Schedule your solar installation appointment',
                stepType: 'INSTALLATION_BOOKING'
              };
            case 'CONTRACT_SIGNING':
              return {
                ...step,
                title: 'Contract Signing',
                description: 'Sign the installation contract',
                stepType: 'CONTRACT_SIGNING'
              };
            case 'EXPRESS_CONSENT':
              return {
                ...step,
                title: 'Express Consent Signing',
                description: 'Sign the express consent form for work to commence',
                stepType: 'EXPRESS_CONSENT'
              };
            case 'PAYMENT':
              return {
                ...step,
                title: 'Payment',
                description: 'Process payment for the installation',
                stepType: 'PAYMENT'
              };
            case 'WELCOME_EMAIL':
              return {
                ...step,
                title: 'Send Welcome Email',
                description: 'Send welcome email to customer with installation details',
                stepType: 'WELCOME_EMAIL'
              };
            case 'DISCLAIMER_SIGNING':
              return {
                ...step,
                title: 'Energy Bill Disclaimer',
                description: 'Sign disclaimer form at sign.com for customers without energy bills',
                stepType: 'DISCLAIMER_SIGNING'
              };
            case 'EMAIL_CONFIRMATION':
              return {
                ...step,
                title: 'Booking Confirmation Signing',
                description: 'Sign the booking confirmation letter',
                stepType: 'EMAIL_CONFIRMATION'
              };
            case 'BOOKING_CONFIRMATION':
              return {
                ...step,
                title: 'Booking Confirmation Signing',
                description: 'Sign the booking confirmation letter',
                stepType: 'BOOKING_CONFIRMATION'
              };
            default:
              console.log('🔍 SolarWorkflowScreen: Unknown step type:', step.stepType);
              return step;
          }
        });
        
        // Check if disclaimer step should be shown BEFORE sorting
        // This will be determined by checking the survey data for hasEnergyBill
        const shouldShowDisclaimer = await checkIfDisclaimerNeeded();
        
        // Add disclaimer step if needed BEFORE sorting
        if (shouldShowDisclaimer) {
          // Add disclaimer step if it doesn't exist and is needed
          const disclaimerStepExists = transformedSteps.some((step: any) => step.stepType === 'DISCLAIMER_SIGNING');
          
          if (!disclaimerStepExists) {
            console.log('🔍 SolarWorkflowScreen: Adding disclaimer step - not found in backend steps');
            const disclaimerStep = {
              stepNumber: 8, // Will be renumbered later
              stepType: 'DISCLAIMER_SIGNING',
              title: 'Energy Bill Disclaimer',
              description: 'Sign disclaimer form for customers without energy bills',
              required: true,
              estimatedDuration: 15
            };
            transformedSteps.push(disclaimerStep);
            console.log('🔍 SolarWorkflowScreen: Added disclaimer step to workflow');
          } else {
            console.log('🔍 SolarWorkflowScreen: Disclaimer step already exists in workflow');
          }
        }

        // Add express consent step if it's missing (some backends may not yet return it in /steps). Admins skip this step in the UI.
        if (!isAdminUser) {
          const expressConsentStepExists = transformedSteps.some((step: any) => step.stepType === 'EXPRESS_CONSENT');
          if (!expressConsentStepExists) {
            console.log('🔍 SolarWorkflowScreen: Adding express consent step - not found in backend steps');
            transformedSteps.push({
              stepNumber: 9, // Placeholder - will be renumbered later
              stepType: 'EXPRESS_CONSENT',
              title: 'Express Consent Signing',
              description: 'Sign the express consent form for work to commence',
              required: true,
              estimatedDuration: 10
            });
          }
        }
        
        // Sort steps to ensure proper order (now includes disclaimer step if needed)
        const sortedSteps = transformedSteps.sort((a: any, b: any) => {
          // Define the desired order - matches backend workflow configuration
          const stepOrder = {
            'SITE_SURVEY': 1,
            'OPEN_SOLAR': 2,
            'CALCULATOR': 3,
            'FOLLOW_UP': 4,
            'SOLAR_PROJECTION': 5,
            'INSTALLATION_SCHEDULING': 6, // Hometree
            'PROPOSAL_GENERATION': 7,
            'DISCLAIMER_SIGNING': 8, // Disclaimer step before contract signing
            'CONTRACT_SIGNING': 9,
            'EXPRESS_CONSENT': 10,
            'BOOKING_CONFIRMATION': 11,
            'EMAIL_CONFIRMATION': 11,
            'PAYMENT': 12,
            'INSTALLATION_BOOKING': 13,
            'WELCOME_EMAIL': 14
          };
          
          const orderA = stepOrder[a.stepType as keyof typeof stepOrder] || 999;
          const orderB = stepOrder[b.stepType as keyof typeof stepOrder] || 999;
          
          return orderA - orderB;
        });
        
        // Filter out disclaimer step if not needed
        let finalSteps = sortedSteps;
        if (!shouldShowDisclaimer) {
          finalSteps = finalSteps.filter((step: any) => step.stepType !== 'DISCLAIMER_SIGNING');
          console.log('🔍 SolarWorkflowScreen: Filtered out disclaimer step - user has energy bill');
        }
        if (isAdminUser) {
          finalSteps = finalSteps.filter(
            (step: any) =>
              step.stepType !== 'BOOKING_CONFIRMATION' &&
              step.stepType !== 'EMAIL_CONFIRMATION'
          );
          console.log('🔍 SolarWorkflowScreen: Filtered out booking confirmation steps - admin user');
        }
        
        // Reassign step numbers based on the new order
        const renumberedSteps = finalSteps.map((step: any, index: number) => ({
          ...step,
          stepNumber: index + 1
        }));
        
        console.log('🔍 SolarWorkflowScreen: Renumbered workflow steps:', renumberedSteps);
        setWorkflowSteps(renumberedSteps);
        console.log('🔍 SolarWorkflowScreen: Set workflowSteps state with', renumberedSteps.length, 'steps');
      } else {
        console.error('🔍 SolarWorkflowScreen: Failed to get workflow steps:', stepsResponse.error);
      }
      
      // Load workflow progress
      console.log('🔍 SolarWorkflowScreen: Calling getOpportunityProgress API...');
      
      // Add timeout to prevent hanging
      const progressPromise = workflowApi.getOpportunityProgress(opportunityId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Progress API timeout')), 10000)
      );
      
      let progressResponse: any;
      try {
        progressResponse = await Promise.race([progressPromise, timeoutPromise]);
        console.log('🔍 SolarWorkflowScreen: getOpportunityProgress response:', {
          success: progressResponse.success,
          data: progressResponse.data,
          error: progressResponse.error
        });
      } catch (timeoutError) {
        console.error('🔍 SolarWorkflowScreen: Progress API timed out or failed:', timeoutError);
        console.log('🔍 SolarWorkflowScreen: Starting fresh workflow due to timeout');
        setWorkflowProgress(null);
        setCurrentStep(1);
        progressResponse = { success: false, data: null, error: 'API timeout' };
      }
      
      if (progressResponse.success && progressResponse.data) {
        console.log('🔍 SolarWorkflowScreen: Setting workflow progress:', progressResponse.data);
        setWorkflowProgress(progressResponse.data);
        setCurrentStep(progressResponse.data.currentStep);
        console.log('🔍 SolarWorkflowScreen: Set currentStep to:', progressResponse.data.currentStep);
        
        // Check for OpenSolar project ID in the workflow progress
        const openSolarStep = progressResponse.data.steps?.find((step: any) => step.stepType === 'OPEN_SOLAR');
        console.log('🔍 SolarWorkflowScreen: OpenSolar step found:', openSolarStep);
        if (openSolarStep && openSolarStep.data && openSolarStep.data.opensolarProjectId) {
          console.log('🔍 SolarWorkflowScreen: Found OpenSolar project ID:', openSolarStep.data.opensolarProjectId);
          setOpenSolarProjectId(openSolarStep.data.opensolarProjectId);
        } else {
          console.log('🔍 SolarWorkflowScreen: No OpenSolar project ID found in step data');
          setOpenSolarProjectId(null);
        }
        
        // Debug all steps status
        console.log('🔍 SolarWorkflowScreen: All steps status:', progressResponse.data.steps?.map((step: any) => ({
          stepNumber: step.stepNumber,
          stepType: step.stepType,
          status: step.status,
          data: step.data
        })));
      } else {
        console.log('🔍 SolarWorkflowScreen: No existing progress, starting new workflow...');
        // Start new workflow if none exists
        try {
          const startPromise = workflowApi.startOpportunity(opportunityId);
          const startTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Start workflow API timeout')), 8000)
          );
          
          const startResponse: any = await Promise.race([startPromise, startTimeoutPromise]);
          console.log('🔍 SolarWorkflowScreen: startOpportunity response:', {
            success: startResponse.success,
            data: startResponse.data,
            error: startResponse.error
          });
        
          if (startResponse.success && startResponse.data) {
            console.log('🔍 SolarWorkflowScreen: Setting new workflow progress:', startResponse.data);
            setWorkflowProgress(startResponse.data);
            setCurrentStep(startResponse.data.currentStep);
            console.log('🔍 SolarWorkflowScreen: Set currentStep to:', startResponse.data.currentStep);
          } else {
            console.error('🔍 SolarWorkflowScreen: Failed to start opportunity:', startResponse.error);
          }
        } catch (startError) {
          console.error('🔍 SolarWorkflowScreen: Error starting workflow (including timeout):', startError);
          console.log('🔍 SolarWorkflowScreen: Starting fresh workflow due to start error');
          setWorkflowProgress(null);
          setCurrentStep(1);
        }
      }

      // Set opportunity data
      if (passedOpportunity) {
        console.log('🔍 SolarWorkflowScreen: Using passed opportunity:', passedOpportunity);
        setOpportunity(passedOpportunity);
        
        // Extract customer information from passed opportunity
        if (passedOpportunity.name || passedOpportunity.contactPostcode) {
          setCustomerInfo({
            name: passedOpportunity.name || 'Loading...',
            postcode: passedOpportunity.contactPostcode || passedOpportunity.postcode || 'Loading...'
          });
        }
      } else {
        console.log('🔍 SolarWorkflowScreen: No passed opportunity, fetching customer details from API');
        try {
          // Fetch customer details from the API
          const { api } = await import('../utils/api');
          const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
          
          if (customerResponse.success && customerResponse.data) {
            console.log('🔍 SolarWorkflowScreen: Fetched customer details:', customerResponse.data);
            const customerData = customerResponse.data;
            
            // Create opportunity with real customer data
            const realOpportunity = {
              id: opportunityId,
              name: (customerData as any).name || 'Solar Installation Project',
              stageName: 'Survey Pending',
              monetaryValue: 0,
              type: 'ai',
              contactPostcode: (customerData as any).postcode,
              contactAddress: (customerData as any).address,
              contactEmail: (customerData as any).email
            };
            setOpportunity(realOpportunity);
            
            // Set customer info for header display
            if ((customerData as any).name || (customerData as any).postcode) {
              setCustomerInfo({
                name: (customerData as any).name || 'Loading...',
                postcode: (customerData as any).postcode || 'Loading...'
              });
            }
            
            console.log('🔍 SolarWorkflowScreen: Set opportunity with real customer data:', realOpportunity);
          } else {
            console.log('🔍 SolarWorkflowScreen: Failed to fetch customer details, using default');
            const defaultOpportunity = {
              id: opportunityId,
              name: 'Solar Installation Project',
              stageName: 'Survey Pending',
              monetaryValue: 0,
              type: 'ai',
            };
            setOpportunity(defaultOpportunity);
            console.log('🔍 SolarWorkflowScreen: Set opportunity to default:', defaultOpportunity);
          }
        } catch (error) {
          console.error('🔍 SolarWorkflowScreen: Error fetching customer details:', error);
          // Fallback to default opportunity
          const defaultOpportunity = {
            id: opportunityId,
            name: 'Solar Installation Project',
            stageName: 'Survey Pending',
            monetaryValue: 0,
            type: 'ai',
          };
          setOpportunity(defaultOpportunity);
          console.log('🔍 SolarWorkflowScreen: Set opportunity to default after error:', defaultOpportunity);
        }
      }
      
      try {
        const oppDetailsRes = await api.get(`/opportunities/${opportunityId}`);
        const oppSource = (oppDetailsRes.data as any)?.source ?? (oppDetailsRes.data as any)?.opportunity?.source;
        setIsTrainingOpportunity(oppSource === 'TRAINING');
      } catch {
        setIsTrainingOpportunity(false);
      }

      console.log('🔍 SolarWorkflowScreen: loadData completed successfully');
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: Error in loadData:', error);
      Alert.alert('Error', 'Failed to load progress data');
    } finally {
      setLoading(false);
      console.log('🔍 SolarWorkflowScreen: Loading state set to false');
    }
  };

  // Load job status from opportunity outcomes
  const loadJobStatus = async () => {
    if (jobStatusLoading) return; // Prevent multiple simultaneous calls
    
    try {
      setJobStatusLoading(true);
      console.log('🔍 SolarWorkflowScreen: Loading job status for opportunity:', opportunityId);
      
      // Try to fetch opportunity outcome with timeout
      const { api } = await import('../utils/api');
      
      // Use Promise.race to add timeout (shorter timeout since this endpoint may not exist)
      const outcomePromise = api.get(`/opportunity-outcomes/opportunity/${opportunityId}`);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1000)
      );
      
      try {
        const response = await Promise.race([outcomePromise, timeoutPromise]) as any;
        
        if (response.success && response.data) {
          const outcome = response.data as any;
          console.log('🔍 SolarWorkflowScreen: Found opportunity outcome:', outcome);
          setJobStatus(outcome.outcome);
          return; // Exit early if we found the outcome
        }
      } catch (timeoutError) {
        // Silently handle timeout/404 - this is expected if outcome endpoint doesn't exist
        console.log('🔍 SolarWorkflowScreen: Outcome API not available, using opportunity status');
      }
      
      // If no outcome found or timeout, check the opportunity status from GHL
      console.log('🔍 SolarWorkflowScreen: No outcome found, checking opportunity status');
      
      const opportunityPromise = api.get(`/opportunities/${opportunityId}`);
      const opportunityTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      );
      
      try {
        const opportunityResponse = await Promise.race([opportunityPromise, opportunityTimeoutPromise]) as any;
        
        if (opportunityResponse.success && opportunityResponse.data) {
          const opp = opportunityResponse.data as any;
          const status = opp.status?.toLowerCase();
          
          // Only use GHL status if it's clearly a final status
          // If GHL shows "won" but no outcome record exists, default to IN_PROGRESS
          let newStatus: 'WON' | 'LOST' | 'IN_PROGRESS';
          if (status === 'lost' || status === 'closed lost' || status === 'no sale') {
            newStatus = 'LOST';
            setJobStatus('LOST');
          } else if (status === 'won' || status === 'closed won' || status === 'sold') {
            // Only set to WON if we have a corresponding outcome record
            // Since outcome API returned 404, default to IN_PROGRESS
            newStatus = 'IN_PROGRESS';
            setJobStatus('IN_PROGRESS');
            console.log('🔍 SolarWorkflowScreen: GHL shows won but no outcome record found, defaulting to IN_PROGRESS');
          } else {
            newStatus = 'IN_PROGRESS';
            setJobStatus('IN_PROGRESS');
          }
          
          console.log('🔍 SolarWorkflowScreen: Set job status from opportunity:', {
            status: opp.status,
            newJobStatus: newStatus
          });
        } else {
          // Keep default IN_PROGRESS if we can't determine status
          console.log('🔍 SolarWorkflowScreen: Keeping default IN_PROGRESS status');
        }
      } catch (timeoutError) {
        // Silently handle timeout - keep default status
        console.log('🔍 SolarWorkflowScreen: Opportunity API timeout, keeping default status');
      }
      
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: Error loading job status:', error);
      // Keep default IN_PROGRESS on error
    } finally {
      setJobStatusLoading(false);
    }
  };

  // OpenSolar workflow handlers
  const handleOpenSolarCreate = async () => {
    try {
      // Navigate to OpenSolar WebView screen
      navigation.navigate('OpenSolarWebView', { 
        opportunityId,
        opportunity 
      });
      setShowStepModal(false);
    } catch (error) {
      console.error('Error opening OpenSolar:', error);
      Alert.alert('Error', 'Failed to open OpenSolar');
    }
  };





  const handleOpenSolarComplete = async () => {
    try {
      // Mark OpenSolar step as completed
      const openSolarStep = workflowSteps.find(step => step.stepType === 'OPEN_SOLAR');
      if (openSolarStep) {
        await workflowApi.completeStep(opportunityId, openSolarStep.stepNumber, {
          opensolarProjectId: openSolarProjectId,
          projectName: `Project ${opportunity?.name || 'Solar Project'}`,
          completedAt: new Date().toISOString()
        });
      }

      // Refresh data to update the UI
      await loadData();

      Alert.alert(
        'Success!', 
        'OpenSolar step completed successfully! You can now continue to the Calculator step.',
        [
          {
            text: 'Continue to Calculator',
            onPress: () => {
              setShowStepModal(false);
              // Navigate to next step
              handleStepPress(3);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error completing OpenSolar step:', error);
      Alert.alert('Error', 'Failed to complete OpenSolar step');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadJobStatus();
    setRefreshing(false);
  };

  // Function to reset job status to IN_PROGRESS
  const resetJobStatus = () => {
    setJobStatus('IN_PROGRESS');
    console.log('🔍 SolarWorkflowScreen: Job status reset to IN_PROGRESS');
  };

  // Hometree step opens HometreeDataScreen via handleStepPress (INSTALLATION_SCHEDULING)

  // Signing step handlers - redirect to sign.com
  const handleSigningStep = async (stepType: string) => {
    try {
      const url = 'https://sign.com/sign-pdf/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        
        // Mark the step as completed
        const signingStep = workflowSteps.find(step => step.stepType === stepType);
        if (signingStep) {
          const stepProgress = workflowProgress?.steps.find((s: any) => s.stepNumber === signingStep.stepNumber);
          if (stepProgress && stepProgress.status !== 'COMPLETED') {
            try {
              await workflowApi.completeStep(opportunityId, signingStep.stepNumber);
              // Refresh data to update the UI
              await loadData();
              
              const stepName = stepType === 'DISCLAIMER_SIGNING' ? 'Energy Bill Disclaimer' :
                              stepType === 'CONTRACT_SIGNING' ? 'Contract Signing' :
                              stepType === 'EXPRESS_CONSENT' ? 'Express Consent Signing' :
                              (stepType === 'BOOKING_CONFIRMATION' || stepType === 'EMAIL_CONFIRMATION') ? 'Booking Confirmation Signing' :
                              'Document';
              
              Alert.alert('✅ Document Signing', `${stepName} step marked as completed. You can visit sign.com anytime to sign documents.`);
            } catch (error) {
              console.error('Error completing signing step:', error);
            }
          }
        }
      } else {
        Alert.alert('Error', 'Cannot open sign.com website');
      }
    } catch (error) {
      console.error('Error opening sign.com:', error);
      Alert.alert('Error', 'Failed to open sign.com website');
    }
  };

  // Payment handlers removed - now using dedicated PaymentScreen

  // Welcome Email handlers removed - now using dedicated WelcomeEmailScreen


  const handleResetProgress = async () => {
    try {
      console.log('🔍 SolarWorkflowScreen: Resetting progress for opportunity:', opportunityId);
      
      // Call the reset progress API
      const resetResponse = await workflowApi.resetWorkflow(opportunityId);
      console.log('🔍 SolarWorkflowScreen: Reset progress response:', {
        success: resetResponse.success,
        data: resetResponse.data,
        error: resetResponse.error
      });
      
      if (resetResponse.success) {
        // Backend has successfully reset the workflow progress
        // Refresh data to get the fresh workflow state from backend
        await loadData();
        
        Alert.alert(
          '✅ Progress Reset', 
          'All workflow progress has been reset successfully. You can now start fresh.',
          [{ text: 'OK' }]
        );
      } else {
        console.error('🔍 SolarWorkflowScreen: Failed to reset progress:', resetResponse.error);
        Alert.alert('Error', 'Failed to reset progress. Please try again.');
      }
    } catch (error) {
      console.error('🔍 SolarWorkflowScreen: Error resetting progress:', error);
      Alert.alert('Error', 'Failed to reset progress. Please try again.');
    } finally {
      setShowResetModal(false);
    }
  };

  const openToolsModal = async () => {
    setShowToolsModal(true);
    setLoadingPricingOverrides(true);
    setSelectedCalculatorType(null);
    setOverridePriceInput('');
    try {
      const options = await CalculatorProgressService.getPricingOverrideOptions(opportunityId);
      setPricingOverrideOptions(options);
      if (options.length > 0) {
        setSelectedCalculatorType(options[0].calculatorType);
        setOverridePriceInput(options[0].currentPrice || '');
      }
    } catch (error) {
      console.error('Error loading pricing override options:', error);
      Alert.alert('Error', 'Failed to load calculator pricing data');
    } finally {
      setLoadingPricingOverrides(false);
    }
  };

  const applyPriceOverride = async () => {
    if (!selectedCalculatorType) {
      Alert.alert('Select Calculator', 'Please select a calculator first.');
      return;
    }
    const parsed = Number(overridePriceInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid non-negative number.');
      return;
    }
    setIsApplyingOverride(true);
    try {
      const result = await CalculatorProgressService.overrideCalculatorPrice(
        opportunityId,
        selectedCalculatorType,
        parsed
      );
      if (!result.success) {
        Alert.alert('Failed', result.message || 'Could not override price.');
        return;
      }
      if (result.warning) {
        Alert.alert('Updated with warning', `${result.message}\n\n${result.warning}`);
      } else {
        Alert.alert('Success', result.message || 'Price overridden successfully.');
      }
      await openToolsModal();
    } catch (error) {
      console.error('Error applying price override:', error);
      Alert.alert('Error', 'Failed to override price.');
    } finally {
      setIsApplyingOverride(false);
    }
  };

  // Handle outcome selection (same logic as FinishAppointmentScreen)
  const handleOutcomeSelect = async (outcome: 'won' | 'lost') => {
    try {
      setIsProcessingOutcome(true);

      const finishStep = await workflowApi.getWorkflowSteps();
      const welcomeStepNumber =
        finishStep.success && finishStep.data
          ? finishStep.data.find((s: any) => s.stepType === 'WELCOME_EMAIL')?.stepNumber ?? 13
          : 13;

      const completeResult = await workflowApi.completeStep(opportunityId, welcomeStepNumber, {
        outcome,
        organizedAt: new Date().toISOString(),
      });

      if (!completeResult.success) {
        throw new Error(completeResult.error || 'Failed to complete workflow outcome step');
      }

      // Keep CRM status in sync without blocking OneDrive finalization on duplicate outcome writes
      void opportunitiesApi.updateStatus(opportunityId, outcome).catch((error) => {
        console.warn('Opportunity status update failed:', error);
      });

      setJobStatus(outcome.toUpperCase() as 'WON' | 'LOST');
      setShowOutcomeSelection(false);

      await loadData();
      await loadJobStatus();

      Alert.alert(
        'Appointment Completed',
        outcome === 'won'
          ? 'Copied the Quotes pack into Customer Orders. Quotes still has the live copies.'
          : 'Files stay in Customer Quotes for this quoted outcome.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error processing outcome:', error);
      Alert.alert('Error', 'Failed to finalize appointment files. Please try again.');
    } finally {
      setIsProcessingOutcome(false);
    }
  };

  const handleProposalStep = () => {
    console.log('🔍 Navigating to proposal screen');
    navigation.navigate('Presentation', { opportunityId });
  };



  const handleStepPress = async (stepNumber: number) => {
    console.log('🔍 Step pressed:', stepNumber);
    const stepInfo = workflowSteps.find(step => step.stepNumber === stepNumber);
    console.log('🔍 Step info:', stepInfo?.title, stepInfo?.stepType, 'Step number:', stepInfo?.stepNumber);

    if (blockLegacyRegenerationStep(stepInfo?.stepType)) {
      return;
    }
    
    // Check step navigation permission
    // If step navigation is disabled, enforce step order
    const shouldEnforceStepOrder = !stepNavigationEnabled;
    
    if (shouldEnforceStepOrder) {
      const stepProgress =
        workflowProgress?.steps.find((s: any) => s.stepType === stepInfo?.stepType) ??
        workflowProgress?.steps.find((s: any) => s.stepNumber === stepNumber);
      const isCompleted =
        stepProgress?.status === 'COMPLETED' ||
        (stepInfo?.stepType === 'DISCLAIMER_SIGNING' && isDisclaimerWorkflowComplete());
      const isSkipped = stepProgress?.status === 'SKIPPED';
      const currentStepMeta = workflowProgress?.steps?.find((s: any) => s.stepNumber === currentStep);
      let isCurrent: boolean;
      if (isAdminUser && currentStepMeta?.stepType === 'EXPRESS_CONSENT') {
        isCurrent =
          stepInfo?.stepType === 'BOOKING_CONFIRMATION' || stepInfo?.stepType === 'EMAIL_CONFIRMATION';
      } else if (currentStepMeta?.stepType && stepInfo?.stepType) {
        isCurrent = stepInfo.stepType === currentStepMeta.stepType;
      } else {
        isCurrent = stepNumber === currentStep;
      }
      
      // First 3 steps (Survey, OpenSolar, Calculator) are always accessible
      const isFirstThreeSteps = stepInfo?.stepType === 'SITE_SURVEY' || 
                                stepInfo?.stepType === 'OPEN_SOLAR' || 
                                stepInfo?.stepType === 'CALCULATOR' ||
                                stepNumber <= 3;
      
      // Check if all previous steps are completed or skipped
      const arePreviousStepsCompleted = () => {
        // First 3 steps are always accessible
        if (isFirstThreeSteps) {
          return true;
        }
        
        if (!workflowProgress?.steps || stepNumber === 1) {
          return true; // First step is always accessible
        }
        
        // Check all steps before this one (match progress by step type so it stays correct when steps are filtered)
        for (let i = 1; i < stepNumber; i++) {
          const prevStep = workflowSteps.find((s: any) => s.stepNumber === i);
          const prevStepProgress = prevStep
            ? workflowProgress.steps.find((s: any) => s.stepType === prevStep.stepType)
            : undefined;
          const prevStepStatus = prevStepProgress?.status;
          
          // Special handling for OpenSolar step - check if project is linked
          if (prevStep?.stepType === 'OPEN_SOLAR' && openSolarProjectId) {
            continue; // OpenSolar step is considered completed if project is linked
          }

          if (prevStep?.stepType === 'DISCLAIMER_SIGNING' && isDisclaimerWorkflowComplete()) {
            continue;
          }
          
          // For steps 1-3, they are always accessible themselves, but still need to be completed
          // for later steps (like Proposal) to be unlocked
          // A step allows progression if it's COMPLETED or SKIPPED
          const prevStepAllowsProgression = 
            prevStepStatus === 'COMPLETED' || 
            prevStepStatus === 'SKIPPED';
          
          // If previous step doesn't allow progression, block this step
          if (!prevStepAllowsProgression) {
            return false; // Found a previous step that blocks progression
          }
        }
        
        return true; // All previous steps allow progression
      };
      
      const allPreviousCompleted = arePreviousStepsCompleted();
      
      console.log('🔍 Step navigation restricted - checking permissions:', {
        stepNumber,
        currentStep,
        isCompleted,
        isSkipped,
        isCurrent,
        isFirstThreeSteps,
        allPreviousCompleted,
        stepProgress: stepProgress?.status,
        userRole: user?.role,
        stepNavigationEnabled,
        shouldEnforceStepOrder
      });
      
      // When step navigation is disabled:
      // - First 3 steps (Survey, OpenSolar, Calculator) are always accessible
      // - Can access current step
      // - Can go back to completed steps
      // - Can access skipped steps
      // - Can access future steps if all previous steps are completed or skipped
      // - Cannot skip ahead to future steps if previous steps aren't done
      if (!isFirstThreeSteps && stepNumber > currentStep && !isCompleted && !isSkipped && !allPreviousCompleted) {
        Alert.alert(
          'Step Not Available',
          `You cannot skip ahead to this step. Please complete all previous steps first.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
       setCurrentStep(stepNumber);
    
    // Handle steps by step type instead of hardcoded step numbers
    if (stepInfo?.stepType === 'SITE_SURVEY') {
      console.log('🔍 Navigating directly to survey');
      navigation.navigate('Survey', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'OPEN_SOLAR') {
      console.log('🔍 Navigating directly to OpenSolar screen');
      navigation.navigate('OpenSolarWebView', { 
        opportunityId,
        opportunity 
      });
      return;
    }
    
    if (stepInfo?.stepType === 'CALCULATOR') {
      console.log('🔍 Navigating to v4.4 calculator');
      if (!opportunityId) {
        Alert.alert('Error', 'Missing opportunity ID. Refresh the page and try again.');
        return;
      }
      navigation.navigate('CustomerDetails', {
        opportunityId,
        calculatorType: 'v44',
        templateFileName:
          'EPVS Member Calculator v4.4 - (Creativ) 15th June 2026 (1).xlsm',
        selectedOptions: {
          solar: true,
          battery: true,
          solarHybrid: false,
          batteryInverter: false,
        },
        ...(getCustomerDetailsForCalculator()
          ? { customerDetails: getCustomerDetailsForCalculator() }
          : {}),
      });
      return;
    }
    
    if (stepInfo?.stepType === 'SOLAR_PROJECTION') {
      console.log('🔍 Navigating to solar projection');
      // Get calculator type from workflow progress
      const calculatorStep = workflowProgress?.steps?.find((s: any) => s.stepType === 'CALCULATOR');
      const calculatorType = calculatorStep?.data?.calculatorType || 'v44';
      navigation.navigate('SolarProjection', { 
        opportunityId,
        calculatorType 
      });
      return;
    }
    
    if (stepInfo?.stepType === 'FOLLOW_UP') {
      console.log('🔍 Navigating to proposal');
      handleProposalStep();
      return;
    }
    
    if (stepInfo?.stepType === 'PROPOSAL_GENERATION') {
      console.log('🔍 Navigating to contract generation');
      navigation.navigate('ContractGeneration', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'INSTALLATION_SCHEDULING') {
      console.log('🔍 Navigating to Hometree quote helper');
      navigation.navigate('HometreeData', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'DISCLAIMER_SIGNING') {
      console.log('🔍 Navigating to disclaimer signing screen');
      navigation.navigate('DisclaimerSigning', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'CONTRACT_SIGNING') {
      console.log('🔍 Navigating to contract signing screen');
      navigation.navigate('ContractSigning', { opportunityId });
      return;
    }

    if (stepInfo?.stepType === 'EXPRESS_CONSENT') {
      console.log('🔍 Navigating to express consent signing screen');
      navigation.navigate('ExpressConsentSigning', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'BOOKING_CONFIRMATION' || stepInfo?.stepType === 'EMAIL_CONFIRMATION') {
      if (isAdminUser) {
        navigation.navigate('Payment', { opportunityId });
        return;
      }
      console.log('🔍 Navigating to booking confirmation signing screen');
      navigation.navigate('BookingConfirmationSigning', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'PAYMENT') {
      console.log('🔍 Navigating to payment screen');
      navigation.navigate('Payment', { opportunityId });
      return;
    }
    
    if (stepInfo?.stepType === 'INSTALLATION_BOOKING') {
      console.log('🔍 Navigating to installation booking');
      navigation.navigate('InstallationBooking', { 
        opportunityId,
        customerName: opportunity?.name || 'Customer',
        customerAddress: opportunity?.contactAddress || 'Customer Address'
      });
      return;
    }
    
    if (stepInfo?.stepType === 'WELCOME_EMAIL') {
      console.log('🔍 Navigating to welcome email screen');
      navigation.navigate('WelcomeEmail', { 
        opportunityId,
        opportunity 
      });
      return;
    }
    
    
    // Other steps - show modal
    console.log('🔍 Showing modal for step:', stepNumber, 'with type:', stepInfo?.stepType);
    setShowStepModal(true);
  };

  const renderStep = (step: any) => {
    const isDisclaimerStep = step.stepType === 'DISCLAIMER_SIGNING';
    const stepProgress =
      workflowProgress?.steps.find((s: any) => s.stepType === step.stepType) ??
      workflowProgress?.steps.find((s: any) => s.stepNumber === step.stepNumber);
    const isCompleted =
      stepProgress?.status === 'COMPLETED' ||
      (isDisclaimerStep && isDisclaimerWorkflowComplete());
    const isInProgress = stepProgress?.status === 'IN_PROGRESS';
    const isSkipped = stepProgress?.status === 'SKIPPED';
    const currentStepMeta = workflowProgress?.steps?.find((s: any) => s.stepNumber === currentStep);
    let isCurrent: boolean;
    if (isAdminUser && currentStepMeta?.stepType === 'EXPRESS_CONSENT') {
      isCurrent =
        step.stepType === 'BOOKING_CONFIRMATION' || step.stepType === 'EMAIL_CONFIRMATION';
    } else if (currentStepMeta?.stepType) {
      isCurrent = step.stepType === currentStepMeta.stepType;
    } else {
      isCurrent = step.stepNumber === currentStep;
    }
    
    // Special handling for OpenSolar step - show as completed when project is linked
    const isOpenSolarStep = step.stepType === 'OPEN_SOLAR';
    const hasOpenSolarProject = isOpenSolarStep && openSolarProjectId;
    const showAsCompleted = isCompleted || hasOpenSolarProject;
    
    // First 3 steps (Survey, OpenSolar, Calculator) are always accessible
    const isFirstThreeSteps = step.stepType === 'SITE_SURVEY' || 
                              step.stepType === 'OPEN_SOLAR' || 
                              step.stepType === 'CALCULATOR' ||
                              step.stepNumber <= 3;
    
    // Check if all previous steps are completed or skipped
    const arePreviousStepsCompleted = () => {
      // First 3 steps are always accessible
      if (isFirstThreeSteps) {
        return true;
      }
      
      if (!workflowProgress?.steps || step.stepNumber === 1) {
        return true; // First step is always accessible
      }
      
      // Check all steps before this one
      for (let i = 1; i < step.stepNumber; i++) {
        const prevStep = workflowSteps.find((s: any) => s.stepNumber === i);
        const prevStepProgress = prevStep
          ? workflowProgress.steps.find((s: any) => s.stepType === prevStep.stepType)
          : undefined;
        const prevStepStatus = prevStepProgress?.status;
        
          // Special handling for OpenSolar step - check if project is linked
          if (prevStep?.stepType === 'OPEN_SOLAR' && openSolarProjectId) {
            continue; // OpenSolar step is considered completed if project is linked
          }

          if (prevStep?.stepType === 'DISCLAIMER_SIGNING' && isDisclaimerWorkflowComplete()) {
            continue;
          }
          
          // For steps 1-3, they are always accessible themselves, but still need to be completed
          // for later steps (like Proposal) to be unlocked
          // A step allows progression if it's COMPLETED or SKIPPED
          // If step navigation is enabled, also allow if step hasn't been started (no progress entry)
          const prevStepAllowsProgression = 
            prevStepStatus === 'COMPLETED' || 
            prevStepStatus === 'SKIPPED' ||
            (stepNavigationEnabled && !prevStepProgress); // Allow if not started when navigation is enabled
        
        // If previous step doesn't allow progression, block this step
        // Only enforce this when step navigation is disabled (strict sequential mode)
        if (!stepNavigationEnabled && !prevStepAllowsProgression) {
          return false; // Found a previous step that blocks progression
        }
      }
      
      return true; // All previous steps allow progression
    };
    
    const allPreviousCompleted = arePreviousStepsCompleted();
    
    // Determine if step is disabled based on navigation setting
    // A step should be accessible if:
    // 1. It's one of the first 3 steps (always accessible), OR
    // 2. Step navigation is enabled (can access any step), OR
    // 3. The step is completed, OR
    // 4. The step is skipped (can still access skipped steps), OR
    // 5. The step is current, OR
    // 6. All previous steps are completed/skipped (workflow progression allows it)
    const isStepDisabled = !isFirstThreeSteps && !stepNavigationEnabled && !isCurrent && !showAsCompleted && !isSkipped && !allPreviousCompleted;
    
    // Debug logging for OpenSolar step
    if (isOpenSolarStep) {
      console.log('🔍 OpenSolar step debug:', {
        stepNumber: step.stepNumber,
        stepType: step.stepType,
        isCompleted,
        hasOpenSolarProject,
        openSolarProjectId,
        showAsCompleted,
        stepProgress: stepProgress?.status,
        stepProgressData: stepProgress?.data,
        workflowProgressSteps: workflowProgress?.steps?.map((s: any) => ({
          stepNumber: s.stepNumber,
          stepType: s.stepType,
          status: s.status,
          data: s.data
        }))
      });
    }

    const getStepIcon = (stepType: string) => {
      switch (stepType) {
        case 'SITE_SURVEY': return '📋';
        case 'OPEN_SOLAR': return '🌞';
        case 'CALCULATOR': return '🧮';
        case 'SOLAR_PROJECTION': return '📈';
        case 'FOLLOW_UP': return '📊';
        case 'PROPOSAL_GENERATION': return '📄';
        case 'DISCLAIMER_SIGNING': return '⚠️';
        case 'CONTRACT_SIGNING': return '✍️';
        case 'EMAIL_CONFIRMATION': return '📧';
        case 'PAYMENT': return '💳';
        case 'INSTALLATION_SCHEDULING': return '🏠';
        case 'INSTALLATION_BOOKING': return '📅';
        case 'WELCOME_EMAIL': return '📧';
        default: return '📋';
      }
    };

    const getStepStatus = () => {
      if (isStepDisabled) {
        return '🔒 Locked';
      }
      
      if (isOpenSolarStep) {
        // For OpenSolar step, show different status based on completion
        if (isCompleted || hasOpenSolarProject) {
          return '✓ Project Linked'; // Show as completed when project is linked
        } else if (isInProgress) {
          return '🔄 In Progress';
        } else {
          return 'Pending';
        }
      } else {
        // For other steps, show normal status
        if (isCompleted) {
          return '✓ Completed';
        } else if (isSkipped) {
          return '⏭️ Skipped';
        } else if (isInProgress) {
          return '🔄 In Progress';
        } else if (isCurrent) {
          return 'Current';
        } else {
          return 'Pending';
        }
      }
    };

    return (
      <TouchableOpacity
        key={step.stepNumber}
        style={[
          styles.stepCard,
          { 
            backgroundColor: theme.cardBackground, 
            borderColor: theme.cardBorder,
            shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
          },
          isCurrent && { borderColor: theme.primaryButton, borderWidth: 2 },
          showAsCompleted && { borderColor: theme.successButton, borderWidth: 2 },
          isStepDisabled && { 
            opacity: 0.5, 
            backgroundColor: theme.cardBackground + '80',
            borderColor: theme.cardBorder + '50'
          },
        ]}
        onPress={() => handleStepPress(step.stepNumber)}
        activeOpacity={isStepDisabled ? 0.3 : 0.8}
        disabled={isStepDisabled}
      >
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepIconContainer, 
            { 
              backgroundColor: isCurrent 
                ? theme.primaryButton + '20' 
                : showAsCompleted 
                ? theme.successButton + '20'
                : isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(248, 250, 252, 0.8)'
            }
          ]}>
            {isStepDisabled ? (
              <Feather name="lock" size={24} color={theme.tertiaryText} />
            ) : (
              <Text style={styles.stepIcon}>{getStepIcon(step.stepType)}</Text>
            )}
          </View>
          <View style={styles.stepInfo}>
            <Text style={[styles.stepTitle, { color: theme.primaryText }]}>{step.title}</Text>
            <View style={styles.stepStatusContainer}>
              <View style={[
                styles.statusBadge,
                { 
                  backgroundColor: isStepDisabled
                    ? theme.tertiaryText + '20'
                    : isCurrent 
                    ? theme.primaryButton + '20' 
                    : showAsCompleted 
                    ? theme.successButton + '20'
                    : isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(248, 250, 252, 0.8)'
                }
              ]}>
                <Text style={[
                  styles.stepStatus,
                  { 
                    color: isStepDisabled
                      ? theme.tertiaryText
                      : isCurrent 
                      ? theme.primaryButton 
                      : showAsCompleted 
                      ? theme.successButton
                      : theme.secondaryText
                  }
                ]}>
                  {getStepStatus()}
                </Text>
              </View>
            </View>
            <Text style={[styles.stepDescription, { color: theme.secondaryText }]}>{step.description}</Text>
            {isOpenSolarStep && !hasOpenSolarProject && !showAsCompleted && (
              <Text style={[styles.stepHint, { color: theme.primaryButton }]}>
                Your OpenSolar design should already be saved — link it here with the project ID or address.
              </Text>
            )}
          </View>
          <View style={styles.stepArrow}>
            <Feather name="chevron-right" size={20} color={theme.tertiaryText} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Add debug logging for render state
  console.log('🔍 SolarWorkflowScreen: Render state:', {
    loading,
    workflowSteps: workflowSteps.length,
    workflowProgress: !!workflowProgress,
    currentStep,
    opportunity: !!opportunity,
    showStepModal
  });
  
  console.log('🔍 SolarWorkflowScreen: About to render', workflowSteps.length, 'steps:', workflowSteps);
  console.log('🔍 SolarWorkflowScreen: Rendering opportunity info:', opportunity);

  if (loading) {
    console.log('🔍 SolarWorkflowScreen: Rendering loading state');
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading progress...</Text>
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
        display: 'flex',
        flexDirection: 'column',
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
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text 
                style={[
                  styles.headerTitle, 
                  { color: theme.primaryText },
                  Platform.OS === 'web' && {
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Solar Progress
              </Text>
              <Text 
                style={[
                  styles.headerSubtitle, 
                  { color: theme.secondaryText },
                  Platform.OS === 'web' && {
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Manage your installation process
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* Job Status Badge */}
            {jobStatus && (
              <View style={[
                styles.jobStatusBadge,
                { 
                  backgroundColor: jobStatus === 'WON' 
                    ? '#10b981' + '20' 
                    : jobStatus === 'LOST' 
                    ? '#ef4444' + '20'
                    : '#3b82f6' + '20'
                }
              ]}>
                {jobStatusLoading ? (
                  <ActivityIndicator 
                    size="small" 
                    color={jobStatus === 'WON' ? '#10b981' : jobStatus === 'LOST' ? '#ef4444' : '#3b82f6'} 
                  />
                ) : (
                  <Text style={[
                    styles.jobStatusText,
                    { 
                      color: jobStatus === 'WON' 
                        ? '#10b981' 
                        : jobStatus === 'LOST' 
                        ? '#ef4444'
                        : '#3b82f6'
                    }
                  ]}>
                    {jobStatus === 'WON' ? '✓ Won' : jobStatus === 'LOST' ? '✗ Quote' : '⏳ In Progress'}
                  </Text>
                )}
              </View>
            )}
            
            {/* Outcome Selection Buttons */}
            {jobStatus === 'IN_PROGRESS' && (
              <View style={styles.outcomeButtonsContainer}>
                <TouchableOpacity
                  style={[styles.outcomeButton, styles.wonButton]}
                  onPress={() => handleOutcomeSelect('won')}
                  disabled={isProcessingOutcome}
                >
                  {isProcessingOutcome ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.outcomeButtonContent}>
                      <Feather name="check" size={16} color="#ffffff" />
                      <Text style={styles.outcomeButtonText}>Won</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.outcomeButton, styles.lostButton]}
                  onPress={() => handleOutcomeSelect('lost')}
                  disabled={isProcessingOutcome}
                >
                  {isProcessingOutcome ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.outcomeButtonContent}>
                      <Feather name="x" size={16} color="#ffffff" />
                      <Text style={styles.outcomeButtonText}>Quote</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
            
            {/* Reset Status Button - only show when status is WON or LOST */}
            {(jobStatus === 'WON' || jobStatus === 'LOST') && (
              <TouchableOpacity
                style={[styles.outcomeButton, styles.resetButton]}
                onPress={resetJobStatus}
                disabled={isProcessingOutcome}
              >
                <Feather name="refresh-cw" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
            
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
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={openToolsModal}
            >
              <Feather 
                name="tool" 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={() => setShowResetModal(true)}
            >
              <Feather 
                name="refresh-cw" 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Customer Information */}
        {customerInfo && (
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerInfoLeft}>
              <Feather name="user" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerName, { color: theme.primaryText }]}>
                {customerInfo.name}
              </Text>
            </View>
            <View style={styles.customerInfoRight}>
              <Feather name="map-pin" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerPostcode, { color: theme.secondaryText }]}>
                {customerInfo.postcode}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View
        style={[
          styles.scrollHost,
          Platform.OS === 'web' && {
            flex: 1,
            minHeight: 0,
            overflow: 'hidden' as const,
          },
        ]}
      >
      <ScrollView 
        ref={scrollViewRef}
        style={[
          styles.scrollView, 
          { backgroundColor: 'transparent' },
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
            flexGrow: 1,
            paddingBottom: 100,
          },
        ]}
      >
        {isTrainingOpportunity && (
          <View style={[styles.trainingBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Feather name="book-open" size={16} color="#b45309" />
            <View style={styles.trainingBannerText}>
              <Text style={styles.trainingBannerTitle}>Training mode</Text>
              <Text style={styles.trainingBannerSubtitle}>
                Practice appointment — use scenario hints in My Training. If contract or payment blocks on fake
                data, ask your admin to use Workflow Override.
              </Text>
            </View>
          </View>
        )}

        {/* Opportunity Info */}
        {opportunity && (
          <View style={[styles.opportunityCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.opportunityHeader}>
              <View style={[styles.opportunityIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                <Feather name="briefcase" size={20} color={theme.primaryButton} />
              </View>
              <View style={styles.opportunityInfo}>
                <Text style={[styles.opportunityTitle, { color: theme.primaryText }]}>{opportunity.name}</Text>
                <Text style={[styles.opportunityStage, { color: theme.secondaryText }]}>{opportunity.stageName}</Text>
              </View>
            </View>

            
            {/* Location Information */}
            {(opportunity.contactAddress || opportunity.contactPostcode) && (
              <View style={styles.opportunityLocationContainer}>
                <Feather name="map-pin" size={14} color={theme.secondaryText} />
                <Text style={[styles.opportunityLocation, { color: theme.secondaryText }]}>
                  {opportunity.contactAddress || 'Address not available'}
                  {opportunity.contactPostcode && `, ${opportunity.contactPostcode}`}
                </Text>
              </View>
            )}
          </View>
        )}

        {opportunityId ? (
          <AppointmentVisitTypePanel
            opportunityId={opportunityId}
            customerLabel={customerInfo?.name || opportunity?.name}
          />
        ) : null}

        {/* Progress Steps */}
        <View style={styles.stepsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Process Steps</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
              {workflowSteps.length} steps to complete
            </Text>
          </View>
          {workflowSteps.length > 0 ? (
            workflowSteps.map(renderStep)
          ) : (
            <View style={[styles.stepCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.stepTitle, { color: theme.primaryText }]}>No workflow steps available</Text>
              <Text style={[styles.stepDescription, { color: theme.secondaryText }]}>
                Please check your connection and try refreshing the page.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      </View>

      {/* Step Action Modal - Never show for steps that have direct navigation */}
      {(() => {
        const currentStepInfo = workflowSteps.find(step => step.stepNumber === currentStep);
        const directNavigationSteps = ['SITE_SURVEY', 'OPEN_SOLAR', 'CALCULATOR', 'SOLAR_PROJECTION', 'FOLLOW_UP', 'PROPOSAL_GENERATION', 'DISCLAIMER_SIGNING', 'CONTRACT_SIGNING', 'EXPRESS_CONSENT', 'EMAIL_CONFIRMATION', 'PAYMENT', 'INSTALLATION_SCHEDULING', 'INSTALLATION_BOOKING', 'WELCOME_EMAIL'];
        return !currentStepInfo || !directNavigationSteps.includes(currentStepInfo.stepType);
      })() && (
        <Modal
          visible={showStepModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowStepModal(false)}
        >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                {workflowSteps.find(step => step.stepNumber === currentStep)?.title || 'Step Action'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const currentStepInfo = workflowSteps.find(step => step.stepNumber === currentStep);
                  const directNavigationSteps = ['SITE_SURVEY', 'OPEN_SOLAR', 'CALCULATOR', 'SOLAR_PROJECTION', 'FOLLOW_UP', 'PROPOSAL_GENERATION', 'DISCLAIMER_SIGNING', 'CONTRACT_SIGNING', 'EXPRESS_CONSENT', 'EMAIL_CONFIRMATION', 'PAYMENT', 'INSTALLATION_SCHEDULING', 'INSTALLATION_BOOKING', 'WELCOME_EMAIL'];
                  
                  if (!currentStepInfo || !directNavigationSteps.includes(currentStepInfo.stepType)) {
                    setShowStepModal(false);
                  }
                }}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalDescription, { color: theme.secondaryText }]}>
                {workflowSteps.find(step => step.stepNumber === currentStep)?.description || 'Select an action for this step.'}
              </Text>

              <View style={styles.actionButtons}>






                {/* Other steps - show configure option */}
                {(() => {
                  const currentStepInfo = workflowSteps.find(step => step.stepNumber === currentStep);
                  const directNavigationSteps = ['SITE_SURVEY', 'OPEN_SOLAR', 'CALCULATOR', 'SOLAR_PROJECTION', 'FOLLOW_UP', 'PROPOSAL_GENERATION', 'DISCLAIMER_SIGNING', 'CONTRACT_SIGNING', 'EXPRESS_CONSENT', 'EMAIL_CONFIRMATION', 'PAYMENT', 'INSTALLATION_SCHEDULING', 'INSTALLATION_BOOKING', 'WELCOME_EMAIL'];
                  return !currentStepInfo || !directNavigationSteps.includes(currentStepInfo.stepType);
                })() && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => {
                      setShowStepModal(false);
                      // Handle other steps here
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="settings" size={20} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Configure Step</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                  onPress={() => {
                    const currentStepInfo = workflowSteps.find(step => step.stepNumber === currentStep);
                  const directNavigationSteps = ['SITE_SURVEY', 'OPEN_SOLAR', 'CALCULATOR', 'SOLAR_PROJECTION', 'FOLLOW_UP', 'PROPOSAL_GENERATION', 'DISCLAIMER_SIGNING', 'CONTRACT_SIGNING', 'EXPRESS_CONSENT', 'EMAIL_CONFIRMATION', 'PAYMENT', 'INSTALLATION_SCHEDULING', 'INSTALLATION_BOOKING', 'WELCOME_EMAIL'];
                    
                    if (!currentStepInfo || !directNavigationSteps.includes(currentStepInfo.stepType)) {
                      setShowStepModal(false);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        </Modal>
      )}

      {/* Reset Progress Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                Reset Progress
              </Text>
              <TouchableOpacity
                onPress={() => setShowResetModal(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalDescription, { color: theme.secondaryText }]}>
                Are you sure you want to reset all progress? This will clear all completed steps and start the workflow from the beginning. This action cannot be undone.
              </Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                  onPress={handleResetProgress}
                  activeOpacity={0.8}
                >
                  <Feather name="alert-triangle" size={20} color="#ffffff" />
                  <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                    Yes, Reset Progress
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                  onPress={() => setShowResetModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showToolsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowToolsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Tools</Text>
              <TouchableOpacity onPress={() => setShowToolsModal(false)} style={styles.closeButton}>
                <Feather name="x" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.modalDescription, { color: theme.secondaryText }]}>
                Override a Price
              </Text>
              {loadingPricingOverrides ? (
                <ActivityIndicator size="small" color={theme.primaryButton} />
              ) : pricingOverrideOptions.length === 0 ? (
                <Text style={{ color: theme.secondaryText }}>No calculators with pricing found for this opportunity.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {pricingOverrideOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.calculatorType}
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: theme.cardBackground,
                          borderColor: selectedCalculatorType === opt.calculatorType ? theme.primaryButton : theme.cardBorder,
                        },
                      ]}
                      onPress={() => {
                        setSelectedCalculatorType(opt.calculatorType);
                        setOverridePriceInput(opt.currentPrice || '');
                      }}
                    >
                      <Text style={[styles.secondaryButtonText, { color: theme.primaryText }]}>
                        {opt.calculatorType} - current: {opt.currentPrice ?? 'N/A'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    value={overridePriceInput}
                    onChangeText={setOverridePriceInput}
                    placeholder="Enter new price"
                    keyboardType="numeric"
                    style={[
                      styles.formInput,
                      { borderColor: theme.cardBorder, color: theme.primaryText, backgroundColor: theme.primaryBackground },
                    ]}
                    placeholderTextColor={theme.tertiaryText}
                  />
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                    onPress={applyPriceOverride}
                    disabled={isApplyingOverride}
                  >
                    {isApplyingOverride ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#fff' }]}>Apply Override</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>


      {/* Welcome Email Modal removed - now using dedicated WelcomeEmailScreen */}

      {/* Payment Modal removed - now using dedicated PaymentScreen */}

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
  trainingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  trainingBannerText: { flex: 1 },
  trainingBannerTitle: { fontSize: 14, fontWeight: '700', color: '#b45309', marginBottom: 4 },
  trainingBannerSubtitle: { fontSize: 12, lineHeight: 17, color: '#92400e' },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '500',
  },
  
  // Modern Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: width < 768 ? 16 : 24,
    paddingHorizontal: width < 768 ? 12 : 24,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    minHeight: Platform.OS === 'ios' ? (width < 768 ? 100 : 120) : (width < 768 ? 80 : 100),
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: width < 480 ? 'wrap' : 'nowrap', // Allow wrapping on very small screens
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow content to shrink
    maxWidth: width < 768 ? '60%' : '70%', // Limit width on mobile
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: width < 768 ? '60%' : '70%',
    }),
  },
  headerRight: {
    flexDirection: 'row',
    gap: width < 768 ? 6 : 16,
    alignItems: 'center',
    flexShrink: 0, // Prevent shrinking
    flexWrap: 'wrap', // Allow wrapping on very small screens
  },
  jobStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  jobStatusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  outcomeButtonsContainer: {
    flexDirection: 'row',
    gap: width < 768 ? 4 : 8,
    marginRight: width < 768 ? 4 : 8,
    flexWrap: 'wrap', // Allow wrapping on very small screens
    justifyContent: 'flex-end',
  },
  outcomeButton: {
    minWidth: width < 768 ? 45 : 60,
    height: width < 768 ? 26 : 32,
    borderRadius: width < 768 ? 13 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: width < 768 ? 4 : 8,
  },
  outcomeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  outcomeButtonText: {
    fontSize: width < 768 ? 9 : 12,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
    numberOfLines: 1,
  },
  wonButton: {
    backgroundColor: '#10b981',
  },
  lostButton: {
    backgroundColor: '#ef4444',
  },
  resetButton: {
    backgroundColor: '#6b7280',
  },
  backButton: {
    padding: width < 768 ? 10 : 14,
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
    marginRight: width < 768 ? 12 : 16,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0, // Allow text to wrap properly
    maxWidth: width < 768 ? '100%' : '80%', // Ensure proper width on mobile
    flexDirection: 'column', // Ensure vertical stacking of title and subtitle
    justifyContent: 'center', // Center content vertically
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      maxWidth: width < 768 ? '100%' : '80%',
      overflow: 'hidden',
    }),
  },
  headerTitle: {
    fontSize: width < 768 ? 18 : 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
    flexWrap: 'nowrap', // Prevent wrapping that causes vertical stacking
    flexShrink: 1,
    numberOfLines: 1, // Force single line
    textAlign: 'left', // Ensure left alignment
    width: '100%', // Take full width of container
    ...(Platform.OS === 'web' && {
      whiteSpace: 'nowrap', // Prevent line breaks in web
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  },
  headerSubtitle: {
    fontSize: width < 768 ? 13 : 15,
    color: '#64748b',
    marginTop: 2,
    lineHeight: width < 768 ? 16 : 20,
    fontWeight: '500',
    numberOfLines: 1, // Force single line
    flexShrink: 1,
    textAlign: 'left', // Ensure left alignment
    width: '100%', // Take full width of container
    ...(Platform.OS === 'web' && {
      whiteSpace: 'nowrap', // Prevent line breaks in web
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  },
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  customerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  customerPostcode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
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
  scrollHost: {
    flex: 1,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Opportunity Card
  opportunityCard: {
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
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  opportunityIcon: {
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
  opportunityInfo: {
    flex: 1,
  },
  opportunityTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  opportunityStage: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  opportunityValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opportunityValue: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  opportunityLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  opportunityLocation: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  
  // Steps Container
  stepsContainer: {
    marginTop: 20,
    ...(Platform.OS === 'web' && {
      marginBottom: 100, // Extra margin for web scrolling
    }),
  },
  sectionHeader: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },
  
  // Step Cards
  stepCard: {
    marginBottom: 16,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // More spacing between cards on web
      minHeight: 120, // Ensure cards have minimum height
    }),
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stepIcon: {
    fontSize: 24,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  stepStatusContainer: {
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  stepStatus: {
    fontSize: width < 768 ? 11 : 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepDescription: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    fontWeight: '500',
  },
  stepHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  stepArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: width < 768 ? 24 : 28,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    letterSpacing: -0.4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalBody: {
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
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
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Signing Modal styles
  signingInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  signingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  signingTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  signingDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  
  // OpenSolar Form styles
  openSolarForm: {
    gap: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 48,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  systemTypeContainer: {
    gap: 8,
  },
  systemTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  systemTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  systemTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // OpenSolar Studio styles
  openSolarStudio: {
    gap: 16,
  },
  formDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  studioContainer: {
    gap: 16,
    alignItems: 'center',
  },
  studioInfo: {
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    minWidth: 200,
  },
  studioButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  studioInstructions: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  
  // Linked Project Info styles
  linkedProjectInfo: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  linkedProjectText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  
  // Welcome Email Modal Styles removed - now using dedicated WelcomeEmailScreen
  
  // Payment Modal Styles removed - now using dedicated PaymentScreen

}); 
