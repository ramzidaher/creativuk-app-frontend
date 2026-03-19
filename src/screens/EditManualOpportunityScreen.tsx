import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  api,
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

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface UserOption {
  id: string;
  name: string;
}

const EditManualOpportunityScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const permissions = useAdminPermissions();
  const opportunityId = route.params?.opportunityId as string | undefined;

  const [loading, setLoading] = useState(true);
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
  // When backend returns assignee name but user not in our list, show this so "Assign to" isn't blank
  const [assignedToNameFromApi, setAssignedToNameFromApi] = useState<string>('');
  // Backend may use internal id for PUT; use this for update/delete when set
  const [updateOpportunityId, setUpdateOpportunityId] = useState<string | null>(null);

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
          if (id != null && id !== '') {
            list.push({
              id: String(id),
              name: user.name || user.username || user.email || 'Unknown',
            });
          }
        });
        setUsers(list);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadOpportunity = useCallback(async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'Missing opportunity ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get<any>(`/opportunities/${opportunityId}`);
      const raw = res.success ? res.data : null;
      if (!raw) {
        Alert.alert('Error', res.error || 'Opportunity not found');
        setLoading(false);
        return;
      }
      // Backend may return { opportunity: {...} } or the opportunity directly
      const opp = raw?.opportunity ?? raw;
      // Backend may expect this id for PUT (e.g. internal id); fallback to route param
      const resourceId = opp.id != null && opp.id !== '' ? String(opp.id) : opportunityId;
      setUpdateOpportunityId(resourceId);

      let scheduledAt: Date | null = opp.scheduledAt ? new Date(opp.scheduledAt) : null;
      if (scheduledAt && isNaN(scheduledAt.getTime())) scheduledAt = null;
      let customerAddress = opp.customerAddress || opp.contactAddress || opp.address || '';
      let customerName = opp.customerName || opp.contactName || (opp.contact ? [opp.contact.firstName, opp.contact.lastName].filter(Boolean).join(' ') : '') || (opp.contactFirstName && opp.contactLastName ? `${opp.contactFirstName} ${opp.contactLastName}`.trim() : '') || '';
      // Some backends omit address from the base opportunity response; try details endpoint as fallback.
      if (!customerAddress) {
        try {
          const detailsRes = await api.get<any>(`/opportunities/${opportunityId}/details`);
          const details = detailsRes.success ? detailsRes.data : null;
          if (details) {
            customerAddress =
              details.customerAddress ||
              details.contactAddress ||
              details.address ||
              details.opportunity?.customerAddress ||
              details.opportunity?.contactAddress ||
              details.opportunity?.address ||
              '';
          }
        } catch {
          // ignore fallback errors
        }
      }
      if (!customerName) {
        try {
          const detailsRes = await api.get<any>(`/opportunities/${opportunityId}/details`);
          const details = detailsRes.success ? detailsRes.data : null;
          const d = details?.opportunity ?? details;
          customerName = d?.customerName || d?.contactName || (d?.contactFirstName && d?.contactLastName ? `${d.contactFirstName} ${d.contactLastName}`.trim() : '') || '';
        } catch {
          // ignore
        }
      }
      // Assignee name from API (so we can show it even if user not in our users list)
      const assigneeName =
        opp.owner?.name ?? opp.owner?.username ?? opp.assignedToName ?? opp.assignedTo?.name
        ?? opp.user?.name ?? opp.user?.username ?? opp.assignedUser?.name ?? '';
      setAssignedToNameFromApi(assigneeName || '');

      const assignedToId = typeof opp.assignedTo === 'object' && opp.assignedTo !== null ? (opp.assignedTo as any).id : opp.assignedTo;
      let rawAssigned =
        opp.assignedUserId ??
        opp.userId ??
        opp.ownerId ??
        opp.owner?.id ??
        opp.user?.id ??
        opp.assignedToId ??
        (typeof assignedToId === 'string' || typeof assignedToId === 'number' ? assignedToId : '') ??
        opp.assignedUser?.id ??
        '';
      if ((rawAssigned == null || rawAssigned === '') && opportunityId) {
        try {
          const detailsRes = await api.get<any>(`/opportunities/${opportunityId}/details`);
          const details = detailsRes.success ? detailsRes.data : null;
          const d = details?.opportunity ?? details;
          const fromDetails =
            d?.userId ?? d?.ownerId ?? d?.owner?.id ?? d?.user?.id ?? d?.assignedUser?.id
            ?? details?.userId ?? details?.ownerId ?? details?.owner?.id ?? details?.user?.id ?? details?.assignedUser?.id ?? '';
          if (fromDetails) rawAssigned = fromDetails;
        } catch {
          // ignore
        }
      }
      // If still no assignee, manual list may have it (GET /opportunities/manual includes userId per item)
      let assigneeNameFromList = '';
      if ((rawAssigned == null || rawAssigned === '') && opportunityId) {
        try {
          const listRes = await opportunitiesApi.getManualOpportunities();
          if (listRes.success && listRes.data?.opportunities) {
            const list = listRes.data.opportunities as any[];
            const found = list.find(
              (o: any) => String(o.id ?? o.ghlOpportunityId ?? o.opportunityId) === String(opportunityId)
            );
            if (found) {
              const foundAssignedTo = found.assignedTo;
              const foundAssignedToId = typeof foundAssignedTo === 'object' && foundAssignedTo != null ? (foundAssignedTo as any).id : foundAssignedTo;
              rawAssigned = found.userId ?? found.ownerId ?? found.owner?.id ?? found.user?.id ?? found.assignedUser?.id ?? found.assignedUserId ?? (typeof foundAssignedToId === 'string' || typeof foundAssignedToId === 'number' ? foundAssignedToId : '') ?? '';
              assigneeNameFromList = found.owner?.name ?? found.owner?.username ?? found.assignedToName ?? (typeof found.assignedTo === 'object' && found.assignedTo != null ? (found.assignedTo as any).name : '') ?? found.user?.name ?? found.user?.username ?? found.assignedUser?.name ?? '';
              if (assigneeNameFromList) setAssignedToNameFromApi(assigneeNameFromList);
              if (!customerName) customerName = found.customerName ?? found.contactName ?? '';
              if (found.id != null && found.id !== '') setUpdateOpportunityId(String(found.id));
            }
          }
        } catch {
          // ignore
        }
      }
      const assignedUserId = rawAssigned != null && rawAssigned !== '' ? String(rawAssigned) : '';
      setForm({
        name: opp.name || '',
        customerName: customerName || opp.customerName || opp.contactName || '',
        customerEmail: opp.customerEmail || opp.contactEmail || opp.email || '',
        customerPhone: opp.customerPhone || '',
        customerAddress,
        assignedUserId,
        scheduledAt,
      });
    } catch (e) {
      console.error('Error loading opportunity:', e);
      Alert.alert('Error', 'Failed to load opportunity.');
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    loadUsers();
    loadOpportunity();
  }, [loadUsers, loadOpportunity]);

  const matchedUser = form.assignedUserId ? users.find((u) => String(u.id) === String(form.assignedUserId)) : null;
  const selectedUserName = form.assignedUserId
    ? ((matchedUser?.name ?? assignedToNameFromApi) || 'Select user')
    : (assignedToNameFromApi || 'Select user');

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
    const idToUpdate = updateOpportunityId || opportunityId;
    if (!idToUpdate || !validate()) return;
    const dto: CreateManualOpportunityDto = {
      name: form.name.trim(),
      customerName: form.customerName.trim(),
      assignedUserId: form.assignedUserId,
    };
    dto.customerEmail = form.customerEmail.trim();
    dto.customerPhone = form.customerPhone.trim();
    dto.customerAddress = form.customerAddress.trim();
    if (form.scheduledAt) dto.scheduledAt = form.scheduledAt.toISOString();

    setSubmitting(true);
    try {
      const response = await opportunitiesApi.updateManualOpportunity(idToUpdate, dto);
      if (response.success) {
        setSubmitting(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Success\n\nOpportunity updated successfully.');
          if (navigation.canGoBack?.()) navigation.goBack();
          else navigation.navigate('OpportunityManagement');
        } else {
          Alert.alert('Success', 'Opportunity updated successfully.', [
            { text: 'OK', onPress: () => { if (navigation.canGoBack?.()) navigation.goBack(); else navigation.navigate('OpportunityManagement'); } },
          ]);
        }
      } else {
        setSubmitting(false);
        const errMsg = response.error || 'Failed to update opportunity.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`Error\n\n${errMsg}`);
        } else {
          Alert.alert('Error', errMsg, [{ text: 'OK' }]);
        }
      }
    } catch (e) {
      setSubmitting(false);
      const errMsg = (e as Error)?.message || 'Failed to update opportunity.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Error\n\n${errMsg}`);
      } else {
        Alert.alert('Error', errMsg, [{ text: 'OK' }]);
      }
    }
  };

  if (!permissions.isAdmin || !opportunityId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.cardBackground }]} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit opportunity</Text>
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading opportunity...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <TouchableOpacity style={[styles.backButton, { borderColor: theme.borderColor }]} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.primaryText }]}>Edit manual opportunity</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Update opportunity details</Text>
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
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Text style={labelStyle}>Opportunity name *</Text>
              <TextInput style={inputStyle} placeholder="e.g. Home Survey - Smith" placeholderTextColor={theme.secondaryText} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} editable={!submitting} />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer name *</Text>
              <TextInput style={inputStyle} placeholder="Full name" placeholderTextColor={theme.secondaryText} value={form.customerName} onChangeText={(t) => setForm((f) => ({ ...f, customerName: t }))} editable={!submitting} />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer email (optional)</Text>
              <TextInput style={inputStyle} placeholder="email@example.com" placeholderTextColor={theme.secondaryText} value={form.customerEmail} onChangeText={(t) => setForm((f) => ({ ...f, customerEmail: t }))} keyboardType="email-address" autoCapitalize="none" editable={!submitting} />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer phone (optional)</Text>
              <TextInput style={inputStyle} placeholder="Phone number" placeholderTextColor={theme.secondaryText} value={form.customerPhone} onChangeText={(t) => setForm((f) => ({ ...f, customerPhone: t }))} keyboardType="phone-pad" editable={!submitting} />

              <Text style={[labelStyle, { marginTop: 16 }]}>Customer address (optional)</Text>
              <TextInput style={[inputStyle, styles.textArea]} placeholder="Address" placeholderTextColor={theme.secondaryText} value={form.customerAddress} onChangeText={(t) => setForm((f) => ({ ...f, customerAddress: t }))} multiline numberOfLines={2} editable={!submitting} />

              <Text style={[labelStyle, { marginTop: 16 }]}>Scheduled date & time (optional)</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.datetimeWebWrap}>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt ? toDateTimeLocalValue(form.scheduledAt) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, scheduledAt: v ? new Date(v) : null }));
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
                  <TouchableOpacity style={[styles.pickerTouch, { backgroundColor: theme.inputBackground ?? theme.cardBackground, borderColor: theme.cardBorder }]} onPress={() => setShowScheduledPicker(true)} disabled={submitting}>
                    <Text style={[styles.pickerText, { color: form.scheduledAt ? theme.primaryText : theme.secondaryText }]}>{form.scheduledAt ? formatScheduledAtDisplay(form.scheduledAt) : 'Not set (optional)'}</Text>
                    <Feather name="calendar" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                  {showScheduledPicker && DateTimePicker && (
                    <Modal visible transparent animationType="slide">
                      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowScheduledPicker(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onStartShouldSetResponder={() => true}>
                          <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Scheduled date & time</Text>
                          <DateTimePicker value={form.scheduledAt || new Date()} mode="datetime" display="spinner" onChange={(_, date) => { if (date) setForm((f) => ({ ...f, scheduledAt: date })); }} />
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            <TouchableOpacity style={[styles.modalClose, { flex: 1, backgroundColor: theme.cardBorder }]} onPress={() => { setForm((f) => ({ ...f, scheduledAt: null })); setShowScheduledPicker(false); }}>
                              <Text style={[styles.modalCloseText, { color: theme.primaryText }]}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalClose, { flex: 1, backgroundColor: theme.primaryButton }]} onPress={() => setShowScheduledPicker(false)}>
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
              <TouchableOpacity style={[styles.pickerTouch, { backgroundColor: theme.inputBackground ?? theme.cardBackground, borderColor: theme.cardBorder }]} onPress={() => setShowUserPicker(true)} disabled={submitting}>
                <Text style={[styles.pickerText, { color: form.assignedUserId ? theme.primaryText : theme.secondaryText }]}>{selectedUserName}</Text>
                <Feather name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primaryButton }, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Save changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        <Modal visible={showUserPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUserPicker(false)}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select user</Text>
              <ScrollView style={styles.modalScroll}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.modalItem, { borderBottomColor: theme.cardBorder }, String(form.assignedUserId) === String(u.id) && { backgroundColor: theme.primaryButton + '20' }]}
                    onPress={() => { setForm((f) => ({ ...f, assignedUserId: u.id })); setShowUserPicker(false); }}
                  >
                    <Text style={[styles.modalItemText, { color: theme.primaryText }]}>{u.name}</Text>
                    {String(form.assignedUserId) === String(u.id) && <Feather name="check" size={20} color={theme.primaryButton} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: theme.cardBorder }]} onPress={() => setShowUserPicker(false)}>
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
  header: { paddingTop: Platform.OS === 'ios' ? 20 : 10, paddingBottom: 24, paddingHorizontal: width < 768 ? 16 : 24, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
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
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textArea: { minHeight: 72 },
  datetimeWebWrap: { width: '100%', marginBottom: 0 },
  pickerTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  pickerText: { fontSize: 16 },
  submitButton: { marginTop: 28, paddingVertical: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalScroll: { maxHeight: 320 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1 },
  modalItemText: { fontSize: 16 },
  modalClose: { marginTop: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
});

export default EditManualOpportunityScreen;
