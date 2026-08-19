import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  CommonActions,
  LinkingOptions,
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native';
import React from 'react';
// @ts-ignore - stack navigator types resolved at runtime in Expo/React Native env
import {
  FontAwesome5,
  Ionicons,
  MaterialIcons
} from '@expo/vector-icons';
import {
  createBottomTabNavigator
} from '@react-navigation/bottom-tabs';
import {
  createStackNavigator
} from '@react-navigation/stack';
import {
  StatusBar
} from 'expo-status-bar';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import {
  SafeAreaProvider
} from 'react-native-safe-area-context';
import {
  AuthProvider,
  useAuth
} from './src/context/AuthContext';
import {
  ThemeProvider,
  useTheme
} from './src/context/ThemeContext';
import {
  workflowLinkingParse,
  workflowLinkingStringify,
  workflowScreenLinking,
} from './src/utils/deepLinkParams';

// Screens
import ContactAppointmentsScreen from './src/screens/ContactAppointmentsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import LoginScreen from './src/screens/LoginScreen';
import OpportunitiesScreen from './src/screens/OpportunitiesScreen';
import OpportunitiesWithAppointmentsScreen from './src/screens/OpportunitiesWithAppointmentsScreen';
import OpportunityDetailsScreen from './src/screens/OpportunityDetailsScreen';
import OpportunityManagementScreen from './src/screens/OpportunityManagementScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import TestOpportunitiesScreen from './src/screens/TestOpportunitiesScreen';

import AdminPanelScreen from './src/screens/AdminPanelScreen';
import AdobeSignScreen from './src/screens/AdobeSignScreen';
import CalculatorScreen from './src/screens/CalculatorScreen';
import CalculatorTypeSelectionScreen from './src/screens/CalculatorTypeSelectionScreen';
import ContractGenerationScreen from './src/screens/ContractGenerationScreen';
import ContractSigningScreen from './src/screens/ContractSigningScreen';
import CustomerDetailsScreen from './src/screens/CustomerDetailsScreen';
import DebugAuthScreen from './src/screens/DebugAuthScreen';
import DebugScreen from './src/screens/DebugScreen';
import DirectDocuSealScreen from './src/screens/DirectDocuSealScreen';
import DisclaimerSigningScreen from './src/screens/DisclaimerSigningScreen';
import ExpressConsentSigningScreen from './src/screens/ExpressConsentSigningScreen';
import BookingConfirmationSigningScreen from './src/screens/BookingConfirmationSigningScreen';
import DocuSealSigningScreen from './src/screens/DocuSealSigningScreen';
import DynamicInputsScreen from './src/screens/DynamicInputsScreen';
import EmailConfirmationSigningScreen from './src/screens/EmailConfirmationSigningScreen';
import FluxCalculatorScreen from './src/screens/EPVSCalculatorScreen';
import FluxDynamicInputsScreen from './src/screens/EPVSDynamicInputsScreen';
import FluxRadioButtonScreen from './src/screens/EPVSRadioButtonScreen';
import FluxTemplateSelectionScreen from './src/screens/FluxTemplateSelectionScreen';
import HometreeDataScreen from './src/screens/HometreeDataScreen';
import CustomerPhotoUploadScreen from './src/screens/CustomerPhotoUploadScreen';
import InstallationBookingScreen from './src/screens/InstallationBookingScreen';
import LoadingScreen from './src/screens/loadingScreen';
import SignComScreen from './src/screens/SignComScreen';
import SignComWebScreen from './src/screens/SignComWebScreen';
import SolarWorkflowScreen from './src/screens/SolarWorkflowScreen';
import StatisticsAnalyticsScreen from './src/screens/StatisticsAnalyticsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AppointmentCycleTimeScreen from './src/screens/AppointmentCycleTimeScreen';
import AdminUsersListScreen from './src/screens/AdminUsersListScreen';
import AdminUserOpportunitiesScreen from './src/screens/AdminUserOpportunitiesScreen';
import AdminOpportunityDetailsScreen from './src/screens/AdminOpportunityDetailsScreen';
import CreateManualOpportunityScreen from './src/screens/CreateManualOpportunityScreen';
import EditManualOpportunityScreen from './src/screens/EditManualOpportunityScreen';
import SurveyScreen from './src/screens/SurveyScreen';
import TemplateSelectionScreen from './src/screens/TemplateSelectionScreen';
import WorkflowsScreen from './src/screens/WorkflowsScreen';
// import OpenSolarIntegrationScreen from './src/screens/OpenSolarIntegrationScreen';
import OpenSolarPublicScreen from './src/screens/OpenSolarPublicScreen';
import OpenSolarWebViewScreen from './src/screens/OpenSolarWebViewScreen';
import PDFViewerScreen from './src/screens/PDFViewerScreen';
import PresentationScreen from './src/screens/PresentationScreen';
import PresentationViewerScreen from './src/screens/PresentationViewerScreen';
import VideoPresentationScreen from './src/screens/VideoPresentationScreen';
// @ts-ignore - screen file exists in src/screens
import AllOpportunitiesScreen from './src/screens/AllOpportunitiesScreen';
import ContractSigningTestScreen from './src/screens/ContractSigningTestScreen';
import DebugOpenSolarScreen from './src/screens/DebugOpenSolarScreen';
import DebugSignScreen from './src/screens/DebugSignScreen';
import DocuSealScreen from './src/screens/DocuSealScreen';
import DocuSignTestScreen from './src/screens/DocuSignTestScreen';
import FinishAppointmentScreen from './src/screens/FinishAppointmentScreen';
import FreeDocumentSigningScreen from './src/screens/FreeDocumentSigningScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PdfSigningTestScreen from './src/screens/PdfSigningTestScreen';
import PipelineTestScreen from './src/screens/PipelineTestScreen';
import PricingScreen from './src/screens/PricingScreen';
import SolarArraysInputsScreen from './src/screens/SolarArraysInputsScreen';
import SolarProjectionScreen from './src/screens/SolarProjectionScreen';
import WelcomeEmailScreen from './src/screens/WelcomeEmailScreen';
import AdminToolsScreen from './src/screens/AdminToolsScreen';
import AdminCalculatorFilesScreen from './src/screens/AdminCalculatorFilesScreen';
import WorkflowOverrideAdminScreen from './src/screens/WorkflowOverrideAdminScreen';
import AdminTrainingScreen from './src/screens/AdminTrainingScreen';
import AdminTrainingProgressScreen from './src/screens/AdminTrainingProgressScreen';
import TrainingHubScreen from './src/screens/TrainingHubScreen';
import CalculatorTestingScreen from './src/screens/CalculatorTestingScreen';
import V44CalculatorQuestionsScreen from './src/screens/V44CalculatorQuestionsScreen';
import V44CalculatorInputsScreen from './src/screens/V44CalculatorInputsScreen';

export type RootStackParamList = {
  Loading: undefined;
  AppRoot: undefined; 
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  OpportunityDetails: { opportunityId: string };
  OpportunityManagement: undefined;
  EditManualOpportunity: { opportunityId: string };
  AdminUsersList: undefined;
  AdminUserOpportunities: { userId: string; userName?: string };
  AdminOpportunityDetails: { opportunityId: string };

  SolarWorkflow: { opportunityId: string };
  TemplateSelection: { opportunityId: string };
  CustomerDetails: { 
    opportunityId?: string; 
    templateFileName?: string; 
    selectedOptions?: {
      solar: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
  };
  Survey: { opportunityId: string };
  Calculator: { 
    opportunityId?: string; 
    customerDetails?: any;
    templateFileName?: string;
    selectedOptions?: {
      solar: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
    calculatorType?: 'off-peak';
  };
  CalculatorTypeSelection: { 
    opportunityId?: string; 
    customerDetails?: any;
    templateFileName?: string;
    selectedOptions?: {
      solar: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
  };
  FluxTemplateSelection: {
    opportunityId: string;
    calculatorType?: 'flux' | 'off-peak';
  };
  FluxRadioButton: {
    opportunityId?: string;
    customerDetails?: any;
    templateFileName?: string;
    selectedOptions?: {
      solar: boolean;
      battery: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
    calculatorType?: 'flux';
  };
  FluxCalculator: { 
    opportunityId?: string; 
    customerDetails?: any;
    templateFileName?: string;
    selectedOptions?: {
      solar: boolean;
      battery: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
    calculatorType?: 'flux';
  };
  FluxDynamicInputs: { 
    opportunityId?: string; 
    customerDetails?: any;
    selectedOptions?: Record<string, string>;
    templateFileName?: string;
    selectedTemplateOptions?: {
      solar: boolean;
      battery: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
  };
  DynamicInputs: { 
    opportunityId?: string; 
    customerDetails?: any;
    selectedOptions?: Record<string, string>;
    templateFileName?: string;
    selectedTemplateOptions?: {
      solar: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
  };
  ContractGeneration: { opportunityId: string };
  ContractSigning: { opportunityId: string };
  DisclaimerSigning: { opportunityId: string };
  ExpressConsentSigning: { opportunityId: string };
  BookingConfirmationSigning: { opportunityId: string };
  EmailConfirmationSigning: { opportunityId: string };
  DocuSealSigning: { 
    submissionId: string; 
    signingUrl: string; 
    opportunityId: string; 
    customerName: string; 
  };
  SignCom: { 
    opportunityId: string; 
    customerName: string; 
    customerEmail: string; 
  };
  SignComWeb: { 
    opportunityId: string; 
    customerName: string; 
    customerEmail: string; 
  };
  AdobeSign: { 
    opportunityId: string; 
    customerName: string; 
    customerEmail: string; 
  };
  DirectDocuSeal: { 
    opportunityId: string; 
    customerName: string; 
    customerEmail: string; 
  };
  InstallationBooking: { 
    opportunityId: string; 
    customerName?: string; 
    customerAddress?: string; 
    defaultCalendar?: string; 
  };
  OpenSolarIntegration: { opportunityId: string };
  OpenSolarPublic: { opportunityId: string };
  OpenSolarWebView: { opportunityId: string; opportunity?: any };
  Presentation: { opportunityId: string; opportunity?: any };
  VideoPresentation: { opportunityId: string; opportunity?: any };
  PresentationViewer: { filename: string; opportunityId: string; customerName: string; pdfUrl: string };
  PDFViewer: { pdfUrl: string; title: string };
  SolarArraysInputs: { opportunityId?: string; templateFileName?: string; noOfArrays?: number };
  Pricing: { opportunityId: string; templateFileName?: string; calculatorType?: 'flux' | 'off-peak' };
  Debug: undefined;
  DebugAuth: undefined;
  DebugSign: undefined;
  DebugOpenSolar: undefined;
  DocuSeal: undefined;

  AdminPanel: undefined;
  AdminCreateManualOpportunity: undefined;
  OpportunitiesWithAppointments: undefined;
  TestOpportunities: undefined;
  ContactAppointments: undefined;
  PipelineTest: undefined;
  AllOpportunities: undefined;
  DocuSignTest: undefined;
  PdfSigningTest: undefined;
  FreeDocumentSigning: {
    opportunityId: string;
    customerName: string;
    customerEmail: string;
  };
  ContractSigningTest: undefined;
  SolarProjection: { 
    opportunityId: string; 
    calculatorType?: 'flux' | 'off-peak' | 'epvs' | 'v44'; 
  };
  HometreeData: { opportunityId: string };
  Payment: { opportunityId: string };
  WelcomeEmail: { opportunityId: string; opportunity?: any };
  FinishAppointment: { opportunityId: string; opportunity?: any };
  Reports: undefined;
  AppointmentCycleTime: undefined;
  AdminTools: undefined;
  AdminCalculatorFiles: undefined;
  WorkflowOverrideAdmin: { opportunityId?: string } | undefined;
  AdminTraining: undefined;
  AdminTrainingProgress: { programId: string };
  TrainingHub: undefined;
  CalculatorTesting: undefined;
  CalculatorTestingPublic: { publicMode?: boolean } | undefined;
  CustomerPhotoUpload: { token: string };
  CalculatorQuestions: {
    opportunityId: string;
    customerDetails?: { customerName: string; address: string; postcode: string };
    calculatorType?: 'v44';
  };
  CalculatorInputs: {
    opportunityId: string;
    customerDetails?: { customerName: string; address: string; postcode: string };
    calculatorType?: 'v44';
  };
};

export type TabParamList = {
  Dashboard: undefined;
  Opportunities: undefined;
  Progress: undefined;
  Profile: undefined;
};

// Deep linking configuration for web URLs
const webLinkingPrefix =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:8081';

/** Workflow screens opened via share links — stack includes MainTabs underneath for back nav. */
const WORKFLOW_DEEP_LINK_SCREENS = new Set([
  'Calculator',
  'CalculatorTypeSelection',
  'CalculatorQuestions',
  'CalculatorInputs',
  'FluxTemplateSelection',
  'FluxRadioButton',
  'FluxCalculator',
  'FluxDynamicInputs',
  'DynamicInputs',
  'SolarArraysInputs',
  'Pricing',
  'SolarWorkflow',
  'TemplateSelection',
  'CustomerDetails',
  'InstallationBooking',
  'OpenSolarPublic',
  'OpenSolarWebView',
  'Presentation',
  'VideoPresentation',
  'Survey',
  'SolarProjection',
  'HometreeData',
  'Payment',
  'WelcomeEmail',
  'FinishAppointment',
]);

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://app.creativuk.co.uk', 'http://localhost:8081', 'http://127.0.0.1:8081', webLinkingPrefix],
  getPathFromState(state, options) {
    return defaultGetPathFromState(state, options);
  },
  getStateFromPath(path, options) {
    const parsed = defaultGetStateFromPath(path, options) as any;
    if (!parsed?.routes?.length) {
      return parsed;
    }
    const leaf = parsed.routes[parsed.index ?? parsed.routes.length - 1];
    if (
      leaf?.name &&
      WORKFLOW_DEEP_LINK_SCREENS.has(leaf.name) &&
      parsed.routes.length === 1
    ) {
      return {
        ...parsed,
        routes: [{ name: 'MainTabs' }, leaf],
        index: 1,
      };
    }
    return parsed;
  },
  config: {
    screens: {
      // Main app screens
      AppRoot: '',
      
      // Auth screens
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      
      // Main tabs
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Opportunities: 'opportunities',
          Progress: 'progress',
          Profile: 'profile',
        },
      },
      
      // Calculator workflow screens
      Calculator: workflowScreenLinking('calculator/:opportunityId'),
      CalculatorTypeSelection: workflowScreenLinking('calculator-type/:opportunityId'),
      CalculatorQuestions: workflowScreenLinking('calculator-questions/:opportunityId'),
      CalculatorInputs: workflowScreenLinking('calculator-inputs/:opportunityId'),
      FluxTemplateSelection: workflowScreenLinking('flux-template/:opportunityId'),
      FluxRadioButton: workflowScreenLinking('flux-radio/:opportunityId'),
      FluxCalculator: workflowScreenLinking('flux-calculator/:opportunityId'),
      FluxDynamicInputs: workflowScreenLinking('flux-inputs/:opportunityId'),
      DynamicInputs: workflowScreenLinking('dynamic-inputs/:opportunityId'),
      SolarArraysInputs: workflowScreenLinking('solar-arrays/:opportunityId'),
      Pricing: workflowScreenLinking('pricing/:opportunityId'),
      
      // Workflow screens
      SolarWorkflow: workflowScreenLinking('solar-workflow/:opportunityId'),
      TemplateSelection: {
        path: 'template-selection/:opportunityId',
        parse: {
          ...workflowLinkingParse,
          calculatorType: (v: string) => (v === 'epvs' ? 'flux' : v),
        },
        stringify: workflowLinkingStringify,
      },
      CustomerDetails: workflowScreenLinking('customer-details/:opportunityId'),
      
      // Contract and signing screens
      ContractGeneration: 'contract-generation/:opportunityId',
      ContractSigning: 'contract-signing/:opportunityId',
      DisclaimerSigning: 'disclaimer-signing/:opportunityId',
      ExpressConsentSigning: 'express-consent/:opportunityId',
      BookingConfirmationSigning: 'booking-confirmation/:opportunityId',
      EmailConfirmationSigning: 'email-confirmation/:opportunityId',
      DocuSealSigning: 'docuseal-signing/:opportunityId',
      SignCom: 'signcom/:opportunityId',
      SignComWeb: 'signcom-web/:opportunityId',
      AdobeSign: 'adobe-sign/:opportunityId',
      DirectDocuSeal: 'direct-docuseal/:opportunityId',
      
      // Installation and booking
      InstallationBooking: workflowScreenLinking('installation-booking/:opportunityId'),
      
      // OpenSolar integration
      OpenSolarPublic: workflowScreenLinking('opensolar/:opportunityId'),
      OpenSolarWebView: workflowScreenLinking('opensolar-webview/:opportunityId'),
      
      // Presentation screens
      Presentation: workflowScreenLinking('presentation/:opportunityId'),
      VideoPresentation: workflowScreenLinking('video-presentation/:opportunityId'),
      PresentationViewer: 'presentation-viewer/:opportunityId',
      PDFViewer: 'pdf-viewer/:opportunityId',
      
      // Survey and other screens
      Survey: workflowScreenLinking('survey/:opportunityId'),
      SolarProjection: workflowScreenLinking('solar-projection/:opportunityId'),
      HometreeData: workflowScreenLinking('hometree/:opportunityId'),
      Payment: workflowScreenLinking('payment/:opportunityId'),
      WelcomeEmail: workflowScreenLinking('welcome-email/:opportunityId'),
      FinishAppointment: workflowScreenLinking('finish-appointment/:opportunityId'),
      
      // Admin and debug screens
      AdminPanel: 'admin',
      AdminUsersList: 'admin/users',
      AdminUserOpportunities: 'admin/users/:userId/opportunities',
      AdminOpportunityDetails: 'admin/opportunities/:opportunityId',
      WorkflowOverrideAdmin: 'admin/workflow-override',
      AdminCalculatorFiles: 'admin/calculator-files',
      AdminTraining: 'admin/training',
      AdminTrainingProgress: 'admin/training/:programId',
      TrainingHub: 'training',
      CalculatorTesting: 'admin/calculator-testing',
      CalculatorTestingPublic: 'dev/calculator-testing',
      CustomerPhotoUpload: 'customer-photos/:token',
      Debug: 'debug',
      DebugAuth: 'debug/auth',
      DebugSign: 'debug/sign',
      DebugOpenSolar: 'debug/opensolar',
      
      // Other screens
      OpportunityDetails: 'opportunity/:opportunityId',
      AppointmentCycleTime: 'reports/appointment-cycle',
      OpportunityManagement: 'opportunity-management',
      EditManualOpportunity: 'edit-manual-opportunity/:opportunityId',
      OpportunitiesWithAppointments: 'opportunities-with-appointments',
      TestOpportunities: 'test-opportunities',
      ContactAppointments: 'contact-appointments',
      PipelineTest: 'pipeline-test',
      AllOpportunities: 'all-opportunities',
      DocuSeal: 'docuseal',
      DocuSignTest: 'docu-sign-test',
      PdfSigningTest: 'pdf-signing-test',
      FreeDocumentSigning: 'free-document-signing/:opportunityId',
      ContractSigningTest: 'contract-signing-test',
    },
  },
};

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator<TabParamList>();
const RootStack = createStackNavigator();

// Custom Header Component
function CustomHeader({ title, showBack = false, onBackPress, rightComponent }: {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
}) {
  const navigation = useNavigation();
  
  return (
    <View style={{
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingBottom: 15,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {showBack && (
          <TouchableOpacity
            onPress={onBackPress || (() => navigation.goBack())}
            style={{
              padding: 8,
              marginRight: 12,
              borderRadius: 8,
              backgroundColor: '#f1f5f9',
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
        )}
        <Text style={{
          fontSize: 20,
          fontWeight: '700',
          color: '#1e293b',
          flex: 1,
        }}>
          {title}
        </Text>
      </View>
      {rightComponent && (
        <View style={{ marginLeft: 12 }}>
          {rightComponent}
        </View>
      )}
    </View>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent: any;
          let iconName: string;
          
          switch (route.name) {
            case 'Dashboard':
              IconComponent = Ionicons;
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Opportunities':
              IconComponent = MaterialIcons;
              iconName = 'business';
              break;
            case 'Progress':
              IconComponent = FontAwesome5;
              iconName = 'cogs';
              break;
            case 'Profile':
              IconComponent = Ionicons;
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              IconComponent = Ionicons;
              iconName = 'help-outline';
          }
          
          return <IconComponent name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#B4F35B',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 85 : 65,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="Opportunities" 
        component={OpportunitiesScreen}
        options={{
          title: 'Appointments',
        }}
      />
      <Tab.Screen 
        name="Progress" 
        component={WorkflowsScreen}
        options={{
          title: 'Progress',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}



function ProfileScreen() {
  const { logout, user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [showReportsConfirm, setShowReportsConfirm] = React.useState(false);

  const confirmNavigateToReports = () => {
    setShowReportsConfirm(true);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isSurveyor = user?.role === 'SURVEYOR';
  
  return (
    <View style={[styles.profileContainer, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
            Profile
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Manage your account settings
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.content}>
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.profileHeader}>
              <View style={[styles.avatarContainer, { backgroundColor: theme.primaryButton + '20' }]}>
                <Ionicons name="person" size={32} color={theme.primaryButton} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.primaryText }]}>
                  {user?.name || user?.username || 'User'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.secondaryText }]}>
                  {user?.email || 'No email available'}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: isAdmin ? theme.primaryButton : theme.secondaryButton }]}>
                  <Text style={styles.roleText}>
                    {user?.role || 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            {/* Opportunity management - Admin only */}
            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('OpportunityManagement')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="briefcase" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Opportunity management</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      View and manage your opportunities
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {/* Statistics & Analytics Button - Admin Only */}
            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('StatisticsAnalytics')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="bar-chart" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Statistics & Analytics</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      View your progress and performance
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
              onPress={confirmNavigateToReports}
            >
              <View style={styles.actionButtonContent}>
                <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                  <Ionicons name="analytics" size={20} color={theme.primaryButton} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Reports</Text>
                  <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                    View KPIs, trends, and export CSV
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
              </View>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('AppointmentCycleTime')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="time" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Appointment cycle time</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Detailed per-rep cycle duration reporting
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {/* Admin Only - Admin Panel */}
            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('AdminPanel')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="shield" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Admin Panel</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Manage users and system settings
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('AdminTraining')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="school" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Training Management</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Start and monitor sales rep training programs
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {isSurveyor && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('TrainingHub')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="book" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>My Training</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Tariff reference, guides, and test scenarios
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('AdminTools')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="construct" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Tools</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Fill survey placeholder images by opportunity ID
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('WorkflowOverrideAdmin')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="sliders" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Workflow Override</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Mark steps complete, fix survey images, override status
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => navigation.navigate('CalculatorTesting')}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Ionicons name="flask" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Calculator Testing (v4.4)</Text>
                    <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                      Sandbox for the new combined calculator — template, questions, inputs
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                </View>
              </TouchableOpacity>
            )}

            {/* Logout Button */}
            <TouchableOpacity
              style={[styles.logoutButton, { backgroundColor: theme.dangerButton }]}
              onPress={async () => await logout()}
            >
              <View style={styles.logoutButtonContent}>
                <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showReportsConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportsConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.confirmTitle, { color: theme.primaryText }]}>Open reports?</Text>
            <Text style={[styles.confirmText, { color: theme.secondaryText }]}>
              Are you sure you want to open the reports?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
                onPress={() => setShowReportsConfirm(false)}
              >
                <Text style={[styles.confirmButtonText, { color: theme.primaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => {
                  setShowReportsConfirm(false);
                  navigation.navigate('Reports');
                }}
              >
                <Text style={[styles.confirmButtonText, { color: '#ffffff' }]}>Yes, continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PUBLIC_SCREENS = new Set(['CalculatorTestingPublic', 'CustomerPhotoUpload', 'FreeDocumentSigning']);

function getCustomerPhotoTokenFromLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const match = window.location.pathname.match(/\/customer-photos\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function AuthNavigationSync() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    if (isLoading) return;

    const state = navigation.getState();
    const route = state?.routes?.[state.index ?? 0];
    const routeName = route?.name;
    const authScreens = new Set(['Login', 'Register', 'ForgotPassword', 'Loading']);

    // Customer photo links must stay put even if a rep is already logged in here.
    if (routeName && PUBLIC_SCREENS.has(routeName)) {
      return;
    }
    if (getCustomerPhotoTokenFromLocation()) {
      return;
    }

    if (isAuthenticated && routeName && authScreens.has(routeName)) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        }),
      );
      return;
    }

    if (!isAuthenticated && routeName === 'MainTabs') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        }),
      );
    }
  }, [isAuthenticated, isLoading, navigation]);

  return null;
}

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const customerPhotoToken = getCustomerPhotoTokenFromLocation();
  const customerPhotoInitialParams = React.useMemo(
    () => (customerPhotoToken ? { token: customerPhotoToken } : undefined),
    [customerPhotoToken],
  );

  console.log('AppNavigator: Auth state:', { isAuthenticated, isLoading });

  console.log('AppNavigator: Rendering navigator, isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  return (
    <Stack.Navigator
      initialRouteName={
        customerPhotoToken
          ? 'CustomerPhotoUpload'
          : isAuthenticated
            ? 'MainTabs'
            : 'Login'
      }
      screenOptions={{
        headerShown: false,
        gestureEnabled: Platform.OS !== 'web',
        animationEnabled: Platform.OS !== 'web',
        ...(Platform.OS === 'web'
          ? {}
          : {
              cardStyleInterpolator: ({ current, layouts }: any) => {
                return {
                  cardStyle: {
                    transform: [
                      {
                        translateX: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [layouts.screen.width, 0],
                        }),
                      },
                    ],
                  },
                };
              },
            }),
      }}
    >
      <Stack.Screen name="Loading" component={LoadingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen
        name="CalculatorTestingPublic"
        component={CalculatorTestingScreen}
        initialParams={{ publicMode: true }}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPhotoUpload"
        component={CustomerPhotoUploadScreen}
        initialParams={customerPhotoInitialParams}
        options={{
          headerShown: false,
          gestureEnabled: false,
          animationEnabled: false,
          cardStyleInterpolator: () => ({
            cardStyle: { opacity: 1 },
          }),
        }}
      />
      <Stack.Screen name="MainTabs" component={TabNavigator} />

          <Stack.Screen 
            name="OpportunityDetails" 
            component={OpportunityDetailsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="OpportunityManagement" 
            component={OpportunityManagementScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="EditManualOpportunity" 
            component={EditManualOpportunityScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="SolarWorkflow" 
            component={SolarWorkflowScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="TemplateSelection" 
            component={TemplateSelectionScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="CustomerDetails" 
            component={CustomerDetailsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Calculator" 
            component={CalculatorScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="CalculatorTypeSelection" 
            component={CalculatorTypeSelectionScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="CalculatorQuestions"
            component={V44CalculatorQuestionsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CalculatorInputs"
            component={V44CalculatorInputsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="FluxTemplateSelection" 
            component={FluxTemplateSelectionScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="FluxRadioButton" 
            component={FluxRadioButtonScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="FluxCalculator" 
            component={FluxCalculatorScreen}
            options={{
              headerShown: true,
              header: ({ route, navigation }: any) => (
                <CustomHeader 
                  title="Flux Calculator" 
                  showBack={true}
                  onBackPress={() => navigation.goBack()}
                />
              ),
            }}
          />
          <Stack.Screen 
            name="FluxDynamicInputs" 
            component={FluxDynamicInputsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DynamicInputs" 
            component={DynamicInputsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="SolarArraysInputs" 
            component={SolarArraysInputsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Pricing" 
            component={PricingScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ContractGeneration" 
            component={ContractGenerationScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="InstallationBooking" 
            component={InstallationBookingScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ContractSigning" 
            component={ContractSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DisclaimerSigning" 
            component={DisclaimerSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ExpressConsentSigning" 
            component={ExpressConsentSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="BookingConfirmationSigning" 
            component={BookingConfirmationSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="EmailConfirmationSigning" 
            component={EmailConfirmationSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DocuSealSigning" 
            component={DocuSealSigningScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="SignCom" 
            component={SignComScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="SignComWeb" 
            component={SignComWebScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdobeSign" 
            component={AdobeSignScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DirectDocuSeal" 
            component={DirectDocuSealScreen}
            options={{
              headerShown: false,
            }}
          />
          {/* <Stack.Screen 
            name="OpenSolarIntegration" 
            component={OpenSolarIntegrationScreen}
            options={{
              headerShown: false,
            }}
          /> */}
          <Stack.Screen 
            name="OpenSolarPublic" 
            component={OpenSolarPublicScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="OpenSolarWebView" 
            component={OpenSolarWebViewScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Presentation" 
            component={PresentationScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="VideoPresentation" 
            component={VideoPresentationScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="PresentationViewer" 
            component={PresentationViewerScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="PDFViewer" 
            component={PDFViewerScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Survey" 
            component={SurveyScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Debug" 
            component={DebugScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DebugAuth" 
            component={DebugAuthScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="StatisticsAnalytics" 
            component={StatisticsAnalyticsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdminUsersList" 
            component={AdminUsersListScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdminUserOpportunities" 
            component={AdminUserOpportunitiesScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdminOpportunityDetails" 
            component={AdminOpportunityDetailsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdminCreateManualOpportunity" 
            component={CreateManualOpportunityScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AdminPanel" 
            component={AdminPanelScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Reports" 
            component={ReportsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AppointmentCycleTime"
            component={AppointmentCycleTimeScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AdminTools"
            component={AdminToolsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AdminCalculatorFiles"
            component={AdminCalculatorFilesScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="WorkflowOverrideAdmin"
            component={WorkflowOverrideAdminScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="CalculatorTesting"
            component={CalculatorTestingScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AdminTraining"
            component={AdminTrainingScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AdminTrainingProgress"
            component={AdminTrainingProgressScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="TrainingHub"
            component={TrainingHubScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="OpportunitiesWithAppointments" 
            component={OpportunitiesWithAppointmentsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="TestOpportunities" 
            component={TestOpportunitiesScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="ContactAppointments" 
            component={ContactAppointmentsScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="PipelineTest" 
            component={PipelineTestScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="AllOpportunities" 
            component={AllOpportunitiesScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DebugSign" 
            component={DebugSignScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DebugOpenSolar" 
            component={DebugOpenSolarScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="DocuSignTest" 
            component={DocuSignTestScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="PdfSigningTest" 
            component={PdfSigningTestScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="FreeDocumentSigning" 
            component={FreeDocumentSigningScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="ContractSigningTest" 
            component={ContractSigningTestScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="DocuSeal" 
            component={DocuSealScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="SolarProjection" 
            component={SolarProjectionScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="HometreeData" 
            component={HometreeDataScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="WelcomeEmail" 
            component={WelcomeEmailScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen 
            name="FinishAppointment" 
            component={FinishAppointmentScreen}
            options={{
              headerShown: false,
            }}
          />

    </Stack.Navigator>
  );
}

// Profile Screen Styles
const styles = StyleSheet.create({
  profileContainer: {
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
    marginRight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  headerText: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
    paddingTop: 0,
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  actionsSection: {
    gap: 16,
  },
  actionButton: {
    borderRadius: 16,
    padding: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  logoutButton: {
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmButton: {
    minWidth: 112,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// Theme-aware Paper Provider component
function ThemedPaperProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  
  return (
    <PaperProvider theme={isDark ? MD3DarkTheme : MD3LightTheme}>
      {children}
    </PaperProvider>
  );
}

// 👇 Main App entry
export default function App() {
  const customerPhotoToken = getCustomerPhotoTokenFromLocation();
  if (customerPhotoToken) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedPaperProvider>
            <CustomerPhotoUploadScreen token={customerPhotoToken} />
          </ThemedPaperProvider>
        </ThemeProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedPaperProvider>
          <AuthProvider>
            <NavigationContainer 
              linking={linking}
              onStateChange={(state) => {
                console.log('🔗 Navigation state changed:', state);
              }}
              onReady={() => {
                console.log('🔗 NavigationContainer ready');
              }}
            >
              <AuthNavigationSync />
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ThemedPaperProvider>
      </ThemeProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
