import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import ExcelSheetPicker from '../components/ExcelSheetPicker';
import { useTheme } from '../context/ThemeContext';
import { api } from '../utils/api';
import { ExcelSheetInfo, getExcelSheetDisplayName, isV44Sheet } from '../utils/excelSheetVersion';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  calculatorType?: 'epvs' | 'off-peak' | 'flux' | 'v44';
}

type SheetInfo = ExcelSheetInfo & {
  filePath: string;
  size: number;
  lastModified: string;
};

const normalizePaymentTypeLabel = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('finance')) return 'Finance';
  if (lower.includes('hometree') || lower.includes('lease')) return 'Hometree';
  return raw;
};

const paymentTypeKey = (raw: string | null | undefined): string =>
  normalizePaymentTypeLabel(raw).toLowerCase();

interface SolarProjectionData {
  title: string;
  summary: {
    paymentType: string | null;
    term: string | null;
    monthlyPlanCost: number | null;
    yearlyPlanCost: number | null;
    yearlySavingYear1: number | null;
    yearlyContributionYear1: number | null;
    lifetimeProfit: number | null;
    totalSavings: number | null;
    paymentTerm: number | null;
    calculatorType: string;
  };
  table: {
    headers: string[];
    rows: string[][];
  };
  metadata: {
    sheetName: string;
    extractedAt: string;
    sourceFile: string;
  };
}

interface SelectedCell {
  row: number;
  col: number;
  value: string;
}

type Step = 'sheets' | 'projection';

export default function SolarProjectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, calculatorType: routeCalculatorType } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  // Step management
  const [step, setStep] = useState<Step>('sheets');
  
  // Sheet selection state
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(true);
  
  // Solar projection data state
  const [solarData, setSolarData] = useState<SolarProjectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [selectedSum, setSelectedSum] = useState<number>(0);
  const [columnSelections, setColumnSelections] = useState<Record<string, SelectedCell[]>>({});
  const [isCompletingStep, setIsCompletingStep] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartCell, setDragStartCell] = useState<{ row: number; col: number } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [selectedSavingYear, setSelectedSavingYear] = useState<number>(1);
  const [selectedContributionYear, setSelectedContributionYear] = useState<number>(1);
  const [showSavingYearDropdown, setShowSavingYearDropdown] = useState(false);
  const [showContributionYearDropdown, setShowContributionYearDropdown] = useState(false);
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [showTermsDropdown, setShowTermsDropdown] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isUpdatingTerms, setIsUpdatingTerms] = useState(false);
  /** v4.4: edit locally then Recalculate (Excel savings no longer embeds payment toggles) */
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<string>('');
  const [draftTerm, setDraftTerm] = useState<string>('');
  const [draftMonthly, setDraftMonthly] = useState<string>('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentScale, setContentScale] = useState(1);
  const isV44 = isV44Sheet(selectedSheet) || routeCalculatorType === 'v44';

  useEffect(() => {
    loadAvailableSheets();
  }, [opportunityId]);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  const loadAvailableSheets = async () => {
    try {
      setLoadingSheets(true);
      console.log(`🔍 Loading available sheets for opportunity: ${opportunityId}`);
      
      // Get available Excel files for this opportunity
      const sheetsResponse = await api.post('/opportunity-workflow/get-opportunity-sheets', {
        opportunityId,
      });
      
      console.log('📡 API Response:', sheetsResponse);
      
      if (sheetsResponse.success) {
        // The API utility wraps the response, so we need to access response.data.data
        const responseData = sheetsResponse.data as any;
        const actualData = responseData?.data || responseData;
        const sheets = (Array.isArray(actualData) ? actualData : []) as SheetInfo[];
        console.log('📋 Available sheets:', sheets);
        console.log('📋 Sheet details with versions:', sheets.map(sheet => ({
          fileName: sheet.fileName,
          calculatorType: sheet.calculatorType,
          version: sheet.version,
          hasVersion: 'version' in sheet
        })));
        setAvailableSheets(sheets);

        // Prefer selecting the matching calculator type in the list, but always keep the picker
        // so reps can choose between v4.4 / flux / off-peak versions for this opportunity.
        if (routeCalculatorType === 'v44') {
          const v44Sheet =
            sheets.find((s) => isV44Sheet(s)) ||
            sheets.find((s) => (s.fileName || '').toLowerCase().includes('v4.4'));
          if (v44Sheet) {
            setSelectedSheet(v44Sheet);
          }
        } else if (routeCalculatorType) {
          const match = sheets.find((s) => s.calculatorType === routeCalculatorType);
          if (match) {
            setSelectedSheet(match);
          }
        }
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

  const handleSheetSelect = async (sheet: SheetInfo) => {
    try {
      console.log(`🔍 Selected sheet details:`, {
        fileName: sheet.fileName,
        calculatorType: sheet.calculatorType,
        version: sheet.version,
        size: sheet.size,
        lastModified: sheet.lastModified
      });
      setSelectedSheet(sheet);
      setStep('projection');
      await loadSolarProjectionData(sheet);
    } catch (error) {
      console.error('Error selecting sheet:', error);
      Alert.alert('Error', 'Failed to load solar projection data from selected sheet');
    }
  };

  const loadSolarProjectionData = async (sheet?: SheetInfo) => {
    try {
      setLoading(true);
      const targetSheet = sheet || selectedSheet;
      if (!targetSheet) {
        throw new Error('No sheet selected');
      }
      
      console.log(`🔍 Loading solar projection data for opportunity: ${opportunityId}, sheet: ${targetSheet.fileName}`);
      console.log(`🔍 Target sheet details:`, {
        fileName: targetSheet.fileName,
        calculatorType: targetSheet.calculatorType,
        version: targetSheet.version
      });
      
      const calcType = isV44Sheet(targetSheet) ? 'v44' : targetSheet.calculatorType;
      const url = `/presentation/solar-projection/${opportunityId}?calculatorType=${calcType}&fileName=${encodeURIComponent(targetSheet.fileName)}`;
      console.log(`🔍 Solar projection data URL:`, url);
      
      const response = await api.get(url);
      
      if (response.success && response.data) {
        console.log('✅ Solar projection data loaded:', response.data);
        // The API response has a nested structure: { success: true, data: { ... } }
        const actualData = (response.data as any).data || response.data;
        if (actualData?.summary?.paymentType) {
          actualData.summary.paymentType = normalizePaymentTypeLabel(actualData.summary.paymentType);
        }
        setSolarData(actualData as SolarProjectionData);
        setDraftPaymentMethod(normalizePaymentTypeLabel(actualData?.summary?.paymentType) || '');
        setDraftTerm(actualData?.summary?.term != null ? String(actualData.summary.term) : '');
        setDraftMonthly(
          actualData?.summary?.monthlyPlanCost != null
            ? String(actualData.summary.monthlyPlanCost)
            : '',
        );
        console.log('🔍 Data title:', actualData?.title);
        console.log('🔍 Data calculator type:', actualData?.summary?.calculatorType);
        console.log('🔍 Table headers count:', actualData?.table?.headers?.length || 0);
        console.log('🔍 Table headers:', actualData?.table?.headers);
        console.log('🔍 Table rows count:', actualData?.table?.rows?.length || 0);
        console.log('🔍 First row columns count:', actualData?.table?.rows?.[0]?.length || 0);
        console.log('🔍 First 5 rows:', actualData?.table?.rows?.slice(0, 5));
        console.log('🔍 Last 5 rows:', actualData?.table?.rows?.slice(-5));
      } else {
        throw new Error(response.error || 'Failed to load solar projection data');
      }
    } catch (error) {
      console.error('❌ Error loading solar projection data:', error);
      Alert.alert('Error', 'Failed to load solar projection data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (step === 'sheets') {
        await loadAvailableSheets();
      } else {
        await loadSolarProjectionData();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const applyProjectionResult = (actualData: any) => {
    if (actualData?.summary?.paymentType) {
      actualData.summary.paymentType = normalizePaymentTypeLabel(actualData.summary.paymentType);
    }
    setSolarData(actualData as SolarProjectionData);
    setDraftPaymentMethod(normalizePaymentTypeLabel(actualData?.summary?.paymentType) || '');
    setDraftTerm(actualData?.summary?.term != null ? String(actualData.summary.term) : '');
    setDraftMonthly(
      actualData?.summary?.monthlyPlanCost != null
        ? String(actualData.summary.monthlyPlanCost)
        : '',
    );
  };

  const recalculateV44Projection = async () => {
    if (isRecalculating || !selectedSheet) return;
    const paymentMethod = draftPaymentMethod || 'Hometree';
    const paymentKey = paymentTypeKey(paymentMethod);
    if (paymentKey !== 'cash' && !draftTerm) {
      Alert.alert('Missing Term', 'Select a payment term before recalculating.');
      return;
    }
    if (paymentKey === 'hometree' && (!draftMonthly || Number.isNaN(Number(draftMonthly)))) {
      Alert.alert('Missing Monthly Cost', 'Enter the Year 1 monthly HomeTree payment before recalculating.');
      return;
    }

    try {
      setIsRecalculating(true);
      const payload = {
        paymentMethod,
        terms: paymentKey === 'cash' ? undefined : Number(draftTerm),
        monthlyPlanCost:
          paymentKey === 'hometree' ? Number(draftMonthly) : undefined,
        calculatorType: 'v44' as const,
        fileName: selectedSheet.fileName,
      };
      console.log('🔧 v44 recalculate payload:', payload);
      const response = await api.post(
        `/presentation/solar-projection/${opportunityId}/recalculate`,
        payload,
      );
      if (response.success && response.data) {
        const actualData = (response.data as any).data || response.data;
        applyProjectionResult(actualData);
      } else {
        throw new Error(response.error || 'Failed to recalculate projection');
      }
    } catch (error) {
      console.error('❌ Error recalculating v44 projection:', error);
      Alert.alert('Error', 'Failed to recalculate. Please try again.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const updatePaymentMethod = async (paymentMethod: string) => {
    // v4.4: draft only — apply via Recalculate (Inputs + RecalculateProposal)
    if (isV44) {
      setDraftPaymentMethod(paymentMethod);
      return;
    }

    // Prevent multiple simultaneous updates
    if (isUpdatingPayment) {
      console.log('⚠️ Payment method update already in progress, skipping...');
      return;
    }

    try {
      setIsUpdatingPayment(true);
      console.log(`🔧 Updating payment method to: ${paymentMethod}`);
      console.log(`🔧 Using file: ${selectedSheet?.fileName}`);
      console.log(`🔧 Selected sheet details:`, {
        fileName: selectedSheet?.fileName,
        calculatorType: selectedSheet?.calculatorType,
        version: selectedSheet?.version
      });
      
      const payload = {
        paymentMethod,
        calculatorType: selectedSheet?.calculatorType || 'off-peak',
        fileName: selectedSheet?.fileName
      };
      
      console.log(`🔧 Payment method update payload:`, payload);
      
      const response = await api.post(`/presentation/solar-projection/${opportunityId}/payment-method`, payload);
      
      if (response.success && response.data) {
        console.log('✅ Payment method updated successfully:', response.data);
        const actualData = (response.data as any).data || response.data;
        applyProjectionResult(actualData);
        console.log('🔍 Updated data title:', actualData?.title);
        console.log('🔍 Updated data calculator type:', actualData?.summary?.calculatorType);
        console.log('🔍 Updated table headers count:', actualData?.table?.headers?.length || 0);
        console.log('🔍 Updated table rows count:', actualData?.table?.rows?.length || 0);
        console.log('🔍 Yearly payments after update:', actualData?.summary?.yearlyPlanCost);
      } else {
        throw new Error(response.error || 'Failed to update payment method');
      }
    } catch (error) {
      console.error('❌ Error updating payment method:', error);
      Alert.alert('Error', 'Failed to update payment method. Please try again.');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const updateTerms = async (terms: number) => {
    // v4.4: draft only — apply via Recalculate
    if (isV44) {
      setDraftTerm(String(terms));
      return;
    }

    // Prevent multiple simultaneous updates
    if (isUpdatingTerms) {
      console.log('⚠️ Terms update already in progress, skipping...');
      return;
    }

    try {
      setIsUpdatingTerms(true);
      console.log(`🔧 Updating terms to: ${terms}`);
      console.log(`🔧 Using file: ${selectedSheet?.fileName}`);
      console.log(`🔧 Selected sheet details:`, {
        fileName: selectedSheet?.fileName,
        calculatorType: selectedSheet?.calculatorType,
        version: selectedSheet?.version
      });
      
      // Check if terms are applicable for the current payment method
      const currentPaymentType = paymentTypeKey(safeGet(solarData, 'summary.paymentType', ''));
      if (currentPaymentType === 'cash') {
        Alert.alert('Invalid Action', 'Terms are not applicable for Cash payment method.');
        return;
      }
      
      const payload = {
        terms,
        calculatorType: selectedSheet?.calculatorType || 'off-peak',
        fileName: selectedSheet?.fileName
      };
      
      console.log(`🔧 Terms update payload:`, payload);
      
      const response = await api.post(`/presentation/solar-projection/${opportunityId}/terms`, payload);
      
      if (response.success && response.data) {
        console.log('✅ Terms updated successfully:', response.data);
        const actualData = (response.data as any).data || response.data;
        applyProjectionResult(actualData);
        console.log('🔍 Updated data title:', actualData?.title);
        console.log('🔍 Updated data calculator type:', actualData?.summary?.calculatorType);
        console.log('🔍 Updated table headers count:', actualData?.table?.headers?.length || 0);
        console.log('🔍 Updated table rows count:', actualData?.table?.rows?.length || 0);
        console.log('🔍 Yearly payments after terms update:', actualData?.summary?.yearlyPlanCost);
      } else {
        throw new Error(response.error || 'Failed to update terms');
      }
    } catch (error) {
      console.error('❌ Error updating terms:', error);
      Alert.alert('Error', 'Failed to update terms. Please try again.');
    } finally {
      setIsUpdatingTerms(false);
    }
  };

  // Function to select a range of cells (for drag selection)
  const selectCellRange = (startRow: number, startCol: number, endRow: number, endCol: number) => {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    // Create a set of cell keys in the new range
    const newRangeCellKeys = new Set<string>();
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        newRangeCellKeys.add(`${row}-${col}`);
      }
    }
    
    // Get cells that were selected before this drag (not in the current drag range)
    // We'll keep those and add the new range
    const cellsBeforeDrag = selectedCells.filter(cell => {
      const cellKey = `${cell.row}-${cell.col}`;
      // Keep cells that are not in the drag start area (approximate - we'll refine this)
      // Actually, for simplicity, we'll just add the new range to existing selection
      // and let the duplicate check handle it
      return true; // Keep all existing for now, duplicates will be filtered
    });
    
    // Create new cells for the range
    const newSelectedCells: SelectedCell[] = [];
    const newColumnSelections: Record<string, SelectedCell[]> = {};
    
    // Get all cells in the range
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (solarData?.table?.rows?.[row]?.[col] !== undefined) {
          const value = solarData.table.rows[row][col];
          const header = safeGet(solarData, `table.headers.${col}`, '');
          const columnKey = header.toLowerCase();
          const cellKey = `${row}-${col}`;
          
          // Check if cell is not already in the selection
          const isAlreadySelected = selectedCells.some(cell => `${cell.row}-${cell.col}` === cellKey);
          if (!isAlreadySelected) {
            const newCell: SelectedCell = { row, col, value };
            newSelectedCells.push(newCell);
            
            if (!newColumnSelections[columnKey]) {
              newColumnSelections[columnKey] = [];
            }
            newColumnSelections[columnKey].push(newCell);
          }
        }
      }
    }
    
    // Merge with existing selections (avoiding duplicates)
    const existingCellKeys = new Set(selectedCells.map(cell => `${cell.row}-${cell.col}`));
    const mergedSelectedCells = [...selectedCells];
    
    newSelectedCells.forEach(cell => {
      const cellKey = `${cell.row}-${cell.col}`;
      if (!existingCellKeys.has(cellKey)) {
        mergedSelectedCells.push(cell);
        existingCellKeys.add(cellKey);
      }
    });
    
    const mergedColumnSelections = { ...columnSelections };
    Object.keys(newColumnSelections).forEach(columnKey => {
      if (!mergedColumnSelections[columnKey]) {
        mergedColumnSelections[columnKey] = [];
      }
      // Add only cells that aren't already in the column selection
      const existingColumnCellKeys = new Set(
        mergedColumnSelections[columnKey].map(cell => `${cell.row}-${cell.col}`)
      );
      newColumnSelections[columnKey].forEach(cell => {
        const cellKey = `${cell.row}-${cell.col}`;
        if (!existingColumnCellKeys.has(cellKey)) {
          mergedColumnSelections[columnKey].push(cell);
        }
      });
    });
    
    setSelectedCells(mergedSelectedCells);
    setColumnSelections(mergedColumnSelections);
    calculateSum(mergedSelectedCells);
  };

  const handleCellPress = (rowIndex: number, colIndex: number, value: string) => {
    // Only handle as single click if we didn't drag
    if (!hasDragged) {
      const cellKey = `${rowIndex}-${colIndex}`;
      const header = safeGet(solarData, `table.headers.${colIndex}`, '');
      const columnKey = header.toLowerCase();
      
      // Check if cell is already selected in this column
      const existingCellIndex = columnSelections[columnKey]?.findIndex(cell => `${cell.row}-${cell.col}` === cellKey) ?? -1;
      
      if (existingCellIndex >= 0) {
        // Remove cell if already selected
        const newColumnSelections = { ...columnSelections };
        newColumnSelections[columnKey] = newColumnSelections[columnKey].filter((_, index) => index !== existingCellIndex);
        if (newColumnSelections[columnKey].length === 0) {
          delete newColumnSelections[columnKey];
        }
        setColumnSelections(newColumnSelections);
        
        // Update global selected cells
        const newSelectedCells = selectedCells.filter(cell => `${cell.row}-${cell.col}` !== cellKey);
        setSelectedCells(newSelectedCells);
        calculateSum(newSelectedCells);
      } else {
        // Add cell to selection
        const newCell: SelectedCell = { row: rowIndex, col: colIndex, value };
        const newColumnSelections = { ...columnSelections };
        if (!newColumnSelections[columnKey]) {
          newColumnSelections[columnKey] = [];
        }
        newColumnSelections[columnKey] = [...newColumnSelections[columnKey], newCell];
        setColumnSelections(newColumnSelections);
        
        // Update global selected cells
        const newSelectedCells = [...selectedCells, newCell];
        setSelectedCells(newSelectedCells);
        calculateSum(newSelectedCells);
      }
    }
  };

  const handleCellPressIn = (rowIndex: number, colIndex: number) => {
    // Start drag selection
    setIsDragging(true);
    setHasDragged(false);
    setDragStartCell({ row: rowIndex, col: colIndex });
  };

  const handleCellPressOut = () => {
    // End drag selection
    setIsDragging(false);
    setDragStartCell(null);
    // Reset hasDragged after a short delay to allow onPress to check it
    setTimeout(() => {
      setHasDragged(false);
    }, 100);
  };

  const handleCellEnter = (rowIndex: number, colIndex: number) => {
    // When dragging and entering a cell, select the range
    if (isDragging && dragStartCell) {
      // Check if we've actually moved to a different cell
      if (dragStartCell.row !== rowIndex || dragStartCell.col !== colIndex) {
        setHasDragged(true);
        selectCellRange(dragStartCell.row, dragStartCell.col, rowIndex, colIndex);
      }
    }
  };

  const calculateSum = (cells: SelectedCell[]) => {
    let sum = 0;
    cells.forEach(cell => {
      // Extract numeric value from the cell (remove £ symbol and commas)
      const numericValue = parseFloat(cell.value.replace(/[£,]/g, ''));
      if (!isNaN(numericValue)) {
        sum += numericValue;
      }
    });
    setSelectedSum(sum);
  };

  const clearColumnSelections = (columnKey: string) => {
    const newColumnSelections = { ...columnSelections };
    const cellsToRemove = newColumnSelections[columnKey] || [];
    
    // Remove from global selected cells
    const newSelectedCells = selectedCells.filter(cell => 
      !cellsToRemove.some(removeCell => removeCell.row === cell.row && removeCell.col === cell.col)
    );
    
    // Remove from column selections
    delete newColumnSelections[columnKey];
    
    setColumnSelections(newColumnSelections);
    setSelectedCells(newSelectedCells);
    calculateSum(newSelectedCells);
  };

  const getColumnSum = (columnKey: string) => {
    const cells = columnSelections[columnKey] || [];
    let sum = 0;
    cells.forEach(cell => {
      const numericValue = parseFloat(cell.value.replace(/[£,]/g, ''));
      if (!isNaN(numericValue)) {
        sum += numericValue;
      }
    });
    return sum;
  };

  const clearSelection = () => {
    setSelectedCells([]);
    setSelectedSum(0);
    setColumnSelections({});
  };

  const handleCompleteStep = async () => {
    try {
      setIsCompletingStep(true);
      console.log('🔧 Starting solar projection step completion...');
      console.log('🔧 Opportunity ID:', opportunityId);
      
      // Mark solar projection step (step 5) as completed
      const { workflowApi } = await import('../utils/api');
      const stepData = {
        solarProjectionData: solarData,
        completedAt: new Date().toISOString(),
        calculatorType: selectedSheet?.calculatorType || 'off-peak',
        selectedSheet: selectedSheet
      };
      
      console.log('🔧 Calling workflowApi.completeStep with data:', stepData);
      const result = await workflowApi.completeStep(opportunityId, 5, stepData);
      console.log('✅ Solar projection step completed successfully:', result);
      
      // Verify the step was actually completed
      if (result && result.success) {
        console.log('🔍 Solar projection step completed successfully, navigating to next step...');
        console.log('🔍 Navigation params:', { opportunityId });
        
        // Navigate to Hometree quote helper (step 6)
        navigation.navigate('HometreeData', { opportunityId });
        console.log('🔍 Navigated to Hometree quote helper');
      } else {
        console.error('❌ Step completion failed:', result);
        Alert.alert('Error', 'Failed to complete solar projection step. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error completing solar projection step:', error);
      Alert.alert('Error', 'Failed to complete step. Please try again.');
    } finally {
      setIsCompletingStep(false);
    }
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const numericValue = typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/[£,\s]/g, ''));
    if (isNaN(numericValue)) {
      return String(value);
    }
    return `£${numericValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate yearly saving from Total Benefit column
  const calculateYearlySaving = (year: number): number | null => {
    if (!solarData?.table?.rows || !solarData?.table?.headers) return null;
    
    const totalBenefitIndex = solarData.table.headers.findIndex(header => 
      header.toLowerCase().includes('total benefit')
    );
    
    if (totalBenefitIndex === -1) return null;
    
    const rowIndex = year - 1; // Convert year to 0-based index
    if (rowIndex < 0 || rowIndex >= solarData.table.rows.length) return null;
    
    const cellValue = solarData.table.rows[rowIndex][totalBenefitIndex];
    if (!cellValue) return null;
    
    // Extract numeric value (remove £ symbol and commas)
    const numericValue = parseFloat(cellValue.replace(/[£,]/g, ''));
    return isNaN(numericValue) ? null : numericValue;
  };

  // Calculate yearly contribution from Net Yearly Payments column
  const calculateYearlyContribution = (year: number): number | null => {
    if (!solarData?.table?.rows || !solarData?.table?.headers) return null;
    
    // Debug: Log all headers to see what's available
    console.log('🔍 Available headers:', solarData.table.headers);
    
    const netYearlyPaymentsIndex = solarData.table.headers.findIndex(header => 
      header.toLowerCase().includes('net yearly payment')
    );
    
    console.log('🔍 Net Yearly Payments index:', netYearlyPaymentsIndex);
    
    if (netYearlyPaymentsIndex === -1) {
      // Try alternative column names
      const alternativeIndex = solarData.table.headers.findIndex(header => 
        header.toLowerCase().includes('yearly payment') || 
        header.toLowerCase().includes('net payment') ||
        header.toLowerCase().includes('payment')
      );
      console.log('🔍 Alternative payment column index:', alternativeIndex);
      if (alternativeIndex === -1) return null;
    }
    
    const finalIndex = netYearlyPaymentsIndex !== -1 ? netYearlyPaymentsIndex : 
      solarData.table.headers.findIndex(header => 
        header.toLowerCase().includes('yearly payment') || 
        header.toLowerCase().includes('net payment') ||
        header.toLowerCase().includes('payment')
      );
    
    const rowIndex = year - 1; // Convert year to 0-based index
    if (rowIndex < 0 || rowIndex >= solarData.table.rows.length) return null;
    
    const cellValue = solarData.table.rows[rowIndex][finalIndex];
    console.log(`🔍 Year ${year}, Column ${finalIndex}, Cell value:`, cellValue);
    
    if (!cellValue) return null;
    
    // Extract numeric value (remove £ symbol and commas)
    const numericValue = parseFloat(cellValue.replace(/[£,]/g, ''));
    console.log(`🔍 Extracted numeric value:`, numericValue);
    
    if (isNaN(numericValue)) return null;
    
    // Apply the rules:
    // - If negative, return absolute value (remove negative sign)
    // - If positive, return 0
    const result = numericValue < 0 ? Math.abs(numericValue) : 0;
    console.log(`🔍 Final contribution result:`, result);
    return result;
  };

  // Helper function to safely access nested properties
  const safeGet = (obj: any, path: string, defaultValue: any = null) => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
  };

  const isCellSelected = (rowIndex: number, colIndex: number) => {
    return selectedCells.some(cell => cell.row === rowIndex && cell.col === colIndex);
  };

  const getColumnBackgroundColor = (header: string, isDark: boolean) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('current energy bill')) {
      return isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'; // Red background
    } else if (headerLower.includes('total benefit')) {
      return isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'; // Green background
    }
    return 'transparent';
  };

  const getColumnBorderColor = (header: string): string | null => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('total benefit')) {
      return '#22c55e'; // Green border
    } else if (headerLower.includes('current energy bill') || headerLower.includes('current energy')) {
      return '#ef4444'; // Red border
    } else if (headerLower.includes('solar') || headerLower.includes('solar generation')) {
      return '#3b82f6'; // Blue border
    } else if (headerLower.includes('export') || headerLower.includes('export payment')) {
      return '#8b5cf6'; // Purple border
    } else if (headerLower.includes('battery') || headerLower.includes('battery savings')) {
      return '#f59e0b'; // Orange border
    } else if (headerLower.includes('payment') || headerLower.includes('yearly payment') || headerLower.includes('net yearly payment')) {
      return '#ec4899'; // Pink border
    }
    return null;
  };

  const handleZoomIn = () => {
    setContentScale(prev => Math.min(prev + 0.1, 2)); // Max zoom 2x
  };

  const handleZoomOut = () => {
    setContentScale(prev => Math.max(prev - 0.1, 0.5)); // Min zoom 0.5x
  };

  const handleResetZoom = () => {
    setContentScale(1);
  };

  const getColumnTextColor = (header: string, isDark: boolean) => {
    const headerLower = header.toLowerCase();
    if (headerLower.includes('current energy bill')) {
      return isDark ? '#fca5a5' : '#dc2626'; // Red text
    } else if (headerLower.includes('total benefit')) {
      return isDark ? '#86efac' : '#16a34a'; // Green text
    }
    return theme.secondaryText;
  };

  const formatCellValue = (cell: string, header: string) => {
    const headerLower = header.toLowerCase();
    
    // Check if this is a currency column
    const isCurrencyColumn = 
      headerLower.includes('solar') ||
      headerLower.includes('export') ||
      headerLower.includes('battery') ||
      headerLower.includes('total benefit') ||
      headerLower.includes('yearly payments') ||
      headerLower.includes('net yearly payment') ||
      headerLower.includes('current energy bill');
    
    if (!isCurrencyColumn) {
      return cell;
    }
    
    // If cell already has £ symbol, return as is
    if (cell.includes('£')) {
      return cell;
    }
    
    // Try to extract numeric value
    const numericValue = parseFloat(cell.replace(/[£,]/g, ''));
    if (!isNaN(numericValue)) {
      return `£${numericValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    // If not a number, return original cell
    return cell;
  };

  const renderSheetsStep = () => (
    <View style={[
      styles.container, 
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Header */}
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
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Select Calculator</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Choose which calculator to use for solar projections
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather name={isDark ? "sun" : "moon"} size={20} color={theme.secondaryText} />
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryButton} />
        }
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          { paddingBottom: 140 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 160,
          }
        ]}
      >
        <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <ExcelSheetPicker
            sheets={availableSheets}
            selectedSheet={selectedSheet}
            onSelect={(sheet) => setSelectedSheet(sheet as SheetInfo)}
            loading={loadingSheets}
            emptyTitle="No calculators available"
            emptyMessage="Complete the calculator step first, then come back here."
            introText="Tap a calculator below. Files are listed from V1 to the latest."
          />
        </View>
      </ScrollView>
      
      {selectedSheet && (
        <TouchableOpacity 
          style={[
            styles.viewProjectionsButton,
            { backgroundColor: theme.primaryButton },
          ]} 
          onPress={() => handleSheetSelect(selectedSheet)}
        >
          <Text style={[styles.viewProjectionsButtonText, { color: '#ffffff' }]}>
            View Solar Projections
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );

  if (step === 'sheets') {
    return renderSheetsStep();
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading Solar Projection Data...
          </Text>
        </View>
      </View>
    );
  }

  if (!solarData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.errorContent}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>No Data Available</Text>
          <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
            Solar projection data could not be loaded. Please check your connection and try again.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => loadSolarProjectionData()}
          >
            <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry</Text>
          </TouchableOpacity>
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
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => setStep('sheets')}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Solar Projection</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {selectedSheet ? getExcelSheetDisplayName(selectedSheet) : 'Solar Projection'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={clearSelection}
            >
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather name={isDark ? "sun" : "moon"} size={20} color={theme.secondaryText} />
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryButton} />
        }
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        directionalLockEnabled={false}
        alwaysBounceHorizontal={false}
        contentContainerStyle={[
          { paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        <View style={styles.content}>
        {/* Compact summary + controls — keep table visible without scrolling */}
        <View style={styles.summarySection}>
          {(() => {
            const paymentType = paymentTypeKey(
              isV44 ? draftPaymentMethod : safeGet(solarData, 'summary.paymentType', ''),
            );
            const showTerms = paymentType === 'hometree' || paymentType === 'finance';
            const showContribution = paymentType === 'hometree' || paymentType === 'finance';
            const termDisplay = isV44
              ? draftTerm
              : safeGet(solarData, 'summary.term');
            const paymentDisplay =
              (isV44 ? draftPaymentMethod : safeGet(solarData, 'summary.paymentType')) ||
              'Select Payment';

            return (
              <>
                {/* Row 1 — payment controls */}
                <View
                  style={[
                    styles.compactToolbar,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.compactField}>
                    <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Payment Type</Text>
                    <TouchableOpacity
                      style={[
                        styles.compactControl,
                        { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: theme.cardBorder },
                      ]}
                      onPress={() => setShowPaymentMethodDropdown(true)}
                      disabled={isUpdatingPayment || isRecalculating}
                    >
                      <Text style={[styles.compactControlText, { color: theme.primaryText }]} numberOfLines={1}>
                        {paymentDisplay}
                      </Text>
                      <Feather name="chevron-down" size={14} color={theme.secondaryText} />
                    </TouchableOpacity>
                  </View>

                  {showTerms && (
                    <View style={styles.compactField}>
                      <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Payment Term</Text>
                      <TouchableOpacity
                        style={[
                          styles.compactControl,
                          { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: theme.cardBorder },
                        ]}
                        onPress={() => setShowTermsDropdown(true)}
                        disabled={isUpdatingTerms || isRecalculating}
                      >
                        <Text style={[styles.compactControlText, { color: theme.primaryText }]} numberOfLines={1}>
                          {termDisplay ? `${termDisplay} years` : 'Select term'}
                        </Text>
                        <Feather name="chevron-down" size={14} color={theme.secondaryText} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {isV44 && paymentType === 'hometree' && (
                    <View style={styles.compactField}>
                      <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Monthly Cost</Text>
                      <TextInput
                        style={[
                          styles.compactControl,
                          styles.compactControlText,
                          {
                            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                            borderColor: theme.cardBorder,
                            color: theme.primaryText,
                          },
                        ]}
                        value={draftMonthly}
                        onChangeText={setDraftMonthly}
                        keyboardType="decimal-pad"
                        editable={!isRecalculating}
                        placeholder="0.00"
                        placeholderTextColor={theme.secondaryText}
                      />
                    </View>
                  )}

                  {isV44 && (
                    <TouchableOpacity
                      style={[
                        styles.compactRecalcButton,
                        {
                          backgroundColor: theme.primaryButton,
                          opacity: isRecalculating ? 0.7 : 1,
                        },
                      ]}
                      onPress={recalculateV44Projection}
                      disabled={isRecalculating}
                    >
                      {isRecalculating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={14} color="#fff" />
                          <Text style={styles.compactRecalcText}>Recalculate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Row 2 — key figures */}
                <View
                  style={[
                    styles.compactMetrics,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.compactMetric}>
                    <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Lifetime Profit</Text>
                    <Text style={[styles.compactMetricValue, { color: theme.successButton }]} numberOfLines={1}>
                      {formatCurrency(safeGet(solarData, 'summary.lifetimeProfit'))}
                    </Text>
                  </View>

                  <View style={[styles.compactMetric, styles.compactMetricWide]}>
                    <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>
                      Benefit for year
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.compactYearDropdown,
                        {
                          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                          borderColor: theme.primaryButton,
                        },
                      ]}
                      onPress={() => setShowSavingYearDropdown(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.compactYearDropdownText, { color: theme.primaryText }]}>
                        Year {selectedSavingYear}
                      </Text>
                      <Feather name="chevron-down" size={18} color={theme.primaryButton} />
                    </TouchableOpacity>
                    <Text style={[styles.compactMetricValue, { color: theme.primaryText, marginTop: 6 }]} numberOfLines={1}>
                      {formatCurrency(calculateYearlySaving(selectedSavingYear))}
                    </Text>
                  </View>

                  {showContribution && (
                    <View style={styles.compactMetric}>
                      <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>
                        {isV44 ? 'Annual Payment' : 'Contribution for year'}
                      </Text>
                      {!isV44 && (
                        <TouchableOpacity
                          style={[
                            styles.compactYearDropdown,
                            {
                              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                              borderColor: theme.primaryButton,
                            },
                          ]}
                          onPress={() => setShowContributionYearDropdown(true)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.compactYearDropdownText, { color: theme.primaryText }]}>
                            Year {selectedContributionYear}
                          </Text>
                          <Feather name="chevron-down" size={18} color={theme.primaryButton} />
                        </TouchableOpacity>
                      )}
                      <Text
                        style={[
                          styles.compactMetricValue,
                          { color: theme.primaryText, marginTop: isV44 ? 0 : 6 },
                        ]}
                        numberOfLines={1}
                      >
                        {formatCurrency(
                          isV44
                            ? safeGet(solarData, 'summary.yearlyPlanCost') ||
                                safeGet(solarData, 'summary.yearlyContributionYear1')
                            : calculateYearlyContribution(selectedContributionYear),
                        )}
                      </Text>
                    </View>
                  )}

                  {!isV44 && safeGet(solarData, 'summary.monthlyPlanCost') && (
                    <View style={styles.compactMetric}>
                      <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Monthly</Text>
                      <Text style={[styles.compactMetricValue, { color: theme.primaryText }]} numberOfLines={1}>
                        {formatCurrency(safeGet(solarData, 'summary.monthlyPlanCost'))}
                      </Text>
                    </View>
                  )}

                  {!isV44 && safeGet(solarData, 'summary.yearlyPlanCost') && (
                    <View style={styles.compactMetric}>
                      <Text style={[styles.compactLabel, { color: theme.secondaryText }]}>Yearly Plan</Text>
                      <Text style={[styles.compactMetricValue, { color: theme.primaryText }]} numberOfLines={1}>
                        {formatCurrency(safeGet(solarData, 'summary.yearlyPlanCost'))}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            );
          })()}
        </View>

        {/* Interactive Table */}
        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderTop}>
              <View style={styles.tableHeaderLeft}>
                <Text style={[styles.sectionTitleCompact, { color: theme.primaryText }]}>
                  Yearly Projections
                </Text>
              </View>
              
              {/* Zoom Controls - Near the table */}
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    contentScale <= 0.5 && styles.zoomButtonDisabled
                  ]}
                  onPress={handleZoomOut}
                  disabled={contentScale <= 0.5}
                >
                  <Ionicons name="remove-outline" size={18} color={contentScale <= 0.5 ? theme.secondaryText : theme.primaryText} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }
                  ]}
                  onPress={handleResetZoom}
                >
                  <Text style={[styles.zoomButtonText, { color: theme.primaryText }]}>
                    {Math.round(contentScale * 100)}%
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    contentScale >= 2 && styles.zoomButtonDisabled
                  ]}
                  onPress={handleZoomIn}
                  disabled={contentScale >= 2}
                >
                  <Ionicons name="add-outline" size={18} color={contentScale >= 2 ? theme.secondaryText : theme.primaryText} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Selection Summary */}
          {selectedCells.length > 0 && (
            <View style={[styles.selectionSummary, { backgroundColor: theme.primaryButton + '10', borderColor: theme.primaryButton + '30' }]}>
              <View style={styles.selectionInfo}>
                <Feather name="check-square" size={16} color={theme.primaryButton} />
                <Text style={[styles.selectionText, { color: theme.primaryButton }]}>
                  {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
              <Text style={[styles.selectionSum, { color: theme.primaryButton }]}>
                Total: {formatCurrency(selectedSum)}
              </Text>
            </View>
          )}

          {/* Table - Fully Responsive, No Internal Scrolling */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ 
              flexGrow: 1,
              minWidth: contentScale > 1 ? `${100 * contentScale}%` : '100%',
              justifyContent: contentScale === 1 ? 'center' : 'flex-start',
              alignItems: 'center'
            }}
            style={{ width: '100%' }}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            bounces={true}
            alwaysBounceHorizontal={true}
            directionalLockEnabled={true}
            scrollEventThrottle={16}
          >
            <View style={[styles.tableWrapper, { 
              backgroundColor: theme.cardBackground, 
              borderColor: theme.cardBorder, 
              transform: [{ scale: contentScale }],
              transformOrigin: contentScale > 1 ? 'top left' : 'center',
              alignSelf: contentScale === 1 ? 'center' : 'flex-start'
            }]}>
              <View style={[styles.table, { width: contentScale > 1 ? `${100 / contentScale}%` : '100%' }]}>
               {/* Table Header */}
               <View style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: theme.cardBorder }]}>
                 {/* Row number header */}
                 <View style={[styles.tableCell, styles.tableHeaderCell, styles.rowNumberCell, { borderRightColor: theme.cardBorder }]}>
                   <Text style={[styles.tableHeaderText, { color: theme.secondaryText }]}>#</Text>
                 </View>
                 {(safeGet(solarData, 'table.headers', []) as string[]).map((header, index) => {
                   const columnBgColor = getColumnBackgroundColor(header, isDark);
                   const columnTextColor = getColumnTextColor(header, isDark);
                   const columnBorderColor = getColumnBorderColor(header);
                   const columnKey = header.toLowerCase();
                   const hasSelections = columnSelections[columnKey] && columnSelections[columnKey].length > 0;
                   const columnSum = getColumnSum(columnKey);
                   
                   return (
                     <View key={index} style={[
                       styles.tableCell, 
                       styles.tableHeaderCell, 
                       { 
                         borderRightColor: columnBorderColor || theme.cardBorder,
                         borderRightWidth: columnBorderColor ? 3 : 1,
                         backgroundColor: columnBgColor !== 'transparent' ? columnBgColor : undefined
                       }
                     ]}>
                       <Text style={[styles.tableHeaderText, { color: columnTextColor }]}>{header}</Text>
                       {hasSelections && (
                         <View style={styles.columnResetContainer}>
                           <Text style={[styles.columnSumText, { color: columnTextColor }]}>
                             {formatCurrency(columnSum)}
                           </Text>
                           <TouchableOpacity
                             style={[styles.resetButton, { backgroundColor: theme.dangerButton + '20' }]}
                             onPress={() => clearColumnSelections(columnKey)}
                           >
                             <Feather name="x" size={12} color={theme.dangerButton} />
                           </TouchableOpacity>
                         </View>
                       )}
                     </View>
                   );
                 })}
               </View>

               {/* Table Rows - Show ALL rows */}
               {(safeGet(solarData, 'table.rows', []) as string[][]).map((row, rowIndex) => (
                <View key={rowIndex} style={[styles.tableRow, { borderBottomColor: theme.cardBorder }]}>
                  {/* Add row number as first column */}
                  <View style={[styles.tableCell, styles.rowNumberCell, { borderRightColor: theme.cardBorder }]}>
                    <Text style={[styles.rowNumberText, { color: theme.secondaryText }]}>
                      {rowIndex + 1}
                    </Text>
                  </View>
                  {row.map((cell, colIndex) => {
                    const isSelected = isCellSelected(rowIndex, colIndex);
                    const header = safeGet(solarData, `table.headers.${colIndex}`, '');
                    const columnBgColor = getColumnBackgroundColor(header, isDark);
                    const columnTextColor = getColumnTextColor(header, isDark);
                    const columnBorderColor = getColumnBorderColor(header);
                    
                    return (
                      <View
                        key={colIndex}
                        style={[
                          styles.tableCell,
                          { 
                            borderRightColor: columnBorderColor || theme.cardBorder,
                            borderRightWidth: columnBorderColor ? 3 : 1
                          },
                          isSelected && { backgroundColor: theme.primaryButton + '20' },
                          !isSelected && columnBgColor !== 'transparent' && { backgroundColor: columnBgColor }
                        ]}
                        onMouseEnter={() => handleCellEnter(rowIndex, colIndex)}
                      >
                        <TouchableOpacity
                          style={styles.tableCellTouchable}
                          onPress={() => handleCellPress(rowIndex, colIndex, cell)}
                          onPressIn={() => handleCellPressIn(rowIndex, colIndex)}
                          onPressOut={handleCellPressOut}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.tableCellText,
                            { color: isSelected ? theme.primaryButton : columnTextColor },
                            isSelected && { fontWeight: '600' }
                          ]}>
                            {formatCellValue(cell, header)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
               ))}
              </View>
            </View>
          </ScrollView>

        </View>

        {/* Metadata */}
        <View style={styles.metadataSection}>
          <Text style={[styles.metadataTitle, { color: theme.secondaryText }]}>Data Information</Text>
          <View style={[styles.metadataCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
             <View style={styles.metadataRow}>
               <Text style={[styles.metadataLabel, { color: theme.secondaryText }]}>Sheet:</Text>
               <Text style={[styles.metadataValue, { color: theme.primaryText }]}>{safeGet(solarData, 'metadata.sheetName', 'N/A')}</Text>
             </View>
             <View style={styles.metadataRow}>
               <Text style={[styles.metadataLabel, { color: theme.secondaryText }]}>Extracted:</Text>
               <Text style={[styles.metadataValue, { color: theme.primaryText }]}>
                 {safeGet(solarData, 'metadata.extractedAt') ? new Date(safeGet(solarData, 'metadata.extractedAt')).toLocaleString() : 'N/A'}
               </Text>
             </View>
          </View>
        </View>

        {/* Done/Next Button */}
        <View style={styles.actionButtonContainer}>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: theme.successButton || '#10B981' }]}
            onPress={handleCompleteStep}
            disabled={isCompletingStep}
          >
            {isCompletingStep ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="arrow-forward" size={20} color="white" />
            )}
            <Text style={styles.doneButtonText}>
              {isCompletingStep ? 'Completing...' : 'Done & Next'}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>

      {/* Year Selection Modal for Saving */}
      <Modal
        visible={showSavingYearDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSavingYearDropdown(false)}
        hardwareAccelerated={false}
        statusBarTranslucent={false}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSavingYearDropdown(false)}
        >
          <TouchableOpacity 
            style={[styles.yearDropdownModal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                Which year's benefit do you want to see?
              </Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => setShowSavingYearDropdown(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.yearList} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearOption,
                    { borderBottomColor: theme.cardBorder },
                    selectedSavingYear === year && { backgroundColor: theme.primaryButton + '10' }
                  ]}
                  onPress={() => {
                    setSelectedSavingYear(year);
                    setShowSavingYearDropdown(false);
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Text style={[
                    styles.yearOptionText,
                    { color: selectedSavingYear === year ? theme.primaryButton : theme.primaryText }
                  ]}>
                    Year {year}
                  </Text>
                  {selectedSavingYear === year && (
                    <Feather name="check" size={20} color={theme.primaryButton} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Year Selection Modal for Contribution */}
      <Modal
        visible={showContributionYearDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContributionYearDropdown(false)}
        hardwareAccelerated={false}
        statusBarTranslucent={false}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowContributionYearDropdown(false)}
        >
          <TouchableOpacity 
            style={[styles.yearDropdownModal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Year for Contribution</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => setShowContributionYearDropdown(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.yearList} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearOption,
                    { borderBottomColor: theme.cardBorder },
                    selectedContributionYear === year && { backgroundColor: theme.primaryButton + '10' }
                  ]}
                  onPress={() => {
                    setSelectedContributionYear(year);
                    setShowContributionYearDropdown(false);
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Text style={[
                    styles.yearOptionText,
                    { color: selectedContributionYear === year ? theme.primaryButton : theme.primaryText }
                  ]}>
                    Year {year}
                  </Text>
                  {selectedContributionYear === year && (
                    <Feather name="check" size={20} color={theme.primaryButton} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Payment Method Selection Modal */}
      <Modal
        visible={showPaymentMethodDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaymentMethodDropdown(false)}
        hardwareAccelerated={false}
        statusBarTranslucent={false}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentMethodDropdown(false)}
        >
          <TouchableOpacity 
            style={[styles.yearDropdownModal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Payment Method</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => setShowPaymentMethodDropdown(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.yearList} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
            >
              {['Cash', 'Hometree', 'Finance'].map((paymentMethod) => {
                const current = isV44
                  ? draftPaymentMethod
                  : normalizePaymentTypeLabel(safeGet(solarData, 'summary.paymentType'));
                const isSelected = current === paymentMethod;
                const isUpdatingThis = isUpdatingPayment && isSelected;
                
                return (
                  <TouchableOpacity
                    key={paymentMethod}
                    style={[
                      styles.yearOption,
                      { borderBottomColor: theme.cardBorder },
                      isSelected && { backgroundColor: theme.primaryButton + '10' }
                    ]}
                    onPress={() => {
                      if (!isUpdatingPayment && !isRecalculating) {
                        setShowPaymentMethodDropdown(false);
                        updatePaymentMethod(paymentMethod);
                      }
                    }}
                    disabled={isUpdatingPayment || isRecalculating}
                    activeOpacity={0.6}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={[
                      styles.yearOptionText,
                      { color: isSelected ? theme.primaryButton : theme.primaryText }
                    ]}>
                      {paymentMethod}
                    </Text>
                    {isSelected && !isUpdatingThis && (
                      <Feather name="check" size={20} color={theme.primaryButton} />
                    )}
                    {isUpdatingThis && (
                      <ActivityIndicator size="small" color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Terms Selection Modal */}
      <Modal
        visible={showTermsDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTermsDropdown(false)}
        hardwareAccelerated={false}
        statusBarTranslucent={false}
        presentationStyle="overFullScreen"
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTermsDropdown(false)}
        >
          <TouchableOpacity 
            style={[styles.yearDropdownModal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Term (Years)</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
                onPress={() => setShowTermsDropdown(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.yearList} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
            >
              {[5, 10, 15, 20, 25].map((term) => {
                const currentTerm = isV44 ? draftTerm : String(safeGet(solarData, 'summary.term') ?? '');
                const isSelected = currentTerm === term.toString();
                const isUpdatingThis = isUpdatingTerms && isSelected;
                
                return (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.yearOption,
                      { borderBottomColor: theme.cardBorder },
                      isSelected && { backgroundColor: theme.primaryButton + '10' }
                    ]}
                    onPress={() => {
                      if (!isUpdatingTerms && !isRecalculating) {
                        setShowTermsDropdown(false);
                        updateTerms(term);
                      }
                    }}
                    disabled={isUpdatingTerms || isRecalculating}
                    activeOpacity={0.6}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={[
                      styles.yearOptionText,
                      { color: isSelected ? theme.primaryButton : theme.primaryText }
                    ]}>
                      {term} year{term !== 1 ? 's' : ''}
                    </Text>
                    {isSelected && !isUpdatingThis && (
                      <Feather name="check" size={20} color={theme.primaryButton} />
                    )}
                    {isUpdatingThis && (
                      <ActivityIndicator size="small" color={theme.primaryButton} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
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
  } as any,
  recalculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  recalculateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  } as any,
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '500',
  },
  
  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: width < 768 ? 28 : 32,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: width < 768 ? 16 : 18,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
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
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  content: {
    padding: width < 768 ? 12 : 16,
    paddingTop: 8,
    transformOrigin: 'center top',
  },
  
  // Section Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.4,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minWidth: 80,
  },
  yearSelectorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Summary Section
  summarySection: {
    marginBottom: 10,
    gap: 8,
  },
  compactToolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  compactField: {
    minWidth: 110,
    flexGrow: 1,
    flexBasis: 110,
    maxWidth: 180,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compactControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    gap: 6,
  },
  compactControlText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  compactRecalcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 36,
    alignSelf: 'flex-end',
  },
  compactRecalcText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  compactMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  compactMetric: {
    flexGrow: 1,
    flexBasis: 130,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 120,
  },
  compactMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  compactMetricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  compactMetricDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  compactMetricWide: {
    minWidth: 160,
    flexBasis: 160,
  },
  compactYearDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    minHeight: 48,
    minWidth: 140,
    gap: 8,
  },
  compactYearDropdownText: {
    fontSize: 17,
    fontWeight: '700',
  },
  compactYearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactYearChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitleCompact: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  paymentInfoCard: {
    flex: 1,
    minWidth: width < 768 ? 120 : 140,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  paymentInfoLabel: {
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  paymentInfoValue: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  paymentDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    minHeight: 40,
  },
  paymentDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  summaryCards: {
    gap: 16,
    marginBottom: 20,
  },
  planCostRow: {
    flexDirection: 'row',
    gap: 16,
  },
  planCostCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  planCostLabel: {
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  planCostValue: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: width < 768 ? 16 : 24, // Smaller padding on tablet
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  summaryIcon: {
    width: width < 768 ? 48 : 56, // Smaller icon on tablet
    height: width < 768 ? 48 : 56,
    borderRadius: width < 768 ? 24 : 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: width < 768 ? 12 : 16, // Smaller margin on tablet
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryContent: {
    flex: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: width < 768 ? 22 : 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  
  // Table Section
  tableSection: {
    marginBottom: 12,
  },
  tableHeader: {
    marginBottom: 8,
  },
  tableHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  tableHeaderLeft: {
    flex: 1,
  },
  instructionText: {
    fontSize: width < 768 ? 16 : 18,
    color: '#64748b',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionSum: {
    fontSize: 16,
    fontWeight: '700',
  },
  tableWrapper: {
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    overflow: 'visible',
    width: '100%',
    // Width will be controlled by transform and parent
  },
  table: {
    width: '100%', // Full width, responsive
    flex: 1, // Allow table to expand
    minWidth: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    width: '100%', // Full width, responsive
    flex: 1, // Allow rows to flex
  },
  tableHeaderRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  tableCell: {
    padding: width < 768 ? 8 : 12, // Responsive padding
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Allow cells to flex and fill available space
    minWidth: width < 768 ? 80 : 100, // Minimum width for readability
  },
  tableHeaderCell: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  tableHeaderText: {
    fontSize: width < 768 ? 14 : 16, // Increased font size
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  tableCellText: {
    fontSize: width < 768 ? 13 : 15, // Increased font size
    textAlign: 'center',
    fontWeight: '500',
    width: '100%',
  },
  tableCellTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowNumberCell: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)', // Slightly darker background for row numbers
    flex: 0, // Don't flex the row number column
    minWidth: width < 768 ? 40 : 50, // Fixed width for row numbers
    width: width < 768 ? 40 : 50,
    maxWidth: width < 768 ? 40 : 50,
  },
  rowNumberText: {
    fontSize: width < 768 ? 10 : 12, // Smaller text for row numbers
    textAlign: 'center',
    fontWeight: '600',
    width: '100%',
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  instructionsText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  
  // Metadata Section
  metadataSection: {
    marginBottom: width < 768 ? 24 : 32, // Smaller margin on tablet
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metadataCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  actionButtonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 200,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Calculator Group Styles
  calculatorGroup: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    gap: 12,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.2,
  },
  groupCount: {
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    color: '#64748b',
  },

  // Form Cards
  formCard: {
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

  // No Files Container
  noFilesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noFilesText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noFilesSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Sheet Selection Styles
  sheetsSection: {
    marginBottom: width < 768 ? 24 : 32,
  },
  sheetsContainer: {
    gap: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: width < 768 ? 16 : 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetInfo: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  calculatorTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sheetNameContainer: {
    flex: 1,
  },
  sheetName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 20,
  },
  calculatorTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sheetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sheetDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  noSheetsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  noSheetsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noSheetsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewProjectionsButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    zIndex: 1100,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  viewProjectionsButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  columnResetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  columnSumText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  resetButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  yearDropdownModal: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '75%',
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearList: {
    maxHeight: 380,
  },
  yearOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  yearOptionText: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Zoom Controls
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width < 768 ? 6 : 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: width < 768 ? 10 : 12,
    padding: width < 768 ? 4 : 6,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    alignSelf: 'flex-start',
    marginTop: width < 768 ? 8 : 12,
  },
  zoomButton: {
    width: width < 768 ? 36 : 44,
    height: width < 768 ? 36 : 44,
    borderRadius: width < 768 ? 6 : 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  zoomButtonDisabled: {
    opacity: 0.4,
  },
  zoomButtonText: {
    fontSize: width < 768 ? 11 : 13,
    fontWeight: '600',
  },
});
