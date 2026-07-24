import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import { useAuthReady } from '../hooks/useAuthReady';
import CalculatorProgressService from '../services/CalculatorProgressService';
import { api } from '../utils/api';
import {
  cleanLegacyWorkflowUrl,
  getCustomerDetailsFromRouteParams,
  mergeWorkflowRouteParams,
  parseJsonParam,
  resolveOpportunityIdFromRoute,
} from '../utils/deepLinkParams';
import {
  V44_QUESTIONS_GROUP_IDS,
  V44RadioGroup,
  defaultRadios,
  isBatterySavingsOptionDisabled,
  questionGroupOptions,
  radiosFromProgress,
  radiosToProgress,
} from '../utils/v44Logic';

type RouteParams = {
  opportunityId: string;
  customerDetails?: {
    customerName: string;
    address: string;
    postcode: string;
  };
  calculatorType?: 'v44';
  pendingRadios?: Record<string, number>;
};

/**
 * Calculator Questions — replaces old Radio Buttons for the combined calculator.
 * App-owned gates; workbook is only written on Pricing submit.
 */
export default function V44CalculatorQuestionsScreen() {
  const { theme, isDark } = useTheme();
  const { isAuthReady, isLoading: authLoading, isAuthenticated } = useAuthReady();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mergedParamsRef = useRef(mergeWorkflowRouteParams(route.params as Record<string, unknown>));
  const opportunityId =
    resolveOpportunityIdFromRoute(route.params, 'calculator-questions') ?? '';

  useEffect(() => {
    cleanLegacyWorkflowUrl(
      typeof mergedParamsRef.current.calculatorType === 'string'
        ? mergedParamsRef.current.calculatorType
        : 'v44',
    );
  }, []);
  const routeCustomerRef = useRef(getCustomerDetailsFromRouteParams(mergedParamsRef.current));
  const pendingRadiosRef = useRef(parseJsonParam<Record<string, number>>(mergedParamsRef.current.pendingRadios));
  const isAuthReadyRef = useRef(isAuthReady);
  isAuthReadyRef.current = isAuthReady;
  const loadedOnceRef = useRef(false);
  const [customerDetails, setCustomerDetails] = useState<RouteParams['customerDetails']>(
    routeCustomerRef.current,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<V44RadioGroup[]>([]);
  const [radios, setRadios] = useState<Record<string, number>>({});
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedRadios, setSavedRadios] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    if (!isAuthReadyRef.current) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const schemaRes = await api.get<{
        success: boolean;
        radioGroups: V44RadioGroup[];
      }>('/calculator-testing/schema');
      if (!schemaRes.success || !schemaRes.data?.radioGroups) {
        throw new Error('Failed to load calculator schema');
      }
      const allGroups = schemaRes.data.radioGroups;
      setGroups(allGroups);

      const progress = await CalculatorProgressService.getProgress(opportunityId, 'v44');
      if (progress?.customerDetails) {
        setCustomerDetails(progress.customerDetails);
      } else if (routeCustomerRef.current) {
        setCustomerDetails(routeCustomerRef.current);
      }
      const restored = radiosFromProgress(progress?.radioButtonSelections, allGroups);
      if (pendingRadiosRef.current) {
        Object.assign(restored, pendingRadiosRef.current);
      }
      // If a previously saved selection is now disabled (e.g. Octopus Flux), reset it
      if (isBatterySavingsOptionDisabled(restored.battery_savings)) {
        const batteryGroup = allGroups.find((g) => g.id === 'battery_savings');
        restored.battery_savings = batteryGroup?.defaultValue ?? 1;
      }
      // Octopus Cosy tariff (3) is hidden — fall back to Single Rate
      if (restored.current_tariff === 3) {
        restored.current_tariff = 1;
      }
      // Approved flow always uses known annual usage. It is not a rep question.
      restored.usage_known = 1;
      setRadios(restored);

      const hasSavedQuestions =
        progress?.completedSteps?.['radio-buttons'] ||
        (progress?.radioButtonSelections?.battery_savings &&
          progress?.radioButtonSelections?.current_tariff);
      if (hasSavedQuestions) {
        setHasRestoredProgress(true);
        setSavedRadios({ ...restored });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!opportunityId) {
      setError('This calculator link is missing an opportunity ID.');
      setLoading(false);
      return;
    }
    if (isAuthReady) {
      load();
    }
  }, [authLoading, isAuthenticated, isAuthReady, opportunityId, load]);

  const questionGroups = groups.filter((g) =>
    (V44_QUESTIONS_GROUP_IDS as readonly string[]).includes(g.id),
  );

  const setRadio = (groupId: string, value: number) => {
    setRadios((prev) => ({ ...prev, [groupId]: value }));
  };

  const hasChanges = () => {
    if (!savedRadios) return false;
    for (const [key, value] of Object.entries(radios)) {
      if (savedRadios[key] !== value) return true;
    }
    for (const [key, value] of Object.entries(savedRadios)) {
      if (radios[key] !== value) return true;
    }
    return false;
  };

  const onSkip = () => {
    navigation.navigate('CalculatorInputs', {
      opportunityId,
      customerDetails,
      calculatorType: 'v44',
    });
  };

  const onContinue = async () => {
    if (!radios.battery_savings) {
      Alert.alert('Required', 'Please select what battery savings should be based on.');
      return;
    }
    if (!radios.current_tariff) {
      Alert.alert('Required', 'Please select the current tariff type.');
      return;
    }
    try {
      setSaving(true);
      const toSave = {
        ...radios,
        existing_solar: 2,
        installing_new_solar: 1,
        inverter_new: 1,
        usage_known: 1,
      };
      await CalculatorProgressService.saveProgress(opportunityId, 'v44', {
        currentStep: 'radio-buttons',
        radioButtonSelections: radiosToProgress(toSave),
        customerDetails,
        templateSelection: {
          selectedOptions: {
            solar: true,
            battery: true,
            solarHybrid: false,
            batteryInverter: false,
          },
          templateFileName:
            'EPVS Member Calculator v4.4 - (Creativ) 15th June 2026 (1).xlsm',
        },
        completedSteps: {
          'template-selection': true,
          'radio-buttons': true,
        },
      });

      setHasRestoredProgress(true);
      setSavedRadios({ ...toSave });

      navigation.navigate('CalculatorInputs', {
        opportunityId,
        customerDetails,
        calculatorType: 'v44',
        pendingRadios: toSave,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading && !loadedOnceRef.current) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={{ color: theme.secondaryText, marginTop: 12 }}>
            Signing in…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.center}>
          <Text style={{ color: theme.primaryText, textAlign: 'center', marginBottom: 12 }}>
            Please log in to open this calculator link.
          </Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.retry}>
            <Text style={{ color: theme.primaryButton }}>Go to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={{ color: theme.secondaryText, marginTop: 12 }}>
            Loading questions…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.center}>
          <Text style={{ color: theme.dangerButton, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retry}>
            <Text style={{ color: theme.primaryButton }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden' as any,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Calculator Questions
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Controls which input fields appear next
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.customerInfoContainer, { borderTopColor: theme.cardBorder }]}>
          <View style={styles.customerInfoLeft}>
            <Feather name="user" size={16} color={theme.primaryButton} />
            <Text style={[styles.customerName, { color: theme.primaryText }]}>
              {customerDetails?.customerName || 'Customer'}
            </Text>
          </View>
          <View style={styles.customerInfoRight}>
            <Feather name="map-pin" size={16} color={theme.secondaryText} />
            <Text style={[styles.customerPostcode, { color: theme.secondaryText }]}>
              {customerDetails?.postcode || '—'}
            </Text>
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={[
            styles.scrollView,
            Platform.OS === 'web' && {
              height: '100%',
              maxHeight: '100%',
            },
          ]}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          nestedScrollEnabled
          scrollEnabled
          bounces={Platform.OS !== 'web'}
          alwaysBounceVertical={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS !== 'web'}
          contentContainerStyle={[
            styles.content,
            Platform.OS === 'web' && {
              minHeight: '100%' as any,
              paddingBottom: 120,
            },
          ]}
        >
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            These answers control which input fields appear on the next step.
          </Text>

          {questionGroups.map((group) => {
            const options = questionGroupOptions(group, radios);
            const selected = radios[group.id] ?? group.defaultValue;
            return (
              <View
                key={group.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.question, { color: theme.primaryText }]}>
                  {group.question}
                </Text>
                {options.map((opt) => {
                  const active = selected === opt.value;
                  const disabled =
                    group.id === 'battery_savings' &&
                    isBatterySavingsOptionDisabled(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.option,
                        {
                          borderColor: active ? theme.primaryButton : theme.cardBorder,
                          backgroundColor: active
                            ? theme.primaryButton + '18'
                            : theme.inputBackground,
                          opacity: disabled ? 0.45 : 1,
                        },
                      ]}
                      onPress={() => setRadio(group.id, opt.value)}
                      disabled={disabled}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: active ? theme.primaryButton : theme.secondaryText },
                        ]}
                      >
                        {active ? (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: theme.primaryButton },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, { color: theme.primaryText }]}>
                          {group.id === 'battery_savings' && opt.value === 3
                            ? 'Octopus Flux'
                            : opt.label}
                        </Text>
                        {disabled ? (
                          <Text
                            style={[styles.optionHint, { color: theme.secondaryText }]}
                          >
                            Not available yet
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

          {radios.battery_savings &&
          radios.current_tariff &&
          hasRestoredProgress &&
          savedRadios &&
          !hasChanges() ? (
            <TouchableOpacity
              style={[
                styles.skipButton,
                {
                  borderColor: theme.dangerButton,
                  backgroundColor: theme.dangerButton + '10',
                },
              ]}
              onPress={onSkip}
              activeOpacity={0.8}
            >
              <Feather name="skip-forward" size={16} color={theme.dangerButton} />
              <Text style={[styles.skipButtonText, { color: theme.dangerButton }]}>
                Skip
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.continue,
              { backgroundColor: theme.primaryButton, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={onContinue}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueText}>Continue to Inputs</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <BottomNavigation />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollView: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
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
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    marginRight: 16,
  },
  headerTextContainer: { flex: 1 },
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
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  customerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  customerPostcode: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  question: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  continue: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retry: { marginTop: 16 },
});
