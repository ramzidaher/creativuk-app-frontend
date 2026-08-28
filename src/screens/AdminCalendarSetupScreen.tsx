import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../utils/api';

type SetupUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: string;
  calendars: InstallerRow[];
};

type InstallerRow = {
  id?: string;
  graphUserId: string;
  email: string;
  displayName: string;
  sharedCalendarId?: string | null;
  sharedCalendarName?: string | null;
  canAssign?: boolean;
};

export default function AdminCalendarSetupScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [users, setUsers] = useState<SetupUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assigned, setAssigned] = useState<InstallerRow[]>([]);
  const [query, setQuery] = useState('');
  const [repQuery, setRepQuery] = useState('');
  const [people, setPeople] = useState<InstallerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL || '/api').replace(/\/$/, '');

  const authHeaders = async () => {
    const token = await authApi.getAccessToken();
    return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' };
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/admin/calendar-setup/users`, {
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to load users');
      setUsers(data.users || []);
    } catch (error) {
      Alert.alert('Could not load users', error instanceof Error ? error.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    const selected = users.find((row) => row.id === selectedUserId);
    setAssigned(selected?.calendars || []);
    setPeople([]);
    setQuery('');
  }, [selectedUserId, users]);

  useEffect(() => {
    if (!selectedUserId || query.trim().length < 2) {
      setPeople([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `${apiBase}/admin/calendar-setup/people?q=${encodeURIComponent(query.trim())}`,
          { headers: await authHeaders() },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.message || 'Search failed');
        setPeople(data.people || []);
      } catch (error) {
        Alert.alert('Search failed', error instanceof Error ? error.message : 'Try again');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [apiBase, query, selectedUserId]);

  const addPerson = (person: InstallerRow) => {
    if (!person.canAssign && !person.email) {
      Alert.alert(
        'No Microsoft 365 email',
        `${person.displayName} does not have a mailbox we can book. Pick someone with a creativuk.co.uk email.`,
      );
      return;
    }
    if (assigned.some((row) => row.graphUserId === person.graphUserId || row.graphUserId === person.id)) {
      return;
    }
    setAssigned((prev) => [
      ...prev,
      {
        graphUserId: person.graphUserId || (person as any).id,
        email: person.email || (person as any).mail,
        displayName: person.displayName,
        sharedCalendarId: person.sharedCalendarId,
        sharedCalendarName: person.sharedCalendarName,
      },
    ]);
    setQuery('');
    setPeople([]);
  };

  const removePerson = (graphUserId: string) => {
    setAssigned((prev) => prev.filter((row) => row.graphUserId !== graphUserId));
  };

  const save = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}/admin/calendar-setup/${selectedUserId}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({
          installers: assigned.map((row) => ({
            graphUserId: row.graphUserId,
            email: row.email,
            displayName: row.displayName,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Save failed');
      setAssigned(data.calendars || assigned);
      Alert.alert('Saved', 'Installers updated for this sales rep.');
      await loadUsers();
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <Text style={{ color: theme.primaryText, padding: 24 }}>Admin access required.</Text>
      </SafeAreaView>
    );
  }

  const selectedUser = users.find((row) => row.id === selectedUserId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.secondaryText} />
        </TouchableOpacity>
        <View>
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Installer calendars</Text>
        <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
          Pick a rep, add the installers they can book
        </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: theme.primaryText }]}>Sales rep</Text>
        <TextInput
          value={repQuery}
          onChangeText={setRepQuery}
          placeholder="Find a rep"
          placeholderTextColor={theme.secondaryText}
          style={[
            styles.search,
            { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText },
          ]}
        />
        {loading ? (
          <ActivityIndicator color={theme.primaryButton} />
        ) : (
          <View style={styles.userList}>
            {users
              .filter((row) => {
                const haystack = `${row.name || ''} ${row.username}`.toLowerCase();
                return haystack.includes(repQuery.trim().toLowerCase());
              })
              .map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={[
                    styles.userChip,
                    {
                      borderColor: selectedUserId === row.id ? theme.primaryButton : theme.cardBorder,
                      backgroundColor: selectedUserId === row.id ? theme.primaryButton : theme.cardBackground,
                    },
                  ]}
                  onPress={() => setSelectedUserId(row.id)}
                >
                  <Text
                    style={{
                      color: selectedUserId === row.id ? '#fff' : theme.primaryText,
                      fontWeight: '600',
                    }}
                  >
                    {(row.name || row.username).split(/\s+/)[0]}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {selectedUser ? (
          <>
            <Text style={[styles.label, { color: theme.primaryText }]}>
              {selectedUser.name || selectedUser.username}
            </Text>
            {assigned.length === 0 ? (
              <Text style={{ color: theme.secondaryText, marginBottom: 12 }}>None yet. Search below.</Text>
            ) : (
              <View style={styles.userList}>
                {assigned.map((row) => (
                  <View
                    key={row.graphUserId}
                    style={[styles.assignedChip, { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}
                  >
                    <Text style={{ color: theme.primaryText, fontWeight: '600' }}>
                      {row.displayName.split(/\s+/)[0]}
                    </Text>
                    <TouchableOpacity onPress={() => removePerson(row.graphUserId)}>
                      <Feather name="x" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.label, { color: theme.primaryText }]}>Add installer</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Philip, Darren…"
              placeholderTextColor={theme.secondaryText}
              style={[
                styles.search,
                { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText },
              ]}
            />
            {searching ? <ActivityIndicator color={theme.primaryButton} style={{ marginVertical: 8 }} /> : null}
            {people.map((person) => {
              const id = person.graphUserId || (person as any).id;
              const mail = person.email || (person as any).mail;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.personRow, { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}
                  onPress={() => addPerson({ ...person, graphUserId: id, email: mail })}
                >
                  <Text style={{ color: theme.primaryText, fontWeight: '600', flex: 1 }}>{person.displayName}</Text>
                  <Feather name={person.canAssign ? 'plus' : 'slash'} size={18} color={theme.primaryButton} />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primaryButton, opacity: saving ? 0.7 : 1 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ color: theme.secondaryText, marginTop: 16 }}>Select a sales rep.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  content: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  userList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  userChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  assignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  saveButton: { marginTop: 16, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
