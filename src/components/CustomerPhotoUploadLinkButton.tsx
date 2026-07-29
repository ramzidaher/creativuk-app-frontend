import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { surveyApi } from '../utils/api';

type Props = {
  opportunityId: string;
  customerLabel?: string;
};

export default function CustomerPhotoUploadLinkButton({ opportunityId, customerLabel }: Props) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const createAndShareLink = async () => {
    try {
      setLoading(true);
      const response = await surveyApi.createCustomerUploadLink(opportunityId, {
        customerLabel: customerLabel?.trim() || undefined,
      });
      if (!response.success || !response.data?.url) {
        throw new Error(response.error || 'Could not create upload link');
      }

      const url = response.data.url;
      const message = `Please upload photos for your solar survey using this link (valid 14 days):\n\n${url}`;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        Alert.alert(
          'Link copied',
          'Customer photo upload link copied to clipboard. Send it to the customer by text or email.',
          [{ text: 'OK' }],
        );
        return;
      }

      Alert.alert('Customer upload link', message, [{ text: 'OK' }]);
    } catch (err) {
      Alert.alert(
        'Could not create link',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: '#166534' }]}
      onPress={createAndShareLink}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Feather name="link" size={16} color="#fff" />
          <Text style={styles.buttonText}>Send photo link to customer</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
