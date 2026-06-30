import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
import { presentationApi, workflowApi } from '../utils/api';

const HOMETREE_URL = 'https://hometreefinance.co.uk/dashboard/login';

interface RouteParams {
  opportunityId: string;
}

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
    essSavingsYear1Gbp: string | null;
    totalSavingsYear1Gbp: string | null;
  };
  quote: {
    totalPriceIncludingVatGbp: string;
  };
}

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
    <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: '#166534' }]}>{title}</Text>
      {description ? (
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

export default function HometreeDataScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HometreeQuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingHometree, setOpeningHometree] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await presentationApi.getHometreeQuoteData(opportunityId);
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || 'Failed to load Hometree data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Hometree data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
        if (!supported) {
          throw new Error('Cannot open Hometree URL');
        }
        await Linking.openURL(HOMETREE_URL);
      }

      try {
        await workflowApi.completeStep(opportunityId, 6, {
          openedAt: new Date().toISOString(),
          url: HOMETREE_URL,
          usedHometreeHelper: true,
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

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && { height: '100vh' as any, maxHeight: '100vh' as any },
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Hometree Quote Helper</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Copy values from your contract into Hometree
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
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading contract data…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={theme.errorText || '#dc2626'} />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>Could not load data</Text>
          <Text style={[styles.errorText, { color: theme.secondaryText }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => {
              setLoading(true);
              loadData();
            }}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={[styles.infoBanner, { backgroundColor: isDark ? '#14532d33' : '#ecfdf5', borderColor: '#86efac' }]}>
            <Feather name="info" size={18} color="#166534" />
            <Text style={[styles.infoBannerText, { color: isDark ? '#bbf7d0' : '#166534' }]}>
              These values are pulled from your EPVS calculator / contract ({data.calculatorType}). Open Hometree
              in another tab and copy each field across — no need to cross-reference both documents manually.
            </Text>
          </View>

          {data.sourceFile ? (
            <Text style={[styles.metaText, { color: theme.secondaryText }]}>
              Source: {data.sourceFile}
            </Text>
          ) : null}

          <Section title="Customer Details" theme={theme}>
            <DataRow label="Reference" value={data.customer.reference} theme={theme} onCopy={handleCopy} />
            <DataRow label="First Name" value={data.customer.firstName} theme={theme} onCopy={handleCopy} />
            <DataRow label="Last Name" value={data.customer.lastName} theme={theme} onCopy={handleCopy} />
            <DataRow label="Installation Postcode" value={data.customer.postcode} theme={theme} onCopy={handleCopy} />
            <DataRow label="Installation Address" value={data.customer.address} theme={theme} onCopy={handleCopy} />
          </Section>

          {data.solarPanel && (
            <Section
              title="Solar Panel"
              description="Manufacturer, type, model, units and warranty"
              theme={theme}
            >
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

          <Section title="Generation" description="Predicted total net output for year 1" theme={theme}>
            <DataRow
              label="Solar generation during year 1"
              value={formatKwh(data.generation.solarGenerationYear1Kwh)}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>

          <Section
            title="Savings"
            description="If you don't have separate solar and ESS savings, enter the total in the solar savings field"
            theme={theme}
          >
            <DataRow
              label="Solar savings during year 1"
              value={formatCurrency(data.savings.solarSavingsYear1Gbp)}
              theme={theme}
              onCopy={handleCopy}
            />
            <DataRow
              label="ESS savings during year 1"
              value={formatCurrency(data.savings.essSavingsYear1Gbp)}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>

          <Section title="Quote" description="Total quote price including VAT" theme={theme}>
            <DataRow
              label="Total quote price (including VAT)"
              value={formatCurrency(data.quote.totalPriceIncludingVatGbp)}
              theme={theme}
              onCopy={handleCopy}
            />
          </Section>

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

          <Text style={[styles.footerNote, { color: theme.secondaryText }]}>
            After filling in Hometree, screenshot the application (panel, inverter, battery, generation) and send
            it to the office in Teams for approval.
          </Text>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorTitle: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  errorText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  metaText: { fontSize: 12, marginBottom: 16 },
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
  dataLabel: { fontSize: 12, fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  dataValue: { fontSize: 16, fontWeight: '500' },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  hometreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  hometreeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
});
