import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminWorkflowOverrideApi } from '../utils/api';
import {
  fillSingleFieldPlaceholderImages,
  fillSurveyWithPlaceholderImages,
} from '../utils/surveyPlaceholderImages';

type WorkflowStep = {
  stepNumber: number;
  stepType: string;
  title: string;
  status: string;
  completedAt: string | null;
};

type WorkflowDisplayStep = {
  displayStepNumber: number;
  backendStepNumber: number | null;
  stepType: string;
  title: string;
  description?: string;
  status: string;
  completedAt: string | null;
  isVirtual: boolean;
};

type ImageFieldRow = {
  field: string;
  page: string;
  minRequired: number;
  count: number;
  satisfied: boolean;
  skipWhenNoEnergyBill?: boolean;
};

type DisclaimerDisplayMode = 'auto' | 'show' | 'hide';

type Overview = {
  opportunityId: string;
  workflow: {
    currentStep: number;
    status: string;
    needsDisclaimer?: boolean;
    disclaimerDisplayOverride?: 'show' | 'hide' | null;
    effectiveNeedsDisclaimer?: boolean;
    owner?: { name?: string; email?: string };
    /** All persisted backend workflow steps (primary admin list). */
    steps: WorkflowStep[];
    /** Seller-app display order including virtual disclaimer when applicable. */
    displaySteps?: WorkflowDisplayStep[];
  } | null;
  survey: {
    status: string;
    hasEnergyBill: boolean;
    hasEnergyBillAnswer?: string | null;
    totalImages: number;
    allImagesSatisfied: boolean;
    missingImageFields: string[];
    imageFields: ImageFieldRow[];
  } | null;
  calculator: Array<{
    calculatorType: string;
    currentStep: string;
    customerName?: string | null;
  }>;
};

const SURVEY_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function normalizeWorkflowOverview(data: Overview): Overview {
  const workflow = data?.workflow;
  if (workflow && !workflow.steps?.length && workflow.displaySteps?.length) {
    workflow.steps = workflow.displaySteps
      .filter((s) => s.backendStepNumber != null)
      .map((s) => ({
        stepNumber: s.backendStepNumber as number,
        stepType: s.stepType,
        title: s.title,
        status: s.status,
        completedAt: s.completedAt,
      }));
  }
  return data;
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

export default function WorkflowOverrideAdminScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const isAdmin = user?.role === 'ADMIN';
  const [opportunityId, setOpportunityId] = useState('');
  const [skipEnergyBill, setSkipEnergyBill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  const loadOverview = useCallback(async (id?: string) => {
    const trimmed = (id ?? opportunityId).trim();
    if (!trimmed) {
      Alert.alert('Opportunity ID required', 'Enter a GHL or manual opportunity ID.');
      return;
    }
    setLoading(true);
    try {
      const res = await adminWorkflowOverrideApi.getOverview(trimmed);
      if (!res.success) {
        throw new Error(res.error || 'Failed to load overview');
      }
      setOverview(normalizeWorkflowOverview(res.data as Overview));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load opportunity');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try {
      await fn();
      await loadOverview();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnsureWorkflow = () =>
    runAction('ensure', async () => {
      const id = opportunityId.trim();
      const res = await adminWorkflowOverrideApi.ensureWorkflow(id);
      if (!res.success) throw new Error(res.error);
      setOverview(normalizeWorkflowOverview(res.data as Overview));
    });

  const handleMarkDisclaimerComplete = async () => {
    const ok = await confirmAction(
      'Mark disclaimer complete?',
      'Marks the Energy Bill Disclaimer as completed for this opportunity.',
    );
    if (!ok) return;
    await runAction('disclaimer-step', async () => {
      const res = await adminWorkflowOverrideApi.markDisclaimerComplete(opportunityId.trim());
      if (!res.success) throw new Error(res.error);
    });
  };

  const handleCompleteBackendStep = async (stepNumber: number, title: string) => {
    const ok = await confirmAction(
      `Mark step ${stepNumber} complete?`,
      `This will mark "${title}" as completed for opportunity ${opportunityId.trim()}.`,
    );
    if (!ok) return;
    await runAction(`step-${stepNumber}`, async () => {
      const res = await adminWorkflowOverrideApi.completeStep(opportunityId.trim(), stepNumber);
      if (!res.success) throw new Error(res.error);
    });
  };

  const handleMarkSurveyComplete = async () => {
    const ok = await confirmAction(
      'Complete survey workflow step?',
      'Sets survey status to APPROVED and marks workflow step 1 (Survey) as complete.',
    );
    if (!ok) return;
    await runAction('survey-step', async () => {
      const res = await adminWorkflowOverrideApi.markSurveyComplete(opportunityId.trim());
      if (!res.success) throw new Error(res.error);
    });
  };

  const handleMarkCalculatorComplete = async () => {
    const calcType = overview?.calculator?.[0]?.calculatorType || 'off-peak';
    const ok = await confirmAction(
      'Complete calculator workflow step?',
      `Marks workflow step 3 (Calculator) as complete with type "${calcType}".`,
    );
    if (!ok) return;
    await runAction('calc-step', async () => {
      const res = await adminWorkflowOverrideApi.markCalculatorComplete(
        opportunityId.trim(),
        calcType,
      );
      if (!res.success) throw new Error(res.error);
    });
  };

  const handleSetDisclaimerDisplay = async (mode: DisclaimerDisplayMode) => {
    const labels: Record<DisclaimerDisplayMode, string> = {
      auto: 'follow the survey energy-bill answer',
      show: 'always show the disclaimer step',
      hide: 'always hide the disclaimer step',
    };
    const ok = await confirmAction(
      'Change disclaimer step display?',
      `This will ${labels[mode]} for opportunity ${opportunityId.trim()}, overriding normal rules.`,
    );
    if (!ok) return;
    await runAction(`disclaimer-display-${mode}`, async () => {
      const res = await adminWorkflowOverrideApi.setDisclaimerDisplay(
        opportunityId.trim(),
        mode,
      );
      if (!res.success) throw new Error(res.error);
    });
  };

  const disclaimerMode: DisclaimerDisplayMode =
    overview?.workflow?.disclaimerDisplayOverride === 'show'
      ? 'show'
      : overview?.workflow?.disclaimerDisplayOverride === 'hide'
        ? 'hide'
        : 'auto';

  const showDisclaimerInApp =
    disclaimerMode === 'show' ||
    (disclaimerMode === 'auto' &&
      (overview?.workflow?.effectiveNeedsDisclaimer ??
        overview?.workflow?.needsDisclaimer ??
        false));

  const virtualDisclaimerStep = overview?.workflow?.displaySteps?.find(
    (s) => s.stepType === 'DISCLAIMER_SIGNING' && s.isVirtual,
  );
  const disclaimerInBackendSteps = overview?.workflow?.steps?.some(
    (s) => s.stepType === 'DISCLAIMER_SIGNING',
  );

  const handleSetSurveyStatus = async (status: string) => {
    const ok = await confirmAction('Change survey status?', `Set survey status to ${status}.`);
    if (!ok) return;
    await runAction(`status-${status}`, async () => {
      const res = await adminWorkflowOverrideApi.setSurveyStatus(opportunityId.trim(), status);
      if (!res.success) throw new Error(res.error);
    });
  };

  const handleFillAllPlaceholders = async () => {
    const ok = await confirmAction(
      'Fill all placeholder images?',
      'Uploads placeholder photos to every required survey image field.',
    );
    if (!ok) return;
    await runAction('fill-all', async () => {
      const result = await fillSurveyWithPlaceholderImages(opportunityId.trim(), {
        skipEnergyBill,
        includeEvFields: true,
      });
      if (!result.success && result.errors.length) {
        throw new Error(result.errors.join('\n'));
      }
    });
  };

  const handleFillField = async (field: string, minRequired: number) => {
    await runAction(`fill-${field}`, async () => {
      const result = await fillSingleFieldPlaceholderImages(
        opportunityId.trim(),
        field,
        minRequired,
      );
      if (!result.success) throw new Error(result.error || 'Upload failed');
    });
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.denied}>
          <Text style={{ color: theme.primaryText }}>Admin access required.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={{ color: theme.primaryButton }}>Go back</Text>
          </TouchableOpacity>
        </View>
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
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.secondaryText} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Workflow Override</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Mark steps done, fix survey images
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.scrollHost,
          Platform.OS === 'web' && {
            height: 'calc(100vh - 72px)' as const,
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
          Platform.OS === 'web' && {
            flexGrow: 1,
            paddingBottom: 100,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled
        scrollEnabled
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        removeClippedSubviews={Platform.OS !== 'web'}
      >
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.label, { color: theme.primaryText }]}>Opportunity ID</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.cardBorder,
                color: theme.primaryText,
              },
            ]}
            value={opportunityId}
            onChangeText={setOpportunityId}
            placeholder="GHL ID or manual opportunity ID"
            placeholderTextColor={theme.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primaryButton, opacity: loading ? 0.7 : 1 }]}
            onPress={() => loadOverview()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Load opportunity</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {overview && !overview.workflow && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.warningText, { color: '#b45309' }]}>
              No workflow started for this opportunity.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primaryButton, marginTop: 12 }]}
              onPress={handleEnsureWorkflow}
              disabled={actionLoading === 'ensure'}
            >
              <Text style={styles.primaryButtonText}>Start workflow</Text>
            </TouchableOpacity>
          </View>
        )}

        {overview?.workflow && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Workflow steps</Text>
            <Text style={[styles.hint, { color: theme.secondaryText, marginBottom: 12 }]}>
              Current step {overview.workflow.currentStep} · {overview.workflow.status}
              {overview.workflow.owner?.name ? ` · ${overview.workflow.owner.name}` : ''}
              {disclaimerMode === 'show'
                ? ' · Disclaimer forced ON (admin)'
                : disclaimerMode === 'hide'
                  ? ' · Disclaimer forced OFF (admin)'
                  : overview.workflow.effectiveNeedsDisclaimer ??
                      overview.workflow.needsDisclaimer
                    ? ' · Disclaimer shown (survey: no energy bill)'
                    : overview.survey?.hasEnergyBillAnswer === 'Yes'
                      ? ' · Energy bill on file'
                      : ' · Disclaimer hidden (survey)'}
            </Text>

            <Text style={[styles.label, { color: theme.primaryText, marginBottom: 8 }]}>
              Disclaimer step display (overrides all)
            </Text>
            <Text style={[styles.hint, { color: theme.secondaryText, marginBottom: 10 }]}>
              Controls whether the Energy Bill Disclaimer appears in this workflow and in the
              seller app — regardless of survey answers.
            </Text>
            <View style={styles.modeRow}>
              {(
                [
                  { mode: 'auto' as const, label: 'Auto (survey)' },
                  { mode: 'show' as const, label: 'Force show' },
                  { mode: 'hide' as const, label: 'Force hide' },
                ] as const
              ).map(({ mode, label }) => {
                const selected = disclaimerMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeChip,
                      {
                        borderColor: selected ? theme.primaryButton : theme.cardBorder,
                        backgroundColor: selected ? theme.primaryButton + '18' : 'transparent',
                      },
                    ]}
                    onPress={() => handleSetDisclaimerDisplay(mode)}
                    disabled={!!actionLoading || selected}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: selected ? '700' : '500',
                        color: selected ? theme.primaryButton : theme.secondaryText,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {showDisclaimerInApp && (
              <View style={[styles.disclaimerActionsRow, { borderColor: theme.cardBorder }]}>
                <TouchableOpacity
                  style={[styles.smallButtonOutline, { borderColor: theme.primaryButton }]}
                  onPress={() =>
                    navigation.navigate('DisclaimerSigning', {
                      opportunityId: opportunityId.trim(),
                    })
                  }
                >
                  <Text style={[styles.smallButtonOutlineText, { color: theme.primaryButton }]}>
                    Open disclaimer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: theme.primaryButton }]}
                  onPress={handleMarkDisclaimerComplete}
                  disabled={actionLoading === 'disclaimer-step'}
                >
                  {actionLoading === 'disclaimer-step' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.smallButtonText}>Mark disclaimer done</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {(overview.workflow.steps ?? []).map((step) => {
              const isDone = step.status === 'COMPLETED';
              const busy = actionLoading === `step-${step.stepNumber}`;
              return (
                <View
                  key={`backend-${step.stepNumber}-${step.stepType}`}
                  style={[styles.stepRow, { borderColor: theme.cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: theme.primaryText }]}>
                      {step.stepNumber}. {step.title}
                    </Text>
                    <Text style={[styles.stepMeta, { color: theme.secondaryText }]}>
                      {step.status}
                      {step.completedAt
                        ? ` · ${new Date(step.completedAt).toLocaleDateString()}`
                        : ''}
                    </Text>
                  </View>
                  {!isDone && (
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => handleCompleteBackendStep(step.stepNumber, step.title)}
                      disabled={!!actionLoading}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.smallButtonText}>Done</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {isDone && <Feather name="check-circle" size={22} color="#16a34a" />}
                </View>
              );
            })}

            {showDisclaimerInApp && virtualDisclaimerStep && !disclaimerInBackendSteps && (
              <View
                key="virtual-disclaimer"
                style={[styles.stepRow, { borderColor: theme.cardBorder }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: theme.primaryText }]}>
                    {virtualDisclaimerStep.displayStepNumber}. {virtualDisclaimerStep.title}{' '}
                    (disclaimer — seller app only)
                  </Text>
                  <Text style={[styles.stepMeta, { color: theme.secondaryText }]}>
                    {virtualDisclaimerStep.status}
                    {virtualDisclaimerStep.completedAt
                      ? ` · ${new Date(virtualDisclaimerStep.completedAt).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
                {virtualDisclaimerStep.status !== 'COMPLETED' && (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: theme.primaryButton }]}
                    onPress={handleMarkDisclaimerComplete}
                    disabled={actionLoading === 'disclaimer-step'}
                  >
                    <Text style={styles.smallButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
                {virtualDisclaimerStep.status === 'COMPLETED' && (
                  <Feather name="check-circle" size={22} color="#16a34a" />
                )}
              </View>
            )}
          </View>
        )}

        {overview?.survey && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Survey</Text>
            <Text style={[styles.hint, { color: theme.secondaryText }]}>
              Status: {overview.survey.status} · {overview.survey.totalImages} images in DB
              {!overview.survey.allImagesSatisfied &&
                ` · ${overview.survey.missingImageFields.length} field(s) short`}
            </Text>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.chip, { borderColor: theme.primaryButton }]}
                onPress={handleMarkSurveyComplete}
                disabled={!!actionLoading}
              >
                <Text style={[styles.chipText, { color: theme.primaryButton }]}>
                  Approve + complete step 1
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, { borderColor: theme.cardBorder }]}
                onPress={() =>
                  navigation.navigate('Survey', { opportunityId: opportunityId.trim() })
                }
              >
                <Text style={[styles.chipText, { color: theme.primaryButton }]}>Open survey</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.primaryText, marginTop: 12 }]}>Set status</Text>
            <View style={styles.statusRow}>
              {SURVEY_STATUSES.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusChip,
                    {
                      borderColor:
                        overview.survey?.status === status
                          ? theme.primaryButton
                          : theme.cardBorder,
                      backgroundColor:
                        overview.survey?.status === status
                          ? theme.primaryButton + '18'
                          : 'transparent',
                    },
                  ]}
                  onPress={() => handleSetSurveyStatus(status)}
                  disabled={!!actionLoading}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color:
                        overview.survey?.status === status
                          ? theme.primaryButton
                          : theme.secondaryText,
                    }}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.hint, { color: theme.secondaryText, flex: 1 }]}>
                Skip energy bill when filling placeholders
              </Text>
              <Switch
                value={skipEnergyBill}
                onValueChange={setSkipEnergyBill}
                trackColor={{ false: theme.cardBorder, true: theme.primaryButton }}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primaryButton, marginTop: 8 }]}
              onPress={handleFillAllPlaceholders}
              disabled={!!actionLoading}
            >
              <Feather name="image" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Fill all missing placeholders</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: theme.primaryText, marginTop: 16 }]}>
              Image fields
            </Text>
            {overview.survey.imageFields.map((row) => (
              <View
                key={row.field}
                style={[styles.imageRow, { borderColor: theme.cardBorder }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.imageFieldName, { color: theme.primaryText }]}>
                    {formatFieldName(row.field)}
                  </Text>
                  <Text style={[styles.stepMeta, { color: theme.secondaryText }]}>
                    {row.count}/{row.minRequired}
                    {row.skipWhenNoEnergyBill && !overview.survey?.hasEnergyBill ? ' · skipped' : ''}
                  </Text>
                </View>
                {row.satisfied ? (
                  <Feather name="check" size={20} color="#16a34a" />
                ) : (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: theme.primaryButton }]}
                    onPress={() => handleFillField(row.field, row.minRequired)}
                    disabled={!!actionLoading}
                  >
                    <Text style={styles.smallButtonText}>Fill</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {overview && !overview.survey && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.hint, { color: theme.secondaryText }]}>
              No survey record yet. Open the survey screen to create one, or fill placeholders (creates survey).
            </Text>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.cardBorder, marginTop: 12 }]}
              onPress={() =>
                navigation.navigate('Survey', { opportunityId: opportunityId.trim() })
              }
            >
              <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>
                Open survey
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {overview && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Calculator</Text>
            {overview.calculator.length === 0 ? (
              <Text style={[styles.hint, { color: theme.secondaryText }]}>
                No calculator progress saved yet.
              </Text>
            ) : (
              overview.calculator.map((calc) => (
                <Text
                  key={calc.calculatorType}
                  style={[styles.hint, { color: theme.secondaryText, marginBottom: 4 }]}
                >
                  {calc.calculatorType} · step: {calc.currentStep}
                  {calc.customerName ? ` · ${calc.customerName}` : ''}
                </Text>
              ))
            )}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primaryButton, marginTop: 12 }]}
              onPress={handleMarkCalculatorComplete}
              disabled={!!actionLoading}
            >
              <Text style={styles.primaryButtonText}>Complete calculator step (3)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.cardBorder, marginTop: 10 }]}
              onPress={() =>
                navigation.navigate('SolarWorkflow', { opportunityId: opportunityId.trim() })
              }
            >
              <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>
                Open workflow hub
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollHost: { flex: 1 },
  scrollView: { flex: 1 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backLink: { marginTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 18 },
  warningText: { fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  smallButtonOutline: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 52,
    alignItems: 'center',
  },
  smallButtonOutlineText: { fontSize: 13, fontWeight: '600' },
  stepTitle: { fontSize: 15, fontWeight: '500' },
  stepMeta: { fontSize: 12, marginTop: 2 },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statusChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disclaimerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  imageFieldName: { fontSize: 14, fontWeight: '500' },
});
