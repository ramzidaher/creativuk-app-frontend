import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import CalculatorDataService from '../services/CalculatorDataService';
import CalculatorProgressService from '../services/CalculatorProgressService';

const { width, height } = Dimensions.get('window');

interface RadioButtonGroup {
  title: string;
  description: string;
  options: {
    label: string;
    endpoint: string;
    shapeName: string;
  }[];
}

const radioButtonGroups: RadioButtonGroup[] = [
  {
    title: '⚡ Energy Use',
    description: 'Select your energy use type:',
    options: [
      {
        label: 'Single Rate / Standard',
        endpoint: '/epvs-automation/energy-use/single-rate',
        shapeName: 'SingleRate'
      },
      {
        label: 'Dual Rate / Off-Peak',
        endpoint: '/epvs-automation/energy-use/dual-rate',
        shapeName: 'DualRate'
      }
    ]
  },
  {
    title: '📊 Annual Usage',
    description: 'Do you have annual consumption data?',
    options: [
      {
        label: 'Yes',
        endpoint: '/epvs-automation/annual-usage/yes',
        shapeName: 'AnnualConsumptionYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/annual-usage/no',
        shapeName: 'AnnualConsumptionNo'
      }
    ]
  },
  {
    title: '👤 Existing Customer',
    description: 'Are you an existing customer?',
    options: [
      {
        label: 'Yes',
        endpoint: '/epvs-automation/existing-customer/yes',
        shapeName: 'ExistingSolarYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/existing-customer/no',
        shapeName: 'ExistingSolarNo'
      }
    ]
  },
  {
    title: '🔋 Battery Warranty',
    description: 'Do you want battery warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/epvs-automation/battery-warranty/yes',
        shapeName: 'BatteryWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/battery-warranty/no',
        shapeName: 'BatteryWarrantyNo'
      }
    ]
  },
  {
    title: '☀️ Solar/Hybrid Warranty',
    description: 'Do you want solar/hybrid warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/epvs-automation/solar-hybrid-warranty/yes',
        shapeName: 'SolarInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/solar-hybrid-warranty/no',
        shapeName: 'SolarInverterWarrantyNo'
      }
    ]
  },
  {
    title: '🔌 Battery Inverter Warranty',
    description: 'Do you need battery inverter warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/epvs-automation/battery-inverter/yes',
        shapeName: 'BatteryInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/battery-inverter/no',
        shapeName: 'BatteryInverterWarrantyNo'
      }
    ]
  },
  {
    title: '💳 Payment',
    description: 'Select your payment preference:',
          options: [
        {
          label: 'Cash',
          endpoint: '/epvs-automation/payment/cash',
          shapeName: 'Cash'
        },
        {
          label: 'Finance',
          endpoint: '/epvs-automation/payment/finance',
          shapeName: 'Finance'
        },
        {
          label: 'Hometree',
          endpoint: '/epvs-automation/payment/hometree',
          shapeName: 'Hometree'
        }
      ]
  },
];

export default function FluxRadioButtonScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark, toggleTheme } = useTheme();
  const opportunityId = route.params?.opportunityId;
  const templateFileName = route.params?.templateFileName;
  
  // Validate and fix template options from route params (same as Off-Peak)
  const rawSelectedTemplateOptions = route.params?.selectedOptions;
  let selectedTemplateOptions: {
    solar?: boolean;
    battery?: boolean;
    solarHybrid?: boolean;
    batteryInverter?: boolean;
  } | undefined;
  
  // Validate template options - handle stringified [object Object]
  if (rawSelectedTemplateOptions) {
    if (typeof rawSelectedTemplateOptions === 'object' && rawSelectedTemplateOptions !== null && !Array.isArray(rawSelectedTemplateOptions)) {
      // Check if it's the stringified [object Object] pattern (object with numeric keys)
      const keys = Object.keys(rawSelectedTemplateOptions);
      if (keys.length > 0 && keys[0] === '0' && keys.some(k => /^\d+$/.test(k))) {
        const values = keys.map(k => rawSelectedTemplateOptions[k]).join('');
        if (values === '[object Object]') {
          console.warn('⚠️ EPVSRadioButtonScreen: Template options is stringified [object Object], ignoring');
          selectedTemplateOptions = undefined;
        } else {
          // Has numeric keys but not [object Object] - check if it has expected properties
          if ('solar' in rawSelectedTemplateOptions || 'battery' in rawSelectedTemplateOptions || 'solarHybrid' in rawSelectedTemplateOptions || 'batteryInverter' in rawSelectedTemplateOptions) {
            selectedTemplateOptions = rawSelectedTemplateOptions;
          } else {
            selectedTemplateOptions = undefined;
          }
        }
      } else {
        // Normal object - check if it has expected properties
        if ('solar' in rawSelectedTemplateOptions || 'battery' in rawSelectedTemplateOptions || 'solarHybrid' in rawSelectedTemplateOptions || 'batteryInverter' in rawSelectedTemplateOptions) {
          selectedTemplateOptions = rawSelectedTemplateOptions;
        }
      }
    } else if (typeof rawSelectedTemplateOptions === 'string' && rawSelectedTemplateOptions !== '[object Object]') {
      try {
        const parsed = JSON.parse(rawSelectedTemplateOptions);
        if (parsed && typeof parsed === 'object') {
          selectedTemplateOptions = parsed;
        }
      } catch (e) {
        console.warn('⚠️ EPVSRadioButtonScreen: Could not parse template options from string:', e);
        selectedTemplateOptions = undefined;
      }
    } else if (typeof rawSelectedTemplateOptions === 'string' && rawSelectedTemplateOptions === '[object Object]') {
      console.warn('⚠️ EPVSRadioButtonScreen: Template options is stringified [object Object], ignoring');
      selectedTemplateOptions = undefined;
    }
  }
  
  console.log('🔍 EPVSRadioButtonScreen: Raw template options from route:', rawSelectedTemplateOptions);
  console.log('🔍 EPVSRadioButtonScreen: Validated template options:', selectedTemplateOptions);
  
  const passedCustomerDetails = route.params?.customerDetails;
  const calculatorType = route.params?.calculatorType || 'epvs';
  
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [fileCreated, setFileCreated] = useState(false);
  const [applying, setApplying] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  
  // Progress management state
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedSelectedOptions, setSavedSelectedOptions] = useState<Record<string, string> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringProgress = useRef<boolean>(false);

  // Restore customer details and radio button selections immediately on mount (separate from checkForSavedProgress to show in UI quickly)
  useEffect(() => {
    const restoreProgress = async () => {
      if (!opportunityId) return;
      
      try {
        // Try CalculatorProgressService first (backend API)
        const { default: CalculatorProgressService } = await import('../services/CalculatorProgressService');
        let progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          calculatorType
        );
        
        // If CalculatorProgressService doesn't have it, try CalculatorDataService (local storage)
        if (!progress || !progress.customerDetails) {
          const { default: CalculatorDataService } = await import('../services/CalculatorDataService');
          const localProgress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
          
          if (localProgress && localProgress.customerDetails) {
            progress = {
              ...progress,
              customerDetails: localProgress.customerDetails
            } as any;
          }
        }
        
        // Restore customer details from JSON if available
        if (progress && progress.customerDetails) {
          setCustomerDetails(progress.customerDetails);
          
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from JSON immediately in EPVSRadioButtonScreen:', progress.customerDetails);
          }
        }
        
        // Restore radio button selections from backend API if available
        if (progress && progress.radioButtonSelections) {
          console.log('🔄 Auto-restoring radio button selections from backend API:', progress.radioButtonSelections);
          
          // Clean up invalid selections that don't match current radio button groups
          const validGroupTitles = radioButtonGroups.map(group => group.title);
          const cleanedSelectedOptions: Record<string, string> = {};
          
          Object.entries(progress.radioButtonSelections).forEach(([key, value]) => {
            if (typeof value === 'string' && validGroupTitles.includes(key)) {
              cleanedSelectedOptions[key] = value;
            } else {
              console.log(`🗑️ Removing invalid selection: ${key} = ${value}`);
            }
          });
          
          console.log('🔄 Setting cleaned selected options from backend:', cleanedSelectedOptions);
          
          isRestoringProgress.current = true;
          setSelectedOptions(cleanedSelectedOptions);
          setSavedSelectedOptions(cleanedSelectedOptions);
          setHasRestoredProgress(true);
          
          // Reset the flag after a short delay to allow state to update
          setTimeout(() => {
            isRestoringProgress.current = false;
            console.log('✅ Radio button selections restored and displayed in UI');
          }, 100);
        }
        
        // Fallback to route params if JSON doesn't have customer details
        if (!progress || !progress.customerDetails) {
          if (passedCustomerDetails) {
            setCustomerDetails(passedCustomerDetails);
            
            const customerName = passedCustomerDetails.customerName || '';
            const customerPostcode = passedCustomerDetails.postcode || '';
            
            if (customerName || customerPostcode) {
              setCustomerInfo({
                name: customerName || 'Customer',
                postcode: customerPostcode || 'N/A'
              });
              console.log('✅ Customer details set from route params (fallback) in EPVSRadioButtonScreen');
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore progress immediately:', error);
        // Still try route params as fallback
        if (passedCustomerDetails) {
          setCustomerDetails(passedCustomerDetails);
          
          const customerName = passedCustomerDetails.customerName || '';
          const customerPostcode = passedCustomerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
          }
        }
      }
    };
    
    restoreProgress();
  }, [opportunityId, calculatorType, passedCustomerDetails]);

  useEffect(() => {
    // If we have customer details from route params, use them
    if (passedCustomerDetails) {
      setCustomerDetails(passedCustomerDetails);
      
      // Extract customer information for header display
      const customerName = passedCustomerDetails.customerName || 'Loading...';
      const customerPostcode = passedCustomerDetails.postcode || 'Loading...';
      
      if (customerName !== 'Loading...' || customerPostcode !== 'Loading...') {
        setCustomerInfo({
          name: customerName,
          postcode: customerPostcode
        });
      }
    }
    
    // Always check for saved progress on mount (even if route params exist, JSON is source of truth)
    // This ensures customer details are always restored from JSON
    checkForSavedProgress();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [passedCustomerDetails, opportunityId, calculatorType]);

  const checkForSavedProgress = async () => {
    try {
      // Try CalculatorProgressService first (backend API)
      const { default: CalculatorProgressService } = await import('../services/CalculatorProgressService');
      let progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType
      );
      
      // If CalculatorProgressService doesn't have it, try CalculatorDataService (local storage)
      if (!progress) {
        const { default: CalculatorDataService } = await import('../services/CalculatorDataService');
        progress = await CalculatorDataService.getProgress(opportunityId, calculatorType) as any;
      }
      
      if (progress) {
        // Always restore customer details from JSON (JSON is source of truth, even if route params exist)
        if (progress.customerDetails) {
          setCustomerDetails(progress.customerDetails);
          
          // Extract customer information for header display
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from JSON (always shown):', progress.customerDetails);
          }
        }
        
        // Restore template options from progress if not in route params
        if (!selectedTemplateOptions && (progress as any).selectedTemplateOptions) {
          const validatedTemplateOptions = validateTemplateOptions((progress as any).selectedTemplateOptions);
          if (validatedTemplateOptions) {
            // Update selectedTemplateOptions (but we can't modify const, so store in state or use it later)
            console.log('✅ Restored template options from progress:', validatedTemplateOptions);
            // Note: selectedTemplateOptions is a const from route params, so we'll pass the restored one when navigating
          }
        }
        
        // Try radioButtonSelections first (backend API format), fallback to selectedOptions (local storage format)
        const radioSelections = progress.radioButtonSelections || (progress as any).selectedOptions;
        if (radioSelections) {
          console.log('🔄 Auto-restoring radio button selections from saved progress:', radioSelections);
          
          // Clean up invalid selections that don't match current radio button groups
          const validGroupTitles = radioButtonGroups.map(group => group.title);
          const cleanedSelectedOptions: Record<string, string> = {};
          
          Object.entries(radioSelections).forEach(([key, value]) => {
            if (typeof value === 'string' && validGroupTitles.includes(key)) {
              cleanedSelectedOptions[key] = value as string;
            } else {
              console.log(`🗑️ Removing invalid selection: ${key} = ${value}`);
            }
          });
          
          console.log('🔄 Setting cleaned selected options:', cleanedSelectedOptions);
          console.log('🔍 Valid group titles:', validGroupTitles);
          
          isRestoringProgress.current = true;
          setSelectedOptions(cleanedSelectedOptions);
          setSavedSelectedOptions(cleanedSelectedOptions); // Store original selections for comparison
          setHasRestoredProgress(true); // Only set to true if we actually restored progress
          // Reset the flag after a short delay to allow state to update
          setTimeout(() => {
            isRestoringProgress.current = false;
            console.log('✅ Radio button selections restored and displayed in UI');
            console.log('🔍 Final selectedOptions state:', cleanedSelectedOptions);
          }, 100);
        } else {
          console.log('ℹ️ No radio button progress found to restore');
          setHasRestoredProgress(false); // Set to false if no progress was found
        }
      } else {
        console.log('ℹ️ No progress found to restore');
        setHasRestoredProgress(false);
      }
    } catch (error) {
      console.error('Error checking for saved progress:', error);
      setHasRestoredProgress(false); // Set to false if there was an error
    }
  };
  
  // Helper function to validate template options (same as in init)
  const validateTemplateOptions = (options: any): {
    solar: boolean;
    battery: boolean;
    solarHybrid: boolean;
    batteryInverter: boolean;
  } | undefined => {
    if (!options) return undefined;
    
    if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
      const keys = Object.keys(options);
      if (keys.length > 0 && keys[0] === '0' && keys.some(k => /^\d+$/.test(k))) {
        const values = keys.map(k => options[k]).join('');
        if (values === '[object Object]') {
          return undefined;
        }
      }
      
      if ('solar' in options || 'battery' in options || 'solarHybrid' in options || 'batteryInverter' in options) {
        return {
          solar: options.solar === true,
          battery: options.battery === true,
          solarHybrid: options.solarHybrid === true,
          batteryInverter: options.batteryInverter === true
        };
      }
    }
    
    return undefined;
  };

  const saveProgress = async (options?: Record<string, string>) => {
    try {
      if (customerDetails && opportunityId) {
        // Validate and clean the options before saving
        const optionsToSave = options || selectedOptions;
        const validGroupTitles = radioButtonGroups.map(group => group.title);
        const cleanedOptions: Record<string, string> = {};
        
        Object.entries(optionsToSave).forEach(([key, value]) => {
          if (validGroupTitles.includes(key)) {
            cleanedOptions[key] = value;
          }
        });
        
        console.log('💾 EPVS RadioButtonScreen: Saving progress with data:', {
          opportunityId,
          calculatorType,
          radioButtonSelections: cleanedOptions,
          currentStep: 'radio-buttons'
        });
        
        // Normalize template options before saving (ensure all properties are boolean)
        const normalizedTemplateOptions = selectedTemplateOptions ? {
          solar: selectedTemplateOptions.solar === true,
          battery: selectedTemplateOptions.battery === true,
          solarHybrid: selectedTemplateOptions.solarHybrid === true,
          batteryInverter: selectedTemplateOptions.batteryInverter === true
        } : undefined;
        
        const progressData: any = {
          currentStep: 'radio-buttons' as const,
          radioButtonSelections: cleanedOptions, // Use radioButtonSelections instead of selectedOptions
          customerDetails,
        };

        // Only include templateSelection if we have actual data
        if (normalizedTemplateOptions && templateFileName) {
          progressData.templateSelection = {
            selectedOptions: normalizedTemplateOptions,
            templateFileName: templateFileName || '',
          };
        }

        await CalculatorProgressService.saveProgress(
          opportunityId,
          calculatorType,
          progressData
        );
        
        console.log('✅ EPVS Radio buttons progress saved to backend for opportunity:', opportunityId);
      } else {
        console.log('⚠️ EPVS RadioButtonScreen: Cannot save progress - missing data:', {
          hasCustomerDetails: !!customerDetails,
          hasOpportunityId: !!opportunityId
        });
      }
    } catch (error) {
      console.error('❌ Error saving EPVS radio buttons progress:', error);
    }
  };

  // Check if current selected options match saved options
  const hasChanges = () => {
    if (!savedSelectedOptions) return false;
    
    // Compare current selections with saved selections
    for (const [key, value] of Object.entries(selectedOptions)) {
      const savedValue = savedSelectedOptions[key] || '';
      if (value !== savedValue) {
        return true;
      }
    }
    
    // Check if any saved selections are missing in current selections
    for (const [key, savedValue] of Object.entries(savedSelectedOptions)) {
      const currentValue = selectedOptions[key] || '';
      if (savedValue !== currentValue) {
        return true;
      }
    }
    
    return false;
  };

  const isOptionSelected = (groupTitle: string, shapeName: string) => {
    return selectedOptions[groupTitle] === shapeName;
  };

  const handleRadioButtonPress = (groupTitle: string, option: any) => {
    // Don't save if we're currently restoring progress
    if (isRestoringProgress.current) {
      return;
    }

    // Just update the local state, don't call the API yet
    const newSelectedOptions = {
      ...selectedOptions,
      [groupTitle]: option.shapeName
    };
    setSelectedOptions(newSelectedOptions);
    
    // Debounce the save operation to improve performance
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      // Double-check we're not restoring progress before saving
      if (!isRestoringProgress.current) {
        saveProgress(newSelectedOptions);
      }
    }, 1000); // Increased debounce time to 1 second to reduce excessive saves
  };

  const getSelectedCount = () => {
    return Object.keys(selectedOptions).length;
  };

  const clearAllSelections = () => {
    setSelectedOptions({});
    Alert.alert('🗑️ Cleared', 'All selections have been cleared');
  };

  const applyAllSelections = async () => {
    if (getSelectedCount() === 0) {
      Alert.alert('⚠️ No Selections', 'Please select at least one option before applying.');
      return;
    }

    try {
      setApplying(true);
      
      console.log('🔄 Apply All Selections: Saving radio button selections to JSON (NO COM call)');
      
      // Save progress to JSON (NO COM call - Excel update happens on final submit)
      await saveProgress(selectedOptions);
      
      console.log('✅ Radio button selections saved to JSON');
      
      // Get effective template options - prefer validated route params, fallback to restored from progress
      let effectiveTemplateOptions = selectedTemplateOptions;
      
      // If template options are invalid or missing, try to restore from progress
      if (!effectiveTemplateOptions || (!effectiveTemplateOptions.solar && !effectiveTemplateOptions.battery && !effectiveTemplateOptions.solarHybrid && !effectiveTemplateOptions.batteryInverter)) {
        try {
          const progress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
          if (progress && progress.selectedTemplateOptions) {
            const restored = validateTemplateOptions(progress.selectedTemplateOptions);
            if (restored) {
              effectiveTemplateOptions = restored;
              console.log('✅ Using restored template options from progress:', effectiveTemplateOptions);
            }
          }
        } catch (e) {
          console.warn('⚠️ Could not restore template options from progress:', e);
        }
      }
      
      // Normalize template options before passing to navigation (ensure all properties are boolean)
      const normalizedForNavigation = effectiveTemplateOptions ? {
        solar: effectiveTemplateOptions.solar === true,
        battery: effectiveTemplateOptions.battery === true,
        solarHybrid: effectiveTemplateOptions.solarHybrid === true,
        batteryInverter: effectiveTemplateOptions.batteryInverter === true
      } : undefined;
      
      console.log('🧭 Navigating to FluxDynamicInputs with params:', {
        opportunityId,
        templateFileName,
        selectedTemplateOptions: normalizedForNavigation,
        customerDetails,
        selectedOptions,
      });
      
      // Navigate directly to dynamic inputs
      navigation.navigate('FluxDynamicInputs' as never, {
        opportunityId,
        templateFileName,
        selectedTemplateOptions: normalizedForNavigation,
        customerDetails,
        selectedOptions, // Pass the selected radio button options
      } as never);
    } catch (error) {
      console.error('❌ Error applying selections:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply radio button selections';
      
      Alert.alert('❌ Error', errorMessage);
    } finally {
      setApplying(false);
    }
  };

  const renderRadioButtonGroup = (group: RadioButtonGroup) => (
    <View key={group.title} style={[
      styles.groupContainer,
      { 
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
        shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
      }
    ]}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupTitle, { color: theme.primaryText }]}>{group.title}</Text>
        <Text style={[styles.groupDescription, { color: theme.secondaryText }]}>{group.description}</Text>
      </View>
      
      <View style={styles.optionsContainer}>
        {group.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.radioButton,
              isOptionSelected(group.title, option.shapeName) && [
                styles.radioButtonSelected,
                { backgroundColor: theme.primaryButton + '08' }
              ]
            ]}
            onPress={() => handleRadioButtonPress(group.title, option)}
            activeOpacity={0.7}
          >
            <View style={styles.radioButtonContent}>
              <View style={[
                styles.radioButtonCircle,
                { borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)' },
                isOptionSelected(group.title, option.shapeName) && [
                  styles.radioButtonCircleSelected,
                  { borderColor: theme.primaryButton }
                ]
              ]}>
                {isOptionSelected(group.title, option.shapeName) && (
                  <View style={[styles.radioButtonInner, { backgroundColor: theme.primaryButton }]} />
                )}
              </View>
              <Text style={[
                styles.radioButtonLabel,
                { color: theme.primaryText },
                isOptionSelected(group.title, option.shapeName) && [
                  styles.radioButtonLabelSelected,
                  { color: theme.primaryButton }
                ]
              ]}>
                {option.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading EPVS radio buttons...</Text>
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
      {/* Background Logo */}
      <Image
        source={require('../../assets/creativ NB.png')}
        style={styles.backgroundLogo}
        resizeMode="contain"
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => {
                // Navigate directly to SolarWorkflowScreen instead of going back
                (navigation as any).navigate('SolarWorkflow', { 
                  opportunityId: opportunityId,
                  opportunity: null
                });
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Flux Configuration
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Configure your Flux solar system options
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
        
        {/* Customer Information */}
        {customerInfo && (
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerInfoLeft}>
              <Feather name="user" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerName, { color: theme.primaryText }]}>
                {customerInfo.name}
              </Text>
            </View>
            <View style={styles.customerInfoRight}>
              <Feather name="map-pin" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerPostcode, { color: theme.secondaryText }]}>
                {customerInfo.postcode}
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView 
        style={[
          styles.scrollView,
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
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconContainer, { backgroundColor: theme.primaryButton + '15' }]}>
              <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton }]}>
                <Feather name="settings" size={32} color="#ffffff" />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: theme.primaryText }]}>
              Configure Your Flux System
            </Text>
            <Text style={[styles.heroDescription, { color: theme.secondaryText }]}>
              Select the appropriate options for each category to customize your solar system
            </Text>
          </View>

          {/* Progress automatically restored - no dialog needed */}

          {/* Template Info */}
          {selectedTemplateOptions && (
            <View style={[
              styles.templateInfo,
              { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
                shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
              }
            ]}>
              <Text style={[styles.templateInfoTitle, { color: theme.primaryText }]}>Selected Template Options:</Text>
              <View style={styles.templateOptions}>
                {selectedTemplateOptions.solar && <Text style={[styles.optionItem, { color: theme.primaryButton }]}>• Solar Panels</Text>}
                {selectedTemplateOptions.battery && <Text style={[styles.optionItem, { color: theme.primaryButton }]}>• Battery Storage</Text>}
                {selectedTemplateOptions.solarHybrid && <Text style={[styles.optionItem, { color: theme.primaryButton }]}>• Solar/Hybrid Inverter</Text>}
                {selectedTemplateOptions.batteryInverter && <Text style={[styles.optionItem, { color: theme.primaryButton }]}>• Battery Inverter</Text>}
              </View>
            </View>
          )}

          {/* Radio Button Groups */}
          <View style={styles.groupsContainer}>
            {radioButtonGroups.map(renderRadioButtonGroup)}
          </View>

          {/* Summary Section */}
          <View style={[
            styles.summaryContainer,
            { 
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
              borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
              shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
            }
          ]}>
            <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>Selection Summary</Text>
            <Text style={[styles.summaryText, { color: theme.secondaryText }]}>
              {getSelectedCount()} of {radioButtonGroups.length} categories configured
            </Text>
            
            <View style={styles.summaryActions}>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.tertiaryBackground }]}
                onPress={clearAllSelections}
                disabled={getSelectedCount() === 0}
              >
                <Feather name="refresh-cw" size={16} color={theme.secondaryText} />
                <Text style={[styles.clearButtonText, { color: theme.secondaryText }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonSection}>
            {/* Restore and Skip Buttons Row */}
            <View style={styles.actionButtonsRow}>
              {/* Restore Button */}
              <TouchableOpacity
                style={[styles.restoreButton, { 
                  borderColor: theme.primaryButton,
                  backgroundColor: theme.primaryButton + '10'
                }]}
                onPress={checkForSavedProgress}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={16} color={theme.primaryButton} />
                <Text style={[styles.restoreButtonText, { color: theme.primaryButton }]}>
                  Restore
                </Text>
              </TouchableOpacity>

              {/* Skip Button - Only show if user has selections AND we restored progress AND no changes from saved state */}
              {getSelectedCount() > 0 && hasRestoredProgress && savedSelectedOptions && !hasChanges() && (
                <TouchableOpacity
                  style={[styles.skipButton, { 
                    borderColor: theme.dangerButton,
                    backgroundColor: theme.dangerButton + '10'
                  }]}
                  onPress={async () => {
                    // Get effective template options - prefer validated route params, fallback to restored from progress
                    let effectiveTemplateOptions = selectedTemplateOptions;
                    
                    // If template options are invalid or missing, try to restore from progress
                    if (!effectiveTemplateOptions || (!effectiveTemplateOptions.solar && !effectiveTemplateOptions.battery && !effectiveTemplateOptions.solarHybrid && !effectiveTemplateOptions.batteryInverter)) {
                      try {
                        const progress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
                        if (progress && progress.selectedTemplateOptions) {
                          const restored = validateTemplateOptions(progress.selectedTemplateOptions);
                          if (restored) {
                            effectiveTemplateOptions = restored;
                            console.log('✅ Using restored template options from progress (skip button):', effectiveTemplateOptions);
                          }
                        }
                      } catch (e) {
                        console.warn('⚠️ Could not restore template options from progress (skip button):', e);
                      }
                    }
                    
                    // Normalize template options before passing to navigation
                    const normalizedForNavigation = effectiveTemplateOptions ? {
                      solar: effectiveTemplateOptions.solar === true,
                      battery: effectiveTemplateOptions.battery === true,
                      solarHybrid: effectiveTemplateOptions.solarHybrid === true,
                      batteryInverter: effectiveTemplateOptions.batteryInverter === true
                    } : undefined;
                    
                    // Skip directly to FluxDynamicInputs screen
                    navigation.navigate('FluxDynamicInputs', {
                      opportunityId,
                      templateFileName,
                      selectedTemplateOptions: normalizedForNavigation,
                      customerDetails,
                      selectedOptions, // Also pass radio button selections
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="skip-forward" size={16} color={theme.dangerButton} />
                  <Text style={[styles.skipButtonText, { color: theme.dangerButton }]}>
                    Skip
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              style={[
                styles.applyButton,
                !(getSelectedCount() > 0 && !applying) && styles.applyButtonDisabled
              ]}
              onPress={applyAllSelections}
              disabled={getSelectedCount() === 0 || applying}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={(getSelectedCount() > 0 && !applying) ? [theme.primaryButton, theme.successButton] : [theme.borderColor, theme.borderColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="check-circle" size={22} color={(getSelectedCount() > 0 && !applying) ? '#ffffff' : theme.tertiaryText} />
                )}
                <Text style={[
                  styles.applyButtonText,
                  { color: (getSelectedCount() > 0 && !applying) ? '#ffffff' : theme.tertiaryText }
                ]}>
                  {applying ? 'Applying...' : 'Apply All Selections'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
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
  backgroundLogo: {
    position: 'absolute',
    top: height * 0.5 - (width * 0.25),
    left: width * 0.5 - (width * 0.25),
    width: width * 0.5,
    height: width * 0.5,
    opacity: 0.06,
    zIndex: 0,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 20,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  customerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  customerPostcode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.8,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
    paddingTop: 32,
  },
  heroIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroDescription: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: width * 0.85,
    opacity: 0.9,
  },
  templateInfo: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  templateInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  templateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  optionItem: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  groupsContainer: {
    marginBottom: 32,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra margin for web scrolling
    }),
  },
  groupContainer: {
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // Extra spacing between groups on web
      minHeight: 120, // Ensure groups have minimum height
    }),
  },
  groupHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  groupDescription: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  optionsContainer: {
    padding: 24,
  },
  radioButton: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioButtonSelected: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  radioButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButtonCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonCircleSelected: {
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },
  radioButtonLabelSelected: {
    fontWeight: '700',
  },
  summaryContainer: {
    padding: 28,
    borderRadius: 24,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  summaryText: {
    fontSize: 18,
    marginBottom: 24,
    opacity: 0.8,
  },
  summaryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonSection: {
    marginBottom: 40,
    gap: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  restoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  restoreButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    borderRadius: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  applyButtonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  applyButtonText: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
    letterSpacing: -0.2,
  },
});
