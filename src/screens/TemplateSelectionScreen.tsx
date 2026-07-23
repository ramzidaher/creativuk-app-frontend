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
import CalculatorProgressService from '../services/CalculatorProgressService';

const { width, height } = Dimensions.get('window');

interface TemplateSelection {
  solar: boolean;
  battery: boolean;
  solarHybrid: boolean;
  batteryInverter: boolean;
}

interface RouteParams {
  opportunityId: string;
  calculatorType?: 'epvs' | 'off-peak';
}

export default function TemplateSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { opportunityId, calculatorType } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  const [selections, setSelections] = useState<TemplateSelection>({
    solar: false,
    battery: false,
    solarHybrid: false,
    batteryInverter: false,
  });
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedSelections, setSavedSelections] = useState<TemplateSelection | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore progress on component mount
  useEffect(() => {
    restoreProgress();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [opportunityId, calculatorType]);

  // Auto-save when selections change
  useEffect(() => {
    if (hasRestoredProgress) {
      autoSaveProgress();
    }
  }, [selections, hasRestoredProgress]);

  // Debug logging for selections state changes
  useEffect(() => {
    console.log('🔍 TemplateSelectionScreen: selections state changed:', selections);
  }, [selections]);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  // Check if continue button should be enabled
  const isContinueEnabled = calculatorType === 'epvs' 
    ? (selections.solar || selections.battery || selections.solarHybrid || selections.batteryInverter)
    : (selections.solar || selections.solarHybrid || selections.batteryInverter);
  
  // Debug logging for button state
  console.log('🔍 Button state check:', {
    calculatorType,
    selections,
    isContinueEnabled,
    solar: selections.solar,
    solarHybrid: selections.solarHybrid,
    batteryInverter: selections.batteryInverter
  });
  
  // Debug logging for component render
  console.log('🔍 TemplateSelectionScreen render - selections:', selections);

  // Check if current selections match saved selections
  const hasChanges = () => {
    if (!savedSelections) return false;
    
    return (
      selections.solar !== savedSelections.solar ||
      selections.battery !== savedSelections.battery ||
      selections.solarHybrid !== savedSelections.solarHybrid ||
      selections.batteryInverter !== savedSelections.batteryInverter
    );
  };

  // Restore customer details immediately on mount (separate from restoreProgress to show in UI quickly)
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
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from JSON immediately in TemplateSelectionScreen:', progress.customerDetails);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
      }
    };
    
    restoreCustomerDetails();
  }, [opportunityId, calculatorType]);

  const restoreProgress = async () => {
    try {
      console.log('🔍 TemplateSelectionScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        calculatorType || 'off-peak'
      );
      
      // Extract customer information if available
      if (progress && progress.customerDetails) {
        setCustomerInfo({
          name: progress.customerDetails.customerName || 'Customer',
          postcode: progress.customerDetails.postcode || 'N/A'
        });
        console.log('✅ Customer info restored:', progress.customerDetails);
      }
      
      if (progress && progress.templateSelection) {
        const restoredSelections = progress.templateSelection.selectedOptions;
        console.log('🔄 Auto-restoring template selections from saved progress:', restoredSelections);
        
        // Validate the restored selections to ensure they're boolean values
        const validatedSelections: TemplateSelection = {
          solar: Boolean(restoredSelections.solar),
          battery: Boolean(restoredSelections.battery),
          solarHybrid: Boolean(restoredSelections.solarHybrid),
          batteryInverter: Boolean(restoredSelections.batteryInverter)
        };
        
        console.log('🔍 Validated selections:', validatedSelections);
        
        // Set the selections to show them as selected in the UI
        setSelections(validatedSelections);
        setSavedSelections(validatedSelections); // Store original selections for comparison
        setHasRestoredProgress(true); // Only set to true if we actually restored progress
        console.log('✅ Template selection progress restored and displayed');
        console.log('🔍 Current selections state:', validatedSelections);
      } else if (progress && progress.radioButtonSelections) {
        // If we have radio button selections but no template selection, 
        // we can infer the template selection from the radio button data
        console.log('🔄 Found radio button selections, inferring template selection...');
        
        // For now, set default template selection since we have radio button progress
        const defaultSelections = {
          solar: true,
          battery: false,
          solarHybrid: false,
          batteryInverter: false
        };
        
        setSelections(defaultSelections);
        setSavedSelections(defaultSelections);
        setHasRestoredProgress(true);
        console.log('✅ Template selection inferred from radio button progress');
        console.log('🔍 Current selections state:', defaultSelections);
      } else {
        console.log('ℹ️ No template selection progress found to restore');
        setHasRestoredProgress(false); // Set to false if no progress was found
      }
    } catch (error) {
      console.error('Error restoring template selection progress:', error);
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
        const templateFileName = getTemplateFileName();
        
        const progressData = {
          currentStep: 'template-selection' as const,
          templateSelection: {
            selectedOptions: selections,
            templateFileName,
          },
        };

        const result = await CalculatorProgressService.autoSave(
          opportunityId,
          calculatorType || 'off-peak',
          progressData
        );

        if (result.saved) {
          console.log('✅ Template selection auto-saved');
        }
      }, 1000); // Save after 1 second of no changes
    } catch (error) {
      console.error('Error auto-saving template selection:', error);
    }
  };

  const handleSelectionChange = (key: keyof TemplateSelection) => {
    setSelections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getTemplateFileName = (): string => {
    const { solar, battery, solarHybrid, batteryInverter } = selections;
    
    // Use different template files based on calculator type
    if (calculatorType === 'epvs') {
      // EPVS templates - 15 combinations for 4 checkboxes
      if (solar && battery && solarHybrid && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - All Options.xlsm';
      } else if (solar && battery && solarHybrid) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Battery + Solar Hybrid.xlsm';
      } else if (solar && battery && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Battery + Battery Inverter.xlsm';
      } else if (solar && solarHybrid && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Solar Hybrid + Battery Inverter.xlsm';
      } else if (battery && solarHybrid && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Battery + Solar Hybrid + Battery Inverter.xlsm';
      } else if (solar && battery) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Battery.xlsm';
      } else if (solar && solarHybrid) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Solar Hybrid.xlsm';
      } else if (solar && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Solar + Battery Inverter.xlsm';
      } else if (battery && solarHybrid) {
        return 'EPVS Calculator Creativ - 06.02 - Battery + Solar Hybrid.xlsm';
      } else if (battery && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Battery + Battery Inverter.xlsm';
      } else if (solarHybrid && batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Solar Hybrid + Battery Inverter.xlsm';
      } else if (solar) {
        return 'EPVS Calculator Creativ - 06.02 - Solar Only.xlsm';
      } else if (battery) {
        return 'EPVS Calculator Creativ - 06.02 - Battery Only.xlsm';
      } else if (solarHybrid) {
        return 'EPVS Calculator Creativ - 06.02 - Solar Hybrid Only.xlsm';
      } else if (batteryInverter) {
        return 'EPVS Calculator Creativ - 06.02 - Battery Inverter Only.xlsm';
      }
    } else {
      // Off Peak templates (3 options only - no battery storage)
      if (solar && solarHybrid && batteryInverter) {
        return 'Off peak V2.1 Eon SEG - All Options.xlsm';
      } else if (solar && solarHybrid) {
        return 'Off peak V2.1 Eon SEG - Solar + Solar Hybrid.xlsm';
      } else if (solar && batteryInverter) {
        return 'Off peak V2.1 Eon SEG - Solar + Battery Inverter.xlsm';
      } else if (solarHybrid && batteryInverter) {
        return 'Off peak V2.1 Eon SEG - Solar Hybrid + Battery Inverter.xlsm';
      } else if (solar) {
        return 'Off peak V2.1 Eon SEG - Solar Only.xlsm';
      } else if (solarHybrid) {
        return 'Off peak V2.1 Eon SEG - Solar Hybrid Only.xlsm';
      } else if (batteryInverter) {
        return 'Off peak V2.1 Eon SEG - Battery Inverter Only.xlsm';
      }
    }
    return '';
  };

  const handleContinue = async () => {
    console.log('🔍 handleContinue called!');
    console.log('🔍 Current selections:', selections);
    console.log('🔍 Calculator type:', calculatorType);
    
    setIsCreatingFile(true);
    
    const { solar, battery, solarHybrid, batteryInverter } = selections;
    
    // Different validation based on calculator type
    if (calculatorType === 'epvs') {
      // EPVS requires at least one option from all 4
      if (!solar && !battery && !solarHybrid && !batteryInverter) {
        console.log('❌ EPVS validation failed - no selections');
        Alert.alert('Selection Required', 'Please select at least one option to continue.');
        setIsCreatingFile(false);
        return;
      }
    } else {
      // Off-peak requires at least one option from 3 (no battery)
      if (!solar && !solarHybrid && !batteryInverter) {
        console.log('❌ Off-peak validation failed - no selections');
        Alert.alert('Selection Required', 'Please select at least one option to continue.');
        setIsCreatingFile(false);
        return;
      }
    }
    
    console.log('✅ Validation passed, proceeding with navigation...');

    const templateFileName = getTemplateFileName();
    console.log('Selected template:', templateFileName);
    console.log('Selections:', selections);

    // Save final progress to JSON (NO COM call - file creation happens on final submit)
    try {
      const progressData = {
        currentStep: 'template-selection' as const,
        templateSelection: {
          selectedOptions: selections,
          templateFileName,
        },
        completedSteps: {
          'template-selection': true,
        },
      };

      await CalculatorProgressService.saveProgress(
        opportunityId,
        calculatorType || 'off-peak',
        progressData
      );
      console.log('✅ Template selection saved to JSON (no COM call)');
    } catch (error) {
      console.error('Error saving final template selection progress:', error);
      Alert.alert('Error', 'Failed to save template selection. Please try again.');
      setIsCreatingFile(false);
      return;
    }

    // Navigate to Customer Details with template selection and calculator type
    console.log('🔍 Navigating to CustomerDetails...');
    setIsCreatingFile(false);
    (navigation as any).navigate('CustomerDetails', {
      templateFileName,
      selectedOptions: selections,
      opportunityId,
      calculatorType: calculatorType || 'off-peak', // Default to off-peak if not specified
    });
  };

  const renderComponentCard = (key: keyof TemplateSelection, label: string, description: string, icon: string) => {
    const isSelected = selections[key];
    // Debug logging to help identify issues
    console.log(`🔍 TemplateSelectionScreen: Rendering ${key}, isSelected = ${isSelected}, selections =`, selections);
    console.log(`🔍 TemplateSelectionScreen: Type of isSelected for ${key}:`, typeof isSelected, 'Value:', isSelected);
    
    return (
      <TouchableOpacity
        style={[
          styles.componentCard,
          { 
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
            shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
          },
          isSelected && [
            styles.componentCardSelected,
            { 
              borderColor: theme.primaryButton,
              backgroundColor: theme.primaryButton + '08',
              shadowColor: theme.primaryButton
            }
          ]
        ]}
        onPress={() => handleSelectionChange(key)}
        activeOpacity={0.7}
      >
      <View style={styles.componentHeader}>
        <View style={[
          styles.componentIconContainer,
          { backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(255, 255, 255, 0.3)' },
          selections[key] && { backgroundColor: theme.primaryButton }
        ]}>
          <Feather 
            name={icon as any} 
            size={24} 
            color={selections[key] ? '#ffffff' : theme.primaryButton} 
          />
        </View>
        <View style={styles.componentInfo}>
          <Text style={[
            styles.componentName,
            { color: theme.primaryText },
            selections[key] && { color: theme.primaryButton }
          ]}>
            {label}
          </Text>
          <Text style={[
            styles.componentDescription,
            { color: theme.secondaryText },
            selections[key] && { color: theme.tertiaryText }
          ]}>
            {description}
          </Text>
        </View>
        <View style={[
          styles.checkbox,
          { borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)' },
          selections[key] && { 
            backgroundColor: theme.primaryButton,
            borderColor: theme.primaryButton
          }
        ]}>
          {selections[key] && (
            <Feather name="check" size={16} color="#ffffff" />
          )}
        </View>
      </View>
    </TouchableOpacity>
    );
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
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                {calculatorType === 'epvs' ? 'Flux Template Selection' : 'Off-Peak Template Selection'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>System Configuration</Text>
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
        {/* Main Content */}
        <View style={styles.content}>
          {/* System Components */}
          <View style={styles.componentsSection}>
            {renderComponentCard(
              'solar',
              'Solar Panels',
              'Photovoltaic panels to generate electricity from sunlight',
              'sun'
            )}
            
            {/* Only show battery for EPVS calculator */}
            {calculatorType === 'epvs' && renderComponentCard(
              'battery',
              'Battery Storage',
              'Battery storage system for energy storage',
              'battery'
            )}
            
            {renderComponentCard(
              'solarHybrid',
              'Solar / Hybrid Inverter',
              'Inverter that can work with both solar panels and battery storage',
              'zap'
            )}
            
            {renderComponentCard(
              'batteryInverter',
              'Battery Inverter',
              'Inverter specifically for battery storage systems',
              'activity'
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Restore Button */}
            <TouchableOpacity
              style={[styles.restoreButton, { 
                borderColor: theme.primaryButton,
                backgroundColor: theme.primaryButton + '10'
              }]}
              onPress={restoreProgress}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={18} color={theme.primaryButton} />
              <Text style={[styles.restoreButtonText, { color: theme.primaryButton }]}>
                Restore Saved
              </Text>
            </TouchableOpacity>

            {/* Skip Button - Only show if user has selections AND we restored progress AND no changes from saved state */}
            {Object.values(selections).some(selected => selected) && hasRestoredProgress && savedSelections && !hasChanges() && (
              <TouchableOpacity
                style={[styles.skipButton, { 
                  borderColor: theme.dangerButton,
                  backgroundColor: theme.dangerButton + '10'
                }]}
                onPress={() => {
                  // Skip to CustomerDetailsScreen to load proper customer details
                  const templateFileName = getTemplateFileName();
                  console.log('🔍 Skip button: Using template file:', templateFileName);
                  console.log('🔍 Skip button: Using selections:', selections);
                  
                  (navigation as any).navigate('CustomerDetails', {
                    opportunityId,
                    calculatorType: calculatorType || 'off-peak',
                    templateFileName,
                    selectedOptions: selections
                  });
                }}
                activeOpacity={0.8}
              >
                <Feather name="skip-forward" size={18} color={theme.dangerButton} />
                <Text style={[styles.skipButtonText, { color: theme.dangerButton }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                { 
                  backgroundColor: isContinueEnabled && !isCreatingFile ? theme.primaryButton : theme.tertiaryText,
                  shadowColor: isContinueEnabled && !isCreatingFile ? theme.primaryButton : 'rgba(0, 0, 0, 0.1)',
                },
                (!isContinueEnabled || isCreatingFile) && styles.continueButtonDisabled
              ]}
              onPress={() => {
                console.log('🔍 Continue button pressed!');
                console.log('🔍 isContinueEnabled:', isContinueEnabled);
                console.log('🔍 selections:', selections);
                console.log('🔍 About to call handleContinue...');
                handleContinue();
                console.log('🔍 handleContinue call completed');
              }}
              disabled={!isContinueEnabled || isCreatingFile}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isContinueEnabled && !isCreatingFile 
                  ? [theme.primaryButton, theme.primaryButton + 'CC'] 
                  : [theme.tertiaryText, theme.tertiaryText + 'CC']
                }
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isCreatingFile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="arrow-right" size={20} color="#ffffff" />
                )}
                <Text style={styles.continueButtonText}>
                  {isCreatingFile ? 'Creating File...' : 'Continue to Customer Details'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Selection Summary */}
          {(() => {
            const templateFileName = getTemplateFileName();
            return templateFileName && templateFileName.trim() !== '' ? (
              <View style={[
                styles.summarySection, 
                { 
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
                  borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
                  shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
                }
              ]}>
                <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>Selected Template:</Text>
                <Text style={[styles.templateName, { color: theme.secondaryText }]}>{templateFileName}</Text>
              </View>
            ) : null;
          })()}
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
  headerTitleContainer: {
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
    padding: 20,
    paddingTop: 0,
  },
  componentsSection: {
    marginBottom: 32,
  },
  componentCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  componentCardSelected: {
    shadowColor: '#10b981',
    shadowOpacity: 0.25,
    transform: [{ scale: 1.02 }],
    elevation: 8,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  componentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  componentInfo: {
    flex: 1,
  },
  componentName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  componentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonContainer: {
    marginBottom: 24,
    gap: 12,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
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
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
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
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  summarySection: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  templateName: {
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
});
