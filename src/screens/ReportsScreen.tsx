import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, reportsApi } from '../utils/api';

const { width } = Dimensions.get('window');

type SummaryData = {
  stats: {
    soldCount: number;
    quotedCount: number;
    appointmentsCount: number;
    satAppointmentsCount?: number;
    /** Percent sold vs appointments, or null when there are wins but no appointment rows in range. */
    conversionRate: number | null;
    totalValue: number;
  };
  items: Array<{
    opportunityId: string;
    userId?: string | null;
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
    appointmentCustomers?: string[];
    conversionRate: number | null;
    totalValue: number;
  }>;
  /** Admin-only: survey page 2 → contract / quote / 2h cap (not shown to surveyors). */
  cycleTiming?: {
    completedCount: number;
    avgDurationSeconds: number | null;
    medianDurationSeconds: number | null;
    byEndReason: Record<string, number>;
  };
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [series, setSeries] = useState<TimeseriesData | null>(null);
  const [userSoldItems, setUserSoldItems] = useState<SummaryData['items']>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; name: string; role?: string | null }>>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const targetUserId = isAdmin ? selectedRepId || undefined : user?.id;
  const startDateIso = useMemo(() => (startDate ? startDate.toISOString() : undefined), [startDate]);
  const endDateIso = useMemo(() => (endDate ? endDate.toISOString() : undefined), [endDate]);

  const selectedRepName = useMemo(() => {
    if (!selectedRepId) return 'All reps';
    return adminUsers.find((u) => u.id === selectedRepId)?.name || 'Selected rep';
  }, [adminUsers, selectedRepId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, seriesRes, scopedSummaryRes] = await Promise.all([
      reportsApi.getSummary(startDateIso, endDateIso, targetUserId),
      reportsApi.getTimeseries(startDateIso, endDateIso, targetUserId),
      targetUserId ? reportsApi.getSummary(startDateIso, endDateIso, targetUserId) : Promise.resolve(null),
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
    if (scopedSummaryRes?.success) {
      setUserSoldItems(scopedSummaryRes.data?.items || []);
    } else {
      setUserSoldItems((summaryRes.data?.items as SummaryData['items']) || []);
    }
    setLoading(false);
  }, [startDateIso, endDateIso, targetUserId]);

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    const usersRes = await adminAnalyticsApi.getAllUsers();
    if (!usersRes.success || !usersRes.data) {
      return;
    }
    const rawUsers = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.users;
    const reps = (Array.isArray(rawUsers) ? rawUsers : [])
      .filter((u: any) => !!u?.id && u?.role !== 'ADMIN')
      .map((u: any) => ({ id: String(u.id), name: String(u.name || u.email || 'Unknown'), role: u.role || null }));
    setAdminUsers(reps);
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadAdminUsers();
      load();
    }, [load, loadAdminUsers]),
  );

  const onDateRangeChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleExportCsv = async () => {
    if (!isAdmin) {
      Alert.alert('CSV Export', 'Export is available to admin users only.');
      return;
    }

    const csvRes = await reportsApi.exportCsv(startDateIso, endDateIso, targetUserId);
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
  const myDeals = userSoldItems ?? [];
  const myTopDeals = myDeals.slice(0, 8);
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    (summary?.byUser || []).forEach((u) => {
      map.set(u.userId, u.userName || 'Unknown');
    });
    return map;
  }, [summary?.byUser]);
  const chartRows = series?.rows ?? [];
  const maxSold = Math.max(1, ...chartRows.map((row) => row.soldCount));

  const formatConversion = (rate: number | null | undefined) => {
    if (rate === null || rate === undefined) return '—';
    return `${rate.toFixed(1)}%`;
  };

  const formatPounds = (amount: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={22} color={theme.primaryText} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.primaryText }]}>Reports</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            {isAdmin
              ? `Reporting scope: ${selectedRepId ? selectedRepName : 'Company-wide'}`
              : 'Your performance reporting'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={[
          styles.scrollView,
          { backgroundColor: 'transparent' },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          },
        ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primaryButton} />}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled
        scrollEnabled
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
      >
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          placeholder="Select reporting range"
        />

        {isAdmin ? (
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Rep filter</Text>
            <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
              Select a rep to run appointments, sat appointments, quote/sold, conversion and value reporting.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.repFilterRow}>
              <TouchableOpacity
                style={[
                  styles.repChip,
                  {
                    backgroundColor: !selectedRepId ? theme.primaryButton : theme.inputBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => setSelectedRepId(null)}
              >
                <Text style={[styles.repChipText, { color: !selectedRepId ? '#fff' : theme.primaryText }]}>All reps</Text>
              </TouchableOpacity>
              {adminUsers.map((rep) => {
                const active = selectedRepId === rep.id;
                return (
                  <TouchableOpacity
                    key={rep.id}
                    style={[
                      styles.repChip,
                      {
                        backgroundColor: active ? theme.primaryButton : theme.inputBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={() => setSelectedRepId(rep.id)}
                  >
                    <Text style={[styles.repChipText, { color: active ? '#fff' : theme.primaryText }]}>{rep.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primaryButton }]} onPress={load}>
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>{loading ? 'Loading...' : 'Refresh'}</Text>
          </TouchableOpacity>
          {isAdmin ? (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.successButton }]} onPress={handleExportCsv}>
              <Feather name="download" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Export CSV</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.grid}>
          <StatCard label="Sold" value={`${summary?.stats.soldCount ?? 0}`} color={theme.primaryButton} />
          <StatCard label="Quoted" value={`${summary?.stats.quotedCount ?? 0}`} color={theme.successButton} />
          <StatCard
            label={isAdmin ? 'Sat Appts' : 'Appointments'}
            value={`${isAdmin ? summary?.stats.satAppointmentsCount ?? 0 : summary?.stats.appointmentsCount ?? 0}`}
            color={theme.secondaryButton}
          />
          <StatCard
            label="Conversion"
            value={formatConversion(summary?.stats.conversionRate)}
            color={theme.warningButton}
          />
        </View>
        {isAdmin ? (
          <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
            Admin conversion uses fully sat appointments only (quoted/won), excluding incomplete or rescheduled visits.
          </Text>
        ) : null}

        <View style={[styles.valueCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.valueLabel, { color: theme.secondaryText }]}>Total Value</Text>
          <Text style={[styles.valueAmount, { color: theme.primaryText }]}>
            {formatPounds(summary?.stats.totalValue ?? 0)}
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
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
            {isAdmin ? 'Sold appointments (all users)' : 'Top deals'}
          </Text>
          {allDeals.length > topDeals.length ? (
            <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
              Showing {topDeals.length} of {allDeals.length} deals. Total value above includes all deals in range.
            </Text>
          ) : null}
          {(isAdmin ? allDeals.length : topDeals.length) === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No sold records in this range.</Text>
          ) : (
            (isAdmin ? allDeals : topDeals).map((item) => (
              <View key={item.opportunityId} style={styles.dealRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dealName, { color: theme.primaryText }]}>{item.customerName || 'Unknown customer'}</Text>
                  {isAdmin ? (
                    <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                      Sold by: {item.userId ? userNameById.get(item.userId) || 'Unknown user' : 'Unknown user'}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.dealValue, { color: theme.successButton }]}>{formatPounds(item.value)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
            {isAdmin ? 'Appointment customers by rep' : 'Your appointment customers'}
          </Text>
          <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
            Shows customer names for each appointment used in the appointment count.
          </Text>
          {(summary?.byUser || []).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No appointment customer data in this range.</Text>
          ) : (
            (isAdmin ? summary?.byUser || [] : (summary?.byUser || []).slice(0, 1)).map((row) => (
              <View key={`appt-customers-${row.userId}`} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dealName, { color: theme.primaryText }]}>{row.userName}</Text>
                  <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                    {row.appointmentsCount} appointments
                  </Text>
                  {row.appointmentCustomers && row.appointmentCustomers.length > 0 ? (
                    <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                      Customers: {row.appointmentCustomers.join(', ')}
                    </Text>
                  ) : (
                    <Text style={[styles.userMeta, { color: theme.secondaryText }]}>Customers: —</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Your sold customers</Text>
          <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
            {isAdmin && selectedRepId
              ? `This list is based on sold deals for ${selectedRepName}.`
              : 'This list is always based on your own sold deals and customer names.'}
          </Text>
          {myDeals.length > myTopDeals.length ? (
            <Text style={[styles.dealsCaption, { color: theme.secondaryText }]}>
              Showing {myTopDeals.length} of {myDeals.length} sold records.
            </Text>
          ) : null}
          {myTopDeals.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No sold records for your user in this range.</Text>
          ) : (
            myTopDeals.map((item) => (
              <View key={`my-${item.opportunityId}`} style={styles.dealRow}>
                <Text style={[styles.dealName, { color: theme.primaryText }]}>{item.customerName || 'Unknown customer'}</Text>
                <Text style={[styles.dealValue, { color: theme.successButton }]}>
                  {formatPounds(item.value)}
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
                    {row.appointmentCustomers && row.appointmentCustomers.length > 0 ? (
                      <Text style={[styles.userMeta, { color: theme.secondaryText }]}>
                        Appt customers: {row.appointmentCustomers.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.dealValue, { color: theme.successButton }]}>
                      {formatPounds(row.totalValue)}
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
      {/* Root must close SafeAreaView (not View) — matches opening tag above */}
    </SafeAreaView>
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: 18,
    paddingHorizontal: width < 768 ? 16 : 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerText: {
    alignItems: 'center',
  },
  title: { fontSize: width < 768 ? 24 : 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 6, textAlign: 'center', fontWeight: '500' },
  /** Same pattern as ProfileScreen / SolarWorkflowScreen — flex fills space under header so ScrollView scrolls. */
  scrollView: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: width < 768 ? 16 : 20,
    paddingTop: 12,
  },
  scrollContent: { gap: 12, paddingBottom: 48 },
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
  repFilterRow: { flexDirection: 'row', gap: 8 },
  repChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repChipText: { fontSize: 12, fontWeight: '600' },
});
