import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  fillSurveyWithPlaceholderImages,
  SURVEY_PLACEHOLDER_IMAGE_FIELDS,
} from '../utils/surveyPlaceholderImages';

export default function AdminToolsScreen() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [opportunityId, setOpportunityId] = useState('');
  const [skipEnergyBill, setSkipEnergyBill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const handleFillPlaceholders = async () => {
    const trimmed = opportunityId.trim();
    if (!trimmed) {
      Alert.alert('Opportunity ID required', 'Enter a GHL or manual opportunity ID.');
      return;
    }

    const confirm = () => runFill(trimmed);

    if (Platform.OS === 'web') {
      if (window.confirm(`Fill placeholder images for survey ${trimmed}?`)) {
        confirm();
      }
      return;
    }

    Alert.alert(
      'Fill placeholder images?',
      `This uploads placeholder photos to every required survey image field for opportunity ${trimmed}. Existing images for those fields will get additional uploads.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Fill placeholders', onPress: confirm },
      ]
    );
  };

  const runFill = async (id: string) => {
    setLoading(true);
    setLastResult(null);
    setProgressMessage('Starting…');

    try {
      const result = await fillSurveyWithPlaceholderImages(id, {
        skipEnergyBill,
        onProgress: (message, current, total) => {
          setProgressMessage(total > 0 ? `${message} (${current}/${total})` : message);
        },
      });

      if (result.success) {
        const msg = `Uploaded ${result.uploadedCount} placeholder image(s) for ${result.opportunityId}.`;
        setLastResult(msg);
        Alert.alert('Done', msg);
      } else {
        const detail = result.errors.length ? result.errors.join('\n') : 'Some uploads failed.';
        const msg = `Uploaded ${result.uploadedCount} image(s) with errors:\n${detail}`;
        setLastResult(msg);
        Alert.alert('Completed with errors', msg);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLastResult(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setProgressMessage('');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.denied}>
          <Text style={{ color: theme.primaryText }}>Admin access required.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={{ color: theme.primaryButton }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalImages = SURVEY_PLACEHOLDER_IMAGE_FIELDS.filter(
    (f) => !(skipEnergyBill && f.field === 'energyBill')
  ).reduce((sum, f) => sum + f.minRequired, 0);

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
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Tools</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>Admin utilities</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="image" size={22} color={theme.primaryButton} />
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Survey placeholder images</Text>
          </View>
          <Text style={[styles.cardDescription, { color: theme.secondaryText }]}>
            Enter a GHL opportunity ID or manual opportunity ID. Placeholder JPEGs are uploaded to each required
            survey photo field ({totalImages} images total) so you can test submission and contract generation
            without taking real photos.
          </Text>

          <Text style={[styles.label, { color: theme.primaryText }]}>Opportunity ID</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.cardBorder,
                color: theme.primaryText,
              },
            ]}
            value={opportunityId}
            onChangeText={setOpportunityId}
            placeholder="GHL ID or manual opportunity ID"
            placeholderTextColor={theme.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.label, { color: theme.primaryText, marginBottom: 4 }]}>
                Skip energy bill images
              </Text>
              <Text style={[styles.hint, { color: theme.secondaryText }]}>
                Use when the survey has “No energy bill” on page 4
              </Text>
            </View>
            <Switch
              value={skipEnergyBill}
              onValueChange={setSkipEnergyBill}
              trackColor={{ false: theme.cardBorder, true: theme.primaryButton }}
            />
          </View>

          {loading && (
            <View style={styles.progressRow}>
              <ActivityIndicator color={theme.primaryButton} />
              <Text style={[styles.progressText, { color: theme.secondaryText }]}>{progressMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primaryButton, opacity: loading ? 0.7 : 1 }]}
            onPress={handleFillPlaceholders}
            disabled={loading}
          >
            <Feather name="upload" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Fill placeholder images</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: theme.cardBorder }]}
            onPress={() =>
              opportunityId.trim() &&
              navigation.navigate('Survey', { opportunityId: opportunityId.trim() })
            }
            disabled={!opportunityId.trim()}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>Open survey</Text>
          </TouchableOpacity>

          {lastResult ? (
            <Text style={[styles.resultText, { color: theme.secondaryText }]}>{lastResult}</Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.primaryText, marginBottom: 8 }]}>Fields filled</Text>
          {SURVEY_PLACEHOLDER_IMAGE_FIELDS.map(({ field, minRequired }) => (
            <Text key={field} style={[styles.fieldRow, { color: theme.secondaryText }]}>
              • {field}: {minRequired} placeholder{minRequired !== 1 ? 's' : ''}
              {skipEnergyBill && field === 'energyBill' ? ' (skipped)' : ''}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backLink: { marginTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  switchText: { flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressText: { fontSize: 13, flex: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  resultText: { marginTop: 12, fontSize: 13, lineHeight: 18 },
  fieldRow: { fontSize: 13, lineHeight: 22 },
});
