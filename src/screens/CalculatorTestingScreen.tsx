import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../utils/api';
import { calculatorTestingPublicApi } from '../utils/calculatorTestingPublicApi';

/**
 * Admin-only testing screen for the new EPVS Member Calculator v4.4.
 *
 * Recreates the calculator flow (template picker, radio questions, dynamic
 * inputs) against the new combined workbook WITHOUT touching the live
 * flux / off-peak flows. Backed by the read-only /calculator-testing/*
 * backend routes. The final step shows exactly which Excel cells each
 * value would be written to.
 */

// ---------------------------------------------------------------------------
// Types mirroring the backend schema (src/calculator-testing/v44-schema.ts)
// ---------------------------------------------------------------------------

type RadioOption = {
  value: number;
  label: string;
  shapeName: string;
  hiddenFromReps?: boolean;
  note?: string;
};

type RadioGroup = {
  id: string;
  question: string;
  linkCell: string;
  vbaToggle?: string;
  options: RadioOption[];
  defaultValue: number;
  hiddenFromReps?: boolean;
  note?: string;
};

type VisibilityRule = { group: string; in: number[] };

type Field = {
  id: string;
  label: string;
  repLabel?: string;
  cell: string;
  type: 'text' | 'number' | 'date' | 'dropdown';
  dropdownSource?: string;
  staticOptions?: string[];
  dependsOn?: string;
  visibleWhen?: VisibilityRule[];
  labelByState?: Record<string, string>;
  hiddenFromReps?: boolean;
  required?: boolean;
  note?: string;
};

type Section = {
  id: string;
  title: string;
  visibleWhen?: VisibilityRule[];
  fields: Field[];
};

type Schema = {
  template: {
    fileName: string;
    inputSheet: string;
    exists: boolean;
    description: string;
    maxArrays: number;
  };
  radioGroups: RadioGroup[];
  sections: Section[];
  arrayTable: {
    firstRow: number;
    maxArrays: number;
    columns: Array<{
      id: string;
      label: string;
      column: string;
      type: 'number' | 'dropdown';
      staticOptions?: string[];
    }>;
  };
  consumptionMatrix: Record<string, string[]>;
};

type PanelRecord = {
  manufacturer: string;
  model: string;
  minWattage: number | null;
  maxWattage: number | null;
};

type BatteryRecord = {
  manufacturer: string;
  model: string;
  capacityKwh: number | null;
  intelligentFluxCompatible: boolean;
  leveliseCompatible: boolean;
  repVisible: boolean;
  repHiddenReason?: string;
};

type InverterRecord = {
  manufacturer: string;
  model: string;
  capacityKw: number | null;
  inverterType: string;
  leveliseCompatible: boolean;
  repVisible: boolean;
  repHiddenReason?: string;
};

type Equipment = {
  panels: PanelRecord[];
  batteries: BatteryRecord[];
  inverters: InverterRecord[];
  sourceFile: string;
};

type PreviewResult = {
  radioWrites: Array<{
    groupId: string;
    question: string;
    linkCell: string;
    value: number;
    optionLabel: string;
    shapeName: string;
    vbaToggle?: string;
  }>;
  cellWrites: Array<{
    target: string;
    fieldId: string;
    label: string;
    value: string | number;
  }>;
  warnings: string[];
  summary: { totalCellWrites: number; writeOrderNote: string };
};

const CONSUMPTION_FIELD_IDS = [
  'consumption_1',
  'consumption_2',
  'consumption_3',
  'spend_1',
  'spend_2',
  'spend_3',
];

type SaveResult = {
  success: boolean;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  message: string;
  sheetsWritten: string[];
  warnings: string[];
};

type PrintResult = SaveResult & {
  pdfGenerated?: boolean;
  pdfFileName?: string;
  pdfPath?: string;
  pdfDownloadUrl?: string;
  macro: string;
};

const STEPS = ['Template', 'Questions', 'Inputs', 'Preview'] as const;

export default function CalculatorTestingScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const publicMode =
    route.name === 'CalculatorTestingPublic' || route.params?.publicMode === true;
  const isAdmin = user?.role === 'ADMIN';
  const canUseScreen = publicMode || isAdmin;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  const [step, setStep] = useState(0);
  const [repView, setRepView] = useState(false);
  const [templateSelected, setTemplateSelected] = useState(false);

  const [radios, setRadios] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [arrays, setArrays] = useState<Array<Record<string, string>>>([]);

  const [dropdownField, setDropdownField] = useState<{
    fieldId: string;
    label: string;
    options: string[];
    arrayIndex?: number;
  } | null>(null);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [printResult, setPrintResult] = useState<PrintResult | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (publicMode) {
        const [schemaRes, equipmentRes] = await Promise.all([
          calculatorTestingPublicApi.getSchema<Schema & { success: boolean }>(),
          calculatorTestingPublicApi.getEquipment<Equipment & { success: boolean }>(),
        ]);
        if (!schemaRes.success || !schemaRes.data) {
          throw new Error(schemaRes.error || 'Failed to load calculator schema');
        }
        if (!equipmentRes.success || !equipmentRes.data) {
          throw new Error(equipmentRes.error || 'Failed to load equipment catalog');
        }
        setSchema(schemaRes.data);
        setEquipment(equipmentRes.data);
        const defaults: Record<string, number> = {};
        schemaRes.data.radioGroups.forEach((g) => {
          defaults[g.id] = g.defaultValue;
        });
        setRadios(defaults);
        return;
      }

      const [schemaRes, equipmentRes] = await Promise.all([
        api.get<Schema & { success: boolean }>('/calculator-testing/schema'),
        api.get<Equipment & { success: boolean }>('/calculator-testing/equipment'),
      ]);
      if (!schemaRes.success || !schemaRes.data) {
        throw new Error(schemaRes.error || 'Failed to load calculator schema');
      }
      if (!equipmentRes.success || !equipmentRes.data) {
        throw new Error(equipmentRes.error || 'Failed to load equipment catalog');
      }
      setSchema(schemaRes.data);
      setEquipment(equipmentRes.data);
      const defaults: Record<string, number> = {};
      schemaRes.data.radioGroups.forEach((g) => {
        defaults[g.id] = g.defaultValue;
      });
      setRadios(defaults);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [publicMode]);

  useEffect(() => {
    if (canUseScreen) loadData();
  }, [canUseScreen, loadData]);

  // -------------------------------------------------------------------------
  // Visibility + label logic (mirrors backend / workbook VBA)
  // -------------------------------------------------------------------------

  const rulesPass = useCallback(
    (rules?: VisibilityRule[]) => {
      if (!rules || rules.length === 0) return true;
      return rules.every((rule) => rule.in.includes(radios[rule.group]));
    },
    [radios],
  );

  const consumptionKey = `${radios['current_tariff']}-${radios['usage_known']}`;

  const isFieldVisible = useCallback(
    (field: Field) => {
      if (repView && field.hiddenFromReps) return false;
      if (!rulesPass(field.visibleWhen)) return false;
      if (CONSUMPTION_FIELD_IDS.includes(field.id)) {
        const allowed = schema?.consumptionMatrix[consumptionKey] || [];
        if (!allowed.includes(field.id)) return false;
      }
      return true;
    },
    [repView, rulesPass, schema, consumptionKey],
  );

  const fieldLabel = useCallback(
    (field: Field) => {
      let label = field.label;
      if (field.labelByState) {
        label =
          field.labelByState[consumptionKey] ||
          field.labelByState[`${radios['current_tariff']}-*`] ||
          field.label;
      }
      if (repView && field.repLabel) label = field.repLabel;
      return label;
    },
    [consumptionKey, radios, repView],
  );

  // -------------------------------------------------------------------------
  // Equipment dropdown options (with savings-basis + rep-view filtering)
  // -------------------------------------------------------------------------

  const savingsBasis = radios['battery_savings'];

  const filteredBatteries = useMemo(() => {
    if (!equipment) return [];
    return equipment.batteries.filter((b) => {
      if (repView && !b.repVisible) return false;
      if (savingsBasis === 4) return b.intelligentFluxCompatible;
      if (savingsBasis === 5 || savingsBasis === 8) return b.leveliseCompatible;
      return true;
    });
  }, [equipment, repView, savingsBasis]);

  const filteredInverters = useMemo(() => {
    if (!equipment) return [];
    return equipment.inverters.filter((i) => {
      if (repView && !i.repVisible) return false;
      if (savingsBasis === 5) return i.leveliseCompatible;
      return true;
    });
  }, [equipment, repView, savingsBasis]);

  const getDropdownOptions = useCallback(
    (field: Field): string[] => {
      if (field.staticOptions) return field.staticOptions;
      if (!equipment) return [];
      switch (field.dropdownSource) {
        case 'panel_manufacturer':
          return [...new Set(equipment.panels.map((p) => p.manufacturer))];
        case 'panel_model':
          return equipment.panels
            .filter((p) => p.manufacturer === inputs['panel_manufacturer'])
            .map((p) => p.model);
        case 'panel_wattage': {
          const model = equipment.panels.find(
            (p) => p.model === inputs['panel_model'],
          );
          if (!model || model.minWattage == null || model.maxWattage == null)
            return [];
          const options: string[] = [];
          for (let w = model.minWattage; w <= model.maxWattage; w += 5) {
            options.push(String(w));
          }
          return options;
        }
        case 'battery_manufacturer':
          return [...new Set(filteredBatteries.map((b) => b.manufacturer))];
        case 'battery_model':
          return filteredBatteries
            .filter((b) => b.manufacturer === inputs['battery_manufacturer'])
            .map((b) => b.model);
        case 'inverter_manufacturer':
          return [...new Set(filteredInverters.map((i) => i.manufacturer))];
        case 'inverter_model':
          return filteredInverters
            .filter((i) => i.manufacturer === inputs['inverter_manufacturer'])
            .map((i) => i.model);
        default:
          return [];
      }
    },
    [equipment, inputs, filteredBatteries, filteredInverters],
  );

  // -------------------------------------------------------------------------
  // State updates (with workbook-style cascading clears)
  // -------------------------------------------------------------------------

  const CASCADES: Record<string, string[]> = useMemo(
    () => ({
      panel_manufacturer: ['panel_model', 'panel_wattage'],
      panel_model: ['panel_wattage'],
      battery_manufacturer: ['battery_model'],
      inverter_manufacturer: ['inverter_model'],
    }),
    [],
  );

  const setInputValue = useCallback(
    (fieldId: string, value: string) => {
      setInputs((prev) => {
        const next = { ...prev, [fieldId]: value };
        (CASCADES[fieldId] || []).forEach((child) => {
          delete next[child];
        });
        return next;
      });
      setPreview(null);
      if (fieldId === 'no_of_arrays') {
        const count = Number(value) || 0;
        setArrays((prev) => {
          const next = prev.slice(0, count);
          while (next.length < count) next.push({});
          return next;
        });
      }
    },
    [CASCADES],
  );

  const setArrayValue = useCallback(
    (index: number, columnId: string, value: string) => {
      setArrays((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [columnId]: value };
        return next;
      });
      setPreview(null);
    },
    [],
  );

  const selectRadio = useCallback((groupId: string, value: number) => {
    setRadios((prev) => ({ ...prev, [groupId]: value }));
    setPreview(null);
  }, []);

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  const runPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      if (publicMode) {
        const response = await calculatorTestingPublicApi.preview<
          PreviewResult & { success: boolean }
        >({ radios, inputs, arrays });
        if (response.success && response.data) {
          setPreview(response.data);
        }
        return;
      }

      const response = await api.post<PreviewResult & { success: boolean }>(
        '/calculator-testing/preview',
        { radios, inputs, arrays },
      );
      if (response.success && response.data) {
        setPreview(response.data);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [publicMode, radios, inputs, arrays]);

  const runSave = useCallback(async () => {
    setSaveLoading(true);
    setSaveError(null);
    setSaveResult(null);
    setPrintResult(null);
    setPrintError(null);
    try {
      if (publicMode) {
        const response = await calculatorTestingPublicApi.save<SaveResult>({
          radios,
          inputs,
          arrays,
        });
        if (response.success && response.data) {
          setSaveResult(response.data);
          if (!preview) {
            const previewResponse = await calculatorTestingPublicApi.preview<
              PreviewResult & { success: boolean }
            >({ radios, inputs, arrays });
            if (previewResponse.success && previewResponse.data) {
              setPreview(previewResponse.data);
            }
          }
        } else {
          setSaveError(response.error || 'Save failed');
        }
        return;
      }

      const response = await api.post<SaveResult & { success: boolean }>(
        '/calculator-testing/save',
        { radios, inputs, arrays },
      );
      if (response.success && response.data) {
        setSaveResult(response.data);
      } else {
        setSaveError('Save failed');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  }, [publicMode, radios, inputs, arrays, preview]);

  const runPrintContract = useCallback(async () => {
    setPrintLoading(true);
    setPrintError(null);
    setPrintResult(null);
    setSaveError(null);
    try {
      if (publicMode) {
        const response = await calculatorTestingPublicApi.printContract<PrintResult>({
          radios,
          inputs,
          arrays,
        });
        if (response.success && response.data) {
          setPrintResult(response.data);
          setSaveResult(response.data);
          if (!preview) {
            const previewResponse = await calculatorTestingPublicApi.preview<
              PreviewResult & { success: boolean }
            >({ radios, inputs, arrays });
            if (previewResponse.success && previewResponse.data) {
              setPreview(previewResponse.data);
            }
          }
        } else {
          setPrintError(response.error || 'Contract PDF export failed');
        }
        return;
      }

      const response = await api.post<PrintResult & { success: boolean }>(
        '/calculator-testing/print-contract',
        { radios, inputs, arrays },
      );
      if (response.success && response.data) {
        setPrintResult(response.data);
        setSaveResult(response.data);
      } else {
        setPrintError('Contract PDF export failed');
      }
    } catch (err: any) {
      setPrintError(err?.message || 'Contract PDF export failed');
    } finally {
      setPrintLoading(false);
    }
  }, [publicMode, radios, inputs, arrays, preview]);

  const runRecalculate = useCallback(async () => {
    setPrintLoading(true);
    setPrintError(null);
    setPrintResult(null);
    setSaveError(null);
    try {
      if (publicMode) {
        const response = await calculatorTestingPublicApi.recalculate<PrintResult>({
          radios,
          inputs,
          arrays,
        });
        if (response.success && response.data) {
          setPrintResult(response.data);
          setSaveResult(response.data);
        } else {
          setPrintError(response.error || 'Recalculate failed');
        }
        return;
      }

      const response = await api.post<PrintResult & { success: boolean }>(
        '/calculator-testing/recalculate',
        { radios, inputs, arrays },
      );
      if (response.success && response.data) {
        setPrintResult(response.data);
        setSaveResult(response.data);
      } else {
        setPrintError('Recalculate failed');
      }
    } catch (err: any) {
      setPrintError(err?.message || 'Recalculate failed');
    } finally {
      setPrintLoading(false);
    }
  }, [publicMode, radios, inputs, arrays]);

  const openDownload = useCallback((fileName: string) => {
    if (publicMode) {
      const url = calculatorTestingPublicApi.downloadUrl(fileName);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
        return;
      }
      Linking.openURL(url);
      return;
    }
    Linking.openURL(`/calculator-testing/download/${encodeURIComponent(fileName)}`);
  }, [publicMode]);

  // -------------------------------------------------------------------------
  // Guards / loading states
  // -------------------------------------------------------------------------

  if (!canUseScreen) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primaryBackground }]}
      >
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={40} color={theme.secondaryText} />
          <Text style={[styles.deniedText, { color: theme.primaryText }]}>
            Admin access required.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primaryBackground }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={{ color: theme.secondaryText, marginTop: 12 }}>
            Loading v4.4 calculator schema…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !schema || !equipment) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.primaryBackground }]}
      >
        <View style={styles.centered}>
          <Ionicons name="warning" size={40} color={theme.dangerButton} />
          <Text style={[styles.deniedText, { color: theme.primaryText }]}>
            {loadError || 'Failed to load calculator testing data'}
          </Text>
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: theme.primaryButton }]}
            onPress={loadData}
          >
            <Text style={styles.primaryActionText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderHiddenBadge = (note?: string) => (
    <View style={[styles.hiddenBadge, { borderColor: theme.warningButton }]}>
      <Ionicons name="eye-off" size={11} color={theme.warningButton} />
      <Text style={[styles.hiddenBadgeText, { color: theme.warningButton }]}>
        {note || 'Hidden from reps'}
      </Text>
    </View>
  );

  const renderTemplateStep = () => (
    <View>
      <Text style={[styles.stepIntro, { color: theme.secondaryText }]}>
        The v4.4 workbook replaces the separate Flux and Off-Peak templates.
        There is one template — the savings basis is chosen with a radio
        question in the next step instead of picking a different file.
      </Text>
      <TouchableOpacity
        style={[
          styles.templateCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: templateSelected ? theme.primaryButton : theme.borderColor,
            borderWidth: templateSelected ? 2 : 1,
          },
        ]}
        onPress={() => setTemplateSelected(true)}
      >
        <View style={styles.templateHeader}>
          <Ionicons
            name={templateSelected ? 'checkmark-circle' : 'document'}
            size={26}
            color={templateSelected ? theme.primaryButton : theme.secondaryText}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.templateTitle, { color: theme.primaryText }]}>
              EPVS Member Calculator v4.4
            </Text>
            <Text style={[styles.templateSubtitle, { color: theme.secondaryText }]}>
              {schema.template.fileName}
            </Text>
          </View>
        </View>
        <Text style={[styles.templateDescription, { color: theme.secondaryText }]}>
          {schema.template.description}
        </Text>
        <View style={styles.templateMetaRow}>
          <View
            style={[
              styles.metaPill,
              {
                backgroundColor: schema.template.exists
                  ? theme.successButton + '22'
                  : theme.dangerButton + '22',
              },
            ]}
          >
            <Text
              style={{
                color: schema.template.exists ? theme.successButton : theme.dangerButton,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {schema.template.exists ? 'Template file found' : 'Template file missing!'}
            </Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: theme.primaryButton + '22' }]}>
            <Text style={{ color: theme.primaryButton, fontSize: 12, fontWeight: '600' }}>
              Max {schema.template.maxArrays} arrays
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.primaryAction,
          {
            backgroundColor: templateSelected ? theme.primaryButton : theme.borderColor,
          },
        ]}
        disabled={!templateSelected}
        onPress={() => setStep(1)}
      >
        <Text style={styles.primaryActionText}>Continue to Questions</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuestionsStep = () => (
    <View>
      {schema.radioGroups
        .filter((group) => !(repView && group.hiddenFromReps))
        .map((group) => (
          <View
            key={group.id}
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
                {group.question}
              </Text>
              {!repView && group.hiddenFromReps && renderHiddenBadge(group.note)}
            </View>
            <Text style={[styles.cellRef, { color: theme.secondaryText }]}>
              → {group.linkCell}
              {group.vbaToggle ? `  ·  VBA: ${group.vbaToggle}` : ''}
            </Text>
            <View style={styles.optionsWrap}>
              {group.options
                .filter((option) => !(repView && option.hiddenFromReps))
                .map((option) => {
                  const selected = radios[group.id] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: selected
                            ? theme.primaryButton
                            : theme.primaryBackground,
                          borderColor: selected ? theme.primaryButton : theme.borderColor,
                        },
                      ]}
                      onPress={() => selectRadio(group.id, option.value)}
                    >
                      <Text
                        style={{
                          color: selected ? '#ffffff' : theme.primaryText,
                          fontSize: 13,
                          fontWeight: selected ? '600' : '400',
                        }}
                      >
                        {option.label}
                      </Text>
                      {!repView && option.hiddenFromReps && (
                        <Ionicons
                          name="eye-off"
                          size={12}
                          color={selected ? '#ffffff' : theme.warningButton}
                          style={{ marginLeft: 5 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>
        ))}
      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: theme.primaryButton }]}
        onPress={() => setStep(2)}
      >
        <Text style={styles.primaryActionText}>Continue to Inputs</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFieldInput = (field: Field) => {
    const value = inputs[field.id] || '';
    if (field.type === 'dropdown') {
      const options = getDropdownOptions(field);
      const disabled =
        !!field.dependsOn && !inputs[field.dependsOn];
      return (
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            {
              backgroundColor: theme.primaryBackground,
              borderColor: theme.borderColor,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          disabled={disabled}
          onPress={() =>
            setDropdownField({
              fieldId: field.id,
              label: fieldLabel(field),
              options,
            })
          }
        >
          <Text
            style={{ color: value ? theme.primaryText : theme.secondaryText, fontSize: 14 }}
            numberOfLines={1}
          >
            {value ||
              (disabled ? `Select ${field.dependsOn?.replace(/_/g, ' ')} first` : 'Select…')}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.secondaryText} />
        </TouchableOpacity>
      );
    }
    return (
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: theme.primaryBackground,
            borderColor: theme.borderColor,
            color: theme.primaryText,
          },
        ]}
        value={value}
        onChangeText={(text) => setInputValue(field.id, text)}
        placeholder={field.type === 'date' ? 'e.g. 01/06/2020' : ''}
        placeholderTextColor={theme.secondaryText}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
      />
    );
  };

  const renderArraysTable = () => {
    const count = Number(inputs['no_of_arrays'] || 0);
    if (!count || (repView && radios['installing_new_solar'] !== 1)) return null;
    if (radios['installing_new_solar'] !== 1) return null;
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
          SAP Arrays ({count} of {schema.arrayTable.maxArrays})
        </Text>
        <Text style={[styles.cellRef, { color: theme.secondaryText }]}>
          Rows {schema.arrayTable.firstRow}–{schema.arrayTable.firstRow + count - 1} · panel
          size / array size / irradiance are formulas, not inputs
        </Text>
        {arrays.map((arrayRow, index) => (
          <View
            key={index}
            style={[styles.arrayRow, { borderColor: theme.borderColor }]}
          >
            <Text style={[styles.arrayRowTitle, { color: theme.primaryText }]}>
              Array {index + 1}
            </Text>
            {schema.arrayTable.columns.map((column) => (
              <View key={column.id} style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
                  {column.label}{' '}
                  <Text style={{ fontSize: 10 }}>
                    ({column.column}
                    {schema.arrayTable.firstRow + index})
                  </Text>
                </Text>
                {column.type === 'dropdown' && column.staticOptions ? (
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      {
                        backgroundColor: theme.primaryBackground,
                        borderColor: theme.borderColor,
                      },
                    ]}
                    onPress={() =>
                      setDropdownField({
                        fieldId: column.id,
                        label: column.label,
                        options: column.staticOptions || [],
                        arrayIndex: index,
                      })
                    }
                  >
                    <Text style={{ color: theme.primaryText, fontSize: 14 }}>
                      {arrayRow[column.id] || 'Select…'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.secondaryText} />
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.primaryBackground,
                        borderColor: theme.borderColor,
                        color: theme.primaryText,
                      },
                    ]}
                    value={arrayRow[column.id] || ''}
                    onChangeText={(text) => setArrayValue(index, column.id, text)}
                    keyboardType="numeric"
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderInputsStep = () => (
    <View>
      {schema.sections.map((section) => {
        if (!rulesPass(section.visibleWhen)) return null;
        const visibleFields = section.fields.filter(isFieldVisible);
        if (visibleFields.length === 0) return null;
        return (
          <View
            key={section.id}
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
              {section.title}
            </Text>
            {visibleFields.map((field) => (
              <View key={field.id} style={styles.fieldRow}>
                <View style={styles.fieldLabelRow}>
                  <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
                    {fieldLabel(field)}
                    {field.required ? ' *' : ''}{' '}
                    <Text style={{ fontSize: 10 }}>({field.cell})</Text>
                  </Text>
                  {!repView && field.hiddenFromReps && renderHiddenBadge()}
                </View>
                {renderFieldInput(field)}
                {!repView && field.note ? (
                  <Text style={[styles.fieldNote, { color: theme.secondaryText }]}>
                    {field.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}
      {renderArraysTable()}
      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: theme.primaryButton }]}
        onPress={() => {
          setStep(3);
          runPreview();
        }}
      >
        <Text style={styles.primaryActionText}>Review Write Preview</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPreviewStep = () => (
    <View>
      <Text style={[styles.stepIntro, { color: theme.secondaryText }]}>
        Preview shows which cells would be written. Use &quot;Recalculate&quot; to save
        via Excel and force a full calculation, or &quot;Print Contract PDF&quot; to run
        the built-in PrintProposal macro. Mac + Excel required.
      </Text>
      {previewLoading ? (
        <ActivityIndicator size="large" color={theme.primaryButton} style={{ marginVertical: 24 }} />
      ) : preview ? (
        <>
          {preview.warnings.length > 0 && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.warningButton + '15', borderColor: theme.warningButton },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.warningButton }]}>
                Warnings ({preview.warnings.length})
              </Text>
              {preview.warnings.map((warning, i) => (
                <Text key={i} style={[styles.warningText, { color: theme.primaryText }]}>
                  • {warning}
                </Text>
              ))}
            </View>
          )}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
              Radio Buttons ({preview.radioWrites.length})
            </Text>
            {preview.radioWrites.map((rw) => (
              <View key={rw.groupId} style={[styles.writeRow, { borderColor: theme.borderColor }]}>
                <Text style={[styles.writeTarget, { color: theme.primaryButton }]}>
                  {rw.linkCell} = {rw.value}
                </Text>
                <Text style={[styles.writeLabel, { color: theme.primaryText }]}>
                  {rw.optionLabel}
                </Text>
                <Text style={[styles.writeMeta, { color: theme.secondaryText }]}>
                  {rw.question}
                  {rw.shapeName ? `  ·  shape: ${rw.shapeName}` : ''}
                  {rw.vbaToggle ? `  ·  ${rw.vbaToggle}` : ''}
                </Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>
              Cell Writes ({preview.cellWrites.length})
            </Text>
            {preview.cellWrites.length === 0 && (
              <Text style={{ color: theme.secondaryText, fontSize: 13 }}>
                No input values entered yet.
              </Text>
            )}
            {preview.cellWrites.map((cw) => (
              <View key={cw.fieldId} style={[styles.writeRow, { borderColor: theme.borderColor }]}>
                <Text style={[styles.writeTarget, { color: theme.primaryButton }]}>
                  {cw.target}
                </Text>
                <Text style={[styles.writeLabel, { color: theme.primaryText }]}>
                  {String(cw.value)}
                </Text>
                <Text style={[styles.writeMeta, { color: theme.secondaryText }]}>{cw.label}</Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Note</Text>
            <Text style={{ color: theme.secondaryText, fontSize: 13, lineHeight: 19 }}>
              {preview.summary.writeOrderNote}
            </Text>
          </View>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.primaryAction, { backgroundColor: theme.primaryButton }]}
          onPress={runPreview}
        >
          <Text style={styles.primaryActionText}>Generate Preview</Text>
        </TouchableOpacity>
      )}
      {preview && !previewLoading && (
        <>
          <TouchableOpacity
            style={[
              styles.primaryAction,
              { backgroundColor: theme.successButton || theme.primaryButton },
            ]}
            onPress={runRecalculate}
            disabled={printLoading || saveLoading}
          >
            {printLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryActionText}>Recalculate (Excel)</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryAction,
              { backgroundColor: theme.primaryButton },
            ]}
            onPress={runPrintContract}
            disabled={printLoading || saveLoading}
          >
            <Text style={styles.primaryActionText}>Print Contract PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: theme.primaryButton }]}
            onPress={runSave}
            disabled={saveLoading || printLoading}
          >
            {saveLoading ? (
              <ActivityIndicator color={theme.primaryButton} />
            ) : (
              <Text style={{ color: theme.primaryButton, fontWeight: '600' }}>
                Create Excel Copy (openpyxl)
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: theme.borderColor }]}
            onPress={runPreview}
          >
            <Text style={{ color: theme.primaryText, fontWeight: '600' }}>
              Refresh Preview
            </Text>
          </TouchableOpacity>
        </>
      )}
      {saveError && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.dangerButton + '15', borderColor: theme.dangerButton },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.dangerButton }]}>Save failed</Text>
          <Text style={{ color: theme.primaryText, fontSize: 13 }}>{saveError}</Text>
        </View>
      )}
      {printError && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.dangerButton + '15', borderColor: theme.dangerButton },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.dangerButton }]}>
            Contract PDF failed
          </Text>
          <Text style={{ color: theme.primaryText, fontSize: 13 }}>{printError}</Text>
          <Text style={[styles.writeMeta, { color: theme.secondaryText, marginTop: 8 }]}>
            Requires Microsoft Excel on your Mac with macros enabled. Excel will open
            briefly, write your values, run PrintProposal, then export the PDF.
          </Text>
        </View>
      )}
      {printResult && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: (theme.successButton || theme.primaryButton) + '15',
              borderColor: theme.successButton || theme.primaryButton,
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { color: theme.successButton || theme.primaryButton },
            ]}
          >
            {printResult.pdfGenerated === false
              ? 'Excel opened — finish PDF in Excel'
              : 'Contract PDF ready'}
          </Text>
          <Text style={{ color: theme.primaryText, fontSize: 13, marginBottom: 8 }}>
            {printResult.message}
          </Text>
          {printResult.pdfFileName ? (
            <Text style={[styles.writeMeta, { color: theme.secondaryText }]}>
              {printResult.pdfFileName} · macro: {printResult.macro}
            </Text>
          ) : (
            <Text style={[styles.writeMeta, { color: theme.secondaryText }]}>
              macro: {printResult.macro} · workbook opened in Excel
            </Text>
          )}
          {printResult.pdfFileName ? (
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: theme.primaryButton, marginTop: 12 }]}
              onPress={() => openDownload(printResult.pdfFileName!)}
            >
              <Text style={styles.primaryActionText}>Download Contract PDF</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              printResult.pdfFileName ? styles.secondaryAction : styles.primaryAction,
              {
                borderColor: theme.primaryButton,
                marginTop: printResult.pdfFileName ? 8 : 12,
                ...(printResult.pdfFileName
                  ? {}
                  : { backgroundColor: theme.primaryButton }),
              },
            ]}
            onPress={() => openDownload(printResult.fileName)}
          >
            <Text
              style={{
                color: printResult.pdfFileName ? theme.primaryButton : '#fff',
                fontWeight: '600',
              }}
            >
              Download Excel Copy
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {saveResult && !printResult && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: (theme.successButton || theme.primaryButton) + '15',
              borderColor: theme.successButton || theme.primaryButton,
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { color: theme.successButton || theme.primaryButton },
            ]}
          >
            Excel copy created
          </Text>
          <Text style={{ color: theme.primaryText, fontSize: 13, marginBottom: 8 }}>
            {saveResult.message}
          </Text>
          <Text style={[styles.writeMeta, { color: theme.secondaryText }]}>
            {saveResult.fileName}
            {saveResult.sheetsWritten?.length
              ? ` · sheets: ${saveResult.sheetsWritten.join(', ')}`
              : ''}
          </Text>
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: theme.primaryButton, marginTop: 12 }]}
            onPress={() => openDownload(saveResult.fileName)}
          >
            <Text style={styles.primaryActionText}>Download .xlsm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primaryBackground }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity
          onPress={() => (publicMode ? navigation.navigate('Login') : navigation.goBack())}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
            Calculator Testing — v4.4
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            {publicMode
              ? `Local dev · no login · ${calculatorTestingPublicApi.getBaseUrl()}`
              : 'Sandbox · does not touch live calculators'}
          </Text>
        </View>
        <View style={styles.repToggle}>
          <Text style={{ color: theme.secondaryText, fontSize: 11, marginRight: 4 }}>
            Rep view
          </Text>
          <Switch
            value={repView}
            onValueChange={(v) => {
              setRepView(v);
              setPreview(null);
            }}
            trackColor={{ true: theme.primaryButton, false: theme.borderColor }}
          />
        </View>
      </View>

      {/* Step tabs */}
      <View style={[styles.stepTabs, { borderBottomColor: theme.borderColor }]}>
        {STEPS.map((label, index) => (
          <TouchableOpacity
            key={label}
            style={[
              styles.stepTab,
              index === step && {
                borderBottomColor: theme.primaryButton,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setStep(index)}
          >
            <Text
              style={{
                color: index === step ? theme.primaryButton : theme.secondaryText,
                fontWeight: index === step ? '700' : '400',
                fontSize: 13,
              }}
            >
              {index + 1}. {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        {step === 0 && renderTemplateStep()}
        {step === 1 && renderQuestionsStep()}
        {step === 2 && renderInputsStep()}
        {step === 3 && renderPreviewStep()}
      </ScrollView>

      {/* Dropdown modal */}
      <Modal
        visible={dropdownField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownField(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownField(null)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.cardBackground, borderColor: theme.borderColor },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              {dropdownField?.label}
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {(dropdownField?.options || []).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.modalOption, { borderBottomColor: theme.borderColor }]}
                  onPress={() => {
                    if (!dropdownField) return;
                    if (dropdownField.arrayIndex !== undefined) {
                      setArrayValue(dropdownField.arrayIndex, dropdownField.fieldId, option);
                    } else {
                      setInputValue(dropdownField.fieldId, option);
                    }
                    setDropdownField(null);
                  }}
                >
                  <Text style={{ color: theme.primaryText, fontSize: 14 }}>{option}</Text>
                </TouchableOpacity>
              ))}
              {dropdownField && dropdownField.options.length === 0 && (
                <Text style={{ color: theme.secondaryText, padding: 12, fontSize: 13 }}>
                  No options available for the current selections.
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  deniedText: { fontSize: 16, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  repToggle: { flexDirection: 'row', alignItems: 'center' },
  stepTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  stepTab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  scrollContent: { padding: 14, paddingBottom: 48 },
  stepIntro: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  templateCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  templateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  templateTitle: { fontSize: 16, fontWeight: '700' },
  templateSubtitle: { fontSize: 11, marginTop: 2 },
  templateDescription: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  templateMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  cellRef: { fontSize: 11, marginTop: 3, marginBottom: 8 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  hiddenBadgeText: { fontSize: 10, fontWeight: '600' },
  fieldRow: { marginTop: 10 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  fieldNote: { fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'web' ? 8 : 9,
    fontSize: 14,
  },
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrayRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  arrayRowTitle: { fontSize: 13, fontWeight: '700' },
  primaryAction: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  primaryActionText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryAction: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  writeRow: { borderTopWidth: 1, paddingVertical: 8, marginTop: 6 },
  writeTarget: { fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  writeLabel: { fontSize: 13, marginTop: 2 },
  writeMeta: { fontSize: 11, marginTop: 2 },
  warningText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { borderRadius: 12, borderWidth: 1, padding: 16, maxHeight: 480 },
  modalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  modalOption: { paddingVertical: 11, borderBottomWidth: 1 },
});
