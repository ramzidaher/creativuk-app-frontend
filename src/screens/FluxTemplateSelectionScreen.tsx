import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface FluxTemplateSelection {
  solar: boolean;
  battery: boolean;
  solarHybrid: boolean;
  batteryInverter: boolean;
}

interface RouteParams {
  opportunityId: string;
  calculatorType?: 'flux' | 'off-peak';
}

export default function FluxTemplateSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  const [selections, setSelections] = useState<FluxTemplateSelection>({
    solar: false,
    battery: false,
    solarHybrid: false,
    batteryInverter: false,
  });
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Progress management state
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [savedSelections, setSavedSelections] = useState<FluxTemplateSelection | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore customer details immediately on mount (separate from restoreProgress to show in UI quickly)
  useEffect(() => {
    const restoreCustomerDetails = async () => {
      if (!opportunityId) return;
      
      try {
        // Always restore customer details from JSON first (JSON is source of truth)
        const progress = await CalculatorProgressService.restoreProgress(
          opportunityId,
          'flux'
        );
        
        if (progress && progress.customerDetails) {
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer details restored from JSON immediately in FluxTemplateSelectionScreen:', progress.customerDetails);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not restore customer details immediately:', error);
      }
    };
    
    restoreCustomerDetails();
  }, [opportunityId]);

  // Progress restoration function
  const restoreProgress = useCallback(async () => {
    if (!opportunityId || isInitialized) return;
    
    try {
      console.log('🔍 FluxTemplateSelectionScreen: Starting restore progress...');
      const progress = await CalculatorProgressService.restoreProgress(
        opportunityId,
        'flux'
      );
      
      if (progress && progress.templateSelection) {
        console.log('🔄 Auto-restoring template selections from saved progress:', progress.templateSelection);
        
        // Store the saved data for comparison
        setSavedSelections(progress.templateSelection.selectedOptions);
        
        // Restore template selections
        setSelections(progress.templateSelection.selectedOptions);
        
        // Extract customer information for header display
        if (progress.customerDetails) {
          const customerName = progress.customerDetails.customerName || '';
          const customerPostcode = progress.customerDetails.postcode || '';
          
          if (customerName || customerPostcode) {
            setCustomerInfo({
              name: customerName || 'Customer',
              postcode: customerPostcode || 'N/A'
            });
            console.log('✅ Customer info restored in FluxTemplateSelectionScreen:', { name: customerName, postcode: customerPostcode });
          }
        }
        
        setHasRestoredProgress(true);
        console.log('✅ Template selections restored and displayed in UI');
      } else if (progress && progress.radioButtonSelections) {
        // If we have radio button progress but no template selection, infer default template selection
        console.log('🔄 No template selection found, but radio button progress exists. Using default selections.');
        const defaultSelections: FluxTemplateSelection = {
          solar: true,
          battery: false,
          solarHybrid: false,
          batteryInverter: false
        };
        
        setSavedSelections(defaultSelections);
        setSelections(defaultSelections);
        setHasRestoredProgress(true);
        console.log('✅ Default template selections applied');
      } else {
        console.log('ℹ️ No template selection progress found to restore');
        setHasRestoredProgress(false);
      }
    } catch (error) {
      console.error('Error restoring template selection progress:', error);
      setHasRestoredProgress(false);
    } finally {
      setIsInitialized(true);
    }
  }, [opportunityId, isInitialized]);

  // Save progress function
  const saveProgress = useCallback(async () => {
    if (!opportunityId) return;
    
    try {
      const templateFileName = getTemplateFileName();
      
      // Only save template selection data, don't overwrite other calculator data
      await CalculatorProgressService.saveProgress(opportunityId, 'flux', {
        currentStep: 'template-selection' as const,
        templateSelection: {
          selectedOptions: selections,
          templateFileName,
        },
        // Don't include other fields to avoid overwriting existing data
      });
      
      console.log('✅ Flux template selection progress saved successfully');
    } catch (error) {
      console.error('❌ Error saving flux template selection progress:', error);
    }
  }, [opportunityId, selections]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress();
    }, 1000); // Save after 1 second of no changes
  }, [saveProgress]);

  // Check for changes function
  const hasChanges = useCallback(() => {
    if (!savedSelections) {
      console.log('🔍 FluxTemplateSelectionScreen hasChanges: No saved selections available');
      return false;
    }
    
    console.log('🔍 FluxTemplateSelectionScreen hasChanges: Comparing current vs saved values');
    console.log('🔍 Current selections:', selections);
    console.log('🔍 Saved selections:', savedSelections);
    
    const hasChangesResult = (
      selections.solar !== savedSelections.solar ||
      selections.battery !== savedSelections.battery ||
      selections.solarHybrid !== savedSelections.solarHybrid ||
      selections.batteryInverter !== savedSelections.batteryInverter
    );
    
    if (hasChangesResult) {
      console.log('🔍 FluxTemplateSelectionScreen hasChanges: Changes detected');
    } else {
      console.log('🔍 FluxTemplateSelectionScreen hasChanges: No changes detected - values match saved state');
    }
    
    return hasChangesResult;
  }, [selections, savedSelections]);

  // Initialize progress restoration
  useEffect(() => {
    const init = async () => {
      await restoreProgress();
    };
    
    init();
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [restoreProgress]);

  // Auto-save when selections change
  useEffect(() => {
    if (isInitialized && hasRestoredProgress) {
      debouncedSave();
    }
  }, [selections, isInitialized, hasRestoredProgress, debouncedSave]);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  // Check if continue button should be enabled
  const isContinueEnabled = selections.solar || selections.battery || selections.solarHybrid || selections.batteryInverter;

  const handleSelectionChange = (key: keyof FluxTemplateSelection) => {
    setSelections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getTemplateFileName = (): string => {
    const { solar, battery, solarHybrid, batteryInverter } = selections;
    
    // EPVS templates - 15 combinations for 4 checkboxes (backend uses EPVS naming)
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
    return '';
  };

  const handleContinue = async () => {
    const { solar, battery, solarHybrid, batteryInverter } = selections;
    
    if (!solar && !battery && !solarHybrid && !batteryInverter) {
      Alert.alert('Selection Required', 'Please select at least one option to continue.');
      return;
    }

    const templateFileName = getTemplateFileName();
    console.log('Selected Flux template:', templateFileName);
    console.log('Selections:', selections);

    try {
      setIsCreatingFile(true);
      
      // Save final progress to JSON (NO COM call - file creation happens on final submit)
      await CalculatorProgressService.saveProgress(opportunityId, 'flux', {
        currentStep: 'template-selection' as const,
        templateSelection: {
          selectedOptions: selections,
          templateFileName,
        },
        completedSteps: {
          'template-selection': true,
        },
      });
      console.log('✅ Flux template selection saved to JSON (no COM call)');
      
      // Navigate to Customer Details with template selection and calculator type
      (navigation as any).navigate('CustomerDetails', {
        templateFileName,
        selectedOptions: selections,
        opportunityId,
        calculatorType: 'flux',
      });
    } catch (error) {
      console.error('❌ Error saving Flux template selection:', error);
      Alert.alert('Error', 'Failed to save template selection. Please try again.');
      setIsCreatingFile(false);
      return;
    } finally {
      setIsCreatingFile(false);
    }
  };

  const renderComponentCard = (key: keyof FluxTemplateSelection, label: string, description: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.componentCard,
        { 
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
          shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
        },
        selections[key] && [
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
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Flux Template Selection</Text>
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
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View style={styles.titleIconContainer}>
              <View style={[styles.titleIconBackground, { backgroundColor: theme.primaryButton + '15' }]}>
                <View style={[styles.titleIcon, { backgroundColor: theme.primaryButton }]}>
                  <Feather name="trending-up" size={32} color="#ffffff" />
                </View>
              </View>
            </View>
            <Text style={[styles.mainTitle, { color: theme.primaryText }]}>Flux System Components</Text>
            <Text style={[styles.mainSubtitle, { color: theme.secondaryText }]}>
              Choose which components you want to include in your Flux solar system quote
            </Text>
          </View>

          {/* System Components */}
          <View style={styles.componentsSection}>
            {renderComponentCard(
              'solar',
              'Solar Panels',
              'Photovoltaic panels to generate electricity from sunlight',
              'sun'
            )}
            
            {renderComponentCard(
              'battery',
              'Battery Storage',
              'Battery storage system for energy storage and backup',
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

          {/* Skip Button - Only show if user has selections AND we restored progress AND no changes from saved state */}
          {(() => {
            const hasSelections = selections.solar || selections.battery || selections.solarHybrid || selections.batteryInverter;
            const canSkip = hasSelections && hasRestoredProgress && savedSelections && !hasChanges();
            
            console.log('🔍 FluxTemplateSelectionScreen Skip button conditions:', {
              hasSelections,
              hasRestoredProgress,
              hasSavedSelections: !!savedSelections,
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
                  console.log('🔍 FluxTemplateSelectionScreen Skip button pressed - navigating to CustomerDetails');
                  const templateFileName = getTemplateFileName();
                  console.log('🔍 Skip button: Using template file:', templateFileName);
                  console.log('🔍 Skip button: Using selections:', selections);
                  
                  (navigation as any).navigate('CustomerDetails', {
                    opportunityId,
                    calculatorType: 'flux',
                    templateFileName,        // ✅ Now passes the correct template
                    selectedOptions: selections  // ✅ Now passes the correct selections
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

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                { 
                  backgroundColor: isContinueEnabled && !isCreatingFile ? theme.primaryButton : theme.borderColor,
                  shadowColor: isContinueEnabled && !isCreatingFile ? theme.primaryButton : 'rgba(0, 0, 0, 0.1)',
                },
                (!isContinueEnabled || isCreatingFile) && styles.continueButtonDisabled
              ]}
              onPress={() => {
                console.log('🔍 FluxTemplateSelectionScreen Continue button pressed!');
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
                  : [theme.borderColor, theme.borderColor + 'CC']
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
          {getTemplateFileName() && (
            <View style={[
              styles.summarySection, 
              { 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(248, 250, 252, 0.8)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(226, 232, 240, 0.6)',
                shadowColor: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
              }
            ]}>
              <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>Selected Flux Template:</Text>
              <Text style={[styles.templateName, { color: theme.secondaryText }]}>{getTemplateFileName()}</Text>
            </View>
          )}
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
    gap: 12,
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
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 32,
  },
  titleIconContainer: {
    marginBottom: 16,
  },
  titleIconBackground: {
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
  titleIcon: {
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
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: width * 0.8,
    opacity: 0.9,
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
  actionButtonsRow: {
    marginBottom: 16,
  },
  buttonContainer: {
    marginBottom: 24,
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

