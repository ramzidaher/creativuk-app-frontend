import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isFieldDisabled, getDisabledFields, inputFieldRules } from '../config/inputFieldRules';

interface InputFieldRulesTestProps {
  visible: boolean;
  onClose: () => void;
}

export default function InputFieldRulesTest({ visible, onClose }: InputFieldRulesTestProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Sample radio button options for testing
  const testRadioButtons = [
    { group: 'Energy Use', options: ['SingleRate', 'DualRate'] },
    { group: 'Battery Type', options: ['BatterySC', 'BatteryOC', 'BatteryNone'] },
    { group: 'Existing Solar', options: ['ExistingSolarYes', 'ExistingSolarNo'] },
    { group: 'Import/Export Tariff', options: ['ExportYes', 'ExportNo'] },
  ];

  const handleRadioButtonPress = (group: string, option: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [group]: option,
    }));
  };

  const getDisabledFieldsList = () => {
    return getDisabledFields(selectedOptions);
  };

  const isFieldDisabledForSelection = (fieldId: string) => {
    return isFieldDisabled(fieldId, selectedOptions);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Input Field Rules Test</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

      <ScrollView style={styles.scrollView}>
        {/* Radio Button Selections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radio Button Selections</Text>
          {testRadioButtons.map((group) => (
            <View key={group.group} style={styles.radioGroup}>
              <Text style={styles.groupTitle}>{group.group}</Text>
              <View style={styles.radioOptions}>
                {group.options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radioButton,
                      selectedOptions[group.group] === option && styles.radioButtonSelected
                    ]}
                    onPress={() => handleRadioButtonPress(group.group, option)}
                  >
                    <View style={styles.radioCircle}>
                      {selectedOptions[group.group] === option && (
                        <View style={styles.radioCircleInner} />
                      )}
                    </View>
                    <Text style={styles.radioButtonText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Disabled Fields Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disabled Fields Summary</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              Total disabled fields: {getDisabledFieldsList().length}
            </Text>
            {getDisabledFieldsList().length > 0 && (
              <Text style={styles.disabledFieldsList}>
                {getDisabledFieldsList().join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Field Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Field Status</Text>
          {inputFieldRules.map((rule) => (
            <View key={rule.fieldId} style={styles.fieldStatus}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldId}>{rule.fieldId}</Text>
                <View style={[
                  styles.statusIndicator,
                  isFieldDisabledForSelection(rule.fieldId) ? styles.statusDisabled : styles.statusEnabled
                ]}>
                  <Text style={styles.statusText}>
                    {isFieldDisabledForSelection(rule.fieldId) ? 'Disabled' : 'Enabled'}
                  </Text>
                </View>
              </View>
              <Text style={styles.fieldRule}>
                Disabled for: {rule.disabledFor.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  radioGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  radioOptions: {
    gap: 8,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  radioButtonSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  radioButtonText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  disabledFieldsList: {
    fontSize: 14,
    color: '#ef4444',
    fontStyle: 'italic',
  },
  fieldStatus: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusEnabled: {
    backgroundColor: '#dcfce7',
  },
  statusDisabled: {
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldRule: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
