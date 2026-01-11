import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { opportunitiesApi } from '../utils/api';

interface Opportunity {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  status?: string;
  pipelineStageId?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  hasAppointment?: boolean;
  appointmentDate?: string;
  appointmentTime?: string;
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  total: number;
  summary?: {
    total: number;
    withAppointments: number;
    withoutAppointments: number;
  };
}

export default function AllOpportunitiesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratioMetrics, setRatioMetrics] = useState<any>(null);

  const fetchOpportunities = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('🔍 Fetching all opportunities for user:', user?.name);
      
      // Use the pipelines endpoint to get all opportunities from the private customer pipeline
      // The private customer pipeline ID is: FxPA8fVU11VnudThxhFy
      const pipelineId = 'FxPA8fVU11VnudThxhFy';
      
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000);
      });
      
      const response = await Promise.race([
        opportunitiesApi.getOpportunitiesByPipeline(pipelineId),
        timeoutPromise
      ]) as any;
      
      if (response.success && response.data) {
        console.log('✅ Successfully fetched opportunities:', response.data);
        
        // Extract opportunities from the response
        let fetchedOpportunities: Opportunity[] = [];
        let ratioMetrics = null;
        
        if (response.data.data && response.data.data.opportunities) {
          fetchedOpportunities = response.data.data.opportunities;
          ratioMetrics = response.data.data.meta?.ratioMetrics;
        } else if (response.data.opportunities) {
          fetchedOpportunities = response.data.opportunities;
          ratioMetrics = response.data.meta?.ratioMetrics;
        } else if (Array.isArray(response.data)) {
          fetchedOpportunities = response.data;
        }
        
        setOpportunities(fetchedOpportunities);
        setRatioMetrics(ratioMetrics);
        console.log(`📊 Loaded ${fetchedOpportunities.length} opportunities`);
        if (ratioMetrics) {
          console.log(`📈 Performance Metrics: ${ratioMetrics.bookedCount} booked, ${ratioMetrics.wonCount} won, ${ratioMetrics.winRate}% win rate`);
        }
      } else {
        throw new Error(response.error || 'Failed to fetch opportunities');
      }
    } catch (err: any) {
      console.error('❌ Error fetching opportunities:', err);
      setError(err.message || 'Failed to load opportunities');
      Alert.alert('Error', err.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const onRefresh = () => {
    fetchOpportunities(true);
  };

  const handleOpportunityPress = (opportunity: Opportunity) => {
    console.log('🔍 Opportunity pressed:', opportunity.name);
    // Navigate to opportunity details or workflow
    navigation.navigate('OpportunityDetails', { opportunityId: opportunity.id });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return '#10b981';
      case 'lost':
        return '#ef4444';
      case 'active':
        return '#3b82f6';
      default:
        return theme.secondaryText;
    }
  };

  const renderOpportunityCard = (opportunity: Opportunity) => (
    <TouchableOpacity
      key={opportunity.id}
      style={[styles.opportunityCard, { 
        backgroundColor: theme.cardBackground, 
        borderColor: theme.cardBorder 
      }]}
      onPress={() => handleOpportunityPress(opportunity)}
    >
      <View style={styles.opportunityHeader}>
        <View style={styles.opportunityTitleContainer}>
          <Text style={[styles.opportunityName, { color: theme.primaryText }]} numberOfLines={2}>
            {opportunity.name || 'Unnamed Opportunity'}
          </Text>
          {opportunity.status && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(opportunity.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(opportunity.status) }]}>
                {opportunity.status}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
      </View>

      <View style={styles.opportunityDetails}>
        {opportunity.contactName && (
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color={theme.secondaryText} />
            <Text style={[styles.detailText, { color: theme.secondaryText }]}>
              {opportunity.contactName}
            </Text>
          </View>
        )}
        
        {opportunity.contactEmail && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={16} color={theme.secondaryText} />
            <Text style={[styles.detailText, { color: theme.secondaryText }]}>
              {opportunity.contactEmail}
            </Text>
          </View>
        )}
        
        {opportunity.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={theme.secondaryText} />
            <Text style={[styles.detailText, { color: theme.secondaryText }]} numberOfLines={1}>
              {opportunity.address}
            </Text>
          </View>
        )}

        {opportunity.hasAppointment && (
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#10b981" />
            <Text style={[styles.detailText, { color: '#10b981' }]}>
              Has Appointment
              {opportunity.appointmentDate && ` - ${formatDate(opportunity.appointmentDate)}`}
            </Text>
          </View>
        )}

        {opportunity.tags && opportunity.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {opportunity.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: theme.primaryButton + '20' }]}>
                <Text style={[styles.tagText, { color: theme.primaryButton }]}>
                  {tag}
                </Text>
              </View>
            ))}
            {opportunity.tags.length > 3 && (
              <Text style={[styles.moreTagsText, { color: theme.secondaryText }]}>
                +{opportunity.tags.length - 3} more
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>All My Opportunities</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading opportunities...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>All My Opportunities</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Private Customer Pipeline (My Opportunities)
          </Text>
          {ratioMetrics && (
            <View style={[styles.ratioContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.ratioTitle, { color: theme.primaryText }]}>Performance Metrics</Text>
              <View style={styles.ratioRow}>
                <Text style={[styles.ratioLabel, { color: theme.secondaryText }]}>Booked:</Text>
                <Text style={[styles.ratioValue, { color: theme.primaryText }]}>{ratioMetrics.bookedCount}</Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={[styles.ratioLabel, { color: theme.secondaryText }]}>Won:</Text>
                <Text style={[styles.ratioValue, { color: theme.primaryText }]}>{ratioMetrics.wonCount}</Text>
              </View>
              <View style={styles.ratioRow}>
                <Text style={[styles.ratioLabel, { color: theme.secondaryText }]}>Win Rate:</Text>
                <Text style={[styles.ratioValue, { color: '#10b981' }]}>{ratioMetrics.winRate}%</Text>
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
            color={refreshing ? theme.secondaryText : theme.primaryButton} 
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primaryButton}
            colors={[theme.primaryButton]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.summaryHeader}>
            <Ionicons name="list" size={24} color={theme.primaryButton} />
            <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
              Opportunities Summary
            </Text>
          </View>
          <Text style={[styles.summaryText, { color: theme.secondaryText }]}>
            Total: {opportunities.length} opportunities
          </Text>
          <Text style={[styles.summaryText, { color: theme.secondaryText }]}>
            With Appointments: {opportunities.filter(opp => opp.hasAppointment).length}
          </Text>
          <Text style={[styles.summaryText, { color: theme.secondaryText }]}>
            Without Appointments: {opportunities.filter(opp => !opp.hasAppointment).length}
          </Text>
        </View>

        {/* Error State */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Ionicons name="alert-circle" size={24} color="#dc2626" />
            <Text style={[styles.errorText, { color: '#dc2626' }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#dc2626' }]}
              onPress={() => fetchOpportunities()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Opportunities List */}
        {opportunities.length > 0 ? (
          <View style={styles.opportunitiesList}>
            {opportunities.map(renderOpportunityCard)}
          </View>
        ) : !error && (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={64} color={theme.secondaryText} />
            <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>
              No Opportunities Found
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.secondaryText }]}>
              You don't have any opportunities in the private customer pipeline yet.
            </Text>
            <TouchableOpacity
              style={[styles.refreshButtonLarge, { backgroundColor: theme.primaryButton }]}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  ratioContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  ratioTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratioLabel: {
    fontSize: 13,
  },
  ratioValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
  },
  errorCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  opportunitiesList: {
    padding: 16,
    paddingTop: 0,
  },
  opportunityCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  opportunityTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  opportunityName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  opportunityDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
