import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { urlManager, updateApiUrl, setOverrideUrl, clearOverrideUrl, getAllUrls, testApiUrl } from '../utils/config';

interface URLManagerProps {
  visible?: boolean;
  onClose?: () => void;
}

export const URLManagerComponent: React.FC<URLManagerProps> = ({ visible = false, onClose }) => {
  const [newUrl, setNewUrl] = useState('');
  const [urls, setUrls] = useState(getAllUrls());
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (visible) {
      setUrls(getAllUrls());
    }
  }, [visible]);

  const handleUpdateUrl = async () => {
    if (!newUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    try {
      setTesting(true);
      const isValid = await testApiUrl(newUrl);
      
      if (isValid) {
        updateApiUrl(newUrl);
        setNewUrl('');
        setUrls(getAllUrls());
        Alert.alert('Success', 'URL updated successfully!');
        // Force page reload to apply new URL
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } else {
        Alert.alert('Error', 'URL test failed. Please check the URL and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test URL');
    } finally {
      setTesting(false);
    }
  };

  const handleSetOverride = () => {
    if (!newUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    setOverrideUrl(newUrl);
    setNewUrl('');
    setUrls(getAllUrls());
    Alert.alert('Success', 'Override URL set!');
  };

  const handleClearOverride = () => {
    clearOverrideUrl();
    setUrls(getAllUrls());
    Alert.alert('Success', 'Override URL cleared!');
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 URL Manager</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current URL Status</Text>
        <View style={styles.urlInfo}>
          <Text style={styles.label}>Current URL:</Text>
          <Text style={styles.value}>{urls.current}</Text>
        </View>
        <View style={styles.urlInfo}>
          <Text style={styles.label}>Override URL:</Text>
          <Text style={styles.value}>{urls.override || 'None'}</Text>
        </View>
        <View style={styles.urlInfo}>
          <Text style={styles.label}>Saved URL:</Text>
          <Text style={styles.value}>{urls.localStorage || 'None'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Update URL</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new API URL (e.g.,  /api/)"
          value={newUrl}
          onChangeText={setNewUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handleUpdateUrl}
            disabled={testing}
          >
            <Text style={styles.buttonText}>
              {testing ? 'Testing...' : 'Update & Test'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={handleSetOverride}
          >
            <Text style={styles.buttonText}>Set Override</Text>
          </TouchableOpacity>
        </View>

        {urls.override && (
          <TouchableOpacity 
            style={[styles.button, styles.dangerButton]} 
            onPress={handleClearOverride}
          >
            <Text style={styles.buttonText}>Clear Override</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={() => {
            setUrls(getAllUrls());
            Alert.alert('Info', 'URL status refreshed!');
          }}
        >
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  urlInfo: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: 100,
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#333',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  infoButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
export default URLManagerComponent;

