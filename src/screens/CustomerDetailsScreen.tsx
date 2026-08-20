import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import CalculatorProgressService from '../services/CalculatorProgressService';
import {
  getCustomerDetailsFromRouteParams,
  parseSelectedOptions,
  type RouteCustomerDetails,
  type TemplateSelectedOptions,
} from '../utils/deepLinkParams';
import { V44_TEMPLATE_FILE } from '../utils/v44Logic';

const { width } = Dimensions.get('window');

interface RouteParams {
  templateFileName?: string;
  selectedOptions?: TemplateSelectedOptions | string;
  opportunityId?: string;
  calculatorType?: 'flux' | 'off-peak' | 'v44';
  customerDetails?: RouteCustomerDetails | string;
  customerName?: string;
  address?: string;
  postcode?: string;
}

interface CustomerDetails {
  customerName: string;
  address: string;
  postcode: string;
}

export default function CustomerDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const rawParams = route.params as RouteParams;
  const {
    templateFileName,
    opportunityId,
    calculatorType,
  } = rawParams;
  const selectedOptions = parseSelectedOptions(rawParams.selectedOptions);
  const urlCustomerDetails = getCustomerDetailsFromRouteParams(rawParams as Record<string, unknown>);
  
  console.log('🔍 CustomerDetailsScreen: Component loaded');
  console.log('🔍 CustomerDetailsScreen: Route params:', {
    templateFileName,
    selectedOptions,
    opportunityId,
    calculatorType,
    urlCustomerDetails,
  });
  
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilledDetails, setAutoFilledDetails] = useState<CustomerDetails | null>(null);
  
  // Progress management state
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedCustomerDetails, setSavedCustomerDetails] = useState<CustomerDetails | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current customer details match saved details
  const hasChanges = useCallback(() => {
    if (!savedCustomerDetails) {
      console.log('🔍 CustomerDetailsScreen hasChanges: No saved customer details available');
      return false;
    }
    
    console.log('🔍 CustomerDetailsScreen hasChanges: Comparing current vs saved values');
    console.log('🔍 Current customer details:', {
      customerName,
      address,
      postcode
    });
    console.log('🔍 Saved customer details:', savedCustomerDetails);
    
    const hasChangesResult = (
      customerName !== savedCustomerDetails.customerName ||
      address !== savedCustomerDetails.address ||
      postcode !== savedCustomerDetails.postcode
    );
    
    if (hasChangesResult) {
      console.log('🔍 CustomerDetailsScreen hasChanges: Changes detected');
    } else {
      console.log('🔍 CustomerDetailsScreen hasChanges: No changes detected - values match saved state');
    }
    
    return hasChangesResult;
  }, [customerName, address, postcode, savedCustomerDetails]);

  // Restore progress function
  const restoreProgress = useCallback(async () => {
    if (!opportunityId || isInitialized) return;
    
    try {
      console.log('🔍 CustomerDetailsScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType || 'v44',
      );
      
      if (urlCustomerDetails) {
        console.log('🔗 Applying customer details from URL query params:', urlCustomerDetails);
        setSavedCustomerDetails(urlCustomerDetails);
        setCustomerName(urlCustomerDetails.customerName || '');
        setAddress(urlCustomerDetails.address || '');
        setPostcode(urlCustomerDetails.postcode || '');
        setHasRestoredProgress(true);
      } else if (progress && progress.customerDetails) {
        console.log('🔄 Auto-restoring customer details from saved progress:', progress.customerDetails);
        
        // Store the saved data for comparison
        setSavedCustomerDetails(progress.customerDetails);
        
        // Restore customer details
        setCustomerName(progress.customerDetails.customerName || '');
        setAddress(progress.customerDetails.address || '');
        setPostcode(progress.customerDetails.postcode || '');
        
        setHasRestoredProgress(true);
        console.log('✅ Customer details restored and displayed in UI');
      } else {
        console.log('ℹ️ No customer details progress found to restore');
        setHasRestoredProgress(false);
      }
    } catch (error) {
      console.error('Error restoring customer details progress:', error);
      setHasRestoredProgress(false);
    } finally {
      setIsInitialized(true);
    }
  }, [opportunityId, isInitialized, calculatorType, urlCustomerDetails]);

  // Auto-save progress function
  const saveProgress = useCallback(async () => {
    if (!opportunityId || !customerName.trim() || !address.trim()) return;
    
    try {
      const customerDetails = {
        customerName: customerName.trim(),
        address: address.trim(),
        postcode: postcode.trim(),
      };

      await CalculatorProgressService.saveProgress(opportunityId, calculatorType || 'v44', {
        currentStep: 'template-selection' as const,
        customerDetails,
      });
      
      console.log('✅ Customer details progress saved successfully');
    } catch (error) {
      console.error('❌ Error saving customer details progress:', error);
    }
  }, [opportunityId, customerName, address, postcode]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress();
    }, 1000); // Save after 1 second of no changes
  }, [saveProgress]);

  useEffect(() => {
    const init = async () => {
      await restoreProgress();
      if (!urlCustomerDetails) {
        await loadCustomerDetails();
      } else {
        setIsLoading(false);
      }
    };
    
    init();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [opportunityId, restoreProgress, urlCustomerDetails]);

  // Auto-save when customer details change
  useEffect(() => {
    if (isInitialized && hasRestoredProgress && customerName.trim() && address.trim()) {
      debouncedSave();
    }
  }, [customerName, address, postcode, isInitialized, hasRestoredProgress, debouncedSave]);



  const enrichWithContactDetails = async (id: string) => {
    try {
      const { api } = await import('../utils/api');
      console.log('📍 Fetching detailed contact info for opportunity via /opportunities/:id/details', id);
      const detailsResponse = await api.get(`/opportunities/${id}/details`);
      console.log('📍 Details API response:', detailsResponse.data);

      if (detailsResponse.data) {
        const detailsData = detailsResponse.data as {
          contactAddress?: string | null;
          contactPostcode?: string | null;
          address?: string | null;
        };

        const resolvedAddress = detailsData.contactAddress || detailsData.address || '';
        const resolvedPostcode = detailsData.contactPostcode || '';

        if (resolvedAddress) {
          setAddress(resolvedAddress);
        }
        if (resolvedPostcode) {
          setPostcode(prev => prev || resolvedPostcode);
        }

        setAutoFilledDetails(prev => ({
          customerName: prev?.customerName || customerName || 'Customer',
          address: resolvedAddress || prev?.address || address || '',
          postcode: resolvedPostcode || prev?.postcode || postcode || ''
        }));
      }
    } catch (e: any) {
      console.warn('⚠️ Failed to fetch /opportunities/:id/details:', e?.message);
    }
  };

  const loadCustomerDetails = async () => {
    try {
      setIsLoading(true);
      
      console.log('🔍 Loading customer details for opportunityId:', opportunityId);
      
      if (opportunityId) {
        // Fetch customer details from the opportunity
        const { api } = await import('../utils/api');
        console.log('🌐 Making API call to:', `/opportunities/${opportunityId}`);
        const response = await api.get(`/opportunities/${opportunityId}`);
        console.log('📡 API Response:', response.data);
        
        console.log('📡 Full API Response:', response);
        console.log('📡 Response data:', response.data);
        console.log('📡 Response data.success:', response.data?.success);
        console.log('📡 Response data.data:', response.data?.data);
        
        if (response.data?.success && response.data?.data) {
          const opportunity = response.data.data;
          
          console.log('📋 Raw opportunity data:', opportunity);
          
          // Parse the name field which contains "N12 9JA, Lisa Jones" format
          let customerName = 'Customer';
          let address = '';
          let postcode = '';
          
          console.log('🔍 Parsing opportunity name:', opportunity.name);
          
          if (opportunity.name) {
            // The name field contains "POSTCODE, CUSTOMER_NAME" format
            const nameParts = opportunity.name.split(', ');
            console.log('🔍 Name parts after split:', nameParts);
            
            if (nameParts.length >= 2) {
              postcode = nameParts[0].trim();
              customerName = nameParts[1].trim();
              console.log('🔍 Extracted postcode:', postcode);
              console.log('🔍 Extracted customer name:', customerName);
            } else if (nameParts.length === 1) {
              // If only one part, assume it's the customer name
              customerName = nameParts[0].trim();
              console.log('🔍 Single part - using as customer name:', customerName);
            }
          }
          
          // Try to get address from contact information
          console.log('🔍 Looking for contact information:', opportunity.contact);
          
          if (opportunity.contact) {
            console.log('🔍 Contact data found:', opportunity.contact);
            console.log('🔍 All contact fields:', Object.keys(opportunity.contact));
            
            // Try to get address from contact fields
            if (opportunity.contact.address) {
              address = opportunity.contact.address;
              console.log('🔍 Found address in contact.address:', address);
            } else if (opportunity.contact.location) {
              address = opportunity.contact.location;
              console.log('🔍 Found address in contact.location:', address);
            } else if (opportunity.contact.streetAddress) {
              address = opportunity.contact.streetAddress;
              console.log('🔍 Found address in contact.streetAddress:', address);
            } else if (opportunity.contact.city && opportunity.contact.state) {
              address = `${opportunity.contact.city}, ${opportunity.contact.state}`;
              console.log('🔍 Constructed address from contact.city and contact.state:', address);
            } else if (opportunity.contact.street) {
              address = opportunity.contact.street;
              console.log('🔍 Found address in contact.street:', address);
            } else if (opportunity.contact.city) {
              address = opportunity.contact.city;
              console.log('🔍 Found address in contact.city:', address);
            } else if (opportunity.contact.state) {
              address = opportunity.contact.state;
              console.log('🔍 Found address in contact.state:', address);
            } else if (opportunity.contact.country) {
              address = opportunity.contact.country;
              console.log('🔍 Found address in contact.country:', address);
            } else {
              console.log('🔍 No address found in contact data');
              console.log('🔍 Available contact fields:', {
                address: opportunity.contact.address,
                location: opportunity.contact.location,
                streetAddress: opportunity.contact.streetAddress,
                street: opportunity.contact.street,
                city: opportunity.contact.city,
                state: opportunity.contact.state,
                country: opportunity.contact.country
              });
            }
          } else {
            // Fallback to opportunity fields
            console.log('🔍 No contact data, looking for address in opportunity fields:', {
              address: opportunity.address,
              contactAddress: opportunity.contactAddress,
              location: opportunity.location
            });
            
            if (opportunity.address) {
              address = opportunity.address;
              console.log('🔍 Found address in opportunity.address:', address);
            } else if (opportunity.contactAddress) {
              address = opportunity.contactAddress;
              console.log('🔍 Found address in opportunity.contactAddress:', address);
            } else if (opportunity.location) {
              address = opportunity.location;
              console.log('🔍 Found address in opportunity.location:', address);
            } else {
              console.log('🔍 No address found in opportunity data');
            }
          }
          
          // Auto-fill customer details from opportunity
          const details: CustomerDetails = {
            customerName: customerName,
            address: address,
            postcode: postcode,
          };
          
          console.log('🔍 Setting state values:', {
            customerName: details.customerName,
            address: details.address,
            postcode: details.postcode
          });
          
          setCustomerName(details.customerName);
          setAddress(details.address);
          setPostcode(details.postcode);
          setAutoFilledDetails(details);
          
          console.log('✅ Auto-filled customer details:', details);
          console.log('✅ State values set:', {
            customerName: details.customerName,
            address: details.address,
            postcode: details.postcode
          });

          // Enrich using dedicated details endpoint (contact lookup)
          await enrichWithContactDetails(opportunityId);
        } else {
          console.log('⚠️ API response structure not as expected, trying fallback parsing...');
          
          // Try to parse the response directly if it doesn't have the expected structure
          const opportunity = response.data;
          console.log('🔍 Trying to parse response directly:', opportunity);
          
          if (opportunity && opportunity.name) {
            console.log('🔍 Found opportunity name in direct response:', opportunity.name);
            
            // Parse the name field which contains "N12 9JA, Lisa Jones" format
            let customerName = 'Customer';
            let address = '';
            let postcode = '';
            
            console.log('🔍 Parsing opportunity name (fallback):', opportunity.name);
            
            if (opportunity.name) {
              // The name field contains "POSTCODE, CUSTOMER_NAME" format
              const nameParts = opportunity.name.split(', ');
              console.log('🔍 Name parts after split (fallback):', nameParts);
              
              if (nameParts.length >= 2) {
                postcode = nameParts[0].trim();
                customerName = nameParts[1].trim();
                console.log('🔍 Extracted postcode (fallback):', postcode);
                console.log('🔍 Extracted customer name (fallback):', customerName);
              } else if (nameParts.length === 1) {
                // If only one part, assume it's the customer name
                customerName = nameParts[0].trim();
                console.log('🔍 Single part - using as customer name (fallback):', customerName);
              }
            }
            
            // Try to get address from contact information (fallback)
            console.log('🔍 Looking for contact information (fallback):', opportunity.contact);
            
            if (opportunity.contact) {
              console.log('🔍 Contact data found (fallback):', opportunity.contact);
              console.log('🔍 All contact fields (fallback):', Object.keys(opportunity.contact));
              
              // Try to get address from contact fields
              if (opportunity.contact.address) {
                address = opportunity.contact.address;
                console.log('🔍 Found address in contact.address (fallback):', address);
              } else if (opportunity.contact.location) {
                address = opportunity.contact.location;
                console.log('🔍 Found address in contact.location (fallback):', address);
              } else if (opportunity.contact.streetAddress) {
                address = opportunity.contact.streetAddress;
                console.log('🔍 Found address in contact.streetAddress (fallback):', address);
              } else if (opportunity.contact.city && opportunity.contact.state) {
                address = `${opportunity.contact.city}, ${opportunity.contact.state}`;
                console.log('🔍 Constructed address from contact.city and contact.state (fallback):', address);
              } else if (opportunity.contact.street) {
                address = opportunity.contact.street;
                console.log('🔍 Found address in contact.street (fallback):', address);
              } else if (opportunity.contact.city) {
                address = opportunity.contact.city;
                console.log('🔍 Found address in contact.city (fallback):', address);
              } else if (opportunity.contact.state) {
                address = opportunity.contact.state;
                console.log('🔍 Found address in contact.state (fallback):', address);
              } else if (opportunity.contact.country) {
                address = opportunity.contact.country;
                console.log('🔍 Found address in contact.state (fallback):', address);
              } else {
                console.log('🔍 No address found in contact data (fallback)');
                console.log('🔍 Available contact fields (fallback):', {
                  address: opportunity.contact.address,
                  location: opportunity.contact.location,
                  streetAddress: opportunity.contact.streetAddress,
                  street: opportunity.contact.street,
                  city: opportunity.contact.city,
                  state: opportunity.contact.state,
                  country: opportunity.contact.country
                });
              }
            } else {
              // Fallback to opportunity fields
              console.log('🔍 No contact data, looking for address in opportunity fields (fallback):', {
                address: opportunity.address,
                contactAddress: opportunity.contactAddress,
                location: opportunity.location
              });
              
              if (opportunity.address) {
                address = opportunity.address;
                console.log('🔍 Found address in opportunity.address (fallback):', address);
              } else if (opportunity.contactAddress) {
                address = opportunity.contactAddress;
                console.log('🔍 Found address in opportunity.contactAddress (fallback):', address);
              } else if (opportunity.location) {
                address = opportunity.location;
                console.log('🔍 Found address in opportunity.location (fallback):', address);
              } else {
                console.log('🔍 No address found in opportunity data (fallback)');
              }
            }
            
            // Auto-fill customer details from opportunity
            const details: CustomerDetails = {
              customerName: customerName,
              address: address,
              postcode: postcode,
            };
            
            console.log('🔍 Setting state values (fallback):', {
              customerName: details.customerName,
              address: details.address,
              postcode: details.postcode
            });
            
            setCustomerName(details.customerName);
            setAddress(details.address);
            setPostcode(details.postcode);
            setAutoFilledDetails(details);

            // Enrich using dedicated details endpoint (contact lookup)
            await enrichWithContactDetails(opportunityId);
          } else {
            // Fallback to default values
            const defaultDetails: CustomerDetails = {
              customerName: 'Customer',
              address: '',
              postcode: '',
            };
            
            setCustomerName(defaultDetails.customerName);
            setAddress(defaultDetails.address);
            setPostcode(defaultDetails.postcode);
            setAutoFilledDetails(defaultDetails);
          }
        }
      } else {
        // No opportunity ID, use default values
        const defaultDetails: CustomerDetails = {
          customerName: 'Customer',
          address: '',
          postcode: '',
        };
        
        setCustomerName(defaultDetails.customerName);
        setAddress(defaultDetails.address);
        setPostcode(defaultDetails.postcode);
        setAutoFilledDetails(defaultDetails);
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      
      // Fallback to default values
      const defaultDetails: CustomerDetails = {
        customerName: 'Customer',
        address: '',
        postcode: '',
      };
      
      setCustomerName(defaultDetails.customerName);
      setAddress(defaultDetails.address);
      setPostcode(defaultDetails.postcode);
      setAutoFilledDetails(defaultDetails);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDetails = async () => {
    console.log('🔍 CustomerDetailsScreen: handleConfirmDetails called');
    console.log('🔍 CustomerDetailsScreen: customerName:', customerName);
    console.log('🔍 CustomerDetailsScreen: address:', address);
    console.log('🔍 CustomerDetailsScreen: postcode:', postcode);
    
    if (!customerName.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the customer name');
      return;
    }
    
    if (!address.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the address');
      return;
    }

    // Only require template if we're not skipping
    if (!templateFileName && selectedOptions) {
      Alert.alert('⚠️ Template Error', 'No template selected. Please go back and select system components.');
      return;
    }

    // Define details outside try block so it's accessible in navigation logic
    const details: CustomerDetails = {
      customerName: customerName.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
    };

    try {
      setIsSubmitting(true);
      console.log('✅ Customer details confirmed');

      // Save progress to JSON (NO COM call - Excel update happens on final submit)
      const calcType = calculatorType || 'v44'; // Default to v4.4 for new jobs
      await CalculatorProgressService.saveProgress(opportunityId!, calcType, {
        currentStep: 'template-selection' as const,
        customerDetails: details,
        completedSteps: {
          'template-selection': true,
        },
      });
      console.log('✅ Customer details saved to JSON (no COM call)');
    } catch (error) {
      console.error('❌ Error updating customer details:', error);
      Alert.alert('Error', 'Failed to update customer details. Please try again.');
      return;
    } finally {
      setIsSubmitting(false);
    }

    // Check if calculator type is already selected
    if ((route.params as any)?.calculatorType) {
      const calculatorType = (route.params as any).calculatorType;
      console.log('✅ Calculator type already selected:', calculatorType);
      
      // Navigate directly to the appropriate calculator
      // If skipping template selection, provide default values
      const defaultTemplateFileName = templateFileName || V44_TEMPLATE_FILE;
      const defaultSelectedOptions = selectedOptions || {
        solar: true,
        battery: false,
        solarHybrid: false,
        batteryInverter: false
      };
      
      if (calculatorType === 'v44') {
        (navigation as any).navigate('CalculatorQuestions', {
          opportunityId,
          customerDetails: details,
          calculatorType: 'v44',
        });
      } else if (calculatorType === 'flux') {
        (navigation as any).navigate('FluxRadioButton', {
          opportunityId,
          customerDetails: details,
          templateFileName: defaultTemplateFileName,
          selectedOptions: defaultSelectedOptions,
          calculatorType: 'flux'
        });
      } else {
        (navigation as any).navigate('Calculator', {
          opportunityId,
          customerDetails: details,
          templateFileName: defaultTemplateFileName,
          selectedOptions: defaultSelectedOptions,
          calculatorType: 'off-peak'
        });
      }
    } else {
      // Navigate to Calculator Type Selection with all the data
      // If skipping template selection, provide default values
      const defaultTemplateFileName = templateFileName || V44_TEMPLATE_FILE;
      const defaultSelectedOptions = selectedOptions || {
        solar: true,
        battery: false,
        solarHybrid: false,
        batteryInverter: false
      };
      
      // Navigate to the appropriate calculator based on calculator type
      const calcType = calculatorType || 'v44';
      if (calcType === 'v44') {
        (navigation as any).navigate('CalculatorQuestions', {
          opportunityId,
          customerDetails: details,
          calculatorType: 'v44',
        });
      } else if (calcType === 'flux') {
        (navigation as any).navigate('Calculator', {
          opportunityId,
          calculatorType: 'flux',
          templateFileName: defaultTemplateFileName,
          selectedOptions: defaultSelectedOptions,
        });
      } else {
        (navigation as any).navigate('Calculator', {
          opportunityId,
          calculatorType: 'off-peak',
          templateFileName: defaultTemplateFileName,
          selectedOptions: defaultSelectedOptions,
        });
      }
    }
  };

  const handleEditDetails = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (isEditing) {
      // If editing, revert to auto-filled details
      if (autoFilledDetails) {
        setCustomerName(autoFilledDetails.customerName);
        setAddress(autoFilledDetails.address);
        setPostcode(autoFilledDetails.postcode);
      }
      setIsEditing(false);
    } else {
      // Navigate directly to SolarWorkflowScreen instead of going back
      (navigation as any).navigate('SolarWorkflow', { 
        opportunityId: opportunityId,
        opportunity: null // Pass null as we don't have opportunity data here
      });
    }
  };

  const handleSaveEdit = () => {
    if (!customerName.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the customer name');
      return;
    }
    
    if (!address.trim()) {
      Alert.alert('⚠️ Required Field', 'Please enter the address');
      return;
    }

    setIsEditing(false);
    Alert.alert('✅ Details Updated', 'Customer details have been updated successfully.');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading customer details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
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
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={handleCancel}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Customer Details</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {isEditing ? 'Edit customer information' : 'Confirm customer information'}
              </Text>
            </View>
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
        <View style={styles.content}>
          {/* Auto-fill Notification */}
          {!isEditing && autoFilledDetails && (
            <View style={[styles.autoFillCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.autoFillHeader}>
                <Ionicons name="checkmark-circle" size={24} color={theme.successButton} />
                <Text style={[styles.autoFillTitle, { color: theme.primaryText }]}>Auto-filled Details</Text>
              </View>
              <Text style={[styles.autoFillDescription, { color: theme.secondaryText }]}>
                Customer details have been automatically filled from the opportunity data. Please review and confirm.
              </Text>
            </View>
          )}



          {/* Form */}
          <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            {/* Customer Name */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.primaryText }]}>
                Customer Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.secondaryBackground, 
                  borderColor: theme.cardBorder, 
                  color: theme.primaryText 
                }]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor={theme.tertiaryText}
                editable={isEditing}

              />
            </View>

            {/* Address */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.primaryText }]}>
                Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.addressInput, { 
                  backgroundColor: theme.secondaryBackground, 
                  borderColor: theme.cardBorder, 
                  color: theme.primaryText 
                }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter full address"
                placeholderTextColor={theme.tertiaryText}
                multiline
                numberOfLines={3}
                editable={isEditing}

              />
            </View>

            {/* Postcode */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.primaryText }]}>Full Postcode</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.secondaryBackground, 
                  borderColor: theme.cardBorder, 
                  color: theme.primaryText 
                }]}
                value={postcode}
                onChangeText={setPostcode}
                placeholder="Enter postcode"
                placeholderTextColor={theme.tertiaryText}
                autoCapitalize="characters"
                editable={isEditing}

              />
            </View>
          </View>

          {/* Skip Button - Only show if user has customer details AND we restored progress AND no changes from saved state */}
          {(() => {
            const hasCustomerDetails = customerName.trim() && address.trim();
            const canSkip = hasCustomerDetails && hasRestoredProgress && savedCustomerDetails && !hasChanges();
            
            console.log('🔍 CustomerDetailsScreen Skip button conditions:', {
              hasCustomerDetails,
              hasRestoredProgress,
              hasSavedCustomerDetails: !!savedCustomerDetails,
              hasChanges: hasChanges(),
              canSkip
            });
            
            return canSkip;
          })() && (
            <TouchableOpacity
              style={[styles.skipButton, { 
                borderColor: theme.dangerButton,
                backgroundColor: theme.dangerButton + '10'
              }]}
              onPress={async () => {
                console.log('🔍 CustomerDetailsScreen Skip button pressed - navigating to next screen');
                try {
                  // Mark customer details step as completed
                  const calcType = (route.params as any)?.calculatorType || 'v44';
                  await CalculatorProgressService.saveProgress(opportunityId!, calcType, {
                    currentStep: 'template-selection' as const,
                    completedSteps: {
                      'template-selection': true,
                    },
                  });
                  
                  // Navigate to next screen based on calculator type
                  const details: CustomerDetails = {
                    customerName: customerName.trim(),
                    address: address.trim(),
                    postcode: postcode.trim(),
                  };
                  
                  if ((route.params as any)?.calculatorType) {
                    const calculatorType = (route.params as any).calculatorType;
                    console.log('✅ Calculator type already selected:', calculatorType);
                    
                    const defaultTemplateFileName = templateFileName || V44_TEMPLATE_FILE;
                    const defaultSelectedOptions = selectedOptions || {
                      solar: true,
                      battery: false,
                      solarHybrid: false,
                      batteryInverter: false
                    };
                    
                    if (calculatorType === 'v44') {
                      (navigation as any).navigate('CalculatorQuestions', {
                        opportunityId,
                        customerDetails: details,
                        calculatorType: 'v44',
                      });
                    } else if (calculatorType === 'flux') {
                      (navigation as any).navigate('FluxRadioButton', {
                        opportunityId,
                        customerDetails: details,
                        templateFileName: defaultTemplateFileName,
                        selectedOptions: defaultSelectedOptions,
                        calculatorType: 'flux'
                      });
                    } else {
                      (navigation as any).navigate('Calculator', {
                        opportunityId,
                        customerDetails: details,
                        templateFileName: defaultTemplateFileName,
                        selectedOptions: defaultSelectedOptions,
                        calculatorType: 'off-peak'
                      });
                    }
                  } else {
                    const defaultTemplateFileName = templateFileName || V44_TEMPLATE_FILE;
                    const defaultSelectedOptions = selectedOptions || {
                      solar: true,
                      battery: false,
                      solarHybrid: false,
                      batteryInverter: false
                    };
                    
                    // Navigate to the appropriate calculator based on calculator type
                    const calcType = calculatorType || 'v44';
                    if (calcType === 'v44') {
                      (navigation as any).navigate('CalculatorQuestions', {
                        opportunityId,
                        customerDetails: details,
                        calculatorType: 'v44',
                      });
                    } else if (calcType === 'flux') {
                      (navigation as any).navigate('Calculator', {
                        opportunityId,
                        calculatorType: 'flux',
                        templateFileName: defaultTemplateFileName,
                        selectedOptions: defaultSelectedOptions,
                      });
                    } else {
                      (navigation as any).navigate('Calculator', {
                        opportunityId,
                        calculatorType: 'off-peak',
                        templateFileName: defaultTemplateFileName,
                        selectedOptions: defaultSelectedOptions,
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error skipping customer details step:', error);
                  Alert.alert('Error', 'Failed to skip customer details step. Please try again.');
                }
              }}
              activeOpacity={0.8}
            >
              <Feather name="skip-forward" size={16} color={theme.dangerButton} />
              <Text style={[styles.skipButtonText, { color: theme.dangerButton }]}>
                Skip
              </Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isEditing ? (
              <>
                <TouchableOpacity 
                  style={[styles.cancelButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]} 
                  onPress={handleCancel}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.secondaryText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitButton, { backgroundColor: theme.primaryButton }]} 
                  onPress={handleSaveEdit}
                >
                  <Text style={[styles.submitButtonText, { color: '#ffffff' }]}>Save Changes</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.cancelButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]} 
                  onPress={handleEditDetails}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.secondaryText }]}>Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.submitButton, 
                    { backgroundColor: isSubmitting ? theme.tertiaryText : theme.primaryButton }
                  ]} 
                  onPress={handleConfirmDetails}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.submitButtonText, { color: '#ffffff' }]}>
                    {isSubmitting ? 'Updating...' : 'Confirm & Continue'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  autoFillCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 32, // Extra spacing for web
      minHeight: 100, // Ensure auto-fill card has minimum height
    }),
  },
  autoFillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoFillTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.2,
  },
  autoFillDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  formCard: {
    marginBottom: 32,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra spacing for web
      minHeight: 300, // Ensure form card has minimum height
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 56,
    fontWeight: '500',
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra spacing for web
      minHeight: 60, // Ensure actions container has minimum height
    }),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 16 : 18,
    borderRadius: 16,
    marginBottom: 16,
    gap: 8,
    borderWidth: 2,
    backgroundColor: 'transparent',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
