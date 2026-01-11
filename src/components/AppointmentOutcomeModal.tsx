import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

interface AppointmentOutcomeModalProps {
  visible: boolean;
  onClose: () => void;
  onOutcomeSelected: (outcome: 'won' | 'lost') => Promise<void>;
  opportunityId: string;
  customerName: string;
  postcode: string;
  isProcessing?: boolean;
}

export default function AppointmentOutcomeModal({
  visible,
  onClose,
  onOutcomeSelected,
  opportunityId,
  customerName,
  postcode,
  isProcessing = false,
}: AppointmentOutcomeModalProps) {
  const { theme, isDark } = useTheme();
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | null>(null);

  const handleOutcomeSelect = (outcome: 'won' | 'lost') => {
    setSelectedOutcome(outcome);
  };

  const handleConfirm = async () => {
    if (!selectedOutcome) {
      Alert.alert('Selection Required', 'Please select an appointment outcome before proceeding.');
      return;
    }

    try {
      await onOutcomeSelected(selectedOutcome);
    } catch (error) {
      console.error('Error processing outcome:', error);
      Alert.alert('Error', 'Failed to process appointment outcome. Please try again.');
    }
  };

  const handleCancel = () => {
    setSelectedOutcome(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          { 
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
            shadowColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }
        ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.headerIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="check-circle" size={24} color={theme.primaryButton} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Appointment Outcome
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              How did the appointment go?
            </Text> 
          </View>

          {/* Customer Info */}
          <View style={[styles.customerInfo, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.customerInfoRow}>
              <Feather name="user" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerInfoText, { color: theme.primaryText }]}>
                {customerName}
              </Text>
            </View>
            <View style={styles.customerInfoRow}>
              <Feather name="map-pin" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerInfoText, { color: theme.secondaryText }]}>
                {postcode}
              </Text>
            </View>
            <View style={styles.customerInfoRow}>
              <Feather name="hash" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerInfoText, { color: theme.secondaryText }]}>
                {opportunityId}
              </Text>
            </View>
          </View>

          {/* Outcome Options */}
          <View style={styles.outcomeOptions}>
            <TouchableOpacity
              style={[
                styles.outcomeOption,
                { 
                  backgroundColor: theme.secondaryBackground,
                  borderColor: theme.cardBorder,
                },
                selectedOutcome === 'won' && {
                  borderColor: theme.successButton,
                  backgroundColor: theme.successButton + '10',
                }
              ]}
              onPress={() => handleOutcomeSelect('won')}
              disabled={isProcessing}
            >
              <View style={styles.outcomeOptionContent}>
                <View style={[
                  styles.outcomeIcon,
                  { backgroundColor: selectedOutcome === 'won' ? theme.successButton : theme.tertiaryBackground }
                ]}>
                  <Feather 
                    name="check-circle" 
                    size={24} 
                    color={selectedOutcome === 'won' ? '#ffffff' : theme.tertiaryText} 
                  />
                </View>
                <View style={styles.outcomeTextContainer}>
                  <Text style={[
                    styles.outcomeTitle,
                    { color: selectedOutcome === 'won' ? theme.successButton : theme.primaryText }
                  ]}>
                    Won
                  </Text>
                  <Text style={[styles.outcomeDescription, { color: theme.secondaryText }]}>
                    Customer accepted the proposal
                  </Text>
                  <Text style={[styles.outcomeFolder, { color: theme.tertiaryText }]}>
                    Files will be saved to: Customer Orders 2
                  </Text>
                </View>
                {selectedOutcome === 'won' && (
                  <Feather name="check" size={20} color={theme.successButton} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.outcomeOption,
                { 
                  backgroundColor: theme.secondaryBackground,
                  borderColor: theme.cardBorder,
                },
                selectedOutcome === 'lost' && {
                  borderColor: theme.dangerButton,
                  backgroundColor: theme.dangerButton + '10',
                }
              ]}
              onPress={() => handleOutcomeSelect('lost')}
              disabled={isProcessing}
            >
              <View style={styles.outcomeOptionContent}>
                <View style={[
                  styles.outcomeIcon,
                  { backgroundColor: selectedOutcome === 'lost' ? theme.dangerButton : theme.tertiaryBackground }
                ]}>
                  <Feather 
                    name="x-circle" 
                    size={24} 
                    color={selectedOutcome === 'lost' ? '#ffffff' : theme.tertiaryText} 
                  />
                </View>
                <View style={styles.outcomeTextContainer}>
                  <Text style={[
                    styles.outcomeTitle,
                    { color: selectedOutcome === 'lost' ? theme.dangerButton : theme.primaryText }
                  ]}>
                    Lost
                  </Text>
                  <Text style={[styles.outcomeDescription, { color: theme.secondaryText }]}>
                    Customer declined the proposal
                  </Text>
                  <Text style={[styles.outcomeFolder, { color: theme.tertiaryText }]}>
                    Files will be saved to: Customer Quotations
                  </Text>
                </View>
                {selectedOutcome === 'lost' && (
                  <Feather name="check" size={20} color={theme.dangerButton} />
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Processing Indicator */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color={theme.primaryButton} />
              <Text style={[styles.processingText, { color: theme.secondaryText }]}>
                Organizing files...
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.cardBorder }]}
              onPress={handleCancel}
              disabled={isProcessing}
            >
              <Text style={[styles.cancelButtonText, { color: theme.secondaryText }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: selectedOutcome ? theme.primaryButton : theme.borderColor },
                !selectedOutcome && styles.confirmButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={!selectedOutcome || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={[styles.confirmButtonText, { color: '#ffffff' }]}>
                  Confirm & Organize Files
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  customerInfo: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  customerInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  outcomeOptions: {
    paddingHorizontal: 24,
    gap: 16,
  },
  outcomeOption: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
  },
  outcomeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  outcomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeTextContainer: {
    flex: 1,
  },
  outcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  outcomeDescription: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  outcomeFolder: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
