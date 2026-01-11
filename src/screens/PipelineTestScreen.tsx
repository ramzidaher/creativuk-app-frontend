import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { opportunitiesApi } from '../utils/api';
import { Feather } from '@expo/vector-icons';

export default function PipelineTestScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState('FxPA8fVU11VnudThxhFy'); // Private Customers pipeline
  const [stageName, setStageName] = useState('Installation Survey Booked');

  const handleGetPipelines = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await opportunitiesApi.getPipelines();
      
      if (response.success) {
        setData(response.data);
        Alert.alert('Success', `Found ${response.data?.pipelines?.length || 0} pipelines`);
      } else {
        setError(response.error || 'Failed to fetch pipelines');
        Alert.alert('Error', response.error || 'Failed to fetch pipelines');
      }
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetOpportunitiesByPipeline = async () => {
    if (!pipelineId.trim()) {
      Alert.alert('Error', 'Please enter a pipeline ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await opportunitiesApi.getOpportunitiesByPipeline(pipelineId);
      
      if (response.success) {
        setData(response.data);
        Alert.alert('Success', `Found ${response.data?.opportunities?.length || 0} opportunities`);
      } else {
        setError(response.error || 'Failed to fetch opportunities');
        Alert.alert('Error', response.error || 'Failed to fetch opportunities');
      }
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetOpportunitiesByStage = async () => {
    if (!stageName.trim()) {
      Alert.alert('Error', 'Please enter a stage name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await opportunitiesApi.getOpportunitiesByStageProgression(stageName);
      
      if (response.success) {
        setData(response.data);
        Alert.alert('Success', `Found ${response.data?.opportunities?.length || 0} opportunities in stage "${stageName}"`);
      } else {
        setError(response.error || 'Failed to fetch opportunities');
        Alert.alert('Error', response.error || 'Failed to fetch opportunities');
      }
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetOpportunitiesByStageUnfiltered = async () => {
    if (!stageName.trim()) {
      Alert.alert('Error', 'Please enter a stage name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await opportunitiesApi.getOpportunitiesByStageProgressionUnfiltered(stageName);
      
      if (response.success) {
        setData(response.data);
        Alert.alert('Success', `Found ${response.data?.opportunities?.length || 0} UNFILTERED opportunities in stage "${stageName}"`);
      } else {
        setError(response.error || 'Failed to fetch opportunities');
        Alert.alert('Error', response.error || 'Failed to fetch opportunities');
      }
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPipelines = () => {
    if (!data?.pipelines) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📊 Pipelines ({data.pipelines.length})</Text>
        {data.pipelines.map((pipeline: any, index: number) => (
          <View key={pipeline.id || index} style={[styles.pipelineItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.pipelineTitle, { color: theme.primaryText }]}>
              {index + 1}. {pipeline.name || 'No Name'}
            </Text>
            <Text style={[styles.pipelineDetails, { color: theme.secondaryText }]}>
              ID: {pipeline.id || 'N/A'}
            </Text>
            <Text style={[styles.pipelineDetails, { color: theme.secondaryText }]}>
              Stages: {pipeline.stages?.length || 0}
            </Text>
            {pipeline.stages && pipeline.stages.length > 0 && (
              <View style={styles.stagesContainer}>
                <Text style={[styles.stagesTitle, { color: theme.primaryText }]}>Stages:</Text>
                {pipeline.stages.map((stage: any, stageIndex: number) => (
                  <Text key={stage.id || stageIndex} style={[styles.stageItem, { color: theme.secondaryText }]}>
                    • {stage.name} (ID: {stage.id})
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderOpportunities = () => {
    if (!data?.opportunities) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📋 Opportunities ({data.opportunities.length})</Text>
        {data.opportunities.slice(0, 5).map((opp: any, index: number) => (
          <View key={opp.id || index} style={[styles.opportunityItem, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.opportunityTitle, { color: theme.primaryText }]}>
              {index + 1}. {opp.name || 'No Name'}
            </Text>
            <Text style={[styles.opportunityDetails, { color: theme.secondaryText }]}>
              ID: {opp.id || 'N/A'}
            </Text>
            <Text style={[styles.opportunityDetails, { color: theme.secondaryText }]}>
              Status: {opp.status || 'N/A'}
            </Text>
            <Text style={[styles.opportunityDetails, { color: theme.secondaryText }]}>
              Stage ID: {opp.pipelineStageId || 'N/A'}
            </Text>
            {opp.monetaryValue && (
              <Text style={[styles.opportunityDetails, { color: theme.secondaryText }]}>
                Value: £{opp.monetaryValue}
              </Text>
            )}
          </View>
        ))}
        {data.opportunities.length > 5 && (
          <Text style={[styles.moreText, { color: theme.secondaryText }]}>
            ... and {data.opportunities.length - 5} more opportunities
          </Text>
        )}
      </View>
    );
  };

  const renderStageInfo = () => {
    if (!data?.stage) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>🎯 Stage Information</Text>
        <View style={[styles.stageInfoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.stageInfoTitle, { color: theme.primaryText }]}>
            {data.stage.name}
          </Text>
          <Text style={[styles.stageInfoDetails, { color: theme.secondaryText }]}>
            Stage ID: {data.stage.id}
          </Text>
          <Text style={[styles.stageInfoDetails, { color: theme.secondaryText }]}>
            Pipeline ID: {data.stage.pipelineId}
          </Text>
          <Text style={[styles.stageInfoDetails, { color: theme.secondaryText }]}>
            Total Count: {data.totalCount}
          </Text>
          <Text style={[styles.stageInfoDetails, { color: theme.secondaryText }]}>
            Filtered Count: {data.filteredCount}
          </Text>
        </View>
      </View>
    );
  };

  const renderRawData = () => {
    if (!data) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>🔍 Raw JSON Data</Text>
        <ScrollView style={[styles.rawDataContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.rawDataText, { color: theme.primaryText }]}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView 
      style={[
        styles.container, 
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100%',
          maxHeight: '100%',
        }
      ]}
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Pipeline Testing</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Test pipeline and stage progression endpoints
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Test Buttons */}
        <View style={styles.testSection}>
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: theme.primaryButton }]} 
            onPress={handleGetPipelines}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>Get All Pipelines</Text>
          </TouchableOpacity>

          {/* Stage ID Reference */}
          <View style={[styles.referenceSection, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.referenceTitle, { color: theme.primaryText }]}>📋 Key Stage IDs (Private Customers Pipeline):</Text>
            <Text style={[styles.referenceItem, { color: theme.secondaryText }]}>
              • AI Bot Survey: 8904bbe1-53a3-468e-94e4-f13cb04a4947
            </Text>
            <Text style={[styles.referenceItem, { color: theme.secondaryText }]}>
              • Manual Survey: 97cbf1b8-31c2-4486-9edc-5a3d5d0c198c
            </Text>
            <Text style={[styles.referenceItem, { color: theme.secondaryText }]}>
              • Installation Survey: 0ea42103-2093-4d7f-a6a4-e4bc1321839d
            </Text>
            <Text style={[styles.referenceItem, { color: theme.secondaryText }]}>
              • Signed Contract: 09107d21-d594-4301-9d27-de95525bef11
            </Text>
            <Text style={[styles.referenceItem, { color: theme.secondaryText }]}>
              • Job Completed: cd193fdb-d5d6-490f-922f-f4478cfe49d1
            </Text>
          </View>

          {/* Quick Test Buttons for Key Stages */}
          <View style={styles.quickTestSection}>
            <Text style={[styles.quickTestTitle, { color: theme.primaryText }]}>Quick Test - Private Customers Pipeline Stages:</Text>
            
            <View style={styles.quickTestRow}>
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#10b981' }]} 
                onPress={() => {
                  setStageName('(AI Bot) Home Survey Booked');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>AI Bot Survey</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#3b82f6' }]} 
                onPress={() => {
                  setStageName('(Manual) Home Survey Booked');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>Manual Survey</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickTestRow}>
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#f59e0b' }]} 
                onPress={() => {
                  setStageName('Installation Survey Booked');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>Installation Survey</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#8b5cf6' }]} 
                onPress={() => {
                  setStageName('Signed Contract');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>Signed Contract</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickTestRow}>
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#ef4444' }]} 
                onPress={() => {
                  setStageName('Job Completed');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>Job Completed</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickTestButton, { backgroundColor: '#6b7280' }]} 
                onPress={() => {
                  setStageName('End Of Process');
                  handleGetOpportunitiesByStage();
                }}
                disabled={loading}
              >
                <Text style={styles.quickTestButtonText}>End Of Process</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Pipeline ID:</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.secondaryBackground, 
                borderColor: theme.cardBorder, 
                color: theme.primaryText 
              }]}
              value={pipelineId}
              onChangeText={setPipelineId}
              placeholder="Enter pipeline ID"
              placeholderTextColor={theme.tertiaryText}
            />
            <TouchableOpacity 
              style={[styles.testButton, { backgroundColor: theme.secondaryButton }]} 
              onPress={handleGetOpportunitiesByPipeline}
              disabled={loading}
            >
              <Text style={styles.testButtonText}>Get Opportunities by Pipeline</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Stage Name:</Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: theme.secondaryBackground, 
                borderColor: theme.cardBorder, 
                color: theme.primaryText 
              }]}
              value={stageName}
              onChangeText={setStageName}
              placeholder="Enter stage name"
              placeholderTextColor={theme.tertiaryText}
            />
            <TouchableOpacity 
              style={[styles.testButton, { backgroundColor: theme.successButton }]} 
              onPress={handleGetOpportunitiesByStage}
              disabled={loading}
            >
              <Text style={styles.testButtonText}>Get Opportunities by Stage</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.testButton, { backgroundColor: '#f59e0b' }]} 
              onPress={handleGetOpportunitiesByStageUnfiltered}
              disabled={loading}
            >
              <Text style={styles.testButtonText}>Get UNFILTERED Opportunities by Stage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
            <Text style={[styles.errorText, { color: theme.dangerButton }]}>Error: {error}</Text>
          </View>
        )}

        {/* Results */}
        {!loading && !error && data && (
          <>
            {renderStageInfo()}
            {renderPipelines()}
            {renderOpportunities()}
            {renderRawData()}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  testSection: {
    marginBottom: 32,
  },
  testButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickTestSection: {
    marginBottom: 24,
  },
  quickTestTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickTestRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickTestButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickTestButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  referenceSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  referenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  referenceItem: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  pipelineItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  pipelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pipelineDetails: {
    fontSize: 14,
    marginBottom: 2,
  },
  stagesContainer: {
    marginTop: 8,
  },
  stagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  stageItem: {
    fontSize: 12,
    marginLeft: 8,
    marginBottom: 2,
  },
  opportunityItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  opportunityDetails: {
    fontSize: 14,
    marginBottom: 2,
  },
  moreText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  stageInfoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  stageInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  stageInfoDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  rawDataContainer: {
    maxHeight: 300,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  rawDataText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
