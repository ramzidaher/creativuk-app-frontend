import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { BATTERY_INVERTER_MANUFACTURERS, getBatteryInverterModels } from '../config/batteryInverterOptions';
import { BATTERY_MANUFACTURERS, getBatteryModels } from '../config/batteryOptions';
import { PANEL_MANUFACTURERS, getPanelModels } from '../config/panelOptions';
import { SOLAR_INVERTER_MANUFACTURERS, getSolarInverterModels } from '../config/solarInverterOptions';
import { useTheme } from '../context/ThemeContext';
import CalculatorProgressService from '../services/CalculatorProgressService';
// DateTimePicker is not available on web, so we'll conditionally import it
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    // DateTimePicker not available
    console.warn('DateTimePicker not available on this platform');
  }
}

const { width } = Dimensions.get('window');

interface InputField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  value: string;
  required: boolean;
  enabled: boolean;
  cellReference: string;
  dropdownOptions?: string[];
  allowOverride?: boolean;
  helperText?: string;
}

interface RouteParams {
  opportunityId: string;
  customerDetails: {
    customerName: string;
    address: string;
    postcode: string;
  };
  selectedOptions?: Record<string, string>;
  templateFileName?: string;
  selectedTemplateOptions?: {
    solar: boolean;
    solarHybrid: boolean;
    batteryInverter: boolean;
    battery?: boolean;
  };
  calculatorType?: 'flux' | 'epvs';
}

export default function EPVSDynamicInputsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { 
    opportunityId, 
    customerDetails, 
    selectedOptions = {}, 
    templateFileName,
    selectedTemplateOptions,
    calculatorType = 'flux'
  } = route.params as RouteParams;
  
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [pendingDropdownOptions, setPendingDropdownOptions] = useState<Record<string, string[]>>({});
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedInputValues, setSavedInputValues] = useState<Record<string, string> | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const [restoredRadioSelections, setRestoredRadioSelections] = useState<Record<string, string> | null>(null);
  const [restoredTemplateOptions, setRestoredTemplateOptions] = useState<RouteParams['selectedTemplateOptions'] | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<string | null>(null);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ missingFields: string[]; invalidFields: string[] }>({ missingFields: [], invalidFields: [] });
  const [showInverterHelpModal, setShowInverterHelpModal] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current input values match saved values
  const hasChanges = () => {
    if (!savedInputValues) {
      console.log('🔍 EPVS hasChanges: No saved input values available');
      return false;
    }
    
    console.log('🔍 EPVS hasChanges: Comparing current vs saved values');
    console.log('🔍 Current values:', inputValues);
    console.log('🔍 Saved values:', savedInputValues);
    
    // Compare current values with saved values
    for (const [key, value] of Object.entries(inputValues)) {
      const savedValue = savedInputValues[key] || '';
      if (value !== savedValue) {
        console.log(`🔍 Change detected: ${key} = "${value}" (was "${savedValue}")`);
        return true;
      }
    }
    
    // Check if any saved values are missing in current values
    for (const [key, savedValue] of Object.entries(savedInputValues)) {
      const currentValue = inputValues[key] || '';
      if (savedValue !== currentValue) {
        console.log(`🔍 Change detected: ${key} = "${currentValue}" (was "${savedValue}")`);
        return true;
      }
    }
    
    console.log('🔍 No changes detected - values match saved state');
    return false;
  };

  // Helper function to validate and fix template options (shared between init and fetchDynamicInputs)
  const validateTemplateOptions = (options: any): RouteParams['selectedTemplateOptions'] | undefined => {
    if (!options) return undefined;
    
    // If it's a string (could be stringified [object Object])
    if (typeof options === 'string') {
      if (options === '[object Object]' || options === 'object Object') {
        console.warn('⚠️ Template options is stringified [object Object], cannot parse');
        return undefined;
      }
      try {
        const parsed = JSON.parse(options);
        if (parsed && typeof parsed === 'object') {
          return parsed as RouteParams['selectedTemplateOptions'];
        }
      } catch (e) {
        console.warn('⚠️ Could not parse template options from string:', e);
        return undefined;
      }
    }
    
    // If it's an object but has numeric keys (stringified [object Object] parsed as object)
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      const keys = Object.keys(options);
      // Check if it's the stringified [object Object] pattern
      if (keys.length > 0 && keys[0] === '0' && keys.some(k => /^\d+$/.test(k))) {
        const values = keys.map(k => options[k]).join('');
        if (values === '[object Object]') {
          console.warn('⚠️ Template options is stringified [object Object] parsed as object, skipping');
          return undefined;
        }
      }
      
      // Check if it has the expected properties
      if ('solar' in options || 'battery' in options || 'solarHybrid' in options || 'batteryInverter' in options) {
        return options as RouteParams['selectedTemplateOptions'];
      }
    }
    
    return undefined;
  };

  // Restore customer details immediately on mount (separate from init to show in UI quickly)
  useEffect(() => {
    const restoreCustomerDetails = async () => {
      if (!opportunityId) return;
      
      try {
        // Always restore customer details from JSON first (JSON is source of truth)
        let progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          calculatorType
        );
        
        // If CalculatorProgressService doesn't have it, try CalculatorDataService
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
        
        // Always set customer info from JSON if available
        if (progress && progress.customerDetails) {
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer info restored from JSON immediately:', { name: customerName, postcode: customerPostcode });
            return; // Exit early if we got it from JSON
          }
        }
        
        // Fallback to route params if JSON doesn't have it
        if (customerDetails && typeof customerDetails === 'object') {
          const customerName = customerDetails.customerName || '';
          const customerPostcode = customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer info set from route params (fallback):', { name: customerName, postcode: customerPostcode });
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
        // Still try route params as fallback
        if (customerDetails && typeof customerDetails === 'object') {
          const customerName = customerDetails.customerName || '';
          const customerPostcode = customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer info set from route params (error fallback):', { name: customerName, postcode: customerPostcode });
          }
        }
      }
    };
    
    restoreCustomerDetails();
  }, [opportunityId, calculatorType, customerDetails]);

  useEffect(() => {
    const init = async () => {
      // First try to restore ALL progress data BEFORE determining field visibility
      let restoredProgressData: {
        radioButtonSelections?: Record<string, string>;
        templateOptions?: RouteParams['selectedTemplateOptions'];
        customerDetails?: RouteParams['customerDetails'];
      } | null = null;
      
      try {
        // EPVS uses CalculatorDataService (local storage), Off-Peak uses CalculatorProgressService (backend API)
        // Try both to support both calculators
        let progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          calculatorType
        );
        
        // If CalculatorProgressService doesn't have it, try CalculatorDataService
        if (!progress || (!progress.radioButtonSelections && !(progress as any).selectedOptions)) {
          console.log('🔍 CalculatorProgressService returned no radio selections, trying CalculatorDataService...');
          const { default: CalculatorDataService } = await import('../services/CalculatorDataService');
          const localProgress = await CalculatorDataService.getProgress(opportunityId, calculatorType);
          
          if (localProgress) {
            // Convert CalculatorDataService format to CalculatorProgressService format
            progress = {
              ...progress,
              radioButtonSelections: localProgress.selectedOptions,
              customerDetails: localProgress.customerDetails,
              templateSelection: localProgress.selectedTemplateOptions ? {
                selectedOptions: localProgress.selectedTemplateOptions,
                templateFileName: localProgress.templateFileName || ''
              } : undefined,
              dynamicInputs: localProgress.inputValues
            } as any;
            console.log('✅ Found progress in CalculatorDataService:', {
              radioSelections: localProgress.selectedOptions,
              templateOptions: localProgress.selectedTemplateOptions,
              customerDetails: localProgress.customerDetails
            });
          }
        }
        
        if (progress) {
          console.log('🔍 Progress object keys:', Object.keys(progress));
          console.log('🔍 Progress.radioButtonSelections exists:', !!progress.radioButtonSelections);
          console.log('🔍 Progress.radioButtonSelections type:', typeof progress.radioButtonSelections);
          console.log('🔍 Progress.radioButtonSelections value:', progress.radioButtonSelections);
          console.log('🔍 Progress.selectedOptions exists:', !!(progress as any).selectedOptions);
          console.log('🔍 Progress.selectedOptions type:', typeof (progress as any).selectedOptions);
          console.log('🔍 Progress.selectedOptions value:', (progress as any).selectedOptions);
          
          // EPVS uses CalculatorDataService which stores as 'selectedOptions'
          // Off-Peak uses CalculatorProgressService which stores as 'radioButtonSelections'
          // Check both fields to support both calculators
          const rawRadioSelections = progress.radioButtonSelections || (progress as any).selectedOptions;
          
          // Ensure radioButtonSelections is a valid object, not a string
          let validRadioSelections: Record<string, string> | undefined;
          if (rawRadioSelections) {
            if (typeof rawRadioSelections === 'object' && rawRadioSelections !== null && !Array.isArray(rawRadioSelections)) {
              validRadioSelections = rawRadioSelections;
              console.log('✅ Found valid radio selections in progress:', validRadioSelections);
            } else if (typeof rawRadioSelections === 'string' && rawRadioSelections !== '[object Object]') {
              try {
                validRadioSelections = JSON.parse(rawRadioSelections);
                console.log('✅ Parsed radio selections from string:', validRadioSelections);
              } catch (e) {
                console.warn('⚠️ Could not parse radio selections from progress:', e);
                validRadioSelections = undefined;
              }
            } else {
              console.warn('⚠️ Radio selections is invalid type or format:', typeof rawRadioSelections, rawRadioSelections);
            }
          } else {
            console.warn('⚠️ No radio selections found in progress object (checked both radioButtonSelections and selectedOptions)');
          }
          
          // Store restored data to pass to fetchDynamicInputs
          // Use template options from progress, or fallback to route params if not found
          // Extract only the selectedOptions from templateSelection if it exists (same as Off-Peak)
          
          // IMPORTANT: Prioritize route params over restored progress for template options
          // Route params represent the current selection, while progress might be stale
          let effectiveTemplateOptions = validateTemplateOptions(selectedTemplateOptions)
            || validateTemplateOptions(progress.templateSelection?.selectedOptions);
          
          console.log('🔍 Raw progress.templateSelection:', progress.templateSelection);
          console.log('🔍 Raw progress.templateSelection?.selectedOptions:', progress.templateSelection?.selectedOptions);
          console.log('🔍 Raw progress.templateSelection?.selectedOptions type:', typeof progress.templateSelection?.selectedOptions);
          console.log('🔍 Route params selectedTemplateOptions:', selectedTemplateOptions);
          console.log('🔍 Route params selectedTemplateOptions type:', typeof selectedTemplateOptions);
          console.log('🔍 Effective template options (route params prioritized):', effectiveTemplateOptions);
          
          // Warn if route params differ from saved progress (user might have changed template)
          const progressTemplateOptions = validateTemplateOptions(progress.templateSelection?.selectedOptions);
          if (effectiveTemplateOptions && progressTemplateOptions) {
            const routeKeys = Object.keys(effectiveTemplateOptions).filter(k => effectiveTemplateOptions![k as keyof typeof effectiveTemplateOptions] === true);
            const progressKeys = Object.keys(progressTemplateOptions).filter(k => progressTemplateOptions[k as keyof typeof progressTemplateOptions] === true);
            if (routeKeys.sort().join(',') !== progressKeys.sort().join(',')) {
              console.warn('⚠️ Template options in route params differ from saved progress. Using route params (current selection).');
              console.warn('   Route params:', effectiveTemplateOptions);
              console.warn('   Saved progress:', progressTemplateOptions);
            }
          }
          
          console.log('🔍 Extracted template options:', effectiveTemplateOptions);
          console.log('🔍 Template options keys:', effectiveTemplateOptions ? Object.keys(effectiveTemplateOptions) : []);
          console.log('🔍 Template options values:', effectiveTemplateOptions ? {
            solar: effectiveTemplateOptions.solar,
            battery: effectiveTemplateOptions.battery,
            solarHybrid: effectiveTemplateOptions.solarHybrid,
            batteryInverter: effectiveTemplateOptions.batteryInverter
          } : 'null');
          
          // Always prefer restored progress over route params (especially when accessing via URL)
          // Restore radio button selections to state
          if (validRadioSelections && Object.keys(validRadioSelections).length > 0) {
            setRestoredRadioSelections(validRadioSelections);
            console.log('✅ Restored radio button selections from progress:', validRadioSelections);
          } else {
            console.warn('⚠️ No valid radio selections to restore');
          }
          
          // Restore template options to state (same as Off-Peak - simple fallback)
          if (effectiveTemplateOptions) {
            setRestoredTemplateOptions(effectiveTemplateOptions);
            console.log('✅ Restored template options to state:', effectiveTemplateOptions);
          } else {
            console.warn('⚠️ No template options to restore to state');
          }
          
          // Always prioritize customer details from JSON (progress) over route params
          const effectiveCustomerDetails = progress.customerDetails || customerDetails;
          
          // Store restored data to pass to fetchDynamicInputs (same as Off-Peak)
          restoredProgressData = {
            radioButtonSelections: validRadioSelections,
            templateOptions: effectiveTemplateOptions,
            customerDetails: effectiveCustomerDetails // Always use JSON customer details if available
          };
          
          console.log('🔍 restoredProgressData:', restoredProgressData);
          console.log('✅ Customer details from JSON (prioritized):', effectiveCustomerDetails);
          
          // Always extract customer information for header display from JSON first
          if (effectiveCustomerDetails && typeof effectiveCustomerDetails === 'object') {
            const customerName = effectiveCustomerDetails.customerName || '';
            const customerPostcode = effectiveCustomerDetails.postcode || '';
            
            if (customerName || customerPostcode) {
              setCustomerInfo({
                name: customerName || 'Customer',
                postcode: customerPostcode || 'N/A'
              });
              console.log('✅ Set customer info from JSON in init (prioritized):', { name: customerName, postcode: customerPostcode });
            }
          }
          
          // Also set from route params if JSON doesn't have it
          if (!customerInfo && customerDetails && typeof customerDetails === 'object') {
            const customerName = customerDetails.customerName || '';
            const customerPostcode = customerDetails.postcode || '';
            
            if (customerName || customerPostcode) {
              setCustomerInfo({
                name: customerName || 'Customer',
                postcode: customerPostcode || 'N/A'
              });
              console.log('✅ Set customer info from route params in init (fallback):', { name: customerName, postcode: customerPostcode });
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore progress, using route params');
        // Fallback to route params
      if (customerDetails) {
          const customerName = customerDetails.customerName || '';
          const customerPostcode = customerDetails.postcode || '';
        
          if (customerName || customerPostcode) {
          setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Set customer info from route params (fallback):', { name: customerName, postcode: customerPostcode });
          }
        }
      }
      
      // Ensure customer info is always set (even if no progress is found, use route params)
      if (!customerInfo) {
        if (customerDetails && typeof customerDetails === 'object') {
          const customerName = customerDetails.customerName || '';
          const customerPostcode = customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Set customer info from route params in init (final fallback):', { name: customerName, postcode: customerPostcode });
          }
        }
      }
      
      // First restore input values automatically
      await restoreProgress();
      
      // If we don't have restoredProgressData yet, try to restore it again
      // This ensures we have radio selections when refreshing directly on this page
      if (!restoredProgressData?.radioButtonSelections || Object.keys(restoredProgressData.radioButtonSelections).length === 0) {
        console.log('⚠️ No radio selections in restoredProgressData, attempting to restore again...');
        try {
          const progress = await CalculatorProgressService.restoreProgress(
            opportunityId,
            calculatorType
          );
          
          if (progress) {
            console.log('🔍 Second restore attempt - Progress object keys:', Object.keys(progress));
            console.log('🔍 Second restore attempt - Progress.radioButtonSelections:', progress.radioButtonSelections);
            console.log('🔍 Second restore attempt - Progress.radioButtonSelections type:', typeof progress.radioButtonSelections);
            console.log('🔍 Second restore attempt - Progress.selectedOptions:', (progress as any).selectedOptions);
            console.log('🔍 Second restore attempt - Progress.selectedOptions type:', typeof (progress as any).selectedOptions);
            
            // EPVS uses CalculatorDataService which stores as 'selectedOptions'
            // Off-Peak uses CalculatorProgressService which stores as 'radioButtonSelections'
            // Check both fields to support both calculators
            const rawRadioSelections = progress.radioButtonSelections || (progress as any).selectedOptions;
            
            // Ensure radioButtonSelections is a valid object, not a string
            let validRadioSelections: Record<string, string> | undefined;
            if (rawRadioSelections) {
              if (typeof rawRadioSelections === 'object' && rawRadioSelections !== null && !Array.isArray(rawRadioSelections)) {
                validRadioSelections = rawRadioSelections;
                console.log('✅ Second attempt: Found valid radio selections:', validRadioSelections);
              } else if (typeof rawRadioSelections === 'string' && rawRadioSelections !== '[object Object]') {
                try {
                  validRadioSelections = JSON.parse(rawRadioSelections);
                  console.log('✅ Second attempt: Parsed radio selections from string:', validRadioSelections);
                } catch (e) {
                  console.warn('⚠️ Second attempt: Could not parse radio selections from progress:', e);
                  validRadioSelections = undefined;
                }
              } else {
                console.warn('⚠️ Second attempt: Radio selections is invalid type:', typeof rawRadioSelections);
              }
            } else {
              console.warn('⚠️ Second attempt: No radio selections found in progress object (checked both radioButtonSelections and selectedOptions)');
            }
            
            if (validRadioSelections && Object.keys(validRadioSelections).length > 0) {
              // Also check for template options in second attempt
              const secondAttemptTemplateOptions = progress.templateSelection?.selectedOptions || selectedTemplateOptions;
              restoredProgressData = {
                ...restoredProgressData,
                radioButtonSelections: validRadioSelections,
                templateOptions: secondAttemptTemplateOptions
              };
              setRestoredRadioSelections(validRadioSelections);
              if (secondAttemptTemplateOptions) {
                setRestoredTemplateOptions(secondAttemptTemplateOptions);
                console.log('✅ Restored template options on second attempt:', secondAttemptTemplateOptions);
              }
              console.log('✅ Restored radio button selections on second attempt:', validRadioSelections);
            } else {
              console.warn('⚠️ Second attempt: No valid radio selections to restore');
            }
            
            // Also restore template options if found
            const secondAttemptTemplateOptions = progress?.templateSelection?.selectedOptions || selectedTemplateOptions;
            if (secondAttemptTemplateOptions && !restoredProgressData?.templateOptions) {
              restoredProgressData = {
                ...restoredProgressData,
                templateOptions: secondAttemptTemplateOptions
              };
              setRestoredTemplateOptions(secondAttemptTemplateOptions);
              console.log('✅ Restored template options on second attempt (separate check):', secondAttemptTemplateOptions);
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not restore radio selections on second attempt');
        }
      }
      
      // Ensure template options are available before fetching fields
      if (!restoredProgressData?.templateOptions && selectedTemplateOptions) {
        restoredProgressData = {
          ...restoredProgressData,
          templateOptions: selectedTemplateOptions
        };
        setRestoredTemplateOptions(selectedTemplateOptions);
        console.log('✅ Using template options from route params (final fallback):', selectedTemplateOptions);
      }
      
      // Then fetch dynamic inputs with restored data (to ensure correct field visibility)
      await fetchDynamicInputs(restoredProgressData);
    };
    
    init();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [customerDetails, opportunityId, calculatorType]);

  // Auto-save when input values change
  useEffect(() => {
    if (hasRestoredProgress && Object.keys(inputValues).length > 0) {
      autoSaveProgress();
    }
  }, [inputValues, hasRestoredProgress]);

  // Debug logging for inputValues state changes
  useEffect(() => {
    console.log('🔍 EPVSDynamicInputsScreen: inputValues state changed:', inputValues);
  }, [inputValues]);

  const restoreProgress = async () => {
    try {
      console.log('🔍 EPVSDynamicInputsScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType
      );
      
      if (progress && progress.dynamicInputs) {
        console.log('🔄 Auto-restoring EPVS input values from saved progress:', progress.dynamicInputs);
        
        // Ensure all values are strings and set them to display in the UI
        const restoredValues: Record<string, string> = {};
        Object.entries(progress.dynamicInputs).forEach(([key, value]) => {
          restoredValues[key] = value !== null && value !== undefined ? String(value) : '';
        });
        
        setInputValues(restoredValues);
        setSavedInputValues(restoredValues); // Store original values for comparison
        setHasRestoredProgress(true); // Only set to true if we actually restored progress
        console.log('✅ Flux dynamic input values restored and displayed in UI');
        console.log('🔍 Current inputValues state:', restoredValues);
        console.log('🔍 Saved input values for comparison:', restoredValues);
        
        // Store restored values for later use in fetchDynamicInputs
        (window as any).restoredInputValues = restoredValues;
      } else {
        console.log('ℹ️ No Flux Dynamic Inputs progress found to restore');
        setHasRestoredProgress(false); // Set to false if no progress was found
        (window as any).restoredInputValues = null;
      }
    } catch (error) {
      console.error('Error restoring Flux Dynamic Inputs progress:', error);
      setHasRestoredProgress(false); // Set to false if there was an error
      (window as any).restoredInputValues = null;
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
          currentStep: 'dynamic-inputs' as const,
          dynamicInputs: inputValues,
        };

        const result = await CalculatorProgressService.autoSave(
          opportunityId,
          calculatorType,
          progressData
        );

        if (result.saved) {
          console.log('✅ Flux Dynamic Inputs progress auto-saved');
        }
      }, 1000); // Save after 1 second of no changes
    } catch (error) {
      console.error('Error auto-saving Flux Dynamic Inputs progress:', error);
    }
  };

  const ensureDropdownOptionsForRestoredValues = async (fields: InputField[], restoredValues: Record<string, string> | null) => {
    if (!restoredValues) {
      console.log('🔍 No restored values available for dropdown options');
      return;
    }
    
    console.log('🔍 Ensuring dropdown options for restored values:', restoredValues);
    
    // Check for cascading dropdowns that need their options updated
    const cascadingFields = {
      panel_manufacturer: 'panel_model',
      battery_manufacturer: 'battery_model',
      solar_inverter_manufacturer: 'solar_inverter_model',
      battery_inverter_manufacturer: 'battery_inverter_model'
    };
    
    for (const [manufacturerField, modelField] of Object.entries(cascadingFields)) {
      const manufacturerValue = restoredValues[manufacturerField];
      if (manufacturerValue) {
        console.log(`🔍 Found restored manufacturer value: ${manufacturerField} = ${manufacturerValue}`);
        
        // For panel_manufacturer -> panel_model, use local config
        if (manufacturerField === 'panel_manufacturer' && modelField === 'panel_model') {
          const panelModels = getPanelModels(manufacturerValue);
          console.log(`🔍 Using local panel models for ${manufacturerValue}:`, panelModels);
          
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === modelField 
              ? { ...field, dropdownOptions: panelModels }
              : field
          ));
          console.log(`✅ Updated ${modelField} with ${panelModels.length} options for restored manufacturer: ${manufacturerValue}`);
        }
        // For battery_manufacturer -> battery_model, use local config
        else if (manufacturerField === 'battery_manufacturer' && modelField === 'battery_model') {
          const batteryModels = getBatteryModels(manufacturerValue);
          console.log(`🔍 Using local battery models for ${manufacturerValue}:`, batteryModels);
          
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === modelField 
              ? { ...field, dropdownOptions: batteryModels }
              : field
          ));
          console.log(`✅ Updated ${modelField} with ${batteryModels.length} options for restored manufacturer: ${manufacturerValue}`);
        }
        // For solar_inverter_manufacturer -> solar_inverter_model, use local config
        else if (manufacturerField === 'solar_inverter_manufacturer' && modelField === 'solar_inverter_model') {
          const solarInverterModels = getSolarInverterModels(manufacturerValue);
          console.log(`🔍 Using local solar inverter models for ${manufacturerValue}:`, solarInverterModels);
          
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === modelField 
              ? { ...field, dropdownOptions: solarInverterModels }
              : field
          ));
          console.log(`✅ Updated ${modelField} with ${solarInverterModels.length} options for restored manufacturer: ${manufacturerValue}`);
        }
        // For battery_inverter_manufacturer -> battery_inverter_model, use local config
        else if (manufacturerField === 'battery_inverter_manufacturer' && modelField === 'battery_inverter_model') {
          const batteryInverterModels = getBatteryInverterModels(manufacturerValue);
          console.log(`🔍 Using local battery inverter models for ${manufacturerValue}:`, batteryInverterModels);
          
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === modelField 
              ? { ...field, dropdownOptions: batteryInverterModels }
              : field
          ));
          console.log(`✅ Updated ${modelField} with ${batteryInverterModels.length} options for restored manufacturer: ${manufacturerValue}`);
        } else {
          // For other cascading dropdowns (battery, inverters), fetch from backend
        try {
          const { api } = await import('../utils/api');
          const response = await api.get(`/epvs-automation/cascading-dropdown/${modelField}/${opportunityId}?dependsOnValue=${manufacturerValue}`);

          const result = response.data as any;
          console.log(`🔍 Fetched options for ${modelField} based on ${manufacturerValue}:`, result);
          
          if (result.success && result.options) {
            // Update the field with new options
            setInputFields(prev => prev.map(field => 
              field.id === modelField 
                ? { ...field, dropdownOptions: result.options }
                : field
            ));
            console.log(`✅ Updated ${modelField} with ${result.options.length} options for restored manufacturer: ${manufacturerValue}`);
          }
    } catch (error) {
          console.error(`❌ Error getting options for ${modelField}:`, error);
          }
        }
      }
    }
  };

  const fetchDynamicInputs = async (restoredDataOverride?: {
    radioButtonSelections?: Record<string, string>;
    templateOptions?: RouteParams['selectedTemplateOptions'];
    customerDetails?: RouteParams['customerDetails'];
  } | null) => {
    try {
      setLoading(true);
      setError(null);

      console.log('⚡ Loading EPVS fields from saved progress (NO API calls)');
      
      // Get restored values from saved progress (set by restoreProgress)
      const restoredValues = (window as any).restoredInputValues || {};
      console.log('🔍 Restored input values:', restoredValues);
      
      // Always prefer restored progress over route params
      // Use override first (from direct call in init), then state, then route params
      // Handle case where selectedOptions might be stringified '[object Object]' from route params
      let routeSelectedOptions = selectedOptions;
      if (typeof selectedOptions === 'string' && selectedOptions === '[object Object]') {
        routeSelectedOptions = {};
        console.warn('⚠️ selectedOptions from route params is stringified, using empty object');
      }
      
      // Determine effective radio button selections
      // Priority: restoredDataOverride > restoredRadioSelections state > route params
      let effectiveSelectedOptions: Record<string, string> = {};
      
      if (restoredDataOverride?.radioButtonSelections && Object.keys(restoredDataOverride.radioButtonSelections).length > 0) {
        effectiveSelectedOptions = restoredDataOverride.radioButtonSelections;
        console.log('✅ Using radio selections from restoredDataOverride');
      } else if (restoredRadioSelections && Object.keys(restoredRadioSelections).length > 0) {
        effectiveSelectedOptions = restoredRadioSelections;
        console.log('✅ Using radio selections from restoredRadioSelections state');
      } else if (typeof routeSelectedOptions === 'object' && routeSelectedOptions !== null && Object.keys(routeSelectedOptions).length > 0) {
        effectiveSelectedOptions = routeSelectedOptions;
        console.log('⚠️ Using radio selections from route params (fallback)');
      } else {
        console.warn('⚠️ No radio selections available, fields may not show correctly');
      }
      
      // IMPORTANT: Prioritize route params over restored progress for template options
      // Route params represent the current selection, while progress might be stale
      // Validate route params template options first, then fallback to restored
      const validatedRouteTemplateOptions = validateTemplateOptions(selectedTemplateOptions);
      const validatedRestoredOverride = restoredDataOverride?.templateOptions ? validateTemplateOptions(restoredDataOverride.templateOptions) : undefined;
      const validatedRestoredState = restoredTemplateOptions ? validateTemplateOptions(restoredTemplateOptions) : undefined;
      const effectiveSelectedTemplateOptions = validatedRouteTemplateOptions
        || validatedRestoredOverride
        || validatedRestoredState;
      
      // Warn if route params differ from restored data
      if (validatedRouteTemplateOptions && validatedRestoredOverride) {
        const routeKeys = Object.keys(validatedRouteTemplateOptions).filter(k => validatedRouteTemplateOptions[k as keyof typeof validatedRouteTemplateOptions] === true);
        const restoredKeys = Object.keys(validatedRestoredOverride).filter(k => validatedRestoredOverride[k as keyof typeof validatedRestoredOverride] === true);
        if (routeKeys.sort().join(',') !== restoredKeys.sort().join(',')) {
          console.warn('⚠️ Template options in route params differ from restored progress. Using route params (current selection).');
          console.warn('   Route params:', validatedRouteTemplateOptions);
          console.warn('   Restored progress:', validatedRestoredOverride);
        }
      }
      
      console.log('🔍 Using radio button selections (restored preferred):', effectiveSelectedOptions);
      console.log('🔍 Radio button selections type:', typeof effectiveSelectedOptions);
      console.log('🔍 Radio button selections keys:', effectiveSelectedOptions ? Object.keys(effectiveSelectedOptions) : []);
      console.log('🔍 Radio button selections count:', Object.keys(effectiveSelectedOptions).length);
      console.log('🔍 Using template options (restored preferred):', effectiveSelectedTemplateOptions);
      console.log('🔍 Template options type:', typeof effectiveSelectedTemplateOptions);
      console.log('🔍 Template options keys:', effectiveSelectedTemplateOptions ? Object.keys(effectiveSelectedTemplateOptions) : []);
      console.log('🔍 Template options values:', effectiveSelectedTemplateOptions ? {
        solar: effectiveSelectedTemplateOptions.solar,
        battery: effectiveSelectedTemplateOptions.battery,
        solarHybrid: effectiveSelectedTemplateOptions.solarHybrid,
        batteryInverter: effectiveSelectedTemplateOptions.batteryInverter
      } : 'null/undefined');
      console.log('🔍 Template options FULL object:', effectiveSelectedTemplateOptions);
      console.log('🔍 Template options stringified:', effectiveSelectedTemplateOptions ? JSON.stringify(effectiveSelectedTemplateOptions, null, 2) : 'null/undefined');
      console.log('🔍 Calculator type:', calculatorType);
      
      // Use client-side mapping to determine which fields to show
      const { getEPVSEnabledFields, toEPVSInputField } = await import('../config/epvsDynamicInputFields');
      const enabledFieldDefinitions = getEPVSEnabledFields(
        effectiveSelectedTemplateOptions,
        calculatorType,
        effectiveSelectedOptions // Pass radio button selections for conditional visibility
      );
      console.log(`⚡ Client-side mapping suggests ${enabledFieldDefinitions.length} fields for EPVS/Flux`);

      if (enabledFieldDefinitions.length === 0) {
        console.warn('⚠️ No fields found for current selections');
        setError('No input fields available. Please check your template and radio button selections.');
        setLoading(false);
        return;
      }

      // Convert to InputField format and initialize with restored values
      const initialValues: Record<string, string> = {};
      const fieldsToShow: InputField[] = enabledFieldDefinitions.map(fieldDef => {
        // Get value from restored progress, or empty string
        const value = restoredValues?.[fieldDef.id] || '';
        if (value) {
          initialValues[fieldDef.id] = value;
        }
        // Convert to InputField (dropdown options will be empty initially)
        return toEPVSInputField(fieldDef, value, []);
      });

      // Fields from getEPVSEnabledFields are already filtered - they should all be enabled
      // Just mark them as enabled (getEPVSEnabledFields already filtered out disabled fields)
      // Make all enabled fields required
      const fieldsWithRadioButtonLogic = fieldsToShow.map(field => {
        // All fields returned by getEPVSEnabledFields should be enabled
        // The filtering logic already excludes disabled fields
                return {
                  ...field,
          enabled: true,
          required: true // All enabled fields are required
        };
      });

      // Merge restored values with initial values to preserve all restored data
      const mergedValues = {
        ...restoredValues, // Start with all restored values
        ...initialValues   // Override with values from enabled fields (should be same, but ensure consistency)
      };

      // Initialize dropdown options if manufacturer/model values are restored
      const fieldsWithInitializedOptions = fieldsWithRadioButtonLogic.map(field => {
        // Panel manufacturer
        if (field.id === 'panel_manufacturer') {
          return {
            ...field,
            dropdownOptions: PANEL_MANUFACTURERS
          };
        }
        // Panel model
        if (field.id === 'panel_model') {
          const manufacturerValue = mergedValues['panel_manufacturer'];
          if (manufacturerValue) {
            const panelModels = getPanelModels(manufacturerValue);
            return {
              ...field,
              dropdownOptions: panelModels
            };
          }
        }
        // Battery manufacturer
        if (field.id === 'battery_manufacturer') {
          return {
            ...field,
            dropdownOptions: BATTERY_MANUFACTURERS
          };
        }
        // Battery model
        if (field.id === 'battery_model') {
          const manufacturerValue = mergedValues['battery_manufacturer'];
          if (manufacturerValue) {
            const batteryModels = getBatteryModels(manufacturerValue);
            return {
              ...field,
              dropdownOptions: batteryModels
            };
          }
        }
        // Solar inverter manufacturer
        if (field.id === 'solar_inverter_manufacturer') {
          return {
            ...field,
            dropdownOptions: SOLAR_INVERTER_MANUFACTURERS
          };
        }
        // Solar inverter model
        if (field.id === 'solar_inverter_model') {
          const manufacturerValue = mergedValues['solar_inverter_manufacturer'];
          if (manufacturerValue) {
            const solarInverterModels = getSolarInverterModels(manufacturerValue);
            return {
              ...field,
              dropdownOptions: solarInverterModels
            };
          }
        }
        // Battery inverter manufacturer
        if (field.id === 'battery_inverter_manufacturer') {
          return {
            ...field,
            dropdownOptions: BATTERY_INVERTER_MANUFACTURERS
          };
        }
        // Battery inverter model
        if (field.id === 'battery_inverter_model') {
          const manufacturerValue = mergedValues['battery_inverter_manufacturer'];
          if (manufacturerValue) {
            const batteryInverterModels = getBatteryInverterModels(manufacturerValue);
            return {
              ...field,
              dropdownOptions: batteryInverterModels
            };
          }
        }
        return field;
      });

      // Set fields immediately - instant display, no API calls
      setInputFields(fieldsWithInitializedOptions);
      setInputValues(mergedValues);
      
      // Set saved values for comparison (preserve all restored values)
      if (Object.keys(mergedValues).length > 0) {
        setSavedInputValues(mergedValues);
        console.log('🔍 Set saved input values for comparison:', mergedValues);
      }
        
      // Hide loading state - fields are displayed!
      setLoading(false);
      console.log(`✅ Loaded ${fieldsWithInitializedOptions.length} EPVS input fields instantly from saved progress (${Object.keys(restoredValues).length} with saved values)`);
      
      // NOTE: Dropdown options will be loaded lazily when user interacts with dropdowns
      // This avoids API calls on initial load. Options can be fetched on-demand if needed.
      
    } catch (error) {
      console.error('Error loading EPVS dynamic inputs from saved progress:', error);
      setError('Error loading input fields from saved progress');
      setLoading(false);
    }
  };

  const handleInputChange = async (fieldId: string, value: string) => {
    // Ensure value is always a string
    const stringValue = value !== null && value !== undefined ? String(value) : '';
    const newInputValues = {
      ...inputValues,
      [fieldId]: stringValue,
    };
    setInputValues(newInputValues);

    // Debounce the save operation to improve performance
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
        saveProgress(newInputValues);
    }, 1000); // Save after 1 second of no changes

    // Handle cascading dropdowns - when manufacturer changes, update model options
    const cascadingFields = {
      panel_manufacturer: 'panel_model',
      battery_manufacturer: 'battery_model',
      solar_inverter_manufacturer: 'solar_inverter_model',
      battery_inverter_manufacturer: 'battery_inverter_model'
    };

    const dependentField = cascadingFields[fieldId as keyof typeof cascadingFields];
    if (dependentField) {
      // Clear the dependent field when manufacturer changes
      const updatedValues = {
        ...newInputValues,
        [dependentField]: '',
      };
      setInputValues(updatedValues);
      
      // Debounce the save for cascading updates too
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveProgress(updatedValues);
      }, 1000);

      // Get new options for the dependent field
      // For panel_manufacturer -> panel_model, use local config
      if (fieldId === 'panel_manufacturer' && dependentField === 'panel_model') {
        const panelModels = getPanelModels(value);
        console.log(`Using local panel models for ${value}:`, panelModels);
        
        // Update the field with new options
        setInputFields(prev => prev.map(field => 
          field.id === dependentField 
            ? { ...field, dropdownOptions: panelModels }
            : field
        ));
        console.log(`Updated EPVS ${dependentField} with ${panelModels.length} options from local config`);
      } 
      // For battery_manufacturer -> battery_model, use local config
      else if (fieldId === 'battery_manufacturer' && dependentField === 'battery_model') {
        const batteryModels = getBatteryModels(value);
        console.log(`Using local battery models for ${value}:`, batteryModels);
        
        // Update the field with new options
        setInputFields(prev => prev.map(field => 
          field.id === dependentField 
            ? { ...field, dropdownOptions: batteryModels }
            : field
        ));
        console.log(`Updated EPVS ${dependentField} with ${batteryModels.length} options from local config`);
      }
      // For solar_inverter_manufacturer -> solar_inverter_model, use local config
      else if (fieldId === 'solar_inverter_manufacturer' && dependentField === 'solar_inverter_model') {
        const solarInverterModels = getSolarInverterModels(value);
        console.log(`Using local solar inverter models for ${value}:`, solarInverterModels);
        
        // Update the field with new options
        setInputFields(prev => prev.map(field => 
          field.id === dependentField 
            ? { ...field, dropdownOptions: solarInverterModels }
            : field
        ));
        console.log(`Updated EPVS ${dependentField} with ${solarInverterModels.length} options from local config`);
      }
      // For battery_inverter_manufacturer -> battery_inverter_model, use local config
      else if (fieldId === 'battery_inverter_manufacturer' && dependentField === 'battery_inverter_model') {
        const batteryInverterModels = getBatteryInverterModels(value);
        console.log(`Using local battery inverter models for ${value}:`, batteryInverterModels);
        
        // Update the field with new options
        setInputFields(prev => prev.map(field => 
          field.id === dependentField 
            ? { ...field, dropdownOptions: batteryInverterModels }
            : field
        ));
        console.log(`Updated EPVS ${dependentField} with ${batteryInverterModels.length} options from local config`);
      } else {
        // For other cascading dropdowns (battery, inverters), fetch from backend
      try {
        console.log(`Fetching EPVS options for ${dependentField} based on ${fieldId} = ${value}`);
        
        const { api } = await import('../utils/api');
        const response = await api.get(`/epvs-automation/cascading-dropdown/${dependentField}/${opportunityId}?dependsOnValue=${value}`);

        const result = response.data as any;
        console.log(`EPVS backend response for ${dependentField}:`, result);
        
        if (result.success && result.options) {
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === dependentField 
              ? { ...field, dropdownOptions: result.options }
              : field
          ));
          console.log(`Updated EPVS ${dependentField} with ${result.options.length} options`);
        } else {
          console.error(`Failed to get EPVS options for ${dependentField}:`, result.message);
        }
      } catch (error) {
        console.error('Error getting EPVS cascading dropdown options:', error);
        }
      }
    }
  };

  const saveProgress = async (values?: Record<string, string>) => {
    try {
      if (customerDetails && opportunityId) {
        // Debounce the save operation to avoid too many saves
        const currentValues = values || inputValues;
        
        // Only save if there are actual values to save
        if (Object.keys(currentValues).length > 0) {
          const progressData: any = {
            currentStep: 'dynamic-inputs' as const,
            dynamicInputs: currentValues,
            customerDetails,
            radioButtonSelections: selectedOptions,
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
            calculatorType,
            progressData
          );
        }
      }
    } catch (error) {
      console.error('Error saving EPVS progress:', error);
    }
  };


  const validateInputs = (): boolean => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];
    
    for (const field of inputFields) {
      if (field.enabled && field.required) {
        const value = inputValues[field.id];
        // Ensure value is a string and check if it's empty
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        if (!stringValue || stringValue.trim() === '') {
          missingFields.push(field.label);
        }
      }
      
      if (field.enabled && field.type === 'number' && inputValues[field.id]) {
        const value = inputValues[field.id];
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        const numValue = parseFloat(stringValue);
        if (isNaN(numValue)) {
          invalidFields.push(field.label);
        }
      }
    }
    
    // Show validation modal if there are any validation errors
    if (missingFields.length > 0 || invalidFields.length > 0) {
      setValidationErrors({ missingFields, invalidFields });
      setShowValidationModal(true);
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    console.log('🔍 EPVS handleSave called');
    console.log('🔍 Current state:', {
      opportunityId,
      calculatorType,
      inputValuesCount: Object.keys(inputValues).length,
      inputFieldsCount: inputFields.length,
      saving
    });
    
    // Validate inputs first
    const isValid = validateInputs();
    console.log('🔍 Validation result:', isValid);
    
    if (!isValid) {
      console.log('⚠️ Validation failed, returning early');
      return;
    }

    try {
      setSaving(true);
      console.log('✅ setSaving(true) called');

      console.log('🔄 EPVS Save & Calculate: Saving dynamic inputs to JSON (NO COM call)');
      console.log('🔍 Input values to save:', inputValues);
      console.log('🔍 Progress data:', {
        currentStep: 'dynamic-inputs',
        dynamicInputs: inputValues,
        completedSteps: { 'dynamic-inputs': true }
      });
      
      // Save progress to JSON (NO COM call - Excel update happens on final submit)
        const progressData = {
          currentStep: 'dynamic-inputs' as const,
          dynamicInputs: inputValues,
          completedSteps: {
            'dynamic-inputs': true,
          },
        };
        
      console.log('🔍 Calling CalculatorProgressService.saveProgress...');
      const saveResult = await CalculatorProgressService.saveProgress(
                opportunityId,
          calculatorType,
          progressData
        );
      console.log('✅ Save progress result:', saveResult);

      if (!saveResult.success) {
        console.error('❌ Save progress failed:', saveResult.message);
        Alert.alert('⚠️ Save Failed', saveResult.message || 'Failed to save progress. Please try again.');
        setSaving(false);
        return;
      }

      console.log('✅ Flux Dynamic Inputs saved to JSON, navigating to SolarArraysInputs...');
      
      // Prepare navigation params (always prepare these before any async operations)
      const effectiveTemplateFileName = templateFileName || '';
      const effectiveCustomerDetails = customerInfo 
        ? {
            customerName: customerInfo.name,
            address: customerDetails?.address || '',
            postcode: customerInfo.postcode
          }
        : customerDetails;
      const effectiveSelectedTemplateOptions = restoredTemplateOptions || selectedTemplateOptions;
      
      const navigationParams = {
        opportunityId,
        templateFileName: effectiveTemplateFileName,
        customerDetails: effectiveCustomerDetails,
        selectedTemplateOptions: effectiveSelectedTemplateOptions,
        calculatorType: calculatorType,
      };
      
      console.log('🔍 Prepared navigation params:', navigationParams);
      
      // Mark the calculator step as completed in the workflow (optional - don't block navigation)
      try {
        console.log('🔍 Calling workflowApi.completeStep...');
          const { workflowApi } = await import('../utils/api');
        const workflowResult = await workflowApi.completeStep(opportunityId, 3, {
            calculatorType: calculatorType,
            completedAt: new Date().toISOString(),
            savedInputs: inputValues
          });
        console.log('✅ Workflow step completed:', workflowResult);
      } catch (workflowError) {
        console.error('❌ Error marking step as completed (non-blocking):', workflowError);
        // Continue with navigation even if workflow step fails
      }
      
      // Navigate to arrays page for "New Products - Solar" (always attempt navigation)
      console.log('🔍 Attempting navigation to SolarArraysInputs...');
      
      try {
        (navigation as any).navigate('SolarArraysInputs', navigationParams);
        console.log('✅ Navigation to SolarArraysInputs called successfully');
      } catch (navError) {
        console.error('❌ Navigation error:', navError);
        Alert.alert(
          'Navigation Error',
          `Failed to navigate to next screen: ${navError instanceof Error ? navError.message : 'Unknown error'}. Please try again.`
        );
        throw navError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      console.error('❌ Error saving EPVS inputs:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Even if save failed, try to navigate if we have opportunityId
      if (opportunityId) {
        console.log('⚠️ Save failed but attempting navigation anyway...');
        try {
          const navigationParams = {
            opportunityId,
            templateFileName: templateFileName || '',
            customerDetails: customerInfo 
              ? {
                  customerName: customerInfo.name,
                  address: customerDetails?.address || '',
                  postcode: customerInfo.postcode
                }
              : customerDetails,
            selectedTemplateOptions: restoredTemplateOptions || selectedTemplateOptions,
            calculatorType: calculatorType,
          };
          
          (navigation as any).navigate('SolarArraysInputs', navigationParams);
          console.log('✅ Navigation attempted after error');
        } catch (navError) {
          console.error('❌ Navigation also failed after error:', navError);
        }
      }
      
      Alert.alert(
        '❌ Error', 
        error instanceof Error 
          ? `Failed to save: ${error.message}` 
          : 'Network error while saving input values. Please try again.'
      );
    } finally {
      console.log('🔍 Setting saving to false');
      setSaving(false);
    }
  };

  // Helper function to determine if a field is a dropdown
  const isDropdownFieldType = (field: InputField): boolean => {
    return field.type === 'dropdown' || [
      'panel_manufacturer', 'panel_model', 'battery_manufacturer', 'battery_model',
      'solar_inverter_manufacturer', 'solar_inverter_model',
      'battery_inverter_manufacturer', 'battery_inverter_model'
    ].includes(field.id);
  };

  // Helper function to get field section for grouping (matching image order)
  const getFieldSection = (fieldId: string): string => {
    // 1. CURRENT ELECTRICITY TARIFF (Flux specific - based on Energy Use radio)
    if (fieldId.startsWith('current_') || fieldId === 'current_single_peak_rate' || fieldId === 'current_off_peak_rate' || fieldId === 'current_off_peak_hours') return 'current_tariff';
    // 2. ELECTRICITY CONSUMPTION (Flux specific - no New Tariff or Export Tariff)
    if (fieldId.includes('annual') || fieldId === 'standing_charge' || fieldId === 'total_annual_spend' || fieldId === 'peak_annual_spend' || fieldId === 'off_peak_annual_spend') return 'consumption';
    // 3. EXISTING SYSTEM
    if (fieldId.startsWith('existing_') || fieldId.startsWith('approximate_') || fieldId.startsWith('sem_') || fieldId.startsWith('commissioning_') || fieldId.startsWith('percentage_')) return 'existing_system';
    // 4. SOLAR section (at the bottom)
    if (fieldId.startsWith('panel_') || fieldId === 'number_of_arrays') return 'solar';
    // 5. BATTERY section
    if (fieldId.startsWith('battery_') && !fieldId.includes('inverter')) return 'battery';
    // 6. SOLAR/HYBRID INVERTER section
    if (fieldId.startsWith('solar_inverter_')) return 'solar_hybrid';
    // 7. BATTERY INVERTER section
    if (fieldId.startsWith('battery_inverter_')) return 'battery_inverter';
    // Other fields
    return 'other';
  };

  // Helper function to get section display name
  const getSectionDisplayName = (section: string): string => {
    const sectionNames: Record<string, string> = {
      'current_tariff': 'CURRENT ELECTRICITY TARIFF',
      'consumption': 'ELECTRICITY CONSUMPTION',
      'existing_system': 'EXISTING SYSTEM',
      'solar': 'SOLAR',
      'battery': 'BATTERY',
      'solar_hybrid': 'SOLAR/HYBRID INVERTER',
      'battery_inverter': 'BATTERY INVERTER',
    };
    return sectionNames[section] || 'OTHER';
  };

  // Helper function to get original field order from field definitions
  const getFieldOrder = (fieldId: string): number => {
    // Import the field definitions to get original order
    const { EPVS_DYNAMIC_INPUT_FIELDS } = require('../config/epvsDynamicInputFields');
    const index = EPVS_DYNAMIC_INPUT_FIELDS.findIndex((f: any) => f.id === fieldId);
    return index >= 0 ? index : 9999; // If not found, put at end
  };

  // Helper function to sort fields matching the exact image order (Flux):
  // 1. CURRENT ELECTRICITY TARIFF
  // 2. ELECTRICITY CONSUMPTION
  // 3. EXISTING SYSTEM
  // 4. SOLAR (at bottom)
  // 5. BATTERY
  // 6. SOLAR/HYBRID INVERTER
  // 7. BATTERY INVERTER
  const sortFields = (fields: InputField[]): InputField[] => {
    return [...fields].sort((a, b) => {
      const aSection = getFieldSection(a.id);
      const bSection = getFieldSection(b.id);
      const aOrder = getFieldOrder(a.id);
      const bOrder = getFieldOrder(b.id);
      
      // Exact section order matching the image (Flux)
      const sectionOrder = [
        'current_tariff',   // 1. CURRENT ELECTRICITY TARIFF
        'consumption',       // 2. ELECTRICITY CONSUMPTION
        'existing_system',   // 3. EXISTING SYSTEM
        'solar',            // 4. SOLAR (at bottom)
        'battery',          // 5. BATTERY
        'solar_hybrid',     // 6. SOLAR/HYBRID INVERTER
        'battery_inverter', // 7. BATTERY INVERTER
        'other'             // Other fields
      ];
      
      const aSectionIndex = sectionOrder.indexOf(aSection);
      const bSectionIndex = sectionOrder.indexOf(bSection);
      
      // If different sections, sort by section order
      if (aSectionIndex !== bSectionIndex) {
        return aSectionIndex - bSectionIndex;
      }
      
      // Same section, maintain original order from field definitions
      return aOrder - bOrder;
    });
  };

  // Helper function to group fields by section for rendering with headers
  const groupFieldsBySection = (fields: InputField[]): Array<{section: string; sectionName: string; fields: InputField[]}> => {
    const sortedFields = sortFields(fields);
    const grouped = new Map<string, InputField[]>();
    
    sortedFields.forEach(field => {
      const section = getFieldSection(field.id);
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(field);
    });
    
    // Convert to array with section names, maintaining order
    const sectionOrder = [
      'current_tariff', 'consumption', 'existing_system', 'solar', 'battery', 'solar_hybrid', 'battery_inverter', 'other'
    ];
    
    return sectionOrder
      .filter(section => grouped.has(section))
      .map(section => ({
        section,
        sectionName: getSectionDisplayName(section),
        fields: grouped.get(section)!
      }));
  };

  const renderInputField = (field: InputField) => {
    const value = inputValues[field.id] || '';

    // Debug: Log all field properties and current value
    console.log(`🔍 EPVSDynamicInputsScreen: Rendering field ${field.id}:`, {
      type: field.type,
      hasDropdownOptions: !!field.dropdownOptions,
      dropdownOptionsLength: field.dropdownOptions?.length || 0,
      enabled: field.enabled,
      currentValue: value,
      inputValues: inputValues
    });

    // Handle date fields FIRST (before dropdown check)
    if (field.type === 'date') {
      // Parse the date value if it exists, otherwise use today
      const currentDate = value ? new Date(value) : new Date();
      
      // Format date for display (DD/MM/YYYY)
      const formatDate = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      // For web, use HTML5 date input via createElement
      if (Platform.OS === 'web') {
        return (
          <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <View
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.secondaryBackground,
                  borderColor: theme.cardBorder,
                  overflow: 'hidden',
                },
                !field.enabled && styles.disabledInput
              ]}
            >
              {React.createElement('input', {
                type: 'date',
                value: value || '',
                onChange: (e: any) => {
                  if (field.enabled && e.target.value) {
                    handleInputChange(field.id, e.target.value);
                  }
                },
                disabled: !field.enabled,
                style: {
                  width: '100%',
                  height: '100%',
                  padding: '12px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: field.enabled ? theme.primaryText : theme.tertiaryText,
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  cursor: field.enabled ? 'pointer' : 'not-allowed',
                  opacity: field.enabled ? 1 : 0.6,
                }
              })}
            </View>
          </View>
        );
      }

      // For mobile platforms, use TouchableOpacity with date picker modal
      return (
        <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
            {field.label}
            {field.required && <Text style={styles.required}> *</Text>}
          </Text>
          <TouchableOpacity
            style={[
              styles.textInput,
              { 
                backgroundColor: theme.secondaryBackground, 
                borderColor: theme.cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 12,
              },
              !field.enabled && styles.disabledInput
            ]}
            onPress={() => {
              if (field.enabled) {
                const dateValue = value ? new Date(value) : new Date();
                setDatePickerField(field.id);
                setDatePickerValue(dateValue);
                setShowDatePicker(true);
              }
            }}
            disabled={!field.enabled}
          >
            <Text style={[
              { color: field.enabled ? theme.primaryText : theme.tertiaryText, flex: 1 },
              !value && { color: theme.tertiaryText }
            ]}>
              {value ? formatDate(new Date(value)) : `Select ${field.label.toLowerCase()}`}
            </Text>
            {field.enabled && (
              <Ionicons name="calendar-outline" size={20} color={theme.primaryText} style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Number field with dropdown (primary) + override (secondary) — same as Off-Peak tariff fields
    if (
      field.type === 'number' &&
      field.dropdownOptions &&
      field.dropdownOptions.length > 0 &&
      field.allowOverride
    ) {
      const options = field.dropdownOptions;
      const isValueInOptions = value && options.includes(value);
      return (
        <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
            {field.label}
            {field.required && <Text style={styles.required}> *</Text>}
          </Text>
          <TouchableOpacity
            style={[
              styles.dropdownContainer,
              { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder },
              !field.enabled && styles.disabledDropdownContainer
            ]}
            onPress={() => {
              if (!field.enabled) return;
              setOpenDropdown(field.id);
              setShowDropdownModal(true);
            }}
          >
            <Text style={[styles.dropdownText, { color: theme.primaryText }, !value && styles.placeholder]}>
              {value ? (isValueInOptions ? value : `Custom: ${value}`) : 'Select from list...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.tertiaryText} />
          </TouchableOpacity>
          <Text style={{ color: theme.secondaryText, fontSize: 12, marginTop: 8, marginBottom: 4 }}>Or enter custom value</Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder, color: theme.primaryText, minHeight: 44, paddingVertical: 10 },
              !field.enabled && styles.disabledInput
            ]}
            value={value}
            onChangeText={(text) => handleInputChange(field.id, text)}
            placeholder="Override (optional)"
            placeholderTextColor={theme.tertiaryText}
            keyboardType="numeric"
            editable={field.enabled}
          />
          {field.helperText ? (
            <Text style={{ color: theme.secondaryText, marginTop: 4, fontSize: 13 }}>{field.helperText}</Text>
          ) : null}
        </View>
      );
    }

    // Check if this is a dropdown field (either by type or by field ID)
    const isDropdownField = isDropdownFieldType(field);

    if (isDropdownField) {
      console.log(`Rendering EPVS dropdown for ${field.id} (type: ${field.type})`);
      
      // If field is disabled, render as disabled text field instead of dropdown
      if (!field.enabled) {
        return (
          <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}> 
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}
              value={value}
              placeholder="Field disabled based on template selection"
              editable={false}
            />
          </View>
        );
      }
      
      // Get options from field - no defaults, only use what comes from backend
      const options = field.dropdownOptions || [];
      
      console.log(`Options for EPVS ${field.id}:`, options);
      
      const isOpen = openDropdown === field.id;
      const isSolarInverterField = field.id === 'solar_inverter_manufacturer' || field.id === 'solar_inverter_model';

      return (
        <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}> 
          <View style={styles.labelWithHelpContainer}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {isSolarInverterField && (
              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => setShowInverterHelpModal(true)}
              >
                <Ionicons name="help-circle" size={20} color={theme.accent} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[styles.dropdownContainer, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }, !field.enabled && styles.disabledDropdownContainer]}
            onPress={async () => {
                // Don't allow opening dropdown for disabled fields
              if (!field.enabled) {
                  console.log(`Cannot open dropdown for disabled field: ${field.id}`);
                return;
              }
                
                // Lazy load dropdown options if not already loaded
                if (options.length === 0) {
                  console.log(`⚡ Loading dropdown options for ${field.id} on-demand...`);
                  
                  // For panel_manufacturer, use local config
                  if (field.id === 'panel_manufacturer') {
                    console.log(`Using local panel manufacturers config`);
                    // Store options in pending state for immediate access
                    setPendingDropdownOptions(prev => ({
                      ...prev,
                      [field.id]: PANEL_MANUFACTURERS
                    }));
                    // Update state
                    setInputFields(prev => prev.map(f => 
                      f.id === field.id 
                        ? { ...f, dropdownOptions: PANEL_MANUFACTURERS }
                        : f
                    ));
                    // Open modal immediately
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                  } 
                  // For panel_model, check if we have a manufacturer selected
                  else if (field.id === 'panel_model') {
                    const manufacturerValue = inputValues['panel_manufacturer'];
                    if (manufacturerValue) {
                      const panelModels = getPanelModels(manufacturerValue);
                      console.log(`Using local panel models for ${manufacturerValue}:`, panelModels);
                      // Store options in pending state for immediate access
                      setPendingDropdownOptions(prev => ({
                        ...prev,
                        [field.id]: panelModels
                      }));
                      setInputFields(prev => prev.map(f => 
                        f.id === field.id 
                          ? { ...f, dropdownOptions: panelModels }
                          : f
                      ));
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    } else {
                      console.warn(`⚠️ No manufacturer selected for panel_model`);
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    }
                  }
                  // For battery_manufacturer, use local config
                  else if (field.id === 'battery_manufacturer') {
                    console.log(`Using local battery manufacturers config`);
                    // Store options in pending state for immediate access
                    setPendingDropdownOptions(prev => ({
                      ...prev,
                      [field.id]: BATTERY_MANUFACTURERS
                    }));
                    setInputFields(prev => prev.map(f => 
                      f.id === field.id 
                        ? { ...f, dropdownOptions: BATTERY_MANUFACTURERS }
                        : f
                    ));
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                  }
                  // For battery_model, check if we have a manufacturer selected
                  else if (field.id === 'battery_model') {
                    const manufacturerValue = inputValues['battery_manufacturer'];
                    if (manufacturerValue) {
                      const batteryModels = getBatteryModels(manufacturerValue);
                      console.log(`Using local battery models for ${manufacturerValue}:`, batteryModels);
                      // Store options in pending state for immediate access
                      setPendingDropdownOptions(prev => ({
                        ...prev,
                        [field.id]: batteryModels
                      }));
                      setInputFields(prev => prev.map(f => 
                        f.id === field.id 
                          ? { ...f, dropdownOptions: batteryModels }
                          : f
                      ));
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    } else {
                      console.warn(`⚠️ No manufacturer selected for battery_model`);
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    }
                  }
                  // For solar_inverter_manufacturer, use local config
                  else if (field.id === 'solar_inverter_manufacturer') {
                    console.log(`Using local solar inverter manufacturers config`);
                    // Store options in pending state for immediate access
                    setPendingDropdownOptions(prev => ({
                      ...prev,
                      [field.id]: SOLAR_INVERTER_MANUFACTURERS
                    }));
                    setInputFields(prev => prev.map(f => 
                      f.id === field.id 
                        ? { ...f, dropdownOptions: SOLAR_INVERTER_MANUFACTURERS }
                        : f
                    ));
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                  }
                  // For solar_inverter_model, check if we have a manufacturer selected
                  else if (field.id === 'solar_inverter_model') {
                    const manufacturerValue = inputValues['solar_inverter_manufacturer'];
                    if (manufacturerValue) {
                      const solarInverterModels = getSolarInverterModels(manufacturerValue);
                      console.log(`Using local solar inverter models for ${manufacturerValue}:`, solarInverterModels);
                      // Store options in pending state for immediate access
                      setPendingDropdownOptions(prev => ({
                        ...prev,
                        [field.id]: solarInverterModels
                      }));
                      setInputFields(prev => prev.map(f => 
                        f.id === field.id 
                          ? { ...f, dropdownOptions: solarInverterModels }
                          : f
                      ));
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    } else {
                      console.warn(`⚠️ No manufacturer selected for solar_inverter_model`);
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    }
                  }
                  // For battery_inverter_manufacturer, use local config
                  else if (field.id === 'battery_inverter_manufacturer') {
                    console.log(`Using local battery inverter manufacturers config`);
                    // Store options in pending state for immediate access
                    setPendingDropdownOptions(prev => ({
                      ...prev,
                      [field.id]: BATTERY_INVERTER_MANUFACTURERS
                    }));
                    setInputFields(prev => prev.map(f => 
                      f.id === field.id 
                        ? { ...f, dropdownOptions: BATTERY_INVERTER_MANUFACTURERS }
                        : f
                    ));
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                  }
                  // For battery_inverter_model, check if we have a manufacturer selected
                  else if (field.id === 'battery_inverter_model') {
                    const manufacturerValue = inputValues['battery_inverter_manufacturer'];
                    if (manufacturerValue) {
                      const batteryInverterModels = getBatteryInverterModels(manufacturerValue);
                      console.log(`Using local battery inverter models for ${manufacturerValue}:`, batteryInverterModels);
                      // Store options in pending state for immediate access
                      setPendingDropdownOptions(prev => ({
                        ...prev,
                        [field.id]: batteryInverterModels
                      }));
                      setInputFields(prev => prev.map(f => 
                        f.id === field.id 
                          ? { ...f, dropdownOptions: batteryInverterModels }
                          : f
                      ));
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    } else {
                      console.warn(`⚠️ No manufacturer selected for battery_inverter_model`);
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    }
                  }
                  // For other dropdowns, fetch from backend
                  else {
                  try {
                    const { api } = await import('../utils/api');
                    
                    // Fetch options for this specific field
                    const response = await api.get(`/epvs-automation/dropdown-options/${opportunityId}?templateFileName=${templateFileName}&fieldId=${field.id}`);
                    
                    const result = response.data as any;
                    if (result.success && result.options && result.options.length > 0) {
                      // Store options in pending state for immediate access
                      setPendingDropdownOptions(prev => ({
                        ...prev,
                        [field.id]: result.options
                      }));
                      // Update the field with loaded options
                      setInputFields(prev => prev.map(f => 
                        f.id === field.id 
                          ? { ...f, dropdownOptions: result.options }
                          : f
                      ));
                      console.log(`✅ Loaded ${result.options.length} options for ${field.id}`);
                      // Now open the dropdown with loaded options
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    } else {
                      console.warn(`⚠️ No options found for ${field.id}`);
                      // Open anyway, even if empty
                      setOpenDropdown(field.id);
                      setShowDropdownModal(true);
                    }
                  } catch (error) {
                    console.warn(`⚠️ Failed to load options for ${field.id}:`, error);
                    // Open anyway, even if error
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                    }
                  }
                } else {
                  // Options already loaded, just open dropdown
                console.log(`Opening EPVS dropdown for ${field.id} with ${options.length} options`);
              setOpenDropdown(field.id);
              setShowDropdownModal(true);
                }
            }}
          >
            <Text style={[styles.dropdownText, { color: theme.primaryText }, !value && styles.placeholder]}>
              {value || 'Select an option...'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={theme.tertiaryText}
            />
          </TouchableOpacity>
            
          </View>
        </View>
      );
    }

    return (
      <View key={field.id} style={[styles.inputCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}> 
        <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
          {field.label}
          {field.required && <Text style={styles.required}> *</Text>}
        </Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder, color: theme.primaryText }, !field.enabled && styles.disabledInput]}
          value={value}
          onChangeText={(text) => handleInputChange(field.id, text)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          placeholderTextColor={theme.tertiaryText}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          editable={field.enabled}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading Flux input fields...</Text>
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
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Flux Inputs</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Configure calculation parameters
              </Text>
            </View>
          </View>
        </View>
        
        {/* Customer Information - Always show if available from JSON or route params */}
        {(() => {
          // Use customerInfo state if available (set from JSON), otherwise try route params
          const displayCustomerInfo = customerInfo || 
            (customerDetails && typeof customerDetails === 'object' && {
              name: customerDetails.customerName || 'Customer',
              postcode: customerDetails.postcode || 'N/A'
            });
          
          // Always show customer info if we have a name or postcode (even if one is missing)
          if (displayCustomerInfo && (displayCustomerInfo.name || displayCustomerInfo.postcode)) {
            return (
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerInfoLeft}>
              <Feather name="user" size={16} color={theme.primaryButton} />
              <Text style={[styles.customerName, { color: theme.primaryText }]}>
                    {displayCustomerInfo.name || 'Customer'}
              </Text>
            </View>
            <View style={styles.customerInfoRight}>
              <Feather name="map-pin" size={16} color={theme.secondaryText} />
              <Text style={[styles.customerPostcode, { color: theme.secondaryText }]}>
                    {displayCustomerInfo.postcode || 'N/A'}
              </Text>
            </View>
          </View>
            );
          }
          return null;
        })()}
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
          { paddingBottom: 100 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 120,
          }
        ]}
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
              <Feather name="edit-3" size={32} color={theme.primaryButton} />
            </View>
            <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Input Fields</Text>
            <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
              Complete the required fields to generate your calculation
            </Text>
          </View>

          {/* Progress automatically restored on load - no manual restore button needed */}

          {/* Customer Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                <Feather name="user" size={20} color={theme.primaryButton} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>{customerDetails.customerName}</Text>
                <Text style={[styles.summarySubtitle, { color: theme.secondaryText }]}>{customerDetails.address}</Text>
              </View>
            </View>
            {templateFileName && (
              <View style={styles.templateBadge}>
                <Feather name="file" size={12} color={theme.tertiaryText} />
                <Text style={[styles.templateBadgeText, { color: theme.tertiaryText }]}>{templateFileName}</Text>
              </View>
            )}
          </View>



          {inputFields.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text" size={48} color={theme.tertiaryText} />
              <Text style={[styles.emptyStateText, { color: theme.secondaryText }]}>No input fields available</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.tertiaryText }]}>
                All input fields are currently disabled based on your template selection.
              </Text>
            </View>
          ) : (
            <>
              {/* Enabled Fields - Grouped by Section */}
              {inputFields.filter(field => field.enabled).length > 0 && (
                <>
                  {groupFieldsBySection(inputFields.filter(field => field.enabled)).map(({ section, sectionName, fields }) => (
                    <View key={section}>
                      <View style={[styles.sectionHeaderGroup, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: theme.primaryText, fontWeight: 'bold', fontSize: width < 768 ? 14 : 16, marginBottom: 0, textAlign: 'left' }]}>{sectionName}</Text>
                  </View>
                      {fields.map(renderInputField)}
                    </View>
                  ))}
                </>
              )}
              
              {/* Disabled Fields - Grouped by Section */}
              {inputFields.filter(field => !field.enabled).length > 0 && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.tertiaryText }]}>Disabled Fields</Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.tertiaryText }]}>
                      {inputFields.filter(field => !field.enabled).length} fields disabled by template
                    </Text>
                  </View>
                  <Text style={[styles.disabledFieldsExplanation, { color: theme.tertiaryText }]}>
                    These fields are disabled based on your template selection. They will be automatically calculated or are not applicable for your chosen system configuration.
                  </Text>
                  {groupFieldsBySection(inputFields.filter(field => !field.enabled)).map(({ section, sectionName, fields }) => (
                    <View key={section}>
                      <View style={[styles.sectionHeaderGroup, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.sectionTitle, { color: theme.tertiaryText, fontWeight: 'bold', fontSize: width < 768 ? 14 : 16, marginBottom: 0, textAlign: 'left' }]}>{sectionName}</Text>
                      </View>
                      {fields.map(renderInputField)}
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdownModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDropdownModal(false);
          setOpenDropdown(null);
          // Clear pending options when closing
          if (openDropdown) {
            setPendingDropdownOptions(prev => {
              const updated = { ...prev };
              delete updated[openDropdown];
              return updated;
            });
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Select {openDropdown ? inputFields.find(f => f.id === openDropdown)?.label : 'Option'}
            </Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {openDropdown && (() => {
                const field = inputFields.find(f => f.id === openDropdown);
                // Check for options in state first, then pending options, then empty array
                const options = field?.dropdownOptions || pendingDropdownOptions[openDropdown] || [];
                
                return options.map((option, index) => (
                  <TouchableOpacity
                    key={`${openDropdown}-${option}-${index}`}
                    style={[
                      styles.modalOption,
                      { 
                        borderBottomColor: theme.cardBorder,
                        backgroundColor: inputValues[openDropdown] === option ? theme.primaryButton + '20' : 'transparent'
                      }
                    ]}
                    onPress={() => {
                      handleInputChange(openDropdown, option);
                      setShowDropdownModal(false);
                      setOpenDropdown(null);
                      // Clear pending options after selection
                      setPendingDropdownOptions(prev => {
                        const updated = { ...prev };
                        delete updated[openDropdown];
                        return updated;
                      });
                    }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      { 
                        color: inputValues[openDropdown] === option ? theme.primaryButton : theme.primaryText,
                        fontWeight: inputValues[openDropdown] === option ? '600' : '400'
                      }
                    ]}>
                      {option}
                    </Text>
                    {inputValues[openDropdown] === option && (
                      <Feather name="check" size={20} color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
              onPress={() => {
                setShowDropdownModal(false);
                setOpenDropdown(null);
                // Clear pending options when closing
                if (openDropdown) {
                  setPendingDropdownOptions(prev => {
                    const updated = { ...prev };
                    delete updated[openDropdown];
                    return updated;
                  });
                }
              }}
            >
              <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal/Component - Only for mobile platforms */}
      {Platform.OS !== 'web' && showDatePicker && datePickerField && DateTimePicker && (
        <>
          {Platform.OS === 'ios' ? (
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => {
                setShowDatePicker(false);
                setDatePickerField(null);
              }}
            >
              <View style={styles.datePickerModalOverlay}>
                <View style={[styles.datePickerModalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  <View style={styles.datePickerHeader}>
                    <Text style={[styles.datePickerTitle, { color: theme.primaryText }]}>
                      Select Date
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDatePicker(false);
                        setDatePickerField(null);
                      }}
                    >
                      <Ionicons name="close" size={24} color={theme.primaryText} />
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display="spinner"
                    onChange={(event: any, selectedDate?: Date) => {
                      if (Platform.OS === 'ios') {
                        if (selectedDate) {
                          setDatePickerValue(selectedDate);
                        }
                      }
                    }}
                    style={{ backgroundColor: theme.cardBackground }}
                    textColor={theme.primaryText}
                  />
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={[styles.datePickerCancelButton, { borderColor: theme.cardBorder }]}
                      onPress={() => {
                        setShowDatePicker(false);
                        setDatePickerField(null);
                      }}
                    >
                      <Text style={[styles.datePickerButtonText, { color: theme.secondaryText }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.datePickerConfirmButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => {
                        if (datePickerField) {
                          // Format date as ISO string (YYYY-MM-DD) for storage
                          const isoDate = datePickerValue.toISOString().split('T')[0];
                          handleInputChange(datePickerField, isoDate);
                        }
                        setShowDatePicker(false);
                        setDatePickerField(null);
                      }}
                    >
                      <Text style={[styles.datePickerButtonText, { color: '#ffffff' }]}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="default"
              onChange={(event: any, selectedDate?: Date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate && datePickerField) {
                  // Format date as ISO string (YYYY-MM-DD) for storage
                  const isoDate = selectedDate.toISOString().split('T')[0];
                  handleInputChange(datePickerField, isoDate);
                }
                setDatePickerField(null);
              }}
            />
          )}
        </>
      )}

      {/* Validation Error Modal */}
      <Modal
        visible={showValidationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowValidationModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.validationModalHeader}>
              <View style={[styles.validationIcon, { backgroundColor: '#ef4444' + '20' }]}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
              </View>
              <Text style={[styles.validationModalTitle, { color: theme.primaryText }]}>
                Validation Error
              </Text>
            </View>
            
            <ScrollView style={styles.validationModalScrollView} showsVerticalScrollIndicator={true}>
              {validationErrors.missingFields.length > 0 && (
                <View style={styles.validationSection}>
                  <Text style={[styles.validationSectionTitle, { color: theme.primaryText }]}>
                    Missing Required Fields:
                  </Text>
                  {validationErrors.missingFields.map((field, index) => (
                    <View key={index} style={styles.validationFieldItem}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text style={[styles.validationFieldText, { color: theme.primaryText }]}>
                        {field}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {validationErrors.invalidFields.length > 0 && (
                <View style={[styles.validationSection, validationErrors.missingFields.length > 0 && styles.validationSectionWithMargin]}>
                  <Text style={[styles.validationSectionTitle, { color: theme.primaryText }]}>
                    Invalid Number Fields:
                  </Text>
                  {validationErrors.invalidFields.map((field, index) => (
                    <View key={index} style={styles.validationFieldItem}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                      <Text style={[styles.validationFieldText, { color: theme.primaryText }]}>
                        {field}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.validationModalButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => {
                setShowValidationModal(false);
              }}
            >
              <Text style={styles.validationModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Solar/Hybrid Inverter Help Modal */}
      <Modal
        visible={showInverterHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInverterHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.helpModalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.helpModalHeader}>
              <Ionicons name="videocam" size={32} color={theme.accent} />
              <Text style={[styles.helpModalTitle, { color: theme.primaryText }]}>
                Solar/Hybrid Inverter Guide
              </Text>
            </View>
            <Text style={[styles.helpModalDescription, { color: theme.secondaryText }]}>
              Watch this video tutorial to learn about selecting the right solar/hybrid inverter for your installation.
            </Text>
            <TouchableOpacity
              style={[styles.watchVideoButton, { backgroundColor: '#FF0000' }]}
              onPress={() => {
                Linking.openURL('https://www.youtube.com/watch?v=y7PbP45moQo');
              }}
            >
              <Ionicons name="logo-youtube" size={24} color="#ffffff" />
              <Text style={styles.watchVideoButtonText}>Watch on YouTube</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.helpModalCloseButton, { borderColor: theme.cardBorder }]}
              onPress={() => setShowInverterHelpModal(false)}
            >
              <Text style={[styles.helpModalCloseText, { color: theme.secondaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
        {/* Skip Button - Only show if user has inputs AND we restored progress AND no changes from saved state */}
        {(() => {
          const hasInputValues = Object.values(inputValues).some(value => value && value.toString().trim() !== '');
          const canSkip = hasInputValues && hasRestoredProgress && savedInputValues && !hasChanges();
          
          console.log('🔍 EPVS Skip button conditions:', {
            hasInputValues,
            hasRestoredProgress,
            hasSavedInputValues: !!savedInputValues,
            hasChanges: hasChanges(),
            canSkip
          });
          
          return canSkip;
        })() && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.skipButton, { 
                borderColor: theme.dangerButton,
                backgroundColor: theme.dangerButton + '10'
              }]}
              onPress={() => {
                console.log('🔍 EPVS Skip button pressed - navigating to SolarArraysInputs');
                // Skip directly to SolarArraysInputs screen
                (navigation as any).navigate('SolarArraysInputs', {
                  opportunityId,
                  templateFileName,
                  customerDetails,
                  selectedTemplateOptions,
                  calculatorType: calculatorType,
                });
              }}
              activeOpacity={0.8}
            >
              <Feather name="skip-forward" size={16} color={theme.dangerButton} />
              <Text style={[styles.skipButtonText, { color: theme.dangerButton }]}>
                Skip
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Button */}
        {inputFields.length > 0 && (
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primaryButton }, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save & Calculate</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

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
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  inputCard: {
    borderRadius: 20,
    padding: width < 768 ? 20 : 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // Extra spacing for web
      minHeight: 100, // Ensure input cards have minimum height
    }),
  },
  inputLabel: {
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  required: {
    color: '#ef4444',
  },
  textInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 56,
    fontWeight: '500',
  },
  dropdownContainer: {
    borderWidth: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  placeholder: {
    opacity: 0.6,
  },
  disabledInput: {
    opacity: 0.6,
  },
  disabledDropdownContainer: {
    opacity: 0.6,
  },
  dropdownWrapper: {
    position: 'relative',
  },
  footer: {
    padding: width < 768 ? 20 : 24,
    borderTopWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      paddingBottom: 40, // Extra padding for web
      minHeight: 80, // Ensure footer has minimum height
      marginBottom: 65, // Add margin for BottomNavigation on web
    }),
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  saveButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
    flex: 1,
  },
  modalCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledFieldsExplanation: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
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
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  
  // Summary Card
  summaryCard: {
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
      minHeight: 120, // Ensure summary card has minimum height
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryIcon: {
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
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  summarySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    gap: 4,
  },
  templateBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  
  // Section Header
  sectionHeader: {
    marginBottom: 24,
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' && {
      marginBottom: 32, // Extra spacing for web
      minHeight: 60, // Ensure section headers have minimum height
    }),
  },
  sectionHeaderGroup: {
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginTop: 32,
      marginBottom: 24,
    }),
  },
  sectionSubtitle: {
    fontSize: 15,
    marginTop: 6,
    lineHeight: 20,
  },
  // Date Picker Styles
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Validation Modal Styles
  validationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  validationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  validationModalScrollView: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  validationSection: {
    marginBottom: 16,
  },
  validationSectionWithMargin: {
    marginTop: 8,
  },
  validationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  validationFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  validationFieldText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  validationModalButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  validationModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Label with Help Button
  labelWithHelpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  helpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Help Modal Styles
  helpModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  helpModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  helpModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  helpModalDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  watchVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  watchVideoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpModalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  helpModalCloseText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
