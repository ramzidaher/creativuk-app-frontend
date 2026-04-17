import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { reportsApi } from '../utils/api';

type SummaryData = {
  stats: {
    soldCount: number;
    quotedCount: number;
    appointmentsCount: number;
    /** Percent sold vs appointments, or null when there are wins but no appointment rows in range. */
    conversionRate: number | null;
    totalValue: number;
  };
  items: Array<{
    opportunityId: string;
    customerName: string | null;
    value: number;
  }>;
  byUser?: Array<{
    userId: string;
    userName: string;
    userRole: string | null;
    soldCount: number;
    quotedCount: number;
    appointmentsCount: number;
    conversionRate: number | null;
    totalValue: number;
  }>;
};

type TimeseriesData = {
  rows: Array<{
    month: string;
    soldCount: number;
    conversionRate: number | null;
    totalValue: number;
  }>;
};

export default function ReportsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [series, setSeries] = useState<TimeseriesData | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const startDateIso = useMemo(() => (startDate ? startDate.toISOString() : undefined), [startDate]);
  const endDateIso = useMemo(() => (endDate ? endDate.toISOString() : undefined), [endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, seriesRes] = await Promise.all([
      reportsApi.getSummary(startDateIso, endDateIso),
      reportsApi.getTimeseries(startDateIso, endDateIso),
    ]);
    if (!summaryRes.success) {
      Alert.alert('Reports', summaryRes.error || 'Failed to load reports');
      setLoading(false);
      return;
    }
    if (!seriesRes.success) {
      Alert.alert('Reports', seriesRes.error || 'Failed to load report charts');
      setLoading(false);
      return;
    }
    setSummary(summaryRes.data || null);
    setSeries(seriesRes.data || null);
    setLoading(false);
  }, [startDateIso, endDateIso]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDateRangeChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleExportCsv = async () => {
    const csvRes = await reportsApi.exportCsv(startDateIso, endDateIso);
    if (!csvRes.success || !csvRes.data) {
      Alert.alert('CSV Export', csvRes.error || 'Unable to export CSV');
      return;
    }

    if (Platform.OS === 'web') {
      const blob = new Blob([csvRes.data.content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', csvRes.data.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return;
    }

    Alert.alert(
      'CSV Export',
      'CSV export is available on web for direct download. On mobile, run this from web or we can add file sharing next.',
    );
  };

  const allDeals = summary?.items ?? [];
  const topDeals = allDeals.slice(0, 8);
  const chartRows = series?.rows ?? [];
  const maxSold = Math.max(1, ...chartRows.map((row) => row.soldCount));

  const formatConversion = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return '—';
    return `${rate.toFixed(1)}%`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.title, { color: theme.primaryText }]}>Reports</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
          {isAdmin ? 'Company-wide reporting' : 'Your performance reporting'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          placeholder="Select reporting range"
        />

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primaryButton }]} onPress={load}>
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>{loading ? 'Loading...' : 'Refresh'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.successButton }]} onPress={handleExportCsv}>
            <Feather name="download" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <StatCard label="Sold" value={`${summary?.stats.soldCount ?? 0}`} color={theme.primaryButton} />
          <StatCard label="Quoted" value={`${summary?.stats.quotedCount ?? 0}`} color={theme.successButton} />
          <StatCard label="Appointments" value={`${summary?.stats.appointmentsCount ?? 0}`} color={theme.secondaryButton} />
          <StatCard
            label="Conversion"
            value={formatConversion(summary?.stats.conversionRate)}
            color={theme.warningButton}
          />
        </View>

        <View style={[styles.valueCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.valueLabel, { color: theme.secondaryText }]}>Total Value</Text>
          <Text style={[styles.valueAmount, { color: theme.primaryText }]}>
            GBP {(summary?.stats.totalValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Monthly trend</Text>
          <Text style={[styles.chartHint, { color: theme.secondaryText }]}>
            Bar length = sold count in that month. Right column = conversion (sold ÷ appointments with a scheduled date in range).
          </Text>
          {chartRows.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No data in selected range.</Text>
          ) : (
            chartRows.map((row) => (
              <View key={row.month} style={styles.chartRow}>
                <Text style={[styles.chartLabel, { color: theme.secondaryText }]}>{row.month}</Text>
                <View style={[styles.chartBarTrack, { backgroundColor: theme.inputBackground }]}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        width: `${Math.max(6, (row.soldCount / maxSold) * 100)}%`,
                        backgroundColor: theme.primaryButton,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartValue, { color: theme.primaryText }]}>{row.soldCount}</Text>
                <Text style={[styles.chartRatio, { color: theme.secondaryText }]}>
                  {formatConversion(row.conversionRate)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Top deals</Text>
          {allDeals.length > topDeals.length ? (
            <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
              Showing {topDeals.length} of {allDeals.length} deals. Total value above includes all deals in range.
            </Text>
          ) : null}
          {topDeals.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No sold records in this range.</Text>
          ) : (
            topDeals.map((item) => (
              <View key={item.opportunityId} style={styles.dealRow}>
                <Text style={[styles.dealName, { color: theme.primaryText }]}>{item.customerName || 'Unknown customer'}</Text>
                <Text style={[styles.dealValue, { color: theme.successButton }]}>
                  GBP {item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
            ))
          )}
        </View>

        {isAdmin && (
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>By User</Text>
            {(summary?.byUser || []).length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No user data in this range.</Text>
            ) : (
              (summary?.byUser || []).map((row) => (
                <View key={row.userId} style={styles.userRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dealName, { color: theme.primaryText }]}>{row.userName}</Text>
                    <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                      {row.userRole || 'Unknown role'} - {row.soldCount} sold / {row.appointmentsCount} appts
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.dealValue, { color: theme.successButton }]}>
                      GBP {row.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                      {formatConversion(row.conversionRate)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}66` }]}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 18, paddingHorizontal: 18, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 24, marginTop: 6, fontWeight: '700', color: '#111827' },
  valueCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  valueLabel: { fontSize: 12, fontWeight: '600' },
  valueAmount: { marginTop: 6, fontSize: 28, fontWeight: '800' },
  sectionCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  chartHint: { fontSize: 12, marginBottom: 6, lineHeight: 18 },
  dealsCaption: { fontSize: 12, marginBottom: 8 },
  emptyText: { fontSize: 13 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartLabel: { width: 68, fontSize: 12 },
  chartBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  chartBarFill: { height: '100%', borderRadius: 4 },
  chartValue: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  chartRatio: { width: 45, textAlign: 'right', fontSize: 12 },
  dealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dealName: { flex: 1, fontSize: 14 },
  dealValue: { fontSize: 14, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userMeta: { fontSize: 12, marginTop: 2 },
});
