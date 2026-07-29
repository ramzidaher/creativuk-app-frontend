import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { surveyCustomerUploadApi } from '../utils/api';
import { compressSurveyUploadFiles, SurveyUploadTooLargeError } from '../utils/imageCompression';
import { filesFromWebFileList } from '../utils/surveyWebImageFiles';

type UploadField = {
  field: string;
  label: string;
  hint: string;
  minRequired: number;
  uploadedCount: number;
};

export default function CustomerPhotoUploadScreen() {
  const route = useRoute<any>();
  const token = route.params?.token as string;
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<UploadField[]>([]);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!token) {
      setError('Invalid link — no upload token found.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await surveyCustomerUploadApi.getSession(token);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Could not load upload link');
      }
      setFields(response.data.fields);
      setCustomerLabel(response.data.customerLabel ?? null);
      setExpiresAt(response.data.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upload link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const pickAndUpload = async (field: UploadField) => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Use your phone browser',
        'Open the link we sent you in Safari or Chrome on your phone to upload photos.',
      );
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) return;
      try {
        setUploadingField(field.field);
        const rawFiles = filesFromWebFileList(input.files);
        const compressed = await compressSurveyUploadFiles(rawFiles);
        const images = compressed.map((file) => ({
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          base64Data: file.base64Data,
        }));

        const response = await surveyCustomerUploadApi.upload(token, field.field, images);
        if (!response.success) {
          throw new Error(response.error || 'Upload failed');
        }

        Alert.alert('Uploaded', `${images.length} photo(s) uploaded for ${field.label}.`);
        await loadSession();
      } catch (err) {
        if (err instanceof SurveyUploadTooLargeError) {
          Alert.alert('Photo too large', err.message);
        } else {
          Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
        }
      } finally {
        setUploadingField(null);
        input.value = '';
      }
    };
    input.click();
  };

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && { minHeight: '100vh' as any },
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerBrand}>
          <Feather name="camera" size={22} color="#166534" />
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Upload your photos</Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
          {customerLabel
            ? `Photos for ${customerLabel}`
            : 'Send photos to Creativ UK for your solar survey'}
        </Text>
        {expiryText ? (
          <Text style={[styles.expiry, { color: theme.secondaryText }]}>Link valid until {expiryText}</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.centeredText, { color: theme.secondaryText }]}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color="#dc2626" />
          <Text style={[styles.errorText, { color: theme.primaryText }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.intro, { color: theme.secondaryText }]}>
            Tap each section below to add photos from your phone or computer. You can come back to this
            link later to add more.
          </Text>

          {fields.map((field) => {
            const isUploading = uploadingField === field.field;
            const done = field.uploadedCount >= field.minRequired;
            return (
              <View
                key={field.field}
                style={[
                  styles.fieldCard,
                  { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.fieldHeader}>
                  <Text style={[styles.fieldLabel, { color: theme.primaryText }]}>{field.label}</Text>
                  {done ? (
                    <View style={styles.doneBadge}>
                      <Feather name="check" size={14} color="#166534" />
                      <Text style={styles.doneText}>{field.uploadedCount} uploaded</Text>
                    </View>
                  ) : (
                    <Text style={[styles.countText, { color: theme.secondaryText }]}>
                      {field.uploadedCount} uploaded
                    </Text>
                  )}
                </View>
                <Text style={[styles.fieldHint, { color: theme.secondaryText }]}>{field.hint}</Text>
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    { backgroundColor: theme.primaryButton, opacity: isUploading ? 0.7 : 1 },
                  ]}
                  onPress={() => pickAndUpload(field)}
                  disabled={!!uploadingField}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="upload" size={18} color="#fff" />
                      <Text style={styles.uploadButtonText}>Add photos</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={[styles.footerNote, { color: theme.secondaryText }]}>
            Your photos are sent securely to Creativ UK. If you have trouble, contact your adviser.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSubtitle: { fontSize: 15, lineHeight: 22 },
  expiry: { fontSize: 12, marginTop: 6 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centeredText: { fontSize: 16 },
  errorText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  fieldLabel: { fontSize: 17, fontWeight: '600', flex: 1 },
  fieldHint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  countText: { fontSize: 12 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doneText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footerNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
});
