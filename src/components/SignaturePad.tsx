import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

interface SignaturePadProps {
  onSignatureComplete: (signature: string) => void;
  onCancel: () => void;
  opportunityId?: string;
  customerName?: string;
  customerEmail?: string;
}

export default function SignaturePad({ 
  onSignatureComplete, 
  onCancel, 
  opportunityId, 
  customerName = 'Customer', 
  customerEmail = 'customer@example.com' 
}: SignaturePadProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDocuSealSigning = async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'Opportunity ID is required for DocuSeal signing');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔍 Starting DocuSeal signing workflow...');
      
      // Create DocuSeal contract signing workflow
      const { api } = await import('../utils/api');
      
      const contractResponse = await api.post('/contracts/create-signing-workflow', {
        opportunityId,
        customerName,
        customerEmail,
        date: new Date().toISOString().split('T')[0],
        postcode: '12345',
        contractType: 'solar_installation',
        solarData: {
          systemSize: '10kW',
          estimatedSavings: '$2,500/year',
          paybackPeriod: '7 years'
        }
      });

      if ((contractResponse.data as any).success) {
        console.log('🔍 DocuSeal contract created:', (contractResponse.data as any).data);
        
        // Navigate to DocuSeal signing screen
        navigation.navigate('DocuSealSigning', {
          submissionId: (contractResponse.data as any).data.submissionId,
          signingUrl: (contractResponse.data as any).data.signingUrl,
          opportunityId: opportunityId,
          customerName: customerName,
        });
        
        // Call the completion callback
        onSignatureComplete('DocuSeal signature initiated');
      } else {
        throw new Error((contractResponse.data as any).error || 'Failed to create DocuSeal contract');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal contract:', error);
      Alert.alert('Error', 'Failed to create DocuSeal signing workflow. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignComSigning = async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'Opportunity ID is required for Sign.com signing');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔍 Starting Sign.com signing workflow...');
      console.log('🔍 Navigating to SignCom screen with params:', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      // Navigate to Sign.com screen (web-compatible)
      navigation.navigate('SignComWeb', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      console.log('🔍 Sign.com navigation completed');
      
      // DON'T call onSignatureComplete for Sign.com - it triggers DocuSeal
      // onSignatureComplete('Sign.com signature initiated');
    } catch (error) {
      console.error('🔍 Error navigating to Sign.com:', error);
      Alert.alert('Error', 'Failed to open Sign.com. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdobeSignSigning = async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'Opportunity ID is required for Adobe Sign signing');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔍 Starting Adobe Sign signing workflow...');
      console.log('🔍 Navigating to Adobe Sign screen with params:', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      // Navigate to Adobe Sign screen
      navigation.navigate('AdobeSign', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      console.log('🔍 Adobe Sign navigation completed');
      
      // DON'T call onSignatureComplete for Adobe Sign - it triggers DocuSeal
      // onSignatureComplete('Adobe Sign signature initiated');
    } catch (error) {
      console.error('🔍 Error navigating to Adobe Sign:', error);
      Alert.alert('Error', 'Failed to open Adobe Sign. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectDocuSealSigning = async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'Opportunity ID is required for Direct DocuSeal signing');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🔍 Starting Direct DocuSeal signing workflow...');
      console.log('🔍 Navigating to DirectDocuSeal screen with params:', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      // Navigate to Direct DocuSeal screen
      navigation.navigate('DirectDocuSeal', {
        opportunityId: opportunityId,
        customerName: customerName,
        customerEmail: customerEmail,
      });
      
      console.log('🔍 Direct DocuSeal navigation completed');
      
      // DON'T call onSignatureComplete for Direct DocuSeal - it triggers DocuSeal
      // onSignatureComplete('Direct DocuSeal signature initiated');
    } catch (error) {
      console.error('🔍 Error navigating to Direct DocuSeal:', error);
      Alert.alert('Error', 'Failed to open Direct DocuSeal. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  console.log('🔍 Rendering DocuSeal SignaturePad');

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <Text style={[styles.title, { color: theme.primaryText }]}>DocuSeal Digital Signature</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Professional document signing with DocuSeal</Text>
        <View style={[styles.instructionsContainer, { backgroundColor: theme.primaryButton + '10' }]}>
          <Ionicons name="shield-checkmark" size={16} color={theme.primaryButton} />
          <Text style={[styles.instructionsText, { color: theme.primaryButton }]}>
            Your signature will be legally binding and securely stored
          </Text>
        </View>
      </View>

      <View style={[styles.signatureContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <View style={[styles.placeholderContainer, { backgroundColor: theme.tertiaryBackground }]}>
          <Ionicons name="document-text" size={64} color={theme.primaryButton} />
          <Text style={[styles.placeholderText, { color: theme.primaryText }]}>
            DocuSeal Professional Signing
          </Text>
          <Text style={[styles.placeholderSubtext, { color: theme.secondaryText }]}>
            Click below to open the professional DocuSeal signing interface
          </Text>
          <View style={[styles.featuresContainer, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primaryButton} />
              <Text style={[styles.featureText, { color: theme.primaryText }]}>Legally binding signatures</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primaryButton} />
              <Text style={[styles.featureText, { color: theme.primaryText }]}>Secure document storage</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.primaryButton} />
              <Text style={[styles.featureText, { color: theme.primaryText }]}>Audit trail</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.buttonContainer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]} onPress={onCancel}>
            <Ionicons name="close" size={20} color={theme.primaryText} />
            <Text style={[styles.cancelButtonText, { color: theme.primaryText }]}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.confirmButton, { backgroundColor: theme.secondaryButton }]} 
            onPress={handleSignComSigning}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="globe" size={20} color="#ffffff" />
            )}
            <Text style={styles.confirmButtonText}>
              {isProcessing ? 'Opening...' : 'Open Sign.com'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.confirmButton, { backgroundColor: '#DC143C' }]} 
            onPress={handleAdobeSignSigning}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#ffffff" />
            )}
            <Text style={styles.confirmButtonText}>
              {isProcessing ? 'Opening...' : 'Adobe Sign'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.confirmButton, { backgroundColor: '#4CAF50' }]} 
            onPress={handleDirectDocuSealSigning}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="flash" size={20} color="#ffffff" />
            )}
            <Text style={styles.confirmButtonText}>
              {isProcessing ? 'Opening...' : 'DocuSeal Direct'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.confirmButton, { backgroundColor: theme.primaryButton }]} 
            onPress={handleDocuSealSigning}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#ffffff" />
            )}
            <Text style={styles.confirmButtonText}>
              {isProcessing ? 'Creating Contract...' : 'Open DocuSeal Signing'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  instructionsText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  signatureContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresContainer: {
    padding: 16,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    padding: 20,
    borderTopWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    color: '#ffffff',
  },
});
