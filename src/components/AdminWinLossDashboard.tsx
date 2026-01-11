import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const getDateRange = (period: string) => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      start: startDate.toISOString(),
      end: now.toISOString(),
    };
  };

  const fetchData = async () => {
    try {
      setError(null);
      const dateRange = getDateRange(selectedPeriod);

      // Fetch user stats
      const usersResponse = await opportunityOutcomesApi.getAllUsersStats(dateRange.start, dateRange.end);

      if (usersResponse.success) {
        setUserStats(usersResponse.data || []);
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
  }, [selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const renderPeriodSelector = () => (
    <View style={[styles.periodSelector, { backgroundColor: theme.primaryBackground }]}>
      {(['week', 'month', 'quarter', 'year'] as const).map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && { backgroundColor: theme.primaryButton },
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              { color: selectedPeriod === period ? 'white' : theme.primaryText },
            ]}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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

      {/* Period Selector */}
      {renderPeriodSelector()}

      {/* User Stats */}
      <View style={[styles.userStatsContainer, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.userStatsTitle, { color: theme.primaryText }]}>
          User Performance ({userStats.length} users)
        </Text>
        
        <FlatList
          data={userStats}
          renderItem={renderUserStatsItem}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
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
  periodSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  userStat: {
    alignItems: 'center',
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
});

export default AdminWinLossDashboard;

