import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
import CalculatorProgressService from '../services/CalculatorProgressService';
import { api } from '../utils/api';
import {
  V44_QUESTIONS_GROUP_IDS,
  V44RadioGroup,
  defaultRadios,
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
};

/**
 * Calculator Questions — replaces old Radio Buttons for the combined calculator.
 * App-owned gates; workbook is only written on Pricing submit.
 */
export default function V44CalculatorQuestionsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { opportunityId } = route.params as RouteParams;
  const routeCustomer = (route.params as RouteParams).customerDetails;
  const [customerDetails, setCustomerDetails] = useState<RouteParams['customerDetails']>(routeCustomer);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<V44RadioGroup[]>([]);
  const [radios, setRadios] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
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
      } else if (routeCustomer) {
        setCustomerDetails(routeCustomer);
      }
      const restored = radiosFromProgress(progress?.radioButtonSelections, allGroups);
      setRadios(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [opportunityId, routeCustomer]);

  useEffect(() => {
    load();
  }, [load]);

  const questionGroups = groups.filter((g) =>
    (V44_QUESTIONS_GROUP_IDS as readonly string[]).includes(g.id),
  );

  const setRadio = (groupId: string, value: number) => {
    setRadios((prev) => ({ ...prev, [groupId]: value }));
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
    if (!radios.usage_known) {
      Alert.alert('Required', "Please select whether you know the customer's annual usage.");
      return;
    }

    try {
      setSaving(true);
      const toSave = {
        ...radios,
        installing_new_solar: 1,
        inverter_new: 1,
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

      navigation.navigate('CalculatorInputs', {
        opportunityId,
        customerDetails,
        calculatorType: 'v44',
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
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
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
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
            const options = questionGroupOptions(group);
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
                        },
                      ]}
                      onPress={() => setRadio(group.id, opt.value)}
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
                    <Text style={[styles.optionLabel, { color: theme.primaryText }]}>
                        {group.id === 'battery_savings' && opt.value === 3
                          ? 'Octopus Flux'
                          : opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}

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
  optionLabel: { fontSize: 15, flex: 1 },
  continue: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retry: { marginTop: 16 },
});
