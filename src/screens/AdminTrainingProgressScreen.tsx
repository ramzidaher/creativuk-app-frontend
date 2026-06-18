import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import { useTheme } from '../context/ThemeContext';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { TrainingProgram, TrainingScenario, trainingApi } from '../utils/api';

const SCENARIO_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e',
};

interface RouteParams {
  programId: string;
}

const AdminTrainingProgressScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { programId } = route.params as RouteParams;
  const permissions = useAdminPermissions();

  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingReview, setSavingReview] = useState<string | null>(null);

  const loadProgram = useCallback(async () => {
    try {
      const res = await trainingApi.getProgram(programId);
      if (res.success && res.data) {
        setProgram(res.data as TrainingProgram);
      } else {
        Alert.alert('Error', res.error || 'Failed to load program.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load training program.');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useFocusEffect(
    useCallback(() => {
      loadProgram();
    }, [loadProgram]),
  );

  const handleReview = async (scenario: TrainingScenario) => {
    setSavingReview(scenario.id);
    try {
      const res = await trainingApi.reviewScenario(scenario.id, reviewNotes[scenario.id] || undefined);
      if (res.success) {
        Alert.alert('Saved', 'Review notes saved.');
        loadProgram();
      } else {
        Alert.alert('Error', res.error || 'Failed to save review.');
      }
    } finally {
      setSavingReview(null);
    }
  };

  const handleCancelProgram = () => {
    if (!program || program.status !== 'ACTIVE') return;
    Alert.alert('Cancel program', 'Cancel this active training program?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel program',
        style: 'destructive',
        onPress: async () => {
          const res = await trainingApi.cancelProgram(program.id);
          if (res.success) {
            Alert.alert('Cancelled', 'Training program cancelled.');
            navigation.goBack();
          } else {
            Alert.alert('Error', res.error || 'Failed to cancel.');
          }
        },
      },
    ]);
  };

  if (!permissions.isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <AdminGuard showAlert={false}>
          <View />
        </AdminGuard>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as const,
          maxHeight: '100vh' as const,
          overflow: 'hidden' as const,
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Training Progress</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            {program?.user?.name || 'Loading...'}
          </Text>
        </View>
        {program?.status === 'ACTIVE' && (
          <TouchableOpacity onPress={handleCancelProgram}>
            <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading || !program ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
        </View>
      ) : (
        <View
          style={[
            styles.scrollHost,
            Platform.OS === 'web' && {
              height: 'calc(100vh - 120px)' as const,
              overflow: 'hidden' as const,
            },
          ]}
        >
          <ScrollView
            style={[
              styles.scrollView,
              Platform.OS === 'web' && {
                height: '100%' as const,
                maxHeight: '100%' as const,
              },
            ]}
            contentContainerStyle={[
              styles.scrollContent,
              Platform.OS === 'web' && { flexGrow: 1, paddingBottom: 100 },
            ]}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            nestedScrollEnabled
            scrollEnabled
            bounces={Platform.OS !== 'web'}
            alwaysBounceVertical={Platform.OS !== 'web'}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS !== 'web'}
          >
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
              {program.summary?.completedScenarios ?? 0} / {program.summary?.totalScenarios ?? 5} complete
            </Text>
            <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${program.summary?.progressPercent ?? 0}%`,
                    backgroundColor: theme.primaryButton,
                  },
                ]}
              />
            </View>
            <Text style={[styles.summaryMeta, { color: theme.secondaryText }]}>
              Status: {program.status} · Started {new Date(program.startedAt).toLocaleDateString()}
            </Text>
          </View>

          {program.scenarios.map((scenario) => {
            const data = scenario.scenarioData as Record<string, any>;
            const wp = scenario.workflowProgress;
            return (
              <View
                key={scenario.id}
                style={[styles.scenarioCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
              >
                <View style={styles.scenarioHeader}>
                  <Text style={[styles.scenarioTitle, { color: theme.primaryText }]}>
                    Scenario {scenario.scenarioNumber}: {data?.customerName || 'Customer'}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: SCENARIO_STATUS_COLORS[scenario.status] + '22' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: SCENARIO_STATUS_COLORS[scenario.status] }]}>
                      {scenario.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.scenarioDetail, { color: theme.secondaryText }]}>
                  {data?.address}
                </Text>
                {wp?.currentStepLabel && (
                  <Text style={[styles.workflowStep, { color: theme.primaryButton }]}>
                    Workflow: {wp.currentStepLabel} (step {wp.currentStep})
                  </Text>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: theme.cardBorder }]}
                    onPress={() =>
                      navigation.navigate('WorkflowOverrideAdmin', {
                        opportunityId: scenario.opportunityId,
                      })
                    }
                  >
                    <Feather name="tool" size={14} color={theme.primaryText} />
                    <Text style={[styles.actionBtnText, { color: theme.primaryText }]}>Override</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: theme.cardBorder }]}
                    onPress={() =>
                      navigation.navigate('SolarWorkflow', { opportunityId: scenario.opportunityId })
                    }
                  >
                    <Feather name="play" size={14} color={theme.primaryText} />
                    <Text style={[styles.actionBtnText, { color: theme.primaryText }]}>View workflow</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.notesInput,
                    { color: theme.primaryText, borderColor: theme.cardBorder, backgroundColor: theme.primaryBackground },
                  ]}
                  placeholder="Admin review notes..."
                  placeholderTextColor={theme.secondaryText}
                  value={reviewNotes[scenario.id] ?? scenario.adminNotes ?? ''}
                  onChangeText={(t) => setReviewNotes((prev) => ({ ...prev, [scenario.id]: t }))}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.saveReviewBtn, { backgroundColor: theme.primaryButton }]}
                  disabled={savingReview === scenario.id}
                  onPress={() => handleReview(scenario)}
                >
                  {savingReview === scenario.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveReviewText}>
                      {scenario.adminReviewedAt ? 'Update review' : 'Mark reviewed'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollHost: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  summaryTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  summaryMeta: { fontSize: 13, marginTop: 8 },
  scenarioCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  scenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  scenarioTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  scenarioDetail: { fontSize: 13, marginTop: 6 },
  workflowStep: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  notesInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  saveReviewBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveReviewText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

export default AdminTrainingProgressScreen;
