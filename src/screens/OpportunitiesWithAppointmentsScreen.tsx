import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { opportunitiesApi } from '../utils/api';
import SearchBar from '../components/SearchBar';
import { LinearGradient } from 'expo-linear-gradient';

interface AppointmentDetails {
  id: string;
  title: string;
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  notes: string;
  assignedTo: string;
  type: string;
  allAppointments: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    startTime: string;
    endTime: string;
    location: string;
    status: string;
    type: string;
  }>;
}

interface OpportunityWithAppointments {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage?: string;
  assignedTo?: string;
  hasAppointment: boolean;
  appointmentCount: number;
  appointmentDetails: AppointmentDetails | null;
  classification?: 'CONFIRMED' | 'MULTIPLE' | 'NO_APPOINTMENT';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  reason?: string;
  mockAppointmentData?: {
    hasAppointment: boolean;
    appointmentCount: number;
    appointmentDetails: AppointmentDetails | null;
  };
}

interface OpportunitiesWithAppointmentsResponse {
  opportunities: OpportunityWithAppointments[];
  total: number;
  classification: {
    confirmedWithAppointments: number;
    taggedButNoAppointment: number;
    multipleAppointments: number;
    noAppointments: number;
  };
  user: {
    id: string;
    name: string;
    role: string;
  };
}

type TabType = 'with-appointments' | 'without-appointments' | 'all';

export default function OpportunitiesWithAppointmentsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const [opportunities, setOpportunities] = useState<OpportunityWithAppointments[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('with-appointments');

  const fetchOpportunities = async () => {
    try {
      console.log('Opportunities with Appointments: Fetching opportunities data...');

      if (!isAuthenticated) {
        console.log('Opportunities with Appointments: User not authenticated, skipping API call');
        setLoading(false);
        return;
      }

      // Force clear cache before fetching
      opportunitiesApi.clearCache();
      console.log('Opportunities with Appointments: Cleared cache, fetching fresh data...');

      // Use the hybrid method which is much faster (uses dashboard data + appointments)
      const response = await opportunitiesApi.getOpportunitiesWithAppointmentsHybrid();
      console.log('Opportunities with Appointments: API response received:', response);

      if (response.success && response.data) {
        const opportunitiesData = response.data as OpportunitiesWithAppointmentsResponse;
        const opps = opportunitiesData.opportunities || [];

        console.log('Opportunities with Appointments: Processed opportunities:', {
          totalCount: opps.length,
          confirmedWithAppointments: opportunitiesData.classification?.confirmedWithAppointments || 0,
          multipleAppointments: opportunitiesData.classification?.multipleAppointments || 0,
          noAppointments: opportunitiesData.classification?.noAppointments || 0,
          withAppointments: opps.filter(opp => opp.hasAppointment).length,
          withoutAppointments: opps.filter(opp => !opp.hasAppointment).length
        });

        // Debug: Log first few opportunities with their classification
        opps.slice(0, 5).forEach((opp, index) => {
          console.log(`Opportunity ${index + 1}: "${opp.name}" - Classification: ${opp.classification}, Confidence: ${opp.confidence}, hasAppointment: ${opp.hasAppointment}`);
        });

        setOpportunities(opps);
        console.log('Opportunities with Appointments: Loaded opportunities:', opps.length);
      } else {
        console.error('Opportunities with Appointments: API failed:', response.error);
        Alert.alert('Error', response.error || 'Failed to load opportunities with appointments');
      }
    } catch (error) {
      console.error('Opportunities with Appointments: Fetch error:', error);
      Alert.alert('Error', 'Failed to load opportunities data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOpportunities();
    setRefreshing(false);
  };

  const getFilteredOpportunities = () => {
    let filtered = opportunities;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(opp => 
        opp.name?.toLowerCase().includes(query) ||
        opp.contactName?.toLowerCase().includes(query) ||
        opp.contactEmail?.toLowerCase().includes(query) ||
        opp.contactPhone?.toLowerCase().includes(query) ||
        opp.stage?.toLowerCase().includes(query) ||
        opp.appointmentDetails?.title?.toLowerCase().includes(query) ||
        opp.appointmentDetails?.location?.toLowerCase().includes(query)
      );
    }

    // Apply tab filter - ACCURATE CLASSIFICATION
    switch (activeTab) {
      case 'with-appointments':
        // Show opportunities that HAVE valid appointments (CONFIRMED or MULTIPLE)
        filtered = filtered.filter(opp => 
          opp.hasAppointment === true && 
          opp.appointmentDetails !== null &&
          (opp.classification === 'CONFIRMED' || opp.classification === 'MULTIPLE')
        );
        break;
      case 'without-appointments':
        // Show opportunities that DON'T have valid appointments (NO_APPOINTMENT)
        filtered = filtered.filter(opp => 
          opp.hasAppointment === false || 
          opp.appointmentDetails === null ||
          opp.classification === 'NO_APPOINTMENT'
        );
        break;
      case 'all':
      default:
        // Show all opportunities
        break;
    }

    return filtered;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const formatDateTime = (date: string, time?: string, startTime?: string, endTime?: string) => {
    try {
      if (startTime) {
        const startDate = new Date(startTime);
        const endDate = endTime ? new Date(endTime) : null;
        
        const dateStr = startDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        
        const timeStr = startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        if (endDate) {
          const endTimeStr = endDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          return `${dateStr} • ${timeStr} - ${endTimeStr}`;
        }
        
        return `${dateStr} • ${timeStr}`;
      }
      
      if (date && time) {
        return `${date} • ${time}`;
      }
      
      // If we have appointment details but no startTime, try to parse the date field
      if (date) {
        try {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      return 'Date/time not available';
    } catch (error) {
      return 'Invalid date/time';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('confirmed') || statusLower.includes('booked')) {
      return '#4CAF50';
    } else if (statusLower.includes('pending') || statusLower.includes('scheduled')) {
      return '#FF9800';
    } else if (statusLower.includes('cancelled')) {
      return '#F44336';
    } else {
      return '#9E9E9E';
    }
  };

  const renderOpportunityCard = (opp: OpportunityWithAppointments) => (
    <TouchableOpacity
      key={opp.id}
      style={styles.opportunityCard}
      onPress={() => navigation.navigate('OpportunityDetails', { opportunityId: opp.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.opportunityInfo}>
          <Text style={styles.opportunityName}>{opp.name}</Text>
          {opp.contactName && (
            <Text style={styles.contactName}>Contact: {opp.contactName}</Text>
          )}
          {opp.stage && (
            <Text style={styles.stage}>Stage: {opp.stage}</Text>
          )}
          
          {/* ACCURATE CLASSIFICATION DISPLAY */}
          <View style={styles.classificationContainer}>
            {opp.classification && (
              <View style={[styles.classificationBadge, 
                opp.classification === 'CONFIRMED' ? styles.confirmedBadge :
                opp.classification === 'MULTIPLE' ? styles.multipleBadge :
                styles.noAppointmentBadge
              ]}>
                <Text style={styles.classificationText}>
                  {opp.classification === 'CONFIRMED' ? '✅ Confirmed' :
                   opp.classification === 'MULTIPLE' ? '❓ Multiple' :
                   '❌ No Appointment'}
                </Text>
              </View>
            )}
            
            {opp.confidence && (
              <View style={[styles.confidenceBadge,
                opp.confidence === 'HIGH' ? styles.highConfidence :
                opp.confidence === 'MEDIUM' ? styles.mediumConfidence :
                styles.lowConfidence
              ]}>
                <Text style={styles.confidenceText}>
                  {opp.confidence} Confidence
                </Text>
              </View>
            )}
          </View>

          {opp.reason && (
            <Text style={styles.reasonText}>Reason: {opp.reason}</Text>
          )}
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.stageBadge, { backgroundColor: '#007AFF' }]}>
            <Text style={styles.stageText}>{opp.stage || 'Unknown Stage'}</Text>
          </View>
          {opp.hasAppointment && (
            <View style={styles.appointmentBadge}>
              <MaterialIcons name="event" size={12} color="#fff" />
              <Text style={styles.appointmentBadgeText}>
                {opp.appointmentCount || 1} appointment{(opp.appointmentCount || 1) > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {opp.hasAppointment && opp.appointmentDetails && (
        <View style={styles.appointmentSection}>
          <View style={styles.appointmentHeader}>
            <MaterialIcons name="event" size={16} color="#007AFF" />
            <Text style={styles.appointmentTitle}>
              {opp.appointmentDetails?.title || 'Appointment'}
            </Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(opp.appointmentDetails?.status || '') }
            ]} />
          </View>
          <View style={styles.appointmentDetails}>
            <View style={styles.appointmentRow}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.appointmentText}>
                {formatDateTime(
                  opp.appointmentDetails?.date || '',
                  opp.appointmentDetails?.time || '',
                  opp.appointmentDetails?.startTime,
                  opp.appointmentDetails?.endTime
                )}
              </Text>
            </View>
            {opp.appointmentDetails?.location && (
              <View style={styles.appointmentRow}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.appointmentText}>
                  {opp.appointmentDetails.location}
                </Text>
              </View>
            )}
            {opp.appointmentDetails?.notes && (
              <View style={styles.appointmentRow}>
                <Ionicons name="document-text-outline" size={14} color="#666" />
                <Text style={styles.appointmentText} numberOfLines={2}>
                  {opp.appointmentDetails.notes}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {(!opp.hasAppointment || !opp.appointmentDetails) && (
        <View style={styles.noAppointmentSection}>
          <Ionicons name="calendar-outline" size={20} color="#999" />
          <Text style={styles.noAppointmentText}>No appointments booked</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderStats = () => {
    const total = opportunities.length;
    const withAppointments = opportunities.filter(opp => 
      opp.hasAppointment === true && opp.appointmentDetails !== null
    ).length;
    const withoutAppointments = total - withAppointments;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{withAppointments}</Text>
          <Text style={styles.statLabel}>With Appointments</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{withoutAppointments}</Text>
          <Text style={styles.statLabel}>No Appointments</Text>
        </View>
      </View>
    );
  };

  const renderTabs = () => {
    const withAppointments = opportunities.filter(opp => 
      opp.hasAppointment === true && opp.appointmentDetails !== null
    ).length;
    
    const withoutAppointments = opportunities.filter(opp => 
      opp.hasAppointment === false || opp.appointmentDetails === null
    ).length;

    return (
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'with-appointments' && styles.activeTab]}
          onPress={() => setActiveTab('with-appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'with-appointments' && styles.activeTabText]}>
            With Appointments ({withAppointments})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'without-appointments' && styles.activeTab]}
          onPress={() => setActiveTab('without-appointments')}
        >
          <Text style={[styles.tabText, activeTab === 'without-appointments' && styles.activeTabText]}>
            No Appointments ({withoutAppointments})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({opportunities.length})
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading opportunities with appointments...</Text>
      </View>
    );
  }

  const filteredOpportunities = getFilteredOpportunities();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#007AFF', '#0056CC']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Opportunities & Appointments</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <SearchBar
          placeholder="Search opportunities, contacts, or appointments..."
          onSearch={handleSearch}
          onClear={handleClearSearch}
          value={searchQuery}
        />

        {renderStats()}
        {renderTabs()}

        <ScrollView
          style={[
            styles.scrollView,
            Platform.OS === 'web' && {
              height: '100%',
              maxHeight: '100%',
            }
          ]}
          contentContainerStyle={[
            styles.scrollViewContent,
            Platform.OS === 'web' && {
              minHeight: '100vh' as any, // Ensure content is taller than viewport
              paddingBottom: 100, // Extra padding for web
            }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          bounces={Platform.OS !== 'web'}
          alwaysBounceVertical={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS !== 'web'}
        >
          {filteredOpportunities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#999" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'with-appointments' ? 'No Appointments Found' :
                 activeTab === 'without-appointments' ? 'No Opportunities Without Appointments' :
                 'No Opportunities Found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try adjusting your search terms' : 
                 activeTab === 'with-appointments' ? 'No opportunities with appointments at the moment' :
                 activeTab === 'without-appointments' ? 'All opportunities have appointments booked' :
                 'No opportunities available at the moment'}
              </Text>
            </View>
          ) : (
            <View style={styles.opportunitiesList}>
              {filteredOpportunities.map(renderOpportunityCard)}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
    height: Platform.OS === 'web' ? '100vh' : undefined,
    overflow: Platform.OS === 'web' ? 'hidden' : undefined,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: Platform.OS === 'web' ? 0 : undefined,
    zIndex: Platform.OS === 'web' ? 1000 : undefined,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : undefined,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    height: Platform.OS === 'web' ? 'calc(100vh - 120px)' : undefined,
    overflow: Platform.OS === 'web' ? 'hidden' : undefined,
  },
  scrollView: {
    flex: 1,
    height: Platform.OS === 'web' ? 'calc(100vh - 200px)' : undefined,
    overflow: Platform.OS === 'web' ? 'auto' : undefined,
  },
  scrollViewContent: {
    paddingBottom: 20,
    flexGrow: 1,
    minHeight: Platform.OS === 'web' ? 'auto' : undefined,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 10,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  opportunitiesList: {
    paddingBottom: 20,
    minHeight: Platform.OS === 'web' ? 'auto' : undefined,
  },
  opportunityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  opportunityInfo: {
    flex: 1,
    marginRight: 12,
  },
  opportunityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  stage: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  classificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  classificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confirmedBadge: {
    backgroundColor: '#4CAF50',
  },
  multipleBadge: {
    backgroundColor: '#FF9800',
  },
  noAppointmentBadge: {
    backgroundColor: '#F44336',
  },
  classificationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highConfidence: {
    backgroundColor: '#4CAF50',
  },
  mediumConfidence: {
    backgroundColor: '#FF9800',
  },
  lowConfidence: {
    backgroundColor: '#F44336',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  reasonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  stageText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  appointmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  appointmentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  appointmentSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  appointmentDetails: {
    gap: 6,
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  appointmentText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  noAppointmentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  noAppointmentText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: Platform.OS === 'web' ? 'calc(100vh - 400px)' : undefined,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
}); 