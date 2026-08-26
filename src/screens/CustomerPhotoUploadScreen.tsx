import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import CustomerSurveyFileUpload, { CustomerUploadFile } from '../components/CustomerSurveyFileUpload';
import { useTheme } from '../context/ThemeContext';
import { surveyCustomerUploadApi } from '../utils/api';
import { compressSurveyUploadFiles, SurveyUploadTooLargeError } from '../utils/imageCompression';
import {
  CUSTOMER_SURVEY_PAGE_TITLES,
  CUSTOMER_SURVEY_UPLOAD_EXAMPLES,
  type CustomerSurveyUploadField,
} from '../utils/surveyImageFields';
import { filesFromWebFileList, surveyFilesFromDataTransfer } from '../utils/surveyWebImageFiles';
import type { SurveyWebUploadFile } from '../utils/surveyWebImageFiles';

type UploadField = {
  field: string;
  page: number;
  label: string;
  hint: string;
  minRequired: number;
  uploadedCount: number;
  uploadedImages: Array<{ url: string; name: string }>;
};

const PASSWORD_STORAGE_PREFIX = 'customer-upload-pwd:';

function getStoredPassword(token: string): string | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(`${PASSWORD_STORAGE_PREFIX}${token}`);
}

function storePassword(token: string, password: string) {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(`${PASSWORD_STORAGE_PREFIX}${token}`, password.trim().toUpperCase());
  }
}

function readTokenFromLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const match = window.location.pathname.match(/\/customer-photos\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export default function CustomerPhotoUploadScreen({ token: tokenProp }: { token?: string } = {}) {
  const token = tokenProp || readTokenFromLocation();
  const { theme } = useTheme();

  const [step, setStep] = useState<'password' | 'upload'>('password');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [password, setPassword] = useState<string | null>(null);
  const [fields, setFields] = useState<UploadField[]>([]);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const loadSession = useCallback(
    async (pwd: string) => {
      if (!token) return;
      const response = await surveyCustomerUploadApi.verify(token, pwd);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Could not open upload page');
      }
      setFields(response.data.fields);
      setCustomerLabel(response.data.customerLabel ?? null);
      setExpiresAt(response.data.expiresAt);
      setPassword(pwd.trim().toUpperCase());
      storePassword(token, pwd);
      setStep('upload');
    },
    [token],
  );

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Invalid link. No upload token found.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const meta = await surveyCustomerUploadApi.getLinkMeta(token);
        if (!meta.success || !meta.data) {
          throw new Error(meta.error || 'Could not load upload link');
        }
        setCustomerLabel(meta.data.customerLabel ?? null);
        setExpiresAt(meta.data.expiresAt);

        const stored = getStoredPassword(token);
        if (stored) {
          try {
            await loadSession(stored);
          } catch {
            setStep('password');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load upload link');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, loadSession]);

  const handleVerifyPassword = async () => {
    if (!passwordInput.trim()) {
      Alert.alert('Password required', 'Enter the password we sent you with the link.');
      return;
    }
    try {
      setVerifying(true);
      setError(null);
      await loadSession(passwordInput);
    } catch (err) {
      Alert.alert(
        'Incorrect password',
        err instanceof Error ? err.message : 'Check the password and try again.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const processAndUpload = async (field: UploadField, webFiles: SurveyWebUploadFile[]) => {
    if (!password || !token || !webFiles.length) return;
    try {
      setUploadingField(field.field);
      const compressed = await compressSurveyUploadFiles(webFiles, field.field);
      const images = compressed.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        base64Data: file.base64Data,
      }));

      const response = await surveyCustomerUploadApi.upload(token, password, field.field, images);
      if (!response.success) {
        throw new Error(response.error || 'Upload failed');
      }

      await loadSession(password);
    } catch (err) {
      if (err instanceof SurveyUploadTooLargeError) {
        Alert.alert('Photo too large', err.message);
      } else {
        Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setUploadingField(null);
    }
  };

  const pickAndUpload = async (field: UploadField) => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Use your phone browser',
        'Open the link in Safari or Chrome on your phone to upload photos.',
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) return;
      const webFiles = await filesFromWebFileList(input.files);
      await processAndUpload(field, webFiles);
      input.value = '';
    };
    input.click();
  };

  const handleWebDrop = async (field: UploadField, dataTransfer: DataTransfer) => {
    const { files } = await surveyFilesFromDataTransfer(dataTransfer);
    if (!files.length) return;
    await processAndUpload(field, files);
  };

  const fieldsByPage = useMemo(() => {
    const grouped = new Map<number, UploadField[]>();
    for (const field of fields) {
      const list = grouped.get(field.page) ?? [];
      list.push(field);
      grouped.set(field.page, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [fields]);

  const filesForField = (field: UploadField): CustomerUploadFile[] =>
    field.uploadedImages.map((img) => ({
      uri: img.url,
      name: img.name,
      mimeType: img.url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg',
    }));

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const pageBody = loading ? (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={theme.primaryButton} />
      <Text style={[styles.centeredText, { color: theme.secondaryText }]}>Loading…</Text>
    </View>
  ) : error ? (
    <View style={styles.centered}>
      <Feather name="alert-circle" size={40} color="#dc2626" />
      <Text style={[styles.errorText, { color: theme.primaryText }]}>{error}</Text>
    </View>
  ) : step === 'password' ? (
    <View style={styles.passwordPanel}>
      <Text style={[styles.passwordIntro, { color: theme.secondaryText }]}>
        This is a Creative Energy page. Enter the password we sent you with the link.
      </Text>
      <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Password</Text>
      <TextInput
        style={[
          styles.passwordInput,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.cardBorder,
            color: theme.primaryText,
          },
        ]}
        value={passwordInput}
        onChangeText={setPasswordInput}
        placeholder="e.g. ABCD-1234"
        placeholderTextColor={theme.secondaryText}
        autoCapitalize="characters"
        autoCorrect={false}
        secureTextEntry
        onSubmitEditing={handleVerifyPassword}
      />
      <TouchableOpacity
        style={[styles.verifyButton, { backgroundColor: theme.primaryButton }]}
        onPress={handleVerifyPassword}
        disabled={verifying}
      >
        {verifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.verifyButtonText}>Continue to upload photos</Text>
        )}
      </TouchableOpacity>
    </View>
  ) : (
    <>
      <Text style={[styles.intro, { color: theme.secondaryText }]}>
        Take photos for each section below.{'\n'}
        You can save and come back later using the same link and password. Tap "See example photo" if
        you are unsure what photo to take.
      </Text>

      {fieldsByPage.map(([page, pageFields]) => (
        <View
          key={page}
          style={[
            styles.section,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: '#166534' }]}>
            {CUSTOMER_SURVEY_PAGE_TITLES[page] ?? `Section ${page}`}
          </Text>
          {pageFields.map((field) => {
            const example =
              CUSTOMER_SURVEY_UPLOAD_EXAMPLES[field.field as CustomerSurveyUploadField];
            return (
              <CustomerSurveyFileUpload
                key={field.field}
                label={field.label}
                hint={field.hint}
                required={field.minRequired > 0}
                minRequired={field.minRequired}
                files={filesForField(field)}
                uploading={uploadingField === field.field}
                onPress={() => pickAndUpload(field)}
                onWebDrop={(dt) => handleWebDrop(field, dt)}
                exampleImage={example?.image}
                exampleCaption={example?.caption}
              />
            );
          })}
        </View>
      ))}

      <Text style={[styles.footerNote, { color: theme.secondaryText }]}>
        Photos are sent securely to Creativ UK. If you need help, use the same number or email that sent you this link.
      </Text>
    </>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && styles.webViewport,
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <Image
          source={require('../../assets/creativ NB.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Creative Energy"
        />
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Property Photos required.</Text>
        <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
          {customerLabel
            ? `Photos for ${customerLabel}`
            : 'Creative Energy. Please upload the photos we need for your property'}
        </Text>
        {expiryText ? (
          <Text style={[styles.expiry, { color: theme.secondaryText }]}>Link valid until {expiryText}</Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          Platform.OS === 'web' ? styles.webScrollContent : styles.nativeScrollContent
        }
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
      >
        {pageBody}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webViewport: {
    flex: 1,
    height: '100%' as any,
    minHeight: '100vh' as any,
    width: '100%',
  },
  scrollView: { flex: 1, minHeight: 0 as any },
  nativeScrollContent: { padding: 16, paddingBottom: 48 },
  webScrollContent: {
    padding: 16,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 56,
    marginBottom: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  headerSubtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  expiry: { fontSize: 12, marginTop: 6 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centeredText: { fontSize: 16 },
  errorText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  passwordPanel: { flex: 1, padding: 24, maxWidth: 480, alignSelf: 'center', width: '100%' },
  passwordIntro: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: 16,
  },
  verifyButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  verifyButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scrollContent: { padding: 16, paddingBottom: 40, maxWidth: 720, alignSelf: 'center', width: '100%' },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  footerNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
});
