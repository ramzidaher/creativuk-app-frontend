import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { opportunitiesApi } from '../utils/api';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
}

export default function FinishAppointmentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, opportunity: passedOpportunity } = route.params as RouteParams;
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [selectedOutcome, setSelectedOutcome] = useState<'won' | 'lost' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleOutcomeSelect = (outcome: 'won' | 'lost') => {
    setSelectedOutcome(outcome);
  };

  const handleConfirm = async () => {
    if (!selectedOutcome) {
      Alert.alert('Selection Required', 'Please select an appointment outcome before proceeding.');
      return;
    }

    try {
      setIsProcessing(true);

      const { workflowApi } = await import('../utils/api');
      const finishStep = await workflowApi.getWorkflowSteps();
      const welcomeStepNumber =
        finishStep.success && finishStep.data
          ? finishStep.data.find((s: any) => s.stepType === 'WELCOME_EMAIL')?.stepNumber ?? 13
          : 13;

      const completeResult = await workflowApi.completeStep(opportunityId, welcomeStepNumber, {
        outcome: selectedOutcome,
        organizedAt: new Date().toISOString(),
      });

      if (!completeResult.success) {
        throw new Error(completeResult.error || 'Failed to complete workflow outcome step');
      }

      void opportunitiesApi.updateStatus(opportunityId, selectedOutcome).catch((error) => {
        console.warn('Opportunity status update failed:', error);
      });

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error processing outcome:', error);
      Alert.alert('Error', 'Failed to finalize appointment files. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[
      styles.container, 
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }
    ]}>
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={handleBack}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Finish Appointment</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Complete the appointment and organize files
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather 
                name={isDark ? "sun" : "moon"} 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={[
          styles.scrollView, 
          { backgroundColor: 'transparent' },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          { paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Feather name="check-circle" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Appointment Outcome</Text>
          <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
            How did the appointment go? Select the outcome to organize files accordingly.
          </Text>
        </View>

        {/* Customer Info Card */}
        <View style={[styles.customerCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.customerHeader}>
            <View style={[styles.customerIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="user" size={20} color={theme.primaryButton} />
            </View>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerTitle, { color: theme.primaryText }]}>Customer Information</Text>
              <Text style={[styles.customerSubtitle, { color: theme.secondaryText }]}>
                Appointment details
              </Text>
            </View>
          </View>

          <View style={styles.customerDetailsContainer}>
            <View style={styles.customerDetailRow}>
              <Feather name="user" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Name:</Text>
              <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                {passedOpportunity?.name || 'Unknown Customer'}
              </Text>
            </View>
            
            <View style={styles.customerDetailRow}>
              <Feather name="map-pin" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Postcode:</Text>
              <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                {passedOpportunity?.postcode || 'Unknown Postcode'}
              </Text>
            </View>
            
            <View style={styles.customerDetailRow}>
              <Feather name="hash" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerDetailLabel, { color: theme.secondaryText }]}>Opportunity ID:</Text>
              <Text style={[styles.customerDetailValue, { color: theme.primaryText }]}>
                {opportunityId}
              </Text>
            </View>
          </View>
        </View>

        {/* Outcome Options */}
        <View style={styles.outcomeSection}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Select Outcome</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
            Choose how the appointment went to organize files accordingly
          </Text>
          
          <View style={styles.outcomeOptions}>
            <TouchableOpacity
              style={[
                styles.outcomeOption,
                { 
                  backgroundColor: theme.cardBackground,
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
                    Files sync to Customer Orders 2026 (temp/) during the appointment and finalize in final/ when won
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
                  backgroundColor: theme.cardBackground,
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
                    Quote
                  </Text>
                  <Text style={[styles.outcomeDescription, { color: theme.secondaryText }]}>
                    Customer declined the proposal
                  </Text>
                  <Text style={[styles.outcomeFolder, { color: theme.tertiaryText }]}>
                    Files sync to Customer Orders 2026 (temp/) during the appointment and finalize in final/ when quoted
                  </Text>
                </View>
                {selectedOutcome === 'lost' && (
                  <Feather name="check" size={20} color={theme.dangerButton} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={[styles.processingContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <ActivityIndicator size="small" color={theme.primaryButton} />
            <Text style={[styles.processingText, { color: theme.secondaryText }]}>
              Organizing files...
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: selectedOutcome ? theme.primaryButton : theme.borderColor },
              !selectedOutcome && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedOutcome || isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="check-circle" size={20} color="#ffffff" />
            )}
            <Text style={[styles.confirmButtonText, { color: '#ffffff' }]}>
              {isProcessing ? 'Processing...' : 'Confirm & Organize Files'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            onPress={handleBack}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: theme.secondaryText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.primaryBackground }]}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>🎉</Text>
            </View>
            
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Appointment Completed!
            </Text>
            
            <Text style={[styles.modalMessage, { color: theme.secondaryText }]}>
              Files are in Customer Orders 2026 under temp/ and organized in final/ for this {selectedOutcome} outcome.
            </Text>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton, { backgroundColor: theme.primaryButton }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Navigate to MainTabs and reset the stack to go to Dashboard
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs' }],
                  });
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Return to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  } as any,
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  } as any,
  
  // Modern Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: width < 768 ? 12 : 16,
  },
  backButton: {
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  
  // Customer Card
  customerCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  customerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  customerInfo: {
    flex: 1,
  },
  customerTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  customerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  customerDetailsContainer: {
    gap: 16,
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 100,
  },
  customerDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  
  // Outcome Section
  outcomeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: '500',
  },
  outcomeOptions: {
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
  
  // Processing Container
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Action Buttons
  actionButtonsContainer: {
    gap: 16,
    marginTop: 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 16 : 18,
    borderRadius: 16,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 16 : 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 48,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtonContainer: {
    width: '100%',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    // backgroundColor will be set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
