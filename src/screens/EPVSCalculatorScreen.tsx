import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import InputFieldRulesTest from '../components/InputFieldRulesTest';
import ProgressRestoreComponent from '../components/ProgressRestoreComponent';
import BottomNavigation from '../components/BottomNavigation';
import CalculatorDataService from '../services/CalculatorDataService';
import {
  getCustomerDetailsFromRouteParams,
  normalizeRouteParams,
  parseSelectedOptions,
} from '../utils/deepLinkParams';

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
    title: '🔋 Battery Type',
    description: 'Select your battery type:',
    options: [
      {
        label: 'Self-Consumption Battery',
        endpoint: '/epvs-automation/battery/self-consumption',
        shapeName: 'BatterySC'
      },
      {
        label: 'Overnight Charging Battery',
        endpoint: '/epvs-automation/battery/overnight-charging',
        shapeName: 'BatteryOC'
      },
      {
        label: 'No Battery',
        endpoint: '/epvs-automation/battery/none',
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
        endpoint: '/epvs-automation/existing-solar/yes',
        shapeName: 'ExistingSolarYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/existing-solar/no',
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
        endpoint: '/epvs-automation/annual-consumption/yes',
        shapeName: 'AnnualConsumptionYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/annual-consumption/no',
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
        endpoint: '/epvs-automation/export-tariff/yes',
        shapeName: 'ExportYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/export-tariff/no',
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
        endpoint: '/epvs-automation/warranty/battery/yes',
        shapeName: 'BatteryWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/warranty/battery/no',
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
        endpoint: '/epvs-automation/warranty/solar-inverter/yes',
        shapeName: 'SolarInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/warranty/solar-inverter/no',
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
        endpoint: '/epvs-automation/warranty/battery-inverter/yes',
        shapeName: 'BatteryInverterWarrantyYes'
      },
      {
        label: 'No',
        endpoint: '/epvs-automation/warranty/battery-inverter/no',
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
        endpoint: '/epvs-automation/payment/cash',
        shapeName: 'Cash'
      },
      {
        label: 'Finance',
        endpoint: '/epvs-automation/payment/finance',
        shapeName: 'Finance'
      },
      {
        label: 'HomeTree',
        endpoint: '/epvs-automation/payment/new-finance',
        shapeName: 'HomeTree'
      }
    ]
  }
];

export default function FluxCalculatorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = normalizeRouteParams(route.params as Record<string, unknown>);
  const opportunityId = params.opportunityId as string | undefined;
  const templateFileName = typeof params.templateFileName === 'string' ? params.templateFileName : undefined;
  const selectedTemplateOptions = parseSelectedOptions(params.selectedOptions);
  const passedCustomerDetails = getCustomerDetailsFromRouteParams(params);
  const calculatorType = (params.calculatorType as string) || 'flux';
  
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [fileCreated, setFileCreated] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showRulesTest, setShowRulesTest] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [progressSummary, setProgressSummary] = useState<any>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringProgress = useRef(false);

  // Restore customer details immediately on mount (separate from checkForSavedProgress to show in UI quickly)
  useEffect(() => {
    const restoreCustomerDetails = async () => {
      if (!opportunityId) return;
      
      try {
        // Try CalculatorProgressService first (backend API)
        const { default: CalculatorProgressService } = await import('../services/CalculatorProgressService');
        let progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          'flux'
        );
        
        // If CalculatorProgressService doesn't have it, try CalculatorDataService (local storage)
        if (!progress || !progress.customerDetails) {
          const { default: CalculatorDataService } = await import('../services/CalculatorDataService');
          const localProgress = await CalculatorDataService.getProgress(opportunityId, 'flux');
          
          if (localProgress && localProgress.customerDetails) {
            progress = {
              ...progress,
              customerDetails: localProgress.customerDetails
            } as any;
          }
        }
        
        // Always set customer details from JSON if available
        if (progress && progress.customerDetails) {
          setCustomerDetails(progress.customerDetails);
          
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from JSON immediately in EPVSCalculatorScreen:', progress.customerDetails);
            return; // Exit early if we got it from JSON
          }
        }
        
        // Fallback to route params if JSON doesn't have it
        if (passedCustomerDetails) {
          setCustomerDetails(passedCustomerDetails);
          
          const customerName = passedCustomerDetails.customerName || '';
          const customerPostcode = passedCustomerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details set from route params (fallback) in EPVSCalculatorScreen');
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
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
    
    restoreCustomerDetails();
  }, [opportunityId, passedCustomerDetails]);

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
        console.log('🔍 EPVSCalculatorScreen: Set customer info:', { name: customerName, postcode: customerPostcode });
      }
    }
    
    // Check for saved progress on mount
    checkForSavedProgress();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [passedCustomerDetails]);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

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
  };

  const saveProgress = async (options?: Record<string, string>) => {
    if (!opportunityId || isRestoringProgress.current) return;
    
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
        
        await CalculatorDataService.updateProgress(opportunityId, {
          customerDetails,
          templateFileName,
          selectedTemplateOptions: selectedTemplateOptions ? {
            ...selectedTemplateOptions,
            battery: selectedTemplateOptions.battery || false
          } : undefined,
          calculatorType: calculatorType,
          selectedOptions: cleanedOptions,
          currentStep: 'radio-buttons',
        });
      }
    } catch (error) {
      console.error('Error saving EPVS progress:', error);
    }
  };

  const checkForSavedProgress = async () => {
    try {
      const progress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
      if (progress && progress.selectedOptions) {
        console.log('✅ Found saved EPVS progress');
        setHasSavedProgress(true);
        setProgressSummary(await CalculatorDataService.getProgressSummary(opportunityId, calculatorType));
        
        // Auto-restore progress if we have saved selections
        console.log('🔄 Auto-restoring EPVS radio button selections from saved progress');
        
        // Clean up invalid selections that don't match current radio button groups
        const validGroupTitles = radioButtonGroups.map(group => group.title);
        const cleanedSelectedOptions: Record<string, string> = {};
        
        Object.entries(progress.selectedOptions).forEach(([key, value]) => {
          const mappedKey = key === '⚡ Export Tariff' ? '⚡ Import/Export Tariff' : key;
          if (validGroupTitles.includes(mappedKey)) {
            cleanedSelectedOptions[mappedKey] = value;
          } else if (validGroupTitles.includes(key)) {
            cleanedSelectedOptions[key] = value;
          } else {
            console.log(`🗑️ Removing invalid selection: ${key} = ${value}`);
          }
        });
        
        // If we cleaned up invalid data, save the cleaned version
        if (Object.keys(cleanedSelectedOptions).length !== Object.keys(progress.selectedOptions).length) {
          console.log(`🧹 Cleaned up ${Object.keys(progress.selectedOptions).length - Object.keys(cleanedSelectedOptions).length} invalid selections`);
          await CalculatorDataService.updateProgress(opportunityId, {
            selectedOptions: cleanedSelectedOptions,
            calculatorType: calculatorType
          });
        }
        
        isRestoringProgress.current = true;
        setSelectedOptions(cleanedSelectedOptions);
        
        // Reset the flag after a short delay to allow state to update
        setTimeout(() => {
          isRestoringProgress.current = false;
        }, 200);
        
        // Only show restore dialog if we have meaningful progress from a previous session
        // Check if there's recent progress AND meaningful data
        const hasRecent = await CalculatorDataService.hasRecentProgress(opportunityId, 24, calculatorType);
        const hasMeaningfulData = CalculatorDataService.hasMeaningfulProgress(progress);
        const isOnCorrectStep = progress.currentStep === 'radio-buttons';
        
        // Only show restore dialog if all conditions are met
        if (hasRecent && hasMeaningfulData && isOnCorrectStep) {
          console.log('🔄 Showing restore dialog - meaningful progress found');
          setShowRestoreDialog(true);
        } else {
          console.log('🔄 Not showing restore dialog - conditions not met:', {
            hasRecent,
            hasMeaningfulData,
            isOnCorrectStep,
            selectedOptionsCount: progress.selectedOptions ? Object.keys(progress.selectedOptions).length : 0
          });
        }
      } else {
        console.log('ℹ️ No saved EPVS progress found');
        setHasSavedProgress(false);
        setProgressSummary(null);
      }
    } catch (error) {
      console.error('Error checking for saved progress:', error);
    }
  };

  const restoreProgress = async () => {
    try {
      const progress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
      if (progress && progress.selectedOptions) {
        console.log('🔄 Restoring EPVS progress with data:', progress.selectedOptions);
        
        // Clean up invalid selections that don't match current radio button groups
        const validGroupTitles = radioButtonGroups.map(group => group.title);
        const cleanedSelectedOptions: Record<string, string> = {};
        
        Object.entries(progress.selectedOptions).forEach(([key, value]) => {
          const mappedKey = key === '⚡ Export Tariff' ? '⚡ Import/Export Tariff' : key;
          if (validGroupTitles.includes(mappedKey)) {
            cleanedSelectedOptions[mappedKey] = value;
          } else if (validGroupTitles.includes(key)) {
            cleanedSelectedOptions[key] = value;
          }
        });
        
        isRestoringProgress.current = true;
        setSelectedOptions(cleanedSelectedOptions);
        setShowRestoreDialog(false);
        
        // Reset the flag after a short delay to allow state to update
        setTimeout(() => {
          isRestoringProgress.current = false;
        }, 200);
        
        Alert.alert('✅ Progress Restored', 'Your previous EPVS calculator selections have been restored.');
      }
    } catch (error) {
      console.error('Error restoring progress:', error);
      isRestoringProgress.current = false;
      Alert.alert('❌ Error', 'Failed to restore progress');
    }
  };

  const clearSavedProgress = async () => {
    try {
      await CalculatorDataService.clearProgress(opportunityId, calculatorType);
      setHasSavedProgress(false);
      setProgressSummary(null);
      setShowRestoreDialog(false);
      Alert.alert('🗑️ Progress Cleared', 'All saved progress has been cleared.');
    } catch (error) {
      console.error('Error clearing progress:', error);
      Alert.alert('❌ Error', 'Failed to clear progress');
    }
  };

  const handleOpenSolarAutoPopulate = async () => {
    if (!opportunityId) {
      Alert.alert('Error', 'No opportunity ID found');
      return;
    }

    setAutoPopulating(true);

    try {
      // Call the EPVS auto-populate endpoint
              const response = await fetch(`/api/opensolar/auto-populate-epvs/${opportunityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateFileName
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          `EPVS calculator auto-populated with OpenSolar data!\n\nMatched fields: ${result.data?.matchedFields?.length || 0}\nUnmatched fields: ${result.data?.unmatchedFields?.length || 0}`,
          [
            {
              text: 'Continue to Dynamic Inputs',
              onPress: () => navigation.navigate('FluxDynamicInputs', {
                opportunityId,
                templateFileName,
                customerDetails
              })
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to auto-populate EPVS calculator');
      }
    } catch (error) {
      console.error('Error auto-populating EPVS calculator:', error);
      Alert.alert('Error', 'Failed to auto-populate EPVS calculator');
    } finally {
      setAutoPopulating(false);
    }
  };

  const applyAllSelections = async () => {
    if (getSelectedCount() === 0) {
      Alert.alert('No Selections', 'Please select at least one option before applying.');
      return;
    }

    setApplying(true);

    try {
      // Create opportunity file if not already created
      if (!fileCreated && customerDetails) {
        const createResponse = await fetch(' /api/epvs-automation/create-opportunity-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            opportunityId,
            customerDetails,
            templateFileName
          }),
        });

        const createResult = await createResponse.json();
        if (!createResult.success) {
          throw new Error(`Failed to create Flux opportunity file: ${createResult.message}`);
        }
        setFileCreated(true);
      }

      // Apply all radio button selections
      const shapeNames = Object.values(selectedOptions)

      let successCount = 0;
      let errorCount = 0;

      for (const shapeName of shapeNames) {
        try {
          const response = await fetch(' /api/epvs-automation/select-radio-button', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shapeName,
              opportunityId
            }),
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to select ${shapeName}:`, result.message);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error selecting ${shapeName}:`, error);
        }
      }

      if (errorCount === 0) {
        // Force save progress before navigation to ensure data is persisted
        await saveProgress(selectedOptions);
        
        // Mark radio-buttons step as completed
        await CalculatorDataService.markStepCompleted(opportunityId, 'radio-buttons', calculatorType);
        
        Alert.alert(
          'Success!',
          `All ${successCount} selections applied successfully to EPVS Excel file.`,
          [
            {
              text: 'Continue to Dynamic Inputs',
              onPress: () => navigation.navigate('FluxDynamicInputs', {
                opportunityId,
                templateFileName,
                customerDetails
              })
            }
          ]
        );
      } else {
        // Force save progress before navigation even with partial success
        await saveProgress(selectedOptions);
        
        // Mark radio-buttons step as completed even with partial success
        await CalculatorDataService.markStepCompleted(opportunityId, 'radio-buttons', calculatorType);
        
        Alert.alert(
          'Partial Success',
          `${successCount} selections applied successfully, ${errorCount} failed.`,
          [
            {
              text: 'Continue to Dynamic Inputs',
              onPress: () => navigation.navigate('FluxDynamicInputs', {
                opportunityId,
                templateFileName,
                customerDetails
              })
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error applying selections:', error);
      Alert.alert('Error', `Failed to apply selections: ${error.message}`);
    } finally {
      setApplying(false);
    }
  };

  if (showRulesTest) {
    return (
      <InputFieldRulesTest
        visible={showRulesTest}
        onClose={() => setShowRulesTest(false)}
      />
    );
  }

  return (
      <View style={[
        styles.container,
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        }
      ]}>
      {/* Customer Info Header */}
      {customerInfo && (
        <View style={styles.customerInfoHeader}>
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerInfoLeft}>
              <Ionicons name="person" size={16} color="#10b981" />
              <Text style={styles.customerName}>
                {customerInfo.name}
              </Text>
            </View>
            <View style={styles.customerInfoRight}>
              <Ionicons name="location" size={16} color="#64748b" />
              <Text style={styles.customerPostcode}>
                {customerInfo.postcode}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          Selected: {getSelectedCount()} / {radioButtonGroups.length} groups
        </Text>
        <View style={styles.statusButtons}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={applyAllSelections}
            disabled={loading || applying || getSelectedCount() === 0}
          >
            {applying ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.applyButtonText}>Apply All</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={clearAllSelections}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => setShowRulesTest(true)}
          >
            <Text style={styles.testButtonText}>Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Restore Component */}
      <ProgressRestoreComponent
        opportunityId={opportunityId}
        hasSavedProgress={hasSavedProgress}
        progressSummary={progressSummary}
        showRestoreDialog={showRestoreDialog}
        onRestoreProgress={restoreProgress}
        onClearSavedProgress={clearSavedProgress}
        onDismissDialog={() => setShowRestoreDialog(false)}
        screenType="radio-buttons"
      />

      {/* OpenSolar Auto-Populate Section */}
      <View style={styles.autoPopulateSection}>
        <Text style={styles.autoPopulateTitle}>🤖 Auto-Populate with OpenSolar</Text>
        <Text style={styles.autoPopulateDescription}>
          Automatically fill EPVS calculator with your OpenSolar project data
        </Text>
        <TouchableOpacity
          style={styles.autoPopulateButton}
          onPress={handleOpenSolarAutoPopulate}
          disabled={loading || applying || autoPopulating}
        >
          {autoPopulating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="cloud-download" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.autoPopulateButtonText}>Auto-Populate EPVS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Radio Button Groups */}
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
        {radioButtonGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.groupDescription}>{group.description}</Text>
            
            <View style={styles.optionsContainer}>
              {group.options.map((option, optionIndex) => (
                  <TouchableOpacity
                  key={optionIndex}
                  style={[
                    styles.radioButton,
                    isOptionSelected(group.title, option.shapeName) && styles.radioButtonSelected
                  ]}
                  onPress={() => handleRadioButtonPress(group.title, option)}
                  disabled={loading}
                >
                  <View style={styles.radioButtonContent}>
                    <View style={[
                      styles.radioCircle,
                      isOptionSelected(group.title, option.shapeName) && styles.radioCircleSelected
                    ]}>
                      {isOptionSelected(group.title, option.shapeName) && (
                        <View style={styles.radioCircleInner} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.radioButtonText,
                        isOptionSelected(group.title, option.shapeName) && styles.radioButtonTextSelected
                      ]}>
                        {option.label}
                      </Text>
                      {option.shapeName === 'BatterySC' && (
                        <Text style={styles.radioButtonNote}>Used for single rate customers</Text>
                      )}
                    </View>
                  </View>
                  
                  {isOptionSelected(group.title, option.shapeName) && (
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  )}
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        ))}

        {/* Self consumption only for single rate: show warning when Dual Rate + Self-Consumption selected */}
        {selectedOptions['⚡ Energy Use'] === 'DualRate' && selectedOptions['🔋 Battery Type'] === 'BatterySC' && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#b91c1c" style={{ marginRight: 10 }} />
            <Text style={styles.warningBannerText}>
              Self consumption is only used for single rate customers. Consider selecting Overnight Charging for dual rate / off-peak.
            </Text>
          </View>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={styles.loadingText}>Updating Flux Excel...</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Tip: Select your Flux options first, then click "Apply All" to update Excel in one go!
          </Text>
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
    backgroundColor: '#f8fafc',
  },
  customerInfoHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 15,
  },
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  statusText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  applyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  group: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // Extra spacing between groups on web
      minHeight: 120, // Ensure groups have minimum height
    }),
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  radioButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  radioButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#10b981',
  },
  radioCircleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  radioButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  radioButtonNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  radioButtonTextSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  autoPopulateSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  autoPopulateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  autoPopulateDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  autoPopulateButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoPopulateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.4)',
    backgroundColor: 'rgba(185, 28, 28, 0.08)',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
  },
});
