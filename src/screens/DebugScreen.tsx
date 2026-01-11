import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { opportunitiesApi } from '../utils/api';
import { urlManager } from '../utils/config';

export default function DebugScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [wonDebugData, setWonDebugData] = useState<any>(null);
  const [loadingWon, setLoadingWon] = useState(false);
  const [opportunitiesWithWonData, setOpportunitiesWithWonData] = useState<any>(null);
  const [loadingOpportunitiesWithWon, setLoadingOpportunitiesWithWon] = useState(false);
  const [allUserOpportunitiesData, setAllUserOpportunitiesData] = useState<any>(null);
  const [loadingAllUserOpportunities, setLoadingAllUserOpportunities] = useState(false);

  const fetchAllOpportunities = async () => {
    setLoading(true);
    try {
      const response = await opportunitiesApi.getAllOpportunities();
      if (response.success && response.data) {
        setDebugData(response.data);
        console.log('Debug: All opportunities data:', response.data);
      } else {
        console.error('Debug: Failed to fetch all opportunities:', response.error);
        Alert.alert('Error', 'Failed to fetch all opportunities');
      }
    } catch (error) {
      console.error('Debug: Error fetching all opportunities:', error);
      Alert.alert('Error', 'Failed to fetch all opportunities');
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    try {
      console.log('Debug: Testing health check...');
      const response = await opportunitiesApi.healthCheck();
      console.log('Debug: Health check response:', response);
      if (response.success) {
        Alert.alert('Success', 'Backend is responding correctly');
      } else {
        Alert.alert('Error', `Health check failed: ${response.error}`);
      }
    } catch (error) {
      console.error('Debug: Health check error:', error);
      Alert.alert('Error', 'Health check failed');
    }
  };

  const fetchWonOpportunities = async () => {
    setLoadingWon(true);
    try {
      console.log('Debug: Fetching won opportunities...');
      const response = await opportunitiesApi.debugAllWonOpportunities();
      console.log('Debug: Won opportunities response:', response);
      
      if (response.success && response.data) {
        console.log('Debug: Full response data structure:', JSON.stringify(response.data, null, 2));
        
        // Ensure the data structure has the expected properties
        const safeData = {
          totalOpportunities: response.data.totalOpportunities || 0,
          wonByStatus: response.data.wonByStatus || 0,
          wonByTag: response.data.wonByTag || 0,
          wonByStatusExamples: response.data.wonByStatusExamples || [],
          wonByTagExamples: response.data.wonByTagExamples || []
        };
        
        setWonDebugData(safeData);
        Alert.alert(
          'Debug Results', 
          `Total: ${safeData.totalOpportunities}\nWon by Status: ${safeData.wonByStatus}\nWon by Tag: ${safeData.wonByTag}`
        );
      } else {
        console.error('Debug: Failed to fetch won opportunities:', response.error);
        Alert.alert('Error', `Failed to fetch won opportunities: ${response.error}`);
      }
    } catch (error) {
      console.error('Debug: Error fetching won opportunities:', error);
      Alert.alert('Error', `Failed to fetch won opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingWon(false);
    }
  };

  const fetchOpportunitiesWithWon = async () => {
    setLoadingOpportunitiesWithWon(true);
    try {
      console.log('Debug: Fetching opportunities with won status...');
      const response = await opportunitiesApi.getOpportunitiesWithWon();
      console.log('Debug: Opportunities with won response:', response);
      
      if (response.success && response.data) {
        console.log('Debug: Full opportunities with won data structure:', JSON.stringify(response.data, null, 2));
        setOpportunitiesWithWonData(response.data);
        Alert.alert(
          'Opportunities With Won Results', 
          `Total: ${response.data.totalOpportunities}\nTotal Value: £${response.data.totalValue?.toLocaleString() || 0}`
        );
      } else {
        console.error('Debug: Failed to fetch opportunities with won:', response.error);
        Alert.alert('Error', `Failed to fetch opportunities with won: ${response.error}`);
      }
    } catch (error) {
      console.error('Debug: Error fetching opportunities with won:', error);
      Alert.alert('Error', 'Failed to fetch opportunities with won');
    } finally {
      setLoadingOpportunitiesWithWon(false);
    }
  };

  const fetchAllUserOpportunities = async () => {
    setLoadingAllUserOpportunities(true);
    try {
      const response = await opportunitiesApi.debugAllUserOpportunities();
      console.log('Debug: All user opportunities response:', response);
      
      if (response.success && response.data) {
        setAllUserOpportunitiesData(response.data);
        Alert.alert(
          'All User Opportunities Results', 
          `Total: ${response.data.totalOpportunities}\nAssigned: ${response.data.assignedOpportunities}\nOwned: ${response.data.ownedOpportunities}\nName-based: ${response.data.nameBasedOpportunities}`
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to fetch all user opportunities');
      }
    } catch (error) {
      console.error('Error fetching all user opportunities:', error);
      Alert.alert('Error', `Failed to fetch all user opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingAllUserOpportunities(false);
    }
  };

  // URL Manager functions
  useEffect(() => {
    setCurrentUrl(urlManager.getApiUrl());
  }, []);

  const handleUpdateUrl = () => {
    if (!newUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    // Add https:// if not present
    let urlToSet = newUrl.trim();
    if (!urlToSet.startsWith('http://') && !urlToSet.startsWith('https://')) {
      urlToSet = 'https://' + urlToSet;
    }

    try {
      urlManager.setOverrideUrl(urlToSet);
      setCurrentUrl(urlToSet);
      setNewUrl('');
      setTestResult(null);
      Alert.alert('Success', `API URL updated to: ${urlToSet}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update URL');
    }
  };

  const handleTestUrl = async () => {
    const urlToTest = newUrl.trim() || currentUrl;
    if (!urlToTest) {
      Alert.alert('Error', 'Please enter a URL to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const isWorking = await urlManager.testUrl(urlToTest);
      if (isWorking) {
        setTestResult('✅ URL is working!');
      } else {
        setTestResult('❌ URL is not responding');
      }
    } catch (error) {
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearOverride = () => {
    urlManager.clearOverrideUrl();
    const defaultUrl = urlManager.getApiUrl();
    setCurrentUrl(defaultUrl);
    setNewUrl('');
    setTestResult(null);
    Alert.alert('Success', 'URL override cleared');
  };

  const renderStageBreakdown = () => {
    if (!debugData?.summary?.stageBreakdown) return null;

    return Object.entries(debugData.summary.stageBreakdown).map(([stageName, opportunities]: [string, any]) => (
      <View key={stageName} style={styles.stageCard}>
        <Text style={styles.stageName}>{stageName}</Text>
        <Text style={styles.stageCount}>{opportunities.length} opportunities</Text>
        <Text style={styles.stageValue}>
          Total Value: £{(opportunities as any[]).reduce((sum, opp) => sum + (opp.monetaryValue || 0), 0).toLocaleString()}
        </Text>
      </View>
    ));
  };

  return (
    <ScrollView 
      style={[
        styles.container,
        Platform.OS === 'web' && {
          height: '100%',
          maxHeight: '100%',
        }
      ]}
      contentContainerStyle={[
        { paddingBottom: 40 },
        Platform.OS === 'web' && {
          minHeight: '100vh' as any,
          paddingBottom: 100,
        }
      ]}
      showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
      nestedScrollEnabled={true}
      scrollEnabled={true}
      bounces={Platform.OS !== 'web'}
      alwaysBounceVertical={Platform.OS !== 'web'}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={Platform.OS !== 'web'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Debug - All Opportunities</Text>
        <Text style={styles.subtitle}>
          Testing the new endpoint to see all opportunities from CRM
        </Text>
      </View>

      <TouchableOpacity
        style={styles.fetchButton}
        onPress={fetchAllOpportunities}
        disabled={loading}
      >
        <LinearGradient
          colors={['#f2f047', '#89df2b']}
          style={styles.fetchGradient}
        >
          <Text style={styles.fetchButtonText}>
            {loading ? 'Fetching...' : 'Fetch All Opportunities'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fetchButton, { backgroundColor: '#3b82f6' }]}
        onPress={testHealthCheck}
      >
        <Text style={[styles.fetchButtonText, { color: '#ffffff' }]}>
          Test Backend Health
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fetchButton, { backgroundColor: '#ef4444' }]}
        onPress={fetchWonOpportunities}
        disabled={loadingWon}
      >
        <Text style={[styles.fetchButtonText, { color: '#ffffff' }]}>
          {loadingWon ? 'Debugging Won...' : '🔍 Debug Won Opportunities'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fetchButton, { backgroundColor: '#3b82f6' }]}
        onPress={fetchOpportunitiesWithWon}
        disabled={loadingOpportunitiesWithWon}
      >
        <Text style={[styles.fetchButtonText, { color: '#ffffff' }]}>
          {loadingOpportunitiesWithWon ? 'Loading...' : '🏆 Get Opportunities With Won'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fetchButton, { backgroundColor: '#10b981' }]}
        onPress={fetchAllUserOpportunities}
        disabled={loadingAllUserOpportunities}
      >
        <Text style={[styles.fetchButtonText, { color: '#ffffff' }]}>
          {loadingAllUserOpportunities ? 'Loading...' : '🔍 Debug All User Opportunities'}
        </Text>
      </TouchableOpacity>

      {/* URL Manager Section */}
      <View style={styles.urlManagerSection}>
        <Text style={styles.sectionTitle}>🔧 API URL Manager</Text>
        
        <View style={styles.urlInfo}>
          <Text style={styles.urlLabel}>Current API URL:</Text>
          <Text style={styles.currentUrl}>{currentUrl}</Text>
        </View>

        <TextInput
          style={styles.urlInput}
          placeholder="Enter new API URL (e.g.,  /api/)"
          value={newUrl}
          onChangeText={setNewUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <View style={styles.urlButtonRow}>
          <TouchableOpacity
            style={[styles.urlButton, styles.primaryButton]}
            onPress={handleUpdateUrl}
          >
            <Text style={styles.urlButtonText}>Update URL</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.urlButton, styles.testButton]}
            onPress={handleTestUrl}
            disabled={isTesting}
          >
            <Text style={styles.urlButtonText}>
              {isTesting ? 'Testing...' : 'Test URL'}
            </Text>
          </TouchableOpacity>
        </View>

        {testResult && (
          <Text style={styles.testResult}>{testResult}</Text>
        )}

        <TouchableOpacity
          style={[styles.urlButton, styles.dangerButton]}
          onPress={handleClearOverride}
        >
          <Text style={styles.urlButtonText}>🗑️ Clear Override</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#89df2b" />
          <Text style={styles.loadingText}>Fetching all opportunities...</Text>
        </View>
      )}

      {debugData && (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryText}>Total Opportunities: {debugData.count}</Text>
            <Text style={styles.summaryText}>Total Stages: {debugData.summary?.totalStages}</Text>
          </View>

          <Text style={styles.sectionTitle}>Opportunities by Stage</Text>
          {renderStageBreakdown()}
        </View>
      )}

      {wonDebugData && (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>🔍 Won Opportunities Debug</Text>
            <Text style={styles.summaryText}>Total Opportunities: {wonDebugData.totalOpportunities}</Text>
            <Text style={[styles.summaryText, { color: '#ef4444', fontWeight: 'bold' }]}>
              Won by Status: {wonDebugData.wonByStatus}
            </Text>
            <Text style={[styles.summaryText, { color: '#3b82f6', fontWeight: 'bold' }]}>
              Won by Tag: {wonDebugData.wonByTag}
            </Text>
          </View>

          {wonDebugData.wonByStatusExamples && Array.isArray(wonDebugData.wonByStatusExamples) && wonDebugData.wonByStatusExamples.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>✅ Won by Status Examples</Text>
              {wonDebugData.wonByStatusExamples.map((opp: any, index: number) => (
                <View key={index} style={styles.exampleCard}>
                  <Text style={styles.exampleName}>{opp.name}</Text>
                  <Text style={styles.exampleDetail}>Status: {opp.status}</Text>
                  <Text style={styles.exampleDetail}>Value: £{opp.value?.toLocaleString() || 'N/A'}</Text>
                  <Text style={styles.exampleDetail}>Stage: {opp.stageId}</Text>
                </View>
              ))}
            </View>
          )}

          {wonDebugData.wonByTagExamples && Array.isArray(wonDebugData.wonByTagExamples) && wonDebugData.wonByTagExamples.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>🏷️ Won by Tag Examples</Text>
              {wonDebugData.wonByTagExamples.map((opp: any, index: number) => (
                <View key={index} style={styles.exampleCard}>
                  <Text style={styles.exampleName}>{opp.name}</Text>
                  <Text style={styles.exampleDetail}>Status: {opp.status}</Text>
                  <Text style={styles.exampleDetail}>Tags: {JSON.stringify(opp.tags)}</Text>
                  <Text style={styles.exampleDetail}>Value: £{opp.value?.toLocaleString() || 'N/A'}</Text>
                </View>
              ))}
            </View>
          )}

          {(!wonDebugData.wonByStatusExamples || !Array.isArray(wonDebugData.wonByStatusExamples) || wonDebugData.wonByStatusExamples.length === 0) && 
           (!wonDebugData.wonByTagExamples || !Array.isArray(wonDebugData.wonByTagExamples) || wonDebugData.wonByTagExamples.length === 0) && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>📊 Debug Information</Text>
              <Text style={styles.summaryText}>No won opportunities found with examples</Text>
              <Text style={styles.summaryText}>Data structure: {JSON.stringify(wonDebugData, null, 2)}</Text>
            </View>
          )}
        </View>
      )}

      {opportunitiesWithWonData && (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>🏆 All Opportunities in Private Customers Pipeline</Text>
            <Text style={styles.summaryText}>Total Opportunities: {opportunitiesWithWonData.totalOpportunities}</Text>
            <Text style={[styles.summaryText, { color: '#10b981', fontWeight: 'bold' }]}>
              Total Value: £{opportunitiesWithWonData.totalValue?.toLocaleString() || 0}
            </Text>
          </View>

          {opportunitiesWithWonData.opportunitiesList && opportunitiesWithWonData.opportunitiesList.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>📋 All Opportunities (First 10)</Text>
              {opportunitiesWithWonData.opportunitiesList.map((opp: any, index: number) => (
                <View key={index} style={styles.exampleCard}>
                  <Text style={styles.exampleName}>{opp.name}</Text>
                  <Text style={styles.exampleDetail}>Status: {opp.status || 'No Status'}</Text>
                  <Text style={styles.exampleDetail}>Value: £{opp.value?.toLocaleString() || 'N/A'}</Text>
                  <Text style={styles.exampleDetail}>Stage: {opp.pipelineStageId}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {allUserOpportunitiesData && (
        <View style={styles.resultsContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>🔍 All User Opportunities Analysis</Text>
            <Text style={styles.summaryText}>Total Opportunities: {allUserOpportunitiesData.totalOpportunities}</Text>
            <Text style={[styles.summaryText, { color: '#3b82f6', fontWeight: 'bold' }]}>
              Assigned Opportunities: {allUserOpportunitiesData.assignedOpportunities}
            </Text>
            <Text style={[styles.summaryText, { color: '#10b981', fontWeight: 'bold' }]}>
              Owned Opportunities: {allUserOpportunitiesData.ownedOpportunities}
            </Text>
            <Text style={[styles.summaryText, { color: '#f59e0b', fontWeight: 'bold' }]}>
              Name-based Opportunities: {allUserOpportunitiesData.nameBasedOpportunities}
            </Text>
          </View>

          {allUserOpportunitiesData.assignedList && allUserOpportunitiesData.assignedList.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>📋 Assigned Opportunities (First 10)</Text>
              {allUserOpportunitiesData.assignedList.map((opp: any, index: number) => (
                <View key={index} style={styles.exampleCard}>
                  <Text style={styles.exampleName}>{opp.name}</Text>
                  <Text style={styles.exampleDetail}>Status: {opp.status || 'No Status'}</Text>
                  <Text style={styles.exampleDetail}>Value: £{opp.value?.toLocaleString() || 'N/A'}</Text>
                  <Text style={styles.exampleDetail}>Assigned To: {opp.assignedTo || 'N/A'}</Text>
                </View>
              ))}
            </View>
          )}

          {allUserOpportunitiesData.ownedList && allUserOpportunitiesData.ownedList.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>👑 Owned Opportunities (First 10)</Text>
              {allUserOpportunitiesData.ownedList.map((opp: any, index: number) => (
                <View key={index} style={styles.exampleCard}>
                  <Text style={styles.exampleName}>{opp.name}</Text>
                  <Text style={styles.exampleDetail}>Status: {opp.status || 'No Status'}</Text>
                  <Text style={styles.exampleDetail}>Value: £{opp.value?.toLocaleString() || 'N/A'}</Text>
                  <Text style={styles.exampleDetail}>Owner: {opp.ownerId || opp.createdBy || 'N/A'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  fetchButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  fetchGradient: {
    padding: 16,
    alignItems: 'center',
  },
  fetchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
  },
  resultsContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  stageCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  stageCount: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  stageValue: {
    fontSize: 14,
    color: '#89df2b',
    fontWeight: '600',
  },
  // URL Manager styles
  urlManagerSection: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  urlInfo: {
    marginBottom: 12,
  },
  urlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  currentUrl: {
    fontSize: 14,
    color: '#007AFF',
    fontFamily: 'monospace',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  urlButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  urlButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  testButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  urlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  testResult: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  exampleCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exampleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  exampleDetail: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
}); 