import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import DigitalSignaturePad from './DigitalSignaturePad';

export default function SignatureTest() {
  const { theme } = useTheme();
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const handleSignatureSave = (signatureData: string, digitalFootprint: any) => {
    console.log('Signature saved:', {
      signatureData: signatureData.substring(0, 100) + '...',
      digitalFootprint: {
        deviceInfo: digitalFootprint.deviceInfo,
        signatureData: {
          totalPoints: digitalFootprint.signatureData.totalPoints,
          duration: digitalFootprint.signatureData.duration,
        },
        security: {
          hash: digitalFootprint.security.hash,
          timestamp: digitalFootprint.security.timestamp,
        }
      }
    });

    Alert.alert(
      'Signature Captured!',
      `Digital footprint captured with ${digitalFootprint.signatureData.totalPoints} points over ${digitalFootprint.signatureData.duration}ms`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <Text style={[styles.title, { color: theme.primaryText }]}>
        Digital Signature Test
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        Test the signature capture functionality
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primaryButton }]}
        onPress={() => setShowSignaturePad(true)}
      >
        <Text style={styles.buttonText}>Open Signature Pad</Text>
      </TouchableOpacity>

      <DigitalSignaturePad
        visible={showSignaturePad}
        onClose={() => setShowSignaturePad(false)}
        onSave={handleSignatureSave}
        title="Test Signature"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});