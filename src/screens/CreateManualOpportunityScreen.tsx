import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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
import AdminGuard from '../components/AdminGuard';
import { useTheme } from '../context/ThemeContext';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import {
  adminAnalyticsApi,
  adminOpportunityDetailsApi,
  opportunitiesApi,
  CreateManualOpportunityDto,
} from '../utils/api';
import { formatScheduledAtDisplay } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch {
    // not available
  }
}

/** Format Date for datetime-local input value (YYYY-MM-DDTHH:mm) */
function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface UserOption {
  id: string;
  name: string;
}

const CreateManualOpportunityScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const permissions = useAdminPermissions();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showScheduledPicker, setShowScheduledPicker] = useState(false);

  const [form, setForm] = useState({
    name: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    assignedUserId: '',
    scheduledAt: null as Date | null,
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      let response = await adminOpportunityDetailsApi.getAllUsersWithOpportunities();
      if (!response.success && response.error?.includes('404')) {
        response = await adminAnalyticsApi.getAllUsers();
      }
      if (response.success) {
        const data = response.data?.data || response.data || [];
        const arr = Array.isArray(data) ? data : [];
        const list: UserOption[] = [];
        arr.forEach((item: any) => {
          const user = item?.user ?? item;
          const id = user.id ?? user.userId;
          if (id) {
            list.push({
              id,
              name: user.name || user.username || user.email || 'Unknown',
            });
          }
        });
        setUsers(list);
      }
    } catch (e) {
      console.error('Error loading users:', e);
      Alert.alert('Error', 'Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectedUserName = form.assignedUserId
    ? users.find((u) => u.id === form.assignedUserId)?.name ?? 'Select user'
    : 'Select user';

  const validate = (): boolean => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Opportunity name is required.');
      return false;
    }
    if (!form.customerName.trim()) {
      Alert.alert('Validation', 'Customer name is required.');
      return false;
    }
    if (!form.assignedUserId) {
      Alert.alert('Validation', 'Please assign the opportunity to a user.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const dto: CreateManualOpportunityDto = {
      name: form.name.trim(),
      customerName: form.customerName.trim(),
      assignedUserId: form.assignedUserId,
    };
    if (form.customerEmail.trim()) dto.customerEmail = form.customerEmail.trim();
    if (form.customerPhone.trim()) dto.customerPhone = form.customerPhone.trim();
    if (form.customerAddress.trim()) dto.customerAddress = form.customerAddress.trim();
    if (form.scheduledAt) dto.scheduledAt = form.scheduledAt.toISOString();

    setSubmitting(true);
    try {
      const response = await opportunitiesApi.createManualOpportunity(dto);
      if (response.success && response.data) {
        setSubmitting(false);
        const opportunityId = response.data.id || response.data.ghlOpportunityId;
        // Navigate away first so user always leaves the screen (Alert can be unreliable on web)
        navigation.replace('OpportunityManagement');
        Alert.alert('Success', 'Manual opportunity created.', [
          { text: 'OK' },
          {
            text: 'View details',
            onPress: () => opportunityId && navigation.navigate('AdminOpportunityDetails', { opportunityId }),
          },
        ]);
      } else {
        setSubmitting(false);
        Alert.alert('Error', response.error || 'Failed to create manual opportunity.');
      }
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Error', (e as Error)?.message || 'Failed to create manual opportunity.');
    }
  };

  if (!permissions.isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Create manual opportunity</Text>
          <View style={styles.headerRight} />
        </View>
        <AdminGuard showAlert={false}>
          <View />
        </AdminGuard>
      </SafeAreaView>
    );
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.inputBackground ?? theme.cardBackground, color: theme.primaryText, borderColor: theme.cardBorder },
  ];
  const labelStyle = [styles.label, { color: theme.primaryText }];

  return (
    <AdminGuard>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.primaryBackground },
          Platform.OS === 'web' && { height: '100vh', maxHeight: '100vh' },
        ]}
      >
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.borderColor }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.primaryText }]}>Create manual opportunity</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              Add an opportunity and assign it to a user
            </Text>
          </View>
        </View>

        {loadingUsers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading users...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={labelStyle}>Opportunity name *</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. Home Survey - Smith"
                placeholderTextColor={theme.secondaryText}
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                editable={!submitting}
              />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer name *</Text>
              <TextInput
                style={inputStyle}
                placeholder="Full name"
                placeholderTextColor={theme.secondaryText}
                value={form.customerName}
                onChangeText={(t) => setForm((f) => ({ ...f, customerName: t }))}
                editable={!submitting}
              />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer email (optional)</Text>
              <TextInput
                style={inputStyle}
                placeholder="email@example.com"
                placeholderTextColor={theme.secondaryText}
                value={form.customerEmail}
                onChangeText={(t) => setForm((f) => ({ ...f, customerEmail: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!submitting}
              />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer phone (optional)</Text>
              <TextInput
                style={inputStyle}
                placeholder="Phone number"
                placeholderTextColor={theme.secondaryText}
                value={form.customerPhone}
                onChangeText={(t) => setForm((f) => ({ ...f, customerPhone: t }))}
                keyboardType="phone-pad"
                editable={!submitting}
              />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer address (optional)</Text>
              <TextInput
                style={[inputStyle, styles.textArea]}
                placeholder="Address"
                placeholderTextColor={theme.secondaryText}
                value={form.customerAddress}
                onChangeText={(t) => setForm((f) => ({ ...f, customerAddress: t }))}
                multiline
                numberOfLines={2}
                editable={!submitting}
              />

              <Text style={[labelStyle, { marginTop: 16 }]}>Scheduled date & time (optional)</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.datetimeWebWrap}>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt ? toDateTimeLocalValue(form.scheduledAt) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({
                        ...f,
                        scheduledAt: v ? new Date(v) : null,
                      }));
                    }}
                    style={{
                      backgroundColor: theme.inputBackground ?? theme.cardBackground,
                      border: `1px solid ${theme.cardBorder}`,
                      color: theme.primaryText,
                      fontSize: 16,
                      padding: 12,
                      borderRadius: 10,
                      width: '100%',
                      fontFamily: 'inherit',
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.pickerTouch, { backgroundColor: theme.inputBackground ?? theme.cardBackground, borderColor: theme.cardBorder }]}
                    onPress={() => setShowScheduledPicker(true)}
                    disabled={submitting}
                  >
                    <Text style={[styles.pickerText, { color: form.scheduledAt ? theme.primaryText : theme.secondaryText }]}>
                      {form.scheduledAt ? formatScheduledAtDisplay(form.scheduledAt) : 'Not set (optional)'}
                    </Text>
                    <Feather name="calendar" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                  {showScheduledPicker && DateTimePicker && (
                    <Modal visible transparent animationType="slide">
                      <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowScheduledPicker(false)}
                      >
                        <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onStartShouldSetResponder={() => true}>
                          <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Scheduled date & time</Text>
                          <DateTimePicker
                            value={form.scheduledAt || new Date()}
                            mode="datetime"
                            display="spinner"
                            onChange={(_, date) => {
                              if (date) setForm((f) => ({ ...f, scheduledAt: date }));
                            }}
                          />
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            <TouchableOpacity
                              style={[styles.modalClose, { flex: 1, backgroundColor: theme.cardBorder }]}
                              onPress={() => {
                                setForm((f) => ({ ...f, scheduledAt: null }));
                                setShowScheduledPicker(false);
                              }}
                            >
                              <Text style={[styles.modalCloseText, { color: theme.primaryText }]}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.modalClose, { flex: 1, backgroundColor: theme.primaryButton }]}
                              onPress={() => setShowScheduledPicker(false)}
                            >
                              <Text style={[styles.modalCloseText, { color: '#fff' }]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}
                </>
              )}

              <Text style={[labelStyle, { marginTop: 16 }]}>Assign to *</Text>
              <TouchableOpacity
                style={[styles.pickerTouch, { backgroundColor: theme.inputBackground ?? theme.cardBackground, borderColor: theme.cardBorder }]}
                onPress={() => setShowUserPicker(true)}
                disabled={submitting}
              >
                <Text style={[styles.pickerText, { color: form.assignedUserId ? theme.primaryText : theme.secondaryText }]}>
                  {selectedUserName}
                </Text>
                <Feather name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primaryButton },
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create opportunity</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        <Modal visible={showUserPicker} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowUserPicker(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select user</Text>
              <ScrollView style={styles.modalScroll}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.modalItem,
                      { borderBottomColor: theme.cardBorder },
                      form.assignedUserId === u.id && { backgroundColor: theme.primaryButton + '20' },
                    ]}
                    onPress={() => {
                      setForm((f) => ({ ...f, assignedUserId: u.id }));
                      setShowUserPicker(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, { color: theme.primaryText }]}>{u.name}</Text>
                    {form.assignedUserId === u.id && (
                      <Feather name="check" size={20} color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.modalClose, { backgroundColor: theme.cardBorder }]}
                onPress={() => setShowUserPicker(false)}
              >
                <Text style={[styles.modalCloseText, { color: theme.primaryText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 16 },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerRight: { width: 48 },
  headerText: { alignItems: 'center' },
  title: { fontSize: width < 768 ? 28 : 34, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: width < 768 ? 16 : 24, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 72 },
  datetimeWebWrap: { width: '100%', marginBottom: 0 },
  pickerTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerText: { fontSize: 16 },
  submitButton: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalScroll: { maxHeight: 320 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  modalItemText: { fontSize: 16 },
  modalClose: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
});

export default CreateManualOpportunityScreen;
