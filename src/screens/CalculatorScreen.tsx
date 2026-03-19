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
import InputFieldRulesTest from '../components/InputFieldRulesTest';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
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
        endpoint: '/excel-automation/energy-use/single-rate',
        shapeName: 'SingleRate'
      },
      {
        label: 'Dual Rate / Off-Peak',
        endpoint: '/excel-automation/energy-use/dual-rate',
        shapeName: 'DualRate'
      }
    ]
  },
  {
    title: '🔋 Battery Type',
    description: 'Select your battery type:',
    options: [
      {
        label: 'Self-Consumption Battery',
        endpoint: '/excel-automation/battery/self-consumption',
        shapeName: 'BatterySC'
      },
      {
        label: 'Overnight Charging Battery',
        endpoint: '/excel-automation/battery/overnight-charging',
        shapeName: 'BatteryOC'
      },
      {
        label: 'No Battery',
        endpoint: '/excel-automation/battery/none',
        shapeName: 'BatteryNone'
      }
    ]
  },
  {
    title: '☀️ Existing Solar',
    description: 'Do you have existing solar?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/existing-solar/yes',
        shapeName: 'ExistingSolarYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/existing-solar/no',
        shapeName: 'ExistingSolarNo'
      }
    ]
  },
  {
    title: '📊 Annual Consumption',
    description: 'Do you have annual consumption data?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/annual-consumption/yes',
        shapeName: 'AnnualConsumptionYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/annual-consumption/no',
        shapeName: 'AnnualConsumptionNo'
      }
    ]
  },
  {
    title: '⚡ Import/Export Tariff',
    description: 'Do you have an import/export tariff?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/export-tariff/yes',
        shapeName: 'ExportYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/export-tariff/no',
        shapeName: 'ExportNo'
      }
    ]
  },
  {
    title: '🛡️ Battery Warranty',
    description: 'Do you want battery warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/warranty/battery/yes',
        shapeName: 'BatteryWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/warranty/battery/no',
        shapeName: 'BatteryWarrantyNo'
      }
    ]
  },
  {
    title: '🛡️ Solar Inverter Warranty',
    description: 'Do you want solar inverter warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/warranty/solar-inverter/yes',
        shapeName: 'SolarInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/warranty/solar-inverter/no',
        shapeName: 'SolarInverterWarrantyNo'
      }
    ]
  },
  {
    title: '🛡️ Battery Inverter Warranty',
    description: 'Do you want battery inverter warranty?',
    options: [
      {
        label: 'Yes',
        endpoint: '/excel-automation/warranty/battery-inverter/yes',
        shapeName: 'BatteryInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/excel-automation/warranty/battery-inverter/no',
        shapeName: 'BatteryInverterWarrantyNo'
      }
    ]
  },
  {
    title: '💳 Payment Method',
    description: 'Select your payment method:',
    options: [
      {
        label: 'Cash',
        endpoint: '/excel-automation/payment/cash',
        shapeName: 'Cash'
      },
      {
        label: 'HomeTree',
        endpoint: '/excel-automation/payment/finance',
        shapeName: 'Finance'
      },
      {
        label: 'New Finance',
        endpoint: '/excel-automation/payment/new-finance',
        shapeName: 'NewFinance'
      }
    ]
  }
];

export default function CalculatorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark, toggleTheme } = useTheme();
  const opportunityId = route.params?.opportunityId;
  const templateFileName = route.params?.templateFileName;
  const selectedTemplateOptions = route.params?.selectedOptions;
  const passedCustomerDetails = route.params?.customerDetails;
  const calculatorType = route.params?.calculatorType || 'off-peak';
  
  // Debug logging for route params
  console.log('🔍 CalculatorScreen route params:', {
    opportunityId,
    templateFileName,
    selectedTemplateOptions,
    passedCustomerDetails: passedCustomerDetails ? 'Present' : 'Missing',
    calculatorType
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [fileCreated, setFileCreated] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showRulesTest, setShowRulesTest] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedSelectedOptions, setSavedSelectedOptions] = useState<Record<string, string> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringProgress = useRef<boolean>(false);

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

  // Check for multiple calculator progress
  const checkForMultipleCalculatorProgress = async () => {
    try {
      if (!opportunityId) return;
      
      // Check for progress in all calculator types
      const [offPeakProgress, fluxProgress, epvsProgress] = await Promise.all([
        CalculatorProgressService.getProgressSummary(opportunityId, 'off-peak'),
        CalculatorProgressService.getProgressSummary(opportunityId, 'flux'),
        CalculatorProgressService.getProgressSummary(opportunityId, 'epvs')
      ]);
      
      // Count how many have progress
      const progressCount = [offPeakProgress, fluxProgress, epvsProgress].filter(
        progress => progress.hasProgress
      ).length;
      
      // Multiple calculator types detected - default to off-peak
      if (progressCount > 1) {
        console.log('Multiple calculator types detected, defaulting to off-peak');
      }
    } catch (error) {
      console.error('Error checking for multiple calculator progress:', error);
    }
  };

  // Restore customer details immediately on mount (separate from other useEffects to show in UI quickly)
  useEffect(() => {
    const restoreCustomerDetails = async () => {
      if (!opportunityId) return;
      
      try {
        // Always restore customer details from JSON first (JSON is source of truth)
        const progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          calculatorType || 'off-peak'
        );
        
        if (progress && progress.customerDetails) {
          setCustomerDetails(progress.customerDetails);
          setFileCreated(true);
          console.log('✅ Customer details restored from JSON immediately in CalculatorScreen:', progress.customerDetails);
        } else if (passedCustomerDetails) {
          // Fallback to route params if JSON doesn't have it
          setCustomerDetails(passedCustomerDetails);
          setFileCreated(true);
          console.log('✅ Customer details set from route params (fallback) in CalculatorScreen');
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
        // Still try route params as fallback
        if (passedCustomerDetails) {
          setCustomerDetails(passedCustomerDetails);
          setFileCreated(true);
        }
      }
    };
    
    restoreCustomerDetails();
  }, [opportunityId, calculatorType, passedCustomerDetails]);

  useEffect(() => {
    // If we have customer details from route params, use them
    if (passedCustomerDetails) {
      setCustomerDetails(passedCustomerDetails);
      setFileCreated(true);
      
      // Check if we should show calculator type selection
      // This happens when we have customer details but no specific calculator type
      if (!calculatorType || calculatorType === 'off-peak') {
        // Check if there's saved progress for other calculator types
        checkForMultipleCalculatorProgress();
      }
    } else {
      // If no customer details in route params, restore from JSON
      // This is handled in restoreProgress, but we call it here to ensure it runs
      restoreProgress();
    }
    // Don't show customer form modal anymore since we have a dedicated screen
  }, [passedCustomerDetails, calculatorType]);

  // Check for saved progress when component mounts
  useEffect(() => {
    restoreProgress();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [opportunityId]);

  // Auto-save when selections change
  useEffect(() => {
    if (hasRestoredProgress && Object.keys(selectedOptions).length > 0) {
      autoSaveProgress();
    }
  }, [selectedOptions, hasRestoredProgress]);

  // Debug logging for selectedOptions state changes
  useEffect(() => {
    console.log('🔍 CalculatorScreen: selectedOptions state changed:', selectedOptions);
  }, [selectedOptions]);

  const restoreProgress = async () => {
    try {
      console.log('🔍 CalculatorScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType || 'off-peak'
      );
      
      // Always restore customer details from JSON (JSON is source of truth, even if route params exist)
      if (progress && progress.customerDetails) {
        setCustomerDetails(progress.customerDetails);
        setFileCreated(true);
        console.log('✅ Customer details restored from JSON (always shown):', progress.customerDetails);
      }
      
      if (progress && progress.radioButtonSelections) {
        console.log('🔄 Auto-restoring radio button selections from saved progress:', progress.radioButtonSelections);
        
        // Clean up invalid selections that don't match current radio button groups
        const validGroupTitles = radioButtonGroups.map(group => group.title);
        const cleanedSelectedOptions: Record<string, string> = {};
        
        Object.entries(progress.radioButtonSelections).forEach(([key, value]) => {
          const mappedKey = key === '⚡ Export Tariff' ? '⚡ Import/Export Tariff' : key;
          if (validGroupTitles.includes(mappedKey)) {
            cleanedSelectedOptions[mappedKey] = value;
          } else if (validGroupTitles.includes(key)) {
            cleanedSelectedOptions[key] = value;
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
    } catch (error) {
      console.error('Error restoring calculator progress:', error);
      setHasRestoredProgress(false); // Set to false if there was an error
    }
  };

  const autoSaveProgress = async () => {
    try {
      // Debounce the save operation
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        const progressData = {
          currentStep: 'radio-buttons' as const,
          radioButtonSelections: selectedOptions,
        };

        const result = await CalculatorProgressService.autoSave(
          opportunityId,
          calculatorType || 'off-peak',
          progressData
        );

        if (result.saved) {
          console.log('✅ Calculator progress auto-saved');
        }
      }, 1000); // Save after 1 second of no changes
    } catch (error) {
      console.error('Error auto-saving calculator progress:', error);
    }
  };

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

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
        
        const progressData: any = {
          currentStep: 'radio-buttons' as const,
          radioButtonSelections: cleanedOptions,
          customerDetails,
        };

        // Only include templateSelection if we have actual data
        if (selectedTemplateOptions) {
          progressData.templateSelection = {
            selectedOptions: {
              ...selectedTemplateOptions,
              battery: selectedTemplateOptions.battery || false
            },
            templateFileName: templateFileName || '',
          };
        }

        await CalculatorProgressService.saveProgress(
          opportunityId,
          calculatorType || 'off-peak',
          progressData
        );
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const applyAllSelections = async () => {
    if (Object.keys(selectedOptions).length === 0) {
      Alert.alert('⚠️ No Selections', 'Please select at least one option before applying.');
      return;
    }

    try {
      setApplying(true);
      
      console.log('🔄 Apply All Selections: Saving radio button selections to JSON (NO COM call)');
      
      // Save progress to JSON (NO COM call - Excel update happens on final submit)
      const progressData = {
        currentStep: 'radio-buttons' as const,
        radioButtonSelections: selectedOptions,
        completedSteps: {
          'radio-buttons': true,
        },
      };
      
      await CalculatorProgressService.saveProgress(
        opportunityId,
        calculatorType || 'off-peak',
        progressData
      );
      
      console.log('✅ Radio button selections saved to JSON, navigating to DynamicInputs...');
      
      // Automatically navigate to DynamicInputs after saving radio button selections
      navigation.navigate('DynamicInputs' as never, {
        opportunityId,
        customerDetails,
        selectedOptions, // Pass the selected radio button options
        templateFileName, // Pass the selected template file
        selectedTemplateOptions, // Pass the template selection options
        calculatorType, // Pass the calculator type for field visibility rules
      } as never);
    } catch (error) {
      console.error('❌ Error saving radio button selections:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save radio button selections';
      Alert.alert('❌ Error', errorMessage);
    } finally {
      setApplying(false);
    }
  };

  const isOptionSelected = (groupTitle: string, shapeName: string) => {
    const isSelected = selectedOptions[groupTitle] === shapeName;
    // Debug logging to help identify issues
    if (Object.keys(selectedOptions).length > 0) {
      console.log(`🔍 Checking selection: ${groupTitle} = ${shapeName}, selectedOptions[${groupTitle}] = ${selectedOptions[groupTitle]}, isSelected = ${isSelected}`);
    }
    return isSelected;
  };

  const getSelectedCount = () => {
    // Only count selections that match valid radio button group titles
    const validGroupTitles = radioButtonGroups.map(group => group.title);
    const validSelections = Object.keys(selectedOptions).filter(key => 
      validGroupTitles.includes(key)
    );
    
    // Debug logging to help identify issues
    if (Object.keys(selectedOptions).length !== validSelections.length) {
      const invalidSelections = Object.keys(selectedOptions).filter(key => 
        !validGroupTitles.includes(key)
      );
      console.log('🔍 Found invalid selections:', invalidSelections);
      console.log('🔍 Valid group titles:', validGroupTitles);
    }
    
    return validSelections.length;
  };

  const clearAllSelections = () => {
    setSelectedOptions({});
    Alert.alert('🗑️ Cleared', 'All selections have been cleared');
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
              <View style={{ flex: 1 }}>
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
                {option.shapeName === 'BatterySC' && (
                  <Text style={[styles.radioButtonNote, { color: theme.secondaryText }]}>Used for single rate customers</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );


  // Don't render the main calculator if file not created
  if (!fileCreated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.centerContent}>
          <Text style={styles.noDataText}>No customer details available.</Text>
          <Text style={styles.noDataSubtext}>Please go back and complete the customer details form.</Text>
        </View>
        
        <InputFieldRulesTest
          visible={showRulesTest}
          onClose={() => setShowRulesTest(false)}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading calculator...</Text>
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
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => {
                // Navigate directly to SolarWorkflowScreen instead of going back
                (navigation as any).navigate('SolarWorkflow', { 
                  opportunityId: opportunityId,
                  opportunity: null // Pass null as we don't have opportunity data here
                });
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Off Peak Configuration
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Configure your Off Peak solar system options
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
        ref={scrollViewRef}
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
              Configure Your Off Peak System
            </Text>
            <Text style={[styles.heroDescription, { color: theme.secondaryText }]}>
              Select the appropriate options for each category to customize your solar system
            </Text>
          </View>

          {/* Progress automatically restored - no dialog needed */}

          {/* Customer Info */}
          {customerDetails && (
            <View style={[
              styles.customerInfo,
              { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
                shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
              }
            ]}>
              <Text style={[styles.customerInfoTitle, { color: theme.primaryText }]}>Customer Information</Text>
              <Text style={[styles.customerInfoName, { color: theme.primaryText }]}>{customerDetails.customerName}</Text>
              <Text style={[styles.customerInfoAddress, { color: theme.secondaryText }]}>{customerDetails.address}</Text>
              {customerDetails.postcode && (
                <Text style={[styles.customerInfoPostcode, { color: theme.secondaryText }]}>{customerDetails.postcode}</Text>
              )}
            </View>
          )}

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

          {/* Self consumption only for single rate: show warning when Dual Rate + Self-Consumption selected */}
          {selectedOptions['⚡ Energy Use'] === 'DualRate' && selectedOptions['🔋 Battery Type'] === 'BatterySC' && (
            <View style={[styles.warningBanner, { backgroundColor: (theme.dangerButton || '#ef4444') + '18', borderColor: (theme.dangerButton || '#ef4444') + '50' }]}>
              <Feather name="alert-triangle" size={20} color={theme.dangerButton || '#ef4444'} style={{ marginRight: 10 }} />
              <Text style={[styles.warningBannerText, { color: theme.primaryText }]}>
                Self consumption is only used for single rate customers. Consider selecting Overnight Charging for dual rate / off-peak.
              </Text>
            </View>
          )}

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
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: theme.tertiaryBackground }]}
                onPress={() => setShowRulesTest(true)}
              >
                <Feather name="settings" size={16} color={theme.secondaryText} />
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
                onPress={restoreProgress}
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
                  onPress={() => {
                    // Skip directly to DynamicInputs screen
                    navigation.navigate('DynamicInputs' as never, {
                      opportunityId,
                      customerDetails,
                      selectedOptions,
                      templateFileName,
                      selectedTemplateOptions,
                    } as never);
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

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Updating Excel...</Text>
          </View>
        </View>
      )}

      <InputFieldRulesTest
        visible={showRulesTest}
        onClose={() => setShowRulesTest(false)}
      />

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
  headerText: {
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
  customerInfo: {
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
  customerInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  customerInfoName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  customerInfoAddress: {
    fontSize: 16,
    marginBottom: 4,
    opacity: 0.8,
  },
  customerInfoPostcode: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
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
  radioButtonNote: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
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
    justifyContent: 'space-between',
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
  testButton: {
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
  testButtonText: {
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
