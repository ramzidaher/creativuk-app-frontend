import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomerDetails {
  customerName: string;
  address: string;
  postcode: string;
}

interface CustomerDetailsFormProps {
  visible: boolean;
  opportunityId: string;
  templateFileName?: string;
  calculatorType?: 'flux' | 'off-peak';
  selectedOptions?: {
    solar: boolean;
    solarHybrid: boolean;
    batteryInverter: boolean;
  };
  onComplete: (details: CustomerDetails) => void;
  onCancel: () => void;
}

export default function CustomerDetailsForm({ visible, opportunityId, templateFileName, calculatorType, selectedOptions, onComplete, onCancel }: CustomerDetailsFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    console.log('🔍 handleSubmit called!');
    console.log('🔍 customerName:', customerName);
    console.log('🔍 address:', address);
    console.log('🔍 templateFileName:', templateFileName);
    
    if (!customerName.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the customer name');
      return;
    }
    
    if (!address.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the address');
      return;
    }

    if (!templateFileName) {
      Alert.alert('⚠️ Template Error', 'No template selected. Please go back and select system components.');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('🔍 Calling backend to update customer details...');
      console.log('🔍 Template file name:', templateFileName);
      
      const { api } = await import('../utils/api');
      
      // Call the correct backend endpoint based on calculator type
      let result;
      if (calculatorType === 'flux') {
        // For Flux (EPVS) calculators, use the EPVS automation endpoint
        console.log('🔍 Using EPVS automation endpoint for Flux calculator');
        result = await api.post('/epvs-automation/save-dynamic-inputs', {
          opportunityId,
          inputs: {
            customer_name: customerName.trim(),
            customer_address: address.trim(),
            customer_postcode: postcode.trim(),
          },
          templateFileName,
        });
      } else {
        // For off-peak calculators, use the Excel automation endpoint
        console.log('🔍 Using Excel automation endpoint for off-peak calculator');
        result = await api.post('/excel-automation/create-opportunity-file', {
          opportunityId,
          customerDetails: {
            customerName: customerName.trim(),
            address: address.trim(),
            postcode: postcode.trim(),
          },
          templateFileName,
        });
      }

      console.log('🔍 Backend response for customer details update:', result);
      
      const responseData = result.data as any;
      if (responseData.success) {
        console.log('✅ Customer details updated successfully');
        
        // Call onComplete with the details
        onComplete({
          customerName: customerName.trim(),
          address: address.trim(),
          postcode: postcode.trim(),
        });

        // Reset form
        setCustomerName('');
        setAddress('');
        setPostcode('');
        
        // The parent component should handle navigation in the onComplete callback
        console.log('✅ CustomerDetailsForm: onComplete called, parent should handle navigation');
      } else {
        console.error('❌ Failed to update customer details:', responseData.message);
        Alert.alert('Error', 'Failed to update customer details. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error updating customer details:', error);
      Alert.alert('Error', 'Failed to update customer details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Setup',
      'Are you sure you want to cancel? Customer details are required to proceed.',
      [
        { text: 'Continue Setup', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: onCancel }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Customer Details</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.description}>
              Please enter the customer details to create a personalized calculation file.
            </Text>

            {/* Customer Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Customer Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter full address"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Postcode */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Postcode</Text>
              <TextInput
                style={styles.input}
                value={postcode}
                onChangeText={setPostcode}
                placeholder="Enter postcode"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Text style={styles.submitButtonText}>Updating...</Text>
              ) : (
                <Text style={styles.submitButtonText}>Continue to Calculator</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  form: {
    padding: 24,
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    lineHeight: 24,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  required: {
    color: '#ef4444',
  },
  input: {
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
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#B4F35B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '700',
  },
});
