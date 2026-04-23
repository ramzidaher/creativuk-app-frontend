import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateRangePicker from '../components/DateRangePicker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { adminAnalyticsApi, reportsApi } from '../utils/api';

type CycleReport = {
  totals?: {
    completedCount: number;
    averageDurationSeconds: number | null;
    medianDurationSeconds: number | null;
    p90DurationSeconds: number | null;
    minDurationSeconds: number | null;
    maxDurationSeconds: number | null;
    byEndReason?: Record<string, number>;
  };
  byUser?: Array<{
    userId: string | null;
    userName: string;
    userRole: string | null;
    completedCount: number;
    averageDurationSeconds: number | null;
    medianDurationSeconds: number | null;
    p90DurationSeconds: number | null;
    minDurationSeconds: number | null;
    maxDurationSeconds: number | null;
    byEndReason?: Record<string, number>;
    lastEndedAt?: string | null;
  }>;
  records?: Array<{
    id: string;
    ghlOpportunityId: string;
    userId: string | null;
    userName: string;
    userRole: string | null;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    durationMinutes: number;
    endReason: 'WON_CONTRACT_SIGNED' | 'LOST_QUOTED' | 'TIMEOUT_2H' | string;
  }>;
};

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const prettyEndReason = (reason: string) => {
  if (reason === 'WON_CONTRACT_SIGNED') return 'Contract signed';
  if (reason === 'LOST_QUOTED') return 'Quoted';
  if (reason === 'TIMEOUT_2H') return '2h cap';
  return reason;
};

export default function AppointmentCycleTimeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CycleReport | null>(null);
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
    if (!isAdmin) {
      setReport(null);
      return;
    }
    setLoading(true);
    const res = await reportsApi.getAppointmentCycleReport(startDateIso, endDateIso, targetUserId);
    if (!res.success) {
      Alert.alert('Appointment cycle', res.error || 'Unable to load cycle timing report');
      setLoading(false);
      return;
    }
    setReport(res.data || null);
    setLoading(false);
  }, [endDateIso, isAdmin, startDateIso, targetUserId]);

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    const usersRes = await adminAnalyticsApi.getAllUsers();
    if (!usersRes.success || !usersRes.data) return;
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

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.primaryText }]}>Appointment cycle time</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
            This report is available to admin users only.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totals = report?.totals;
  const byUser = report?.byUser ?? [];
  const records = report?.records ?? [];

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.primaryText }]}>Appointment cycle time</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            Dedicated cycle-time reporting: {selectedRepId ? selectedRepName : 'all reps'}.
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
            minHeight: '100vh',
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
          onDateRangeChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          placeholder="Select cycle report range"
        />

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Rep filter</Text>
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

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primaryButton }]} onPress={load}>
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>{loading ? 'Loading...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <MetricCard label="Completed cycles" value={`${totals?.completedCount ?? 0}`} color={theme.primaryButton} />
          <MetricCard
            label="Average duration"
            value={formatDuration(totals?.averageDurationSeconds)}
            color={theme.successButton}
          />
          <MetricCard
            label="Median duration"
            value={formatDuration(totals?.medianDurationSeconds)}
            color={theme.secondaryButton}
          />
          <MetricCard label="P90 duration" value={formatDuration(totals?.p90DurationSeconds)} color={theme.warningButton} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Overall end reasons</Text>
          <View style={styles.reasonRow}>
            <Text style={[styles.reasonLabel, { color: theme.secondaryText }]}>Contract signed</Text>
            <Text style={[styles.reasonValue, { color: theme.primaryText }]}>
              {totals?.byEndReason?.WON_CONTRACT_SIGNED ?? 0}
            </Text>
          </View>
          <View style={styles.reasonRow}>
            <Text style={[styles.reasonLabel, { color: theme.secondaryText }]}>Quoted</Text>
            <Text style={[styles.reasonValue, { color: theme.primaryText }]}>{totals?.byEndReason?.LOST_QUOTED ?? 0}</Text>
          </View>
          <View style={styles.reasonRow}>
            <Text style={[styles.reasonLabel, { color: theme.secondaryText }]}>2h cap</Text>
            <Text style={[styles.reasonValue, { color: theme.primaryText }]}>{totals?.byEndReason?.TIMEOUT_2H ?? 0}</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>By rep</Text>
          {byUser.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No cycle data in this date range.</Text>
          ) : (
            byUser.map((rep) => (
              <View key={rep.userId ?? `unknown-${rep.userName}`} style={styles.repRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.repName, { color: theme.primaryText }]}>{rep.userName}</Text>
                  <Text style={[styles.repMeta, { color: theme.secondaryText }]}>
                    {rep.userRole || 'Unknown role'} - {rep.completedCount} cycles
                  </Text>
                  <Text style={[styles.repMeta, { color: theme.secondaryText }]}>
                    Avg {formatDuration(rep.averageDurationSeconds)} | Median {formatDuration(rep.medianDurationSeconds)} | P90{' '}
                    {formatDuration(rep.p90DurationSeconds)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.repReasonText, { color: theme.primaryText }]}>
                    {rep.byEndReason?.WON_CONTRACT_SIGNED ?? 0} won
                  </Text>
                  <Text style={[styles.repReasonText, { color: theme.secondaryText }]}>{rep.byEndReason?.LOST_QUOTED ?? 0} quoted</Text>
                  <Text style={[styles.repReasonText, { color: theme.secondaryText }]}>{rep.byEndReason?.TIMEOUT_2H ?? 0} timeout</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Cycle records</Text>
          <Text style={[styles.helperText, { color: theme.secondaryText }]}>
            Detailed rows show how long each rep stayed in the appointment cycle for each opportunity.
          </Text>
          {records.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No detailed records in this range.</Text>
          ) : (
            records.slice(0, 200).map((row) => (
              <View key={row.id} style={[styles.recordRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recordTitle, { color: theme.primaryText }]}>{row.userName}</Text>
                  <Text style={[styles.repMeta, { color: theme.secondaryText }]}>
                    Opp: {row.ghlOpportunityId} - {prettyEndReason(row.endReason)}
                  </Text>
                  <Text style={[styles.repMeta, { color: theme.secondaryText }]}>
                    Start: {new Date(row.startedAt).toLocaleString()} | End: {new Date(row.endedAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.recordDuration, { color: theme.primaryButton }]}>{formatDuration(row.durationSeconds)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderColor: `${color}66` }]}>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  scrollView: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 12 },
  scrollContent: { gap: 12, paddingBottom: 40 },
  actionRow: { flexDirection: 'row', gap: 8 },
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
  metricCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 18, marginTop: 6, fontWeight: '700', color: '#111827' },
  sectionCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  helperText: { fontSize: 12, lineHeight: 18 },
  reasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reasonLabel: { fontSize: 13 },
  reasonValue: { fontSize: 14, fontWeight: '700' },
  repRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  repName: { fontSize: 14, fontWeight: '700' },
  repMeta: { fontSize: 12, marginTop: 2 },
  repReasonText: { fontSize: 12, fontWeight: '600' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  recordTitle: { fontSize: 13, fontWeight: '700' },
  recordDuration: { fontSize: 13, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  repFilterRow: { flexDirection: 'row', gap: 8 },
  repChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repChipText: { fontSize: 12, fontWeight: '600' },
});
