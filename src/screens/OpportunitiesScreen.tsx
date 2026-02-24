// Dynamic dashboard with API integration and animations
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateRangePicker from '../components/DateRangePicker';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Opportunity } from '../types';
import { opportunitiesApi } from '../utils/api';

const { width, height } = Dimensions.get('window');

export default function OpportunitiesScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLimit, setShowLimit] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(true); // Set to true for testing

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Remove tab animation since we're not using tabs anymore

  const fetchOpportunities = async () => {
    try {
      console.log('Appointments: Fetching appointments data...');
      console.log('Appointments: Authentication state:', { isAuthenticated });

      if (!isAuthenticated) {
        console.log('Appointments: User not authenticated, skipping API call');
        setLoading(false);
        return;
      }

      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const token = storage?.getItem('token');
      console.log('Appointments: Token available:', token ? 'yes' : 'no');

      // Force clear cache before fetching
      opportunitiesApi.clearCache();
      console.log('Appointments: Cleared cache, fetching fresh data...');

      // Use the new unified endpoint that checks tags and contact notes
      console.log('Appointments: Making API call to /opportunities/with-appointments-unified');
      const response = await opportunitiesApi.getOpportunitiesWithAppointmentsUnified();
      console.log('Appointments: API response received:', response);
      console.log('Appointments: API response success:', response.success);
      console.log('Appointments: API response data:', response.data);
      console.log('Appointments: API response error:', response.error);

      if (response.success && response.data) {
        // The unified endpoint returns only opportunities with appointments
        const allOpportunities = response.data.opportunities || [];

        console.log('Appointments: Processed appointments:', {
          totalCount: allOpportunities.length,
          withAppointments: allOpportunities.filter(opp => opp.hasAppointment).length,
        });
        
        // Debug: Log opportunities with appointments
        console.log('🔧 Opportunities with appointments (raw from API):', allOpportunities.length);
        
        // Log sample opportunities to debug date format
        if (allOpportunities.length > 0) {
          const sampleWithDate = allOpportunities.find(opp => opp.appointmentDetails?.date);
          if (sampleWithDate) {
            console.log('🔧 Sample opportunity with date:', {
              name: sampleWithDate.name,
              hasAppointment: sampleWithDate.hasAppointment,
              date: sampleWithDate.appointmentDetails?.date,
              dateType: typeof sampleWithDate.appointmentDetails?.date,
            });
          }
        }

        // Don't filter here - let the useMemo handle filtering
        // This allows the date filter to work properly
        setOpportunities(allOpportunities);
        console.log('Appointments: Loaded all opportunities:', allOpportunities.length);
      } else {
        console.error('Appointments: API failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to load appointments');

        if (response.error === 'Authentication failed') {
          Alert.alert('Session Expired', 'Please login again.');
          // Handle logout if needed
        }
      }
    } catch (error) {
      console.error('Appointments: Fetch error:', error);
      Alert.alert('Error', 'Failed to load appointments data');
      if (error instanceof Error && error.message.includes('Authentication')) {
        Alert.alert('Session Expired', 'Please login again.');
        // Handle logout if needed
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    opportunitiesApi.clearCache();
    await fetchOpportunities();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOpportunities();
  }, [isAuthenticated]);

  // Helper function to normalize a date to local date (ignoring time and timezone)
  // This ensures we compare dates correctly regardless of timezone
  const normalizeToLocalDate = (date: Date): Date => {
    // Get the local date components (year, month, day) from the date object
    // This handles timezone correctly by using local methods
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create a new date using local date components (this ensures no timezone issues)
    const normalized = new Date(year, month, day);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };
  
  // Helper function to parse and normalize a date string from the API
  const parseAndNormalizeDate = (dateString: string): Date | null => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return normalizeToLocalDate(date);
    } catch (error) {
      console.error('Error parsing date string:', dateString, error);
      return null;
    }
  };

  // Filter opportunities to only show today's appointments (not tomorrow or future)
  const filterByCurrentDateOnwards = (opportunities: Opportunity[]) => {
    const today = new Date();
    // Normalize today to local date (ignoring time)
    const todayNormalized = normalizeToLocalDate(today);
    
    // Get today's date components for comparison
    const todayYear = todayNormalized.getFullYear();
    const todayMonth = todayNormalized.getMonth();
    const todayDay = todayNormalized.getDate();
    
    console.log('🔧 Filtering by current date only. Today:', todayNormalized.toISOString(), `(${todayYear}-${todayMonth + 1}-${todayDay})`);
    console.log('🔧 Opportunities before date filter:', opportunities.length);
    
    const filtered = opportunities.filter(opp => {
      // Only include opportunities that have appointments
      if (!opp.hasAppointment) {
        console.log('🔧 Filtering out - no hasAppointment flag:', opp.name);
        return false;
      }
      
      if (!opp.appointmentDetails?.date) {
        console.log('🔧 Filtering out - no appointment date:', opp.name);
        return false;
      }
      
      try {
        // Parse and normalize the appointment date
        const appointmentDateNormalized = parseAndNormalizeDate(opp.appointmentDetails.date);
        
        if (!appointmentDateNormalized) {
          console.log('🔧 Filtering out - invalid date:', opp.name, opp.appointmentDetails.date);
          return false;
        }
        
        // Get appointment date components for comparison
        const apptYear = appointmentDateNormalized.getFullYear();
        const apptMonth = appointmentDateNormalized.getMonth();
        const apptDay = appointmentDateNormalized.getDate();
        
        // Compare dates using year, month, day components
        // Only show appointments for TODAY (not tomorrow or future)
        const isToday = apptYear === todayYear && 
                       apptMonth === todayMonth && 
                       apptDay === todayDay;
        
        if (!isToday) {
          console.log('🔧 Filtering out - not today:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`, 'vs today:', `(${todayYear}-${todayMonth + 1}-${todayDay})`);
        } else {
          console.log('🔧 Including - today date:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`);
        }
        
        return isToday;
      } catch (error) {
        console.error('🔧 Error parsing date for opportunity:', opp.name, opp.appointmentDetails.date, error);
        return false;
      }
    });
    
    console.log('🔧 Opportunities after date filter:', filtered.length);
    return filtered;
  };

  // Filter opportunities by appointment date range
  const filterOpportunitiesByDate = (opportunities: Opportunity[]) => {
    // If no date filter is applied, return all opportunities
    if (!startDate && !endDate) {
      return opportunities;
    }
    
    console.log('🔧 Applying date range filter. StartDate:', startDate, 'EndDate:', endDate);
    console.log('🔧 Opportunities before date range filter:', opportunities.length);
    
    // Normalize filter dates
    const filterStartNormalized = startDate ? normalizeToLocalDate(startDate) : null;
    const filterEndNormalized = endDate ? normalizeToLocalDate(endDate) : null;
    
    // When date filter is applied, only show opportunities with appointments within the range
    const filtered = opportunities.filter(opp => {
      // Only include opportunities that have appointments
      if (!opp.hasAppointment || !opp.appointmentDetails?.date) {
        return false;
      }
      
      try {
        // Parse and normalize the appointment date
        const appointmentDateNormalized = parseAndNormalizeDate(opp.appointmentDetails.date);
        
        if (!appointmentDateNormalized) {
          console.log('🔧 Date range filter - invalid date:', opp.name, opp.appointmentDetails.date);
          return false;
        }
        
        // Get date components for comparison
        const apptYear = appointmentDateNormalized.getFullYear();
        const apptMonth = appointmentDateNormalized.getMonth();
        const apptDay = appointmentDateNormalized.getDate();
        
        if (filterStartNormalized && filterEndNormalized) {
          // Both start and end dates are set - check if appointment is in range
          const startYear = filterStartNormalized.getFullYear();
          const startMonth = filterStartNormalized.getMonth();
          const startDay = filterStartNormalized.getDate();
          
          const endYear = filterEndNormalized.getFullYear();
          const endMonth = filterEndNormalized.getMonth();
          const endDay = filterEndNormalized.getDate();
          
          // Compare dates using year, month, day components
          let inRange = false;
          
          // Check if appointment is after or equal to start date
          let afterOrEqualStart = false;
          if (apptYear > startYear) {
            afterOrEqualStart = true;
          } else if (apptYear === startYear) {
            if (apptMonth > startMonth) {
              afterOrEqualStart = true;
            } else if (apptMonth === startMonth) {
              afterOrEqualStart = apptDay >= startDay;
            }
          }
          
          // Check if appointment is before or equal to end date
          let beforeOrEqualEnd = false;
          if (apptYear < endYear) {
            beforeOrEqualEnd = true;
          } else if (apptYear === endYear) {
            if (apptMonth < endMonth) {
              beforeOrEqualEnd = true;
            } else if (apptMonth === endMonth) {
              beforeOrEqualEnd = apptDay <= endDay;
            }
          }
          
          inRange = afterOrEqualStart && beforeOrEqualEnd;
          
          if (!inRange) {
            console.log('🔧 Date range filter - out of range:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`, 'not between', `(${startYear}-${startMonth + 1}-${startDay})`, 'and', `(${endYear}-${endMonth + 1}-${endDay})`);
          } else {
            console.log('🔧 Date range filter - in range:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`, 'between', `(${startYear}-${startMonth + 1}-${startDay})`, 'and', `(${endYear}-${endMonth + 1}-${endDay})`);
          }
          return inRange;
        } else if (filterStartNormalized) {
          // Only start date is set - check if appointment is on or after start date
          const startYear = filterStartNormalized.getFullYear();
          const startMonth = filterStartNormalized.getMonth();
          const startDay = filterStartNormalized.getDate();
          
          let inRange = false;
          if (apptYear > startYear) {
            inRange = true;
          } else if (apptYear === startYear) {
            if (apptMonth > startMonth) {
              inRange = true;
            } else if (apptMonth === startMonth) {
              inRange = apptDay >= startDay;
            }
          }
          
          if (!inRange) {
            console.log('🔧 Date range filter - before start date:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`, '<', `(${startYear}-${startMonth + 1}-${startDay})`);
          }
          return inRange;
        } else if (filterEndNormalized) {
          // Only end date is set - check if appointment is on or before end date
          const endYear = filterEndNormalized.getFullYear();
          const endMonth = filterEndNormalized.getMonth();
          const endDay = filterEndNormalized.getDate();
          
          let inRange = false;
          if (apptYear < endYear) {
            inRange = true;
          } else if (apptYear === endYear) {
            if (apptMonth < endMonth) {
              inRange = true;
            } else if (apptMonth === endMonth) {
              inRange = apptDay <= endDay;
            }
          }
          
          if (!inRange) {
            console.log('🔧 Date range filter - after end date:', opp.name, `(${apptYear}-${apptMonth + 1}-${apptDay})`, '>', `(${endYear}-${endMonth + 1}-${endDay})`);
          }
          return inRange;
        }
        
        return true;
      } catch (error) {
        console.error('🔧 Error in date range filter for opportunity:', opp.name, error);
        return false;
      }
    });
    
    console.log('🔧 Opportunities after date range filter:', filtered.length);
    return filtered;
  };

  // Filter opportunities based on search and date
  const filteredOpportunities = useMemo(() => {
    console.log('🔧 Filtering opportunities. Total:', opportunities.length);
    let filtered = opportunities;
    
    // Apply search filter first
    if (searchQuery) {
      const beforeSearch = filtered.length;
      filtered = filtered.filter(opp =>
        opp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opp.stageName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('🔧 After search filter:', filtered.length, '(was:', beforeSearch, ')');
    }
    
    // Apply date range filtering (if user has selected a date range)
    // When date range is active, allow past appointments if range includes them
    if (startDate || endDate) {
      const beforeDateRange = filtered.length;
      filtered = filterOpportunitiesByDate(filtered);
      console.log('🔧 After date range filter:', filtered.length, '(was:', beforeDateRange, ')');
    } else {
      // Only filter to today when NO date range is set (default behavior)
      // This allows users to see past/future appointments when they set a date range
      filtered = filterByCurrentDateOnwards(filtered);
      console.log('🔧 Applied default "today only" filter (no date range set)');
    }
    
    // Sort by appointment date (earliest first)
    filtered.sort((a, b) => {
      try {
        const dateA = a.appointmentDetails?.date ? new Date(a.appointmentDetails.date) : null;
        const dateB = b.appointmentDetails?.date ? new Date(b.appointmentDetails.date) : null;
        
        // If both have dates, compare them
        if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateA.getTime() - dateB.getTime(); // Earlier dates come first
        }
        
        // If only one has a date, prioritize the one with date
        if (dateA && !isNaN(dateA.getTime()) && (!dateB || isNaN(dateB.getTime()))) return -1;
        if (dateB && !isNaN(dateB.getTime()) && (!dateA || isNaN(dateA.getTime()))) return 1;
        
        // If neither has a date, maintain original order
        return 0;
      } catch (error) {
        console.error('🔧 Error sorting opportunities:', error);
        return 0;
      }
    });
    
    console.log('🔧 Final filtered opportunities:', filtered.length);
    return filtered;
  }, [searchQuery, opportunities, startDate, endDate]);

  // Remove tab change handler since we're not using tabs anymore

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleDateRangeChange = (newStartDate: Date | null, newEndDate: Date | null) => {
    console.log('🔧 Date range changed:', { newStartDate, newEndDate });
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate(null);
    setEndDate(null);
  };

  const formatAppointmentDate = (dateString: string) => {
    try {
      // Handle the new format from backend (YYYY-MM-DDTHH:mm:ss)
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if can't parse
      }
      
      // Format as "Wednesday, September 10, 2025 at 4:00 PM"
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting appointment date:', error);
      return dateString;
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  const getOpportunityOwnerLabel = (opp: Opportunity): { primary: string; secondary?: string } | null => {
    // Only show on admin view
    if (!isAdmin) return null;

    const ownerName =
      opp.owner?.name ||
      opp.owner?.username ||
      opp.assignedToName ||
      opp.assignedTo ||
      null;

    if (!ownerName) return { primary: 'Unassigned' };

    const role = opp.owner?.role || undefined;
    return {
      primary: ownerName,
      secondary: role,
    };
  };

  const getOpportunityOwnerGroupKey = (opp: Opportunity): string => {
    // Prefer stable identifiers when available
    const key =
      opp.owner?.id ||
      opp.owner?.ghlUserId ||
      opp.assignedTo ||
      opp.owner?.email ||
      opp.assignedToName ||
      'unassigned';
    return String(key);
  };

  const renderOpportunityCard = (opp: Opportunity, index: number) => (
    <Animated.View
      key={opp.id}
      style={[
        styles.opportunityCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.cardContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        onPress={() => navigation.navigate('OpportunityDetails', { opportunityId: opp.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.opportunityName, { color: theme.primaryText }]} numberOfLines={2}>
                {opp.name || 'Unnamed Opportunity'}
              </Text>
              <View style={styles.stageContainer}>
                <View style={[styles.stageDot, { backgroundColor: theme.primaryButton }]} />
                <Text style={[styles.stageText, { color: theme.secondaryText }]}>
                  {opp.stageName || 'New'}
                </Text>
              </View>

              {/* OWNER INFO (ADMIN ONLY) */}
              {!isAdmin
                ? null
                : (() => {
                    const owner = getOpportunityOwnerLabel(opp);
                    if (!owner) return null;
                    return (
                      <View style={[styles.ownerRow, { backgroundColor: theme.primaryButton + '10', borderColor: theme.cardBorder }]}>
                        <Feather name="user" size={14} color={theme.primaryButton} />
                        <Text style={[styles.ownerText, { color: theme.secondaryText }]} numberOfLines={1}>
                          Owner: <Text style={[styles.ownerTextStrong, { color: theme.primaryText }]}>{owner.primary}</Text>
                          {owner.secondary ? (
                            <Text style={[styles.ownerTextMuted, { color: theme.secondaryText }]}> ({owner.secondary})</Text>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })()}
            </View>
          </View>
          
          {/* APPOINTMENT INDICATORS */}
          <View style={styles.appointmentContainer}>
            {opp.hasAppointment ? (
              <View style={[styles.appointmentBadge, styles.hasAppointmentBadge]}>
                <MaterialIcons name="event-available" size={18} color="#fff" />
                <Text style={styles.appointmentText}>Has Appointment</Text>
              </View>
            ) : (
              <View style={[styles.appointmentBadge, styles.noAppointmentBadge]}>
                <MaterialIcons name="event-busy" size={18} color="#fff" />
                <Text style={styles.appointmentText}>No Appointment</Text>
              </View>
            )}
            
            {opp.classification && (
              <View style={[styles.classificationBadge,
                opp.classification === 'CONFIRMED' ? styles.confirmedBadge :
                opp.classification === 'MULTIPLE' ? styles.multipleBadge :
                opp.classification === 'NO_APPOINTMENT' ? styles.noAppointmentBadge :
                styles.errorBadge
              ]}>
                <Text style={styles.classificationText}>
                  {opp.classification === 'CONFIRMED' ? '✅ Confirmed' :
                   opp.classification === 'MULTIPLE' ? '❓ Multiple' :
                   opp.classification === 'NO_APPOINTMENT' ? '❌ No Appt' :
                   '⚠️ Error'}
                </Text>
              </View>
            )}
          </View>

          {/* APPOINTMENT TIME DISPLAY */}
          {opp.hasAppointment && opp.appointmentDetails && (
            <View style={styles.appointmentTimeContainer}>
              <View style={styles.appointmentTimeRow}>
                <Feather name="clock" size={16} color={theme.secondaryText} />
                <Text style={[styles.appointmentTimeLabel, { color: theme.secondaryText }]}>
                  Appointment Time:
                </Text>
              </View>
              <Text style={[styles.appointmentTimeText, { color: theme.primaryText }]}>
                {opp.appointmentDetails.date ? 
                  formatAppointmentDate(opp.appointmentDetails.date) : 
                  opp.appointmentDetails.rawText || 'Details in CRM'
                }
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderOpportunitiesList = () => (
    <View style={styles.opportunitiesList}>
      {filteredOpportunities.length > 0 ? (
        isAdmin ? (
          // Admin view: group appointments by owner so multiple appointments per owner are shown together
          (() => {
            const groups = new Map<
              string,
              { owner: { primary: string; secondary?: string } | null; items: Opportunity[] }
            >();

            filteredOpportunities.forEach((opp) => {
              const key = getOpportunityOwnerGroupKey(opp);
              const existing = groups.get(key);
              if (existing) {
                existing.items.push(opp);
              } else {
                groups.set(key, { owner: getOpportunityOwnerLabel(opp), items: [opp] });
              }
            });

            const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
              const aName = a[1].owner?.primary || 'Unassigned';
              const bName = b[1].owner?.primary || 'Unassigned';
              return aName.localeCompare(bName);
            });

            return (
              <View style={styles.groupedContainer}>
                {sortedGroups.map(([key, group]) => (
                  <View key={key} style={styles.ownerGroup}>
                    <View
                      style={[
                        styles.ownerGroupHeader,
                        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                      ]}
                    >
                      <View style={styles.ownerGroupHeaderLeft}>
                        <Feather name="user" size={16} color={theme.primaryButton} />
                        <Text style={[styles.ownerGroupTitle, { color: theme.primaryText }]} numberOfLines={1}>
                          {group.owner?.primary || 'Unassigned'}
                        </Text>
                        {group.owner?.secondary ? (
                          <Text style={[styles.ownerGroupSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>
                            ({group.owner.secondary})
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.ownerGroupCountPill, { backgroundColor: theme.primaryButton + '20' }]}>
                        <Text style={[styles.ownerGroupCountText, { color: theme.primaryText }]}>
                          {group.items.length}
                        </Text>
                      </View>
                    </View>

                    {group.items.map((opp, index) => renderOpportunityCard(opp, index))}
                  </View>
                ))}
              </View>
            );
          })()
        ) : (
          filteredOpportunities.map((opp, index) => renderOpportunityCard(opp, index))
        )
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryButton + '15' }]}>
            <Feather name="inbox" size={48} color={theme.primaryButton} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>No appointments found</Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
            {searchQuery || startDate || endDate ? 'Try adjusting your search criteria' : 'No appointments found'}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading Appointments...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header - Same as Dashboard */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.secondaryText }]}>
              {isAuthenticated ? `Welcome, ${user?.name || 'User'}` : 'Welcome'}
            </Text>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Appointments</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} onPress={onRefresh}>
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} onPress={toggleTheme}>
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
        {/* Search Section */}
        <View style={styles.searchSection}>
          <SearchBar
            placeholder="Search appointments..."
            onSearch={handleSearch}
            onClear={handleClearSearch}
          />
        </View>

        {/* Date Range Filter Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleContainer}>
              <Feather name="calendar" size={20} color={theme.secondaryText} />
              <Text style={[styles.filterTitle, { color: theme.primaryText }]}>Appointment Date Filter</Text>
            </View>
            <TouchableOpacity
              style={[styles.filterToggleButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                console.log('🔧 Toggling date picker, current state:', showDatePicker);
                setShowDatePicker(!showDatePicker);
              }}
            >
              <Feather 
                name={showDatePicker ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
          
          {showDatePicker && (
            <View style={styles.datePickerContainer}>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={handleDateRangeChange}
                placeholder="Filter by appointment date"
              />
            </View>
          )}
          {!showDatePicker && (
            <Text style={[styles.filterHint, { color: theme.secondaryText }]}>
              Tap to expand and filter opportunities by appointment date
            </Text>
          )}
          
          {/* Active Filters Display */}
          {(searchQuery || startDate || endDate) && (
            <View style={styles.activeFiltersContainer}>
              <Text style={[styles.activeFiltersLabel, { color: theme.secondaryText }]}>Active Filters:</Text>
              <View style={styles.activeFiltersList}>
                {searchQuery && (
                  <View style={[styles.filterChip, { backgroundColor: theme.primaryButton + '15' }]}>
                    <Text style={[styles.filterChipText, { color: theme.primaryButton }]}>
                      Search: "{searchQuery}"
                    </Text>
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x" size={14} color={theme.primaryButton} />
                    </TouchableOpacity>
                  </View>
                )}
                {startDate && (
                  <View style={[styles.filterChip, { backgroundColor: theme.secondaryButton + '15' }]}>
                    <Text style={[styles.filterChipText, { color: theme.secondaryButton }]}>
                      From: {startDate.toLocaleDateString()}
                    </Text>
                    <TouchableOpacity onPress={() => setStartDate(null)}>
                      <Feather name="x" size={14} color={theme.secondaryButton} />
                    </TouchableOpacity>
                  </View>
                )}
                {endDate && (
                  <View style={[styles.filterChip, { backgroundColor: theme.secondaryButton + '15' }]}>
                    <Text style={[styles.filterChipText, { color: theme.secondaryButton }]}>
                      To: {endDate.toLocaleDateString()}
                    </Text>
                    <TouchableOpacity onPress={() => setEndDate(null)}>
                      <Feather name="x" size={14} color={theme.secondaryButton} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.clearAllButton, { backgroundColor: theme.dangerButton }]}
                onPress={handleClearFilters}
              >
                <Feather name="x" size={14} color="#ffffff" />
                <Text style={styles.clearAllButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Opportunities with Appointments Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerIconContainer}>
            <Feather name="calendar" size={24} color={theme.primaryButton} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.sectionHeaderTitle, { color: theme.primaryText }]}>
              Appointments
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              Showing appointments that have been booked
            </Text>
          </View>
        </View>

        {/* Results Summary */}
        <View style={styles.resultsSummary}>
          <Text style={[styles.resultsSummaryText, { color: theme.secondaryText }]}>
            Showing {filteredOpportunities.length} appointments
            {(searchQuery || startDate || endDate) && ' (filtered)'}
          </Text>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {renderOpportunitiesList()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
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
    paddingHorizontal: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  greeting: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  iconButton: {
    padding: 14,
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchSection: {
    marginTop: 24,
    marginBottom: 16,
    width: '100%',
  },
  filterSection: {
    marginBottom: 24,
    width: '100%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  activeFiltersContainer: {
    marginTop: 12,
  },
  activeFiltersLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  activeFiltersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    alignSelf: 'flex-start',
  },
  clearAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  resultsSummary: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  resultsSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  searchBar: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  contentSection: {
    marginBottom: 32,
    width: '100%',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  opportunitiesList: {
    width: '100%',
  },
  groupedContainer: {
    width: '100%',
  },
  ownerGroup: {
    marginBottom: 18,
  },
  ownerGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  ownerGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 12,
  },
  ownerGroupTitle: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  ownerGroupSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.85,
  },
  ownerGroupCountPill: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerGroupCountText: {
    fontSize: 12,
    fontWeight: '800',
  },
  opportunityCard: {
    marginBottom: 20,
    width: '100%',
  },
  cardContent: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 140,
    width: '100%',
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  opportunityName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 26,
  },
  stageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  ownerTextStrong: {
    fontWeight: '800',
  },
  ownerTextMuted: {
    fontWeight: '600',
    opacity: 0.85,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stageText: {
    fontSize: 16,
    fontWeight: '500',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  appointmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hasAppointmentBadge: {
    backgroundColor: '#B4F35B',
  },
  noAppointmentBadge: {
    backgroundColor: '#fbbf24',
  },
  appointmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  classificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confirmedBadge: {
    backgroundColor: '#B4F35B',
  },
  multipleBadge: {
    backgroundColor: '#fbbf24',
  },
  errorBadge: {
    backgroundColor: '#ef4444',
  },
  classificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  appointmentTimeContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
  },
  appointmentTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  appointmentTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appointmentTimeText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  appointmentSourceContainer: {
    marginTop: 4,
  },
  appointmentSourceText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    opacity: 0.8,
  },
}); 