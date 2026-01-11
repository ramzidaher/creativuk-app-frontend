import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { isFieldDisabled } from '../config/inputFieldRules';

interface InputField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  value: string;
  required: boolean;
  enabled: boolean;
  cellReference: string;
  dropdownOptions?: string[];
}

interface ManualInputFieldsManagerProps {
  inputFields: InputField[];
  selectedOptions: Record<string, string>;
  onInputChange: (fieldId: string, value: string) => void;
  onManualOverride: (fieldId: string, enabled: boolean) => void;
  inputValues: Record<string, string>;
}

export default function ManualInputFieldsManager({
  inputFields,
  selectedOptions,
  onInputChange,
  onManualOverride,
  inputValues,
}: ManualInputFieldsManagerProps) {
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});
  const [showDisabledFields, setShowDisabledFields] = useState(false);

  // Calculate which fields should be disabled based on radio button selections
  const getFieldsByStatus = () => {
    const enabledFields: InputField[] = [];
    const disabledFields: InputField[] = [];

    inputFields.forEach(field => {
      const shouldBeDisabled = isFieldDisabled(field.id, selectedOptions);
      const isManuallyOverridden = manualOverrides[field.id] !== undefined;
      const isActuallyEnabled = isManuallyOverridden ? manualOverrides[field.id] : !shouldBeDisabled;

      if (isActuallyEnabled) {
        enabledFields.push({ ...field, enabled: true });
      } else {
        disabledFields.push({ ...field, enabled: false });
      }
    });

    return { enabledFields, disabledFields };
  };

  const { enabledFields, disabledFields } = getFieldsByStatus();

  const handleManualOverride = (fieldId: string, enabled: boolean) => {
    setManualOverrides(prev => ({
      ...prev,
      [fieldId]: enabled,
    }));
    onManualOverride(fieldId, enabled);
  };

  const resetAllOverrides = () => {
    Alert.alert(
      'Reset Manual Overrides',
      'Are you sure you want to reset all manual field overrides? This will apply the automatic rules based on your radio button selections.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setManualOverrides({});
            // Reset all overrides
            Object.keys(manualOverrides).forEach(fieldId => {
              const shouldBeDisabled = isFieldDisabled(fieldId, selectedOptions);
              onManualOverride(fieldId, !shouldBeDisabled);
            });
          },
        },
      ]
    );
  };

  const renderInputField = (field: InputField, isDisabled: boolean = false) => {
    const value = inputValues[field.id] || '';
    const shouldBeDisabled = isFieldDisabled(field.id, selectedOptions);
    const isManuallyOverridden = manualOverrides[field.id] !== undefined;
    const isActuallyEnabled = isManuallyOverridden ? manualOverrides[field.id] : !shouldBeDisabled;

    if (field.type === 'dropdown' && field.dropdownOptions) {
      return (
        <View key={field.id} style={[styles.inputContainer, !isActuallyEnabled && styles.disabledContainer]}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.inputLabel, !isActuallyEnabled && styles.disabledText]}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={styles.fieldControls}>
              {shouldBeDisabled && (
                <View style={styles.overrideControl}>
                  <Text style={styles.overrideLabel}>Manual Override</Text>
                  <Switch
                    value={isActuallyEnabled}
                    onValueChange={(enabled) => handleManualOverride(field.id, enabled)}
                    trackColor={{ false: '#e2e8f0', true: '#B4F35B' }}
                    thumbColor={isActuallyEnabled ? '#1e293b' : '#64748b'}
                  />
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.dropdownContainer, !isActuallyEnabled && styles.disabledInput]}
            onPress={() => {
              if (!isActuallyEnabled) return;
              Alert.alert(
                'Select Option',
                field.label,
                field.dropdownOptions!.map(option => ({
                  text: option,
                  onPress: () => onInputChange(field.id, option),
                }))
              );
            }}
            disabled={!isActuallyEnabled}
          >
            <Text style={[styles.dropdownText, !value && styles.placeholder, !isActuallyEnabled && styles.disabledText]}>
              {value || 'Select an option...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={isActuallyEnabled ? '#666' : '#ccc'} />
          </TouchableOpacity>
          {shouldBeDisabled && (
            <Text style={styles.disabledReason}>
              Disabled because: {selectedOptions[Object.keys(selectedOptions).find(key => 
                isFieldDisabled(field.id, { [key]: selectedOptions[key] })
              ) || ''] || 'radio button selection'}
            </Text>
          )}
        </View>
      );
    }

    return (
      <View key={field.id} style={[styles.inputContainer, !isActuallyEnabled && styles.disabledContainer]}>
        <View style={styles.fieldHeader}>
          <Text style={[styles.inputLabel, !isActuallyEnabled && styles.disabledText]}>
            {field.label}
            {field.required && <Text style={styles.required}> *</Text>}
          </Text>
          <View style={styles.fieldControls}>
            {shouldBeDisabled && (
              <View style={styles.overrideControl}>
                <Text style={styles.overrideLabel}>Manual Override</Text>
                <Switch
                  value={isActuallyEnabled}
                  onValueChange={(enabled) => handleManualOverride(field.id, enabled)}
                  trackColor={{ false: '#e2e8f0', true: '#B4F35B' }}
                  thumbColor={isActuallyEnabled ? '#1e293b' : '#64748b'}
                />
              </View>
            )}
          </View>
        </View>
        <TextInput
          style={[styles.textInput, !isActuallyEnabled && styles.disabledInput]}
          value={value}
          onChangeText={(text) => onInputChange(field.id, text)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          editable={isActuallyEnabled}
          placeholderTextColor={isActuallyEnabled ? '#9ca3af' : '#ccc'}
        />
        {shouldBeDisabled && (
          <Text style={styles.disabledReason}>
            Disabled because: {selectedOptions[Object.keys(selectedOptions).find(key => 
              isFieldDisabled(field.id, { [key]: selectedOptions[key] })
            ) || ''] || 'radio button selection'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Controls */}
      <View style={styles.headerControls}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Input Fields Manager</Text>
          <Text style={styles.headerSubtitle}>
            {enabledFields.length} enabled, {disabledFields.length} disabled
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowDisabledFields(!showDisabledFields)}
          >
            <Ionicons 
              name={showDisabledFields ? "eye-off" : "eye"} 
              size={20} 
              color="#64748b" 
            />
            <Text style={styles.toggleButtonText}>
              {showDisabledFields ? 'Hide' : 'Show'} Disabled
            </Text>
          </TouchableOpacity>
          {Object.keys(manualOverrides).length > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetAllOverrides}
            >
              <Ionicons name="refresh" size={16} color="#ef4444" />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Enabled Fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Enabled Fields ({enabledFields.length})
        </Text>
        {enabledFields.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            <Text style={styles.emptyStateText}>No enabled fields</Text>
            <Text style={styles.emptyStateSubtext}>
              All input fields are currently disabled based on your radio button selections.
            </Text>
          </View>
        ) : (
          enabledFields.map(field => renderInputField(field))
        )}
      </View>

      {/* Disabled Fields */}
      {showDisabledFields && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Disabled Fields ({disabledFields.length})
          </Text>
          {disabledFields.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text style={styles.emptyStateText}>No disabled fields</Text>
              <Text style={styles.emptyStateSubtext}>
                All input fields are currently enabled.
              </Text>
            </View>
          ) : (
            disabledFields.map(field => renderInputField(field, true))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerControls: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledContainer: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    lineHeight: 22,
  },
  disabledText: {
    color: '#9ca3af',
  },
  fieldControls: {
    alignItems: 'flex-end',
  },
  overrideControl: {
    alignItems: 'center',
    gap: 4,
  },
  overrideLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
    minHeight: 56,
    fontWeight: '500',
  },
  disabledInput: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    color: '#9ca3af',
  },
  dropdownContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
  },
  placeholder: {
    color: '#9ca3af',
  },
  disabledReason: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    fontStyle: 'italic',
  },
  required: {
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});
