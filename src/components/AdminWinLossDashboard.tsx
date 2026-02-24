import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateRangePicker from '../components/DateRangePicker';
import { useTheme } from '../context/ThemeContext';
import { UserWinLossStats } from '../types';
import { opportunityOutcomesApi } from '../utils/api';

interface AdminWinLossDashboardProps {
  onUserSelect?: (userId: string) => void;
}

const AdminWinLossDashboard: React.FC<AdminWinLossDashboardProps> = ({
  onUserSelect,
}) => {
  const { theme } = useTheme();
  const [userStats, setUserStats] = useState<UserWinLossStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [startDate, setStartDate] = useState<Date | null>(new Date(now.getFullYear(), now.getMonth(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  const [selectedSurveyorId, setSelectedSurveyorId] = useState<string>('ALL');
  const [showSurveyorModal, setShowSurveyorModal] = useState(false);

  const [recentOutcomes, setRecentOutcomes] = useState<any[]>([]);
  const [togglingCancelledId, setTogglingCancelledId] = useState<string | null>(null);

  const formatDateParam = (date: Date | null) => {
    if (!date) return undefined;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const normalizeStats = (payload: any): UserWinLossStats[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.users)) return payload.users;
    return [];
  };

  const normalizeRecentOutcomes = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.outcomes)) return payload.outcomes;
    return [];
  };

  const getOutcomeCancelledFlag = (outcome: any): boolean => {
    return Boolean(outcome?.isCancelled ?? outcome?.cancelled ?? outcome?.is_cancelled);
  };

  const getOutcomeOpportunityId = (outcome: any): string | null => {
    return (
      outcome?.opportunityId ||
      outcome?.ghlOpportunityId ||
      outcome?.ghlOpportunityID ||
      outcome?.id ||
      null
    );
  };

  const fetchData = async () => {
    try {
      setError(null);
      const start = formatDateParam(startDate);
      const end = formatDateParam(endDate);

      // Fetch user stats (admin)
      const usersResponse = await opportunityOutcomesApi.getAllRepsStats(start, end);
      if (usersResponse.success) {
        setUserStats(normalizeStats(usersResponse.data));
      } else {
        throw new Error(usersResponse.error || 'Failed to load stats');
      }

      // Fetch recent outcomes for quick admin actions
      const recentResponse = await opportunityOutcomesApi.getRecentOutcomes(20);
      if (recentResponse.success) {
        setRecentOutcomes(normalizeRecentOutcomes(recentResponse.data));
      }
    } catch (err) {
      console.error('Error fetching admin win/loss data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Re-fetch stats when the admin changes the date range
    setLoading(true);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const surveyorOptions = [
    { id: 'ALL', name: 'All Surveyors' },
    ...userStats
      .map((s) => ({ id: s.userId, name: s.userName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];

  const filteredUserStats =
    selectedSurveyorId === 'ALL'
      ? userStats
      : userStats.filter((s) => s.userId === selectedSurveyorId);

  const totals = filteredUserStats.reduce(
    (acc, s) => {
      acc.totalOpportunities += s.totalOpportunities || 0;
      acc.won += s.won || 0;
      acc.lost += s.lost || 0;
      acc.abandoned += s.abandoned || 0;
      acc.inProgress += s.inProgress || 0;
      acc.cancelled += (s as any).cancelled || 0;
      acc.totalValue += s.totalValue || 0;
      acc.wonValue += s.wonValue || 0;
      return acc;
    },
    {
      totalOpportunities: 0,
      won: 0,
      lost: 0,
      abandoned: 0,
      inProgress: 0,
      cancelled: 0,
      totalValue: 0,
      wonValue: 0,
    }
  );

  const renderSurveyorSelector = () => {
    const selected =
      surveyorOptions.find((o) => o.id === selectedSurveyorId)?.name || 'All Surveyors';

    return (
      <View style={[styles.filtersCard, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.filtersTitle, { color: theme.primaryText }]}>Reporting Filters</Text>

        <Text style={[styles.filterLabel, { color: theme.secondaryText }]}>Date range</Text>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          placeholder="Select report date range"
        />

        <Text style={[styles.filterLabel, { color: theme.secondaryText, marginTop: 16 }]}>
          Surveyor
        </Text>
        <TouchableOpacity
          style={[styles.surveyorButton, { borderColor: theme.cardBorder }]}
          onPress={() => setShowSurveyorModal(true)}
        >
          <MaterialIcons name="person-search" size={18} color={theme.primaryButton} />
          <Text style={[styles.surveyorButtonText, { color: theme.primaryText }]} numberOfLines={1}>
            {selected}
          </Text>
          <MaterialIcons name="expand-more" size={22} color={theme.secondaryText} />
        </TouchableOpacity>

        <Modal
          visible={showSurveyorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSurveyorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Surveyor</Text>
                <TouchableOpacity onPress={() => setShowSurveyorModal(false)}>
                  <MaterialIcons name="close" size={22} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList}>
                {surveyorOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.modalOption,
                      opt.id === selectedSurveyorId && { backgroundColor: theme.primaryButton + '15' },
                    ]}
                    onPress={() => {
                      setSelectedSurveyorId(opt.id);
                      setShowSurveyorModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: opt.id === selectedSurveyorId ? theme.primaryButton : theme.primaryText },
                      ]}
                    >
                      {opt.name}
                    </Text>
                    {opt.id === selectedSurveyorId && (
                      <MaterialIcons name="check" size={18} color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  const toggleCancelled = async (outcome: any) => {
    const opportunityId = getOutcomeOpportunityId(outcome);
    if (!opportunityId) return;

    try {
      setTogglingCancelledId(opportunityId);
      const res = await opportunityOutcomesApi.toggleCancelledAdmin(opportunityId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to toggle cancelled status');
      }
      await fetchData();
    } catch (e) {
      console.error('Failed to toggle cancelled:', e);
      setError(e instanceof Error ? e.message : 'Failed to toggle cancelled status');
    } finally {
      setTogglingCancelledId(null);
    }
  };

  const renderUserStatsItem = ({ item }: { item: UserWinLossStats }) => (
    <TouchableOpacity
      style={[styles.userStatsItem, { backgroundColor: theme.cardBackground }]}
      onPress={() => onUserSelect?.(item.userId)}
    >
      <View style={styles.userStatsHeader}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.primaryText }]}>
            {item.userName}
          </Text>
          <Text style={[styles.userEmail, { color: theme.secondaryText }]}>
            {item.userEmail}
          </Text>
        </View>
        <View style={styles.userConversion}>
          <Text style={[styles.conversionRate, { color: theme.primaryButton }]}>
            {formatPercentage(item.conversionRate)}
          </Text>
          <Text style={[styles.conversionLabel, { color: theme.secondaryText }]}>
            Conversion
          </Text>
        </View>
      </View>

      <View style={styles.userStatsDetails}>
        <View style={styles.userStat}>
          <View style={[styles.userStatIcon, { backgroundColor: '#4CAF50' }]}>
            <MaterialIcons name="check-circle" size={14} color="white" />
          </View>
          <Text style={[styles.userStatValue, { color: theme.primaryText }]}>{item.won}</Text>
          <Text style={[styles.userStatLabel, { color: theme.secondaryText }]}>Won</Text>
        </View>

        <View style={styles.userStat}>
          <View style={[styles.userStatIcon, { backgroundColor: '#F44336' }]}>
            <MaterialIcons name="cancel" size={14} color="white" />
          </View>
          <Text style={[styles.userStatValue, { color: theme.primaryText }]}>{item.lost}</Text>
          <Text style={[styles.userStatLabel, { color: theme.secondaryText }]}>Lost</Text>
        </View>

        <View style={styles.userStat}>
          <View style={[styles.userStatIcon, { backgroundColor: '#607D8B' }]}>
            <MaterialIcons name="event-busy" size={14} color="white" />
          </View>
          <Text style={[styles.userStatValue, { color: theme.primaryText }]}>
            {(item as any).cancelled || 0}
          </Text>
          <Text style={[styles.userStatLabel, { color: theme.secondaryText }]}>Cancelled</Text>
        </View>

        <View style={styles.userStat}>
          <View style={[styles.userStatIcon, { backgroundColor: '#FF9800' }]}>
            <MaterialIcons name="pause-circle" size={14} color="white" />
          </View>
          <Text style={[styles.userStatValue, { color: theme.primaryText }]}>{item.abandoned}</Text>
          <Text style={[styles.userStatLabel, { color: theme.secondaryText }]}>Abandoned</Text>
        </View>

        <View style={styles.userStat}>
          <View style={[styles.userStatIcon, { backgroundColor: '#9C27B0' }]}>
            <MaterialIcons name="hourglass-empty" size={14} color="white" />
          </View>
          <Text style={[styles.userStatValue, { color: theme.primaryText }]}>{item.inProgress}</Text>
          <Text style={[styles.userStatLabel, { color: theme.secondaryText }]}>In Progress</Text>
        </View>
      </View>

      <View style={styles.userValueContainer}>
        <Text style={[styles.userValueLabel, { color: theme.secondaryText }]}>
          Won Value:
        </Text>
        <Text style={[styles.userValue, { color: theme.primaryText }]}>
          {formatCurrency(item.wonValue)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading dashboard...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={theme.dangerButton} />
          <Text style={[styles.errorText, { color: theme.dangerButton }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={fetchData}
          >
            <Text style={[styles.retryButtonText, { color: 'white' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.primaryBackground }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primaryButton}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="dashboard" size={24} color={theme.primaryButton} />
          <Text style={[styles.title, { color: theme.primaryText }]}>
            Win/Loss Dashboard
          </Text>
        </View>
      </View>

      {/* Date range + surveyor filters */}
      {renderSurveyorSelector()}

      {/* Overall / filtered totals */}
      <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>Summary</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.totalOpportunities}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.won}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Won</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.lost}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Lost</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.cancelled}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Cancelled</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.abandoned}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Abandoned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{totals.inProgress}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>In Progress</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{formatCurrency(totals.wonValue)}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Won Value</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>{formatCurrency(totals.totalValue)}</Text>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Total Value</Text>
          </View>
        </View>
      </View>

      {/* User Stats */}
      <View style={[styles.userStatsContainer, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.userStatsTitle, { color: theme.primaryText }]}>
          User Performance ({filteredUserStats.length} users)
        </Text>
        
        <FlatList
          data={filteredUserStats}
          renderItem={renderUserStatsItem}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Recent jobs - admin action: toggle cancelled */}
      <View style={[styles.recentContainer, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.userStatsTitle, { color: theme.primaryText }]}>Recent Jobs</Text>
        {recentOutcomes.length === 0 ? (
          <Text style={[styles.recentEmptyText, { color: theme.secondaryText }]}>
            No recent outcomes found.
          </Text>
        ) : (
          recentOutcomes.map((o, idx) => {
            const oppId = getOutcomeOpportunityId(o);
            const cancelled = getOutcomeCancelledFlag(o);
            const outcomeLabel = (o?.outcome || o?.status || 'UNKNOWN') as string;
            const isToggling = !!oppId && togglingCancelledId === oppId;

            return (
              <View key={`${oppId || idx}`} style={[styles.recentItem, { borderColor: theme.cardBorder }]}>
                <View style={styles.recentLeft}>
                  <Text style={[styles.recentOutcome, { color: theme.primaryText }]} numberOfLines={1}>
                    {outcomeLabel}
                  </Text>
                  <Text style={[styles.recentMeta, { color: theme.secondaryText }]} numberOfLines={1}>
                    {oppId ? `Opportunity: ${oppId}` : 'Opportunity: (missing id)'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.cancelledToggleButton,
                    { backgroundColor: cancelled ? theme.dangerButton : theme.primaryButton, opacity: isToggling || !oppId ? 0.6 : 1 },
                  ]}
                  onPress={() => {
                    if (!oppId) return;
                    toggleCancelled(o);
                  }}
                  disabled={isToggling || !oppId}
                >
                  {isToggling ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.cancelledToggleText}>
                      {cancelled ? 'Uncancel' : 'Cancel'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  filtersCard: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  surveyorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  surveyorButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalList: {
    maxHeight: 380,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  summaryItem: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  userStatsContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userStatsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  userStatsItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  userStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  userConversion: {
    alignItems: 'center',
  },
  conversionRate: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversionLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  userStatsDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  userStat: {
    alignItems: 'center',
    width: '18%',
    minWidth: 68,
  },
  userStatIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  userStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userStatLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  userValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  userValueLabel: {
    fontSize: 14,
  },
  userValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  recentEmptyText: {
    fontSize: 13,
    marginTop: 8,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 10,
  },
  recentLeft: {
    flex: 1,
  },
  recentOutcome: {
    fontSize: 14,
    fontWeight: '800',
  },
  recentMeta: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  cancelledToggleButton: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledToggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default AdminWinLossDashboard;

