import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface RouteParams {
  opportunityId: string;
}

type SigningStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'declined';

export default function ExpressConsentSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { user, isLoading: authLoading } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [step, setStep] = useState<'loading' | 'signing' | 'status'>('loading');
  const [error, setError] = useState<string | null>(null);

  // Customer details
  const [customerName, setCustomerName] = useState<string>('Customer');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [overrideCustomerEmail, setOverrideCustomerEmail] = useState<string>('');
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(true);

  // DocuSeal state
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<SigningStatus>('pending');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'ADMIN') {
      navigation.replace('BookingConfirmationSigning', { opportunityId });
      return;
    }
    loadCustomerDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.role, opportunityId, navigation]);

  // Auto-poll status when on status step
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (step === 'status' && signingStatus !== 'completed' && signingStatus !== 'declined') {
      const initialTimeout = setTimeout(() => {
        checkSigningStatus();
      }, 3000);

      pollInterval = setInterval(() => {
        checkSigningStatus();
      }, 5000);

      return () => {
        clearTimeout(initialTimeout);
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, signingStatus, submissionId, opportunityId]);

  const loadCustomerDetails = async () => {
    try {
      setIsLoadingCustomerDetails(true);
      setError(null);

      const { api } = await import('../utils/api');

      // Preferred: customer-details endpoint
      try {
        const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
        if (customerResponse.success && customerResponse.data) {
          const customerData = customerResponse.data as any;
          const extractedEmail = customerData.email || customerData.contactEmail || '';
          let extractedName = customerData.name || 'Customer';
          const extractedAddress = customerData.address || customerData.contactAddress || '';

          if (extractedName && extractedName.includes(', ')) {
            const nameParts = extractedName.split(', ');
            if (nameParts.length >= 2) extractedName = nameParts[1].trim();
          }

          setCustomerName(extractedName);
          setCustomerEmail(extractedEmail);
          setCustomerAddress(extractedAddress);
          setOverrideCustomerEmail(extractedEmail);
          setStep('signing');
          return;
        }
      } catch (customerError) {
        // fall through to fallback
      }

      // Fallback: opportunity endpoint
      const response = await api.get(`/opportunities/${opportunityId}`);
      const raw = response.data as any;
      const opportunity = raw?.success && raw?.data ? raw.data : raw;

      let extractedName = opportunity?.name || 'Customer';
      if (extractedName && extractedName.includes(', ')) {
        const nameParts = extractedName.split(', ');
        if (nameParts.length >= 2) extractedName = nameParts[1].trim();
      }

      const extractedEmail = opportunity?.email || opportunity?.contactEmail || '';
      const extractedAddress = opportunity?.contactAddress || opportunity?.address || '';

      setCustomerName(extractedName);
      setCustomerEmail(extractedEmail);
      setCustomerAddress(extractedAddress);
      setOverrideCustomerEmail(extractedEmail);
      setStep('signing');
    } catch (e) {
      setError('Failed to load customer details');
      setStep('signing');
    } finally {
      setIsLoadingCustomerDetails(false);
    }
  };

  const getExpressConsentStepNumber = async (): Promise<number> => {
    try {
      const { workflowApi } = await import('../utils/api');
      const progressResponse = await workflowApi.getOpportunityProgress(opportunityId);
      if (progressResponse?.success && progressResponse.data?.steps) {
        const step = progressResponse.data.steps.find((s: any) => s.stepType === 'EXPRESS_CONSENT');
        if (step?.stepNumber) return step.stepNumber;
      }
    } catch {
      // ignore and fall back
    }
    // Fallback (can vary depending on inserted steps like Disclaimer)
    return 10;
  };

  const updateStatusFromResponse = (statusData: any) => {
    const status =
      statusData.status?.toLowerCase() ||
      statusData.submitters?.[0]?.status?.toLowerCase();

    if (status === 'completed') {
      setSigningStatus('completed');
    } else if (status === 'opened') {
      setSigningStatus('opened');
    } else if (status === 'declined') {
      setSigningStatus('declined');
    } else if (status === 'sent' || status === 'pending') {
      setSigningStatus('sent');
    }

    const actualSubmissionId = statusData.submissionId || statusData.id;
    if (actualSubmissionId && !submissionId) setSubmissionId(actualSubmissionId);
  };

  const checkSigningStatus = async (submissionIdToCheck?: string) => {
    const idToCheck = submissionIdToCheck || submissionId;
    setIsCheckingStatus(true);
    try {
      const { api } = await import('../utils/api');

      if (idToCheck && idToCheck !== 'unknown') {
        const response = await api.get(`/docuseal/submissions/${idToCheck}/refresh-status`);
        if (response.success && response.data) {
          const statusData = (response.data as any).data || response.data;
          updateStatusFromResponse(statusData);
        }
      } else {
        const response = await api.get(`/docuseal/submissions/opportunity/${opportunityId}`);
        if (response.success && response.data) {
          const submissionsData = response.data as any;
          const expressConsentSubmission =
            submissionsData['express-consent'] ||
            submissionsData.expressConsent ||
            submissionsData.express_consent ||
            submissionsData.expressConsentForm;
          if (expressConsentSubmission) updateStatusFromResponse(expressConsentSubmission);
        }
      }
    } catch {
      // silent: status polling should not block UI
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSendExpressConsent = async () => {
    if (isSending) return;

    const finalCustomerEmail = overrideCustomerEmail.trim() || customerEmail;
    if (!finalCustomerEmail) {
      Alert.alert('Error', 'Customer email is required. Please enter an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalCustomerEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const { api, authApi } = await import('../utils/api');

      const user = await authApi.getUser();
      const userId = user?.id || user?.ghlUserId;

      const requestBody: any = {
        opportunityId,
        customerData: {
          name: customerName,
          email: finalCustomerEmail,
          ...(customerAddress ? { address: customerAddress } : {}),
        },
        customerName,
        ...(userId ? { userId } : {}),
      };

      const response = await api.post('/docuseal/express-consent', requestBody);
      const responseData = response.data as any;

      if (!responseData?.success) {
        throw new Error(responseData?.error || 'Failed to send express consent');
      }

      const data = responseData.data || responseData;
      const receivedSubmissionId = data.submissionId || data.id || data.submission_id;
      const receivedSigningUrl = data.signingUrl || data.signing_url;

      if (receivedSubmissionId) setSubmissionId(receivedSubmissionId);
      if (receivedSigningUrl) setSigningUrl(receivedSigningUrl);

      setSigningStatus('sent');
      setStep('status');

      if (receivedSubmissionId && receivedSubmissionId !== 'unknown') {
        setTimeout(() => checkSigningStatus(receivedSubmissionId), 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send express consent';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenSigningUrl = () => {
    if (!signingUrl) return;
    Linking.openURL(signingUrl);
  };

  const handleCompleteAndNext = async () => {
    try {
      const { workflowApi } = await import('../utils/api');
      const stepNumber = await getExpressConsentStepNumber();
      await workflowApi.completeStep(opportunityId, stepNumber, {
        submissionId,
        signedAt: new Date().toISOString(),
        status: 'completed',
      });
    } catch (e) {
      // Keep going even if step completion fails
    }

    // Next step after Express Consent: Booking Confirmation
    navigation.navigate('BookingConfirmationSigning', { opportunityId });
  };

  const getStatusColor = () => {
    if (signingStatus === 'completed') return '#16a34a';
    if (signingStatus === 'opened') return '#2563eb';
    if (signingStatus === 'declined') return '#dc2626';
    return '#f59e0b';
  };

  const getStatusText = () => {
    switch (signingStatus) {
      case 'completed':
        return 'Express Consent Signed';
      case 'opened':
        return 'Opened';
      case 'sent':
        return 'Sent';
      case 'declined':
        return 'Declined';
      default:
        return 'Pending';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
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
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Express Consent</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Sign the express consent form for work to commence
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={toggleTheme}
            >
              <Feather name={isDark ? 'sun' : 'moon'} size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, Platform.OS === 'web' && { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={[styles.errorBox, { backgroundColor: '#dc2626' + '15', borderColor: '#dc2626' }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
            <Text style={[styles.errorText, { color: theme.primaryText }]}>{error}</Text>
          </View>
        )}

        {step === 'loading' || isLoadingCustomerDetails ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.centerText, { color: theme.secondaryText }]}>Loading customer details…</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Customer details</Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.secondaryText }]}>Name</Text>
                <Text style={[styles.value, { color: theme.primaryText }]}>{customerName || '—'}</Text>
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.secondaryText }]}>Email (used to send signing link)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
                  placeholder="customer@email.com"
                  placeholderTextColor={theme.tertiaryText}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={overrideCustomerEmail}
                  onChangeText={setOverrideCustomerEmail}
                  editable={!isSending}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.secondaryText }]}>Address (auto-filled in form)</Text>
                <Text style={[styles.value, { color: theme.primaryText }]}>{customerAddress || '—'}</Text>
              </View>

              {step === 'signing' && (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.primaryButton }, isSending && { opacity: 0.7 }]}
                  onPress={handleSendExpressConsent}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="send-outline" size={20} color="#ffffff" />
                  )}
                  <Text style={styles.primaryButtonText}>{isSending ? 'Sending…' : 'Send Express Consent for Signing'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {step === 'status' && (
              <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '15', borderColor: getStatusColor() }]}>
                  <Ionicons name="document-text-outline" size={18} color={getStatusColor()} />
                  <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: theme.tertiaryBackground }]}
                  onPress={() => checkSigningStatus()}
                  disabled={isCheckingStatus}
                >
                  {isCheckingStatus ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={theme.primaryText} />
                  )}
                  <Text style={[styles.secondaryButtonText, { color: theme.primaryText }]}>
                    {isCheckingStatus ? 'Checking…' : 'Refresh Status'}
                  </Text>
                </TouchableOpacity>

                {signingUrl && signingStatus !== 'completed' && (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: '#2563eb' + '15' }]}
                    onPress={handleOpenSigningUrl}
                  >
                    <Ionicons name="open-outline" size={18} color="#2563eb" />
                    <Text style={[styles.secondaryButtonText, { color: '#2563eb' }]}>Open signing link</Text>
                  </TouchableOpacity>
                )}

                {signingStatus === 'completed' && (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.successButton }]}
                    onPress={handleCompleteAndNext}
                  >
                    <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Next: Booking Confirmation</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.note, { color: theme.secondaryText }]}>
                  Status updates automatically every 5 seconds.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRight: { marginLeft: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { marginTop: 4, fontSize: 13 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, marginBottom: 6 },
  value: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: { fontSize: 14, fontWeight: '800' },
  note: { marginTop: 12, fontSize: 12, textAlign: 'center' },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  centerText: { marginTop: 12, fontSize: 13 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 13 },
});

