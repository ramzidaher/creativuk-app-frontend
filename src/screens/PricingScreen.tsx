import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import CalculatorProgressService from '../services/CalculatorProgressService';
import BottomNavigation from '../components/BottomNavigation';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  calculatorType?: 'flux' | 'off-peak' | 'epvs' | 'v44';
  customerDetails?: any;
}

interface PricingOption {
  batteryType: '5kW' | '10kW';
  numberOfPanels: number;
  retailPrice: number;
}

interface AdditionalCost {
  item: string;
  cost: number;
  unit?: string;
}

interface SheetInfo {
  fileName: string;
  filePath: string;
  size: number;
  lastModified: string;
  calculatorType: 'off-peak' | 'flux' | 'epvs';
  version?: number;
}

export default function PricingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, calculatorType = 'off-peak', customerDetails } = route.params as RouteParams;
  const { theme, isDark } = useTheme();
  
  // Debug logging (reduced)
  // console.log('🔍 PricingScreen received params:', {
  //   opportunityId,
  //   calculatorType,
  //   customerDetails: customerDetails ? 'Present' : 'Missing'
  // });
  
  const [selectedBatteryType, setSelectedBatteryType] = useState<'5kW' | '10kW'>('5kW');
  const [selectedNumberOfPanels, setSelectedNumberOfPanels] = useState<number>(12);
  const [additionalItemQuantities, setAdditionalItemQuantities] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  
  // Payment method and related fields
  // v4.4 Excel: Cash | Finance | Interest Free Loan | HomeTree (shape Lease)
  // Flux/Off-peak: Cash | Hometree | New Finance
  const [paymentMethod, setPaymentMethod] = useState<
    'Cash' | 'Hometree' | 'New Finance' | 'Finance' | 'Interest Free Loan' | null
  >(null);
  const [deposit, setDeposit] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [interestRateType, setInterestRateType] = useState<string>('');
  const [paymentTerm, setPaymentTerm] = useState<string>('');
  const [leaseMonthlyPayment, setLeaseMonthlyPayment] = useState<string>('');
  const [interestRateTypeOptions, setInterestRateTypeOptions] = useState<string[]>([]);
  const [loadingDropdownOptions, setLoadingDropdownOptions] = useState(false);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSheetSelectionModal, setShowSheetSelectionModal] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedSheetForEdit, setSelectedSheetForEdit] = useState<SheetInfo | null>(null);
  const [editExisting, setEditExisting] = useState<boolean>(false);
  const [hasExistingFile, setHasExistingFile] = useState<boolean>(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [progressSummary, setProgressSummary] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedPricingData, setSavedPricingData] = useState<any>(null);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const [templateFileName, setTemplateFileName] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<SheetInfo | null>(null);
  const [deletingSheet, setDeletingSheet] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRestoringProgress = useRef<boolean>(false);



  // Check if current pricing data matches saved data
  const hasChanges = useCallback(() => {
    if (!savedPricingData) {
      console.log('🔍 PricingScreen hasChanges: No saved pricing data available');
      return false;
    }
    
    console.log('🔍 PricingScreen hasChanges: Comparing current vs saved values');
    console.log('🔍 Current pricing data:', {
      selectedBatteryType,
      selectedNumberOfPanels,
      additionalItemQuantities,
      paymentMethod,
      deposit,
      interestRate,
      interestRateType,
      paymentTerm,
      leaseMonthlyPayment,
    });
    console.log('🔍 Saved pricing data:', savedPricingData);
    
    // Get enabled fields for current payment method
    const enabledFields = getEnabledFields();
    console.log('🔍 Enabled fields for current payment method:', enabledFields);
    
    // Always compare basic pricing fields (excluding payment method since it's not restored)
    const basicChanges = (
      selectedBatteryType !== savedPricingData.selectedBatteryType ||
      selectedNumberOfPanels !== savedPricingData.selectedNumberOfPanels ||
      JSON.stringify(additionalItemQuantities) !== JSON.stringify(savedPricingData.additionalItemQuantities)
      // paymentMethod is intentionally excluded since it's not restored and user must always re-select
    );
    
    // Only compare payment method specific fields if they are enabled for the current payment method
    const paymentMethodChanges = (
      (enabledFields.deposit && deposit !== savedPricingData.deposit) ||
      (enabledFields.interestRate && interestRate !== savedPricingData.interestRate) ||
      (enabledFields.interestRateType && interestRateType !== savedPricingData.interestRateType) ||
      (enabledFields.paymentTerm && paymentTerm !== savedPricingData.paymentTerm) ||
      (enabledFields.leaseMonthlyPayment &&
        leaseMonthlyPayment !== (savedPricingData.leaseMonthlyPayment || ''))
    );
    
    const hasChangesResult = basicChanges || paymentMethodChanges;
    
    if (hasChangesResult) {
      console.log('🔍 PricingScreen hasChanges: Changes detected');
      if (basicChanges) {
        console.log('🔍 Basic pricing changes detected');
      }
      if (paymentMethodChanges) {
        console.log('🔍 Payment method specific changes detected');
      }
    } else {
      console.log('🔍 PricingScreen hasChanges: No changes detected - values match saved state');
    }
    
    return hasChangesResult;
  }, [selectedBatteryType, selectedNumberOfPanels, additionalItemQuantities, paymentMethod, deposit, interestRate, interestRateType, paymentTerm, leaseMonthlyPayment, savedPricingData]);

  // Pricing structure based on the image
  const pricingOptions: PricingOption[] = [
    // 5kW battery options
    { batteryType: '5kW', numberOfPanels: 6, retailPrice: 9995 },
    { batteryType: '5kW', numberOfPanels: 8, retailPrice: 10495 },
    { batteryType: '5kW', numberOfPanels: 10, retailPrice: 10995 },
    { batteryType: '5kW', numberOfPanels: 12, retailPrice: 11495 },
    { batteryType: '5kW', numberOfPanels: 14, retailPrice: 11995 },
    { batteryType: '5kW', numberOfPanels: 16, retailPrice: 12495 },
    { batteryType: '5kW', numberOfPanels: 18, retailPrice: 12995 },
    { batteryType: '5kW', numberOfPanels: 20, retailPrice: 13495 },
    
    // 10kW battery options
    { batteryType: '10kW', numberOfPanels: 6, retailPrice: 12495 },
    { batteryType: '10kW', numberOfPanels: 8, retailPrice: 12995 },
    { batteryType: '10kW', numberOfPanels: 10, retailPrice: 13495 },
    { batteryType: '10kW', numberOfPanels: 12, retailPrice: 13995 },
    { batteryType: '10kW', numberOfPanels: 14, retailPrice: 14295 },
    { batteryType: '10kW', numberOfPanels: 16, retailPrice: 14495 },
    { batteryType: '10kW', numberOfPanels: 18, retailPrice: 14695 },
    { batteryType: '10kW', numberOfPanels: 20, retailPrice: 14995 },
  ];

  const additionalCosts: AdditionalCost[] = [
    { item: 'Extra Panel', cost: 250, unit: 'each' },
    { item: 'Optimizers', cost: 55, unit: 'each' },
    { item: 'Smoke Detector', cost: 100 },
    { item: 'Extra 5kW battery', cost: 1750 },
    { item: 'EV Charger', cost: 1500 },
    { item: 'Extra scaffolding', cost: 595 },
    { item: 'Single story scaffolding', cost: 350 },
    { item: 'Extra elevation', cost: 250 },
    { item: 'Scaffolding over 9 metres', cost: 85, unit: 'per metre' },
    { item: 'Over 9m add.', cost: 30, unit: 'per metre' },
    { item: 'Flat roof mount', cost: 65 },
    { item: '3 phase inverters', cost: 2000 },
    { item: 'Extra Inverter over 28 panels', cost: 1200 },
  ];

  // Interest rate options for dropdown
  const interestRateOptions = [
    '0%',
    '2.5%',
    '3.0%',
    '3.5%',
    '4.0%',
    '4.5%',
    '5.0%',
    '5.5%',
    '6.0%',
    '6.5%',
    '7.0%',
    '7.5%',
    '8.0%',
    '8.5%',
    '9.0%',
    '9.5%',
    '10.0%'
  ];

  // Determine which fields should be enabled based on payment method
  // v4.4 mirrors Excel TogglePaymentMethod / Inputs yellow cells (screenshot SYSTEM COSTS)
  const getEnabledFields = () => {
    if (calculatorType === 'v44') {
      switch (paymentMethod) {
        case 'Cash':
          return {
            deposit: false,
            interestRate: false,
            interestRateType: false,
            paymentTerm: false,
            leaseMonthlyPayment: false,
          };
        case 'Finance':
          return {
            deposit: true,
            interestRate: true,
            interestRateType: true,
            paymentTerm: true,
            leaseMonthlyPayment: false,
          };
        case 'Interest Free Loan':
          return {
            deposit: true,
            interestRate: false,
            interestRateType: false,
            paymentTerm: true,
            leaseMonthlyPayment: false,
          };
        case 'Hometree':
          return {
            deposit: true,
            interestRate: false,
            interestRateType: false,
            paymentTerm: true,
            leaseMonthlyPayment: true,
          };
        default:
          return {
            deposit: false,
            interestRate: false,
            interestRateType: false,
            paymentTerm: false,
            leaseMonthlyPayment: false,
          };
      }
    }

    switch (paymentMethod) {
      case 'Cash':
        return {
          deposit: true,
          interestRate: false,
          interestRateType: false,
          paymentTerm: false,
          leaseMonthlyPayment: false,
        };
      case 'Hometree':
        return {
          deposit: false,
          interestRate: false,
          interestRateType: false,
          paymentTerm: true,
          leaseMonthlyPayment: false,
        };
      case 'New Finance':
        return {
          deposit: true,
          interestRate: true,
          interestRateType: true,
          paymentTerm: true,
          leaseMonthlyPayment: false,
        };
      default:
        return {
          deposit: false,
          interestRate: false,
          interestRateType: false,
          paymentTerm: false,
          leaseMonthlyPayment: false,
        };
    }
  };

  const paymentMethodOptions: Array<{
    value: 'Cash' | 'Hometree' | 'New Finance' | 'Finance' | 'Interest Free Loan';
    label: string;
  }> =
    calculatorType === 'v44'
      ? [
          { value: 'Cash', label: 'Cash' },
          { value: 'Interest Free Loan', label: 'Interest Free Loan' },
          { value: 'Finance', label: 'Finance' },
          { value: 'Hometree', label: 'HomeTree' },
        ]
      : [
          { value: 'Cash', label: 'Cash' },
          { value: 'Hometree', label: 'Hometree' },
          { value: 'New Finance', label: 'New Finance' },
        ];

  const checkForSavedProgress = useCallback(async () => {
    if (isInitialized || isRestoring) return;
    
    try {
      // Check for saved pricing data using CalculatorProgressService
      console.log('🔍 Checking for saved pricing data...');
      
      console.log('🔍 Checking for saved progress...');
      const progress = await CalculatorProgressService.restoreProgress(opportunityId, calculatorType);
      
      if (progress) {
        console.log('✅ Found saved progress:', {
          currentStep: progress.currentStep,
          hasPricingData: !!progress.pricingData,
          hasCustomerDetails: !!progress.customerDetails,
          pricingDataKeys: progress.pricingData ? Object.keys(progress.pricingData) : []
        });
        
        // Always restore customer details from saved progress first (JSON is source of truth)
        if (progress.customerDetails) {
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from saved progress:', progress.customerDetails);
          }
        } else if (customerDetails) {
          // Fallback to route params if saved progress doesn't have customer details
          const customerName = customerDetails.customerName || 'Loading...';
          const customerPostcode = customerDetails.postcode || 'Loading...';
          
          if (customerName !== 'Loading...' || customerPostcode !== 'Loading...') {
            setCustomerInfo({
              name: customerName,
              postcode: customerPostcode
            });
            console.log('✅ Customer details set from route params (fallback)');
          }
        }
        
        // Update progress indicators
        setHasSavedProgress(true);
        const summary = await CalculatorProgressService.getProgressSummary(opportunityId, calculatorType);
        setProgressSummary(summary);
        
        // Get template file name from saved progress
        if (progress.templateSelection?.templateFileName) {
          setTemplateFileName(progress.templateSelection.templateFileName);
          console.log('🔍 Using template file from saved progress:', progress.templateSelection.templateFileName);
        }
        
        // Auto-restore pricing data if it exists, regardless of current step
        if (progress.pricingData) {
          console.log('🔄 Auto-restoring pricing data from saved progress (excluding payment method):', progress.pricingData);
          isRestoringProgress.current = true;
          
          // Store the saved data for comparison
          setSavedPricingData(progress.pricingData);
          
          // Restore all pricing data EXCEPT payment method - user must always re-select
          if (progress.pricingData.selectedBatteryType) {
            setSelectedBatteryType(progress.pricingData.selectedBatteryType);
          }
          if (progress.pricingData.selectedNumberOfPanels) {
            setSelectedNumberOfPanels(progress.pricingData.selectedNumberOfPanels);
          }
          if (progress.pricingData.additionalItemQuantities) {
            setAdditionalItemQuantities(progress.pricingData.additionalItemQuantities);
          }
          // Payment method is intentionally NOT restored - user must always re-select
          // if (progress.pricingData.paymentMethod) {
          //   setPaymentMethod(progress.pricingData.paymentMethod);
          // }
          if (progress.pricingData.deposit) {
            setDeposit(progress.pricingData.deposit);
          }
          if (progress.pricingData.interestRate) {
            setInterestRate(progress.pricingData.interestRate);
          }
          if (progress.pricingData.interestRateType) {
            setInterestRateType(progress.pricingData.interestRateType);
          }
          if (progress.pricingData.paymentTerm) {
            setPaymentTerm(progress.pricingData.paymentTerm);
          }
          if (progress.pricingData.leaseMonthlyPayment) {
            setLeaseMonthlyPayment(progress.pricingData.leaseMonthlyPayment);
          }
          
          // Reset the flag immediately
          isRestoringProgress.current = false;
          setHasRestoredProgress(true);
          
          console.log('✅ Pricing data automatically restored and displayed in UI');
        } else {
          console.log('ℹ️ No saved pricing data found in progress');
          setHasSavedProgress(false);
          setProgressSummary(null);
          setHasRestoredProgress(false);
          setSavedPricingData(null);
        }
      } else {
        console.log('ℹ️ No saved progress found');
        
        // Fallback to route params if no saved progress
        if (customerDetails) {
          const customerName = customerDetails.customerName || 'Loading...';
          const customerPostcode = customerDetails.postcode || 'Loading...';
          
          if (customerName !== 'Loading...' || customerPostcode !== 'Loading...') {
            setCustomerInfo({
              name: customerName,
              postcode: customerPostcode
            });
            console.log('✅ Customer details set from route params (no saved progress)');
          }
        }
        
        setHasSavedProgress(false);
        setProgressSummary(null);
      }
    } catch (error) {
      console.error('❌ Error checking for saved progress:', error);
    } finally {
      setIsInitialized(true);
    }
  }, [opportunityId, calculatorType, isInitialized, isRestoring, customerDetails]);

  const fetchDropdownOptions = useCallback(async () => {
    try {
      setLoadingDropdownOptions(true);
      if (calculatorType === 'v44') {
        setInterestRateTypeOptions(['Fixed', 'APR']);
        return;
      }
      const { api } = await import('../utils/api');
      
      // Use different endpoints based on calculator type
      const endpoint = calculatorType === 'flux' ? '/epvs-automation/get-all-dropdown-options' : '/excel-automation/get-all-dropdown-options';
      
      // console.log(`🔍 Fetching dropdown options from: ${endpoint} for ${calculatorType} calculator`);
      
      const response = await api.post(endpoint, {
        opportunityId: opportunityId
      });
      
      const result = response.data as any;
      // console.log('Dropdown options response:', result);
      
      if (result.success && result.dropdownOptions) {
        // console.log('Available dropdown keys:', Object.keys(result.dropdownOptions));
        
        // Look for Interest Rate Type options in the dropdown data
        const interestRateTypeKey = Object.keys(result.dropdownOptions).find(key => 
          key.toLowerCase().includes('interest') && key.toLowerCase().includes('type')
        );
        
        // console.log('Found interest rate type key:', interestRateTypeKey);
        
        if (interestRateTypeKey && result.dropdownOptions[interestRateTypeKey]) {
          // console.log('Setting interest rate type options from Excel:', result.dropdownOptions[interestRateTypeKey]);
          setInterestRateTypeOptions(result.dropdownOptions[interestRateTypeKey]);
        } else {
          // Fallback to common interest rate types if not found in Excel
          // console.log('Interest rate type not found in Excel, using fallback options');
          setInterestRateTypeOptions(['APR', 'Fixed']);
        }
      } else {
        // Fallback to common interest rate types
        // console.log('No dropdown options from backend, using fallback options');
        setInterestRateTypeOptions(['APR', 'Fixed']);
      }
    } catch (error) {
      console.error('Error fetching dropdown options:', error);
      // Fallback to common interest rate types
      // console.log('Error occurred, using fallback interest rate type options');
      setInterestRateTypeOptions(['APR', 'Fixed']);
    } finally {
      setLoadingDropdownOptions(false);
    }
  }, [calculatorType, opportunityId]);


  const saveProgress = useCallback(async () => {
    if (!opportunityId || isRestoring || isRestoringProgress.current) return;
    
    try {
      // Get existing progress to preserve customer details
      const existingProgress = await CalculatorProgressService.getProgress(opportunityId, calculatorType);
      
      const pricingData = {
        selectedBatteryType,
        selectedNumberOfPanels,
        additionalItemQuantities,
        paymentMethod,
        totalSystemCost: totalCost.toString(),
        deposit,
        interestRate,
        interestRateType,
        paymentTerm,
        leaseMonthlyPayment,
      };

      const progressDataToSave: any = {
        currentStep: 'pricing' as const,
        pricingData,
        templateSelection: templateFileName ? {
          templateFileName: templateFileName,
          selectedOptions: {
            solar: true,
            battery: true,
            solarHybrid: true,
            batteryInverter: false
          }
        } : undefined,
      };
      
      // Preserve customer details from existing progress
      if (existingProgress?.customerDetails) {
        progressDataToSave.customerDetails = existingProgress.customerDetails;
      } else if (customerDetails) {
        // Fallback to route params if existing progress doesn't have customer details
        progressDataToSave.customerDetails = {
          customerName: customerDetails.customerName || '',
          address: customerDetails.address || '',
          postcode: customerDetails.postcode || '',
        };
      }

      await CalculatorProgressService.saveProgress(opportunityId, calculatorType, progressDataToSave);
      
      // Only log on first save or significant updates to reduce console spam
      // console.log('✅ Progress saved successfully');
    } catch (error) {
      console.error('❌ Error saving progress:', error);
    }
  }, [opportunityId, calculatorType, selectedBatteryType, selectedNumberOfPanels, additionalItemQuantities, paymentMethod, deposit, interestRate, interestRateType, paymentTerm, leaseMonthlyPayment, totalCost, templateFileName, isRestoring]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      // Double-check we're not restoring progress before saving
      if (!isRestoringProgress.current) {
        saveProgress();
      }
    }, 1000); // 1 second delay
  }, [saveProgress]);

  // Check for saved progress once on mount
  useEffect(() => {
    if (!isInitialized) {
      checkForSavedProgress();
    }
  }, [checkForSavedProgress, isInitialized]);

  // Calculate total cost when relevant values change
  useEffect(() => {
    calculateTotalCost();
  }, [selectedBatteryType, selectedNumberOfPanels, additionalItemQuantities]);

  // Auto-save when any pricing data changes
  useEffect(() => {
    if (isInitialized && !isRestoring && hasRestoredProgress) {
      debouncedSave();
    }
  }, [selectedBatteryType, selectedNumberOfPanels, additionalItemQuantities, paymentMethod, deposit, interestRate, interestRateType, paymentTerm, leaseMonthlyPayment, isInitialized, isRestoring, hasRestoredProgress, debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Set initial fallback options immediately - only APR and Fixed
    setInterestRateTypeOptions(['APR', 'Fixed']);
    // Then try to fetch from backend
    fetchDropdownOptions();
  }, [fetchDropdownOptions]); // Only re-run if the memoized function changes

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  const calculateTotalCost = () => {
    // Get base price for selected configuration
    const baseOption = pricingOptions.find(
      option => option.batteryType === selectedBatteryType && option.numberOfPanels === selectedNumberOfPanels
    );
    
    if (!baseOption) return;

    let total = baseOption.retailPrice;

    // Add additional costs
    Object.entries(additionalItemQuantities).forEach(([itemName, quantity]) => {
      if (quantity > 0) {
        const additionalItem = additionalCosts.find(cost => cost.item === itemName);
        if (additionalItem) {
          total += additionalItem.cost * quantity;
        }
      }
    });

    setTotalCost(total);
  };

  const handleBatteryTypeChange = (batteryType: '5kW' | '10kW') => {
    // Don't save if we're currently restoring progress
    if (isRestoringProgress.current) {
      return;
    }

    setSelectedBatteryType(batteryType);
    // Reset to first available panel count for the new battery type
    const firstOption = pricingOptions.find(option => option.batteryType === batteryType);
    if (firstOption) {
      setSelectedNumberOfPanels(firstOption.numberOfPanels);
    }
    // Auto-save progress with debouncing
    debouncedSave();
    
    // Auto-save the pricing data
    setTimeout(() => {
      // Auto-save is handled by the debounced save function
    }, 100);
  };

  const handlePanelCountChange = (numberOfPanels: number) => {
    // Don't save if we're currently restoring progress
    if (isRestoringProgress.current) {
      return;
    }

    setSelectedNumberOfPanels(numberOfPanels);
    // Auto-save progress with debouncing
    debouncedSave();
    
    // Auto-save the pricing data
    setTimeout(() => {
      // Auto-save is handled by the debounced save function
    }, 100);
  };

  const handleQuantityChange = (itemName: string, change: number) => {
    // Don't save if we're currently restoring progress
    if (isRestoringProgress.current) {
      return;
    }

    setAdditionalItemQuantities(prev => {
      const currentQuantity = prev[itemName] || 0;
      const newQuantity = Math.max(0, currentQuantity + change);
      
      if (newQuantity === 0) {
        const { [itemName]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [itemName]: newQuantity
      };
    });
    // Auto-save progress with debouncing
    debouncedSave();
    
    // Auto-save the pricing data
    setTimeout(() => {
      // Auto-save is handled by the debounced save function
    }, 100);
  };

  const selectPaymentMethodRadioButton = async (
    paymentMethod: 'Cash' | 'Hometree' | 'New Finance' | 'Finance' | 'Interest Free Loan',
  ) => {
    // Save payment method to JSON silently in the background (NO COM call - Excel update happens on final submit)
    try {
      // Get existing progress to preserve customer details
      const existingProgress = await CalculatorProgressService.getProgress(opportunityId, calculatorType);
      
      const progressDataToSave: any = {
        currentStep: 'pricing' as const,
        pricingData: {
          selectedBatteryType,
          selectedNumberOfPanels,
          additionalItemQuantities,
          paymentMethod: paymentMethod,
          totalSystemCost: totalCost.toString(),
          deposit: deposit || '',
          interestRate: interestRate || '',
          interestRateType: interestRateType || '',
          paymentTerm: paymentTerm || '',
          leaseMonthlyPayment: leaseMonthlyPayment || '',
        },
      };
      
      // Preserve customer details from existing progress
      if (existingProgress?.customerDetails) {
        progressDataToSave.customerDetails = existingProgress.customerDetails;
      } else if (customerDetails) {
        // Fallback to route params if existing progress doesn't have customer details
        progressDataToSave.customerDetails = {
          customerName: customerDetails.customerName || '',
          address: customerDetails.address || '',
          postcode: customerDetails.postcode || '',
        };
      }
      
      await CalculatorProgressService.saveProgress(opportunityId, calculatorType, progressDataToSave);
    } catch (radioButtonError) {
      console.warn(`⚠️ Failed to save payment method to JSON:`, radioButtonError);
    }
  };

  const handlePaymentMethodChange = (
    method: 'Cash' | 'Hometree' | 'New Finance' | 'Finance' | 'Interest Free Loan',
  ) => {
    // Don't save if we're currently restoring progress
    if (isRestoringProgress.current) {
      return;
    }

    // Don't process if the same method is already selected
    if (paymentMethod === method) {
      return;
    }

    // Immediately update the UI (instant feedback, no loading state)
    setPaymentMethod(method);

    // Clear fields that the new method disables (match Excel grey cells)
    if (calculatorType === 'v44') {
      if (method === 'Cash') {
        setDeposit('');
        setInterestRate('');
        setInterestRateType('');
        setPaymentTerm('');
        setLeaseMonthlyPayment('');
      } else if (method === 'Finance') {
        setLeaseMonthlyPayment('');
      } else if (method === 'Interest Free Loan') {
        setInterestRate('');
        setInterestRateType('');
        setLeaseMonthlyPayment('');
      } else if (method === 'Hometree') {
        setInterestRate('');
        setInterestRateType('');
      }
    }
    
    // Save to JSON in the background silently (no visual feedback)
    selectPaymentMethodRadioButton(method).catch((error) => {
      console.error('❌ Error in payment method change:', error);
    });
  };

  // Check if existing files exist for this opportunity
  const checkForExistingFiles = async (): Promise<boolean> => {
    try {
      const { api } = await import('../utils/api');
      const sheetsResponse = await api.post('/opportunity-workflow/get-opportunity-sheets', {
        opportunityId,
      });
      
      if (sheetsResponse.success) {
        const responseData = sheetsResponse.data as any;
        const actualData = responseData?.data || responseData;
        const sheets = Array.isArray(actualData) ? actualData : [];
        const hasExisting = sheets.length > 0;
        console.log('🔍 Checking for existing files:', {
          sheetsCount: sheets.length,
          hasExisting,
          calculatorType
        });
        return hasExisting;
      }
      return false;
    } catch (error) {
      console.error('Error checking for existing files:', error);
      return false;
    }
  };

  // Load available sheets for selection
  const loadAvailableSheets = async () => {
    try {
      setLoadingSheets(true);
      const { api } = await import('../utils/api');
      const sheetsResponse = await api.post('/opportunity-workflow/get-opportunity-sheets', {
        opportunityId,
      });
      
      console.log('📡 Sheet selection API Response:', sheetsResponse);
      
      if (sheetsResponse.success) {
        const responseData = sheetsResponse.data as any;
        const actualData = responseData?.data || responseData;
        const sheets = Array.isArray(actualData) ? actualData : [];
        console.log('📋 Available sheets for editing:', sheets);
        setAvailableSheets(sheets as SheetInfo[]);
      } else {
        throw new Error('Failed to load available sheets');
      }
    } catch (error) {
      console.error('Error loading sheets:', error);
      Alert.alert('Error', 'Failed to load available Excel files');
    } finally {
      setLoadingSheets(false);
    }
  };

  // Download sheet
  const handleDownloadSheet = async (sheet: SheetInfo) => {
    try {
      const { api, buildApiUrl, getStorage } = await import('../utils/api');
      
      if (Platform.OS === 'web') {
        // Web: Use direct fetch for binary downloads since API wrapper doesn't support arraybuffer
        const storage = getStorage();
        const token = storage ? await storage.getItem('accessToken') : null;
        
        if (!token) {
          Alert.alert('Error', 'Authentication required to download file');
          return;
        }
        
        const downloadUrl = buildApiUrl('/opportunity-workflow/sheet/download');
        
        const response = await fetch(downloadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'application/vnd.ms-excel.sheet.macroEnabled.12, application/octet-stream, */*'
          },
          body: JSON.stringify({
            opportunityId,
            fileName: sheet.fileName
          })
        });
        
        if (!response.ok) {
          // Try to parse error as JSON
          try {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }
            throw new Error(errorData.message || errorData.error || `Download failed: ${response.status}`);
          } catch (error) {
            throw error instanceof Error ? error : new Error(`Download failed: ${response.status}`);
          }
        }
        
        // Get the binary data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        // Check if response might be an error (small size might indicate JSON error response)
        if (arrayBuffer.byteLength < 1000) {
          try {
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(new Uint8Array(arrayBuffer.slice(0, 100)));
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              // This is likely a JSON error response
              const errorData = JSON.parse(textDecoder.decode(arrayBuffer));
              throw new Error(errorData.message || errorData.error || 'Download failed');
            }
          } catch (e) {
            // Not JSON, continue with download
          }
        }
        
        // Create blob from ArrayBuffer with correct MIME type
        const blob = new Blob([arrayBuffer], { 
          type: 'application/vnd.ms-excel.sheet.macroEnabled.12' 
        });
        
        // Verify blob size matches server size (if available)
        const expectedSize = sheet.size;
        if (expectedSize && blob.size !== expectedSize) {
          console.warn(`⚠️ Downloaded file size (${blob.size}) differs from server size (${expectedSize}), diff: ${Math.abs(blob.size - expectedSize)} bytes`);
          
          // If size difference is significant (> 10%), warn user
          const sizeDiffPercent = Math.abs(blob.size - expectedSize) / expectedSize;
          if (sizeDiffPercent > 0.1) {
            Alert.alert(
              'Warning',
              `Downloaded file size (${(blob.size / 1024 / 1024).toFixed(2)} MB) differs from server size (${(expectedSize / 1024 / 1024).toFixed(2)} MB). The file may be corrupted.`,
              [{ text: 'OK' }]
            );
          }
        }
        
        // Create blob URL and trigger download
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = sheet.fileName;
        // Set download attribute to force download
        link.setAttribute('download', sheet.fileName);
        // Ensure the link is added to DOM before clicking (required for some browsers)
        document.body.appendChild(link);
        link.click();
        // Clean up after a short delay
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
        
        console.log('✅ Sheet downloaded successfully:', sheet.fileName, `Size: ${blob.size} bytes (expected: ${expectedSize} bytes)`);
      } else {
        // Mobile: Use direct fetch for binary downloads
        const storage = getStorage();
        const token = storage ? await storage.getItem('accessToken') : null;
        
        if (!token) {
          Alert.alert('Error', 'Authentication required to download file');
          return;
        }
        
        const mobileDownloadUrl = buildApiUrl('/opportunity-workflow/sheet/download');
        
        const mobileResponse = await fetch(mobileDownloadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'application/vnd.ms-excel.sheet.macroEnabled.12, application/octet-stream, */*'
          },
          body: JSON.stringify({
            opportunityId,
            fileName: sheet.fileName
          })
        });
        
        if (!mobileResponse.ok) {
          const errorText = await mobileResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(errorText || `HTTP error! status: ${mobileResponse.status}`);
          }
          throw new Error(errorData.message || errorData.error || `Download failed: ${mobileResponse.status}`);
        }
        
        const mobileArrayBuffer = await mobileResponse.arrayBuffer();
        
        if (!mobileArrayBuffer || mobileArrayBuffer.byteLength === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        // For mobile, you might want to use FileSystem API or Linking
        console.log('Downloaded file:', sheet.fileName, `Size: ${mobileArrayBuffer.byteLength} bytes`);
        Alert.alert('Download', `File downloaded successfully: ${sheet.fileName}. Mobile file system integration required.`);
      }
    } catch (error: any) {
      console.error('Error downloading sheet:', error);
      Alert.alert('Error', error.message || 'Failed to download Excel file');
    }
  };

  // Delete sheet with confirmation
  const handleDeleteSheet = async (sheet: SheetInfo) => {
    setSheetToDelete(sheet);
    setShowDeleteModal(true);
  };

  const confirmDeleteSheet = async () => {
    if (!sheetToDelete) return;
    
    try {
      setDeletingSheet(true);
      const { api } = await import('../utils/api');
      
      // URL encode the filename for the DELETE endpoint
      const encodedFileName = encodeURIComponent(sheetToDelete.fileName);
      
      const response = await api.delete(`/opportunity-workflow/sheet/${encodedFileName}?opportunityId=${encodeURIComponent(opportunityId)}`);
      
      if (response.success && response.data) {
        const responseData = response.data as any;
        if (responseData.success) {
          // Remove from available sheets list
          setAvailableSheets(prev => prev.filter(s => s.fileName !== sheetToDelete.fileName));
          
          // Clear selection if deleted sheet was selected
          if (selectedSheetForEdit?.fileName === sheetToDelete.fileName) {
            setSelectedSheetForEdit(null);
          }
          
          Alert.alert('Success', 'Sheet deleted successfully');
          console.log('✅ Sheet deleted successfully:', sheetToDelete.fileName);
        } else {
          throw new Error(responseData.message || 'Failed to delete sheet');
        }
      } else {
        throw new Error(response.error || 'Failed to delete sheet');
      }
    } catch (error: any) {
      console.error('Error deleting sheet:', error);
      Alert.alert('Error', error.message || 'Failed to delete Excel file');
    } finally {
      setDeletingSheet(false);
      setShowDeleteModal(false);
      setSheetToDelete(null);
    }
  };

  // Helper function to extract version from filename
  const extractVersionFromFilename = (fileName: string): number => {
    const versionMatch = fileName.match(/-v(\d+)/i);
    if (versionMatch) {
      return parseInt(versionMatch[1], 10);
    }
    return 1;
  };

  // Helper function to generate version name
  const getVersionName = (sheet: SheetInfo) => {
    const baseName = sheet.calculatorType === 'flux' || sheet.calculatorType === 'epvs' 
      ? 'Flux Proposal' 
      : 'Off Peak Proposal';
    const version = sheet.version || extractVersionFromFilename(sheet.fileName);
    return `${baseName} V${version}`;
  };

  const handleSaveAndSubmit = async () => {
    try {
      // Validate that a payment method is selected
      if (!paymentMethod) {
        Alert.alert('⚠️ Payment Method Required', 'Please select a payment method before saving.');
        return;
      }

      const enabled = getEnabledFields();
      if (enabled.deposit && !deposit.trim()) {
        Alert.alert('Required', 'Please enter the Deposit / Upfront Payment.');
        return;
      }
      if (enabled.interestRate && !interestRate.trim()) {
        Alert.alert('Required', 'Please enter the Interest Rate.');
        return;
      }
      if (enabled.interestRateType && !interestRateType.trim()) {
        Alert.alert('Required', 'Please select the Interest Rate Type.');
        return;
      }
      if (enabled.paymentTerm && !paymentTerm.trim()) {
        Alert.alert('Required', 'Please enter the Payment Term (years).');
        return;
      }
      if (enabled.leaseMonthlyPayment && !leaseMonthlyPayment.trim()) {
        Alert.alert('Required', 'Please enter the Year 1 Monthly HomeTree Payment.');
        return;
      }

      // Check if existing files exist
      const hasExisting = await checkForExistingFiles();
      setHasExistingFile(hasExisting);
      
      // If first time (no existing files), default to creating new
      if (!hasExisting) {
        setEditExisting(false);
        // Proceed directly with submit (creating new)
        await performSubmit(false, null);
        return;
      }

      // If existing files found, show modal to choose
      setShowSubmitModal(true);
    } catch (error) {
      console.error('Error preparing submit:', error);
      Alert.alert('Error', 'Failed to prepare submission. Please try again.');
    }
  };

  const performSubmit = async (editExistingFile: boolean, selectedSheetFileName: string | null = null) => {
    try {
      setLoading(true);
      setShowSubmitModal(false);
      setShowSheetSelectionModal(false);

      // Determine Excel cells based on calculator type
      const cellMapping = calculatorType === 'flux' 
        ? {
            totalSystemCost: 'H81', // EPVS (Flux) - Total system cost
            deposit: 'H82',         // EPVS (Flux) - Deposit
            interestRate: 'H83',    // EPVS (Flux) - Interest Rate
            interestRateType: 'H84', // EPVS (Flux) - Interest Rate Type
            paymentTerm: 'H85'      // EPVS (Flux) - Payment Terms (years)
          }
        : {
            totalSystemCost: 'H80', // Off Peak - Total system cost
            deposit: 'H81',         // Off Peak - Deposit
            interestRate: 'H82',    // Off Peak - Interest Rate
            interestRateType: 'H83', // Off Peak - Interest Rate Type
            paymentTerm: 'H84'      // Off Peak - Payment Terms (years)
          };
      
      console.log(`💰 Saving pricing data to Excel cells for ${calculatorType} calculator`);
      console.log('Cell mapping:', cellMapping);
      console.log('Selected configuration:', {
        batteryType: selectedBatteryType,
        numberOfPanels: selectedNumberOfPanels,
        additionalItemQuantities,
        totalCost,
        paymentMethod,
        deposit,
        interestRate,
        interestRateType,
        paymentTerm
      });

      // Use the existing Excel automation API
      const { api } = await import('../utils/api');
      
      // Prepare inputs object for save-dynamic-inputs endpoint
      const inputs: Record<string, string> = {};
      
      // Always save total system cost
      inputs['total_system_cost'] = totalCost.toString();
      
      // Save component details
      inputs['selected_battery_type'] = selectedBatteryType;
      inputs['selected_number_of_panels'] = selectedNumberOfPanels.toString();
      
      // Save additional items quantities
      Object.entries(additionalItemQuantities).forEach(([itemName, quantity]) => {
        if (quantity > 0) {
          inputs[`additional_item_${itemName.toLowerCase().replace(/\s+/g, '_')}`] = quantity.toString();
        }
      });
      
      // Save payment method
      if (paymentMethod) {
      inputs['payment_method'] = paymentMethod;
      }
      
      // Only save fields that have values and are enabled for the current payment method
      const enabledFields = getEnabledFields();
      
      if (enabledFields.deposit && deposit) {
        inputs['deposit'] = deposit;
      }
      
      if (enabledFields.interestRate && interestRate) {
        inputs['interest_rate'] = interestRate;
      }
      
      if (enabledFields.interestRateType && interestRateType) {
        inputs['interest_rate_type'] = interestRateType;
      }
      
      if (enabledFields.paymentTerm && paymentTerm) {
        inputs['payment_term'] = paymentTerm;
      }

      if (enabledFields.leaseMonthlyPayment && leaseMonthlyPayment) {
        inputs['lease_monthly_payment'] = leaseMonthlyPayment;
      }

      console.log('Inputs to save:', inputs);

        // Save pricing data to JSON (NO COM call - Excel update happens on final submit)
        console.log('🔄 Save & Submit: Saving pricing data to JSON (NO COM call)');
        
        try {
          // First, get existing progress to preserve customer details
          const existingProgress = await CalculatorProgressService.getProgress(opportunityId, calculatorType);
          
          // Prepare pricing data with customer details preserved
          const progressDataToSave: any = {
            currentStep: 'pricing' as const,
            completedSteps: {
              'pricing': true,
            },
            pricingData: {
              selectedBatteryType,
              selectedNumberOfPanels,
              additionalItemQuantities,
              paymentMethod,
              totalSystemCost: totalCost.toString(),
              deposit: deposit || '',
              interestRate: interestRate || '',
              interestRateType: interestRateType || '',
              paymentTerm: paymentTerm || '',
              leaseMonthlyPayment: leaseMonthlyPayment || '',
            },
          };
          
          // Preserve customer details from existing progress if they exist
          if (existingProgress?.customerDetails) {
            progressDataToSave.customerDetails = existingProgress.customerDetails;
            console.log('✅ Preserving customer details in progress:', existingProgress.customerDetails);
          } else if (customerDetails) {
            // Fallback to route params if existing progress doesn't have customer details
            progressDataToSave.customerDetails = {
              customerName: customerDetails.customerName || '',
              address: customerDetails.address || '',
              postcode: customerDetails.postcode || '',
            };
            console.log('✅ Saving customer details from route params:', progressDataToSave.customerDetails);
          }
          
          // Preserve template selection if it exists
          if (existingProgress?.templateSelection) {
            progressDataToSave.templateSelection = existingProgress.templateSelection;
          } else if (templateFileName) {
            progressDataToSave.templateSelection = {
              templateFileName: templateFileName,
              selectedOptions: {
                solar: true,
                battery: true,
                solarHybrid: true,
                batteryInverter: false
              }
            };
          }
          
          await CalculatorProgressService.saveProgress(opportunityId, calculatorType, progressDataToSave);
        
        console.log(`✅ Pricing data saved to JSON successfully`);
        
        // Submit calculator to Excel (triggers single COM call with all saved JSON data)
        // This creates the Excel file with all calculator data (new file or new version of existing file)
        console.log('🚀 Submitting calculator to Excel (triggers COM operations)...', {
          editExisting: editExistingFile,
          selectedSheetFileName: selectedSheetFileName,
          willPassExistingFileName: !!selectedSheetFileName
        });
        try {
          console.log('📤 Calling submitCalculator with:', {
            opportunityId,
            calculatorType: calculatorType || 'flux',
            existingFileName: selectedSheetFileName || undefined,
            hasExistingFileName: !!selectedSheetFileName
          });
          
          // IMPORTANT: selectedSheetFileName must be passed to the backend API
          // The frontend CalculatorProgressService.submitCalculator must include existingFileName in the request body
          const submitResult = await CalculatorProgressService.submitCalculator(
            opportunityId,
            calculatorType || 'flux',
            selectedSheetFileName || undefined  // Pass filename when editing, undefined when creating new
          );
          
          console.log('📥 submitCalculator response:', {
            success: submitResult.success,
            message: submitResult.message,
            filePath: submitResult.filePath
          });
          
          if (!submitResult.success) {
            console.error('❌ Calculator submission failed:', submitResult.message);
            Alert.alert(
              '⚠️ Submission Failed',
              submitResult.message || 'Failed to submit calculator to Excel. Please try again.',
              [{ text: 'OK' }]
            );
            setLoading(false);
            return;
          }
          
          console.log('✅ Calculator submitted successfully to Excel:', submitResult.filePath);
          if (calculatorType === 'v44' && submitResult.filePath) {
            Alert.alert(
              'Calculator file created',
              `Saved to:\n${submitResult.filePath}\n\n(Flux/EPVS files go in epvs-opportunities — same as production)`,
              [{ text: 'OK' }],
            );
          }
        } catch (submitError) {
          console.error('❌ Error submitting calculator:', submitError);
          Alert.alert(
            '⚠️ Submission Error',
            'Failed to submit calculator to Excel. The pricing data was saved, but the Excel file was not created. Please try again.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
        
        // Mark the pricing step as completed in the workflow
        try {
          console.log('🎯 Marking pricing step as completed...');
          const { workflowApi } = await import('../utils/api');
          
          const result = await workflowApi.completeStep(opportunityId, 3, {
            calculatorType: calculatorType,
            completedAt: new Date().toISOString(),
            savedInputs: inputs,
            totalSystemCost: totalCost,
            paymentMethod: paymentMethod,
            deposit: deposit,
            interestRate: interestRate,
            interestRateType: interestRateType,
            paymentTerm: paymentTerm,
            leaseMonthlyPayment: leaseMonthlyPayment,
          });
          
          console.log('✅ Pricing step marked as completed:', result);
          
          // Verify the step was actually completed
          if (result && result.success) {
            console.log('🔍 Pricing step completed successfully, navigating to next step...');
            console.log('🔍 Navigation params:', { opportunityId });
            
            // Pricing data saved to JSON and Excel file created via submit
            // Navigate directly to Presentation screen without alert to ensure smooth flow
            navigation.navigate('Presentation', { opportunityId });
            
            console.log('🔍 Navigation call completed');
          } else {
            console.error('❌ Step completion failed:', result);
            Alert.alert('Error', 'Failed to complete pricing step. Please try again.');
          }
        } catch (workflowError) {
          console.error('Error marking pricing step as completed:', workflowError);
          Alert.alert('Error', 'Failed to complete pricing step. Please try again.');
        }
      } catch (saveError) {
        console.error('❌ Error saving pricing data to JSON:', saveError);
        Alert.alert(
          '⚠️ Save Failed',
          'Failed to save pricing data. Please check your connection and try again.'
        );
        setLoading(false);
        return;
      }

    } catch (error) {
      console.error('Error saving pricing:', error);
      Alert.alert('❌ Network Error', 'Failed to save pricing. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAvailablePanelCounts = (batteryType: '5kW' | '10kW') => {
    return pricingOptions
      .filter(option => option.batteryType === batteryType)
      .map(option => option.numberOfPanels)
      .sort((a, b) => a - b);
  };

  const getBasePrice = () => {
    const option = pricingOptions.find(
      option => option.batteryType === selectedBatteryType && option.numberOfPanels === selectedNumberOfPanels
    );
    return option?.retailPrice || 0;
  };

  const getAdditionalItemsTotal = () => {
    return Object.entries(additionalItemQuantities).reduce((total, [itemName, quantity]) => {
      if (quantity > 0) {
        const additionalItem = additionalCosts.find(cost => cost.item === itemName);
        return total + ((additionalItem?.cost || 0) * quantity);
      }
      return total;
    }, 0);
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
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>System Pricing</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {calculatorType === 'v44'
                  ? 'Calculator'
                  : calculatorType === 'flux'
                    ? 'Flux Calculator'
                    : 'Off Peak Calculator'}
              </Text>
            </View>
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
        ref={scrollViewRef}
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
        {/* Progress automatically restored on load - no manual restore dialog needed */}

        {/* Battery Type Selection */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Battery Type</Text>
          <View style={styles.batteryTypeContainer}>
            <TouchableOpacity
              style={[
                styles.batteryTypeButton,
                selectedBatteryType === '5kW' && { 
                  backgroundColor: theme.primaryButton + '20',
                  borderColor: theme.primaryButton 
                }
              ]}
              onPress={() => handleBatteryTypeChange('5kW')}
            >
              <Text style={[
                styles.batteryTypeText,
                selectedBatteryType === '5kW' && { color: theme.primaryButton }
              ]}>5kW Battery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.batteryTypeButton,
                selectedBatteryType === '10kW' && { 
                  backgroundColor: theme.primaryButton + '20',
                  borderColor: theme.primaryButton 
                }
              ]}
              onPress={() => handleBatteryTypeChange('10kW')}
            >
              <Text style={[
                styles.batteryTypeText,
                selectedBatteryType === '10kW' && { color: theme.primaryButton }
              ]}>10kW Battery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Panel Count Selection */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Number of Panels</Text>
          <View style={styles.panelCountContainer}>
            {getAvailablePanelCounts(selectedBatteryType).map(panelCount => (
              <TouchableOpacity
                key={panelCount}
                style={[
                  styles.panelCountButton,
                  selectedNumberOfPanels === panelCount && { 
                    backgroundColor: theme.primaryButton + '20',
                    borderColor: theme.primaryButton 
                  }
                ]}
                onPress={() => handlePanelCountChange(panelCount)}
              >
                <Text style={[
                  styles.panelCountText,
                  selectedNumberOfPanels === panelCount && { color: theme.primaryButton }
                ]}>{panelCount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Base Price Display */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Base System Price</Text>
          <View style={styles.priceDisplay}>
            <Text style={[styles.priceLabel, { color: theme.secondaryText }]}>Selected Configuration:</Text>
            <Text style={[styles.priceValue, { color: theme.primaryText }]}>
              £{getBasePrice().toLocaleString()}
            </Text>
            <Text style={[styles.priceDescription, { color: theme.secondaryText }]}>
              {selectedNumberOfPanels} Panels + {selectedBatteryType} Battery
            </Text>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
            {calculatorType === 'v44' ? 'System Costs — Payment Method' : 'Payment Method'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
            What payment method is the customer using?
            {calculatorType === 'v44'
              ? ' Fields below match the calculator (yellow = required for that method).'
              : ' (Please select even if you have saved data)'}
          </Text>
          <View style={styles.paymentMethodContainer}>
            {paymentMethodOptions.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === method.value && { 
                    backgroundColor: theme.primaryButton + '20',
                    borderColor: theme.primaryButton 
                  }
                ]}
                onPress={() => handlePaymentMethodChange(method.value)}
              >
                <View style={styles.paymentMethodContent}>
                  <View style={[
                    styles.radioCircle,
                    paymentMethod === method.value && styles.radioCircleSelected
                  ]}>
                    {paymentMethod === method.value && (
                      <View style={styles.radioCircleInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.paymentMethodText,
                    paymentMethod === method.value && { color: theme.primaryButton }
                  ]}>{method.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Details - Show based on payment method */}
        {(getEnabledFields().deposit || getEnabledFields().interestRate || getEnabledFields().interestRateType || getEnabledFields().paymentTerm || getEnabledFields().leaseMonthlyPayment) && (
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Payment Details</Text>
            <View style={styles.paymentDetailsContainer}>
              {getEnabledFields().deposit && (
                <View style={styles.inputField}>
                  <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
                    {calculatorType === 'v44' ? 'Deposit / Upfront Payment' : 'Deposit'}
                  </Text>
                  <View style={[styles.inputContainer, { borderColor: theme.cardBorder, backgroundColor: theme.secondaryBackground }]}>
                    <Text style={[styles.currencySymbol, { color: theme.secondaryText }]}>£</Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.primaryText }]}
                      value={deposit}
                      onChangeText={(text) => {
                        if (!isRestoringProgress.current) {
                          setDeposit(text);
                          // Auto-save the pricing data
                          setTimeout(() => {
                            // Auto-save is handled by the debounced save function
                          }, 500);
                        }
                      }}
                      placeholder="0.00"
                      placeholderTextColor={theme.secondaryText}
                      keyboardType="numeric"
                      editable={true}
                    />
                  </View>
                </View>
              )}

              {getEnabledFields().interestRate && (
                <View style={styles.inputField}>
                  <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Interest Rate (%)</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.cardBorder, backgroundColor: theme.secondaryBackground }]}>
                    <TextInput
                      style={[styles.textInput, { color: theme.primaryText }]}
                      value={interestRate}
                      onChangeText={(text) => {
                        if (!isRestoringProgress.current) {
                          setInterestRate(text);
                          // Auto-save the pricing data
                          setTimeout(() => {
                            // Auto-save is handled by the debounced save function
                          }, 500);
                        }
                      }}
                      placeholder="e.g., 3.5, 4.0, 5.5"
                      placeholderTextColor={theme.secondaryText}
                      keyboardType="numeric"
                      editable={true}
                    />
                    <Text style={[styles.percentageSymbol, { color: theme.secondaryText }]}>%</Text>
                  </View>
                </View>
              )}

              {getEnabledFields().interestRateType && (
                <View style={styles.inputField}>
                  <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Interest Rate Type</Text>
                  <TouchableOpacity
                    style={[styles.dropdownContainer, { borderColor: theme.cardBorder, backgroundColor: theme.secondaryBackground }]}
                    onPress={() => {
                      console.log('🔍 Dropdown clicked!');
                      console.log('🔍 Loading state:', loadingDropdownOptions);
                      console.log('🔍 Current options:', interestRateTypeOptions);
                      console.log('🔍 Options length:', interestRateTypeOptions.length);
                      
                      if (loadingDropdownOptions) {
                        Alert.alert('Loading', 'Please wait while dropdown options are loading...');
                        return;
                      }
                      
                      // Always show options - if none available, use fallback
                      const optionsToShow = interestRateTypeOptions.length > 0 
                        ? interestRateTypeOptions 
                        : ['APR', 'Fixed'];
                      
                      console.log('🔍 Options to show:', optionsToShow);
                      
                      // Show modal instead of Alert.alert for better web compatibility
                      setShowDropdownModal(true);
                    }}
                  >
                    <Text style={[
                      styles.dropdownText,
                      { color: interestRateType ? theme.primaryText : theme.secondaryText }
                    ]}>
                      {interestRateType || (loadingDropdownOptions ? 'Loading...' : 'Select interest rate type')}
                    </Text>
                    <Feather name="chevron-down" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              )}

              {getEnabledFields().paymentTerm && (
                <View style={styles.inputField}>
                  <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Payment Term (years)</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.cardBorder, backgroundColor: theme.secondaryBackground }]}>
                    <TextInput
                      style={[styles.textInput, { color: theme.primaryText }]}
                      value={paymentTerm}
                      onChangeText={(text) => {
                        if (!isRestoringProgress.current) {
                          setPaymentTerm(text);
                          // Auto-save the pricing data
                          setTimeout(() => {
                            // Auto-save is handled by the debounced save function
                          }, 500);
                        }
                      }}
                      placeholder={
                        calculatorType === 'v44' && paymentMethod === 'Hometree'
                          ? 'e.g., 25'
                          : 'e.g., 10, 15, 20'
                      }
                      placeholderTextColor={theme.secondaryText}
                      keyboardType="numeric"
                      editable={true}
                    />
                  </View>
                </View>
              )}

              {getEnabledFields().leaseMonthlyPayment && (
                <View style={styles.inputField}>
                  <Text style={[styles.inputLabel, { color: theme.primaryText }]}>
                    Year 1 Monthly HomeTree Payment
                  </Text>
                  <View style={[styles.inputContainer, { borderColor: theme.cardBorder, backgroundColor: theme.secondaryBackground }]}>
                    <Text style={[styles.currencySymbol, { color: theme.secondaryText }]}>£</Text>
                    <TextInput
                      style={[styles.textInput, { color: theme.primaryText }]}
                      value={leaseMonthlyPayment}
                      onChangeText={(text) => {
                        if (!isRestoringProgress.current) {
                          setLeaseMonthlyPayment(text);
                        }
                      }}
                      placeholder="e.g., 80.00"
                      placeholderTextColor={theme.secondaryText}
                      keyboardType="numeric"
                      editable={true}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Additional Items */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Additional Items</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
            Select quantities for any additional items you need
          </Text>
          <View style={styles.additionalItemsContainer}>
            {additionalCosts.map((item, index) => {
              const quantity = additionalItemQuantities[item.item] || 0;
              return (
                <View
                  key={index}
                  style={[
                    styles.additionalItemRow,
                    quantity > 0 && { 
                      backgroundColor: theme.primaryButton + '10',
                      borderColor: theme.primaryButton + '30'
                    }
                  ]}
                >
                  <View style={styles.additionalItemContent}>
                    <Text style={[
                      styles.additionalItemText,
                      quantity > 0 && { color: theme.primaryButton }
                    ]}>{item.item}</Text>
                    <Text style={[
                      styles.additionalItemCost,
                      quantity > 0 && { color: theme.primaryButton }
                    ]}>
                      £{item.cost.toLocaleString()}{item.unit ? ` ${item.unit}` : ''}
                    </Text>
                  </View>
                  
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={[
                        styles.quantityButton,
                        { backgroundColor: theme.primaryButton + '20' },
                        quantity === 0 && { opacity: 0.5 }
                      ]}
                      onPress={() => handleQuantityChange(item.item, -1)}
                      disabled={quantity === 0}
                    >
                      <Feather name="minus" size={16} color={theme.primaryButton} />
                    </TouchableOpacity>
                    
                    <View style={[styles.quantityDisplay, { borderColor: theme.cardBorder }]}>
                      <Text style={[
                        styles.quantityText,
                        { color: quantity > 0 ? theme.primaryButton : theme.secondaryText }
                      ]}>
                        {quantity}
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      style={[
                        styles.quantityButton,
                        { backgroundColor: theme.primaryButton + '20' }
                      ]}
                      onPress={() => handleQuantityChange(item.item, 1)}
                    >
                      <Feather name="plus" size={16} color={theme.primaryButton} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Total Cost Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>Total System Cost</Text>
          <View style={styles.costBreakdown}>
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: theme.secondaryText }]}>Base System:</Text>
              <Text style={[styles.costValue, { color: theme.primaryText }]}>
                £{getBasePrice().toLocaleString()}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: theme.secondaryText }]}>Additional Items:</Text>
              <Text style={[styles.costValue, { color: theme.primaryText }]}>
                £{getAdditionalItemsTotal().toLocaleString()}
              </Text>
            </View>
            <View style={[styles.costRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: theme.primaryText }]}>Total:</Text>
              <Text style={[styles.totalValue, { color: theme.primaryButton }]}>
                £{totalCost.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Skip Button - Only show if user has pricing data AND we restored progress AND no changes from saved state */}
        {(() => {
          // Check if payment method is selected
          const hasPaymentMethod = !!paymentMethod;
          
          // Check if required fields for the selected payment method are filled
          const enabledFields = getEnabledFields();
          const hasRequiredFields = (
            (!enabledFields.deposit || (enabledFields.deposit && deposit.trim() !== '')) &&
            (!enabledFields.interestRate || (enabledFields.interestRate && interestRate.trim() !== '')) &&
            (!enabledFields.interestRateType || (enabledFields.interestRateType && interestRateType.trim() !== '')) &&
            (!enabledFields.paymentTerm || (enabledFields.paymentTerm && paymentTerm.trim() !== '')) &&
            (!enabledFields.leaseMonthlyPayment ||
              (enabledFields.leaseMonthlyPayment && leaseMonthlyPayment.trim() !== ''))
          );
          
          const canSkip = hasPaymentMethod && hasRequiredFields && hasRestoredProgress && savedPricingData && !hasChanges();
          
          console.log('🔍 PricingScreen Skip button conditions:', {
            hasPaymentMethod,
            hasRequiredFields,
            enabledFields,
            hasRestoredProgress,
            hasSavedPricingData: !!savedPricingData,
            hasChanges: hasChanges(),
            canSkip,
            currentValues: {
              deposit: deposit.trim(),
              interestRate: interestRate.trim(),
              interestRateType: interestRateType.trim(),
              paymentTerm: paymentTerm.trim(),
              leaseMonthlyPayment: leaseMonthlyPayment.trim(),
            }
          });
          
          return canSkip;
        })() && (
          <TouchableOpacity
            style={[styles.skipButton, { 
              borderColor: theme.dangerButton,
              backgroundColor: theme.dangerButton + '10'
            }]}
            onPress={async () => {
              console.log('🔍 PricingScreen Skip button pressed - navigating to Presentation');
              try {
                // Get existing progress to preserve customer details
                const existingProgress = await CalculatorProgressService.getProgress(opportunityId, calculatorType);
                
                const progressDataToSave: any = {
                  currentStep: 'pricing' as const,
                  completedSteps: {
                    'pricing': true,
                  },
                  templateSelection: templateFileName ? {
                    templateFileName: templateFileName,
                    selectedOptions: {
                      solar: true,
                      battery: true,
                      solarHybrid: true,
                      batteryInverter: false
                    }
                  } : undefined,
                };
                
                // Preserve customer details from existing progress
                if (existingProgress?.customerDetails) {
                  progressDataToSave.customerDetails = existingProgress.customerDetails;
                } else if (customerDetails) {
                  // Fallback to route params if existing progress doesn't have customer details
                  progressDataToSave.customerDetails = {
                    customerName: customerDetails.customerName || '',
                    address: customerDetails.address || '',
                    postcode: customerDetails.postcode || '',
                  };
                }
                
                // Mark pricing step as completed
                await CalculatorProgressService.saveProgress(opportunityId, calculatorType, progressDataToSave);
                
                // Navigate directly to Presentation screen
                navigation.navigate('Presentation', { opportunityId });
              } catch (error) {
                console.error('Error skipping pricing step:', error);
                Alert.alert('Error', 'Failed to skip pricing step. Please try again.');
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

        {/* Save and Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: paymentMethod ? theme.primaryButton : theme.borderColor },
            (loading || !paymentMethod) && { opacity: 0.7 }
          ]}
          onPress={handleSaveAndSubmit}
          disabled={loading || !paymentMethod}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Feather name="save" size={20} color="#ffffff" />
          )}
          <Text style={[styles.submitButtonText, { color: '#ffffff' }]}>
            {loading ? 'Saving...' : (!paymentMethod ? 'Select Payment Method First' : 'Save & Submit')}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdownModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdownModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Interest Rate Type</Text>
            
            {/* Always show fallback options */}
            {(interestRateTypeOptions.length > 0 ? interestRateTypeOptions : ['APR', 'Fixed']).map((option, index) => (
              <TouchableOpacity
                key={`interest-rate-${option}-${index}`}
                style={[
                  styles.modalOption,
                  { 
                    borderBottomColor: theme.cardBorder,
                    backgroundColor: interestRateType === option ? theme.primaryButton + '20' : 'transparent'
                  }
                ]}
                onPress={() => {
                  console.log('🔍 Selected option:', option);
                  if (!isRestoringProgress.current) {
                    setInterestRateType(option);
                    // Auto-save the pricing data
                    setTimeout(() => {
                      // Auto-save is handled by the debounced save function
                    }, 100);
                  }
                  setShowDropdownModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  { 
                    color: interestRateType === option ? theme.primaryButton : theme.primaryText,
                    fontWeight: interestRateType === option ? '600' : '400'
                  }
                ]}>
                  {option}
                </Text>
                {interestRateType === option && (
                  <Feather name="check" size={20} color={theme.primaryButton} />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
              onPress={() => setShowDropdownModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Submit Choice Modal */}
      <Modal
        visible={showSubmitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Create or Edit File?
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              An existing Excel file was found for this opportunity. Would you like to edit it or create a new one?
            </Text>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                { 
                  borderBottomColor: theme.cardBorder,
                  backgroundColor: !editExisting ? theme.primaryButton + '20' : 'transparent',
                  borderLeftWidth: !editExisting ? 3 : 0,
                  borderLeftColor: !editExisting ? theme.primaryButton : 'transparent'
                }
              ]}
              onPress={() => {
                setEditExisting(false);
                console.log('🔍 Selected: Create New');
              }}
            >
              <View style={styles.modalOptionRow}>
                <Feather 
                  name={!editExisting ? "check-circle" : "circle"} 
                  size={20} 
                  color={!editExisting ? theme.primaryButton : theme.secondaryText} 
                />
                <View style={styles.modalOptionContent}>
                  <Text style={[styles.modalOptionText, { color: theme.primaryText, fontWeight: !editExisting ? '700' : '500' }]}>
                    Create New File
                  </Text>
                  <Text style={[styles.modalOptionDescription, { color: theme.secondaryText }]}>
                    Create a new Excel file with the current calculator data
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalOption,
                { 
                  borderBottomColor: theme.cardBorder,
                  backgroundColor: editExisting ? theme.primaryButton + '20' : 'transparent',
                  borderLeftWidth: editExisting ? 3 : 0,
                  borderLeftColor: editExisting ? theme.primaryButton : 'transparent'
                }
              ]}
              onPress={async () => {
                setEditExisting(true);
                console.log('🔍 Selected: Edit Existing - Loading sheets...');
                // Load available sheets and show sheet selection modal
                await loadAvailableSheets();
                setShowSubmitModal(false);
                setShowSheetSelectionModal(true);
              }}
            >
              <View style={styles.modalOptionRow}>
                <Feather 
                  name={editExisting ? "check-circle" : "circle"} 
                  size={20} 
                  color={editExisting ? theme.primaryButton : theme.secondaryText} 
                />
                <View style={styles.modalOptionContent}>
                  <Text style={[styles.modalOptionText, { color: theme.primaryText, fontWeight: editExisting ? '700' : '500' }]}>
                    Edit Existing File
                  </Text>
                  <Text style={[styles.modalOptionDescription, { color: theme.secondaryText }]}>
                    Update the existing Excel file with the current calculator data
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowWarningModal(true)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.warningNote, { backgroundColor: theme.dangerButton + '10', borderColor: theme.dangerButton + '30' }]}>
                      <Feather name="alert-triangle" size={14} color={theme.dangerButton} />
                      <Text style={[styles.warningNoteText, { color: theme.dangerButton }]}>
                        Note: All existing data will be overwritten. A new version will be created. (Tap to read more)
                      </Text>
                      <Feather name="info" size={14} color={theme.dangerButton} style={{ marginLeft: 4 }} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
                onPress={() => {
                  setShowSubmitModal(false);
                  setEditExisting(false);
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: theme.primaryButton }]}
                onPress={async () => {
                  if (editExisting) {
                    // If edit existing, show sheet selection modal instead
                    await loadAvailableSheets();
                    setShowSubmitModal(false);
                    setShowSheetSelectionModal(true);
                  } else {
                    // If create new, proceed directly
                    await performSubmit(false, null);
                  }
                }}
              >
                <Text style={[styles.modalConfirmText, { color: '#ffffff' }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sheet Selection Modal */}
      <Modal
        visible={showSheetSelectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSheetSelectionModal(false);
          setSelectedSheetForEdit(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.sheetSelectionModalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Select File to Edit
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              Choose which Excel file you want to update with the current calculator data
            </Text>
            
            {loadingSheets ? (
              <View style={styles.sheetLoadingContainer}>
                <ActivityIndicator size="large" color={theme.primaryButton} />
                <Text style={[styles.sheetLoadingText, { color: theme.secondaryText }]}>
                  Loading available files...
                </Text>
              </View>
            ) : availableSheets.length === 0 ? (
              <View style={styles.noSheetsContainer}>
                <Feather name="file" size={48} color={theme.secondaryText} />
                <Text style={[styles.noSheetsText, { color: theme.secondaryText }]}>
                  No Excel files found
                </Text>
              </View>
            ) : (() => {
              // Filter sheets to only show files matching the current calculator type
              const filteredSheets = availableSheets.filter(sheet => {
                // Normalize calculator types: 'flux' and 'epvs' both map to 'flux'
                const isCurrentFlux = calculatorType === 'flux' || calculatorType === 'epvs';
                const currentType = isCurrentFlux ? 'flux' : 'off-peak';
                const isSheetFlux = sheet.calculatorType === 'flux' || sheet.calculatorType === 'epvs';
                const sheetType = isSheetFlux ? 'flux' : 'off-peak';
                return currentType === sheetType;
              });

              // Sort sheets by version
              const sortedSheets = [...filteredSheets].sort((a, b) => {
                const versionA = a.version || extractVersionFromFilename(a.fileName);
                const versionB = b.version || extractVersionFromFilename(b.fileName);
                return versionA - versionB;
              });

              if (sortedSheets.length === 0) {
                return (
                  <View style={styles.noSheetsContainer}>
                    <Feather name="file" size={48} color={theme.secondaryText} />
                    <Text style={[styles.noSheetsText, { color: theme.secondaryText }]}>
                      No {(calculatorType === 'flux' || calculatorType === 'epvs') ? 'Flux' : 'Off Peak'} calculator files found
                    </Text>
                  </View>
                );
              }

              const isEPVS = (calculatorType === 'flux' || calculatorType === 'epvs');

              return (
                <ScrollView 
                  style={styles.sheetSelectionScrollView}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.sheetGroupContainer}>
                    <View style={styles.sheetGroupHeader}>
                      <View style={[
                        styles.sheetGroupIcon,
                        { 
                          backgroundColor: isEPVS ? '#10b981' : '#3b82f6',
                          borderColor: isEPVS ? '#059669' : '#2563eb'
                        }
                      ]}>
                        <Feather 
                          name={isEPVS ? 'zap' : 'settings'} 
                          size={16} 
                          color="#ffffff" 
                        />
                      </View>
                      <Text style={[styles.sheetGroupTitle, { color: theme.primaryText }]}>
                        {isEPVS ? 'Flux Calculator Files' : 'Off Peak Calculator Files'}
                      </Text>
                      <Text style={[styles.sheetGroupCount, { color: theme.secondaryText }]}>
                        {sortedSheets.length} file{sortedSheets.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    
                    {sortedSheets.map((sheet, index) => {
                      const isSelected = selectedSheetForEdit?.fileName === sheet.fileName;
                      const versionName = getVersionName(sheet);
                      
                      return (
                        <View
                          key={`${sheet.fileName}-${index}`}
                          style={[
                            styles.sheetSelectionOption,
                            { 
                              backgroundColor: theme.cardBackground,
                              borderColor: theme.cardBorder
                            },
                            isSelected && { 
                              borderColor: theme.primaryButton,
                              backgroundColor: isDark 
                                ? theme.primaryButton + '20' 
                                : theme.primaryButton + '10'
                            }
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.sheetSelectionTouchable}
                            onPress={() => {
                              setSelectedSheetForEdit(sheet);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.sheetSelectionInfo}>
                              <View style={styles.sheetSelectionHeader}>
                                <View style={[
                                  styles.sheetSelectionBadge,
                                  { 
                                    backgroundColor: isEPVS ? '#10b981' : '#3b82f6',
                                    borderColor: isEPVS ? '#059669' : '#2563eb'
                                  }
                                ]}>
                                  <Feather 
                                    name={isEPVS ? 'zap' : 'settings'} 
                                    size={14} 
                                    color="#ffffff" 
                                  />
                                </View>
                                <View style={styles.sheetSelectionNameContainer}>
                                  <Text style={[styles.sheetSelectionName, { color: theme.primaryText }]}>
                                    {versionName}
                                  </Text>
                                  <Text style={[
                                    styles.sheetSelectionTypeLabel,
                                    { color: isEPVS ? '#059669' : '#2563eb' }
                                  ]}>
                                    {isEPVS ? 'Flux Calculator' : 'Off Peak Calculator'}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.sheetSelectionDetails}>
                                <Text style={[styles.sheetSelectionSize, { color: theme.secondaryText }]}>
                                  {(sheet.size / 1024 / 1024).toFixed(1)} MB
                                </Text>
                                <Text style={[styles.sheetSelectionDate, { color: theme.secondaryText }]}>
                                  {new Date(sheet.lastModified).toLocaleString()}
                                </Text>
                              </View>
                            </View>
                            {isSelected && (
                              <Feather name="check-circle" size={20} color={theme.primaryButton} />
                            )}
                          </TouchableOpacity>
                          <View style={styles.sheetActionButtons}>
                            <TouchableOpacity
                              style={[styles.sheetActionButton, { backgroundColor: theme.primaryButton + '20' }]}
                              onPress={() => handleDownloadSheet(sheet)}
                              activeOpacity={0.7}
                            >
                              <Feather name="download" size={16} color={theme.primaryButton} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sheetActionButton, { backgroundColor: theme.dangerButton + '20' }]}
                              onPress={() => handleDeleteSheet(sheet)}
                              activeOpacity={0.7}
                            >
                              <Feather name="trash-2" size={16} color={theme.dangerButton} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              );
            })()}
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder }]}
                onPress={() => {
                  setShowSheetSelectionModal(false);
                  setSelectedSheetForEdit(null);
                  setShowSubmitModal(true);
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton, 
                  { 
                    backgroundColor: selectedSheetForEdit ? theme.primaryButton : theme.borderColor,
                    opacity: selectedSheetForEdit ? 1 : 0.5
                  }
                ]}
                onPress={async () => {
                  if (selectedSheetForEdit) {
                    await performSubmit(true, selectedSheetForEdit.fileName);
                  } else {
                    Alert.alert('Selection Required', 'Please select a file to edit.');
                  }
                }}
                disabled={!selectedSheetForEdit}
              >
                <Text style={[styles.modalConfirmText, { color: '#ffffff' }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warning Information Modal */}
      <Modal
        visible={showWarningModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={[styles.warningModalIcon, { backgroundColor: theme.dangerButton + '20' }]}>
              <Feather name="alert-triangle" size={32} color={theme.dangerButton} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Important Notice
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              When you choose to edit an existing file:
            </Text>
            <View style={[styles.warningModalContent, { backgroundColor: theme.dangerButton + '10', borderColor: theme.dangerButton + '30' }]}>
              <Text style={[styles.warningModalText, { color: theme.dangerButton }]}>
                • All existing data in the Excel file will be overwritten with your current calculator data{'\n'}
                • The file has all new data{'\n'}
                • This action cannot be undone once completed
              </Text>
            </View>
            <Text style={[styles.warningModalSuggestion, { color: theme.secondaryText }]}>
              If you want to keep the existing file unchanged, choose "Create New File" instead.
            </Text>
            
            <TouchableOpacity
              style={[styles.modalConfirmButton, { backgroundColor: theme.dangerButton, marginTop: 20 }]}
              onPress={() => setShowWarningModal(false)}
            >
              <Text style={[styles.modalConfirmText, { color: '#ffffff' }]}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setSheetToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={[styles.deleteModalIcon, { backgroundColor: theme.dangerButton + '20' }]}>
              <Feather name="trash-2" size={32} color={theme.dangerButton} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Delete File?
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              Are you sure you want to delete "{sheetToDelete?.fileName}"? This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderTopColor: theme.cardBorder, flex: 1 }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setSheetToDelete(null);
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: theme.dangerButton, flex: 1 }]}
                onPress={confirmDeleteSheet}
                disabled={deletingSheet}
              >
                {deletingSheet ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: '#ffffff' }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
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
  
  // Header Styles
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
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Section Cards
  sectionCard: {
    marginBottom: 20,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  
  // Battery Type Selection
  batteryTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  batteryTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  batteryTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Panel Count Selection
  panelCountContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  panelCountButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    minWidth: 60,
    alignItems: 'center',
  },
  panelCountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Price Display
  priceDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: width < 768 ? 32 : 36,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  priceDescription: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Additional Items
  additionalItemsContainer: {
    gap: 12,
  },
  additionalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  additionalItemContent: {
    flex: 1,
  },
  additionalItemText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  additionalItemCost: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Quantity Controls
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  quantityDisplay: {
    minWidth: 48,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Payment Method Styles
  paymentMethodContainer: {
    gap: 12,
  },
  paymentMethodButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 12,
  },
  
  // Radio Button Styles (reused from other components)
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
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
  
  // Payment Details Styles
  paymentDetailsContainer: {
    gap: 20,
  },
  inputField: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  percentageSymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
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
  },
  summaryTitle: {
    fontSize: width < 768 ? 20 : 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  costBreakdown: {
    gap: 16,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 16,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  
  // Skip Button
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
  
  // Submit Button
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 18 : 20,
    borderRadius: 20,
    marginBottom: 24,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  
  // Info Container
  infoContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  warningNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    gap: 8,
  },
  warningNoteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  warningModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  warningModalContent: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
  },
  warningModalText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  warningModalSuggestion: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  modalOptionContent: {
    flex: 1,
    gap: 4,
  },
  modalOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  modalButtonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
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
  
  // Sheet Selection Modal Styles
  sheetSelectionModalContent: {
    maxHeight: '80%',
    maxWidth: width < 768 ? '90%' : 600,
  },
  sheetSelectionScrollView: {
    maxHeight: 400,
    marginVertical: 16,
  },
  sheetLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  sheetLoadingText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  noSheetsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSheetsText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  sheetGroupContainer: {
    marginBottom: 24,
  },
  sheetGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    gap: 8,
  },
  sheetGroupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  sheetGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sheetGroupCount: {
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sheetSelectionOption: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  sheetSelectionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  sheetActionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 8,
  },
  sheetActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSelectionInfo: {
    flex: 1,
  },
  sheetSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  sheetSelectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  sheetSelectionNameContainer: {
    flex: 1,
  },
  sheetSelectionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  sheetSelectionTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetSelectionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 34,
  },
  sheetSelectionSize: {
    fontSize: 12,
    fontWeight: '500',
  },
  sheetSelectionDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Selection Modal Styles
  selectionModalContent: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  selectionModalIcon: {
    marginBottom: 20,
  },
  selectionModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  selectionModalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  selectionModalProgress: {
    width: '100%',
    alignItems: 'center',
  },
  selectionModalProgressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  selectionModalProgressFill: {
    height: '100%',
    width: '70%',
    borderRadius: 3,
    // Add a subtle animation effect
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
