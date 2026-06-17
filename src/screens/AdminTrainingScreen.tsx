import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import { useTheme } from '../context/ThemeContext';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import {
  adminAnalyticsApi,
  adminOpportunityDetailsApi,
  TrainingProgram,
  trainingApi,
} from '../utils/api';

interface UserOption {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#3b82f6',
  COMPLETED: '#22c55e',
  CANCELLED: '#94a3b8',
};

const AdminTrainingScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const permissions = useAdminPermissions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [startingFor, setStartingFor] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [programsRes, usersRes] = await Promise.all([
        trainingApi.listPrograms(),
        adminOpportunityDetailsApi.getAllUsersWithOpportunities().catch(() =>
          adminAnalyticsApi.getAllUsers(),
        ),
      ]);

      if (programsRes.success && programsRes.data) {
        const list = (programsRes.data as any).programs ?? programsRes.data;
        setPrograms(Array.isArray(list) ? list : []);
      } else {
        setPrograms([]);
        setLoadError(programsRes.error || 'Failed to load training programs.');
      }

      if (usersRes.success) {
        const data = usersRes.data?.data || usersRes.data || [];
        const arr = Array.isArray(data) ? data : [];
        const list: UserOption[] = [];
        arr.forEach((item: any) => {
          const user = item?.user ?? item;
          const id = user.id ?? user.userId;
          if (id && (user.role === 'SURVEYOR' || !user.role)) {
            list.push({
              id,
              name: user.name || user.username || user.email || 'Unknown',
            });
          }
        });
        setUsers(list);
      }
    } catch (e) {
      console.error('AdminTraining load error:', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load training programs.');
      Alert.alert('Error', 'Failed to load training programs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleStartTraining = async (userId: string, userName: string) => {
    Alert.alert(
      'Start Training',
      `Start training program for ${userName}? This creates 5 test scenarios.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setStartingFor(userId);
            try {
              const res = await trainingApi.startProgram(userId);
              if (res.success && res.data) {
                const program = res.data as TrainingProgram;
                Alert.alert('Success', 'Training program started.');
                navigation.navigate('AdminTrainingProgress', { programId: program.id });
                loadData();
              } else {
                Alert.alert('Error', res.error || 'Failed to start training.');
              }
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to start training.');
            } finally {
              setStartingFor(null);
            }
          },
        },
      ],
    );
  };

  const activeProgramUserIds = new Set(
    programs.filter((p) => p.status === 'ACTIVE').map((p) => p.userId),
  );

  if (!permissions.isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <AdminGuard showAlert={false}>
          <View />
        </AdminGuard>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Training Management</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Start and monitor sales rep training
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {loadError ? (
            <View style={[styles.errorCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={styles.errorTitle}>Could not load training programs</Text>
              <Text style={styles.errorText}>{loadError}</Text>
              <Text style={styles.errorHint}>
                If this mentions database tables, restart the backend after running: npx prisma migrate deploy
              </Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Start training for rep</Text>
          {users.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No surveyors found.</Text>
          ) : (
            users.map((user) => {
              const hasActive = activeProgramUserIds.has(user.id);
              return (
                <View
                  key={user.id}
                  style={[styles.userCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                >
                  <View style={styles.userInfo}>
                    <Feather name="user" size={18} color={theme.primaryButton} />
                    <Text style={[styles.userName, { color: theme.primaryText }]}>{user.name}</Text>
                  </View>
                  {hasActive ? (
                    <Text style={[styles.activeBadge, { color: '#3b82f6' }]}>Active program</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.startButton, { backgroundColor: theme.primaryButton }]}
                      disabled={startingFor === user.id}
                      onPress={() => handleStartTraining(user.id, user.name)}
                    >
                      {startingFor === user.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.startButtonText}>Start Training</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          <Text style={[styles.sectionTitle, { color: theme.primaryText, marginTop: 24 }]}>
            Training programs
          </Text>
          {programs.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No training programs yet.</Text>
          ) : (
            programs.map((program) => (
              <TouchableOpacity
                key={program.id}
                style={[styles.programCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                onPress={() => navigation.navigate('AdminTrainingProgress', { programId: program.id })}
              >
                <View style={styles.programHeader}>
                  <Text style={[styles.programName, { color: theme.primaryText }]}>
                    {program.user?.name || program.user?.username || 'Unknown rep'}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[program.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[program.status] }]}>
                      {program.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.programMeta, { color: theme.secondaryText }]}>
                  {program.summary?.completedScenarios ?? 0}/{program.summary?.totalScenarios ?? 5} scenarios complete
                  {' · '}
                  Started {new Date(program.startedAt).toLocaleDateString()}
                </Text>
                <Feather name="chevron-right" size={18} color={theme.secondaryText} style={styles.chevron} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  errorCard: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#b91c1c', marginBottom: 6 },
  errorText: { fontSize: 13, color: '#7f1d1d', lineHeight: 18 },
  errorHint: { fontSize: 12, color: '#991b1b', marginTop: 8, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  emptyText: { fontSize: 14, marginBottom: 8 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  userName: { fontSize: 15, fontWeight: '500' },
  activeBadge: { fontSize: 13, fontWeight: '600' },
  startButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 110, alignItems: 'center' },
  startButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  programCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    position: 'relative',
  },
  programHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 },
  programName: { fontSize: 15, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  programMeta: { fontSize: 13, marginTop: 6 },
  chevron: { position: 'absolute', right: 14, top: '50%' },
});

export default AdminTrainingScreen;
