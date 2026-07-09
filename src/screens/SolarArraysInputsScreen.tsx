import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import CalculatorProgressService from '../services/CalculatorProgressService';

const { width } = Dimensions.get('window');

type ArrayRow = {
  id: number;
  enabled: boolean;
  numberOfPanels?: string;
  orientationDeg?: string; // from south
  pitchDeg?: string; // from flat
  shadingFactor?: string; // e.g. 0.96
  source?: 'opensolar' | 'manual';
  overrideOpenSolar?: boolean; // New field to track override state
};

interface RouteParams {
  opportunityId?: string;
  templateFileName?: string;
  calculatorType?: 'flux' | 'off-peak';
  customerDetails?: any;
}

export default function SolarArraysInputsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { opportunityId, templateFileName, calculatorType, customerDetails } = route.params as RouteParams;

  const [rows, setRows] = useState<ArrayRow[]>(() => {
    // Initialize with 1 array by default - will be updated from saved progress or OpenSolar
    return Array.from({ length: 8 }).map((_, idx) => ({ id: idx + 1, enabled: idx < 1 }));
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkedOpenSolar, setLinkedOpenSolar] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedNotice, setImportedNotice] = useState(false);
  const [hasImportedFromOpenSolar, setHasImportedFromOpenSolar] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [noOfArraysDropdownOptions, setNoOfArraysDropdownOptions] = useState<string[]>(['1', '2', '3', '4', '5', '6', '7', '8']);
  const [showArraysDropdown, setShowArraysDropdown] = useState(false);
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [showShadingModal, setShowShadingModal] = useState(false);
  const [invalidShadingArrays, setInvalidShadingArrays] = useState<number[]>([]);
  const [showRoundingModal, setShowRoundingModal] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedArraysData, setSavedArraysData] = useState<any>(null);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const roundingProgressAnim = useRef(new Animated.Value(0)).current;

  // Function to capture current state for comparison
  const captureCurrentState = () => {
    return captureStateFromRows(rows);
  };

  // Helper function to capture state from any rows array
  const captureStateFromRows = (rowsArray: ArrayRow[]) => {
    const enabledCount = rowsArray.filter(r => r.enabled).length;
    const isFlux = calculatorType === 'flux';
    const sortedRows = [...rowsArray].sort((a, b) => a.id - b.id);
    
    const inputs: Record<string, string> = {};
    inputs['no_of_arrays'] = String(enabledCount);
    
    sortedRows.forEach(r => {
      const idx = r.id;
      if (!r.enabled) return;
      
      // Round orientation values unless in override mode
      let orientationValue = r.orientationDeg;
      if (orientationValue && orientationValue.trim() !== '' && !(r.source === 'opensolar' && r.overrideOpenSolar)) {
        orientationValue = validateOrientation(orientationValue, true); // true = round to nearest 5°
      }
      
      if (isFlux) {
        if (r.numberOfPanels && r.numberOfPanels.trim() !== '') {
          inputs[`array${idx}_panels`] = r.numberOfPanels;
        }
        if (orientationValue && orientationValue.trim() !== '') {
          inputs[`array${idx}_orientation`] = orientationValue;
        }
        if (r.pitchDeg && r.pitchDeg.trim() !== '') {
          inputs[`array${idx}_pitch`] = r.pitchDeg;
        }
        if (r.shadingFactor && r.shadingFactor.trim() !== '') {
          inputs[`array${idx}_shading`] = r.shadingFactor;
        }
      } else {
        if (r.numberOfPanels && r.numberOfPanels.trim() !== '') {
          inputs[`array_${idx}_num_panels`] = r.numberOfPanels;
        }
        if (orientationValue && orientationValue.trim() !== '') {
          inputs[`array_${idx}_orientation_deg_from_south`] = orientationValue;
        }
        if (r.pitchDeg && r.pitchDeg.trim() !== '') {
          inputs[`array_${idx}_pitch_deg_from_flat`] = r.pitchDeg;
        }
        if (r.shadingFactor && r.shadingFactor.trim() !== '') {
          inputs[`array_${idx}_shading_factor`] = r.shadingFactor;
        }
      }
    });
    
    return inputs;
  };

  // Function to check if data has changed
  const hasDataChanged = useCallback(() => {
    if (!savedArraysData) return false;
    
    const currentData = captureCurrentState();
    
    // Compare the two objects
    const savedKeys = Object.keys(savedArraysData);
    const currentKeys = Object.keys(currentData);
    
    console.log('🔍 Comparing arrays data:', {
      savedKeys: savedKeys.length,
      currentKeys: currentKeys.length,
      savedArraysData,
      currentData
    });
    
    // Different number of keys means change
    if (savedKeys.length !== currentKeys.length) {
      console.log('🔍 Different number of keys - data changed');
      return true;
    }
    
    // Check if any values are different
    for (const key of savedKeys) {
      if (savedArraysData[key] !== currentData[key]) {
        console.log(`🔍 Key '${key}' changed: '${savedArraysData[key]}' -> '${currentData[key]}'`);
        return true;
      }
    }
    
    console.log('🔍 No changes detected');
    return false;
  }, [savedArraysData, rows, calculatorType]);

  const hasArrayInputData = useCallback((rowsArray: ArrayRow[]) => {
    return rowsArray.some(r =>
      r.enabled && (
        (r.numberOfPanels?.trim()) ||
        (r.orientationDeg?.trim()) ||
        (r.pitchDeg?.trim()) ||
        (r.shadingFactor?.trim())
      )
    );
  }, []);

  const navigateToPricing = () => {
    (navigation as any).navigate('Pricing', {
      opportunityId,
      templateFileName,
      calculatorType: calculatorType || 'off-peak',
      customerDetails,
    });
  };

  const handleContinue = async () => {
    if (!hasUnsavedChanges && savedArraysData) {
      navigateToPricing();
      return;
    }
    await onSave();
  };
  useEffect(() => {
    const init = async () => {
      console.log('🔍 Initializing SolarArraysInputsScreen for opportunity:', opportunityId);
      
      // Extract customer information for header display
      if (customerDetails) {
        const customerName = customerDetails.customerName || 'Loading...';
        const customerPostcode = customerDetails.postcode || 'Loading...';
        
        if (customerName !== 'Loading...' || customerPostcode !== 'Loading...') {
          setCustomerInfo({
            name: customerName,
            postcode: customerPostcode
          });
        }
      }
      
      // First check for OpenSolar data, then restore progress if needed
      let hasOpenSolarData = false;
      let openSolarArrays: any[] = [];
      
      // Check OpenSolar link and pull calculator data for arrays
      try {
        const { api } = await import('../utils/api');
        
        // First, check if there's a linked OpenSolar project
        console.log('🔍 Checking for linked OpenSolar project...');
        const linked: any = await api.get(`/opensolar/opportunity/${opportunityId}`);
        console.log('🔍 Linked project response:', linked?.data);
        
        if (linked?.data?.success && linked.data.data) {
          setLinkedOpenSolar(linked.data.data);
          console.log('🔍 Found linked OpenSolar project:', linked.data.data);
          
          // Now fetch calculator data
          console.log('🔍 Fetching calculator data...');
          const calc: any = await api.get(`/opensolar/calculator-data/${opportunityId}`);
          console.log('🔍 OpenSolar calculator data response:', calc?.data);
          
          if (calc?.data?.success && calc.data.data?.arrays) {
            openSolarArrays = calc.data.data.arrays as any[];
            console.log('🔍 OpenSolar arrays data:', openSolarArrays);
            
            if (openSolarArrays.length > 0) {
              hasOpenSolarData = true;
              console.log(`🔍 Found ${openSolarArrays.length} arrays from OpenSolar`);
            } else {
              console.log('⚠️ No arrays found in OpenSolar data');
            }
          } else if (calc?.data?.error === 'PROJECT_ACCESS_DENIED') {
            console.log('❌ OpenSolar project access denied:', calc?.data?.message);
            // Show user-friendly error message
            Alert.alert(
              'OpenSolar Project Access Issue',
              `The OpenSolar project is not accessible. ${calc?.data?.message}\n\nThis usually happens when:\n• The project was transferred to another account\n• The project was deleted\n• You don't have permission to access it\n\nYou can:\n• Create a new project\n• Update the project ID if you have the correct one\n• Continue without OpenSolar data`,
              [
                {
                  text: 'Continue Without OpenSolar',
                  style: 'default'
                },
                {
                  text: 'Update Project ID',
                  onPress: () => {
                    // TODO: Implement project ID update dialog
                    console.log('TODO: Show project ID update dialog');
                  }
                }
              ]
            );
          } else {
            console.log('⚠️ No calculator data or arrays found:', calc?.data);
          }
        } else {
          console.log('⚠️ No linked OpenSolar project found');
        }
      } catch (e) {
        console.error('❌ Error loading OpenSolar data:', e);
      }
      
      // Now check for saved progress and restore if needed
      try {
        console.log('🔍 Checking for saved arrays progress...');
        const progress = await CalculatorProgressService.getProgress(opportunityId!, calculatorType || 'off-peak');
        if (progress && progress.arraysData) {
          console.log('🔍 Found arrays data in progress:', progress.arraysData);
          const savedData = progress.arraysData;
          
          // Store the saved data for comparison
          setSavedArraysData(savedData);
          
          // Restore arrays data from progress
          if (savedData.arrayRows) {
            const enabledCount = savedData.enabledCount || 1;
            
            setRows(prev => prev.map((r, idx) => {
              const shouldEnable = idx < enabledCount;
              if (!shouldEnable) return { ...r, enabled: false };
              
              const savedRow = savedData.arrayRows.find((row: any) => row.id === r.id);
              if (!savedRow) return { ...r, enabled: shouldEnable };
              
              // Determine source: if saved data has OpenSolar source, preserve it
              // Otherwise, if we have OpenSolar data available, use 'opensolar'
              // Otherwise use the saved source or 'manual'
              let source: 'opensolar' | 'manual';
              if (savedRow.source === 'opensolar') {
                source = 'opensolar';
              } else if (hasOpenSolarData) {
                source = 'opensolar';
              } else {
                source = savedRow.source || 'manual';
              }
              
              // Restore override state - this is critical to show if user overrode OpenSolar data
              const overrideOpenSolar = savedRow.overrideOpenSolar === true;
              
              console.log(`🔍 Restoring array ${r.id}: source=${source}, overrideOpenSolar=${overrideOpenSolar}`);
              
              return {
                ...r,
                enabled: shouldEnable,
                numberOfPanels: savedRow.numberOfPanels || '',
                orientationDeg: savedRow.orientationDeg || '',
                pitchDeg: savedRow.pitchDeg || '',
                shadingFactor: savedRow.shadingFactor || '',
                source: source,
                overrideOpenSolar: overrideOpenSolar
              };
            }));

            const restoredHasImportedData = savedData.arrayRows.some((row: any) =>
              row.enabled && (
                row.numberOfPanels?.trim() ||
                row.orientationDeg?.trim() ||
                row.pitchDeg?.trim() ||
                row.shadingFactor?.trim()
              )
            );
            if (restoredHasImportedData) {
              setHasImportedFromOpenSolar(true);
            }
            
            console.log('✅ Restored arrays data from CalculatorProgressService');
            setHasRestoredProgress(true);
          }
        } else {
          console.log('ℹ️ No saved arrays data found');
          setHasRestoredProgress(true);
        }
      } catch (error) {
        console.log('⚠️ Error loading saved arrays data:', error);
        setHasRestoredProgress(true);
      }
      
      // If we have OpenSolar data but no saved progress, set up arrays from OpenSolar
      if (hasOpenSolarData) {
        console.log(`🔍 Setting up ${openSolarArrays.length} arrays from OpenSolar`);
        
        setRows(prev => {
          const updatedRows = prev.map((r, idx) => {
            const a = openSolarArrays[r.id - 1];
            console.log(`🔍 Processing array ${r.id}:`, a);
            
            // Enable arrays based on OpenSolar array count ONLY
            const shouldEnable = idx < openSolarArrays.length;
            
            // Only set the number of arrays - don't populate detailed data yet
            // The detailed data (panels, orientation, pitch, shading) will be filled
            // when the user clicks Save, not automatically on load
            return {
              ...r,
              enabled: shouldEnable,
              source: 'opensolar' as const,
              // Don't populate numberOfPanels, orientationDeg, pitchDeg, shadingFactor yet
              // These will be filled when user explicitly saves the data
            };
          });
          
          console.log('🔍 Final updated rows (number only):', updatedRows);
          return updatedRows;
        });
      }
      
      // Mark as initialized after all setup is complete
      setTimeout(() => {
        setHasUnsavedChanges(false);
        console.log('🔍 SolarArraysInputsScreen initialization complete');
      }, 500);
    };
    init();
  }, []);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  const handleImportFromOpenSolar = async () => {
    if (!linkedOpenSolar) return;
    try {
      setImporting(true);
      const { api } = await import('../utils/api');
      const calc: any = await api.get(`/opensolar/calculator-data/${opportunityId}`);
      console.log('🔍 Import - OpenSolar calculator data response:', calc?.data);
      if (calc?.data?.success && calc.data.data?.arrays) {
        const arrays = calc.data.data.arrays as any[];
        console.log('🔍 Import - OpenSolar arrays data:', arrays);
        
        // Update rows with OpenSolar data
        setRows(prev => prev.map((r, idx) => {
          const a = arrays[r.id - 1];
          console.log(`🔍 Import - Processing array ${r.id}:`, a);
          
          // Enable arrays based on OpenSolar array count
          const shouldEnable = idx < arrays.length;
          
          if (!a) return { ...r, enabled: shouldEnable };
          
          // Convert orientation as difference from 180° and round to nearest 5° increment
          let orientationDeg = '';
          console.log(`🔍 Import - Array ${r.id} orientation data:`, a.orientation);
          if (a.orientation?.azimuth != null) {
            const azimuth = parseFloat(a.orientation.azimuth);
            console.log(`🔍 Import - Array ${r.id} raw azimuth:`, azimuth);
            // Normalize to 0-360 range
            let normalized = azimuth % 360;
            if (normalized < 0) normalized += 360;
            
            // Calculate difference from 180° (the reference direction)
            const differenceFrom180 = Math.abs(180 - normalized);
            console.log(`🔍 Import - Array ${r.id} difference from 180°:`, differenceFrom180);
            
            // Round to nearest 5° increment (not UP) to match Excel dropdown values
            const rounded = Math.round(differenceFrom180 / 5) * 5;
            orientationDeg = validateOrientation(String(rounded));
            console.log(`🔍 Import - Array ${r.id} final orientation:`, orientationDeg);
          } else {
            console.log(`🔍 Import - Array ${r.id} has no azimuth data`);
          }
          
          // Convert roof pitch (tilt)
          // NOTE: No rounding during import - rounding happens on save
          let pitchDeg = '';
          if (a.orientation?.tilt != null) {
            const tilt = parseFloat(a.orientation.tilt);
            pitchDeg = validatePitch(String(tilt));
          }
          
          // Convert shading from percentage to decimal
          let shadingFactor = '';
          if (a.shading?.annualLoss != null) {
            const annualLoss = parseFloat(a.shading.annualLoss);
            // Convert from percentage loss to shading factor (100% = 1, 50% = 0.5)
            const shadingFactorValue = 1 - (annualLoss / 100);
            shadingFactor = validateShading(String(Math.round(shadingFactorValue * 100) / 100));
          }
          
          return {
            ...r,
            enabled: shouldEnable,
            numberOfPanels: validatePanels(String(a.panelCount ?? '')),
            orientationDeg,
            pitchDeg,
            shadingFactor,
            source: 'opensolar' as const,
          };
        }));
        
        setImportedNotice(true);
        setHasImportedFromOpenSolar(true);
        setHasUnsavedChanges(true);
        // Hide notice after 5 seconds
        setTimeout(() => setImportedNotice(false), 5000);
        
        // Track that changes have been made
        setHasUnsavedChanges(true);
      } else {
        Alert.alert('OpenSolar', 'No array data found in OpenSolar project');
      }
    } catch (e) {
      console.error('Import error:', e);
      Alert.alert('OpenSolar', 'Network error while importing from OpenSolar');
    } finally {
      setImporting(false);
    }
  };



  // Validation functions to prevent Excel corruption
  // These ensure values match Excel dropdown constraints and don't break calculations
  
  // Validation function for orientation values
  // During typing, allow any valid number. Rounding happens on blur/save.
  const validateOrientation = (value: string, shouldRound: boolean = false): string => {
    if (!value || value.trim() === '') return '';
    
    // Remove any non-numeric characters except decimal point and minus sign
    // This allows typing while preventing invalid characters
    let cleanedValue = value.replace(/[^\d.-]/g, '');
    
    // Prevent multiple decimal points or minus signs
    const parts = cleanedValue.split('.');
    if (parts.length > 2) {
      cleanedValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Allow minus only at the start
    if (cleanedValue.includes('-') && cleanedValue.indexOf('-') !== 0) {
      cleanedValue = cleanedValue.replace(/-/g, '');
    }
    
    // If empty after cleaning, return empty
    if (!cleanedValue || cleanedValue === '-' || cleanedValue === '.') return '';
    
    const num = parseFloat(cleanedValue);
    if (isNaN(num)) return '';
    
    // Allow typing any positive number (will validate max on save)
    if (num < 0) return '';
    
    // Only round if explicitly requested (on blur/save), not during typing
    if (shouldRound) {
      // Round to nearest 5° increment to match Excel dropdown values
      const rounded = Math.round(num / 5) * 5;
      return String(rounded);
    }
    
    // During typing, return the cleaned value as-is
    return cleanedValue;
  };

  // Validation function for pitch values
  // NOTE: No rounding during input - rounding happens on save
  const validatePitch = (value: string): string => {
    if (!value || value.trim() === '') return '';
    
    // Remove any non-numeric characters except decimal point
    let cleanedValue = value.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanedValue.split('.');
    if (parts.length > 2) {
      cleanedValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // If empty after cleaning, return empty
    if (!cleanedValue || cleanedValue === '.') return '';
    
    const num = parseFloat(cleanedValue);
    if (isNaN(num)) return '';
    
    // Allow typing any positive number (will validate max on save)
    if (num < 0) return '';
    
    // Return the value as-is without rounding - rounding happens on save
    return cleanedValue;
  };

  // Validation function for shading factor
  // During typing, only prevent breaking formats like "..96" - be permissive otherwise
  // Full validation happens on save, not during typing
  const validateShading = (value: string): string => {
    if (!value || value.trim() === '') return '';
    
    // Only prevent multiple consecutive decimal points (like "..96")
    // Allow normal typing like "0.96", ".96", etc.
    let cleanedValue = value;
    
    // Remove any non-numeric characters except decimal point
    cleanedValue = cleanedValue.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points - keep only the first one
    const parts = cleanedValue.split('.');
    if (parts.length > 2) {
      cleanedValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Allow values like ".96", "0.96", "96" - don't restrict during typing
    // Full validation (0-1 range) happens on save only
    return cleanedValue;
  };

  // Validation function to check if shading value is valid (for save validation)
  const isValidShadingValue = (value: string): boolean => {
    if (!value || value.trim() === '') return true; // Empty is valid (optional field)
    
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    
    // Shading factor should be between 0 and 1 (e.g., 0.96, 0.5, 1.0)
    return num >= 0 && num <= 1;
  };

  // Validation function for number of panels
  const validatePanels = (value: string): string => {
    if (!value || value.trim() === '') return '';
    
    // Remove any non-numeric characters
    let cleanedValue = value.replace(/[^\d]/g, '');
    
    // If empty after cleaning, return empty
    if (!cleanedValue) return '';
    
    const num = parseInt(cleanedValue);
    if (isNaN(num) || num < 0) return '';
    
    return String(num);
  };

  const onChange = (id: number, key: keyof ArrayRow, value: string) => {
    // Find the current row to check if override is enabled
    const currentRow = rows.find(r => r.id === id);
    const isOverrideMode = currentRow?.source === 'opensolar' && currentRow?.overrideOpenSolar;
    
    let validatedValue = value;
    
    // Only apply validation if NOT in override mode
    if (!isOverrideMode) {
      // Apply validation based on field type (without rounding during typing)
      switch (key) {
        case 'orientationDeg':
          validatedValue = validateOrientation(value, false); // false = don't round during typing
          break;
        case 'pitchDeg':
          validatedValue = validatePitch(value);
          break;
        case 'shadingFactor':
          validatedValue = validateShading(value);
          break;
        case 'numberOfPanels':
          validatedValue = validatePanels(value);
          break;
        default:
          validatedValue = value;
      }
    } else {
      // In override mode, allow any input but do basic sanitization
      // For shading, still prevent invalid formats like "..96"
      if (key === 'shadingFactor') {
        validatedValue = validateShading(value);
      } else {
        validatedValue = value.trim();
      }
    }
    
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: validatedValue, source: r.source || 'manual' } : r));
    
    // Track that changes have been made
    setHasUnsavedChanges(true);
  };

  // Handle blur event to round orientation values
  const onBlur = (id: number, key: keyof ArrayRow, value: string) => {
    // Only round orientation on blur if not in override mode
    if (key === 'orientationDeg') {
      const currentRow = rows.find(r => r.id === id);
      const isOverrideMode = currentRow?.source === 'opensolar' && currentRow?.overrideOpenSolar;
      
      if (!isOverrideMode && value && value.trim() !== '') {
        const roundedValue = validateOrientation(value, true); // true = round on blur
        if (roundedValue !== value) {
          setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: roundedValue } : r));
          setHasUnsavedChanges(true);
        }
      }
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);

      const shouldRound = hasArrayInputData(rows);
      let roundedRows = rows;

      if (shouldRound) {
        // Step 1: Show rounding loading modal and start progress animation
        console.log('🔄 Starting rounding process...');
        setShowRoundingModal(true);
        roundingProgressAnim.setValue(0);
        
        // Step 2: Animate progress bar over 1 second
        Animated.timing(roundingProgressAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }).start();
        
        // Step 2.5: Wait 1 second while showing loading modal
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 3: Round all orientation values to nearest 5° increment
        console.log('🔄 Rounding orientation values to nearest 5° increment...');
        roundedRows = rows.map(r => {
        if (!r.enabled || !r.orientationDeg || r.orientationDeg.trim() === '') {
          return r;
        }
        
        const currentValue = parseFloat(r.orientationDeg);
        if (isNaN(currentValue)) {
          return r;
        }
        
        // Round to nearest 5° increment
        const rounded = Math.round(currentValue / 5) * 5;
        const roundedValue = String(rounded);
        
        // Only update if value changed
        if (roundedValue !== r.orientationDeg) {
          console.log(`🔄 Array ${r.id}: Rounding orientation from ${r.orientationDeg} to ${roundedValue}`);
          return { ...r, orientationDeg: roundedValue };
        }
        
        return r;
      });
      
      // Step 4: Round all pitch values to nearest degree
      console.log('🔄 Rounding pitch values to nearest degree...');
      roundedRows = roundedRows.map(r => {
        if (!r.enabled || !r.pitchDeg || r.pitchDeg.trim() === '') {
          return r;
        }
        
        const currentValue = parseFloat(r.pitchDeg);
        if (isNaN(currentValue)) {
          return r;
        }
        
        // Round to nearest degree
        const rounded = Math.round(currentValue);
        const roundedValue = String(rounded);
        
        // Only update if value changed
        if (roundedValue !== r.pitchDeg) {
          console.log(`🔄 Array ${r.id}: Rounding pitch from ${r.pitchDeg} to ${roundedValue}`);
          return { ...r, pitchDeg: roundedValue };
        }
        
        return r;
      });
      
        // Step 5: Update state with rounded values
        setRows(roundedRows);
      } else {
        console.log('ℹ️ No array input data to round, continuing with empty arrays');
      }
      
      // Step 6: Close rounding modal
      setShowRoundingModal(false);
      
      // Step 7: Check for invalid orientation values (180 degrees or higher) using rounded values
      const invalidOrientations = roundedRows.filter(r => {
        if (!r.enabled || !r.orientationDeg) return false;
        const orientationValue = parseFloat(r.orientationDeg);
        console.log(`🔍 Checking orientation for array ${r.id}: ${r.orientationDeg} (parsed: ${orientationValue})`);
        return orientationValue >= 180;
      });
      
      console.log(`🔍 Invalid orientations found: ${invalidOrientations.length}`);
      
      if (invalidOrientations.length > 0) {
        console.log('🚨 Showing orientation validation popup');
        setShowOrientationModal(true);
        setSaving(false);
        return;
      }
      
      // Step 8: Check for invalid shading values
      const invalidShadings = roundedRows.filter(r => {
        if (!r.enabled || !r.shadingFactor || r.shadingFactor.trim() === '') return false;
        return !isValidShadingValue(r.shadingFactor);
      });
      
      console.log(`🔍 Invalid shading values found: ${invalidShadings.length}`);
      
      if (invalidShadings.length > 0) {
        console.log('🚨 Showing shading validation popup');
        const invalidArrayIds = invalidShadings.map(r => r.id);
        setInvalidShadingArrays(invalidArrayIds);
        setShowShadingModal(true);
        setSaving(false);
        return;
      }
      
      console.log('🔄 Save & Calculate: Saving arrays data to JSON (NO COM call)');
      
      // Step 9: Prepare arrays data for JSON saving with rounded values
      const enabledCount = roundedRows.filter(r => r.enabled).length;
      const arraysData = {
        arrayRows: roundedRows.map(r => ({
          id: r.id,
          enabled: r.enabled,
          numberOfPanels: r.numberOfPanels || '',
          orientationDeg: r.orientationDeg || '',
          pitchDeg: r.pitchDeg || '',
          shadingFactor: r.shadingFactor || '',
          source: r.source || 'manual',
          overrideOpenSolar: r.overrideOpenSolar || false
        })),
        enabledCount: enabledCount
      };
      
      // Step 10: Save arrays data to JSON (NO COM call - Excel update happens on final submit)
      await CalculatorProgressService.saveProgress(opportunityId!, calculatorType || 'off-peak', {
        currentStep: 'arrays' as const,
        arraysData,
        completedSteps: {
          'arrays': true,
        },
      });
      
      console.log('✅ Arrays data saved to JSON');
      
      // Step 11: Capture current state for comparison (using rounded rows)
      const inputs = captureStateFromRows(roundedRows);
      setSavedArraysData(inputs);
      setHasUnsavedChanges(false);
      
      // Step 12: Auto-call the calculate API with rounded values
      try {
        console.log('🔄 Auto-calling calculate API with rounded arrays data...');
        const { calculatorApi } = await import('../utils/api');
        const calculateResult = await calculatorApi.calculate(opportunityId!, inputs);
        
        if (calculateResult.success) {
          console.log('✅ Calculate API called successfully');
        } else {
          console.warn('⚠️ Calculate API returned non-success:', calculateResult);
        }
      } catch (calculateError) {
        console.error('❌ Error calling calculate API (non-blocking):', calculateError);
        // Don't block navigation if calculate API fails
      }
      
      console.log('✅ Arrays data saved and calculated, navigating to Pricing...');
      
      // Step 13: Navigate to Pricing screen
      navigateToPricing();
      
    } catch (e) {
      console.error('❌ Save error:', e);
      Alert.alert('Error', 'Network error while saving arrays');
    } finally {
      setSaving(false);
      setShowRoundingModal(false);
    }
  };

  const setEnabledCount = (count: number) => {
    setRows(prev => prev.map((r, idx) => ({ 
      ...r, 
      enabled: idx < count,
      // Clear data for disabled arrays
      numberOfPanels: idx < count ? r.numberOfPanels : '',
      orientationDeg: idx < count ? r.orientationDeg : '',
      pitchDeg: idx < count ? r.pitchDeg : '',
      shadingFactor: idx < count ? r.shadingFactor : ''
    })));
    
    // Track that changes have been made
    setHasUnsavedChanges(true);
  };


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
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>New Products - Solar</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>Configure arrays. Only editable fields shown.</Text>
            </View>
          </View>
          {linkedOpenSolar && (
            <TouchableOpacity
              onPress={handleImportFromOpenSolar}
              disabled={importing}
              style={[styles.importButton, importing && styles.importButtonDisabled]}
            >
              <Feather name="download" size={16} color="#ffffff" />
              <Text style={styles.importButtonText}>{importing ? 'Importing…' : 'Import'}</Text>
            </TouchableOpacity>
          )}
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
        ref={scrollViewRef}
        style={[
          styles.scroll,
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
            paddingBottom: 140,
          }
        ]}
      >
        {linkedOpenSolar && !hasImportedFromOpenSolar && (
          <View style={[styles.importReminderBanner, { backgroundColor: (theme.dangerButton || '#ef4444') + '18', borderColor: (theme.dangerButton || '#ef4444') + '50' }]}>
            <Feather name="alert-triangle" size={20} color={theme.dangerButton || '#ef4444'} />
            <Text style={[styles.importReminderText, { color: theme.primaryText }]}>
              Remember to click Import
            </Text>
          </View>
        )}

        {linkedOpenSolar && (
          <View style={styles.noteBox}>
            <Feather name="info" size={16} color="#065f46" />
            <Text style={styles.noteText}>Information fetched from OpenSolar can be overridden.</Text>
          </View>
        )}

        {/* Progress Restore Component removed - no auto-restore functionality */}

        {/* Debug Panel - Remove this in production */}
        {__DEV__ && (
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: theme.primaryText }]}>🔍 Debug Info</Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Opportunity ID: {opportunityId}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Calculator Type: {calculatorType || 'off-peak'}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Has Unsaved Changes: {hasUnsavedChanges ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Data Changed: {hasDataChanged() ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Has Restored Progress: {hasRestoredProgress ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Linked OpenSolar: {linkedOpenSolar ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              Arrays Enabled: {rows.filter(r => r.enabled).length}
            </Text>
            <Text style={[styles.debugText, { color: theme.secondaryText }]}>
              OpenSolar Source: {rows.filter(r => r.source === 'opensolar').length}
            </Text>
          </View>
        )}

        {importedNotice && (
          <View style={styles.importedMessage}>
            <Feather name="check-circle" size={16} color="#065f46" />
            <Text style={styles.importedMessageText}>Array count and data imported from OpenSolar. You can override values before saving.</Text>
            <TouchableOpacity style={styles.importedMessageClose} onPress={() => setImportedNotice(false)}>
              <Feather name="x" size={14} color="#065f46" />
            </TouchableOpacity>
          </View>
        )}

        {/* No. of Arrays selector */}
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}> 
          <Text style={[styles.cardTitle, { color: theme.primaryText }]}>Arrays / Roofs</Text>
          <View style={{ flexDirection: 'column', gap: 12 }}>
            <Text style={[styles.inputLabel, { color: theme.primaryText }]}>No. of Arrays</Text>
            <TouchableOpacity
              style={[styles.dropdownContainer, { backgroundColor: theme.secondaryBackground, borderColor: theme.cardBorder }]}
              onPress={() => setShowArraysDropdown(true)}
            >
              <Text style={[styles.dropdownText, { color: theme.primaryText }]}>
                {rows.filter(r => r.enabled).length}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={20} 
                color={theme.tertiaryText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {rows.map(r => (
          <View key={r.id} style={[styles.arrayCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, opacity: r.enabled ? 1 : 0.6 }]}> 
            <View style={styles.arrayHeader}>
              <Text style={[styles.arrayTitle, { color: theme.primaryText }]}>Array {r.id}</Text>
              {!r.enabled && <Text style={{ color: theme.tertiaryText }}>Disabled</Text>}
              {r.source === 'opensolar' && r.enabled && (
                <View style={styles.sourceBadge}>
                  <Feather name="download" size={12} color="#065f46" />
                  <Text style={styles.sourceBadgeText}>OpenSolar</Text>
                </View>
              )}
            </View>
            
            {/* Override toggle for OpenSolar data */}
            {r.source === 'opensolar' && r.enabled && (
              <View style={styles.overrideSection}>
                <View style={styles.overrideToggle}>
                  <Text style={[styles.overrideLabel, { color: theme.primaryText }]}>Override OpenSolar Data</Text>
                  <Switch
                    value={r.overrideOpenSolar || false}
                    onValueChange={(value) => {
                      setRows(prev => prev.map(row => 
                        row.id === r.id 
                          ? { ...row, overrideOpenSolar: value }
                          : row
                      ));
                      // Track that changes have been made
                      setHasUnsavedChanges(true);
                    }}
                    trackColor={{ false: '#e2e8f0', true: '#B4F35B' }}
                    thumbColor={r.overrideOpenSolar ? '#1e293b' : '#64748b'}
                  />
                </View>
                {r.overrideOpenSolar && (
                  <Text style={[styles.overrideNote, { color: theme.tertiaryText }]}>
                    Override enabled - you can now enter any values to replace the OpenSolar data
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.rowGrid}>
              <Field 
                label="No. of Panels" 
                editable={r.enabled && (r.source !== 'opensolar' || !!r.overrideOpenSolar)} 
                value={r.numberOfPanels} 
                onChange={v=>onChange(r.id,'numberOfPanels',v)}
                isOverride={r.source === 'opensolar' && !!r.overrideOpenSolar}
              />
              <Field 
                label="Orientation (° from south)" 
                editable={r.enabled && (r.source !== 'opensolar' || !!r.overrideOpenSolar)} 
                value={r.orientationDeg} 
                onChange={v=>onChange(r.id,'orientationDeg',v)}
                onBlur={v=>onBlur(r.id,'orientationDeg',v)}
                isOverride={r.source === 'opensolar' && !!r.overrideOpenSolar}
              />
              <Field 
                label="Pitch (° from flat)" 
                editable={r.enabled && (r.source !== 'opensolar' || !!r.overrideOpenSolar)} 
                value={r.pitchDeg} 
                onChange={v=>onChange(r.id,'pitchDeg',v)}
                isOverride={r.source === 'opensolar' && !!r.overrideOpenSolar}
              />
              <Field 
                label="Shading (e.g. 0.96)" 
                editable={r.enabled && (r.source !== 'opensolar' || !!r.overrideOpenSolar)} 
                value={r.shadingFactor} 
                onChange={v=>onChange(r.id,'shadingFactor',v)}
                isOverride={r.source === 'opensolar' && !!r.overrideOpenSolar}
              />
            </View>
          </View>
        ))}


      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}> 
        {hasUnsavedChanges && (
          <View style={styles.unsavedIndicator}>
            <Feather name="alert-circle" size={16} color="#f59e0b" />
            <Text style={styles.unsavedText}>
              Unsaved changes
            </Text>
          </View>
        )}
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            hasUnsavedChanges && styles.saveButtonChanged
          ]} 
          onPress={handleContinue} 
          disabled={saving}
        >
          {saving ? (
            <Text style={styles.saveText}>Saving…</Text>
          ) : (
            <Text style={styles.saveText}>
              {hasUnsavedChanges ? 'Save & Continue' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Arrays Dropdown Modal */}
      <Modal
        visible={showArraysDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowArraysDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Select Number of Arrays
            </Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {noOfArraysDropdownOptions.map((option, index) => (
                <TouchableOpacity
                  key={`arrays-${option}-${index}`}
                  style={[
                    styles.modalOption,
                    { 
                      borderBottomColor: theme.cardBorder,
                      backgroundColor: rows.filter(r => r.enabled).length === parseInt(option) ? theme.primaryButton + '20' : 'transparent'
                    }
                  ]}
                  onPress={() => {
                    const count = parseInt(option);
                    setEnabledCount(count);
                    setShowArraysDropdown(false);
                    
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { 
                      color: rows.filter(r => r.enabled).length === parseInt(option) ? theme.primaryButton : theme.primaryText,
                      fontWeight: rows.filter(r => r.enabled).length === parseInt(option) ? '600' : '400'
                    }
                  ]}>
                    {option} Array{parseInt(option) > 1 ? 's' : ''}
                  </Text>
                  {rows.filter(r => r.enabled).length === parseInt(option) && (
                    <Feather name="check" size={20} color={theme.primaryButton} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
              onPress={() => setShowArraysDropdown(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Orientation Validation Modal */}
      <Modal
        visible={showOrientationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOrientationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color="#FF6B6B" />
              <Text style={[styles.orientationModalTitle, { color: theme.primaryText }]}>Invalid Orientation</Text>
            </View>
            
            <Text style={[styles.modalMessage, { color: theme.secondaryText }]}>
              You cannot enter 180 degrees or higher for orientation. Please enter a value between 0 and 175 degrees.
            </Text>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => setShowOrientationModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shading Validation Modal */}
      <Modal
        visible={showShadingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShadingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color="#FF6B6B" />
              <Text style={[styles.orientationModalTitle, { color: theme.primaryText }]}>Invalid Shading Value</Text>
            </View>
            
            <Text style={[styles.modalMessage, { color: theme.secondaryText }]}>
              {invalidShadingArrays.length === 1 
                ? `Array ${invalidShadingArrays[0]} has an invalid shading value. Shading must be a decimal number between 0 and 1 (e.g., 0.96, 0.5, 1.0). Please correct the value before saving.`
                : `Arrays ${invalidShadingArrays.join(', ')} have invalid shading values. Shading must be a decimal number between 0 and 1 (e.g., 0.96, 0.5, 1.0). Please correct the values before saving.`
              }
            </Text>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => setShowShadingModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rounding Loading Modal */}
      <Modal
        visible={showRoundingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // Prevent closing during rounding
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.roundingModalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.roundingModalIconContainer}>
              <View style={[styles.roundingModalIconCircle, { backgroundColor: theme.primaryButton + '15' }]}>
                <ActivityIndicator size="large" color={theme.primaryButton} />
              </View>
            </View>
            
            <Text style={[styles.roundingModalTitle, { color: theme.primaryText }]}>
              Rounding Values
            </Text>
            
            <Text style={[styles.roundingModalMessage, { color: theme.secondaryText }]}>
              Optimizing pitch and orientation values for the best calculations...
            </Text>
            
            <View style={styles.roundingModalProgressContainer}>
              <View style={[styles.roundingModalProgressBar, { backgroundColor: theme.cardBorder }]}>
                <Animated.View 
                  style={[
                    styles.roundingModalProgressFill, 
                    { 
                      backgroundColor: theme.primaryButton,
                      width: roundingProgressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

function Field({ label, value, editable, onChange, onBlur, isOverride = false }: { 
  label: string; 
  value?: string; 
  editable: boolean; 
  onChange: (v: string)=>void;
  onBlur?: (v: string)=>void;
  isOverride?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 180 }}>
      <Text style={[styles.inputLabel, { color: theme.primaryText }]}>{label}</Text>
      <TextInput
        style={[
          styles.input, 
          { 
            backgroundColor: editable ? theme.secondaryBackground : theme.secondaryBackground, 
            borderColor: editable ? (isOverride ? '#B4F35B' : theme.cardBorder) : '#e2e8f0', 
            color: editable ? theme.primaryText : theme.tertiaryText 
          }, 
          !editable && styles.inputDisabled,
          isOverride && editable && styles.overrideInput
        ]}
        editable={editable}
        value={value || ''}
        onChangeText={(text) => {
          // Ensure onChange is called with the raw text input
          onChange(text);
        }}
        onBlur={() => {
          // Call onBlur with current value when input loses focus
          if (onBlur && value) {
            onBlur(value);
          }
        }}
        placeholder={editable ? (isOverride ? 'Enter any value' : '') : 'Locked (OpenSolar data)'}
        placeholderTextColor={theme.tertiaryText}
        keyboardType={label.includes('No. of Panels') ? 'numeric' : 'default'}
        returnKeyType="done"
        blurOnSubmit={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { padding: width < 768 ? 12 : 14, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', marginRight: 16 },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: width < 768 ? 24 : 28, fontWeight: '800', color: '#1e293b', letterSpacing: -0.8 },
  headerSubtitle: { fontSize: 15, color: '#64748b', marginTop: 4, lineHeight: 20, fontWeight: '500' },
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
  importButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  importButtonDisabled: { opacity: 0.6 },
  importButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  scroll: { paddingHorizontal: width < 768 ? 16 : 24, paddingTop: 20 },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', borderColor: '#10b981', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  importReminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  importReminderText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  noteText: { color: '#065f46', fontWeight: '600', flex: 1 },
  importedMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderColor: '#16a34a', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  importedMessageText: { color: '#15803d', fontWeight: '600', flex: 1 },
  importedMessageClose: { padding: 4 },
  card: { 
    borderRadius: 16, 
    borderWidth: 1, 
    padding: 16, 
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // Extra spacing for web
      minHeight: 80, // Ensure cards have minimum height
    }),
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1' },
  pillActive: { backgroundColor: '#eab308' },
  pillText: { color: '#334155', fontWeight: '600' },
  pillTextActive: { color: '#1f2937' },
  arrayCard: { 
    borderRadius: 16, 
    borderWidth: 1, 
    padding: 16, 
    marginBottom: 14,
    ...(Platform.OS === 'web' && {
      marginBottom: 20, // Extra spacing for web
      minHeight: 120, // Ensure array cards have minimum height
    }),
  },
  arrayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arrayTitle: { fontSize: 16, fontWeight: '700' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sourceBadgeText: { color: '#065f46', fontSize: 11, fontWeight: '600' },
  overrideSection: { marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  overrideToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  overrideLabel: { fontSize: 14, fontWeight: '600' },
  overrideNote: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  rowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  inputLabel: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, minWidth: 120 },
  inputDisabled: { opacity: 0.6 },
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
  overrideInput: { borderWidth: 2, borderColor: '#B4F35B', backgroundColor: 'rgba(180, 243, 91, 0.05)' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 40 },
  totalText: { fontWeight: '700' },
  totalValue: { fontWeight: '800' },
  footer: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    padding: 16, 
    borderTopWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      paddingBottom: 24, // Extra padding for web
      minHeight: 80, // Ensure footer has minimum height
      marginBottom: 65, // Add margin for BottomNavigation on web
    }),
  },
  saveButton: { backgroundColor: '#16a34a', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonChanged: { backgroundColor: '#f59e0b' },
  saveText: { color: '#ffffff', fontWeight: '700' },
  unsavedIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#fef3c7', 
    borderColor: '#f59e0b', 
    borderWidth: 1, 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginBottom: 12 
  },
  unsavedText: { color: '#92400e', fontWeight: '600', fontSize: 14 },
  debugText: { fontSize: 12, marginBottom: 4 },
  
  // Orientation Validation Modal Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orientationModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Rounding Modal Styles
  roundingModalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  roundingModalIconContainer: {
    marginBottom: 24,
  },
  roundingModalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundingModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  roundingModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.85,
  },
  roundingModalProgressContainer: {
    width: '100%',
    marginTop: 8,
  },
  roundingModalProgressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  roundingModalProgressFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
  },
});
