import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import CalculatorProgressService from '../services/CalculatorProgressService';
import { api } from '../utils/api';
import {
  V44Field,
  V44RadioGroup,
  V44Section,
  applyCascadeClear,
  applyNewTariffDefaults,
  fieldsClearedByRadioChange,
  isConsumptionField,
  isFieldVisible,
  isSectionVisible,
  radiosFromProgress,
  radiosToProgress,
  resolveFieldLabel,
  sortSectionsByExcelOrder,
} from '../utils/v44Logic';

type Equipment = {
  panels: Array<{ manufacturer: string; model: string; minWattage: number | null; maxWattage: number | null }>;
  batteries: Array<{ manufacturer: string; model: string; repVisible?: boolean }>;
  inverters: Array<{ manufacturer: string; model: string; repVisible?: boolean }>;
};

type RouteParams = {
  opportunityId: string;
  customerDetails?: { customerName: string; address: string; postcode: string };
  calculatorType?: 'v44';
};

/**
 * v4.4 Inputs — schema-driven show/hide/clear (Excel Toggle logic in the app).
 */
export default function V44CalculatorInputsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { opportunityId } = route.params as RouteParams;
  const routeCustomer = (route.params as RouteParams).customerDetails;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<V44Section[]>([]);
  const [groups, setGroups] = useState<V44RadioGroup[]>([]);
  const [consumptionMatrix, setConsumptionMatrix] = useState<Record<string, string[]>>({});
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [radios, setRadios] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [customerDetails, setCustomerDetails] = useState<RouteParams['customerDetails']>(routeCustomer);
  const [dropdown, setDropdown] = useState<{
    fieldId: string;
    label: string;
    options: string[];
  } | null>(null);
  const [fluxRatesStatus, setFluxRatesStatus] = useState<string | null>(null);
  const [fluxRatesLoading, setFluxRatesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, equipmentRes] = await Promise.all([
        api.get<{
          success: boolean;
          radioGroups: V44RadioGroup[];
          sections: V44Section[];
          consumptionMatrix: Record<string, string[]>;
        }>('/calculator-testing/schema'),
        api.get<Equipment & { success: boolean }>('/calculator-testing/equipment'),
      ]);
      if (!schemaRes.success || !schemaRes.data) throw new Error('Failed to load schema');
      if (!equipmentRes.success || !equipmentRes.data) throw new Error('Failed to load equipment');

      setGroups(schemaRes.data.radioGroups);
      setSections(sortSectionsByExcelOrder(schemaRes.data.sections));
      setConsumptionMatrix(schemaRes.data.consumptionMatrix || {});
      setEquipment(equipmentRes.data);

      const progress = await CalculatorProgressService.getProgress(opportunityId, 'v44');
      const restoredRadios = radiosFromProgress(
        progress?.radioButtonSelections,
        schemaRes.data.radioGroups,
      );
      setRadios(restoredRadios);

      const restoredInputs = { ...(progress?.dynamicInputs || {}) };
      if (progress?.customerDetails) {
        setCustomerDetails(progress.customerDetails);
        const c = progress.customerDetails;
        restoredInputs.customer_name = c.customerName || '';
        restoredInputs.address = c.address || '';
        restoredInputs.postcode = c.postcode || '';
      }
      // Prefill 100Green / export 12 / SC copy when empty (keep saved overrides)
      setInputs(applyNewTariffDefaults(restoredRadios, restoredInputs, { force: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const pullOctopusFluxRates = useCallback(
    async (force = false) => {
      const batterySavings = radios.battery_savings;
      if (batterySavings !== 3 && batterySavings !== 4) return;

      const postcode = customerDetails?.postcode?.trim();
      if (!postcode) {
        setFluxRatesStatus('Add a postcode in Customer Details to pull Flux rates.');
        return;
      }

      const variant = batterySavings === 4 ? 'intelligent' : 'standard';
      const alreadyFilled =
        variant === 'standard'
          ? !!(inputs.flux_day_rate_import && inputs.flux_standing_charge)
          : !!(inputs.if_peak_rate_import && inputs.if_standing_charge);
      if (!force && alreadyFilled) return;

      try {
        setFluxRatesLoading(true);
        setFluxRatesStatus('Pulling Octopus Flux rates…');
        const res = await api.get<{
          success: boolean;
          rates?: {
            parsed_rates?: {
              import?: { day: number; flux: number; peak: number };
              export?: { day: number; flux: number; peak: number };
              standing_charge?: number;
            };
          };
          error?: string;
          message?: string;
        }>(
          `/epvs-automation/flux-rates/${encodeURIComponent(postcode)}?variant=${variant}`,
        );

        const body = res.data;
        if (!res.success || !body?.rates?.parsed_rates) {
          setFluxRatesStatus(
            body?.error || body?.message || 'Could not fetch Flux rates',
          );
          return;
        }

        const rates = body.rates.parsed_rates;
        const round = (n: number) => (Math.round(n * 100) / 100).toString();

        setInputs((prev) => {
          const next = { ...prev };
          if (variant === 'standard' && rates.import && rates.export) {
            next.flux_day_rate_import = round(rates.import.day);
            next.flux_flux_rate_import = round(rates.import.flux);
            next.flux_peak_rate_import = round(rates.import.peak);
            next.flux_day_rate_export = round(rates.export.day);
            next.flux_flux_rate_export = round(rates.export.flux);
            next.flux_peak_rate_export = round(rates.export.peak);
            if (rates.standing_charge != null) {
              next.flux_standing_charge = round(rates.standing_charge);
            }
          } else if (variant === 'intelligent' && rates.import && rates.export) {
            next.if_peak_rate_import = round(rates.import.peak);
            next.if_offpeak_rate_import = round(
              rates.import.flux ?? rates.import.day,
            );
            next.if_peak_rate_export = round(rates.export.peak);
            next.if_offpeak_rate_export = round(
              rates.export.flux ?? rates.export.day,
            );
            if (rates.standing_charge != null) {
              next.if_standing_charge = round(rates.standing_charge);
            }
          }
          return next;
        });

        setFluxRatesStatus(`Octopus Flux rates loaded for ${postcode}`);
      } catch (e) {
        setFluxRatesStatus(
          e instanceof Error ? e.message : 'Failed to pull Flux rates',
        );
      } finally {
        setFluxRatesLoading(false);
      }
    },
    [
      radios.battery_savings,
      customerDetails?.postcode,
      inputs.flux_day_rate_import,
      inputs.flux_standing_charge,
      inputs.if_peak_rate_import,
      inputs.if_standing_charge,
    ],
  );

  useEffect(() => {
    if (loading) return;
    if (radios.battery_savings === 3 || radios.battery_savings === 4) {
      pullOctopusFluxRates(false);
    } else {
      setFluxRatesStatus(null);
    }
    // intentionally only when savings basis / postcode / load settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, radios.battery_savings, customerDetails?.postcode]);

  const setRadio = (groupId: string, value: number) => {
    setRadios((prev) => {
      const next = { ...prev, [groupId]: value };
      const cleared = fieldsClearedByRadioChange(
        groupId,
        sections,
        prev,
        next,
        consumptionMatrix,
      );
      setInputs((inp) => {
        const copy = { ...inp };
        cleared.forEach((id) => delete copy[id]);
        // Re-apply New Electricity Tariff / export defaults when savings or tariff type changes
        const forceDefaults =
          groupId === 'battery_savings' || groupId === 'current_tariff';
        return applyNewTariffDefaults(next, copy, { force: forceDefaults });
      });
      return next;
    });
  };

  const setInput = (fieldId: string, value: string) => {
    setInputs((prev) => {
      let next = { ...prev, [fieldId]: value };
      next = applyCascadeClear(fieldId, next);
      next[fieldId] = value;
      // Self-consumption: keep New day rate in sync when Current day rate changes
      // only if new_peak was empty or still matched the previous current rate
      if (
        fieldId === 'current_rate_1' &&
        radios.battery_savings === 1
      ) {
        const prevCurrent = String(prev.current_rate_1 ?? '').trim();
        const prevNew = String(prev.new_peak_rate ?? '').trim();
        if (!prevNew || prevNew === prevCurrent) {
          next.new_peak_rate = value;
        }
      }
      return next;
    });
  };

  const dropdownOptions = useCallback(
    (field: V44Field): string[] => {
      if (field.staticOptions) return field.staticOptions;
      if (!equipment || !field.dropdownSource) return [];
      switch (field.dropdownSource) {
        case 'panel_manufacturer':
          return [...new Set(equipment.panels.map((p) => p.manufacturer))].sort();
        case 'panel_model': {
          const mfr = inputs.panel_manufacturer;
          return [
            ...new Set(
              equipment.panels.filter((p) => p.manufacturer === mfr).map((p) => p.model),
            ),
          ].sort();
        }
        case 'panel_wattage': {
          const mfr = inputs.panel_manufacturer;
          const model = inputs.panel_model;
          const panel = equipment.panels.find(
            (p) => p.manufacturer === mfr && p.model === model,
          );
          if (!panel) return [];
          const min = panel.minWattage ?? 0;
          const max = panel.maxWattage ?? min;
          const opts: string[] = [];
          for (let w = min; w <= max; w += 5) opts.push(String(w));
          if (!opts.length && min) opts.push(String(min));
          return opts;
        }
        case 'battery_manufacturer':
          return [
            ...new Set(
              equipment.batteries
                .filter((b) => b.repVisible !== false)
                .map((b) => b.manufacturer),
            ),
          ].sort();
        case 'battery_model': {
          const mfr = inputs.battery_manufacturer;
          return [
            ...new Set(
              equipment.batteries
                .filter((b) => b.manufacturer === mfr && b.repVisible !== false)
                .map((b) => b.model),
            ),
          ].sort();
        }
        case 'inverter_manufacturer':
          return [
            ...new Set(
              equipment.inverters
                .filter((i) => i.repVisible !== false)
                .map((i) => i.manufacturer),
            ),
          ].sort();
        case 'inverter_model': {
          const mfr = inputs.inverter_manufacturer;
          return [
            ...new Set(
              equipment.inverters
                .filter((i) => i.manufacturer === mfr && i.repVisible !== false)
                .map((i) => i.model),
            ),
          ].sort();
        }
        default:
          return [];
      }
    },
    [equipment, inputs],
  );

  const visibleSections = useMemo(() => {
    return sortSectionsByExcelOrder(sections).filter((s) => {
      if (s.id === 'system_costs') return false; // Pricing owns costs
      if (s.id === 'customer') return false; // already on Customer Details
      return isSectionVisible(s, radios);
    });
  }, [sections, radios]);

  /** Cosy tariff: Excel shows usage split options next to Annual Grid Consumption */
  const cosyUsageGroup = useMemo(() => {
    if (radios.current_tariff !== 3) return null;
    return groups.find((g) => g.id === 'usage_known') || null;
  }, [groups, radios.current_tariff]);

  const onContinue = async () => {
    try {
      setSaving(true);
      const toSaveRadios = {
        ...radios,
        installing_new_solar: 1,
        inverter_new: 1,
      };
      await CalculatorProgressService.saveProgress(opportunityId, 'v44', {
        currentStep: 'dynamic-inputs',
        radioButtonSelections: radiosToProgress(toSaveRadios),
        dynamicInputs: inputs,
        customerDetails,
        completedSteps: {
          'template-selection': true,
          'radio-buttons': true,
          'dynamic-inputs': true,
        },
      });

      navigation.navigate('SolarArraysInputs', {
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
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Text style={{ color: theme.dangerButton }}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={{ color: theme.primaryButton, marginTop: 12 }}>Retry</Text>
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
                Calculator Inputs
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Equipment, tariffs, and system details
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
        {/* Excel Inputs order: Existing → Solar PV → Battery → Inverter → Current Tariff → New tariffs → Export */}
        {visibleSections.map((section) => {
          const fields = section.fields.filter((f) =>
            isFieldVisible(f, radios, consumptionMatrix, true),
          );
          if (!fields.length && !(section.id === 'current_tariff' && cosyUsageGroup)) {
            return null;
          }

          const rateFields = fields.filter(
            (f) =>
              !isConsumptionField(f.id) && f.id !== 'occupancy_archetype',
          );
          const consumptionFields = fields.filter(
            (f) =>
              isConsumptionField(f.id) || f.id === 'occupancy_archetype',
          );

          const renderField = (field: V44Field) => {
            const label = resolveFieldLabel(field, radios, true);
            const value = inputs[field.id] || '';
            if (field.type === 'dropdown') {
              return (
                <View key={field.id} style={styles.field}>
                  <Text style={[styles.label, { color: theme.secondaryText }]}>
                    {label}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() =>
                      setDropdown({
                        fieldId: field.id,
                        label,
                        options: dropdownOptions(field),
                      })
                    }
                  >
                    <Text
                      style={{
                        color: value ? theme.primaryText : theme.secondaryText,
                      }}
                    >
                      {value || 'Select…'}
                    </Text>
                    <Feather name="chevron-down" size={18} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <View key={field.id} style={styles.field}>
                <Text style={[styles.label, { color: theme.secondaryText }]}>
                  {label}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.cardBorder,
                      color: theme.primaryText,
                    },
                  ]}
                  value={value}
                  onChangeText={(t) => setInput(field.id, t)}
                  keyboardType={
                    field.type === 'number' ? 'decimal-pad' : 'default'
                  }
                  placeholderTextColor={theme.secondaryText}
                />
              </View>
            );
          };

          if (section.id === 'current_tariff') {
            return (
              <View key={section.id}>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                    Current Tariff
                  </Text>
                  {rateFields.map(renderField)}
                </View>

                {cosyUsageGroup ? (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                      {cosyUsageGroup.question}
                    </Text>
                    {cosyUsageGroup.options
                      .filter((o) => !o.hiddenFromReps)
                      .map((opt) => {
                        const active =
                          (radios.usage_known ?? cosyUsageGroup.defaultValue) ===
                          opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.option,
                              {
                                borderColor: active
                                  ? theme.primaryButton
                                  : theme.cardBorder,
                                backgroundColor: active
                                  ? theme.primaryButton + '18'
                                  : theme.inputBackground,
                              },
                            ]}
                            onPress={() => setRadio('usage_known', opt.value)}
                          >
                            <Text style={{ color: theme.primaryText }}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                ) : null}

                {consumptionFields.length ? (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    ]}
                  >
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                      Annual Grid Consumption
                    </Text>
                    {consumptionFields.map(renderField)}
                  </View>
                ) : null}
              </View>
            );
          }

          if (section.id === 'standard_flux' || section.id === 'intelligent_flux') {
            const isStandard = section.id === 'standard_flux';
            const rows = isStandard
              ? [
                  {
                    label: 'Day Rate (pence per kWh)',
                    importId: 'flux_day_rate_import',
                    exportId: 'flux_day_rate_export',
                  },
                  {
                    label: 'Flux Rate (02:00 – 05:00)',
                    importId: 'flux_flux_rate_import',
                    exportId: 'flux_flux_rate_export',
                  },
                  {
                    label: 'Peak Rate (16:00 – 19:00)',
                    importId: 'flux_peak_rate_import',
                    exportId: 'flux_peak_rate_export',
                  },
                ]
              : [
                  {
                    label: 'Peak Rate (pence per kWh)',
                    importId: 'if_peak_rate_import',
                    exportId: 'if_peak_rate_export',
                  },
                  {
                    label: 'Off-Peak Rate (pence per kWh)',
                    importId: 'if_offpeak_rate_import',
                    exportId: 'if_offpeak_rate_export',
                  },
                ];
            const standingId = isStandard
              ? 'flux_standing_charge'
              : 'if_standing_charge';

            return (
              <View
                key={section.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                  {isStandard
                    ? 'New Octopus Standard Flux'
                    : 'New Octopus Intelligent Flux'}
                </Text>
                <Text style={[styles.fluxHint, { color: theme.secondaryText }]}>
                  {isStandard
                    ? 'When basing savings on the Standard Flux tariff, check current rates below.'
                    : 'When basing savings on the Intelligent Flux tariff, check current rates below.'}
                </Text>
                <View style={styles.fluxPullRow}>
                  <TouchableOpacity
                    style={[
                      styles.fluxPullBtn,
                      {
                        backgroundColor: theme.primaryButton,
                        opacity: fluxRatesLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => pullOctopusFluxRates(true)}
                    disabled={fluxRatesLoading}
                  >
                    {fluxRatesLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.fluxPullBtnText}>
                        {isStandard
                          ? 'Check Standard Flux Rates'
                          : 'Check Intelligent Flux Rates'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {fluxRatesStatus ? (
                    <Text style={[styles.fluxPullStatus, { color: theme.secondaryText }]}>
                      {fluxRatesStatus}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.fluxTable,
                    { borderColor: theme.cardBorder },
                  ]}
                >
                  <View
                    style={[
                      styles.fluxTableHeader,
                      { backgroundColor: isDark ? '#334155' : '#525252' },
                    ]}
                  >
                    <Text style={[styles.fluxTableHeaderLabel, { flex: 1.4 }]} />
                    <Text style={styles.fluxTableHeaderCell}>Import</Text>
                    <Text style={styles.fluxTableHeaderCell}>Export</Text>
                  </View>

                  {rows.map((row, idx) => (
                    <View
                      key={row.importId}
                      style={[
                        styles.fluxTableRow,
                        {
                          borderTopColor: theme.cardBorder,
                          backgroundColor:
                            idx % 2 === 1
                              ? isDark
                                ? 'rgba(255,255,255,0.04)'
                                : 'rgba(0,0,0,0.03)'
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fluxTableLabel,
                          { color: theme.primaryText, flex: 1.4 },
                        ]}
                      >
                        {row.label}
                      </Text>
                      <TextInput
                        style={[
                          styles.fluxTableInput,
                          {
                            backgroundColor: theme.inputBackground,
                            borderColor: theme.cardBorder,
                            color: theme.primaryText,
                          },
                        ]}
                        value={inputs[row.importId] || ''}
                        onChangeText={(t) => setInput(row.importId, t)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={theme.secondaryText}
                      />
                      <TextInput
                        style={[
                          styles.fluxTableInput,
                          {
                            backgroundColor: theme.inputBackground,
                            borderColor: theme.cardBorder,
                            color: theme.primaryText,
                          },
                        ]}
                        value={inputs[row.exportId] || ''}
                        onChangeText={(t) => setInput(row.exportId, t)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={theme.secondaryText}
                      />
                    </View>
                  ))}

                  <View
                    style={[
                      styles.fluxTableRow,
                      { borderTopColor: theme.cardBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fluxTableLabel,
                        { color: theme.primaryText, flex: 1.4 },
                      ]}
                    >
                      Standing Charge (pence per day)
                    </Text>
                    <TextInput
                      style={[
                        styles.fluxTableInput,
                        styles.fluxStandingInput,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.cardBorder,
                          color: theme.primaryText,
                        },
                      ]}
                      value={inputs[standingId] || ''}
                      onChangeText={(t) => setInput(standingId, t)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={theme.secondaryText}
                    />
                  </View>
                </View>
                <Text style={[styles.fluxFootnote, { color: theme.secondaryText }]}>
                  Import prices include VAT.
                </Text>
              </View>
            );
          }

          return (
            <View
              key={section.id}
              style={[
                styles.card,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                {section.title}
              </Text>
              {section.id === 'new_overnight' ? (
                <Text style={[styles.fluxHint, { color: theme.secondaryText }]}>
                  {radios.battery_savings === 1
                    ? 'Pre-filled from Current Electricity Tariff (night rate not used for self-consumption). You can override.'
                    : 'Pre-filled with 100Green rates (Single 27.73 / 7.00 · Dual 36.26 / 7.00). You can override.'}
                </Text>
              ) : null}
              {section.id === 'export_tariff' ? (
                <Text style={[styles.fluxHint, { color: theme.secondaryText }]}>
                  Pre-filled at 12p/kWh. You can override.
                </Text>
              ) : null}
              {fields.map(renderField)}
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
            <Text style={styles.continueText}>Continue to Solar Arrays</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!dropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdown(null)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: theme.cardBackground }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              {dropdown?.label}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(dropdown?.options || []).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalOption}
                  onPress={() => {
                    if (dropdown) setInput(dropdown.fieldId, opt);
                    setDropdown(null);
                  }}
                >
                  <Text style={{ color: theme.primaryText }}>{opt}</Text>
                </TouchableOpacity>
              ))}
              {!dropdown?.options?.length ? (
                <Text style={{ color: theme.secondaryText, padding: 12 }}>
                  No options — select parent field first
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomNavigation />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollView: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  fluxHint: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  fluxPullRow: { marginBottom: 12, gap: 8 },
  fluxPullBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fluxPullBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fluxPullStatus: { fontSize: 13, lineHeight: 18 },
  fluxTable: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fluxTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  fluxTableHeaderLabel: { paddingRight: 8 },
  fluxTableHeaderCell: {
    flex: 1,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  fluxTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  fluxTableLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 4,
  },
  fluxTableInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  fluxStandingInput: {
    flex: 2,
  },
  fluxFootnote: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  field: { marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  continue: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
});
