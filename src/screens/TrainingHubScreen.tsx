import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TRAINING_HOW_TO_GUIDES,
  TRAINING_SCENARIO_TEMPLATES,
  TRAINING_TARIFF_REFERENCE,
  TrainingHowToGuide,
  TrainingScenarioTemplate,
} from '../constants/trainingScenarios';
import { useTheme } from '../context/ThemeContext';
import { TrainingProgram, TrainingScenario, trainingApi, workflowApi } from '../utils/api';

const SCENARIO_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e',
};

const TrainingHubScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [startingScenario, setStartingScenario] = useState<string | null>(null);

  const openGuideUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Cannot open link', url);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open this guide link.');
    }
  };

  const handleGuidePress = (guide: TrainingHowToGuide) => {
    if (guide.url) {
      openGuideUrl(guide.url);
    }
  };

  const loadProgram = useCallback(async () => {
    try {
      const res = await trainingApi.getMyProgram();
      if (res.success && res.data) {
        const data = res.data as { program: TrainingProgram | null };
        setProgram(data.program ?? null);
      }
    } catch (e) {
      console.error('TrainingHub load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgram();
    }, [loadProgram]),
  );

  const handleStartScenario = async (scenario: TrainingScenario) => {
    setStartingScenario(scenario.opportunityId);
    try {
      const progressRes = await workflowApi.getOpportunityProgress(scenario.opportunityId);
      if (!progressRes.success || !progressRes.data) {
        const startRes = await workflowApi.startOpportunity(scenario.opportunityId);
        if (!startRes.success) {
          Alert.alert('Error', startRes.error || 'Could not start workflow.');
          return;
        }
      }
      navigation.navigate('SolarWorkflow', { opportunityId: scenario.opportunityId });
    } catch (e) {
      Alert.alert('Error', 'Failed to start training appointment.');
    } finally {
      setStartingScenario(null);
    }
  };

  const renderScenarioHints = (template: TrainingScenarioTemplate) => (
    <View style={styles.hints}>
      <Text style={[styles.hintLine, { color: theme.secondaryText }]}>
        {template.hasEnergyBill ? 'Has energy bill' : 'No energy bill — use 25p/kWh capped rate'}
      </Text>
      {template.currentRatePence != null && (
        <Text style={[styles.hintLine, { color: theme.secondaryText }]}>
          Current rate: {template.currentRatePence}p/kWh single rate
        </Text>
      )}
      {template.annualUsageKwh != null && (
        <Text style={[styles.hintLine, { color: theme.secondaryText }]}>
          Annual usage: {template.annualUsageKwh.toLocaleString()} kWh
        </Text>
      )}
      {template.usageCalculationHint && (
        <Text style={[styles.hintLine, { color: theme.secondaryText }]}>
          Usage: {template.usageCalculationHint}
        </Text>
      )}
      <Text style={[styles.hintLine, { color: theme.secondaryText }]}>
        {template.propertyType} · Single-phase · {template.address}
      </Text>
      <Text style={[styles.hintNotes, { color: theme.secondaryText }]}>{template.scenarioNotes}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>My Training</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Practice appointments with guided scenarios
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
        </View>
      ) : !program ? (
        <View style={styles.centered}>
          <Feather name="book-open" size={48} color={theme.secondaryText} />
          <Text style={[styles.emptyTitle, { color: theme.primaryText }]}>No active training</Text>
          <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
            Your admin will start a training program for you. Check back here once enrolled.
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProgram(); }} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
              Progress: {program.summary?.completedScenarios ?? 0}/{program.summary?.totalScenarios ?? 5}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${program.summary?.progressPercent ?? 0}%`, backgroundColor: theme.primaryButton },
                ]}
              />
            </View>
          </View>

          <View style={[styles.tariffCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
              New Tariff — {TRAINING_TARIFF_REFERENCE.supplier}
            </Text>
            <Text style={[styles.tariffSection, { color: theme.secondaryText }]}>Current electricity</Text>
            <Text style={[styles.tariffLine, { color: theme.primaryText }]}>
              {TRAINING_TARIFF_REFERENCE.currentElectricity.withBill}
            </Text>
            <Text style={[styles.tariffLine, { color: theme.primaryText }]}>
              {TRAINING_TARIFF_REFERENCE.currentElectricity.withoutBill}
            </Text>
            <Text style={[styles.tariffSection, { color: theme.secondaryText, marginTop: 10 }]}>
              New electricity — Single rate
            </Text>
            <Text style={[styles.tariffLine, { color: theme.primaryText }]}>
              Day: {TRAINING_TARIFF_REFERENCE.newElectricity.singleRate.dayRatePence}p/kWh · Night (7h):{' '}
              {TRAINING_TARIFF_REFERENCE.newElectricity.singleRate.nightRatePence}p/kWh
            </Text>
            <Text style={[styles.tariffSection, { color: theme.secondaryText, marginTop: 8 }]}>
              New electricity — Dual rate
            </Text>
            <Text style={[styles.tariffLine, { color: theme.primaryText }]}>
              Day: {TRAINING_TARIFF_REFERENCE.newElectricity.dualRate.dayRatePence}p/kWh · Night (7h):{' '}
              {TRAINING_TARIFF_REFERENCE.newElectricity.dualRate.nightRatePence}p/kWh
            </Text>
            <Text style={[styles.tariffLine, { color: theme.primaryText, marginTop: 8 }]}>
              Export: {TRAINING_TARIFF_REFERENCE.newElectricity.exportRatePence}p/kWh
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>How-to guides</Text>
          {TRAINING_HOW_TO_GUIDES.map((guide) => (
            <View
              key={guide.id}
              style={[styles.guideCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            >
              <TouchableOpacity style={styles.guideHeader} onPress={() => handleGuidePress(guide)}>
                <View style={styles.guideHeaderText}>
                  <Text style={[styles.guideTitle, { color: theme.primaryText }]}>{guide.title}</Text>
                  <Text style={[styles.guideDescription, { color: theme.secondaryText }]}>{guide.description}</Text>
                </View>
                <Feather name="external-link" size={18} color={theme.primaryButton} />
              </TouchableOpacity>

              {guide.url && (
                <TouchableOpacity
                  style={[styles.guideLinkButton, { borderColor: theme.primaryButton }]}
                  onPress={() => openGuideUrl(guide.url!)}
                >
                  <Feather name="external-link" size={14} color={theme.primaryButton} />
                  <Text style={[styles.guideLinkText, { color: theme.primaryButton }]}>Open guide</Text>
                </TouchableOpacity>
              )}

              {guide.links?.map((link) => (
                <TouchableOpacity
                  key={link.url}
                  style={[styles.guideLinkButton, { borderColor: theme.primaryButton }]}
                  onPress={() => openGuideUrl(link.url)}
                >
                  <Feather name="external-link" size={14} color={theme.primaryButton} />
                  <Text style={[styles.guideLinkText, { color: theme.primaryButton }]}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: theme.primaryText, marginTop: 8 }]}>
            Test scenarios
          </Text>
          {program.scenarios.map((scenario) => {
            const template =
              TRAINING_SCENARIO_TEMPLATES.find((t) => t.scenarioNumber === scenario.scenarioNumber) ||
              (scenario.scenarioData as TrainingScenarioTemplate);
            const wp = scenario.workflowProgress;
            return (
              <View
                key={scenario.id}
                style={[styles.scenarioCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
              >
                <View style={styles.scenarioHeader}>
                  <Text style={[styles.scenarioTitle, { color: theme.primaryText }]}>
                    {scenario.scenarioNumber}. {template.customerName}
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
                {renderScenarioHints(template)}
                {wp?.currentStepLabel && scenario.status === 'IN_PROGRESS' && (
                  <Text style={[styles.workflowStep, { color: theme.primaryButton }]}>
                    Current step: {wp.currentStepLabel}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: theme.primaryButton }]}
                  disabled={startingScenario === scenario.opportunityId || scenario.status === 'COMPLETED'}
                  onPress={() => handleStartScenario(scenario)}
                >
                  {startingScenario === scenario.opportunityId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.startBtnText}>
                      {scenario.status === 'COMPLETED' ? 'Completed' : 'Start appointment'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  tariffCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  tariffSection: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tariffLine: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  guideCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  guideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  guideHeaderText: { flex: 1 },
  guideTitle: { fontSize: 14, fontWeight: '600' },
  guideDescription: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  guideLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  guideLinkText: { fontSize: 13, fontWeight: '600', flex: 1 },
  scenarioCard: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  scenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  scenarioTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  hints: { marginTop: 8 },
  hintLine: { fontSize: 13, lineHeight: 18 },
  hintNotes: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  workflowStep: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  startBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

export default TrainingHubScreen;
