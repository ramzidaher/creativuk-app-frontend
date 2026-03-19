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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import ManualInputFieldsManager from '../components/ManualInputFieldsManager';
import { BATTERY_INVERTER_MANUFACTURERS, getBatteryInverterModels } from '../config/batteryInverterOptions';
import { BATTERY_MANUFACTURERS, getBatteryModels } from '../config/batteryOptions';
import { getEnabledFields, toInputField } from '../config/dynamicInputFields';
import { isFieldDisabled } from '../config/inputFieldRules';
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

const { width, height } = Dimensions.get('window');

interface InputField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date';
  value: string;
  required: boolean;
  enabled: boolean;
  cellReference: string;
  dropdownOptions?: string[];
  /** When true with dropdownOptions, user can pick from list or type a custom value */
  allowOverride?: boolean;
  /** Shown below the field (e.g. "Use current rates") */
  helperText?: string;
}

interface RouteParams {
  opportunityId: string;
  customerDetails: {
    customerName: string;
    address: string;
    postcode: string;
  };
  selectedOptions?: Record<string, string>; // Add selected radio button options
  templateFileName?: string; // Add selected template file
  selectedTemplateOptions?: {
    solar: boolean;
    solarHybrid: boolean;
    batteryInverter: boolean;
    battery?: boolean;
  }; // Add template selection options
  calculatorType?: 'flux' | 'off-peak' | 'epvs'; // Calculator type for field visibility rules
}

export default function DynamicInputsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  
  // Get params from route, handling both navigation params and URL params
  const rawParams = route.params as RouteParams;
  
  // Get opportunityId from route params or URL
  const opportunityIdFromParams = rawParams?.opportunityId;
  const opportunityIdFromUrl = (route.params as any)?.opportunityId || 
    (Platform.OS === 'web' && typeof window !== 'undefined' 
      ? window.location.pathname.split('/dynamic-inputs/')[1]?.split('?')[0] 
      : null);
  
  const opportunityId = opportunityIdFromParams || opportunityIdFromUrl;
  
  // Check if params are valid (not [object Object])
  const isValidObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    const str = String(obj);
    return str !== '[object Object]' && str !== 'object Object';
  };
  
  // Get params, falling back to empty objects if invalid
  const customerDetails = isValidObject(rawParams?.customerDetails) 
    ? rawParams.customerDetails 
    : (rawParams?.customerDetails || { customerName: '', address: '', postcode: '' });
  
  const selectedOptions = isValidObject(rawParams?.selectedOptions) 
    ? rawParams.selectedOptions || {} 
    : {};
  
  const templateFileName = typeof rawParams?.templateFileName === 'string' 
    ? rawParams.templateFileName 
    : undefined;
  
  const selectedTemplateOptions = isValidObject(rawParams?.selectedTemplateOptions)
    ? rawParams.selectedTemplateOptions
    : undefined;
  
  const calculatorType = rawParams?.calculatorType || 'off-peak';
  
  // State for restored params from progress
  const [restoredParams, setRestoredParams] = useState<{
    customerDetails?: RouteParams['customerDetails'];
    selectedOptions?: Record<string, string>;
    templateFileName?: string;
    selectedTemplateOptions?: RouteParams['selectedTemplateOptions'];
  } | null>(null);

  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useManualMode, setUseManualMode] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [dropdownWarning, setDropdownWarning] = useState<string | null>(null);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedInputValues, setSavedInputValues] = useState<Record<string, string> | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<string | null>(null);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ missingFields: string[]; invalidFields: string[] }>({ missingFields: [], invalidFields: [] });
  const [showInverterHelpModal, setShowInverterHelpModal] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Default dropdown options fallback
  const getDefaultOptions = (fieldId: string): string[] => {
    // Return empty array instead of hardcoded defaults
    return [];
  };

  // Check if current input values match saved values
  const hasChanges = () => {
    if (!savedInputValues) {
      console.log('🔍 hasChanges: No saved input values available');
      return false;
    }
    
    console.log('🔍 hasChanges: Comparing current vs saved values');
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

  // Restore customer details immediately on mount (separate from init to show in UI quickly)
  useEffect(() => {
    const restoreCustomerDetails = async () => {
      if (!opportunityId) return;
      
      try {
        // Always restore customer details from JSON first (JSON is source of truth)
        const progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          calculatorType
        );
        
        if (progress && progress.customerDetails) {
          // Update restoredParams with customer details immediately
          setRestoredParams(prev => ({
            ...prev,
            customerDetails: progress.customerDetails
          }));
          console.log('✅ Customer details restored from JSON immediately in DynamicInputsScreen:', progress.customerDetails);
        } else if (customerDetails && isValidObject(customerDetails)) {
          // Fallback to route params if JSON doesn't have it
          setRestoredParams(prev => ({
            ...prev,
            customerDetails: customerDetails
          }));
          console.log('✅ Customer details set from route params (fallback) in DynamicInputsScreen');
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
        // Still try route params as fallback
        if (customerDetails && isValidObject(customerDetails)) {
          setRestoredParams(prev => ({
            ...prev,
            customerDetails: customerDetails
          }));
        }
      }
    };
    
    restoreCustomerDetails();
  }, [opportunityId, calculatorType, customerDetails]);

  useEffect(() => {
    const init = async () => {
      if (!opportunityId) {
        setError('Opportunity ID is required. Please navigate from the previous screen.');
        setLoading(false);
        return;
      }
      
      // If params are missing or invalid, try to restore from saved progress
      const needsRestore = !customerDetails?.customerName || 
                          !isValidObject(customerDetails) ||
                          !templateFileName ||
                          !isValidObject(selectedTemplateOptions);
      
      let restoredParamsLocal: {
        customerDetails?: RouteParams['customerDetails'];
        selectedOptions?: Record<string, string>;
        templateFileName?: string;
        selectedTemplateOptions?: RouteParams['selectedTemplateOptions'];
      } | null = null;
      
      if (needsRestore) {
        console.log('⚠️ Missing or invalid route params, attempting to restore from saved progress...');
        try {
          const progress = await CalculatorProgressService.restoreProgress(
            opportunityId,
            calculatorType
          );
          
          if (progress) {
            // Always restore customer details from JSON (even if route params exist, JSON is source of truth)
            const effectiveCustomerDetails = progress.customerDetails || customerDetails;
            
            // Restore missing params from progress
            restoredParamsLocal = {
              customerDetails: effectiveCustomerDetails, // Always use JSON customer details if available
              selectedOptions: progress.radioButtonSelections || selectedOptions,
              templateFileName: progress.templateSelection?.templateFileName || templateFileName,
              selectedTemplateOptions: progress.templateSelection?.selectedOptions || selectedTemplateOptions,
            };
            
            setRestoredParams(restoredParamsLocal);
            console.log('✅ Restored params from saved progress:', restoredParamsLocal);
            console.log('✅ Customer details from JSON:', effectiveCustomerDetails);
          } else {
            console.warn('⚠️ No saved progress found for opportunity:', opportunityId);
            // Set error if we can't proceed without required data
            if (!customerDetails?.customerName && !isValidObject(customerDetails)) {
              setError('Missing customer details. Please navigate from the previous screen or ensure progress is saved.');
            }
          }
        } catch (restoreError: any) {
          const errorMessage = restoreError?.message || String(restoreError);
          console.warn('⚠️ Could not restore params from progress:', errorMessage);
          
          // Check if it's a CORS error
          if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_FAILED')) {
            console.warn('⚠️ CORS error detected - backend may not allow requests from this origin');
            setError(
              'Unable to load saved progress due to CORS restrictions. ' +
              'The backend server needs to allow requests from http://localhost:8081. ' +
              'Fields will still load if navigation params are valid, or please use the normal navigation flow.'
            );
            // Don't block the screen completely - still try to fetch fields
          } else {
            // Other errors - still show the screen but warn user
            console.warn('⚠️ Progress restoration failed:', errorMessage);
          }
        }
      }
      
      // Restore radio button selections from saved progress if not in route params
      let effectiveSelectedOptions = selectedOptions;
      if (!effectiveSelectedOptions || Object.keys(effectiveSelectedOptions).length === 0) {
        try {
          const progress = await CalculatorProgressService.restoreProgress(
            opportunityId,
            calculatorType
          );
          if (progress && progress.radioButtonSelections) {
            effectiveSelectedOptions = progress.radioButtonSelections;
            console.log('✅ Restored radio button selections from progress:', effectiveSelectedOptions);
            // Update restoredParamsLocal with radio button selections
            if (restoredParamsLocal) {
              restoredParamsLocal.selectedOptions = effectiveSelectedOptions;
            } else {
              restoredParamsLocal = { selectedOptions: effectiveSelectedOptions };
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not restore radio button selections, using route params');
        }
      }
      
      // Restore dynamic inputs progress (non-blocking - errors won't stop the screen)
      try {
      await restoreProgress();
      } catch (progressError: any) {
        const errorMessage = progressError?.message || String(progressError);
        if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
          console.warn('⚠️ Could not restore input values due to CORS, but continuing...');
        } else {
          console.warn('⚠️ Could not restore input values:', errorMessage);
        }
        // Continue anyway - fields will be empty but user can still fill them
      }
      
      // Fetch dynamic inputs using restored params if available
      // Pass restoredParamsLocal directly to avoid race condition with state update
      await fetchDynamicInputs(restoredParamsLocal);
    };
    
    init();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [opportunityId]);

  // Re-fetch when restored params become available (only if fetchDynamicInputs wasn't called in init)
  useEffect(() => {
    if (restoredParams && !inputFields.length && opportunityId && !loading) {
      console.log('🔄 Restored params available, fetching dynamic inputs...');
      fetchDynamicInputs(restoredParams);
    }
  }, [restoredParams, opportunityId]);

  // Auto-save when input values change
  useEffect(() => {
    if (hasRestoredProgress && Object.keys(inputValues).length > 0) {
      autoSaveProgress();
    }
  }, [inputValues, hasRestoredProgress]);

  // Debug logging for inputValues state changes
  useEffect(() => {
    console.log('🔍 DynamicInputsScreen: inputValues state changed:', inputValues);
  }, [inputValues]);

  const restoreProgress = async () => {
    try {
      console.log('🔍 DynamicInputsScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType
      );
      
      if (progress && progress.dynamicInputs) {
        console.log('🔄 Auto-restoring input values from saved progress:', progress.dynamicInputs);
        
        // Ensure all values are strings and set them to display in the UI
        const restoredValues: Record<string, string> = {};
        Object.entries(progress.dynamicInputs).forEach(([key, value]) => {
          restoredValues[key] = value !== null && value !== undefined ? String(value) : '';
        });
        
        setInputValues(restoredValues);
        setSavedInputValues(restoredValues); // Store original values for comparison
        setHasRestoredProgress(true); // Only set to true if we actually restored progress
        console.log('✅ Dynamic input values restored and displayed in UI');
        console.log('🔍 Current inputValues state:', restoredValues);
        console.log('🔍 Saved input values for comparison:', restoredValues);
        
        // Store restored values for later use in fetchDynamicInputs
        (window as any).restoredInputValues = restoredValues;
      } else {
        console.log('ℹ️ No dynamic inputs progress found to restore');
        setHasRestoredProgress(false); // Set to false if no progress was found
        (window as any).restoredInputValues = null;
      }
    } catch (error) {
      console.error('Error restoring dynamic inputs progress:', error);
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
          console.log('✅ Dynamic inputs progress auto-saved');
        }
      }, 1000); // Save after 1 second of no changes
    } catch (error) {
      console.error('Error auto-saving dynamic inputs progress:', error);
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
          const response = await api.post('/excel-automation/get-dropdown-options', {
            opportunityId: opportunityId,
            fieldId: modelField,
            dependsOnValue: manufacturerValue,
          });

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

  const fetchDynamicInputs = async (restoredParamsOverride?: typeof restoredParams) => {
    try {
      setLoading(true);
      setError(null);

      console.log('⚡ Loading fields from saved progress (NO API calls)');
      
      // Use override params first (from direct call), then restored params from state, then route params
      const effectiveRestoredParams = restoredParamsOverride || restoredParams;
      const effectiveSelectedTemplateOptions = effectiveRestoredParams?.selectedTemplateOptions || selectedTemplateOptions;
      const effectiveCustomerDetails = effectiveRestoredParams?.customerDetails || customerDetails;
      const effectiveTemplateFileName = effectiveRestoredParams?.templateFileName || templateFileName;
      
      console.log('🔍 Template options:', effectiveSelectedTemplateOptions);
      console.log('🔍 Calculator type:', calculatorType);
      console.log('🔍 Template file:', effectiveTemplateFileName);
      
      // Get restored values from saved progress (set by restoreProgress)
      const restoredValues = (window as any).restoredInputValues || {};
      console.log('🔍 Restored input values:', restoredValues);
      
      // Get radio button selections from saved progress or route params
      const effectiveSelectedOptions = effectiveRestoredParams?.selectedOptions || restoredParams?.selectedOptions || selectedOptions;
      
      console.log('🔍 Radio button selections for field visibility:', effectiveSelectedOptions);
      console.log('🔍 Checking for "No Battery" selection:', effectiveSelectedOptions?.['🔋 Battery Type']);
      
      // Use client-side mapping to determine which fields to show based on template selections and radio button selections
      const enabledFieldDefinitions = getEnabledFields(
        effectiveSelectedTemplateOptions, 
        calculatorType,
        effectiveSelectedOptions // Pass radio button selections to check for "No Battery" selection
      );
      console.log(`⚡ Client-side mapping suggests ${enabledFieldDefinitions.length} fields for current template selection`);

      if (enabledFieldDefinitions.length === 0) {
        console.warn('⚠️ No fields found for current template selection');
        setError('No input fields available. Please check your template selection.');
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
        // Make all enabled fields required
        const field = toInputField(fieldDef, value, []);
        return {
          ...field,
          required: true // All enabled fields are required
        };
      });

      // Merge restored values with initial values to preserve all restored data
      const mergedValues = {
        ...restoredValues, // Start with all restored values
        ...initialValues   // Override with values from enabled fields (should be same, but ensure consistency)
      };

      // Initialize dropdown options if manufacturer/model values are restored
      const fieldsWithInitializedOptions = fieldsToShow.map(field => {
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
      console.log(`✅ Loaded ${fieldsWithInitializedOptions.length} input fields instantly from saved progress (${Object.keys(restoredValues).length} with saved values)`);
      
      // NOTE: Dropdown options will be loaded lazily when user interacts with dropdowns
      // This avoids API calls on initial load. Options can be fetched on-demand if needed.
      
    } catch (error) {
      console.error('Error loading dynamic inputs from saved progress:', error);
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
        console.log(`Updated ${dependentField} with ${panelModels.length} options from local config`);
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
        console.log(`Updated ${dependentField} with ${batteryModels.length} options from local config`);
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
        console.log(`Updated ${dependentField} with ${solarInverterModels.length} options from local config`);
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
        console.log(`Updated ${dependentField} with ${batteryInverterModels.length} options from local config`);
      } else {
        // For other cascading dropdowns (battery, inverters), fetch from backend
      try {
        console.log(`Fetching options for ${dependentField} based on ${fieldId} = ${value}`);
        
        const { api } = await import('../utils/api');
        const response = await api.post('/excel-automation/get-dropdown-options', {
          opportunityId: opportunityId,
          fieldId: dependentField,
          dependsOnValue: value,
        });

        const result = response.data as any;
        console.log(`Backend response for ${dependentField}:`, result);
        
        if (result.success && result.options) {
          // Update the field with new options
          setInputFields(prev => prev.map(field => 
            field.id === dependentField 
              ? { ...field, dropdownOptions: result.options }
              : field
          ));
          console.log(`Updated ${dependentField} with ${result.options.length} options`);
        } else {
          console.error(`Failed to get options for ${dependentField}:`, result.message);
        }
      } catch (error) {
        console.error('Error getting cascading dropdown options:', error);
        }
      }
    }
  };

  const saveProgress = async (values?: Record<string, string>) => {
    try {
      const effectiveCustomerDetails = restoredParams?.customerDetails || customerDetails;
      const effectiveSelectedOptions = restoredParams?.selectedOptions || selectedOptions;
      
      if (effectiveCustomerDetails && opportunityId) {
        // Debounce the save operation to avoid too many saves
        const currentValues = values || inputValues;
        
        // Only save if there are actual values to save
        if (Object.keys(currentValues).length > 0) {
          const progressData: any = {
            currentStep: 'dynamic-inputs' as const,
            dynamicInputs: currentValues,
            customerDetails: effectiveCustomerDetails,
            radioButtonSelections: effectiveSelectedOptions,
          };

          // Only include templateSelection if we have actual data
          const effectiveSelectedTemplateOptions = restoredParams?.selectedTemplateOptions || selectedTemplateOptions;
          const effectiveTemplateFileName = restoredParams?.templateFileName || templateFileName;
          
          if (effectiveSelectedTemplateOptions) {
            progressData.templateSelection = {
              selectedOptions: {
                ...effectiveSelectedTemplateOptions,
                battery: effectiveSelectedTemplateOptions.battery || false
              },
              templateFileName: effectiveTemplateFileName || '',
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
      console.error('Error saving progress:', error);
    }
  };

  const handleManualOverride = (fieldId: string, enabled: boolean) => {
    // This function is called when user manually overrides a field's enabled state
    console.log(`Manual override: ${fieldId} -> ${enabled}`);
    // You can add additional logic here if needed
  };




  const validateInputs = (): boolean => {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];
    
    for (const field of inputFields) {
      // In manual mode, check if field is actually enabled before validating
      const isActuallyEnabled = useManualMode ? 
        !isFieldDisabled(field.id, selectedOptions) : 
        field.enabled;
      
      if (isActuallyEnabled && field.required) {
        const value = inputValues[field.id];
        // Ensure value is a string and check if it's empty
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        if (!stringValue || stringValue.trim() === '') {
          missingFields.push(field.label);
        }
      }
      
      if (isActuallyEnabled && field.type === 'number' && inputValues[field.id]) {
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
    if (!validateInputs()) {
      return;
    }

    try {
      setSaving(true);

      console.log('🔄 Save & Calculate: Saving dynamic inputs to JSON (NO COM call)');
      
      // Save progress to JSON (NO COM call - Excel update happens on final submit)
      const progressData = {
        currentStep: 'dynamic-inputs' as const,
        dynamicInputs: inputValues,
        completedSteps: {
          'dynamic-inputs': true,
        },
      };
      
      await CalculatorProgressService.saveProgress(
        opportunityId,
        calculatorType,
        progressData
      );

      console.log('✅ Dynamic inputs saved to JSON, navigating to SolarArraysInputs...');
        
        // Mark the calculator step as completed in the workflow
        try {
          const { workflowApi } = await import('../utils/api');
          await workflowApi.completeStep(opportunityId, 3, {
            calculatorType: calculatorType,
            completedAt: new Date().toISOString(),
            savedInputs: inputValues
          });
          
          // Navigate to arrays page for "New Products - Solar"
          const effectiveTemplateFileName = restoredParams?.templateFileName || templateFileName;
          const effectiveCustomerDetails = restoredParams?.customerDetails || customerDetails;
          const effectiveSelectedTemplateOptions = restoredParams?.selectedTemplateOptions || selectedTemplateOptions;
          
          (navigation as any).navigate('SolarArraysInputs', {
            opportunityId,
            templateFileName: effectiveTemplateFileName,
            customerDetails: effectiveCustomerDetails,
            selectedTemplateOptions: effectiveSelectedTemplateOptions,
            calculatorType: calculatorType,
          });
        } catch (workflowError) {
          console.error('Error marking step as completed:', workflowError);
          const effectiveTemplateFileName = restoredParams?.templateFileName || templateFileName;
          const effectiveCustomerDetails = restoredParams?.customerDetails || customerDetails;
          const effectiveSelectedTemplateOptions = restoredParams?.selectedTemplateOptions || selectedTemplateOptions;
          
          (navigation as any).navigate('SolarArraysInputs', {
            opportunityId,
            templateFileName: effectiveTemplateFileName,
            customerDetails: effectiveCustomerDetails,
            selectedTemplateOptions: effectiveSelectedTemplateOptions,
            calculatorType: calculatorType,
          });
        }
    } catch (error) {
      console.error('Error saving inputs:', error);
      Alert.alert('Error', 'Network error while saving input values');
    } finally {
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
    // 1. CURRENT ELECTRICITY TARIFF (Off-Peak specific)
    if (fieldId.startsWith('current_')) return 'current_tariff';
    // 2. NEW ELECTRICITY TARIFF (Off-Peak specific)
    if (fieldId.startsWith('new_')) return 'new_tariff';
    // 3. ELECTRICITY CONSUMPTION
    if (fieldId.includes('annual') || fieldId === 'standing_charge' || fieldId === 'total_annual_spend' || fieldId === 'peak_annual_spend' || fieldId === 'off_peak_annual_spend') return 'consumption';
    // 4. EXPORT TARIFF (Off-Peak specific)
    if (fieldId === 'export_tariff_rate') return 'export_tariff';
    // 5. EXISTING SYSTEM
    if (fieldId.startsWith('existing_') || fieldId.startsWith('approximate_') || fieldId.startsWith('percentage_')) return 'existing_system';
    // 6. SOLAR section (at the bottom)
    if (fieldId.startsWith('panel_') || fieldId === 'number_of_arrays') return 'solar';
    // 7. BATTERY section
    if (fieldId.startsWith('battery_') && !fieldId.includes('inverter')) return 'battery';
    // 8. SOLAR/HYBRID INVERTER section
    if (fieldId.startsWith('solar_inverter_')) return 'solar_hybrid';
    // 9. BATTERY INVERTER section
    if (fieldId.startsWith('battery_inverter_')) return 'battery_inverter';
    // Other fields
    return 'other';
  };

  // Helper function to get section display name
  const getSectionDisplayName = (section: string): string => {
    const sectionNames: Record<string, string> = {
      'current_tariff': 'CURRENT ELECTRICITY TARIFF',
      'new_tariff': 'NEW ELECTRICITY TARIFF',
      'consumption': 'ELECTRICITY CONSUMPTION',
      'export_tariff': 'IMPORT/EXPORT TARIFF',
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
    const { DYNAMIC_INPUT_FIELDS } = require('../config/dynamicInputFields');
    const index = DYNAMIC_INPUT_FIELDS.findIndex((f: any) => f.id === fieldId);
    return index >= 0 ? index : 9999; // If not found, put at end
  };

  // Helper function to sort fields matching the exact image order:
  // 1. CURRENT ELECTRICITY TARIFF
  // 2. NEW ELECTRICITY TARIFF
  // 3. ELECTRICITY CONSUMPTION
  // 4. EXPORT TARIFF
  // 5. EXISTING SYSTEM
  // 6. SOLAR (at bottom)
  // 7. BATTERY
  // 8. SOLAR/HYBRID INVERTER
  // 9. BATTERY INVERTER
  const sortFields = (fields: InputField[]): InputField[] => {
    return [...fields].sort((a, b) => {
      const aSection = getFieldSection(a.id);
      const bSection = getFieldSection(b.id);
      const aOrder = getFieldOrder(a.id);
      const bOrder = getFieldOrder(b.id);
      
      // Exact section order matching the image
      const sectionOrder = [
        'current_tariff',      // 1. CURRENT ELECTRICITY TARIFF
        'new_tariff',          // 2. NEW ELECTRICITY TARIFF
        'consumption',         // 3. ELECTRICITY CONSUMPTION
        'export_tariff',       // 4. EXPORT TARIFF
        'existing_system',     // 5. EXISTING SYSTEM
        'solar',              // 6. SOLAR (at bottom)
        'battery',            // 7. BATTERY
        'solar_hybrid',       // 8. SOLAR/HYBRID INVERTER
        'battery_inverter',   // 9. BATTERY INVERTER
        'other'               // Other fields
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
      'current_tariff', 'new_tariff', 'consumption', 'export_tariff', 
      'existing_system', 'solar', 'battery', 'solar_hybrid', 'battery_inverter', 'other'
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
    console.log(`🔍 DynamicInputsScreen: Rendering field ${field.id}:`, {
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

    // Number field with dropdown (primary) + override (secondary): select from list first, or enter custom value below
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
          {/* Primary: dropdown */}
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
          {/* Secondary: override */}
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
      console.log(`Rendering dropdown for ${field.id} (type: ${field.type})`);
      
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
      
      console.log(`Options for ${field.id}:`, options);
      
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
                    setInputFields(prev => prev.map(f => 
                      f.id === field.id 
                        ? { ...f, dropdownOptions: PANEL_MANUFACTURERS }
                        : f
                    ));
                    setOpenDropdown(field.id);
                    setShowDropdownModal(true);
                  } 
                  // For panel_model, check if we have a manufacturer selected
                  else if (field.id === 'panel_model') {
                    const manufacturerValue = inputValues['panel_manufacturer'];
                    if (manufacturerValue) {
                      const panelModels = getPanelModels(manufacturerValue);
                      console.log(`Using local panel models for ${manufacturerValue}:`, panelModels);
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
                    const effectiveTemplateFileName = restoredParams?.templateFileName || templateFileName;
                    
                    // Fetch options for this specific field
                    const response = await api.post('/excel-automation/get-dropdown-options', {
                      opportunityId: opportunityId,
                      templateFileName: effectiveTemplateFileName,
                      fieldId: field.id,
                    });
                    
                    const result = response.data as any;
                    if (result.success && result.options && result.options.length > 0) {
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
                console.log(`Opening dropdown for ${field.id} with ${options.length} options`);
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading input fields...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={[styles.errorText, { color: theme.secondaryText }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primaryButton }]} onPress={() => fetchDynamicInputs()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Off Peak Inputs</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Configure calculation parameters
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
                <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
                  {(restoredParams?.customerDetails || customerDetails)?.customerName || 'Customer'}
                </Text>
                <Text style={[styles.summarySubtitle, { color: theme.secondaryText }]}>
                  {(restoredParams?.customerDetails || customerDetails)?.address || 'Address not available'}
                </Text>
              </View>
            </View>
            {((restoredParams?.templateFileName || templateFileName)) && (
              <View style={styles.templateBadge}>
                <Feather name="file" size={12} color={theme.tertiaryText} />
                <Text style={[styles.templateBadgeText, { color: theme.tertiaryText }]}>
                  {restoredParams?.templateFileName || templateFileName}
                </Text>
              </View>
            )}
          </View>
          {useManualMode ? (
            <ManualInputFieldsManager
              inputFields={inputFields}
              selectedOptions={selectedOptions}
              onInputChange={handleInputChange}
              onManualOverride={handleManualOverride}
              inputValues={inputValues}
            />
          ) : (
            <>


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
                          {section === 'consumption' && (
                            <Text style={[styles.sectionNote, { color: theme.secondaryText }]}>
                              Annual consumption also from current bill.
                            </Text>
                          )}
                          {section === 'new_tariff' && (
                            <Text style={[styles.sectionNote, { color: theme.secondaryText }]}>
                              Rates are from the new provider.
                            </Text>
                          )}
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
                          <View style={[styles.sectionHeader, styles.sectionHeaderGroup, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}>
                            <Text style={[styles.sectionTitle, { color: theme.tertiaryText, fontWeight: 'bold' }]}>{sectionName}</Text>
                          </View>
                          {section === 'consumption' && (
                            <Text style={[styles.sectionNote, { color: theme.tertiaryText }]}>
                              Annual consumption also from current bill.
                            </Text>
                          )}
                          {section === 'new_tariff' && (
                            <Text style={[styles.sectionNote, { color: theme.tertiaryText }]}>
                              Rates are from the new provider.
                            </Text>
                          )}
                          {fields.map(renderInputField)}
                        </View>
                      ))}
                    </>
                  )}
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
          setDropdownWarning(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Select {openDropdown ? inputFields.find(f => f.id === openDropdown)?.label : 'Option'}
            </Text>
            
            {dropdownWarning && (
              <View style={[styles.dropdownWarning, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
                <Ionicons name="warning" size={18} color={theme.dangerButton} style={{ marginRight: 8 }} />
                <Text style={[styles.dropdownWarningText, { color: theme.dangerButton }]}>
                  {dropdownWarning}
                </Text>
              </View>
            )}
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {openDropdown && (() => {
                const field = inputFields.find(f => f.id === openDropdown);
                const options = field?.dropdownOptions || [];
                
                return options.map((option, index) => {
                  // Check if this is panel_manufacturer and option is Astronergy (disabled for flux)
                  const isDisabled = openDropdown === 'panel_manufacturer' && option.trim() === 'Astronergy';
                  console.log('Rendering option:', option, 'openDropdown:', openDropdown, 'isDisabled:', isDisabled);
                  
                  return (
                    <TouchableOpacity
                      key={`${openDropdown}-${option}-${index}`}
                      style={[
                        styles.modalOption,
                        { 
                          borderBottomColor: theme.cardBorder,
                          backgroundColor: inputValues[openDropdown] === option ? theme.primaryButton + '20' : 'transparent',
                          opacity: isDisabled ? 0.5 : 1
                        }
                      ]}
                      activeOpacity={isDisabled ? 1 : 0.7}
                      onPress={() => {
                        console.log('Option pressed:', option, 'isDisabled:', isDisabled, 'Platform:', Platform.OS);
                        if (isDisabled) {
                          console.log('Showing warning for disabled option');
                          setDropdownWarning('Astronergy is not available for off peak calculator and cannot be selected.');
                          return;
                        }
                        setDropdownWarning(null); // Clear warning when valid option is selected
                        handleInputChange(openDropdown, option);
                        setShowDropdownModal(false);
                        setOpenDropdown(null);
                      }}
                    >
                      <Text style={[
                        styles.modalOptionText,
                        { 
                          color: isDisabled 
                            ? theme.secondaryText 
                            : inputValues[openDropdown] === option 
                              ? theme.primaryButton 
                              : theme.primaryText,
                          fontWeight: inputValues[openDropdown] === option ? '600' : '400'
                        }
                      ]}>
                        {option}
                      </Text>
                      {inputValues[openDropdown] === option && !isDisabled && (
                        <Feather name="check" size={20} color={theme.primaryButton} />
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
              onPress={() => {
                setShowDropdownModal(false);
                setOpenDropdown(null);
                setDropdownWarning(null);
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
          
          console.log('🔍 Skip button conditions:', {
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
                console.log('🔍 Skip button pressed - navigating to SolarArraysInputs');
                // Skip directly to SolarArraysInputs screen
                const effectiveTemplateFileName = restoredParams?.templateFileName || templateFileName;
                const effectiveCustomerDetails = restoredParams?.customerDetails || customerDetails;
                const effectiveSelectedTemplateOptions = restoredParams?.selectedTemplateOptions || selectedTemplateOptions;
                
                (navigation as any).navigate('SolarArraysInputs', {
                  opportunityId,
                  templateFileName: effectiveTemplateFileName,
                  customerDetails: effectiveCustomerDetails,
                  selectedTemplateOptions: effectiveSelectedTemplateOptions,
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
  sectionNote: {
    fontSize: 13,
    marginBottom: 12,
    marginHorizontal: 4,
    fontStyle: 'italic',
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
  dropdownWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownWarningText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
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

  autoPopulateMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  autoPopulateMessageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginLeft: 8,
  },
  autoPopulateMessageClose: {
    padding: 4,
    borderRadius: 4,
  },
  autoPopulateSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  autoPopulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  autoPopulateButtonDisabled: {
    opacity: 0.6,
  },
  autoPopulateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  autoPopulateDescription: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    color: '#6b7280',
    lineHeight: 16,
  },
  linkedProjectInfo: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  linkedProjectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  linkedProjectAddress: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
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
