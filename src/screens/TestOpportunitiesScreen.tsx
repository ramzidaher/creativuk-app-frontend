import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { opportunitiesApi } from '../utils/api';

interface TestOpportunitiesResponse {
  summary: {
    total: number;
    ai: number;
    manual: number;
    user: {
      id: string;
      name: string;
      role: string;
    };
  };
  ai: {
    stageName: string;
    stageId: string;
    opportunities: any[];
  };
  manual: {
    stageName: string;
    stageId: string;
    opportunities: any[];
  };
  all: any[];
}

export default function TestOpportunitiesScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<TestOpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTestData = async () => {
    try {
      console.log('Test Opportunities: Fetching test data...');

      if (!isAuthenticated) {
        console.log('Test Opportunities: User not authenticated, skipping API call');
        setLoading(false);
        return;
      }

      const response = await opportunitiesApi.testAllOpportunities();
      console.log('Test Opportunities: API response received:', response);

      if (response.success && response.data) {
        setData(response.data);
        console.log('Test Opportunities: Loaded test data successfully');
      } else {
        console.error('Test Opportunities: API failed:', response.error);
        setError(response.error || 'Failed to load test data');
        Alert.alert('Error', response.error || 'Failed to load test data');
      }
    } catch (error) {
      console.error('Test Opportunities: Fetch error:', error);
      setError('Failed to load test data');
      Alert.alert('Error', 'Failed to load test data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTestData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTestData();
  }, [isAuthenticated]);

  const renderSummary = () => {
    if (!data?.summary) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Summary</Text>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>Total Opportunities: {data.summary.total}</Text>
          <Text style={styles.summaryText}>AI Opportunities: {data.summary.ai}</Text>
          <Text style={styles.summaryText}>Manual Opportunities: {data.summary.manual}</Text>
          <Text style={styles.summaryText}>User: {data.summary.user.name} ({data.summary.user.role})</Text>
        </View>
      </View>
    );
  };

  const renderOpportunities = (title: string, opportunities: any[], stageName: string) => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.stageName}>{stageName}</Text>
        <Text style={styles.countText}>{opportunities.length} opportunities</Text>
        
        {opportunities.slice(0, 5).map((opp, index) => (
          <View key={opp.id} style={styles.opportunityItem}>
            <Text style={styles.opportunityName}>{index + 1}. {opp.name}</Text>
            <Text style={styles.opportunityDetails}>
              Contact: {opp.contactName || 'N/A'} | Value: £{opp.monetaryValue || 0}
            </Text>
            <Text style={styles.opportunityId}>ID: {opp.id}</Text>
          </View>
        ))}
        
        {opportunities.length > 5 && (
          <Text style={styles.moreText}>... and {opportunities.length - 5} more</Text>
        )}
      </View>
    );
  };

  const renderRawData = () => {
    if (!data) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔍 Raw JSON Data</Text>
        <ScrollView style={styles.rawDataContainer}>
          <Text style={styles.rawDataText}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading test data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTestData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test Opportunities</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color="#1e293b" />
        </TouchableOpacity>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4F35B" />
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
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        {renderSummary()}
        {data?.ai && renderOpportunities('🤖 AI Opportunities', data.ai.opportunities, data.ai.stageName)}
        {data?.manual && renderOpportunities('👤 Manual Opportunities', data.manual.opportunities, data.manual.stageName)}
        {renderRawData()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stageName: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  opportunityItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  opportunityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  opportunityDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  opportunityId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  moreText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  rawDataContainer: {
    maxHeight: 300,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  rawDataText: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
  },
}); 