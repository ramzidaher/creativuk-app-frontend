import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CalculatorProgress {
  opportunityId: string;
  customerDetails: {
    customerName: string;
    address: string;
    postcode: string;
  };
  templateFileName?: string;
  selectedTemplateOptions?: {
    solar: boolean;
    solarHybrid: boolean;
    batteryInverter: boolean;
    battery: boolean;
  };
  calculatorType: 'off-peak' | 'flux' | 'epvs';
  selectedOptions?: Record<string, string>; // Radio button selections
  inputValues?: Record<string, string>; // Dynamic input field values
  pricingData?: {
    selectedBatteryType: '5kW' | '10kW';
    selectedNumberOfPanels: number;
    additionalItemQuantities: Record<string, number>;
    paymentMethod: 'Cash' | 'Hometree' | 'New Finance' | null;
    deposit: string;
    interestRate: string;
    interestRateType: string;
    paymentTerm: string;
  };
  lastSavedAt: string;
  currentStep: 'radio-buttons' | 'dynamic-inputs' | 'arrays' | 'pricing' | 'completed';
  completedSteps: Record<string, boolean>;
}

export interface CalculatorSession {
  opportunityId: string;
  progress: CalculatorProgress;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

class CalculatorDataService {
  private readonly STORAGE_KEY = 'calculator_sessions';
  private readonly MAX_SESSIONS = 10; // Keep only last 10 sessions

  /**
   * Save calculator progress for an opportunity
   */
  async saveProgress(progress: CalculatorProgress): Promise<void> {
    try {
      const sessionId = `${progress.opportunityId}_${Date.now()}`;
      const session: CalculatorSession = {
        opportunityId: progress.opportunityId,
        progress: {
          ...progress,
          lastSavedAt: new Date().toISOString(),
        },
        sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Get existing sessions
      const existingSessions = await this.getAllSessions();
      
      // Update or add the session
      const updatedSessions = existingSessions.filter(s => s.opportunityId !== progress.opportunityId);
      updatedSessions.push(session);
      
      // Keep only the most recent sessions
      const sortedSessions = updatedSessions
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, this.MAX_SESSIONS);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(sortedSessions));
      
      // Only log on first save or significant updates to reduce console spam
      if (!existingSessions.find(s => s.opportunityId === progress.opportunityId)) {
        console.log('✅ Calculator progress saved for opportunity:', progress.opportunityId);
      }
    } catch (error) {
      console.error('❌ Error saving calculator progress:', error);
      throw error;
    }
  }

  /**
   * Get saved progress for a specific opportunity and calculator type
   */
  async getProgress(opportunityId: string, calculatorType?: string): Promise<CalculatorProgress | null> {
    try {
      const sessions = await this.getAllSessions();
      const session = sessions.find(s => 
        s.opportunityId === opportunityId && 
        (!calculatorType || s.progress.calculatorType === calculatorType)
      );
      
      if (session) {
        // Only log when progress is actually found to reduce console spam
        // console.log('✅ Found saved progress for opportunity:', opportunityId);
        return session.progress;
      }
      
      // Only log when no progress is found on initial load
      // console.log('ℹ️ No saved progress found for opportunity:', opportunityId);
      return null;
    } catch (error) {
      console.error('❌ Error getting calculator progress:', error);
      return null;
    }
  }

  /**
   * Get all saved calculator sessions
   */
  async getAllSessions(): Promise<CalculatorSession[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('❌ Error getting all calculator sessions:', error);
      return [];
    }
  }

  /**
   * Update specific parts of the progress
   */
  async updateProgress(opportunityId: string, updates: Partial<CalculatorProgress>): Promise<void> {
    try {
      const calculatorType = updates.calculatorType || 'off-peak';
      const existingProgress = await this.getProgress(opportunityId, calculatorType);
      if (existingProgress) {
        // Check if there are actual changes to avoid unnecessary saves
        const hasChanges = this.hasSignificantChanges(existingProgress, updates);
        if (!hasChanges) {
          return; // No changes, skip saving
        }

        const updatedProgress: CalculatorProgress = {
          ...existingProgress,
          ...updates,
          lastSavedAt: new Date().toISOString(),
        };
        await this.saveProgress(updatedProgress);
      } else {
        // Create new progress if none exists
        const newProgress: CalculatorProgress = {
          opportunityId,
          customerDetails: updates.customerDetails || { customerName: '', address: '', postcode: '' },
          calculatorType: calculatorType,
          selectedOptions: updates.selectedOptions || {},
          inputValues: updates.inputValues || {},
          lastSavedAt: new Date().toISOString(),
          currentStep: updates.currentStep || 'radio-buttons',
          completedSteps: updates.completedSteps || {},
          ...updates,
        };
        await this.saveProgress(newProgress);
      }
    } catch (error) {
      console.error('❌ Error updating calculator progress:', error);
      throw error;
    }
  }

  /**
   * Check if there are significant changes between existing and new progress
   */
  private hasSignificantChanges(existing: CalculatorProgress, updates: Partial<CalculatorProgress>): boolean {
    // Check selectedOptions changes
    if (updates.selectedOptions) {
      const existingOptions = existing.selectedOptions || {};
      const newOptions = updates.selectedOptions;
      
      // Compare the objects
      const existingKeys = Object.keys(existingOptions);
      const newKeys = Object.keys(newOptions);
      
      if (existingKeys.length !== newKeys.length) {
        return true;
      }
      
      for (const key of newKeys) {
        if (existingOptions[key] !== newOptions[key]) {
          return true;
        }
      }
    }

    // Check inputValues changes
    if (updates.inputValues) {
      const existingInputs = existing.inputValues || {};
      const newInputs = updates.inputValues;
      
      const existingInputKeys = Object.keys(existingInputs);
      const newInputKeys = Object.keys(newInputs);
      
      if (existingInputKeys.length !== newInputKeys.length) {
        return true;
      }
      
      for (const key of newInputKeys) {
        if (existingInputs[key] !== newInputs[key]) {
          return true;
        }
      }
    }

    // Check other significant fields
    if (updates.currentStep && updates.currentStep !== existing.currentStep) {
      return true;
    }

    if (updates.completedSteps) {
      const existingCompleted = existing.completedSteps || {};
      const newCompleted = updates.completedSteps;
      
      const existingCompletedKeys = Object.keys(existingCompleted);
      const newCompletedKeys = Object.keys(newCompleted);
      
      if (existingCompletedKeys.length !== newCompletedKeys.length) {
        return true;
      }
      
      for (const key of newCompletedKeys) {
        if (existingCompleted[key] !== newCompleted[key]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Mark a step as completed
   */
  async markStepCompleted(opportunityId: string, step: string, calculatorType?: string): Promise<void> {
    try {
      const existingProgress = await this.getProgress(opportunityId, calculatorType);
      if (existingProgress) {
        const completedSteps = { ...(existingProgress.completedSteps || {}) };
        completedSteps[step] = true;
        
        // Determine next step based on current step
        let nextStep = existingProgress.currentStep;
        if (step === 'radio-buttons') {
          nextStep = 'dynamic-inputs';
        } else if (step === 'dynamic-inputs') {
          nextStep = 'arrays';
        } else if (step === 'arrays') {
          nextStep = 'pricing';
        } else if (step === 'pricing') {
          nextStep = 'completed';
        }
        
        await this.updateProgress(opportunityId, {
          completedSteps,
          currentStep: nextStep,
          calculatorType: calculatorType || existingProgress.calculatorType,
        });
      }
    } catch (error) {
      console.error('❌ Error marking step as completed:', error);
      throw error;
    }
  }

  /**
   * Clear progress for a specific opportunity and calculator type
   */
  async clearProgress(opportunityId: string, calculatorType?: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const updatedSessions = sessions.filter(s => 
        !(s.opportunityId === opportunityId && (!calculatorType || s.progress.calculatorType === calculatorType))
      );
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSessions));
      
      console.log('✅ Cleared progress for opportunity:', opportunityId, calculatorType ? `(${calculatorType})` : '');
    } catch (error) {
      console.error('❌ Error clearing calculator progress:', error);
      throw error;
    }
  }

  /**
   * Clear all calculator sessions
   */
  async clearAllSessions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ Cleared all calculator sessions');
    } catch (error) {
      console.error('❌ Error clearing all calculator sessions:', error);
      throw error;
    }
  }

  /**
   * Get progress summary for display
   */
  async getProgressSummary(opportunityId: string, calculatorType?: string): Promise<{
    hasProgress: boolean;
    currentStep: string;
    completedSteps: string[];
    lastSavedAt?: string;
    progressPercentage: number;
  }> {
    try {
      const progress = await this.getProgress(opportunityId, calculatorType);
      if (!progress) {
        return {
          hasProgress: false,
          currentStep: 'radio-buttons',
          completedSteps: [],
          progressPercentage: 0,
        };
      }

      const totalSteps = 4; // radio-buttons, dynamic-inputs, arrays, pricing
      let completedCount = 0;
      if (progress.completedSteps) {
        if (progress.completedSteps['radio-buttons']) completedCount++;
        if (progress.completedSteps['dynamic-inputs']) completedCount++;
        if (progress.completedSteps['arrays']) completedCount++;
        if (progress.completedSteps['pricing']) completedCount++;
      }
      
      // If we're on the pricing step and it's not completed yet, show 100% progress
      // because pricing is the final step
      let progressPercentage = Math.round((completedCount / totalSteps) * 100);
      if (progress.currentStep === 'pricing' && !progress.completedSteps?.['pricing']) {
        progressPercentage = 100;
      }

      return {
        hasProgress: true,
        currentStep: progress.currentStep,
        completedSteps: Object.keys(progress.completedSteps || {}),
        lastSavedAt: progress.lastSavedAt,
        progressPercentage,
      };
    } catch (error) {
      console.error('❌ Error getting progress summary:', error);
      return {
        hasProgress: false,
        currentStep: 'radio-buttons',
        completedSteps: [],
        progressPercentage: 0,
      };
    }
  }

  /**
   * Check if there's recent progress (within last 24 hours)
   */
  async hasRecentProgress(opportunityId: string, hoursThreshold: number = 24, calculatorType?: string): Promise<boolean> {
    try {
      const progress = await this.getProgress(opportunityId, calculatorType);
      if (!progress || !progress.lastSavedAt) {
        return false;
      }

      const lastSaved = new Date(progress.lastSavedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);

      return hoursDiff <= hoursThreshold;
    } catch (error) {
      console.error('❌ Error checking recent progress:', error);
      return false;
    }
  }

  /**
   * Check if progress has meaningful data that should be restored
   */
  hasMeaningfulProgress(progress: CalculatorProgress): boolean {
    if (!progress) return false;

    // Check for meaningful data based on current step
    switch (progress.currentStep) {
      case 'radio-buttons':
        return progress.selectedOptions && Object.keys(progress.selectedOptions).length > 0;
      
      case 'dynamic-inputs':
        return progress.inputValues && Object.keys(progress.inputValues).length > 0;
      
      case 'arrays':
        return progress.inputValues && Object.keys(progress.inputValues).length > 0;
      
      case 'pricing':
        return progress.pricingData && (
          progress.pricingData.selectedBatteryType || 
          progress.pricingData.selectedNumberOfPanels || 
          progress.pricingData.paymentMethod ||
          (progress.pricingData.additionalItemQuantities && Object.keys(progress.pricingData.additionalItemQuantities).length > 0)
        );
      
      default:
        return false;
    }
  }
}

export default new CalculatorDataService();
