import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
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
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, adminOpportunityDetailsApi } from '../utils/api';

const { width } = Dimensions.get('window');

const AdminUserOpportunitiesScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const userId = route.params?.userId;
  const userName = route.params?.userName || 'User';
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  useEffect(() => {
    if (userId) {
      loadOpportunities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      
      // Try the new endpoint first
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunitiesFull();
      
      // If 404, fallback to existing endpoint
      if (!response.success && response.error?.includes('404')) {
        console.log('⚠️ New endpoint not available, falling back to existing endpoint...');
        response = await adminAnalyticsApi.getUserOpportunities(userId);
        
        if (response.success) {
          const opportunitiesData = response.data?.data || response.data?.opportunities || response.data || [];
          const opportunitiesArray = Array.isArray(opportunitiesData) ? opportunitiesData : [];
          setOpportunities(opportunitiesArray);
          return;
        }
      }
      
      if (response.success) {
        const data = response.data?.data || response.data || [];
        const usersArray = Array.isArray(data) ? data : [];
        
        const foundUser = usersArray.find((item: any) => 
          item.user?.id === userId || 
          item.user?.userId === userId ||
          item.userId === userId
        );
        
        if (foundUser) {
          const opps = foundUser.opportunities || [];
          setOpportunities(opps);
        } else {
          Alert.alert('Error', 'User not found');
        }
      } else {
        console.error('❌ Failed to load opportunities:', response.error);
        if (!response.error?.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load opportunities');
        }
      }
    } catch (error) {
      console.error('❌ Error loading opportunities:', error);
      Alert.alert('Error', 'Failed to load opportunities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOpportunities();
    setRefreshing(false);
  };

  const handleOpportunityClick = (opportunity: any) => {
    const opportunityId = opportunity.ghlOpportunityId || opportunity.id || opportunity.opportunityId;
    if (opportunityId) {
      navigation.navigate('AdminOpportunityDetails', { opportunityId });
    } else {
      Alert.alert('Error', 'Opportunity ID not found');
    }
  };

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

  const renderOpportunityItem = (opportunity: any, index: number) => {
    if (!opportunity) return null;
    
    const opportunityId = opportunity.ghlOpportunityId || opportunity.id || opportunity.opportunityId || 'Unknown';
    
    // Get customer name - prioritize customerName from backend, then check other fields
    const customerName = opportunity.customerName || 
                        (opportunity.contactFirstName && opportunity.contactLastName 
                          ? `${opportunity.contactFirstName} ${opportunity.contactLastName}`.trim()
                          : null) ||
                        opportunity.contactFirstName ||
                        opportunity.contactLastName ||
                        opportunity.contactName || 
                        opportunity.name ||
                        'Unknown Customer';
    
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
            Loading opportunities...
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
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.primaryText }]}>{userName}'s Opportunities</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>View and manage opportunities</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryButton} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.dataSection}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              Opportunities ({opportunities.length})
            </Text>
            {opportunities.length > 0 ? (
              opportunities.map((opportunity: any, index: number) => renderOpportunityItem(opportunity, index))
            ) : (
              <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
                <Feather name="briefcase" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
                <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                  No opportunities found for this user.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  },
  headerText: {
    alignItems: 'center',
  },
  title: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
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
  dataSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
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
  dataItemSubtitle: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
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
});

export default AdminUserOpportunitiesScreen;


