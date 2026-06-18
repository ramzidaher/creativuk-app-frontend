// Dynamic dashboard with API integration and animations
import {
  Feather
} from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import WinLossStatsCard from '../components/WinLossStatsCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { reportsApi } from '../utils/api';
// React Native Paper components for automatic theme switching
import { Switch } from 'react-native-paper';
import MobileCanvasSignaturePad from '../components/MobileCanvasSignaturePad';
import SimpleSignaturePad from '../components/SimpleSignaturePad';
import {
  DASHBOARD_APPOINTMENTS_HELP_ADMIN,
  DASHBOARD_APPOINTMENTS_HELP_REP,
  DASHBOARD_APPOINTMENTS_LABEL_ADMIN,
  DASHBOARD_APPOINTMENTS_LABEL_REP,
  DASHBOARD_APPOINTMENTS_TIP_BODY,
  DASHBOARD_APPOINTMENTS_TIP_CTA,
  DASHBOARD_APPOINTMENTS_TIP_TITLE,
  DASHBOARD_CONVERSION_HELP_ADMIN,
  DASHBOARD_CONVERSION_HELP_REP,
  DASHBOARD_CONVERSION_LABEL,
  DASHBOARD_SALES_WON_HELP,
  DASHBOARD_SALES_WON_LABEL,
  DASHBOARD_SECTION_TITLE,
  DASHBOARD_STATS_INFO_BODY,
  DASHBOARD_STATS_INFO_TITLE,
  getDashboardPeriodLabel,
  getDashboardSectionSubtitle,
} from '../constants/dashboardCopy';

const { width, height } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  // Check if user is admin
  const isAdmin = user?.role === 'ADMIN';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // State management
  const [salesPerformanceData, setSalesPerformanceData] = useState<any>(null);
  const [previousSalesPerformanceData, setPreviousSalesPerformanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Month/Year filtering state
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Digital Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSigningPDF, setIsSigningPDF] = useState(false);

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Calculate insights from mock data
  const getInsights = () => {
    // Return mock data instead of API data
    return {
      all: 12,
      ai: 8,
      manual: 4
    };
  };

  // Get sales performance insights from real data
  const getSalesInsights = () => {
    if (salesPerformanceData) {
      const stats = salesPerformanceData.stats || {};
      const appointmentsMetric = isAdmin
        ? (stats.satAppointmentsCount ?? stats.appointmentsCount ?? 0)
        : (stats.appointmentsCount ?? 0);
      return {
        appointments: appointmentsMetric,
        sales: stats.soldCount || 0,
        conversionRate: stats.conversionRate || 0,
        salesValue: stats.totalValue || 0,
      };
    }
    
    // Return default values when no data is available
    return {
      appointments: 0,
      sales: 0,
      conversionRate: 0,
      salesValue: 0,
    };
  };

  // Calculate trend data based on current vs previous period
  const getTrendData = () => {
    if (!salesPerformanceData || !previousSalesPerformanceData) {
      return {
        appointments: { value: 0, isPositive: true },
        sales: { value: 0, isPositive: true },
        conversionRate: { value: 0, isPositive: true },
      };
    }

    const current = getSalesInsights();
    const previousStats = previousSalesPerformanceData.stats || {};
    const previous = {
      appointments: isAdmin
        ? (previousStats.satAppointmentsCount ?? previousStats.appointmentsCount ?? 0)
        : (previousStats.appointmentsCount ?? 0),
      sales: previousStats.soldCount || 0,
      conversionRate: previousStats.conversionRate || 0,
    };

    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current > 0 };
      const change = ((current - previous) / previous) * 100;
      return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
    };

    return {
      appointments: calculateTrend(current.appointments, previous.appointments),
      sales: calculateTrend(current.sales, previous.sales),
      conversionRate: calculateTrend(current.conversionRate, previous.conversionRate),
    };
  };

  const buildDateRange = (month: string, year: string) => {
    const now = new Date();
    const monthNum = month ? parseInt(month, 10) : now.getMonth() + 1;
    const yearNum = year ? parseInt(year, 10) : now.getFullYear();
    const start = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    const end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
    return { start, end };
  };

  // Load dashboard data using reporting API (same logic as Reports screen)
  const fetchData = async (monthOverride?: string, yearOverride?: string) => {
    try {
      setError(null);
      setLoading(true);

      const useMonth = monthOverride ?? selectedMonth;
      const useYear = yearOverride ?? selectedYear;
      const { start, end } = buildDateRange(useMonth, useYear);

      const previousStart = new Date(start);
      previousStart.setMonth(previousStart.getMonth() - 1);
      const previousEnd = new Date(end);
      previousEnd.setMonth(previousEnd.getMonth() - 1);

      const targetUserId = isAdmin ? undefined : user?.id;
      const [currentRes, previousRes] = await Promise.all([
        reportsApi.getSummary(start.toISOString(), end.toISOString(), targetUserId),
        reportsApi.getSummary(previousStart.toISOString(), previousEnd.toISOString(), targetUserId),
      ]);

      if (!currentRes.success) {
        throw new Error(currentRes.error || 'Failed to load dashboard reporting');
      }

      setSalesPerformanceData(currentRes.data || null);
      setPreviousSalesPerformanceData(previousRes.success ? previousRes.data || null : null);
      setDataLoaded(true);
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
      setLoading(false);
    }
  };

  // Refresh data including win/loss stats
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    // Force refresh of WinLossStatsCard
    setRefreshKey(prev => prev + 1);
    setRefreshing(false);
  };

  // Handle date filter change (mock)
  const handleDateFilterChange = async (month: string, year: string) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setShowDatePicker(false);
    await fetchData(month, year);
  };

  // Reset to current month/year (mock)
  const resetToCurrentMonth = async () => {
    setSelectedMonth('');
    setSelectedYear('');
    await fetchData();
  };

  // Test Digital Signature Function
  const handleTestDigitalSignature = () => {
    console.log('🖊️ Dashboard: Digital signature button clicked');
    setShowSignaturePad(true);
  };

  const handleSignatureSave = async (signatureData: string, digitalFootprint: any) => {
    console.log('🖊️ Dashboard: Signature save called', { 
      signatureDataLength: signatureData.length,
      digitalFootprint: digitalFootprint ? 'present' : 'missing'
    });
    try {
      setIsSigningPDF(true);
      setShowSignaturePad(false);

      // Call the backend to sign the PDF
      const baseURL = ' /api/';
      const response = await fetch(`${baseURL}/digital-signature/sign-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfPath: 'src/excel-file-calculator/epvs-opportunities/pdfs/EPVS Calculator - 47hmE2SisQlAC8Ppd5O3.pdf',
          signatureData,
          digitalFootprint,
          opportunityId: '47hmE2SisQlAC8Ppd5O3',
          signedBy: user?.name || 'Test User',
          pageNumbers: [6, 19, 21, 23]
        }),
      });

      console.log('🖊️ Dashboard: API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🖊️ Dashboard: API response result:', result);

      if (result.success) {
        Alert.alert(
          'Success!',
          `PDF signed successfully with digital footprint!\n\nSignature ID: ${result.metadata?.signatureId}\nVerification Hash: ${result.metadata?.verificationHash}`,
          [
            {
              text: 'View PDF',
              onPress: () => {
                // Open the signed PDF
                const pdfUrl = `${baseURL}/digital-signature/test-pdf/47hmE2SisQlAC8Ppd5O3`;
                if (Platform.OS === 'web') {
                  window.open(pdfUrl, '_blank');
                } else {
                  // For mobile, you might want to use a PDF viewer
                  Alert.alert('PDF Ready', 'The signed PDF is ready for download.');
                }
              }
            },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to sign PDF');
      }
    } catch (error) {
      console.error('🖊️ Dashboard: Error signing PDF:', error);
      Alert.alert(
        'Error', 
        `Failed to sign PDF: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n1. Backend server is running\n2. PDF file exists\n3. Network connection`
      );
    } finally {
      setIsSigningPDF(false);
    }
  };

  // Test Survey Function
  const handleTestSurvey = async () => {
    try {
      // Import necessary modules
      const { Alert } = require('react-native');
      const ImagePicker = require('expo-image-picker');
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to test the survey.');
        return;
      }

      // Pick one image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const testImage = result.assets[0];
        
        // Create test opportunity data
        const testOpportunityId = 'test-survey-' + Date.now();
        const testUserId = user?.id || 'test-user';
        
        // Sample survey data
        const testSurveyData = {
          ghlOpportunityId: testOpportunityId,
          ghlUserId: testUserId,
          page1: {
            date: new Date().toISOString().split('T')[0],
            customerName: 'Test Customer',
            address: '123 Test Street',
            postcode: 'TE1 1ST',
            homeOwnersAvailable: 'Yes - Skip Next',
          },
          page2: {
            selectedReasons: ['Reduce electricity bills', 'Environmental concerns'],
          },
          page3: {
            property: 'House',
            propertyType: 'Detached',
            bedrooms: '3',
            lengthOfStay: '10-20 years',
            movingPlans: 'No',
            occupants: '2',
          },
          page4: {
            heatingType: 'Gas boiler',
            hotWater: 'Gas boiler',
            energyBill: [testImage, testImage, testImage], // Duplicate the same image
          },
          page5: {
            frontDoor: [testImage, testImage, testImage],
            frontProperty: [testImage, testImage, testImage],
            targetRoofs: [testImage, testImage, testImage],
            roofAngle: [testImage, testImage, testImage],
            roofTileCloseup: [testImage, testImage, testImage],
            electricMeter: [testImage, testImage, testImage],
            fuseBoard: [testImage, testImage, testImage],
            batteryInverterLocation: [testImage, testImage, testImage],
          },
          page6: {
            solarBattery: 'Yes',
            evCharger: 'Yes',
            evChargerQuantity: '1',
            optimisers: 'Yes',
            optimisersQuantity: '2',
            scaffoldingRequired: 'Yes',
            scaffoldingThroughHouse: 'No',
            scaffoldingType: 'Over 9 meters',
          },
          page7: {
            epcRating: 'C',
            previousFunding: 'No',
            financialIssues: 'No',
            creditRating: 'Good',
            installationAvailability: 'Within 3 months',
          },
          page8: {
            additionalNotes: 'This is a test survey submission.',
          },
        };

        // Navigate to survey screen with test data
        navigation.navigate('SurveyScreen', {
          opportunityId: testOpportunityId,
          testMode: true,
          testData: testSurveyData,
        });

        Alert.alert(
          'Test Survey Created',
          'Test survey has been created with sample data. You can now test the submission flow.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Test survey error:', error);
      Alert.alert('Error', 'Failed to create test survey. Please try again.');
    }
  };

  // Load data on component mount with delay
  useEffect(() => {
    // Show dashboard immediately, load data in background
    const timer = setTimeout(() => {
      setLoading(true);
      fetchData();
    }, 100); // Small delay to show UI first

    return () => clearTimeout(timer);
  }, [isAdmin, user?.id]);

  const insights = getInsights();

  // Animated card component
  const AnimatedCard = ({ children, delay = 0, style = {} }: any) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 800,
        delay: delay,
        useNativeDriver: true,
      }).start();
    }, []);

    const translateY = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0],
    });

    const opacity = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <Animated.View
        style={[
          {
            opacity,
            transform: [{ translateY }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>

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
            <Text style={[styles.greeting, { color: theme.secondaryText }]}>
              {isAuthenticated ? `Welcome, ${user?.name || 'User'}` : 'Welcome'}
            </Text>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Dashboard</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.cardBackground }]} onPress={onRefresh}>
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>

            {/* React Native Paper Theme Switch */}
            <View style={[styles.themeSwitchContainer, { backgroundColor: theme.cardBackground }]}>
              <Feather 
                name="sun" 
                size={16} 
                color={isDark ? theme.secondaryText : '#f59e0b'} 
                style={{ marginRight: 8 }}
              />
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
              />
              <Feather 
                name="moon" 
                size={16} 
                color={isDark ? '#8b5cf6' : theme.secondaryText} 
                style={{ marginLeft: 8 }}
              />
            </View>
            
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
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
              minHeight: '100vh' as any, // Ensure content is taller than viewport
              paddingBottom: 100, // Extra padding for web
            }
          ]}
        >
          {/* Error Message */}
          {error && (
            <AnimatedCard delay={100}>
              <View style={[styles.errorCard, { backgroundColor: theme.cardBackground, borderColor: theme.dangerButton + '20' }]}>
                <Feather name="alert-circle" size={24} color={theme.dangerButton} />
                <Text style={[styles.errorText, { color: theme.dangerButton }]}>{error}</Text>
                <TouchableOpacity onPress={fetchData} style={[styles.retryButton, { backgroundColor: theme.dangerButton }]}>
                  <Text style={[styles.retryText, { color: theme.cardBackground }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            </AnimatedCard>
          )}

          {/* Sales Performance Overview */}
          <AnimatedCard delay={300}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>{DASHBOARD_SECTION_TITLE}</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
                  {getDashboardSectionSubtitle(selectedMonth, selectedYear)}
                </Text>
              </View>
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity 
                  style={[styles.dateFilterButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                  onPress={() => setShowDatePicker(!showDatePicker)}
                >
                  <Feather name="calendar" size={16} color={theme.primaryButton} />
                  <Text style={[styles.dateFilterText, { color: theme.primaryButton }]}>
                    {selectedMonth && selectedYear
                      ? getDashboardPeriodLabel(selectedMonth, selectedYear)
                      : getDashboardPeriodLabel('', '')}
                  </Text>
                  <Feather name={showDatePicker ? "chevron-up" : "chevron-down"} size={16} color={theme.primaryButton} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Picker */}
            {showDatePicker && (
              <View style={[styles.datePickerContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.datePickerRow}>
                  <View style={styles.datePickerColumn}>
                    <Text style={[styles.datePickerLabel, { color: theme.secondaryText }]}>Month</Text>
                    <View style={styles.monthButtons}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = (i + 1).toString();
                        const monthName = new Date(2024, i).toLocaleString('default', { month: 'short' });
                        return (
                          <TouchableOpacity
                            key={month}
                            style={[
                              styles.monthButton,
                              { 
                                backgroundColor: selectedMonth === month ? theme.primaryButton : 'transparent',
                                borderColor: theme.cardBorder
                              }
                            ]}
                            onPress={() => setSelectedMonth(month)}
                          >
                            <Text style={[
                              styles.monthButtonText,
                              { color: selectedMonth === month ? 'white' : theme.primaryText }
                            ]}>
                              {monthName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  
                  <View style={styles.datePickerColumn}>
                    <Text style={[styles.datePickerLabel, { color: theme.secondaryText }]}>Year</Text>
                    <View style={styles.yearButtons}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = (new Date().getFullYear() - 2 + i).toString();
                        return (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.yearButton,
                              { 
                                backgroundColor: selectedYear === year ? theme.primaryButton : 'transparent',
                                borderColor: theme.cardBorder
                              }
                            ]}
                            onPress={() => setSelectedYear(year)}
                          >
                            <Text style={[
                              styles.yearButtonText,
                              { color: selectedYear === year ? 'white' : theme.primaryText }
                            ]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
                
                <View style={styles.datePickerActions}>
                  <TouchableOpacity 
                    style={[styles.datePickerActionButton, { backgroundColor: theme.secondaryButton }]}
                    onPress={resetToCurrentMonth}
                  >
                    <Text style={[styles.datePickerActionText, { color: theme.cardBackground }]}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.datePickerActionButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => handleDateFilterChange(selectedMonth, selectedYear)}
                  >
                    <Text style={[styles.datePickerActionText, { color: 'white' }]}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Feather name="calendar" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.statBadgeContainer}>
                    <Text style={[styles.statBadge, { backgroundColor: theme.primaryButton + '15', borderColor: theme.primaryButton + '30' }]}>
                      {selectedMonth && selectedYear
                        ? getDashboardPeriodLabel(selectedMonth, selectedYear)
                        : 'This month'}
                    </Text>
                    <View style={styles.statTrend}>
                      <Feather 
                        name={getTrendData().appointments.isPositive ? "arrow-up" : "arrow-down"} 
                        size={12} 
                        color={getTrendData().appointments.isPositive ? theme.successButton : theme.dangerButton} 
                      />
                      <Text style={[
                        styles.statTrendText, 
                        { color: getTrendData().appointments.isPositive ? theme.successButton : theme.dangerButton }
                      ]}>
                        {getTrendData().appointments.isPositive ? '+' : '-'}{getTrendData().appointments.value}%
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.statNumber, { color: theme.primaryText }]}>
                  {loading ? '...' : getSalesInsights().appointments || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.secondaryText }]}>
                  {isAdmin ? DASHBOARD_APPOINTMENTS_LABEL_ADMIN : DASHBOARD_APPOINTMENTS_LABEL_REP}
                </Text>
                <Text style={[styles.statHelp, { color: theme.secondaryText }]}>
                  {isAdmin ? DASHBOARD_APPOINTMENTS_HELP_ADMIN : DASHBOARD_APPOINTMENTS_HELP_REP}
                </Text>
                <View style={[styles.statProgress, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <View style={[styles.statProgressBar, { width: '60%', backgroundColor: theme.primaryButton }]} />
                </View>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIcon, { backgroundColor: theme.successButton + '20' }]}>
                    <Feather name="check-circle" size={20} color={theme.successButton} />
                  </View>
                  <View style={styles.statBadgeContainer}>
                    <Text style={[styles.statBadge, { backgroundColor: theme.successButton + '15', borderColor: theme.successButton + '30' }]}>Won</Text>
                    <View style={styles.statTrend}>
                      <Feather 
                        name={getTrendData().sales.isPositive ? "arrow-up" : "arrow-down"} 
                        size={12} 
                        color={getTrendData().sales.isPositive ? theme.successButton : theme.dangerButton} 
                      />
                      <Text style={[
                        styles.statTrendText, 
                        { color: getTrendData().sales.isPositive ? theme.successButton : theme.dangerButton }
                      ]}>
                        {getTrendData().sales.isPositive ? '+' : '-'}{getTrendData().sales.value}%
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.statNumber, { color: theme.primaryText }]}>
                  {loading ? '...' : getSalesInsights().sales || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.secondaryText }]}>{DASHBOARD_SALES_WON_LABEL}</Text>
                <Text style={[styles.statHelp, { color: theme.secondaryText }]}>{DASHBOARD_SALES_WON_HELP}</Text>
                <View style={[styles.statProgress, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <View style={[styles.statProgressBar, { width: '40%', backgroundColor: theme.successButton }]} />
                </View>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                    <Feather name="percent" size={20} color={theme.primaryButton} />
                  </View>
                  <View style={styles.statBadgeContainer}>
                    <Text style={[styles.statBadge, { backgroundColor: theme.primaryButton + '15', borderColor: theme.primaryButton + '30' }]}>Rate</Text>
                    <View style={styles.statTrend}>
                      <Feather 
                        name={getTrendData().conversionRate.isPositive ? "arrow-up" : "arrow-down"} 
                        size={12} 
                        color={getTrendData().conversionRate.isPositive ? theme.successButton : theme.dangerButton} 
                      />
                      <Text style={[
                        styles.statTrendText, 
                        { color: getTrendData().conversionRate.isPositive ? theme.successButton : theme.dangerButton }
                      ]}>
                        {getTrendData().conversionRate.isPositive ? '+' : '-'}{getTrendData().conversionRate.value}%
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.statNumber, { color: theme.primaryText }]}>
                  {loading ? '...' : `${getSalesInsights().conversionRate || 0}%`}
                </Text>
                <Text style={[styles.statLabel, { color: theme.secondaryText }]}>{DASHBOARD_CONVERSION_LABEL}</Text>
                <Text style={[styles.statHelp, { color: theme.secondaryText }]}>
                  {isAdmin ? DASHBOARD_CONVERSION_HELP_ADMIN : DASHBOARD_CONVERSION_HELP_REP}
                </Text>
                <View style={[styles.statProgress, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <View style={[styles.statProgressBar, { width: `${Math.min((getSalesInsights().conversionRate || 0) * 2, 100)}%`, backgroundColor: theme.primaryButton }]} />
                </View>
              </View>
            </View>

            <View style={[styles.dashboardInfoCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: theme.cardBorder }]}>
              <Feather name="info" size={16} color={theme.primaryButton} />
              <View style={styles.dashboardInfoCardText}>
                <Text style={[styles.dashboardInfoCardTitle, { color: theme.primaryText }]}>
                  {DASHBOARD_STATS_INFO_TITLE}
                </Text>
                <Text style={[styles.dashboardInfoCardBody, { color: theme.secondaryText }]}>
                  {DASHBOARD_STATS_INFO_BODY}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.dashboardTipCard, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}
              onPress={() => navigation.navigate('Opportunities')}
              activeOpacity={0.85}
            >
              <Feather name="calendar" size={18} color="#1d4ed8" />
              <View style={styles.dashboardTipCardText}>
                <Text style={styles.dashboardTipCardTitle}>{DASHBOARD_APPOINTMENTS_TIP_TITLE}</Text>
                <Text style={styles.dashboardTipCardBody}>{DASHBOARD_APPOINTMENTS_TIP_BODY}</Text>
                <Text style={styles.dashboardTipCardCta}>{DASHBOARD_APPOINTMENTS_TIP_CTA} →</Text>
              </View>
            </TouchableOpacity>
          </AnimatedCard>





          {/* Win/Loss Statistics Card */}
          <AnimatedCard delay={600}>
            <WinLossStatsCard 
              key={refreshKey}
              isAdmin={isAdmin}
              startDate={selectedMonth && selectedYear ? new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1) : undefined}
              endDate={selectedMonth && selectedYear ? new Date(parseInt(selectedYear), parseInt(selectedMonth), 0) : undefined}
              onRefresh={onRefresh}
            />
          </AnimatedCard>

        </ScrollView>
        
        {/* Digital Signature Pad Modal */}
        {Platform.OS === 'web' ? (
          <SimpleSignaturePad
            visible={showSignaturePad}
            onClose={() => setShowSignaturePad(false)}
            onSave={handleSignatureSave}
            title="Test Digital Signature"
          />
        ) : (
          <MobileCanvasSignaturePad
            visible={showSignaturePad}
            onClose={() => setShowSignaturePad(false)}
            onSave={handleSignatureSave}
            title="Test Digital Signature"
          />
        )}

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent',
  },
  
  // Modern Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    backgroundColor: 'transparent',
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
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: width < 768 ? 12 : 16,
  },
  greeting: {
    fontSize: 18,
    marginBottom: 8,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  iconButton: {
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
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
  themeSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },

  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Section Header Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  dateFilterContainer: {
    marginLeft: 16,
  },
  sectionTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 15,
    marginTop: 6,
    lineHeight: 20,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 20,
  },

  // Stats Overview
  statsContainer: {
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'space-between',
    gap: width < 768 ? 16 : 20,
    marginBottom: 32,
  },
  statCard: {
    flex: width < 768 ? undefined : 1,
    padding: width < 768 ? 20 : 24,
    borderRadius: 24,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    marginHorizontal: width < 768 ? 0 : 6,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statBadgeContainer: {
    alignItems: 'center',
  },
  statBadge: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statTrendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statNumber: {
    fontSize: width < 768 ? 32 : 40,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statHelp: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
    paddingHorizontal: 4,
    opacity: 0.9,
  },
  dashboardInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dashboardInfoCardText: { flex: 1 },
  dashboardInfoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  dashboardInfoCardBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  dashboardTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dashboardTipCardText: { flex: 1 },
  dashboardTipCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  dashboardTipCardBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1e40af',
  },
  dashboardTipCardCta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    marginTop: 8,
  },
  statProgress: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  statProgressBar: {
    height: '100%',
    borderRadius: 4,
  },





  // Error Card
  errorCard: {
    backgroundColor: 'transparent',
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  // Background Image Styles
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  },

  // Date Picker Styles
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  dateFilterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 20,
  },
  datePickerColumn: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  monthButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  yearButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  yearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  yearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  datePickerActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },


});

export default DashboardScreen;