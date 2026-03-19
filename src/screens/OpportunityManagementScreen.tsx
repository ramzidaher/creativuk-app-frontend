import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, adminOpportunityDetailsApi, opportunitiesApi } from '../utils/api';
import { formatScheduledAtDisplay } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

const OpportunityManagementScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});

  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await opportunitiesApi.getManualOpportunities();
      if (response.success && response.data) {
        const list = response.data.opportunities ?? [];
        setOpportunities(Array.isArray(list) ? list : []);
        setTotal(response.data.total ?? list.length);
      } else {
        setOpportunities([]);
        setTotal(0);
        if (response.error && !response.error.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load opportunities');
        }
      }
    } catch (error) {
      console.error('Error loading manual opportunities:', error);
      setOpportunities([]);
      setTotal(0);
      Alert.alert('Error', 'Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsersForMap = useCallback(async () => {
    if (!isAdmin) return;
    try {
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunities();
      if (!response.success && response.error?.includes('404')) {
        response = await adminAnalyticsApi.getAllUsers();
      }
      if (response.success) {
        const data = response.data?.data || response.data || [];
        const arr = Array.isArray(data) ? data : [];
        const map: Record<string, string> = {};
        arr.forEach((item: any) => {
          const u = item?.user ?? item;
          const id = u?.id ?? u?.userId;
          if (!id) return;
          map[String(id)] = u.name || u.username || u.email || 'Unknown';
        });
        setUserNameById(map);
      }
    } catch (e) {
      console.error('Error loading users for map:', e);
    }
  }, [isAdmin]);

  // Refresh when coming back from Edit (so assignee changes show immediately)
  useFocusEffect(
    useCallback(() => {
      loadOpportunities();
      loadUsersForMap();
    }, [loadOpportunities, loadUsersForMap])
  );

  useEffect(() => {
    loadOpportunities();
    loadUsersForMap();
  }, [loadOpportunities, loadUsersForMap]);

  const getManualOpportunityId = (opportunity: any): string | undefined => {
    // For manual edit/delete endpoints we must use the manual record id (not ghlOpportunityId).
    return opportunity?.id || opportunity?.opportunityId || opportunity?.ghlOpportunityId;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOpportunities();
    setRefreshing(false);
  };

  const handleDeleteOpportunity = (opportunity: any) => {
    const opportunityId = getManualOpportunityId(opportunity);
    if (!opportunityId) return;

    const doDelete = async () => {
      try {
        const response = await opportunitiesApi.deleteManualOpportunity(opportunityId);
        if (response.success) {
          loadOpportunities();
        } else {
          Alert.alert('Error', response.error || 'Failed to delete');
        }
      } catch (err) {
        Alert.alert('Error', (err as Error)?.message || 'Failed to delete');
      }
    };

    // Alert confirmations can be unreliable on web; use window.confirm there.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm('Delete this manual opportunity? This cannot be undone.');
      if (ok) void doDelete();
      return;
    }

    Alert.alert('Delete opportunity', 'Are you sure you want to delete this manual opportunity? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleEditOpportunity = (opportunity: any) => {
    const opportunityId = getManualOpportunityId(opportunity);
    if (!opportunityId) return;
    navigation.navigate('EditManualOpportunity', { opportunityId });
  };

  const handleOpportunityClick = (opportunity: any) => {
    const opportunityId = getManualOpportunityId(opportunity);
    if (!opportunityId) {
      Alert.alert('Error', 'Opportunity ID not found');
      return;
    }
    // Admins see the admin details view (with delete); surveyors see the regular details view
    if (isAdmin) {
      navigation.navigate('AdminOpportunityDetails', { opportunityId });
    } else {
      navigation.navigate('OpportunityDetails', { opportunityId });
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const renderOpportunityItem = (opportunity: any, index: number) => {
    if (!opportunity) return null;

    const opportunityId = opportunity.ghlOpportunityId || opportunity.id || opportunity.opportunityId || 'Unknown';
    const customerName =
      opportunity.customerName ||
      (opportunity.contact?.firstName && opportunity.contact?.lastName
        ? `${opportunity.contact.firstName} ${opportunity.contact.lastName}`.trim()
        : null) ||
      opportunity.contact?.firstName ||
      opportunity.contact?.lastName ||
      opportunity.contactName ||
      opportunity.name ||
      'Unknown Customer';
    const status = opportunity.status || 'Unknown';
    const currentStep = opportunity.currentStep ?? 0;
    const totalSteps = opportunity.totalSteps ?? 0;
    const assignedToName =
      opportunity.owner?.name ||
      opportunity.owner?.username ||
      opportunity.assignedToName ||
      opportunity.user?.name ||
      opportunity.user?.username ||
      (opportunity.userId ? userNameById[String(opportunity.userId)] : undefined);

    return (
      <View
        key={`opp-${opportunityId}-${index}`}
        style={[styles.dataItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        <TouchableOpacity
          onPress={() => handleOpportunityClick(opportunity)}
          activeOpacity={0.7}
          style={{ flex: 1 }}
        >
          <View style={styles.dataItemHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dataItemTitle, { color: theme.primaryText }]}>{customerName}</Text>
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, fontSize: 12, marginTop: 4 }]}>
                {opportunity.name || opportunityId}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: theme.primaryButton + '20' }]}>
              <Text style={[styles.statusText, { color: theme.primaryButton, fontSize: 10 }]}>Manual</Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            {(assignedToName || opportunity.userId) && (
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: '600' }}>Assigned to:</Text> {assignedToName || '—'}
              </Text>
            )}
            {opportunity.scheduledAt && (
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: '600' }}>Scheduled:</Text> {formatScheduledAtDisplay(opportunity.scheduledAt)}
              </Text>
            )}
            {(currentStep > 0 || totalSteps > 0) && (
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: '600' }}>Step:</Text> {currentStep} / {totalSteps}
              </Text>
            )}
            {opportunity.contactPostcode && (
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: '600' }}>Postcode:</Text> {opportunity.contactPostcode}
              </Text>
            )}
            {opportunity.lastActivityAt && (
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: '600' }}>Last activity:</Text> {formatDate(opportunity.lastActivityAt)}
              </Text>
            )}
          </View>
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
            <Text style={[styles.dataItemSubtitle, { color: theme.primaryButton, fontSize: 12 }]}>
              Tap to view details →
            </Text>
          </View>
        </TouchableOpacity>
        {isAdmin && (
          <View style={[styles.actionRow, { borderTopColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primaryButton + '20' }]}
              onPress={() => handleEditOpportunity(opportunity)}
            >
              <Feather name="edit-2" size={16} color={theme.primaryButton} />
              <Text style={[styles.actionButtonText, { color: theme.primaryButton }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: (theme.dangerButton || '#dc3545') + '20' }]}
              onPress={() => handleDeleteOpportunity(opportunity)}
            >
              <Feather name="trash-2" size={16} color={theme.dangerButton || '#dc3545'} />
              <Text style={[styles.actionButtonText, { color: theme.dangerButton || '#dc3545' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading manual opportunities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh' },
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={[styles.headerTop, { justifyContent: 'space-between' }]}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.borderColor }]}
            onPress={() => {
              if (navigation.canGoBack?.()) navigation.goBack();
              else navigation.navigate('MainTabs', { screen: 'Profile' });
            }}
          >
            <Feather name="arrow-left" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => navigation.navigate('AdminCreateManualOpportunity')}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.createButtonText}>Create opportunity</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.primaryText }]}>Opportunity management</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Manual opportunities</Text>
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
            Manual opportunities ({total})
          </Text>
          {opportunities.length > 0 ? (
            opportunities.map((opp: any, index: number) => renderOpportunityItem(opp, index))
          ) : (
            <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
              <Feather name="briefcase" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                No manual opportunities yet.
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: theme.primaryButton, marginTop: 16 }]}
                  onPress={() => navigation.navigate('AdminCreateManualOpportunity')}
                >
                  <Feather name="plus" size={18} color="#fff" />
                  <Text style={styles.createButtonText}>Create opportunity</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  createButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerText: { alignItems: 'center' },
  title: { fontSize: width < 768 ? 28 : 34, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
  scrollView: { flex: 1, paddingHorizontal: width < 768 ? 16 : 24, paddingTop: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  dataSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  dataItem: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  dataItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dataItemTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  dataItemSubtitle: { fontSize: 14, marginBottom: 4, opacity: 0.8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
});

export default OpportunityManagementScreen;
