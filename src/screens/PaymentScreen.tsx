import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { workflowApi } from '../utils/api';

interface RouteParams {
  opportunityId: string;
}

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handlePaymentCompleted = async () => {
    try {
      setIsProcessingPayment(true);
      
      // Mark the payment step as completed
      const paymentStep = { stepNumber: 11 }; // Payment is step 11 in the workflow (after email confirmation)
      await workflowApi.completeStep(opportunityId, paymentStep.stepNumber, {
        paymentMethod: 'Mobile Device',
        completedAt: new Date().toISOString(),
        notes: 'Payment processed on mobile device'
      });
      
      // Navigate directly to the next step (Installation Booking - step 12)
      navigation.navigate('InstallationBooking', { 
        opportunityId,
        customerName: 'Customer',
        customerAddress: 'Customer Address'
      });
      
      // Show success message briefly
      Alert.alert(
        '✅ Payment Completed!', 
        'Payment step has been marked as completed. Navigating to Installation Booking...',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error completing payment step:', error);
      Alert.alert('Error', 'Failed to mark payment as completed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancel = () => {
    // Navigate back to workflow
    navigation.navigate('SolarWorkflow', { 
      opportunityId: opportunityId,
      opportunity: null
    });
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={handleCancel}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Process Payment
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Complete payment for the installation
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

      {/* Payment Interface */}
      <View style={styles.paymentContainer}>
        <View style={styles.paymentHeader}>
          <View style={[styles.paymentIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Feather name="smartphone" size={48} color={theme.primaryButton} />
          </View>
          <Text style={[styles.paymentTitle, { color: theme.primaryText }]}>
            Process Payment
          </Text>
          <Text style={[styles.paymentSubtitle, { color: theme.secondaryText }]}>
            Use your mobile payment device to process the customer's payment
          </Text>
        </View>

        <View style={[styles.paymentInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.paymentDetails}>
            <View style={styles.paymentDetailRow}>
              <Ionicons name="card-outline" size={16} color={theme.tertiaryText} />
              <Text style={[styles.paymentDetailText, { color: theme.secondaryText }]}>
                Payment Method: Mobile Device
              </Text>
            </View>
            <View style={styles.paymentDetailRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.tertiaryText} />
              <Text style={[styles.paymentDetailText, { color: theme.secondaryText }]}>
                Secure payment processing
              </Text>
            </View>
            <View style={styles.paymentDetailRow}>
              <Ionicons name="information-circle-outline" size={16} color={theme.tertiaryText} />
              <Text style={[styles.paymentDetailText, { color: theme.secondaryText }]}>
                Ensure payment is successful before marking complete
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.completeButton, 
            { backgroundColor: theme.primaryButton },
            isProcessingPayment && styles.completeButtonDisabled
          ]}
          onPress={handlePaymentCompleted}
          disabled={isProcessingPayment}
        >
          {isProcessingPayment ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="checkmark-circle" size={24} color="white" />
          )}
          <Text style={styles.completeButtonText}>
            {isProcessingPayment ? 'Processing...' : 'Mark Payment Complete & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    zIndex: 1,
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
    gap: 12,
  },
  backButton: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: 12,
    borderRadius: 16,
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
  paymentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  paymentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  paymentSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  paymentInfo: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentDetailText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  paymentFeatures: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
