import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuthReady } from '../hooks/useAuthReady';
import { api, buildApiUrl, getStorage, presentationApi, workflowApi } from '../utils/api';
import { resolveOpportunityIdFromRoute } from '../utils/deepLinkParams';
import {
  ExcelSheetInfo,
  filterRepVisibleSheets,
  pickPreferredRepSheet,
} from '../utils/excelSheetVersion';
import ExcelSheetPicker from '../components/ExcelSheetPicker';

const HOMETREE_URL = 'https://hometreefinance.co.uk/dashboard/login';

type SheetInfo = ExcelSheetInfo & {
  filePath: string;
  size: number;
  lastModified: string;
};

interface HometreeQuoteData {
  opportunityId: string;
  calculatorType: string;
  sourceFile: string;
  extractedAt: string;
  customer: {
    reference: string;
    firstName: string;
    lastName: string;
    postcode: string;
    address: string;
  };
  solarPanel: {
    manufacturer: string;
    type: string;
    model: string;
    units: number;
    warrantyYears: string;
  } | null;
  inverter: {
    manufacturer: string;
    type: string;
    model: string;
    units: number;
    warrantyYears: string;
  } | null;
  battery: {
    manufacturer: string;
    type: string;
    model: string;
    units: number;
    warrantyYears: string;
  } | null;
  generation: {
    solarGenerationYear1Kwh: string;
  };
  savings: {
    solarSavingsYear1Gbp: string | null;
    solarOnlyYear1Gbp?: string | null;
    exportSavingsYear1Gbp?: string | null;
    essSavingsYear1Gbp: string | null;
    totalSavingsYear1Gbp: string | null;
  };
  quote: {
    totalPriceIncludingVatGbp: string;
  };
}

type Step = 'sheets' | 'data';

function DataRow({
  label,
  value,
  theme,
  onCopy,
}: {
  label: string;
  value: string | number | null | undefined;
  theme: any;
  onCopy: (label: string, value: string) => void;
}) {
  const displayValue =
    value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <View style={[styles.dataRow, { borderBottomColor: theme.cardBorder }]}>
      <View style={styles.dataRowText}>
        <Text style={[styles.dataLabel, { color: theme.secondaryText }]}>{label}</Text>
        <Text style={[styles.dataValue, { color: theme.primaryText }]} selectable>
          {displayValue}
        </Text>
      </View>
      {displayValue !== '—' && (
        <TouchableOpacity
          style={[styles.copyButton, { backgroundColor: theme.tertiaryBackground }]}
          onPress={() => onCopy(label, displayValue)}
        >
          <Feather name="copy" size={16} color={theme.primaryButton} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function Section({
  title,
  description,
  theme,
  children,
}: {
  title: string;
  description?: string;
  theme: any;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: '#166534' }]}>{title}</Text>
      {description ? (
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

async function downloadCalculatorSheet(opportunityId: string, sheet: SheetInfo) {
  if (Platform.OS === 'web') {
    const storage = getStorage();
    const token = storage ? await storage.getItem('accessToken') : null;
    if (!token) {
      throw new Error('Authentication required to download file');
    }

    const response = await fetch(buildApiUrl('/opportunity-workflow/sheet/download'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
        Accept: 'application/vnd.ms-excel.sheet.macroEnabled.12, application/octet-stream, */*',
      },
      body: JSON.stringify({ opportunityId, fileName: sheet.fileName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer?.byteLength) {
      throw new Error('Downloaded file is empty');
    }

    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = sheet.fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    return;
  }

  const storage = getStorage();
  const token = storage ? await storage.getItem('accessToken') : null;
  if (!token) {
    throw new Error('Authentication required to download file');
  }

  const response = await fetch(buildApiUrl('/opportunity-workflow/sheet/download'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
      Accept: 'application/vnd.ms-excel.sheet.macroEnabled.12, application/octet-stream, */*',
    },
    body: JSON.stringify({ opportunityId, fileName: sheet.fileName }),
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  Alert.alert('Downloaded', `${sheet.fileName} downloaded. Open it to install or edit the calculator.`);
}

export default function HometreeDataScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const opportunityId = resolveOpportunityIdFromRoute(route.params, 'hometree');
  const { isAuthReady, isLoading: authLoading, isAuthenticated } = useAuthReady();
  const { theme, isDark, toggleTheme } = useTheme();

  const [step, setStep] = useState<Step>('sheets');
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HometreeQuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingHometree, setOpeningHometree] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const loadInFlightRef = useRef(false);
  const sheetsLoadedRef = useRef(false);

  const loadHometreeData = useCallback(
    async (sheet: SheetInfo, options?: { background?: boolean }) => {
      if (!opportunityId || loadInFlightRef.current) {
        return;
      }
      loadInFlightRef.current = true;
      if (!options?.background) {
        setLoadingData(true);
      }
      try {
        setError(null);
        const response = await presentationApi.getHometreeQuoteData(
          opportunityId,
          sheet.calculatorType === 'epvs'
            ? 'flux'
            : (sheet.calculatorType as 'flux' | 'off-peak' | 'v44' | undefined),
          sheet.fileName,
        );
        if (response.success && response.data) {
          setData(response.data);
          setSelectedSheet(sheet);
          setStep('data');
        } else {
          throw new Error(response.error || 'Failed to load Hometree data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Hometree data');
      } finally {
        setLoadingData(false);
        setRefreshing(false);
        loadInFlightRef.current = false;
      }
    },
    [opportunityId],
  );

  const loadAvailableSheets = useCallback(async () => {
    if (!isAuthReady) {
      return;
    }
    if (!opportunityId) {
      setError('Missing opportunity ID in link. Use /hometree/{opportunityId}');
      setLoadingSheets(false);
      return;
    }
    if (loadInFlightRef.current) {
      return;
    }
    try {
      setLoadingSheets(true);
      setError(null);
      const sheetsResponse = await api.post('/opportunity-workflow/get-opportunity-sheets', {
        opportunityId,
      });

      if (sheetsResponse.success) {
        const responseData = sheetsResponse.data as any;
        const actualData = responseData?.data ?? responseData?.sheets ?? responseData;
        const allSheets = Array.isArray(actualData) ? actualData : [];
        const sheets = filterRepVisibleSheets(allSheets as SheetInfo[]) as SheetInfo[];
        setAvailableSheets(sheets);

        // Always show the picker — never auto-load a calculator (reps choose explicitly).
        if (!sheetsLoadedRef.current) {
          sheetsLoadedRef.current = true;
          const preferred = pickPreferredRepSheet(sheets);
          if (preferred) {
            setSelectedSheet(preferred);
          }
        }
      } else {
        throw new Error(sheetsResponse.error || 'Failed to load available calculators');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calculators');
    } finally {
      setLoadingSheets(false);
    }
  }, [opportunityId, isAuthReady, loadHometreeData]);

  useEffect(() => {
    if (isAuthReady) {
      loadAvailableSheets();
    }
  }, [loadAvailableSheets, isAuthReady]);

  const handleRefresh = () => {
    if (step === 'data' && selectedSheet) {
      setRefreshing(true);
      loadHometreeData(selectedSheet);
      return;
    }
    loadAvailableSheets();
  };

  const handleCopy = async (label: string, value: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        Alert.alert('Copied', `${label} copied to clipboard`);
        return;
      }
      Alert.alert(label, value, [{ text: 'OK' }]);
    } catch {
      Alert.alert('Copy failed', 'Select the value and copy manually');
    }
  };

  const openHometree = async () => {
    try {
      setOpeningHometree(true);
      if (Platform.OS === 'web') {
        window.open(HOMETREE_URL, '_blank');
      } else {
        const supported = await Linking.canOpenURL(HOMETREE_URL);
        if (!supported) throw new Error('Cannot open Hometree URL');
        await Linking.openURL(HOMETREE_URL);
      }

      try {
        await workflowApi.completeStep(opportunityId, 6, {
          openedAt: new Date().toISOString(),
          url: HOMETREE_URL,
          usedHometreeHelper: true,
          sourceFile: selectedSheet?.fileName,
        });
      } catch (stepError) {
        console.error('Error completing Hometree step:', stepError);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open Hometree');
    } finally {
      setOpeningHometree(false);
    }
  };

  const handleDownloadCalculator = async (sheet?: SheetInfo | null) => {
    const target = sheet ?? selectedSheet;
    if (!target) {
      Alert.alert('Select a calculator', 'Choose a calculator file first.');
      return;
    }
    try {
      setDownloading(true);
      await downloadCalculatorSheet(opportunityId, target);
    } catch (err) {
      Alert.alert('Download failed', err instanceof Error ? err.message : 'Could not download calculator');
    } finally {
      setDownloading(false);
    }
  };

  const continueToContractGeneration = () => {
    navigation.navigate('ContractGeneration', { opportunityId });
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value || value === '0.00') return value === '0.00' ? '£0.00' : null;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatKwh = (value: string | null | undefined) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
  };

  const renderSheetSelection = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <ExcelSheetPicker
        sheets={availableSheets}
        selectedSheet={selectedSheet}
        onSelect={(sheet) => setSelectedSheet(sheet as SheetInfo)}
        loading={loadingSheets}
        emptyTitle="No calculator found"
        emptyMessage="Complete the calculator step first, then return here to fill in Hometree."
        introText="Select which calculator to use, then tap Load Hometree Data. Values come from your completed calculator — the same data used when you generate the contract next."
        emptyAction={
          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: theme.primaryButton }]}
            onPress={() =>
              navigation.navigate('CustomerDetails', {
                opportunityId,
                calculatorType: 'v44',
              })
            }
          >
            <Feather name="settings" size={18} color={theme.primaryButton} />
            <Text style={[styles.secondaryActionText, { color: theme.primaryButton }]}>
              Open Calculator
            </Text>
          </TouchableOpacity>
        }
        footer={
          availableSheets.length > 0 ? (
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[
                  styles.secondaryAction,
                  { borderColor: theme.cardBorder, opacity: selectedSheet ? 1 : 0.5 },
                ]}
                onPress={() => handleDownloadCalculator(selectedSheet)}
                disabled={!selectedSheet || downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={theme.primaryButton} />
                ) : (
                  <>
                    <Feather name="download" size={18} color={theme.primaryButton} />
                    <Text style={[styles.secondaryActionText, { color: theme.primaryButton }]}>
                      Download Calculator
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryAction,
                  { backgroundColor: theme.primaryButton, opacity: selectedSheet ? 1 : 0.5 },
                ]}
                onPress={() => selectedSheet && loadHometreeData(selectedSheet)}
                disabled={!selectedSheet || loadingData}
              >
                {loadingData ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="arrow-right" size={18} color="#fff" />
                    <Text style={styles.primaryActionText}>Load Hometree Data</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {error ? <Text style={[styles.errorInline, { color: '#dc2626' }]}>{error}</Text> : null}
    </ScrollView>
  );

  const renderDataView = () => {
    if (!data) return null;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Text style={[styles.stepIntro, { color: theme.secondaryText }]}>
          Copy and paste these values into Hometree Finance. Open Hometree using the button below,
          then work through each field.
        </Text>

        <TouchableOpacity
          style={[styles.hometreeButton, { backgroundColor: '#166534' }]}
          onPress={openHometree}
          disabled={openingHometree}
        >
          {openingHometree ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="external-link" size={20} color="#fff" />
              <Text style={styles.hometreeButtonText}>Open Hometree Finance</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.sourceRow}>
          <View style={styles.sourceText}>
            <Text style={[styles.sourceLabel, { color: theme.secondaryText }]}>Using calculator</Text>
            <Text style={[styles.sourceValue, { color: theme.primaryText }]}>
              {data.sourceFile || selectedSheet?.fileName}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.sourceDownload, { borderColor: theme.cardBorder }]}
            onPress={() => handleDownloadCalculator(selectedSheet)}
            disabled={downloading}
          >
            <Feather name="download" size={16} color={theme.primaryButton} />
            <Text style={[styles.sourceDownloadText, { color: theme.primaryButton }]}>Download</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.changeSheetLink, { borderColor: theme.cardBorder }]}
          onPress={() => {
            setStep('sheets');
            setData(null);
          }}
        >
          <Feather name="refresh-cw" size={14} color={theme.secondaryText} />
          <Text style={[styles.changeSheetText, { color: theme.secondaryText }]}>
            Change calculator
          </Text>
        </TouchableOpacity>

        <Section title="Customer Details" theme={theme}>
          <DataRow label="Reference" value={data.customer.reference} theme={theme} onCopy={handleCopy} />
          <DataRow label="First Name" value={data.customer.firstName} theme={theme} onCopy={handleCopy} />
          <DataRow label="Last Name" value={data.customer.lastName} theme={theme} onCopy={handleCopy} />
          <DataRow label="Installation Postcode" value={data.customer.postcode} theme={theme} onCopy={handleCopy} />
          <DataRow label="Installation Address" value={data.customer.address} theme={theme} onCopy={handleCopy} />
        </Section>

        {data.solarPanel && (
          <Section title="Solar Panel" theme={theme}>
            <DataRow label="Manufacturer" value={data.solarPanel.manufacturer} theme={theme} onCopy={handleCopy} />
            <DataRow label="Type (Module)" value={data.solarPanel.type} theme={theme} onCopy={handleCopy} />
            <DataRow label="Model" value={data.solarPanel.model} theme={theme} onCopy={handleCopy} />
            <DataRow label="Units to be installed" value={data.solarPanel.units} theme={theme} onCopy={handleCopy} />
            <DataRow
              label="Product Warranty"
              value={data.solarPanel.warrantyYears ? `${data.solarPanel.warrantyYears} years` : null}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>
        )}

        {data.inverter && (
          <Section title="Inverter" theme={theme}>
            <DataRow label="Manufacturer" value={data.inverter.manufacturer} theme={theme} onCopy={handleCopy} />
            <DataRow label="Type" value={data.inverter.type} theme={theme} onCopy={handleCopy} />
            <DataRow label="Model" value={data.inverter.model} theme={theme} onCopy={handleCopy} />
            <DataRow label="Units to be installed" value={data.inverter.units} theme={theme} onCopy={handleCopy} />
            <DataRow
              label="Product Warranty"
              value={data.inverter.warrantyYears ? `${data.inverter.warrantyYears} years` : null}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>
        )}

        {data.battery && (
          <Section title="Battery Storage" theme={theme}>
            <DataRow label="Manufacturer" value={data.battery.manufacturer} theme={theme} onCopy={handleCopy} />
            <DataRow label="Type" value={data.battery.type} theme={theme} onCopy={handleCopy} />
            <DataRow label="Model" value={data.battery.model} theme={theme} onCopy={handleCopy} />
            <DataRow label="Units to be installed" value={data.battery.units} theme={theme} onCopy={handleCopy} />
            <DataRow
              label="Product Warranty"
              value={data.battery.warrantyYears ? `${data.battery.warrantyYears} years` : null}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>
        )}

        <Section title="Generation" theme={theme}>
          <DataRow
            label="Solar generation during year 1"
            value={formatKwh(data.generation.solarGenerationYear1Kwh)}
            theme={theme}
            onCopy={handleCopy}
          />
        </Section>

        <Section
          title="Savings"
          description="Enter solar + export in the solar field; battery savings go in ESS"
          theme={theme}
        >
          <DataRow
            label="Solar savings during year 1 (solar + export)"
            value={formatCurrency(data.savings.solarSavingsYear1Gbp)}
            theme={theme}
            onCopy={handleCopy}
          />
          <DataRow
            label="ESS savings during year 1 (battery)"
            value={formatCurrency(data.savings.essSavingsYear1Gbp)}
            theme={theme}
            onCopy={handleCopy}
          />
        </Section>

        <Section title="Quote" theme={theme}>
          <DataRow
            label="Total quote price (including VAT)"
            value={formatCurrency(data.quote.totalPriceIncludingVatGbp)}
            theme={theme}
            onCopy={handleCopy}
          />
        </Section>

        <Text style={[styles.footerNote, { color: theme.secondaryText }]}>
          When done, screenshot the Hometree application (panel, inverter, battery, generation) and
          send it to the office in Teams for approval.
        </Text>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && { height: '100vh' as any, maxHeight: '100vh' as any },
      ]}
    >
      {authLoading || (loadingSheets && step === 'sheets') || loadingData ? (
        <View style={[styles.centeredState, { flex: 1 }]}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.centeredStateText, { color: theme.secondaryText }]}>
            {authLoading ? 'Signing in…' : loadingData ? 'Loading Hometree data…' : 'Loading calculators…'}
          </Text>
        </View>
      ) : !isAuthenticated ? (
        <View style={[styles.centeredState, { flex: 1 }]}>
          <Text style={[styles.centeredStateText, { color: theme.primaryText }]}>
            Please log in to open this Hometree link.
          </Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={{ color: theme.primaryButton, marginTop: 12, fontWeight: '600' }}>
              Go to login
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => (step === 'data' ? setStep('sheets') : navigation.goBack())}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Hometree Quote Helper</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {step === 'sheets' ? 'Choose your calculator' : 'Copy values into Hometree'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
            onPress={toggleTheme}
          >
            <Feather name={isDark ? 'sun' : 'moon'} size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primaryButton }]}
          onPress={continueToContractGeneration}
        >
          <Text style={styles.continueButtonText}>Continue to Contract Generation</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {step === 'sheets' ? renderSheetSelection() : renderDataView()}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centeredStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  continueButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  stepIntro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  centeredInline: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 15 },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sheetGroup: { marginBottom: 16 },
  groupLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  sheetOptionMain: { flex: 1 },
  sheetOptionTitle: { fontSize: 16, fontWeight: '600' },
  sheetOptionMeta: { fontSize: 12, marginTop: 4 },
  sheetActions: { gap: 10, marginTop: 8 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryActionText: { fontWeight: '600', fontSize: 14 },
  errorInline: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  hometreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  hometreeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  sourceText: { flex: 1 },
  sourceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  sourceValue: { fontSize: 14, marginTop: 2 },
  sourceDownload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceDownloadText: { fontSize: 13, fontWeight: '600' },
  changeSheetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  changeSheetText: { fontSize: 13, fontWeight: '500' },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionDescription: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dataRowText: { flex: 1 },
  dataLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dataValue: { fontSize: 16, fontWeight: '500' },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  footerNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
});
