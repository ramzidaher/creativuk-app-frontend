import { api } from '../utils/api';

export interface CalculatorProgressData {
  opportunityId: string;
  userId: string;
  calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44';
  currentStep: 'template-selection' | 'radio-buttons' | 'dynamic-inputs' | 'arrays' | 'pricing' | 'completed';
  
  // Template Selection Data
  templateSelection?: {
    selectedOptions: {
      solar: boolean;
      battery: boolean;
      solarHybrid: boolean;
      batteryInverter: boolean;
    };
    templateFileName: string;
  };
  
  // Calculator Screen Data
  radioButtonSelections?: Record<string, string>;
  
  // Dynamic Inputs Data
  dynamicInputs?: Record<string, string>;
  
  // Arrays Data
  arraysData?: {
    arrayRows: Array<{
      id: number;
      enabled: boolean;
      numberOfPanels?: string;
      orientationDeg?: string;
      pitchDeg?: string;
      shadingFactor?: string;
      source?: 'opensolar' | 'manual';
      overrideOpenSolar?: boolean;
    }>;
    enabledCount: number;
  };
  
  // Pricing Data
  pricingData?: {
    selectedBatteryType: '5kW' | '10kW';
    selectedNumberOfPanels: number;
    additionalItemQuantities: Record<string, number>;
    paymentMethod: 'Cash' | 'Hometree' | 'New Finance' | 'Finance' | 'Interest Free Loan' | null;
    totalSystemCost?: string; // Total system cost (total_system_cost)
    deposit: string;
    interestRate: string;
    interestRateType: string;
    paymentTerm: string;
    leaseMonthlyPayment?: string;
  };
  
  // Customer Details
  customerDetails?: {
    customerName: string;
    address: string;
    postcode: string;
  };
  
  // Metadata
  lastSavedAt: string;
  completedSteps: Record<string, boolean>;
  dataHash?: string;
}

export interface ProgressSummary {
  hasProgress: boolean;
  currentStep: string;
  completedSteps: string[];
  lastSavedAt?: string;
  progressPercentage: number;
}

export interface ChangeDetectionResult {
  hasChanged: boolean;
  currentHash?: string;
  newHash: string;
}

export interface PricingOverrideOption {
  calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44';
  currentPrice: string | null;
  hasPricingData: boolean;
  lastSavedAt?: string;
}

class CalculatorProgressService {
  /**
   * Get current user ID from stored user data
   */
  private async getUserId(): Promise<string> {
    try {
      const { authApi } = await import('../utils/api');
      const user = await authApi.getUser();
      
      console.log('🔍 Current user:', user);
      
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('🔍 Using user ID:', user.id);
      return user.id;
    } catch (error) {
      console.error('Error getting user ID:', error);
      throw new Error('User authentication required');
    }
  }

  /**
   * Save calculator progress data
   */
  async saveProgress(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44',
    progressData: Partial<CalculatorProgressData>
  ): Promise<{ success: boolean; message: string; dataHash?: string }> {
    try {
      const userId = await this.getUserId();
      
      const response = await api.post('/calculator-progress/save', {
        userId,
        opportunityId,
        calculatorType,
        progressData,
      });

      // The API service wraps the backend response
      return response.data as { success: boolean; message: string; dataHash?: string };
    } catch (error: any) {
      console.error('Error saving calculator progress:', error);
      return {
        success: false,
        message: `Error saving progress: ${error.message}`,
      };
    }
  }

  /**
   * Get calculator progress data
   */
  async getProgress(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44'
  ): Promise<CalculatorProgressData | null> {
    try {
      const userId = await this.getUserId();
      
      console.log('🔍 Making API call to get progress:', {
        userId,
        opportunityId,
        calculatorType,
        endpoint: '/calculator-progress/get'
      });
      
      const response = await api.get('/calculator-progress/get?userId=' + encodeURIComponent(userId) + '&opportunityId=' + encodeURIComponent(opportunityId) + '&calculatorType=' + encodeURIComponent(calculatorType));

      console.log('🔍 Full API response:', response);
      console.log('🔍 Response data:', response.data);

      const responseData = response.data as any;

      // The API service wraps the backend response, so we need to access response.data.data
      // Backend returns: { success: true, data: progress, message: "Progress found" }
      // API service wraps it as: { data: { success: true, data: progress, message: "Progress found" }, success: true }
      
      if (responseData && responseData.success && responseData.data) {
        console.log('✅ Progress found in response.data.data:', responseData.data);
        return responseData.data;
      } else if (responseData && !responseData.success) {
        // No progress found
        console.log('ℹ️ No progress found for opportunity:', opportunityId, 'Message:', responseData.message);
        return null;
      } else if (responseData && typeof responseData === 'object' && !responseData.success) {
        // Direct data response without success wrapper
        console.log('✅ Direct progress data:', responseData);
        return responseData;
      } else if (responseData === null || responseData === undefined) {
        console.log('ℹ️ Response data is null/undefined for opportunity:', opportunityId);
        return null;
      }
      
      console.log('ℹ️ No progress found for opportunity:', opportunityId, 'Response structure:', response.data);
      return null;
    } catch (error: any) {
      console.error('❌ Error getting calculator progress:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return null;
    }
  }

  /**
   * Check if data has changed since last save
   */
  async checkChanges(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44',
    newData: Partial<CalculatorProgressData>
  ): Promise<ChangeDetectionResult> {
    try {
      const userId = await this.getUserId();
      
      const response = await api.post('/calculator-progress/check-changes', {
        userId,
        opportunityId,
        calculatorType,
        newData,
      });

      // The API service wraps the backend response
      const responseData = response.data as any;
      if (responseData.success) {
        return {
          hasChanged: responseData.hasChanged,
          currentHash: responseData.currentHash,
          newHash: responseData.newHash,
        };
      }
      
      return {
        hasChanged: true,
        newHash: '',
      };
    } catch (error: any) {
      console.error('Error checking changes:', error);
      return {
        hasChanged: true,
        newHash: '',
      };
    }
  }

  /**
   * Get progress summary
   */
  async getProgressSummary(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44'
  ): Promise<ProgressSummary> {
    try {
      const userId = await this.getUserId();
      
      const response = await api.get('/calculator-progress/summary?userId=' + encodeURIComponent(userId) + '&opportunityId=' + encodeURIComponent(opportunityId) + '&calculatorType=' + encodeURIComponent(calculatorType));

      console.log('🔍 getProgressSummary response:', response.data);

      // The API service wraps the backend response
      const responseData = response.data as any;
      
      // Handle different response structures
      if (responseData && responseData.success && responseData.data) {
        console.log('✅ Progress summary found:', responseData.data);
        return responseData.data;
      } else if (responseData && !responseData.success) {
        // No progress found
        console.log('ℹ️ No progress summary found for opportunity:', opportunityId);
        return {
          hasProgress: false,
          currentStep: 'template-selection',
          completedSteps: [],
          progressPercentage: 0,
        };
      } else if (responseData && typeof responseData === 'object') {
        // Direct data response
        console.log('✅ Direct progress summary data:', responseData);
        return responseData;
      }
      
      console.log('ℹ️ No progress summary found for opportunity:', opportunityId);
      return {
        hasProgress: false,
        currentStep: 'template-selection',
        completedSteps: [],
        progressPercentage: 0,
      };
    } catch (error: any) {
      console.error('Error getting progress summary:', error);
      return {
        hasProgress: false,
        currentStep: 'template-selection',
        completedSteps: [],
        progressPercentage: 0,
      };
    }
  }

  /**
   * Clear calculator progress
   */
  async clearProgress(
    opportunityId: string,
    calculatorType?: 'off-peak' | 'flux' | 'epvs' | 'v44'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = await this.getUserId();
      
      const response = await api.delete('/calculator-progress/clear');

      // The API service wraps the backend response
      return response.data as { success: boolean; message: string };
    } catch (error: any) {
      console.error('Error clearing calculator progress:', error);
      return {
        success: false,
        message: `Error clearing progress: ${error.message}`,
      };
    }
  }

  /**
   * Auto-save progress with change detection
   */
  async autoSave(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44',
    progressData: Partial<CalculatorProgressData>
  ): Promise<{ success: boolean; message: string; saved: boolean; dataHash?: string }> {
    try {
      console.log('🔍 Auto-save called with:', { opportunityId, calculatorType, progressData });
      
      // First check if data has changed
      const changeResult = await this.checkChanges(opportunityId, calculatorType, progressData);
      console.log('🔍 Change detection result:', changeResult);
      
      if (!changeResult.hasChanged) {
        return {
          success: true,
          message: 'No changes detected, skipping save',
          saved: false,
          dataHash: changeResult.currentHash,
        };
      }

      // Data has changed, save it
      console.log('🔍 Data has changed, saving...');
      const saveResult = await this.saveProgress(opportunityId, calculatorType, progressData);
      console.log('🔍 Save result:', saveResult);
      
      return {
        ...saveResult,
        saved: saveResult.success,
      };
    } catch (error: any) {
      console.error('Error in auto-save:', error);
      return {
        success: false,
        message: `Auto-save failed: ${error.message}`,
        saved: false,
      };
    }
  }

  /**
   * Restore progress and return the data
   */
  async restoreProgress(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44'
  ): Promise<CalculatorProgressData | null> {
    try {
      console.log('🔍 Attempting to restore progress for:', { opportunityId, calculatorType });
      const progress = await this.getProgress(opportunityId, calculatorType);
      
      if (progress) {
        console.log('✅ Progress restored for opportunity:', opportunityId, progress);
        return progress;
      }
      
      console.log('ℹ️ No progress found for opportunity:', opportunityId);
      return null;
    } catch (error: any) {
      console.error('Error restoring progress:', error);
      return null;
    }
  }

  /**
   * Check if there's meaningful progress to restore
   */
  hasMeaningfulProgress(progress: CalculatorProgressData): boolean {
    if (!progress) return false;

    // Check for meaningful data based on current step
    switch (progress.currentStep) {
      case 'template-selection':
        return !!(progress.templateSelection && 
               progress.templateSelection.templateFileName && 
               Object.values(progress.templateSelection.selectedOptions).some(Boolean));
      
      case 'radio-buttons':
        return !!(progress.radioButtonSelections && 
               Object.keys(progress.radioButtonSelections).length > 0);
      
      case 'dynamic-inputs':
        return !!(progress.dynamicInputs && 
               Object.keys(progress.dynamicInputs).length > 0);
      
      case 'arrays':
        return !!(progress.arraysData && 
               progress.arraysData.arrayRows && 
               progress.arraysData.arrayRows.length > 0);
      
      case 'pricing':
        return !!(progress.pricingData && (
          progress.pricingData.selectedBatteryType || 
          progress.pricingData.selectedNumberOfPanels || 
          progress.pricingData.paymentMethod ||
          (progress.pricingData.additionalItemQuantities && 
           Object.keys(progress.pricingData.additionalItemQuantities).length > 0)
        ));
      
      default:
        return false;
    }
  }

  /**
   * Check if there's recent progress (within last 24 hours)
   */
  hasRecentProgress(progress: CalculatorProgressData, hoursThreshold: number = 24): boolean {
    if (!progress || !progress.lastSavedAt) {
      return false;
    }

    const lastSaved = new Date(progress.lastSavedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);

    return hoursDiff <= hoursThreshold;
  }

  /**
   * Submit calculator to Excel (final step - triggers single COM call)
   * 
   * Backend routing:
   * - calculatorType: 'off-peak' → routes to ExcelAutomationService.performCompleteCalculation()
   * - calculatorType: 'flux' | 'epvs' → routes to EPVSAutomationService.performCompleteCalculation()
   * 
   * @param existingFileName - Optional filename of existing file to edit. If provided, edits existing file. If undefined, creates new file.
   */
  async submitCalculator(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44',
    existingFileName?: string
  ): Promise<{
    success: boolean;
    message: string;
    filePath?: string;
    hometreeTermFallback?: {
      termYearsRequested: number;
      termYearsMatched: number;
      depositRequested?: number;
      depositMatched?: number;
      message: string;
      monthlyYear1?: number;
    };
  }> {
    try {
      const userId = await this.getUserId();
      
      // Normalize calculatorType (epvs is same as flux)
      const normalizedCalculatorType = calculatorType === 'epvs' ? 'flux' : calculatorType;
      
      console.log('🔄 Submitting calculator to Excel:', { 
        userId, 
        opportunityId, 
        calculatorType,
        normalizedCalculatorType,
        existingFileName,
        editExisting: !!existingFileName,
        backendEndpoint: '/calculator-progress/submit',
        backendService: normalizedCalculatorType === 'off-peak' 
          ? 'ExcelAutomationService.performCompleteCalculation()' 
          : 'EPVSAutomationService.performCompleteCalculation()'
      });
      
      const requestBody: any = {
        userId,
        opportunityId,
        calculatorType: normalizedCalculatorType, // Use normalized type for backend
      };
      
      // Only include existingFileName if provided (for editing existing files)
      if (existingFileName) {
        requestBody.existingFileName = existingFileName;
      }
      
      const response = await api.post('/calculator-progress/submit', requestBody);

      // The API service wraps the backend response
      // Backend returns: { success: true, message: "...", filePath: "..." }
      // API service wraps it as: { data: { success: true, message: "...", filePath: "..." }, success: true }
      const responseData = response.data as any;
      
      // Check if API call itself failed
      if (!response.success) {
        console.error('❌ API call failed:', response.error);
        return {
          success: false,
          message: response.error || 'Failed to submit calculator: API call failed',
        };
      }
      
      // Check backend response success flag
      if (responseData && responseData.success) {
        console.log('✅ Calculator submitted successfully:', {
          message: responseData.message,
          filePath: responseData.filePath
        });
        return {
          success: true,
          message: responseData.message || 'Successfully completed calculation',
          filePath: responseData.filePath,
          hometreeTermFallback: responseData.hometreeTermFallback,
        };
      } else {
        console.error('❌ Calculator submission failed:', {
          message: responseData?.message,
          error: responseData?.error
        });
        return {
          success: false,
          message: responseData?.message || responseData?.error || 'Failed to submit calculator',
          filePath: responseData?.filePath,
          hometreeTermFallback: responseData?.hometreeTermFallback,
        };
      }
    } catch (error: any) {
      console.error('Error submitting calculator:', error);
      return {
        success: false,
        message: `Error submitting calculator: ${error.message}`,
      };
    }
  }

  async getPricingOverrideOptions(opportunityId: string): Promise<PricingOverrideOption[]> {
    try {
      const userId = await this.getUserId();
      const response = await api.get(
        `/calculator-progress/tools/pricing-overrides?userId=${encodeURIComponent(userId)}&opportunityId=${encodeURIComponent(opportunityId)}`
      );
      const responseData = response.data as any;
      if (response.success && responseData?.success && Array.isArray(responseData.data)) {
        return responseData.data as PricingOverrideOption[];
      }
      return [];
    } catch (error) {
      console.error('Error getting pricing override options:', error);
      return [];
    }
  }

  async overrideCalculatorPrice(
    opportunityId: string,
    calculatorType: 'off-peak' | 'flux' | 'epvs' | 'v44',
    price: number
  ): Promise<{ success: boolean; message: string; warning?: string }> {
    try {
      const userId = await this.getUserId();
      const response = await api.put('/calculator-progress/tools/pricing-overrides', {
        userId,
        opportunityId,
        calculatorType,
        price,
      });
      const responseData = response.data as any;
      if (response.success && responseData) {
        return {
          success: !!responseData.success,
          message: responseData.message || 'Request processed',
          warning: responseData.warning,
        };
      }
      return {
        success: false,
        message: response.error || 'Failed to override price',
      };
    } catch (error: any) {
      console.error('Error overriding calculator price:', error);
      return {
        success: false,
        message: error?.message || 'Failed to override price',
      };
    }
  }
}

export default new CalculatorProgressService();
