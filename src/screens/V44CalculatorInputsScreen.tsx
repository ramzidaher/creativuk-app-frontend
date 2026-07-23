import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import { useAuthReady } from '../hooks/useAuthReady';
import CalculatorProgressService from '../services/CalculatorProgressService';
import { api } from '../utils/api';
import { showAlert } from '../utils/crossPlatformAlert';
import { getCustomerDetailsFromRouteParams, normalizeRouteParams, parseJsonParam } from '../utils/deepLinkParams';
import {
  V44Field,
  V44RadioGroup,
  V44Section,
  V44_SUPPORTED_PANELS,
  applyCascadeClear,
  applyNewTariffDefaults,
  fieldsClearedByRadioChange,
  inverterDisplayName,
  isApprovedV44RepFieldVisible,
  isApprovedV44RepSectionVisible,
  isConsumptionField,
  isSupportedBatteryManufacturer,
  isSupportedBatteryModel,
  isSupportedInverter,
  isSupportedInverterManufacturer,
  isSupportedPanelManufacturer,
  isSupportedPanelModel,
  normalizeV44Radios,
  radiosFromProgress,
  radiosToProgress,
  resolveFieldLabel,
  sortSectionsByExcelOrder,
  v44Radio,
} from '../utils/v44Logic';

type Equipment = {
  panels: Array<{ manufacturer: string; model: string; minWattage: number | null; maxWattage: number | null }>;
  batteries: Array<{ manufacturer: string; model: string; repVisible?: boolean }>;
  inverters: Array<{
    manufacturer: string;
    model: string;
    capacityKw: number | null;
    repVisible?: boolean;
  }>;
};

type RouteParams = {
  opportunityId: string;
  customerDetails?: { customerName: string; address: string; postcode: string };
  calculatorType?: 'v44';
  /** Fresh selections from Questions — takes priority over saved progress */
  pendingRadios?: Record<string, number>;
};

// New-tariff standing charge is hidden (47.5p default in background).
// Current-tariff standing charge stays visible for manual entry.
const REP_HIDDEN_STANDING_CHARGE_FIELDS = new Set([
  'new_standing_charge',
  'flux_standing_charge',
  'if_standing_charge',
]);

const TARIFF_OVERRIDE_SECTIONS = new Set(['new_overnight', 'export_tariff']);
const ALWAYS_RENDER_SECTIONS = new Set(['current_tariff', ...TARIFF_OVERRIDE_SECTIONS]);
const EQUIPMENT_SECTION_IDS = new Set(['solar_pv', 'battery', 'inverter']);
const NEW_TARIFF_SECTION_IDS = new Set(['new_overnight', 'export_tariff']);

/**
 * v4.4 Inputs — schema-driven show/hide/clear (Excel Toggle logic in the app).
 */
export default function V44CalculatorInputsScreen() {
  const { theme, isDark } = useTheme();
  const { isAuthReady, isLoading: authLoading, isAuthenticated } = useAuthReady();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = normalizeRouteParams(route.params as Record<string, unknown>);
  const opportunityId = params.opportunityId as string;
  /** Capture deep-link params once — URL sync recreates route.params and would reload in a loop. */
  const routeCustomerRef = useRef(getCustomerDetailsFromRouteParams(params));
  const isAuthReadyRef = useRef(isAuthReady);
  isAuthReadyRef.current = isAuthReady;
  /** Capture deep-link radios once — do not re-read route.params (URL sync causes reload loops). */
  const pendingRadiosRef = useRef(
    parseJsonParam<Record<string, number>>(params.pendingRadios),
  );
  const pendingRadiosAppliedRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const skipInitialFocusReloadRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<V44Section[]>([]);
  const [groups, setGroups] = useState<V44RadioGroup[]>([]);
  const [consumptionMatrix, setConsumptionMatrix] = useState<Record<string, string[]>>({});
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [radios, setRadios] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [customerDetails, setCustomerDetails] = useState<RouteParams['customerDetails']>(
    routeCustomerRef.current,
  );
  const [dropdown, setDropdown] = useState<{
    fieldId: string;
    label: string;
    options: string[];
  } | null>(null);
  const [fluxRatesStatus, setFluxRatesStatus] = useState<string | null>(null);
  const [fluxRatesLoading, setFluxRatesLoading] = useState(false);
  /** When false, New Electricity Tariff / Export stay locked to auto defaults */
  const [tariffOverride, setTariffOverride] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedInputs, setSavedInputs] = useState<Record<string, string> | null>(null);
  const [savedRadios, setSavedRadios] = useState<Record<string, number> | null>(null);

  const load = useCallback(async (options?: { background?: boolean }) => {
    if (!isAuthReadyRef.current || !opportunityId || loadInFlightRef.current) {
      return;
    }
    loadInFlightRef.current = true;
    if (!options?.background) {
      setLoading(true);
    }
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
      if (!schemaRes.success || !schemaRes.data?.radioGroups) {
        throw new Error(
          schemaRes.error ||
            'Failed to load calculator schema. Check you are logged in and the backend is running.',
        );
      }
      if (!equipmentRes.success || !equipmentRes.data) {
        throw new Error(equipmentRes.error || 'Failed to load equipment catalog');
      }

      setGroups(schemaRes.data.radioGroups);
      setSections(sortSectionsByExcelOrder(schemaRes.data.sections));
      setConsumptionMatrix(schemaRes.data.consumptionMatrix || {});
      setEquipment(equipmentRes.data);

      const progress = await CalculatorProgressService.getProgress(opportunityId, 'v44');
      const restoredRadios = radiosFromProgress(
        progress?.radioButtonSelections,
        schemaRes.data.radioGroups,
      );
      if (pendingRadiosRef.current && !pendingRadiosAppliedRef.current) {
        Object.assign(
          restoredRadios,
          normalizeV44Radios(pendingRadiosRef.current, schemaRes.data.radioGroups),
        );
        pendingRadiosAppliedRef.current = true;
      }
      setRadios(restoredRadios);

      const restoredInputs = { ...(progress?.dynamicInputs || {}) };
      const effectiveCustomer = progress?.customerDetails ?? routeCustomerRef.current;
      if (effectiveCustomer) {
        setCustomerDetails(effectiveCustomer);
        restoredInputs.customer_name = effectiveCustomer.customerName || '';
        restoredInputs.address = effectiveCustomer.address || '';
        restoredInputs.postcode = effectiveCustomer.postcode || '';
      }
      // Clear stale panel selections that are no longer supported
      // (only Eurener Nexa 475W is sold — see V44_SUPPORTED_PANELS)
      const savedPanelMfr = String(restoredInputs.panel_manufacturer ?? '').trim();
      const savedPanelModel = String(restoredInputs.panel_model ?? '').trim();
      const savedPanelWattage = String(restoredInputs.panel_wattage ?? '').trim();
      if (
        (savedPanelMfr && !isSupportedPanelManufacturer(savedPanelMfr)) ||
        (savedPanelModel && !isSupportedPanelModel(savedPanelModel)) ||
        (savedPanelWattage &&
          !(V44_SUPPORTED_PANELS.wattages as readonly string[]).includes(savedPanelWattage))
      ) {
        delete restoredInputs.panel_manufacturer;
        delete restoredInputs.panel_model;
        delete restoredInputs.panel_wattage;
      }
      // Keep unsupported/upcoming battery models in the backend catalog, but
      // never restore them into the sales-rep flow.
      const savedBatteryMfr = String(
        restoredInputs.battery_manufacturer ?? '',
      ).trim();
      const savedBatteryModel = String(restoredInputs.battery_model ?? '').trim();
      if (
        (savedBatteryMfr &&
          !isSupportedBatteryManufacturer(savedBatteryMfr)) ||
        (savedBatteryModel && !isSupportedBatteryModel(savedBatteryModel))
      ) {
        delete restoredInputs.battery_manufacturer;
        delete restoredInputs.battery_model;
        delete restoredInputs.battery_modules;
      }
      const savedInverterMfr = String(
        restoredInputs.inverter_manufacturer ?? '',
      ).trim();
      const savedInverterModel = String(
        restoredInputs.inverter_model ?? '',
      ).trim();
      const savedInverter = equipmentRes.data.inverters.find(
        (inverter) =>
          inverter.manufacturer === savedInverterMfr &&
          inverter.model === savedInverterModel,
      );
      if (
        (savedInverterMfr &&
          !isSupportedInverterManufacturer(savedInverterMfr)) ||
        (savedInverterModel &&
          (!savedInverter ||
            !isSupportedInverter(
              savedInverter.manufacturer,
              savedInverter.model,
              savedInverter.capacityKw,
            )))
      ) {
        delete restoredInputs.inverter_manufacturer;
        delete restoredInputs.inverter_model;
        delete restoredInputs.inverter_devices;
      }
      // Always reset the new tariff / export rates to the approved defaults for
      // the selected tariff. Old saved rates (including stale test data) are
      // discarded — reps must switch Override on per session to enter custom rates.
      setTariffOverride(false);
      const finalInputs = applyNewTariffDefaults(restoredRadios, restoredInputs, { force: true });
      setInputs(finalInputs);

      const hasSavedInputs =
        progress?.completedSteps?.['dynamic-inputs'] ||
        (progress?.dynamicInputs && Object.keys(progress.dynamicInputs).length > 0);
      if (hasSavedInputs) {
        setHasRestoredProgress(true);
        setSavedInputs({ ...finalInputs });
        setSavedRadios({ ...restoredRadios });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [opportunityId]);

  const modeSummary = useMemo(() => {
    const savings = v44Radio(radios, 'battery_savings');
    const tariff = v44Radio(radios, 'current_tariff', 1);
    const savingsLabels: Record<number, string> = {
      1: 'Self-Consumption',
      2: 'Overnight Charging',
    };
    const tariffLabels: Record<number, string> = {
      1: 'Single Rate',
      2: 'Dual Rate',
    };
    return `${savingsLabels[savings] ?? '—'} · ${tariffLabels[tariff] ?? '—'}`;
  }, [radios]);

  useEffect(() => {
    if (isAuthReady && opportunityId) {
      load();
    }
  }, [isAuthReady, opportunityId, load]);

  // Background refresh when returning from Calculator Questions (no full-screen spinner).
  useFocusEffect(
    useCallback(() => {
      if (skipInitialFocusReloadRef.current) {
        skipInitialFocusReloadRef.current = false;
        return;
      }
      if (!loadedOnceRef.current || !isAuthReadyRef.current) {
        return;
      }
      load({ background: true });
    }, [load]),
  );

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
          ? !!inputs.flux_day_rate_import
          : !!inputs.if_peak_rate_import;
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
          } else if (variant === 'intelligent' && rates.import && rates.export) {
            next.if_peak_rate_import = round(rates.import.peak);
            next.if_offpeak_rate_import = round(
              rates.import.flux ?? rates.import.day,
            );
            next.if_peak_rate_export = round(rates.export.peak);
            next.if_offpeak_rate_export = round(
              rates.export.flux ?? rates.export.day,
            );
          }
          return applyNewTariffDefaults(radios, next, { force: true });
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
      inputs.if_peak_rate_import,
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
          !tariffOverride &&
          (groupId === 'battery_savings' || groupId === 'current_tariff');
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
      return next;
    });
  };

  const toggleTariffOverride = (enabled: boolean) => {
    setTariffOverride(enabled);
    if (!enabled) {
      setInputs((prev) => applyNewTariffDefaults(radios, prev, { force: true }));
    }
  };

  const renderTariffNumberField = (opts: {
    id: string;
    label: string;
    locked: boolean;
    lockedReason?: string;
    badge?: string;
  }) => {
    const value = inputs[opts.id] || '';
    const locked = opts.locked;
    return (
      <View key={opts.id} style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.secondaryText, flex: 1 }]}>
            {opts.label}
          </Text>
          {opts.badge ? (
            <View style={[styles.badge, { backgroundColor: theme.primaryButton + '22' }]}>
              <Text style={[styles.badgeText, { color: theme.primaryButton }]}>
                {opts.badge}
              </Text>
            </View>
          ) : null}
          {locked ? (
            <View style={styles.lockRow}>
              <Feather name="lock" size={14} color={theme.secondaryText} />
              <Text style={[styles.lockText, { color: theme.secondaryText }]}>
                Locked
              </Text>
            </View>
          ) : null}
        </View>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: locked
                ? (isDark ? '#1e293b' : '#f1f5f9')
                : theme.inputBackground,
              borderColor: theme.cardBorder,
              color: locked ? theme.secondaryText : theme.primaryText,
              opacity: locked ? 0.85 : 1,
            },
          ]}
          value={value}
          onChangeText={(t) => setInput(opts.id, t)}
          editable={!locked}
          keyboardType="decimal-pad"
          placeholder={opts.lockedReason || '—'}
          placeholderTextColor={theme.secondaryText}
        />
        {opts.lockedReason ? (
          <Text style={[styles.fieldHint, { color: theme.secondaryText }]}>
            {opts.lockedReason}
          </Text>
        ) : null}
      </View>
    );
  };

  const dropdownOptions = useCallback(
    (field: V44Field): string[] => {
      if (field.staticOptions) return field.staticOptions;
      if (!equipment || !field.dropdownSource) return [];
      switch (field.dropdownSource) {
        case 'panel_manufacturer':
          // Reps only see panels we currently sell (Eurener Nexa 475W)
          return [
            ...new Set(
              equipment.panels
                .filter((p) => isSupportedPanelManufacturer(p.manufacturer))
                .map((p) => p.manufacturer),
            ),
          ].sort();
        case 'panel_model': {
          const mfr = inputs.panel_manufacturer;
          return [
            ...new Set(
              equipment.panels
                .filter((p) => {
                  if (p.manufacturer !== mfr || !isSupportedPanelModel(p.model)) {
                    return false;
                  }
                  // Model must offer a wattage we sell (475W)
                  const min = p.minWattage ?? 0;
                  const max = p.maxWattage ?? min;
                  return V44_SUPPORTED_PANELS.wattages.some((w) => {
                    const n = Number(w);
                    return n >= min && n <= max;
                  });
                })
                .map((p) => p.model),
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
          // Only wattages currently sold (475W) — no manual 460W / 500W
          return V44_SUPPORTED_PANELS.wattages.filter((w) => {
            const n = Number(w);
            return n >= min && n <= max;
          });
        }
        case 'battery_manufacturer':
          return [
            ...new Set(
              equipment.batteries
                .filter(
                  (b) =>
                    b.repVisible !== false &&
                    isSupportedBatteryManufacturer(b.manufacturer),
                )
                .map((b) => b.manufacturer),
            ),
          ].sort();
        case 'battery_model': {
          const mfr = inputs.battery_manufacturer;
          return [
            ...new Set(
              equipment.batteries
                .filter(
                  (b) =>
                    b.manufacturer === mfr &&
                    b.repVisible !== false &&
                    isSupportedBatteryModel(b.model),
                )
                .map((b) => b.model),
            ),
          ].sort();
        }
        case 'inverter_manufacturer':
          return [
            ...new Set(
              equipment.inverters
                .filter(
                  (i) =>
                    i.repVisible !== false &&
                    isSupportedInverterManufacturer(i.manufacturer),
                )
                .map((i) => i.manufacturer),
            ),
          ].sort();
        case 'inverter_model': {
          const mfr = inputs.inverter_manufacturer;
          return [
            ...new Set(
              equipment.inverters
                .filter(
                  (i) =>
                    i.manufacturer === mfr &&
                    i.repVisible !== false &&
                    isSupportedInverter(
                      i.manufacturer,
                      i.model,
                      i.capacityKw,
                    ),
                )
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
    return sortSectionsByExcelOrder(sections).filter((s) =>
      isApprovedV44RepSectionVisible(s, radios),
    );
  }, [sections, radios]);

  const equipmentSections = useMemo(
    () => visibleSections.filter((s) => EQUIPMENT_SECTION_IDS.has(s.id)),
    [visibleSections],
  );

  const newTariffSections = useMemo(
    () => visibleSections.filter((s) => NEW_TARIFF_SECTION_IDS.has(s.id)),
    [visibleSections],
  );

  const mainSections = useMemo(
    () =>
      visibleSections.filter(
        (s) =>
          !EQUIPMENT_SECTION_IDS.has(s.id) &&
          !NEW_TARIFF_SECTION_IDS.has(s.id),
      ),
    [visibleSections],
  );

  const getVisibleFields = useCallback(
    (section: V44Section) =>
      section.fields.filter(
        (f) =>
          !REP_HIDDEN_STANDING_CHARGE_FIELDS.has(f.id) &&
          isApprovedV44RepFieldVisible(f, radios, consumptionMatrix),
      ),
    [radios, consumptionMatrix],
  );

  const renderField = useCallback(
    (field: V44Field) => {
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
                {value
                  ? field.id === 'inverter_model'
                    ? inverterDisplayName(value)
                    : value
                  : 'Select…'}
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
            onChangeText={(t) =>
              setInput(
                field.id,
                field.id === 'battery_modules'
                  ? t.replace(/[^\d]/g, '')
                  : t,
              )
            }
            keyboardType={
              field.id === 'battery_modules'
                ? 'number-pad'
                : field.type === 'number'
                  ? 'decimal-pad'
                  : 'default'
            }
            placeholderTextColor={theme.secondaryText}
          />
        </View>
      );
    },
    [dropdownOptions, inputs, radios, theme, setInput],
  );

  /** Cosy tariff: Excel shows usage split options next to Annual Grid Consumption */
  const cosyUsageGroup = useMemo(() => {
    if (radios.current_tariff !== 3) return null;
    return groups.find((g) => g.id === 'usage_known') || null;
  }, [groups, radios.current_tariff]);

  /**
   * Block Continue until every field the rep can see is filled in correctly,
   * so the workflow can't be completed with missing or invalid data.
   */
  const validationErrors = (): string[] => {
    const problems: string[] = [];
    const wholeNumberFields = ['battery_modules', 'inverter_devices', 'no_of_arrays'];

    for (const section of visibleSections) {
      const fields = section.fields.filter((f) =>
        !REP_HIDDEN_STANDING_CHARGE_FIELDS.has(f.id) &&
        isApprovedV44RepFieldVisible(f, radios, consumptionMatrix),
      );
      for (const field of fields) {
        const mustFill =
          field.required ||
          isConsumptionField(field.id) ||
          field.id === 'occupancy_archetype';
        const raw = (inputs[field.id] || '').trim();
        const label = resolveFieldLabel(field, radios, true);

        if (!raw) {
          if (mustFill) problems.push(`${label} is missing`);
          continue;
        }
        if (field.type === 'number') {
          const n = Number(raw);
          if (Number.isNaN(n) || n < 0) {
            problems.push(`${label} must be a valid number`);
          } else if (wholeNumberFields.includes(field.id) && (!Number.isInteger(n) || n < 1)) {
            problems.push(`${label} must be a whole number of 1 or more`);
          }
        }
      }
    }
    return problems;
  };

  const hasChanges = () => {
    if (!savedInputs || !savedRadios) return false;
    for (const [key, value] of Object.entries(inputs)) {
      if ((savedInputs[key] || '') !== (value || '')) return true;
    }
    for (const [key, value] of Object.entries(savedInputs)) {
      if ((inputs[key] || '') !== (value || '')) return true;
    }
    for (const [key, value] of Object.entries(radios)) {
      if (savedRadios[key] !== value) return true;
    }
    for (const [key, value] of Object.entries(savedRadios)) {
      if (radios[key] !== value) return true;
    }
    return false;
  };

  const onSkip = () => {
    navigation.navigate('SolarArraysInputs', {
      opportunityId,
      customerDetails,
      calculatorType: 'v44',
    });
  };

  const onContinue = async () => {
    const problems = validationErrors();
    if (problems.length) {
      showAlert(
        'Please complete the form',
        problems.slice(0, 8).join('\n') +
          (problems.length > 8 ? `\n…and ${problems.length - 8} more` : ''),
      );
      return;
    }
    try {
      setSaving(true);
      const toSaveRadios = {
        ...radios,
        existing_solar: 2,
        installing_new_solar: 1,
        inverter_new: 1,
        usage_known: 1,
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

      setHasRestoredProgress(true);
      setSavedInputs({ ...inputs });
      setSavedRadios({ ...toSaveRadios });

      navigation.navigate('SolarArraysInputs', {
        opportunityId,
        customerDetails,
        calculatorType: 'v44',
      });
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if ((authLoading && !loadedOnceRef.current) || loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={{ color: theme.secondaryText, marginTop: 12 }}>
            {authLoading ? 'Signing in…' : 'Loading calculator…'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Text style={{ color: theme.primaryText, textAlign: 'center', marginBottom: 12 }}>
            Please log in to open this calculator link.
          </Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={{ color: theme.primaryButton }}>Go to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Text style={{ color: theme.dangerButton }}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
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
                {modeSummary} — equipment, tariffs, and usage
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
        {/* System equipment — Solar PV, Battery, Inverter */}
        {equipmentSections.some((s) => getVisibleFields(s).length > 0) ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              System Equipment
            </Text>
            {equipmentSections.reduce<React.ReactNode[]>((nodes, section) => {
              const fields = getVisibleFields(section);
              if (!fields.length) return nodes;
              nodes.push(
                <View key={section.id}>
                  {nodes.length > 0 ? (
                    <View
                      style={[styles.subsectionDivider, { borderColor: theme.cardBorder }]}
                    />
                  ) : null}
                  <Text style={[styles.subsectionTitle, { color: theme.primaryText }]}>
                    {section.title}
                  </Text>
                  {fields.map(renderField)}
                </View>,
              );
              return nodes;
            }, [])}
          </View>
        ) : null}

        {mainSections.map((section) => {
          const fields = getVisibleFields(section);
          if (
            !fields.length &&
            !(section.id === 'current_tariff' && cosyUsageGroup) &&
            !ALWAYS_RENDER_SECTIONS.has(section.id)
          ) {
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

          if (section.id === 'current_tariff') {
            return (
              <View
                key={section.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                  Customer's Current Tariff
                </Text>
                {rateFields.map(renderField)}

                {cosyUsageGroup ? (
                  <>
                    <View
                      style={[styles.subsectionDivider, { borderColor: theme.cardBorder }]}
                    />
                    <Text style={[styles.subsectionTitle, { color: theme.primaryText }]}>
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
                  </>
                ) : null}

                {consumptionFields.length ? (
                  <>
                    <View
                      style={[styles.subsectionDivider, { borderColor: theme.cardBorder }]}
                    />
                    <Text style={[styles.subsectionTitle, { color: theme.primaryText }]}>
                      Annual Grid Consumption
                    </Text>
                    {consumptionFields.map(renderField)}
                  </>
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
              {fields.map(renderField)}
            </View>
          );
        })}

        {/* New tariffs — electricity + export combined */}
        {newTariffSections.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
              New Tariffs
            </Text>

            {newTariffSections.some((s) => s.id === 'new_overnight') ? (
              <View>
                <Text style={[styles.subsectionTitle, { color: theme.primaryText }]}>
                  New Electricity Tariff (100Green)
                </Text>
                <View style={styles.overrideRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.overrideTitle, { color: theme.primaryText }]}>
                      Override rates
                    </Text>
                    <Text style={[styles.fluxHint, { color: theme.secondaryText, marginBottom: 0 }]}>
                      Locked to 100Green tariff defaults. Turn Override on to enter different rates.
                    </Text>
                  </View>
                  <Switch
                    value={tariffOverride}
                    onValueChange={toggleTariffOverride}
                    trackColor={{ false: '#cbd5e1', true: theme.primaryButton }}
                    thumbColor="#ffffff"
                  />
                </View>
                {renderTariffNumberField({
                  id: 'new_peak_rate',
                  label: 'Peak / Day Rate (pence per kWh)',
                  locked: !tariffOverride,
                  badge: '100Green',
                })}
                {renderTariffNumberField({
                  id: 'new_offpeak_rate',
                  label: 'Off-Peak / Night Rate (pence per kWh)',
                  locked: !tariffOverride,
                  badge: '100Green',
                })}
                {renderTariffNumberField({
                  id: 'new_offpeak_hours',
                  label: 'No. of Off-Peak Hours',
                  locked: !tariffOverride,
                })}
              </View>
            ) : null}

            {newTariffSections.some((s) => s.id === 'new_overnight') &&
            newTariffSections.some((s) => s.id === 'export_tariff') ? (
              <View
                style={[styles.subsectionDivider, { borderColor: theme.cardBorder }]}
              />
            ) : null}

            {newTariffSections.some((s) => s.id === 'export_tariff') ? (
              <View>
                <Text style={[styles.subsectionTitle, { color: theme.primaryText }]}>
                  New Export Tariff
                </Text>
                <View style={styles.overrideRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.overrideTitle, { color: theme.primaryText }]}>
                      Override rates
                    </Text>
                    <Text style={[styles.fluxHint, { color: theme.secondaryText, marginBottom: 0 }]}>
                      Locked to 12p/kWh export (100Green / SEG default).
                    </Text>
                  </View>
                  <Switch
                    value={tariffOverride}
                    onValueChange={toggleTariffOverride}
                    trackColor={{ false: '#cbd5e1', true: theme.primaryButton }}
                    thumbColor="#ffffff"
                  />
                </View>
                {renderTariffNumberField({
                  id: 'export_tariff_rate',
                  label: 'Export Tariff (pence per kWh)',
                  locked: !tariffOverride,
                  badge: '12p · 100Green',
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {Object.values(inputs).some((value) => value && value.trim() !== '') &&
        hasRestoredProgress &&
        savedInputs &&
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
                  <Text style={{ color: theme.primaryText }}>
                    {dropdown?.fieldId === 'inverter_model'
                      ? inverterDisplayName(opt)
                      : opt}
                  </Text>
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
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 2,
  },
  subsectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  fluxHint: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  overrideTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
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
