import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { opportunityOutcomesApi } from '../utils/api';
import { UserWinLossStats, WinLossStats } from '../types';

interface WinLossStatsCardProps {
  userId?: string;
  isAdmin?: boolean;
  startDate?: Date;
  endDate?: Date;
  onRefresh?: () => void;
}

const WinLossStatsCard: React.FC<WinLossStatsCardProps> = ({
  userId,
  isAdmin = false,
  startDate,
  endDate,
  onRefresh,
}) => {
  const { theme } = useTheme();
  const [stats, setStats] = useState<UserWinLossStats | WinLossStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    // Skip API calls if admin is logged in
    if (isAdmin) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      setError(null);
      let response;
      
      // Get current user's stats
      response = await opportunityOutcomesApi.getUserStats(
        startDate?.toISOString(),
        endDate?.toISOString()
      );
      setStats(response.data || null);
      console.log('Win/Loss stats fetched for current user:', response.data);
    } catch (err) {
      console.error('Error fetching win/loss stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userId, isAdmin, startDate, endDate]);

  // Handle external refresh trigger
  useEffect(() => {
    if (onRefresh) {
      // Listen for refresh events
      const handleRefresh = () => {
        fetchStats();
      };
      
      // Call refresh immediately if onRefresh is provided
      handleRefresh();
    }
  }, [onRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    onRefresh?.();
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading statistics...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={fetchStats}
          >
            <Text style={[styles.retryButtonText, { color: theme.primaryButtonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.noDataContainer}>
          <MaterialIcons name="trending-up" size={48} color={theme.primaryButton} />
          <Text style={[styles.noDataTitle, { color: theme.primaryText }]}>
            Win/Loss Tracking Active
          </Text>
          <Text style={[styles.noDataText, { color: theme.secondaryText }]}>
            Starting now, your sales performance will be tracked automatically.{'\n'}
            Data will appear here once you complete opportunities and mark them as won or lost.
          </Text>
          <View style={[styles.infoBox, { backgroundColor: theme.primaryButton + '10', borderColor: theme.primaryButton + '30' }]}>
            <MaterialIcons name="info" size={16} color={theme.primaryButton} />
            <Text style={[styles.infoText, { color: theme.primaryButton }]}>
              Complete step 12 of the workflow to record outcomes
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const isUserStats = 'userName' in stats;
  const displayName = isUserStats ? stats.userName : 'Overall Company';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.cardBackground }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primaryButton}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="trending-up" size={24} color={theme.primaryButton} />
          <Text style={[styles.title, { color: theme.primaryText }]}>
            Win/Loss Statistics
          </Text>
        </View>
        {isUserStats && (
          <Text style={[styles.userName, { color: theme.secondaryText }]}>
            {displayName}
          </Text>
        )}
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsContainer}>
        {/* Conversion Rate */}
        <View style={[styles.metricCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={[styles.metricContent, { backgroundColor: theme.primaryButton + '10' }]}>
            <FontAwesome5 name="percentage" size={20} color={theme.primaryButton} />
            <Text style={[styles.metricValue, { color: theme.primaryText }]}>{formatPercentage(stats.conversionRate)}</Text>
            <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>Conversion Rate</Text>
          </View>
        </View>

        {/* Total Value */}
        <View style={[styles.metricCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={[styles.metricContent, { backgroundColor: theme.successButton + '10' }]}>
            <MaterialIcons name="attach-money" size={20} color={theme.successButton} />
            <Text style={[styles.metricValue, { color: theme.primaryText }]}>{formatCurrency(stats.wonValue)}</Text>
            <Text style={[styles.metricLabel, { color: theme.secondaryText }]}>Won Value</Text>
          </View>
        </View>
      </View>

      {/* Detailed Stats */}
      <View style={styles.detailsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
          Detailed Breakdown
        </Text>

        {/* Wins */}
        <View style={[styles.statRow, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.statLeft}>
            <View style={[styles.statIcon, { backgroundColor: theme.successButton }]}>
              <MaterialIcons name="check-circle" size={16} color="white" />
            </View>
            <Text style={[styles.statLabel, { color: theme.primaryText }]}>Won</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: theme.primaryText }]}>{stats.won}</Text>
            <Text style={[styles.statSubValue, { color: theme.secondaryText }]}>
              {formatCurrency(stats.wonValue)}
            </Text>
          </View>
        </View>

        {/* Losses */}
        <View style={[styles.statRow, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.statLeft}>
            <View style={[styles.statIcon, { backgroundColor: theme.dangerButton }]}>
              <MaterialIcons name="cancel" size={16} color="white" />
            </View>
            <Text style={[styles.statLabel, { color: theme.primaryText }]}>Lost</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: theme.primaryText }]}>{stats.lost}</Text>
            <Text style={[styles.statSubValue, { color: theme.secondaryText }]}>
              {formatCurrency(stats.totalValue - stats.wonValue)}
            </Text>
          </View>
        </View>

        {/* In Progress */}
        <View style={[styles.statRow, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.statLeft}>
            <View style={[styles.statIcon, { backgroundColor: theme.primaryButton }]}>
              <MaterialIcons name="hourglass-empty" size={16} color="white" />
            </View>
            <Text style={[styles.statLabel, { color: theme.primaryText }]}>In Progress</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: theme.primaryText }]}>{stats.inProgress}</Text>
            <Text style={[styles.statSubValue, { color: theme.secondaryText }]}>-</Text>
          </View>
        </View>

        {/* Total */}
        <View style={[styles.statRow, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.statLeft}>
            <View style={[styles.statIcon, { backgroundColor: theme.primaryButton }]}>
              <MaterialIcons name="assessment" size={16} color="white" />
            </View>
            <Text style={[styles.statLabel, { color: theme.primaryText }]}>Total</Text>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: theme.primaryText }]}>
              {stats.totalOpportunities}
            </Text>
            <Text style={[styles.statSubValue, { color: theme.secondaryText }]}>
              {formatCurrency(stats.totalValue)}
            </Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    margin: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  noDataText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
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
  userName: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  metricsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  metricGradient: {
    padding: 20,
    alignItems: 'center',
  },
  metricContent: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  detailsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statRight: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statSubValue: {
    fontSize: 14,
    marginTop: 2,
  },
  additionalMetrics: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  additionalMetric: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  additionalMetricLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  additionalMetricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WinLossStatsCard;
