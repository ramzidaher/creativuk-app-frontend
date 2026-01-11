import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, adminOpportunityDetailsApi, autoSaveApi, calculatorApi } from '../utils/api';

const { width } = Dimensions.get('window');

interface UserProgressData {
  opportunities: any[];
  surveyData: any[];
  calculatorData: any[];
  totalSurveys: number;
  totalCalculators: number;
  completedSurveys: number;
  completedCalculators: number;
  lastActivity: string;
  averageCompletionTime: number;
}

interface StatisticsCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  iconType: 'feather' | 'material';
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatisticsAnalyticsScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  
  // View states: 'users' | 'opportunities' | 'details'
  const [currentView, setCurrentView] = useState<'users' | 'opportunities' | 'details'>('users');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userOpportunities, setUserOpportunities] = useState<any[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(null);
  const [opportunityDetails, setOpportunityDetails] = useState<any | null>(null);
  
  // Legacy states (keeping for backward compatibility)
  const [userProgressData, setUserProgressData] = useState<UserProgressData | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedCalculator, setSelectedCalculator] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailedData, setDetailedData] = useState<any>(null);

  useEffect(() => {
    // No longer loading users here - navigation to separate screen handles it
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Try the new endpoint first
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunities();
      
      // If 404, fallback to existing endpoint
      if (!response.success && response.error?.includes('404')) {
        console.log('⚠️ New endpoint not available, falling back to existing endpoint...');
        response = await adminAnalyticsApi.getAllUsers();
        
        if (response.success) {
          // Transform existing endpoint response to match expected format
          const usersData = response.data?.data || response.data || [];
          const usersArray = Array.isArray(usersData) ? usersData : [];
          
          // Transform to match the expected structure
          const transformedUsers = usersArray.map((user: any) => ({
            ...user,
            opportunitiesCount: 0, // Will be loaded when user is clicked
            opportunities: [],
          }));
          
          setUsers(transformedUsers);
          return;
        }
      }
      
      console.log('👥 Full response from getAllUsersWithOpportunities:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // According to API docs, response is an array of { user, opportunities, totalOpportunities }
        const data = response.data?.data || response.data || [];
        console.log('👥 Processed users data:', JSON.stringify(data, null, 2));
        
        // Ensure data is an array
        const usersArray = Array.isArray(data) ? data : [];
        
        // Transform to include opportunity count in user object for easier access
        const transformedUsers = usersArray.map((item: any) => ({
          ...item.user,
          opportunitiesCount: item.totalOpportunities || (item.opportunities?.length || 0),
          opportunities: item.opportunities || [],
        }));
        
        setUsers(transformedUsers);
      } else {
        console.error('❌ Failed to load users:', response.error);
        // Don't show alert for 404 - it's expected if endpoint isn't deployed yet
        if (!response.error?.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load users');
        } else {
          // Show a helpful message
          Alert.alert(
            'Endpoint Not Available',
            'The new admin opportunities endpoint is not yet deployed. Please contact the backend team to deploy the endpoint: /admin/opportunities/users',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserOpportunities = async (userId: string) => {
    try {
      setLoadingDetails(true);
      
      // Try the new endpoint first
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunitiesFull();
      
      // If 404, fallback to existing endpoint
      if (!response.success && response.error?.includes('404')) {
        console.log('⚠️ New endpoint not available, falling back to existing endpoint...');
        response = await adminAnalyticsApi.getUserOpportunities(userId);
        
        if (response.success) {
          const opportunities = response.data?.data || response.data?.opportunities || response.data || [];
          const opportunitiesArray = Array.isArray(opportunities) ? opportunities : [];
          setUserOpportunities(opportunitiesArray);
          setCurrentView('opportunities');
          return;
        }
      }
      
      if (response.success) {
        // According to API docs, response is an array of { user, opportunities, totalOpportunities }
        const data = response.data?.data || response.data || [];
        const usersArray = Array.isArray(data) ? data : [];
        
        // Find the selected user and their opportunities
        const foundUser = usersArray.find((item: any) => 
          item.user?.id === userId || 
          item.user?.userId === userId ||
          item.userId === userId
        );
        
        if (foundUser) {
          const opportunities = foundUser.opportunities || [];
          setUserOpportunities(opportunities);
          setCurrentView('opportunities');
        } else {
          Alert.alert('Error', 'User not found');
        }
      } else {
        console.error('❌ Failed to load opportunities:', response.error);
        if (!response.error?.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load opportunities');
        } else {
          Alert.alert(
            'Endpoint Not Available',
            'The new admin opportunities endpoint is not yet deployed. Please contact the backend team.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error loading opportunities:', error);
      Alert.alert('Error', 'Failed to load opportunities. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadOpportunityDetails = async (opportunityId: string) => {
    try {
      setLoadingDetails(true);
      const response = await adminOpportunityDetailsApi.getOpportunityDetails(opportunityId);
      
      console.log('📋 Full response from getOpportunityDetails:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // According to API docs, response structure is:
        // { opportunity, survey, openSolar, calculator, files, solarProjection }
        const data = response.data?.data || response.data;
        console.log('📋 Processed opportunity details:', JSON.stringify(data, null, 2));
        setOpportunityDetails(data);
        setCurrentView('details');
      } else {
        console.error('❌ Failed to load opportunity details:', response.error);
        Alert.alert('Error', response.error || 'Failed to load opportunity details');
      }
    } catch (error) {
      console.error('❌ Error loading opportunity details:', error);
      Alert.alert('Error', 'Failed to load opportunity details. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUserClick = (user: any) => {
    // Navigate to separate screen instead of loading in same screen
    navigation.navigate('AdminUserOpportunities', { 
      userId: user.id || user.userId, 
      userName: user.name || user.username 
    });
  };

  const handleOpportunityClick = (opportunity: any) => {
    // Navigate to separate screen instead of loading in same screen
    const opportunityId = opportunity.ghlOpportunityId || opportunity.id || opportunity.opportunityId;
    if (opportunityId) {
      navigation.navigate('AdminOpportunityDetails', { opportunityId });
    } else {
      Alert.alert('Error', 'Opportunity ID not found');
    }
  };

  const handleBack = () => {
    if (currentView === 'details') {
      setCurrentView('opportunities');
      setOpportunityDetails(null);
      setSelectedOpportunity(null);
    } else if (currentView === 'opportunities') {
      setCurrentView('users');
      setUserOpportunities([]);
      setSelectedUser(null);
    }
  };

  const loadUserProgressData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await calculatorApi.getUserProgressData(user.id, selectedTimeRange);
      
      console.log('📊 Full response from getUserProgressData:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // Ensure data structure is correct - handle nested data
        const data = response.data?.data || response.data;
        console.log('📊 Processed user progress data:', JSON.stringify(data, null, 2));
        
        // Normalize calculator data structure
        if (data?.calculatorData) {
          data.calculatorData = Array.isArray(data.calculatorData) 
            ? data.calculatorData.map((calc: any) => {
                // Normalize calculatorType to always be a string
                let calculatorTypeString = 'Not specified';
                if (calc.calculatorType && typeof calc.calculatorType === 'string') {
                  calculatorTypeString = calc.calculatorType;
                } else if (calc.calculatorTypes) {
                  if (typeof calc.calculatorTypes === 'string') {
                    calculatorTypeString = calc.calculatorTypes;
                  } else if (typeof calc.calculatorTypes === 'object') {
                    const types = Object.keys(calc.calculatorTypes)
                      .filter(key => calc.calculatorTypes[key])
                      .map(key => key.charAt(0).toUpperCase() + key.slice(1));
                    calculatorTypeString = types.length > 0 ? types.join(', ') : 'None';
                  }
                }
                
                // Try to extract customer name and rep from various sources
                const extractedCustomerName = calc.customerDetails?.customerName ||
                                            calc.opportunity?.name ||
                                            calc.opportunity?.contactName ||
                                            calc.name ||
                                            null;
                
                const extractedRepName = calc.user?.name ||
                                       calc.user?.username ||
                                       calc.userName ||
                                       calc.createdBy?.name ||
                                       null;

                return {
                  ...calc,
                  opportunityId: calc.opportunityId || calc.opportunity?.id || 'Unknown',
                  lastSavedAt: calc.lastSavedAt || calc.updatedAt || calc.createdAt || new Date().toISOString(),
                  completed: calc.completed ?? (calc.currentStep === 'completed' || calc.progressPercentage >= 100),
                  calculatorType: calculatorTypeString,
                  currentStep: calc.currentStep || 'Not started',
                  progressPercentage: calc.progressPercentage ?? (calc.completed ? 100 : 0),
                  // Store extracted values for easy access
                  _extractedCustomerName: extractedCustomerName,
                  _extractedRepName: extractedRepName,
                };
              })
            : [];
        }
        
        // Normalize survey data structure
        if (data?.surveyData) {
          data.surveyData = Array.isArray(data.surveyData)
            ? data.surveyData.map((survey: any) => ({
                ...survey,
                opportunityId: survey.opportunityId || survey.opportunity?.id || 'Unknown',
                lastSavedAt: survey.lastSavedAt || survey.updatedAt || survey.createdAt || new Date().toISOString(),
              }))
            : [];
        }
        
        setUserProgressData(data);
      } else {
        console.error('❌ Failed to load progress data:', response.error);
        Alert.alert('Error', response.error || 'Failed to load progress data');
      }
    } catch (error) {
      console.error('❌ Error loading user progress data:', error);
      Alert.alert('Error', 'Failed to load progress data. Please restart the development server.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (currentView === 'users') {
      await loadUsers();
    } else if (currentView === 'opportunities' && selectedUser) {
      await loadUserOpportunities(selectedUser.id || selectedUser.userId);
    } else if (currentView === 'details' && selectedOpportunity) {
      const opportunityId = selectedOpportunity.id || selectedOpportunity.opportunityId || selectedOpportunity.ghlOpportunityId;
      if (opportunityId) {
        await loadOpportunityDetails(opportunityId);
      }
    }
    setRefreshing(false);
  };

  const loadCalculatorDetails = async (calc: any) => {
    try {
      setLoadingDetails(true);
      const opportunityId = calc.opportunityId || calc.opportunity?.id;
      
      if (!opportunityId) {
        Alert.alert('Error', 'Opportunity ID not found');
        return;
      }

      // Fetch opportunity details to get customer name and rep info
      let opportunityDetails = null;
      try {
        const { api } = await import('../utils/api');
        const oppResponse = await api.get(`/opportunities/${opportunityId}/details`);
        if (oppResponse.success) {
          opportunityDetails = oppResponse.data;
        }
      } catch (error) {
        console.warn('Could not fetch opportunity details:', error);
      }

      // Fetch autosave data (calculator-related)
      let autoSaveData = null;
      try {
        const autoSaveResponse = await autoSaveApi.getAutoSaveData(opportunityId);
        if (autoSaveResponse.success) {
          autoSaveData = autoSaveResponse.data?.data || autoSaveResponse.data;
          console.log('📦 Autosave data loaded:', autoSaveData);
        }
      } catch (error) {
        console.warn('Could not fetch autosave data:', error);
      }

      // Enhance calculator data with opportunity details
      const enhancedCalc = {
        ...calc,
        opportunityDetails,
      };

      // Combine calculator data with autosave data
      const details = {
        calculator: enhancedCalc,
        autoSave: autoSaveData,
        opportunityId,
      };

      setDetailedData(details);
      setSelectedCalculator(calc);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error loading calculator details:', error);
      Alert.alert('Error', 'Failed to load detailed data');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatisticsCards = (): StatisticsCard[] => {
    if (!userProgressData) return [];

    // Safely get numeric values, defaulting to 0 if undefined/null
    const totalSurveys = userProgressData.totalSurveys ?? 0;
    const totalCalculators = userProgressData.totalCalculators ?? 0;
    const completedSurveys = userProgressData.completedSurveys ?? 0;
    const completedCalculators = userProgressData.completedCalculators ?? 0;
    const averageCompletionTime = userProgressData.averageCompletionTime ?? 0;
    
    // Calculate completion rate safely
    const totalItems = totalSurveys + totalCalculators;
    const completedItems = completedSurveys + completedCalculators;
    const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return [
      {
        title: 'Total Surveys',
        value: totalSurveys,
        subtitle: 'Survey forms started',
        icon: 'clipboard',
        iconType: 'feather',
        color: theme.primaryButton,
      },
      {
        title: 'Completed Surveys',
        value: completedSurveys,
        subtitle: 'Fully completed surveys',
        icon: 'check-circle',
        iconType: 'feather',
        color: theme.successButton,
      },
      {
        title: 'Total Calculators',
        value: totalCalculators,
        subtitle: 'Calculator sessions started',
        icon: 'grid',
        iconType: 'feather',
        color: theme.warningButton,
      },
      {
        title: 'Completed Calculators',
        value: completedCalculators,
        subtitle: 'Fully completed calculations',
        icon: 'check-square',
        iconType: 'feather',
        color: theme.successButton,
      },
      {
        title: 'Completion Rate',
        value: `${completionRate}%`,
        subtitle: 'Overall completion rate',
        icon: 'trending-up',
        iconType: 'feather',
        color: theme.primaryButton,
      },
      {
        title: 'Avg. Completion Time',
        value: `${averageCompletionTime}m`,
        subtitle: 'Average time to complete',
        icon: 'clock',
        iconType: 'feather',
        color: theme.secondaryButton,
      },
    ];
  };

  const renderFormattedCalculatorData = (calcData: any) => {
    if (!calcData) return null;

    const renderValue = (value: any, depth: number = 0): React.ReactNode => {
      if (value === null || value === undefined) {
        return <Text style={[styles.detailValue, { color: theme.secondaryText, fontStyle: 'italic' }]}>null</Text>;
      }

      if (Array.isArray(value)) {
        return (
          <View style={{ marginLeft: depth * 16, marginTop: 8 }}>
            {value.map((item, index) => (
              <View key={index} style={{ marginBottom: 8 }}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>[{index}]</Text>
                {renderValue(item, depth + 1)}
              </View>
            ))}
          </View>
        );
      }

      if (typeof value === 'object') {
        return (
          <View style={{ marginLeft: depth * 16, marginTop: 8 }}>
            {Object.keys(value).map((key) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                </Text>
                {renderValue(value[key], depth + 1)}
              </View>
            ))}
          </View>
        );
      }

      if (typeof value === 'boolean') {
        return (
          <Text style={[styles.detailValue, { color: value ? theme.successButton : theme.secondaryText }]}>
            {value ? 'Yes' : 'No'}
          </Text>
        );
      }

      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Looks like a date
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return (
              <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                {date.toLocaleString()}
              </Text>
            );
          }
        } catch (e) {
          // Not a valid date, continue as string
        }
      }

      return (
        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
          {String(value)}
        </Text>
      );
    };

    // Filter out internal React Native/metadata fields
    const excludeFields = ['_reactInternalInstance', '_owner', '$$typeof', '__typename'];
    const filteredData = Object.keys(calcData)
      .filter(key => !excludeFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = calcData[key];
        return obj;
      }, {});

    return (
      <View>
        {Object.keys(filteredData).map((key) => {
          const value = filteredData[key];
          // Skip null/undefined/empty values for cleaner display
          if (value === null || value === undefined || 
              (typeof value === 'object' && Object.keys(value).length === 0)) {
            return null;
          }

          return (
            <View key={key} style={{ marginBottom: 16 }}>
              <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
              </Text>
              {renderValue(value)}
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatisticsCard = (card: StatisticsCard) => {
    const IconComponent = card.iconType === 'feather' ? Feather : MaterialIcons;
    
    return (
      <View
        key={card.title}
        style={[
          styles.statisticsCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: card.color + '20' }]}>
            <IconComponent name={card.icon as any} size={24} color={card.color} />
          </View>
          {card.trend && (
            <View style={[
              styles.trendBadge,
              { backgroundColor: card.trend.isPositive ? theme.successButton + '20' : theme.dangerButton + '20' }
            ]}>
              <Feather
                name={card.trend.isPositive ? 'trending-up' : 'trending-down'}
                size={12}
                color={card.trend.isPositive ? theme.successButton : theme.dangerButton}
              />
              <Text style={[
                styles.trendText,
                { color: card.trend.isPositive ? theme.successButton : theme.dangerButton }
              ]}>
                +{card.trend.value}%
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardValue, { color: theme.primaryText }]}>
          {card.value}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
          {card.title}
        </Text>
        <Text style={[styles.cardSubtitle, { color: theme.secondaryText }]}>
          {card.subtitle}
        </Text>
      </View>
    );
  };

  const renderSurveyItem = (survey: any, index: number) => {
    if (!survey) return null;
    
    // Safely format date
    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return 'Not available';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleString();
      } catch (error) {
        return 'Invalid date';
      }
    };
    
    const opportunityId = survey.opportunityId || survey.opportunity?.id || 'Unknown';
    const lastSavedAt = survey.lastSavedAt || survey.updatedAt || survey.createdAt;
    const pagesWithData = survey.surveyPages 
      ? Object.keys(survey.surveyPages).filter(key => survey.surveyPages[key]).length 
      : 0;
    const completionPercentage = survey.completionPercentage ?? 
                                 (survey.completed ? 100 : 0);
    
    // Get customer name
    const customerName = survey.opportunity?.name || 
                        survey.opportunity?.contactName || 
                        survey.customerName || 
                        survey.opportunity?.contactFirstName && survey.opportunity?.contactLastName
                          ? `${survey.opportunity.contactFirstName} ${survey.opportunity.contactLastName}`
                          : survey.opportunity?.contactFirstName || 
                            survey.opportunity?.contactLastName ||
                            'Unknown Customer';
    
    // Get rep/user name
    const repName = survey.user?.name || 
                   survey.user?.username || 
                   survey.assignedTo ||
                   survey.userId ||
                   survey.createdBy?.name ||
                   'Unknown Rep';
    
    return (
      <View
        key={`survey-${opportunityId}-${index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        <View style={styles.dataItemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
              {customerName}
            </Text>
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
              Opportunity: {opportunityId}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: survey.completed ? theme.successButton + '20' : theme.warningButton + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: survey.completed ? theme.successButton : theme.warningButton }
            ]}>
              {survey.completed ? 'Completed' : 'In Progress'}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Rep:</Text> {repName}
          </Text>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Last saved:</Text> {formatDate(lastSavedAt)}
          </Text>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Pages with data:</Text> {pagesWithData}
          </Text>
        </View>
        {completionPercentage !== undefined && completionPercentage > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.inputBackground }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.primaryButton, width: `${Math.min(100, Math.max(0, completionPercentage))}%` }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.secondaryText }]}>
              {Math.round(completionPercentage)}% complete
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCalculatorItem = (calc: any, index: number) => {
    if (!calc) return null;
    
    // Safely format date
    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return 'Not available';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleString();
      } catch (error) {
        return 'Invalid date';
      }
    };
    
    // Handle calculator type display
    const getCalculatorTypes = () => {
      if (calc.calculatorType) {
        return calc.calculatorType;
      }
      if (calc.calculatorTypes) {
        if (typeof calc.calculatorTypes === 'string') {
          return calc.calculatorTypes;
        }
        if (typeof calc.calculatorTypes === 'object') {
          const types = Object.keys(calc.calculatorTypes)
            .filter(key => calc.calculatorTypes[key])
            .map(key => key.charAt(0).toUpperCase() + key.slice(1));
          return types.length > 0 ? types.join(', ') : 'None';
        }
      }
      return 'Not specified';
    };
    
    // Determine completion status
    const isCompleted = calc.completed !== undefined && calc.completed !== null
      ? calc.completed
      : (calc.currentStep === 'completed' || calc.progressPercentage >= 100);
    
    // Get progress percentage
    const progressPercentage = calc.progressPercentage ?? 
                              (isCompleted ? 100 : 
                               (calc.completedSteps ? 
                                (Object.keys(calc.completedSteps).filter(k => calc.completedSteps[k]).length / 6) * 100 : 
                                0));
    
    // Get opportunity ID
    const opportunityId = calc.opportunityId || 
                         calc.opportunity?.id || 
                         calc.opportunityId || 
                         'Unknown';
    
    // Get current step
    const currentStep = calc.currentStep || 
                       (isCompleted ? 'Completed' : 'Not started');
    
    // Get customer name - check multiple sources including calculator's own customerDetails
    const customerName = calc._extractedCustomerName ||
                        calc.opportunityDetails?.name ||
                        calc.opportunityDetails?.contactName ||
                        calc.customerDetails?.customerName ||
                        calc.opportunity?.name || 
                        calc.opportunity?.contactName || 
                        calc.customerName || 
                        calc.opportunity?.contactFirstName && calc.opportunity?.contactLastName
                          ? `${calc.opportunity.contactFirstName} ${calc.opportunity.contactLastName}`
                          : calc.opportunity?.contactFirstName || 
                            calc.opportunity?.contactLastName ||
                            calc.name ||
                            'Unknown Customer';
    
    // Get rep/user name - check multiple sources
    const repName = calc._extractedRepName ||
                   calc.opportunityDetails?.assignedTo ||
                   calc.opportunityDetails?.user?.name ||
                   calc.user?.name || 
                   calc.user?.username || 
                   calc.userName ||
                   calc.createdBy?.name ||
                   calc.createdBy?.username ||
                   calc.assignedTo ||
                   calc.userId ||
                   calc.createdByUserId ||
                   'Unknown Rep';
    
    return (
      <TouchableOpacity
        key={`calc-${opportunityId}-${index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        onPress={() => loadCalculatorDetails(calc)}
        activeOpacity={0.7}
      >
        <View style={styles.dataItemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
              {customerName}
            </Text>
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
              Opportunity: {opportunityId}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isCompleted ? theme.successButton + '20' : theme.warningButton + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: isCompleted ? theme.successButton : theme.warningButton }
            ]}>
              {isCompleted ? 'Completed' : 'In Progress'}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Rep:</Text> {repName}
          </Text>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Calculator type:</Text> {getCalculatorTypes()}
          </Text>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Current step:</Text> {currentStep}
          </Text>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Last saved:</Text> {formatDate(calc.lastSavedAt)}
          </Text>
        </View>
        {progressPercentage !== undefined && progressPercentage > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.inputBackground }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.primaryButton, width: `${Math.min(100, Math.max(0, progressPercentage))}%` }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.secondaryText }]}>
              {Math.round(progressPercentage)}% complete
            </Text>
          </View>
        )}
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.primaryButton, fontSize: 12 }]}>
            Tap to view all details →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const timeRangeOptions = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'all', label: 'All Time' },
  ];

  const renderUserItem = (user: any, index: number) => {
    if (!user) return null;
    
    const userName = user.name || user.username || user.email || 'Unknown User';
    const userEmail = user.email || 'No email';
    const userRole = user.role || 'Unknown';
    const opportunitiesCount = user.opportunitiesCount || user.opportunities?.length || 0;
    
    return (
      <TouchableOpacity
        key={`user-${user.id || user.userId || index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        onPress={() => handleUserClick(user)}
        activeOpacity={0.7}
      >
        <View style={styles.dataItemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
              {userName}
            </Text>
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
              {userEmail}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: theme.primaryButton + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: theme.primaryButton }
            ]}>
              {userRole}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Opportunities:</Text> {opportunitiesCount}
          </Text>
        </View>
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.primaryButton, fontSize: 12 }]}>
            Tap to view opportunities →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOpportunityItem = (opportunity: any, index: number) => {
    if (!opportunity) return null;
    
    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return 'Not available';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleString();
      } catch (error) {
        return 'Invalid date';
      }
    };
    
    // According to API docs, opportunities have: id, ghlOpportunityId, status, currentStep, etc.
    const opportunityId = opportunity.ghlOpportunityId || opportunity.id || opportunity.opportunityId || 'Unknown';
    const customerName = opportunity.contactAddress || 
                        opportunity.contactName || 
                        opportunity.name ||
                        'Unknown Customer';
    
    const hasSurvey = false; // Will be determined from details
    const hasCalculator = false; // Will be determined from details
    const hasOpenSolar = false; // Will be determined from details
    const status = opportunity.status || 'Unknown';
    const currentStep = opportunity.currentStep || 0;
    const totalSteps = opportunity.totalSteps || 0;
    
    return (
      <TouchableOpacity
        key={`opp-${opportunityId}-${index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        onPress={() => handleOpportunityClick(opportunity)}
        activeOpacity={0.7}
      >
        <View style={styles.dataItemHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
              {customerName}
            </Text>
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
              Opportunity ID: {opportunityId}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { 
              backgroundColor: status === 'COMPLETED' ? theme.successButton + '20' : 
                               status === 'IN_PROGRESS' ? theme.warningButton + '20' :
                               theme.secondaryText + '20'
            }
          ]}>
            <Text style={[
              styles.statusText,
              { 
                color: status === 'COMPLETED' ? theme.successButton : 
                       status === 'IN_PROGRESS' ? theme.warningButton :
                       theme.secondaryText,
                fontSize: 10
              }
            ]}>
              {status}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
            <Text style={{ fontWeight: '600' }}>Step:</Text> {currentStep} / {totalSteps}
          </Text>
          {opportunity.contactPostcode && (
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
              <Text style={{ fontWeight: '600' }}>Postcode:</Text> {opportunity.contactPostcode}
            </Text>
          )}
          {opportunity.lastActivityAt && (
            <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
              <Text style={{ fontWeight: '600' }}>Last Activity:</Text> {formatDate(opportunity.lastActivityAt)}
            </Text>
          )}
        </View>
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
          <Text style={[styles.dataItemSubtitle, { color: theme.primaryButton, fontSize: 12 }]}>
            Tap to view full details →
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading your statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminGuard>
      <SafeAreaView 
        style={[
          styles.container, 
          { backgroundColor: theme.primaryBackground },
          Platform.OS === 'web' && {
            height: '100vh',
            maxHeight: '100vh',
          }
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.borderColor }]}
              onPress={() => {
                if (currentView !== 'users') {
                  handleBack();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Feather name="arrow-left" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.primaryText }]}>
              {currentView === 'users' ? 'Statistics & Analytics' : 
               currentView === 'opportunities' ? `${selectedUser?.name || selectedUser?.username || 'User'}'s Opportunities` :
               'Opportunity Details'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              {currentView === 'users' ? 'All users and their opportunities' : 
               currentView === 'opportunities' ? 'View and manage opportunities' :
               'Complete opportunity information'}
            </Text>
          </View>
        </View>

        <View style={[
          { flex: 1 },
          Platform.OS === 'web' && {
            height: 'calc(100vh - 180px)', // Subtract header height
            overflow: 'hidden',
          }
        ]}>
          <ScrollView 
          style={[
            styles.scrollView, 
            { backgroundColor: 'transparent' },
            Platform.OS === 'web' && {
              height: '100%',
              maxHeight: '100%',
            }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryButton} />
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
              minHeight: 'calc(100vh - 180px)' as any, // Ensure content is taller than available space
              paddingBottom: 100, // Extra padding for web
            }
          ]}
          >
            {/* Navigate to separate screen instead */}
            <TouchableOpacity
              style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, marginBottom: 12 }]}
              onPress={() => navigation.navigate('AdminUsersList')}
              activeOpacity={0.7}
            >
              <View style={styles.dataItemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>
                    View All Users
                  </Text>
                  <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
                    Browse users and their opportunities
                  </Text>
                </View>
                <Feather name="arrow-right" size={24} color={theme.primaryButton} />
              </View>
            </TouchableOpacity>

            {/* Keep legacy view for backward compatibility - but it's now just a navigation button */}
            {false && currentView === 'opportunities' && (
              <>
                {loadingDetails ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primaryButton} />
                    <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
                      Loading opportunities...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.dataSection}>
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                      Opportunities ({userOpportunities.length})
                    </Text>
                    {userOpportunities.length > 0 ? (
                      userOpportunities.map((opportunity: any, index: number) => renderOpportunityItem(opportunity, index))
                    ) : (
                      <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
                        <Feather name="briefcase" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
                        <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                          No opportunities found for this user.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Keep legacy view for backward compatibility */}
            {false && currentView === 'details' && (
              <>
                {loadingDetails ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primaryButton} />
                    <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
                      Loading opportunity details...
                    </Text>
                  </View>
                ) : opportunityDetails ? (
                  <View style={styles.dataSection}>
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                      Opportunity Details
                    </Text>
                    
                    {/* Opportunity Information */}
                    {opportunityDetails.opportunity && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          Opportunity Information
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Opportunity ID:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.opportunity.ghlOpportunityId || opportunityDetails.opportunity.id || 'Unknown'}
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Status:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.opportunity.status || 'Unknown'}
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Current Step:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.opportunity.currentStep || 0} / {opportunityDetails.opportunity.totalSteps || 0}
                        </Text>
                        {opportunityDetails.opportunity.contactAddress && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Address:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {opportunityDetails.opportunity.contactAddress}
                            </Text>
                          </>
                        )}
                        {opportunityDetails.opportunity.contactPostcode && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Postcode:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {opportunityDetails.opportunity.contactPostcode}
                            </Text>
                          </>
                        )}
                        {renderFormattedCalculatorData(opportunityDetails.opportunity)}
                      </View>
                    )}

                    {/* User Information */}
                    {opportunityDetails.opportunity?.user && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          User Information
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Name:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.opportunity.user.name || opportunityDetails.opportunity.user.username || 'Unknown'}
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Email:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.opportunity.user.email || 'No email'}
                        </Text>
                        {opportunityDetails.opportunity.user.ghlUserId && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>GHL User ID:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {opportunityDetails.opportunity.user.ghlUserId}
                            </Text>
                          </>
                        )}
                      </View>
                    )}

                    {/* Survey Data */}
                    {opportunityDetails.survey && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          Survey Data
                        </Text>
                        {opportunityDetails.survey.data && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Status:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {opportunityDetails.survey.data.status || 'Unknown'}
                            </Text>
                            {opportunityDetails.survey.data.eligibilityScore !== null && (
                              <>
                                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Eligibility Score:</Text>
                                <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                                  {opportunityDetails.survey.data.eligibilityScore}
                                </Text>
                              </>
                            )}
                            {/* Survey Pages */}
                            {['page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8'].map((pageKey) => {
                              const pageData = opportunityDetails.survey.data[pageKey];
                              if (!pageData) return null;
                              
                              return (
                                <View key={pageKey} style={{ marginBottom: 16, marginTop: 16 }}>
                                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
                                    {pageKey.charAt(0).toUpperCase() + pageKey.slice(1)}
                                  </Text>
                                  {renderFormattedCalculatorData(pageData)}
                                </View>
                              );
                            })}
                          </>
                        )}
                        {/* Survey Images */}
                        {opportunityDetails.survey.images && Array.isArray(opportunityDetails.survey.images) && opportunityDetails.survey.images.length > 0 && (
                          <View style={{ marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Survey Images</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {opportunityDetails.survey.images.map((image: any, imgIndex: number) => (
                                <View key={imgIndex} style={{ marginBottom: 8 }}>
                                  <Image
                                    source={{ uri: image.url }}
                                    style={{ width: 150, height: 150, borderRadius: 8 }}
                                    resizeMode="cover"
                                  />
                                  <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: 10, marginTop: 4 }]}>
                                    {image.fieldName || image.fileName}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Calculator Data */}
                    {opportunityDetails.calculator && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          Calculator Data
                        </Text>
                        {opportunityDetails.calculator.hasOffPeak && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Off-Peak Calculator</Text>
                            {opportunityDetails.calculator.calculators?.['off-peak'] && (
                              renderFormattedCalculatorData(opportunityDetails.calculator.calculators['off-peak'])
                            )}
                          </View>
                        )}
                        {opportunityDetails.calculator.hasFlux && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Flux Calculator</Text>
                            {opportunityDetails.calculator.calculators?.flux && (
                              renderFormattedCalculatorData(opportunityDetails.calculator.calculators.flux)
                            )}
                          </View>
                        )}
                        {opportunityDetails.calculator.hasEpvs && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>EPVS Calculator</Text>
                            {opportunityDetails.calculator.calculators?.epvs && (
                              renderFormattedCalculatorData(opportunityDetails.calculator.calculators.epvs)
                            )}
                          </View>
                        )}
                      </View>
                    )}

                    {/* OpenSolar Project */}
                    {opportunityDetails.openSolar && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          OpenSolar Project
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Project ID:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.openSolar.opensolarProjectId || 'N/A'}
                        </Text>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Project Name:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {opportunityDetails.openSolar.projectName || 'N/A'}
                        </Text>
                        {opportunityDetails.openSolar.address && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Address:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {opportunityDetails.openSolar.address}
                            </Text>
                          </>
                        )}
                        {opportunityDetails.openSolar.systems && Array.isArray(opportunityDetails.openSolar.systems) && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Systems:</Text>
                            {renderFormattedCalculatorData(opportunityDetails.openSolar.systems)}
                          </>
                        )}
                        {renderFormattedCalculatorData(opportunityDetails.openSolar)}
                      </View>
                    )}

                    {/* Files */}
                    {opportunityDetails.files && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          Files
                        </Text>
                        {opportunityDetails.files.excel && Array.isArray(opportunityDetails.files.excel) && opportunityDetails.files.excel.length > 0 && (
                          <View style={{ marginBottom: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Excel Files</Text>
                            {opportunityDetails.files.excel.map((file: any, index: number) => (
                              <View key={index} style={{ marginBottom: 8, marginTop: 8 }}>
                                <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                                  {file.fileName || 'Unknown file'}
                                </Text>
                                <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: 10 }]}>
                                  Type: {file.calculatorType || 'Unknown'} | Size: {file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Unknown'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {opportunityDetails.files.pdf && Array.isArray(opportunityDetails.files.pdf) && opportunityDetails.files.pdf.length > 0 && (
                          <View style={{ marginBottom: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>PDF Files</Text>
                            {opportunityDetails.files.pdf.map((file: any, index: number) => (
                              <View key={index} style={{ marginBottom: 8, marginTop: 8 }}>
                                <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                                  {file.fileName || 'Unknown file'}
                                </Text>
                                <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: 10 }]}>
                                  Type: {file.calculatorType || 'Unknown'} | Size: {file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Unknown'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Solar Projection */}
                    {opportunityDetails.solarProjection && (
                      <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                        <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                          Solar Projection
                        </Text>
                        {opportunityDetails.solarProjection['off-peak'] && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Off-Peak Projection</Text>
                            {renderFormattedCalculatorData(opportunityDetails.solarProjection['off-peak'])}
                          </View>
                        )}
                        {opportunityDetails.solarProjection.flux && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Flux Projection</Text>
                            {renderFormattedCalculatorData(opportunityDetails.solarProjection.flux)}
                          </View>
                        )}
                        {opportunityDetails.solarProjection.epvs && (
                          <View style={{ marginBottom: 16, marginTop: 16 }}>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>EPVS Projection</Text>
                            {renderFormattedCalculatorData(opportunityDetails.solarProjection.epvs)}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Full Details */}
                    <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                      <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                        Full Details
                      </Text>
                      {renderFormattedCalculatorData(opportunityDetails)}
                    </View>
                  </View>
                ) : (
                  <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
                    <Feather name="alert-circle" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
                    <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                      No details available for this opportunity.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* Details Modal */}
        <Modal
          visible={showDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                  Calculator Details
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDetailsModal(false)}
                  style={[styles.modalCloseButton, { backgroundColor: theme.inputBackground }]}
                >
                  <Feather name="x" size={24} color={theme.primaryText} />
                </TouchableOpacity>
              </View>

              {loadingDetails ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primaryButton} />
                  <Text style={[styles.modalLoadingText, { color: theme.secondaryText }]}>
                    Loading details...
                  </Text>
                </View>
              ) : detailedData ? (
                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
                  {/* Calculator Info */}
                  <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                      Calculator Information
                    </Text>
                    {detailedData.calculator && (
                      <View>
                        {detailedData.calculator.opportunityDetails && (
                          <>
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Customer Name:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {detailedData.calculator.opportunityDetails.name || 
                               detailedData.calculator.opportunityDetails.contactName ||
                               detailedData.calculator.customerDetails?.customerName ||
                               'Unknown'}
                            </Text>
                            
                            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Assigned To:</Text>
                            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                              {detailedData.calculator.opportunityDetails.assignedTo || 
                               detailedData.calculator.opportunityDetails.user?.name ||
                               detailedData.calculator.user?.name ||
                               'Unknown'}
                            </Text>
                          </>
                        )}
                        
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Opportunity ID:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {detailedData.opportunityId}
                        </Text>
                        
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Calculator Type:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {detailedData.calculator.calculatorType || 'Not specified'}
                        </Text>
                        
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Current Step:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {detailedData.calculator.currentStep || 'Not started'}
                        </Text>
                        
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Progress:</Text>
                        <Text style={[styles.detailValue, { color: theme.primaryText }]}>
                          {detailedData.calculator.progressPercentage ?? 0}%
                        </Text>
                        
                        <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Completed:</Text>
                        <Text style={[styles.detailValue, { color: detailedData.calculator.completed ? theme.successButton : theme.secondaryText }]}>
                          {detailedData.calculator.completed ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Calculator Progress Data (AutoSave) */}
                  {detailedData.calculator && (
                    <>
                      {/* Template Selection Data */}
                      {detailedData.calculator.templateSelection && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Template Selection
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.templateSelection)}
                        </View>
                      )}

                      {/* Radio Button Selections */}
                      {detailedData.calculator.radioButtonSelections && Object.keys(detailedData.calculator.radioButtonSelections).length > 0 && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Radio Button Selections
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.radioButtonSelections)}
                        </View>
                      )}

                      {/* Dynamic Inputs */}
                      {detailedData.calculator.dynamicInputs && Object.keys(detailedData.calculator.dynamicInputs).length > 0 && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Dynamic Inputs
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.dynamicInputs)}
                        </View>
                      )}

                      {/* Arrays Data */}
                      {detailedData.calculator.arraysData && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Arrays Data
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.arraysData)}
                        </View>
                      )}

                      {/* Pricing Data */}
                      {detailedData.calculator.pricingData && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Pricing Data
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.pricingData)}
                        </View>
                      )}

                      {/* Customer Details */}
                      {detailedData.calculator.customerDetails && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Customer Details
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.customerDetails)}
                        </View>
                      )}

                      {/* Selected Options (if exists) */}
                      {detailedData.calculator.selectedOptions && Object.keys(detailedData.calculator.selectedOptions).length > 0 && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Selected Options
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.selectedOptions)}
                        </View>
                      )}

                      {/* Input Values (if exists) */}
                      {detailedData.calculator.inputValues && Object.keys(detailedData.calculator.inputValues).length > 0 && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Input Values
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.inputValues)}
                        </View>
                      )}

                      {/* Completed Steps */}
                      {detailedData.calculator.completedSteps && Object.keys(detailedData.calculator.completedSteps).length > 0 && (
                        <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                          <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                            Completed Steps
                          </Text>
                          {renderFormattedCalculatorData(detailedData.calculator.completedSteps)}
                        </View>
                      )}
                    </>
                  )}

                  {/* Full Calculator Data - Formatted */}
                  <View style={[styles.detailSection, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.detailSectionTitle, { color: theme.primaryText }]}>
                      Full Calculator Data
                    </Text>
                    {renderFormattedCalculatorData(detailedData.calculator)}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerText: {
    alignItems: 'center',
  },
  title: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  timeRangeContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statisticsSection: {
    marginBottom: 24,
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statisticsCard: {
    width: (width - 48 - 12) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  dataSection: {
    marginBottom: 24,
  },
  dataItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dataItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dataItemSubtitle: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  lastActivityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  lastActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  lastActivityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastActivityText: {
    fontSize: 14,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 800,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  modalScrollView: {
    maxHeight: Platform.OS === 'web' ? 600 : 500,
  },
  detailSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    marginBottom: 8,
  },
});

export default StatisticsAnalyticsScreen;
