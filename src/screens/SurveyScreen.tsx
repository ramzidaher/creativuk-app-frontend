import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
// import DateTimePicker from '@react-native-community/datetimepicker';
import BottomNavigation from '../components/BottomNavigation';
import CustomAlert from '../components/CustomAlert';
import WebCamera from '../components/WebCamera';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useEnhancedValidation } from '../hooks/useEnhancedValidation';
import {
    HomeOwnerAvailability,
    Survey,
    SurveyPage1,
    SurveyPage2,
    SurveyPage3,
    SurveyPage4,
    SurveyPage5,
    SurveyPage6,
    SurveyPage7,
    SurveyPage8
} from '../types';
import { surveyApi } from '../utils/api';
import { filterImagesForSubmission } from '../utils/batchImageUpload';
import { compressImageAuto } from '../utils/imageCompression';

const { width, height } = Dimensions.get('window');

// Helper function to safely log data without base64 content
const safeLogData = (data: any, label: string) => {
  const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (key === 'base64' || key === 'base64Data' || (typeof value === 'string' && value.length > 100 && value.match(/^[A-Za-z0-9+/=]+$/))) {
      return '[BASE64_DATA_TRUNCATED]';
    }
    return value;
  }));
  console.log(label, Object.keys(safeData));
};

interface SurveyScreenProps {
  opportunityId?: string;
  onComplete?: (surveyData: any) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

interface RouteParams {
  opportunityId: string;
}

export default function SurveyScreen(props?: SurveyScreenProps) {
  const focusedInputRef = React.useRef<string | null>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as RouteParams;
  const opportunityId = props?.opportunityId || routeParams?.opportunityId;
  const { isAuthenticated, user } = useAuth();
  const isAdminUser = user?.role === 'ADMIN';
  const surveyValidationOptions = useMemo(
    () => (isAdminUser ? { skipFieldNames: ['homeOwnersAvailable'] as string[] } : undefined),
    [isAdminUser]
  );
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [nextButtonLoading, setNextButtonLoading] = useState(false);
  // Compression state removed - images are now compressed immediately during capture
  const [justReset, setJustReset] = useState(false);
  const [resetTimestamp, setResetTimestamp] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoNavigating, setAutoNavigating] = useState(false);
  const hasNavigatedRef = useRef(false);
  const [hasManuallyNavigated, setHasManuallyNavigated] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showPropertyTypeDropdown, setShowPropertyTypeDropdown] = useState(false);
  const [showBedroomsDropdown, setShowBedroomsDropdown] = useState(false);
  const [showLengthOfStayDropdown, setShowLengthOfStayDropdown] = useState(false);
  
  // Custom alert state
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [showMovingPlansDropdown, setShowMovingPlansDropdown] = useState(false);
  const [showOccupantsDropdown, setShowOccupantsDropdown] = useState(false);
  const [showHeatingTypeDropdown, setShowHeatingTypeDropdown] = useState(false);
  const [showAdditionalFeaturesDropdown, setShowAdditionalFeaturesDropdown] = useState(false);
  const [showPrepaidMeterDropdown, setShowPrepaidMeterDropdown] = useState(false);
  const [showPhaseMeterDropdown, setShowPhaseMeterDropdown] = useState(false);
  
  // Modal dropdown states (like DynamicInputsScreen)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [showEpcRatingDropdown, setShowEpcRatingDropdown] = useState(false);
  const [showPreviousFundingDropdown, setShowPreviousFundingDropdown] = useState(false);
  const [showFinancialIssuesDropdown, setShowFinancialIssuesDropdown] = useState(false);
  const [showCreditRatingDropdown, setShowCreditRatingDropdown] = useState(false);
  const [showInstallationAvailabilityDropdown, setShowInstallationAvailabilityDropdown] = useState(false);
  const [showRoofTileDropdown, setShowRoofTileDropdown] = useState(false);
  const [showSolarBatteryDropdown, setShowSolarBatteryDropdown] = useState(false);
  const [showEvChargerDropdown, setShowEvChargerDropdown] = useState(false);
  const [showOptimisersDropdown, setShowOptimisersDropdown] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string; postcode: string} | null>(null);
  const [showScaffoldingRequiredDropdown, setShowScaffoldingRequiredDropdown] = useState(false);
  const [showScaffoldingThroughHouseDropdown, setShowScaffoldingThroughHouseDropdown] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: any[] }>({});
  const uploadedFilesRef = useRef<{ [key: string]: any[] }>({});
  const [imagePreviews, setImagePreviews] = useState<{ [key: string]: any[] }>({});
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [loadingImages, setLoadingImages] = useState<{ [key: string]: boolean }>({});
  const [imageCache, setImageCache] = useState<{ [key: string]: any }>({});
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep ref in sync with state - optimized to prevent unnecessary re-renders
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  // Debounced auto-save function to prevent excessive API calls
  const debouncedAutoSave = useCallback((pageKey: string, pageData: any) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`💾 Auto-saving ${pageKey}...`);
        const wrappedData = { [pageKey]: pageData };
        await surveyApi.saveSurveyPage(opportunityId, wrappedData);
        console.log(`✅ Auto-saved ${pageKey} successfully`);
      } catch (error) {
        console.error(`❌ Error auto-saving ${pageKey}:`, error);
      }
    }, 1000); // 1 second debounce
  }, [opportunityId]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to truncate base64 data for logging
  const truncateBase64ForLogging = (data: any): any => {
    if (typeof data === 'string' && data.length > 100 && data.match(/^[A-Za-z0-9+/=]+$/)) {
      return `${data.substring(0, 50)}... (truncated, ${data.length} chars)`;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => truncateBase64ForLogging(item));
    }
    
    if (data && typeof data === 'object') {
      const truncated: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (key === 'base64' || key === 'base64Data') {
          truncated[key] = typeof value === 'string' && value.length > 100 
            ? `${value.substring(0, 50)}... (truncated, ${value.length} chars)`
            : value;
        } else {
          truncated[key] = truncateBase64ForLogging(value);
        }
      }
      return truncated;
    }
    
    return data;
  };
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [webCameraFieldName, setWebCameraFieldName] = useState<string>('');
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageOptionsFieldName, setImageOptionsFieldName] = useState<string>('');
  const [showQuickFillConfirm, setShowQuickFillConfirm] = useState(false);
  const [autoFilledDetails, setAutoFilledDetails] = useState<any>(null);
  
  // Field validation states
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  
  // Rebooking modal states
  const [showRebookingModal, setShowRebookingModal] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [showScaffoldingMultiSelect, setShowScaffoldingMultiSelect] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // User to rep mapping for rebooking - reps/surveyors who have app accounts
  const userRepMapping = {
    'Andrew': ['Miles', 'Jordan', 'Alex'],
    'Ion': ['Miles', 'Jordan', 'Alex', 'James'],
    'Jordan': ['Miles', 'Alex', 'James'],
    'Onur': ['Miles', 'Jordan', 'Alex'],
    'Kanji': ['Miles', 'Jordan'],
    'Kenji': ['Alex', 'James'],
    'Alex': ['Miles', 'Jordan', 'Alex', 'James'],
    'James': ['Miles', 'Jordan', 'Alex', 'James']
  };

  // Available rep calendars for rebooking
  const allReps = [
    { id: 'Miles', name: 'Miles Kent', color: '#1976d2' },
    { id: 'Jordan', name: 'Jordan Smith', color: '#388e3c' },
    { id: 'Alex', name: 'Alex Johnson', color: '#7b1fa2' },
    { id: 'James', name: 'James Wilson', color: '#f57c00' }
  ];
  const [formData, setFormData] = useState({
    page1: {} as SurveyPage1,
    page2: {} as SurveyPage2,
    page3: {} as SurveyPage3,
    page4: {} as SurveyPage4,
    page5: {} as SurveyPage5,
    page6: {} as SurveyPage6,
    page7: {} as SurveyPage7,
    page8: {} as SurveyPage8,
  });


  // Performance monitoring disabled to prevent excessive logging

  // Monitor uploadedFiles state changes and force re-render when images are restored
  useEffect(() => {
    const hasImages = Object.keys(uploadedFiles).some(key => uploadedFiles[key]?.length > 0);
    if (hasImages) {
      console.log('📷 uploadedFiles state changed:', Object.keys(uploadedFiles).map(key => ({
        field: key,
        count: uploadedFiles[key]?.length || 0
      })));
      console.log('📷 Full uploadedFiles state:', uploadedFiles);
    }
  }, [uploadedFiles]);

  // Enhanced validation system
  const { validatePage, validateAllPages, generateValidationReport, getFieldInfo } = useEnhancedValidation();

  // Simple image handling - no complex processing to prevent performance issues


  // Server-side save function
  const saveToServer = useCallback(async (pageName: keyof typeof formData, pageData: any, images?: any) => {
    if (!opportunityId) {
      console.warn('⚠️ No opportunity ID available for saving');
      return;
    }

    try {
      console.log(`💾 Saving ${pageName} to server...`);
      console.log(`💾 Page data to save:`, pageData);
      
      // Wrap the page data in the correct structure
      const wrappedPageData = {
        [pageName]: pageData
      };
      
      console.log(`💾 Wrapped page data:`, wrappedPageData);
      
      const response = await surveyApi.saveSurveyPage(opportunityId, wrappedPageData, images);
      
      if (response.success) {
        console.log(`✅ Successfully saved ${pageName} to server`);
      } else {
        console.error(`❌ Failed to save ${pageName} to server:`, response.error);
      }
    } catch (error) {
      console.error(`❌ Error saving ${pageName} to server:`, error);
    }
  }, [opportunityId]);

  // Optimized form data update with server-side saving
  const updateFormData = useCallback((pageName: keyof typeof formData, updateData: any) => {
    setFormData(prev => {
      const currentPageData = prev[pageName] || {};
      
      // Check if data actually changed to prevent unnecessary updates
      const hasChanges = Object.keys(updateData).some(key => 
        (currentPageData as any)[key] !== updateData[key]
      );
      
      if (!hasChanges) {
        return prev; // No changes, skip update
      }
      
      const newPageData = {
        ...currentPageData,
        ...updateData
      };
      
      // Only update if the page data is actually different
      if (JSON.stringify(currentPageData) === JSON.stringify(newPageData)) {
        return prev;
      }
      
      const newData = {
        ...prev,
        [pageName]: newPageData
      };
      
      // Save to server after a short delay to debounce rapid changes
      setTimeout(() => {
        saveToServer(pageName, newPageData);
      }, 1000);
      
      return newData;
    });
  }, [saveToServer]);

  // Helper function to update entire page data with server-side saving
  const updatePageData = useCallback((pageName: keyof typeof formData, pageData: any) => {
    setFormData(prev => {
      const currentPageData = prev[pageName];
      
      // Check if data actually changed to prevent unnecessary updates
      const hasChanges = JSON.stringify(currentPageData) !== JSON.stringify(pageData);
      
      if (!hasChanges) {
        return prev; // No changes, skip update
      }
      
      const newData = {
        ...prev,
        [pageName]: pageData
      };
      
      // Save to server after a short delay to debounce rapid changes
      setTimeout(() => {
        saveToServer(pageName, pageData);
      }, 1000);
      
      return newData;
    });
  }, [saveToServer]);

  // Performance optimized - minimal logging

  const totalPages = 8;


  // Modern Component Functions
  const ModernCard = ({ children, style, ...props }: any) => (
    <View 
      style={[
        modernStyles.card,
        { 
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
          shadowColor: isDark ? '#000' : '#000',
        },
        style
      ]} 
      {...props}
    >
      {children}
    </View>
  );

  const ModernInput = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder, 
    icon, 
    multiline = false,
    keyboardType = 'default',
    required = false,
    inputKey,
    fieldName,
    ...props 
  }: any) => {
    const isHighlighted = highlightedFields.has(fieldName || label);
    const isEmpty = required && (!value || value.trim() === '');
    
    return (
      <View style={modernStyles.inputContainer}>
        <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
          {label} {required && <Text style={{ color: theme.dangerButton }}>*</Text>}
        </Text>
        <View style={[
          modernStyles.inputWrapper,
          { 
            backgroundColor: theme.inputBackground,
            borderColor: isHighlighted || isEmpty ? theme.dangerButton : theme.cardBorder,
            borderWidth: isHighlighted || isEmpty ? 2 : 1,
          }
        ]}>
          {icon && (
            <View style={modernStyles.inputIconContainer}>
              <Ionicons name={icon} size={20} color={theme.secondaryText} />
            </View>
          )}
          <TextInput
            key={inputKey || `input-${label}`}
            style={[
              modernStyles.input,
              { color: theme.primaryText },
              multiline && modernStyles.inputMultiline
            ]}
            value={value}
            onChangeText={(text) => {
              onChangeText(text);
              // Remove highlighting when user starts typing
              if (isHighlighted) {
                setHighlightedFields(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(fieldName || label);
                  return newSet;
                });
              }
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.tertiaryText}
            multiline={multiline}
            keyboardType={keyboardType}
            accessibilityLabel={label}
            accessibilityHint={placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="next"
            {...props}
          />
        </View>
        {isEmpty && (
          <Text style={[styles.errorText, { color: theme.dangerButton }]}>
            This field is required
          </Text>
        )}
      </View>
    );
  };

  const ModernDropdown = ({ 
    label, 
    value, 
    options, 
    onSelect, 
    icon, 
    required = false,
    isOpen = false,
    onToggle,
    fieldName,
    ...props 
  }: any) => {
    const isHighlighted = highlightedFields.has(fieldName || label);
    const isEmpty = required && (!value || value.trim() === '');
    
    return (
    <View style={modernStyles.inputContainer}>
      <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
        {label} {required && <Text style={{ color: theme.dangerButton }}>*</Text>}
      </Text>
      <Pressable
        style={[
          modernStyles.dropdownWrapper,
          { 
            backgroundColor: theme.inputBackground,
            borderColor: isHighlighted || isEmpty ? theme.dangerButton : (isOpen ? theme.primaryButton : theme.cardBorder),
            borderWidth: isHighlighted || isEmpty ? 2 : 1,
          }
        ]}
        onPress={() => {
          onToggle();
          // Remove highlighting when user interacts
          if (isHighlighted) {
            setHighlightedFields(prev => {
              const newSet = new Set(prev);
              newSet.delete(fieldName || label);
              return newSet;
            });
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label} dropdown`}
        accessibilityHint={value ? `Currently selected: ${value}` : 'Tap to select an option'}
        {...props}
      >
        {icon && (
          <View style={modernStyles.inputIconContainer}>
            <Ionicons name={icon} size={20} color={theme.secondaryText} />
          </View>
        )}
        <Text style={[
          modernStyles.dropdownText,
          { color: value ? theme.primaryText : theme.tertiaryText }
        ]}>
          {value || 'Please Select'}
        </Text>
        <Ionicons 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={theme.secondaryText} 
        />
      </Pressable>
      
      {isOpen && (
        <Animated.View style={[
          modernStyles.dropdownOptions,
          { 
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
            shadowColor: isDark ? '#000' : '#000',
          }
        ]}>
          {options.map((option: any, index: number) => (
            <Pressable
              key={index}
              style={[
                modernStyles.dropdownOption,
                { borderBottomColor: theme.cardBorder }
              ]}
              onPress={() => {
                onSelect(option);
                onToggle();
              }}
              accessibilityRole="button"
              accessibilityLabel={option}
            >
              <Text style={[modernStyles.dropdownOptionText, { color: theme.primaryText }]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
      {isEmpty && (
        <Text style={[styles.errorText, { color: theme.dangerButton }]}>
          This field is required
        </Text>
      )}
    </View>
    );
  };

  // Enhanced Validation Popup Component
  const ValidationPopup = ({ visible, missingFields, onClose, onGoToField }: any) => {
    if (!visible) return null;

    // Generate detailed validation report
    const validationReport = generateValidationReport(formData, uploadedFiles, surveyValidationOptions);

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.validationPopup, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.validationHeader}>
              <Ionicons name="warning" size={24} color={theme.dangerButton} />
              <Text style={[styles.validationTitle, { color: theme.primaryText }]}>
                Missing Required Fields ({validationReport.totalMissingFields})
              </Text>
            </View>
            
            <Text style={[styles.validationMessage, { color: theme.secondaryText }]}>
              Please complete the following required fields. Tap on any field to navigate to its page:
            </Text>
            
            <ScrollView style={styles.missingFieldsList} showsVerticalScrollIndicator={false}>
              {validationReport.pageBreakdown.map((page, pageIndex) => (
                <View key={pageIndex} style={styles.validationPageSection}>
                  <Text style={[styles.validationPageTitle, { color: theme.primaryButton }]}>
                    📄 Page {page.pageNumber} ({page.missingFieldsCount} missing)
                  </Text>
                  {page.missingFields.map((field, fieldIndex) => (
                <TouchableOpacity
                      key={fieldIndex}
                  style={[styles.missingFieldItem, { borderColor: theme.cardBorder }]}
                      onPress={() => {
                        // Navigate to the specific page
                        setCurrentPage(page.pageNumber);
                        onClose();
                        
                        // Scroll to top after navigation
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                        }, 100);
                      }}
                    >
                      <View style={styles.fieldTypeIcon}>
                        <Ionicons 
                          name={field.type === 'image' ? 'camera' : field.type === 'dropdown' ? 'list' : 'text'} 
                          size={16} 
                          color={theme.primaryButton} 
                        />
                      </View>
                      <View style={styles.fieldDetails}>
                  <Text style={[styles.missingFieldText, { color: theme.primaryText }]}>
                          {field.name}
                  </Text>
                        <Text style={[styles.fieldTypeText, { color: theme.secondaryText }]}>
                          {field.type === 'image' ? 'Upload 2+ images' : 'Select or enter value'}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={theme.primaryButton} />
                </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.validationButtons}>
              <TouchableOpacity
                style={[styles.validationButton, styles.validationButtonSecondary, { borderColor: theme.cardBorder }]}
                onPress={onClose}
              >
                <Text style={[styles.validationButtonText, { color: theme.secondaryText }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Optimized Image Preview Component - memoized to prevent unnecessary re-renders
  const ImagePreview = React.memo(({ fieldName, images, onPress }: { fieldName: string, images: any[], onPress: () => void }) => {
    const previewImages = imagePreviews[fieldName] || [];
    const fullImages = uploadedFiles[fieldName] || [];
    const isLoading = loadingImages[`page${currentPage}`];

    if (isLoading) {
      return (
        <View style={[modernStyles.inputContainer, { padding: 16, alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={theme.primaryButton} />
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText, marginTop: 8 }]}>
            Loading images...
          </Text>
        </View>
      );
    }

    const displayImages = previewImages.length > 0 ? previewImages : fullImages;
    
    if (displayImages.length === 0) {
      return null;
    }

    return (
      <View style={modernStyles.inputContainer}>
        <Text style={[modernStyles.inputLabel, { color: theme.primaryText, marginBottom: 8 }]}>
          {fieldName} ({displayImages.length} image{displayImages.length !== 1 ? 's' : ''})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {displayImages.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                // Load full image if it's a preview
                if (image.isPreview) {
                  loadFullImage(fieldName, index);
                }
                onPress();
              }}
              style={{
                marginRight: 8,
                borderRadius: 8,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: theme.cardBorder
              }}
            >
              <Image
                source={{ uri: image.uri }}
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: theme.inputBackground
                }}
                resizeMode="cover"
                onError={(error) => {
                  console.warn(`Failed to load image ${index} for ${fieldName}:`, error);
                }}
              />
              {image.isPreview && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Ionicons name="cloud-download-outline" size={20} color="white" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  });

  const ModernFileUpload = React.memo(({ 
    label, 
    onPress, 
    files = [], 
    onRemove, 
    required = false,
    fieldName,
    minRequired = 2,
    maxFiles = 10,
    ...props 
  }: any) => {
    const currentCount = files.length;
    const isComplete = required ? currentCount >= minRequired : true;
    
    return (
      <View style={modernStyles.inputContainer}>
        {/* Show image previews if available */}
        {fieldName && <ImagePreview fieldName={fieldName} images={files} onPress={onPress} />}
        <View style={modernStyles.labelContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            {label} {required && <Text style={{ color: theme.dangerButton }}>*</Text>}
          </Text>
          <View style={modernStyles.imageCountContainer}>
            <Text style={[
              modernStyles.imageCount, 
              { color: isComplete ? '#10b981' : '#f59e0b' }
            ]}>
              {currentCount}/{maxFiles} images
            </Text>
            {required && !isComplete && (
              <Ionicons name="warning" size={16} color="#f59e0b" style={modernStyles.warningIcon} />
            )}
          </View>
        </View>
        <Pressable
          style={[
            modernStyles.fileUploadWrapper,
            { 
              backgroundColor: theme.inputBackground,
              borderColor: isComplete ? '#10b981' : theme.cardBorder,
            }
          ]}
          onPress={() => {
            // console.log('ModernFileUpload onPress called for:', label);
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Upload ${label}`}
          accessibilityHint="Tap to select files"
          {...props}
        >
          <View style={modernStyles.fileUploadContent}>
            <Ionicons name="camera-outline" size={32} color={theme.primaryButton} />
            <Text style={[modernStyles.fileUploadTitle, { color: theme.primaryText }]}>
              Add Photos
            </Text>
            <Text style={[modernStyles.fileUploadSubtitle, { color: theme.secondaryText }]}>
              Tap to take photos or select from gallery
            </Text>
            <Text style={[modernStyles.fileUploadHint, { color: theme.secondaryText }]}>
              {required ? `Minimum ${minRequired} images required` : 'Optional'} • Camera • Gallery • Files
            </Text>
          </View>
        </Pressable>
        
        {files.length > 0 && (
          <View style={[
            modernStyles.uploadedFilesContainer,
            { backgroundColor: theme.tertiaryBackground }
          ]}>
            {files.map((file: any, index: number) => (
              <View key={index} style={[
                modernStyles.uploadedFileItem,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }
              ]}>
                <View style={modernStyles.uploadedFileInfo}>
                  {file.uri && (file.type?.includes('image') || file.mimeType?.includes('image')) ? (
                    <Image 
                      source={{ uri: file.uri }} 
                      style={{ width: 40, height: 40, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  ) : (
                  <Ionicons name="document-outline" size={20} color={theme.primaryButton} />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[modernStyles.uploadedFileName, { color: theme.primaryText }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={[modernStyles.uploadedFileSize, { color: theme.secondaryText }]}>
                      {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Image'}
                  </Text>
                  </View>
                </View>
                <Pressable
                  style={modernStyles.removeFileButton}
                  onPress={() => onRemove(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${file.name}`}
                >
                  <Ionicons name="close-circle" size={20} color={theme.dangerButton} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  });

  useEffect(() => {
    // console.log('useEffect triggered - opportunityId:', opportunityId);
    
    // Check if we recently reset (within last 5 seconds)
    const recentlyReset = resetTimestamp && (Date.now() - resetTimestamp) < 5000;
    
    if (!justReset && !recentlyReset) {
      loadSurvey();
    } else {
      // console.log('Skipping loadSurvey due to justReset flag or recent reset');
    }
  }, [opportunityId, justReset, resetTimestamp]);

  // Load images for current page when page changes
  useEffect(() => {
    // Completely disable lazy loading for now to prevent 404 errors
    // TODO: Re-enable when survey data exists
    return;
    
  }, [currentPage, opportunityId, formData]);

  // Auto-navigation temporarily disabled

  // Auto-navigation temporarily disabled



  // Get field names for a specific page
  const getPageFields = (pageNumber: number): string[] => {
    const pageFields: { [key: number]: string[] } = {
      1: ['frontProperty', 'rearProperty', 'sideProperty', 'roofProperty'],
      2: ['electricalPanel', 'meterLocation', 'consumerUnit'],
      3: ['roofStructure', 'roofCondition', 'roofAccess'],
      4: ['gardenArea', 'driveway', 'parkingArea'],
      5: ['existingSolar', 'existingBattery', 'existingEvCharger'],
      6: ['surveyorNotes', 'additionalPhotos'],
      7: ['installationPhotos', 'beforePhotos', 'duringPhotos'],
      8: ['completionPhotos', 'finalPhotos', 'certificatePhotos']
    };
    return pageFields[pageNumber] || [];
  };

  // Load full image data when needed - optimized with caching
  const loadFullImage = useCallback(async (fieldName: string, imageIndex: number) => {
    const cacheKey = `${fieldName}-${imageIndex}`;
    
    // Check cache first
    if (imageCache[cacheKey]) {
      console.log('📷 Using cached image for:', cacheKey);
      return imageCache[cacheKey];
    }
    
    try {
      setLoadingImages(prev => ({ ...prev, [cacheKey]: true }));
      
      const response = await surveyApi.getSurveyImages(opportunityId);
      if (response.success && response.data && Array.isArray(response.data)) {
        // Find the specific image for this field
        const fieldImages = response.data.filter((image: any) => image.fieldName === fieldName);
        if (fieldImages[imageIndex]) {
          const image = fieldImages[imageIndex];
          const fullImageData = {
            uri: image.filePath,
            name: image.fileName || image.originalName || `${fieldName}-${Date.now()}`,
            type: image.mimeType || 'image/jpeg',
            size: image.fileSize || 0,
            mimeType: image.mimeType || 'image/jpeg',
            base64: null,
            isPreview: false
          };

          // Cache the image
          setImageCache(prev => ({ ...prev, [cacheKey]: fullImageData }));

          // Update the specific image in uploadedFiles
          setUploadedFiles(prev => ({
            ...prev,
            [fieldName]: prev[fieldName] ? 
              prev[fieldName].map((img, idx) => idx === imageIndex ? fullImageData : img) :
              [fullImageData]
          }));

          return fullImageData;
        }
      }
    } catch (error) {
      // Only log if it's not a 404 error (which is expected for new surveys)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage && !errorMessage.includes('404') && !errorMessage.includes('Survey not found')) {
        console.error(`Error loading full image for ${fieldName}[${imageIndex}]:`, error);
      }
    } finally {
      setLoadingImages(prev => ({ ...prev, [cacheKey]: false }));
    }
    return null;
  }, [opportunityId, imageCache]);


  const loadSurvey = async () => {
    setLoading(true);
    // Reset manual navigation flag when loading survey
    setHasManuallyNavigated(false);
    try {
      // If we just reset, don't load saved data
      if (justReset) {
        console.log('🔍 Just reset, skipping data load');
        setJustReset(false); // Reset the flag
        setLoading(false);
        return;
      }
      
      
      // Try to get existing survey
      const response = await surveyApi.getSurvey(opportunityId);
      if (response.success && response.data) {
        setSurvey(response.data);
        
        // Load all form data at once to reduce state updates
        const newFormData = {
          page1: response.data.page1 || {},
          page2: response.data.page2 || {},
          page3: response.data.page3 || {},
          page4: response.data.page4 || {},
          page5: response.data.page5 || {},
          page6: response.data.page6 || {},
          page7: response.data.page7 || {},
          page8: response.data.page8 || {},
        };

        // Load images from URLs and convert to display format - optimized
        const loadImagesFromUrls = (pageData: any) => {
          const imageFields = ['energyBill', 'epcCertificate', 'frontDoor', 'frontProperty', 'targetRoofs', 'propertySides', 
                              'roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 
                              'garage', 'fuseBoard', 'batteryInverterLocation', 'evLocation', 'evCharger', 
                              'shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'];
          
          const loadedImages: any = {};
          
          imageFields.forEach(fieldName => {
            const fieldFiles = pageData[`${fieldName}Files`];
            if (fieldFiles && Array.isArray(fieldFiles)) {
              // Only load images that aren't already cached to prevent duplicates
              const existingImages = uploadedFiles[fieldName] || [];
              if (existingImages.length === 0) {
                loadedImages[fieldName] = fieldFiles.map((url: string, index: number) => ({
                  uri: url,
                  name: `${fieldName}_${index + 1}.jpg`,
                  mimeType: 'image/jpeg',
                  size: 0,
                  isFromServer: true,
                  timestamp: Date.now()
                }));
              }
            }
          });
          
          return loadedImages;
        };

        // Load images from all pages
        const allLoadedImages: any = {};
        Object.keys(newFormData).forEach(pageKey => {
          const pageImages = loadImagesFromUrls(newFormData[pageKey as keyof typeof newFormData]);
          Object.assign(allLoadedImages, pageImages);
        });

        // Update uploaded files state with loaded images - merge with existing images
        if (Object.keys(allLoadedImages).length > 0) {
          console.log('📷 Loading images from server URLs:', Object.keys(allLoadedImages));
          setUploadedFiles(prev => {
            const updated = { ...prev };
            Object.keys(allLoadedImages).forEach(fieldName => {
              // Merge new images with existing ones, avoiding duplicates
              const existingImages = updated[fieldName] || [];
              const newImages = allLoadedImages[fieldName] || [];
              
              // Create a map to track existing image URLs to avoid duplicates
              const existingUrls = new Set(existingImages.map((img: any) => img.uri || img.url));
              
              // Add new images that don't already exist
              const uniqueNewImages = newImages.filter((img: any) => 
                !existingUrls.has(img.uri || img.url)
              );
              
              updated[fieldName] = [...existingImages, ...uniqueNewImages];
            });
            return updated;
          });
          uploadedFilesRef.current = {
            ...uploadedFilesRef.current,
            ...allLoadedImages
          };
        }

        // Load survey data directly
        if (true) {
          // Proceed with normal logic
          console.log('🔍 No auto-saved data found, proceeding with normal survey loading');
          
          // Check if page1 exists and has data
          if (response.data.page1 && Object.keys(response.data.page1).length > 0) {
            // Survey exists with data, load it
            console.log('🔍 Survey exists with page1 data:', response.data.page1);
            
            // Check if user names are missing and auto-fill them
            const page1Data = response.data.page1;
            const needsUserNames = !page1Data.renewableExecutiveFirstName || !page1Data.renewableExecutiveLastName || !page1Data.customerFirstName || !page1Data.customerLastName;
            
            if (needsUserNames) {
              console.log('🔍 Page1 exists but missing user names, auto-filling user info...');
              // Only auto-fill if Page 1 is empty or missing critical data
              const currentPage1Data = formData.page1 || {};
              const hasPage1Data = Object.keys(currentPage1Data).length > 0 && 
                Object.values(currentPage1Data).some(value => value !== null && value !== undefined && value !== '');
              
              if (!hasPage1Data) {
                await autoFillFromOpportunity();
              } else {
                console.log('🔍 Page 1 already has data, skipping auto-fill for missing user names');
              }
            } else {
              console.log('🔍 Page1 has all user names, loading existing data');
              // Merge API data with existing form data to preserve local images
              // Log form data structure without base64 content
              safeLogData(formData, '🔍 Previous form data structure:');
              console.log('🔍 New form data from API:', newFormData);
              const mergedFormData = { ...formData };
              Object.keys(newFormData).forEach(pageKey => {
                if (newFormData[pageKey as keyof typeof newFormData]) {
                  mergedFormData[pageKey as keyof typeof mergedFormData] = {
                    ...mergedFormData[pageKey as keyof typeof mergedFormData],
                    ...newFormData[pageKey as keyof typeof newFormData]
                  };
                }
              });
              console.log('🔍 Merged form data (preserving local images):', mergedFormData);
              
              setFormData(mergedFormData);
              setAutoFilledDetails(response.data.page1);
              
            }
          } else {
            // Survey exists but page1 is null/empty, auto-fill from opportunity
            console.log('🔍 Survey exists but page1 is null/empty, auto-filling from opportunity...');
            
            // First, load any existing data from other pages
            console.log('🔍 Loading existing data from other pages:', newFormData);
            const mergedFormData = { ...formData };
            Object.keys(newFormData).forEach(pageKey => {
              if (newFormData[pageKey as keyof typeof newFormData]) {
                mergedFormData[pageKey as keyof typeof mergedFormData] = {
                  ...mergedFormData[pageKey as keyof typeof mergedFormData],
                  ...newFormData[pageKey as keyof typeof newFormData]
                };
              }
            });
            console.log('🔍 Merged form data (including other pages):', mergedFormData);
            setFormData(mergedFormData);
            
            // Only auto-fill if Page 1 is empty
            const currentPage1Data = formData.page1 || {};
            const hasPage1Data = Object.keys(currentPage1Data).length > 0 && 
              Object.values(currentPage1Data).some(value => value !== null && value !== undefined && value !== '');
            
            if (!hasPage1Data) {
              await autoFillFromOpportunity();
            } else {
              console.log('🔍 Page 1 already has data, skipping auto-fill for null/empty page1');
            }
          }
        }
      } else {
        // No survey exists, create new survey and auto-fill
        console.log('🔍 No existing survey found, creating new survey...');
        const createResponse = await surveyApi.createSurvey(opportunityId);
        console.log('📡 createSurvey response:', createResponse);
        if (createResponse.success && createResponse.data) {
          setSurvey(createResponse.data);
          // Only auto-fill if Page 1 is empty
          const currentPage1Data = formData.page1 || {};
          const hasPage1Data = Object.keys(currentPage1Data).length > 0 && 
            Object.values(currentPage1Data).some(value => value !== null && value !== undefined && value !== '');
          
          if (!hasPage1Data) {
            console.log('🔍 Page 1 is empty, auto-filling from opportunity...');
            await autoFillFromOpportunity();
          } else {
            console.log('🔍 Page 1 already has data, skipping auto-fill');
          }
        } else {
          console.error('❌ Failed to create new survey:', createResponse.error);
          console.log('⚠️ Survey creation failed, but continuing with form...');
        }
      }
    } catch (error) {
      console.error('Error loading survey:', error);
      showAlert('Error', 'Failed to load survey', 'error');
    } finally {
      setLoading(false);
    }
  };

  const autoFillFromOpportunity = async (forceUpdate = false) => {
    try {
      console.log('🔍 Starting auto-fill from opportunity:', opportunityId, 'forceUpdate:', forceUpdate);
      
      if (!opportunityId) {
        console.log('⚠️ No opportunity ID provided, skipping auto-fill');
        return;
      }

      // Check if user has already progressed beyond page 1
      const hasProgressedBeyondPage1 = formData.page2 && Object.keys(formData.page2).length > 0 ||
                                      formData.page3 && Object.keys(formData.page3).length > 0 ||
                                      formData.page4 && Object.keys(formData.page4).length > 0 ||
                                      formData.page5 && Object.keys(formData.page5).length > 0;
      
      if (hasProgressedBeyondPage1 && !forceUpdate) {
        console.log('🔍 User has progressed beyond page 1, skipping auto-fill to preserve lastPage');
        return;
      }

      // Fetch opportunity details using the same route as OpportunityDetailsScreen
      const { api, authApi } = await import('../utils/api');
      console.log('🌐 Making API call to:', `/opportunities/${opportunityId}/details`);
      const response = await api.get(`/opportunities/${opportunityId}/details`);
      console.log('📡 API Response:', response.data);
      
      // Get current user information for renewable executive
      const currentUser = await authApi.getUser();
      console.log('👤 Current user:', currentUser);
      
      // The details API returns the opportunity data directly
      let detailsData = response.data as {
        contactAddress?: string | null;
        contactPostcode?: string | null;
        address?: string | null;
        contactFirstName?: string | null;
        contactLastName?: string | null;
        contactCity?: string | null;
        contactState?: string | null;
        contactAddressLine2?: string | null;
        notes?: string | null;
        customFields?: any[] | null;
        appointmentDetails?: any | null;
        customerName?: string | null;
        customerAddress?: string | null;
        scheduledAt?: string | null;
      };
      
      // Manual (new) opportunities: /details often returns nulls; use base opportunity endpoint
      const hasNoContact =
        !detailsData?.contactFirstName &&
        !detailsData?.contactLastName &&
        !detailsData?.contactAddress &&
        !detailsData?.address &&
        !detailsData?.contactPostcode;
      if (hasNoContact && opportunityId) {
        try {
          const baseRes = await api.get<any>(`/opportunities/${opportunityId}`);
          const opp = baseRes.success ? baseRes.data : null;
          if (opp) {
            const customerName = opp.customerName || opp.contactName || '';
            const parts = (customerName || '').trim().split(/\s+/);
            const customerFirstName = parts[0] || '';
            const customerLastName = parts.slice(1).join(' ') || '';
            const address =
              opp.customerAddress || opp.contactAddress || opp.address || '';
            const scheduledAt = opp.scheduledAt;
            detailsData = {
              ...detailsData,
              contactFirstName: customerFirstName || detailsData.contactFirstName,
              contactLastName: customerLastName || detailsData.contactLastName,
              contactAddress: address || detailsData.contactAddress,
              address: address || detailsData.address,
              contactPostcode: opp.contactPostcode || detailsData.contactPostcode,
              appointmentDetails: scheduledAt
                ? { date: scheduledAt }
                : detailsData.appointmentDetails,
            };
            console.log('📋 Merged manual opportunity data into details:', {
              customerFirstName,
              customerLastName,
              address: address ? `${address.slice(0, 50)}...` : '',
              scheduledAt: scheduledAt || null,
            });
          }
        } catch (e) {
          console.warn('⚠️ Fallback GET /opportunities/:id for manual opportunity failed:', e);
        }
      }
      
      console.log('📋 Details API data:', detailsData);
        
      // Extract customer information for header display
      const fallbackFullName = (detailsData as any)?.customerName || (detailsData as any)?.contactName || '';
      const fallbackParts = String(fallbackFullName || '').trim().split(/\s+/).filter(Boolean);
      const customerFirstName = detailsData.contactFirstName || fallbackParts[0] || '';
      const customerLastName = detailsData.contactLastName || fallbackParts.slice(1).join(' ') || '';
      const customerName = `${customerFirstName} ${customerLastName}`.trim() || String(fallbackFullName || '').trim() || 'Loading...';
      const customerPostcode = detailsData.contactPostcode || 'Loading...';
      
      if (customerName !== 'Loading...' || customerPostcode !== 'Loading...') {
        setCustomerInfo({
          name: customerName,
          postcode: customerPostcode
        });
        console.log('✅ Customer info set:', { name: customerName, postcode: customerPostcode });
      }
        
        // Extract data directly from details API response
        const addressLine1 = detailsData.contactAddress || detailsData.address || '';
        const addressLine2 = detailsData.contactAddressLine2 || '';
        const town = detailsData.contactCity || '';
        const county = detailsData.contactState || '';
        const postcode = detailsData.contactPostcode || '';
        
        // Extract renewable executive info from current user
        const renewableExecutiveFirstName = currentUser?.name?.split(' ')[0] || currentUser?.firstName || '';
        const renewableExecutiveLastName = currentUser?.name?.split(' ').slice(1).join(' ') || currentUser?.lastName || '';
        
        // Handle the case where contactAddress might contain the full address
        // If contactAddress contains more than just the street address, parse it
        let parsedAddressLine1 = addressLine1;
        let parsedTown = town;
        let parsedCounty = county;
        
        if (addressLine1 && addressLine1.includes(',')) {
          // If contactAddress contains commas, it might be a full address
          const addressParts = addressLine1.split(',').map(part => part.trim());
          if (addressParts.length >= 2) {
            parsedAddressLine1 = addressParts[0]; // First part is usually the street address
            if (addressParts.length >= 3) {
              parsedTown = addressParts[1] || town;
              parsedCounty = addressParts[2] || county;
            } else if (addressParts.length === 2) {
              parsedTown = addressParts[1] || town;
            }
          }
        }
        
        console.log('🔍 Extracted data from details API:', {
          customerFirstName,
          customerLastName,
          renewableExecutiveFirstName,
          renewableExecutiveLastName,
          addressLine1: parsedAddressLine1,
          addressLine2,
          town: parsedTown,
          county: parsedCounty,
          postcode,
          appointmentDetails: detailsData.appointmentDetails
        });
        
        // Extract appointment date and time if available
        let appointmentDate = new Date();
        let appointmentTime = new Date();
        let appointmentDateTimeString = '';
        
        if (detailsData.appointmentDetails && detailsData.appointmentDetails.date) {
          try {
            // Parse the appointment date from the extracted details
            const appointmentDateObj = new Date(detailsData.appointmentDetails.date);
            if (!isNaN(appointmentDateObj.getTime())) {
              appointmentDate = appointmentDateObj;
              appointmentTime = appointmentDateObj;
              appointmentDateTimeString = `${appointmentDateObj.toLocaleDateString('en-GB')} at ${appointmentDateObj.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })}`;
              console.log('✅ Using appointment date from opportunity:', appointmentDateTimeString);
            } else {
              console.log('⚠️ Invalid appointment date format, using current date');
            }
          } catch (error) {
            console.log('⚠️ Error parsing appointment date, using current date:', error);
          }
        } else {
          console.log('ℹ️ No appointment details found, using current date');
        }
        
        // Auto-fill page 1 with opportunity data and current user info
        const autoFilledData = {
          date: appointmentDate.toLocaleDateString('en-GB'),
          renewableExecutiveFirstName: renewableExecutiveFirstName || '',
          renewableExecutiveLastName: renewableExecutiveLastName || '',
          customerFirstName: customerFirstName || '',
          customerLastName: customerLastName || '',
          addressLine1: parsedAddressLine1 || '',
          addressLine2: addressLine2 || '',
          town: parsedTown || '',
          county: parsedCounty || '',
          postcode: postcode || '',
          homeOwnersAvailable: HomeOwnerAvailability.YES_SKIP_NEXT,
          appointmentDurationConfirmed: 'Yes',
          appointmentDateTime: appointmentDateTimeString,
        };
        
        console.log('🔍 Final auto-filled data:', autoFilledData);

      // Auto-fill appointment date even if other data exists, but preserve other user input
      setFormData(prev => {
        const currentPage1Data = prev.page1 || {};
        const hasExistingData = Object.keys(currentPage1Data).length > 0 && 
          Object.values(currentPage1Data).some(value => value !== null && value !== undefined && value !== '');
        
        if (hasExistingData && !forceUpdate) {
          console.log('🔍 Page 1 already has data, updating only appointment date to preserve user input');
          // Only update appointment-related fields, preserve other user input
          const updatedData = {
            ...prev,
            page1: {
              ...prev.page1,
              date: autoFilledData.date, // Update assessment date with appointment date
              appointmentDateTime: autoFilledData.appointmentDateTime, // Update appointment date/time
            }
          };
          console.log('🔍 Appointment date update applied:', updatedData.page1.date, updatedData.page1.appointmentDateTime);
          return updatedData;
        }
        
        // Full auto-fill for empty page
        const updatedData = {
          ...prev,
          page1: {
            ...prev.page1,
            ...autoFilledData
          }
        };
        
        console.log('🔍 Full auto-fill applied:', updatedData);
        return updatedData;
      });

        // Store auto-filled details for display
        setAutoFilledDetails(autoFilledData);
        
        // Always update date and time picker states with appointment date
        setSelectedDate(appointmentDate);
        setSelectedTime(appointmentTime);
        
        console.log('✅ Auto-filled survey page 1 with opportunity data and current user info');
        console.log('📅 Appointment date set:', appointmentDate.toLocaleDateString('en-GB'));
        console.log('⏰ Appointment time set:', appointmentTime.toLocaleTimeString('en-GB'));
        console.log('📝 Appointment date/time string:', appointmentDateTimeString);
        
        // Force update the form data to ensure appointment date is visible
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            page1: {
              ...prev.page1,
              date: appointmentDate.toLocaleDateString('en-GB'),
              appointmentDateTime: appointmentDateTimeString,
            }
          }));
          console.log('🔄 Forced appointment date update applied');
        }, 100);
        
        
        // Auto-navigation disabled for performance
        
        // Auto-navigation temporarily disabled
    } catch (error) {
      console.error('❌ Error auto-filling from opportunity:', error);
      // Set default values on error, but preserve existing data
      setFormData(prev => {
        const currentPage1Data = prev.page1 || {};
        const hasExistingData = Object.keys(currentPage1Data).length > 0 && 
          Object.values(currentPage1Data).some(value => value !== null && value !== undefined && value !== '');
        
        if (hasExistingData) {
          console.log('🔍 Page 1 already has data, preserving existing data on error');
          return prev;
        }
        
        const defaultData = {
          date: new Date().toLocaleDateString('en-GB'),
          homeOwnersAvailable: prev.page1?.homeOwnersAvailable || HomeOwnerAvailability.YES_SKIP_NEXT,
        };
        
        const updatedData = {
          ...prev,
          page1: {
            ...prev.page1,
            ...defaultData
          }
        };
        
        
        return updatedData;
      });
    }
  };

  const manualAutoFill = async () => {
    console.log('🔧 Manual auto-fill triggered');
    await autoFillFromOpportunity(true);
    // Auto-navigation temporarily disabled
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const isWeb = typeof window !== 'undefined' && window.document;
    if (isWeb) {
      setShowDatePicker(false);
    } else {
      setShowDatePicker(Platform.OS === 'ios');
    }
    
    if (selectedDate) {
      setSelectedDate(selectedDate);
      // Update the form data with the selected date
      const dateString = selectedDate.toLocaleDateString('en-GB');
      const timeString = selectedTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      updateFormData('page1', { 
        appointmentDateTime: `${dateString} at ${timeString}` 
      });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    const isWeb = typeof window !== 'undefined' && window.document;
    if (isWeb) {
      setShowTimePicker(false);
    } else {
      setShowTimePicker(Platform.OS === 'ios');
    }
    
    if (selectedTime) {
      setSelectedTime(selectedTime);
      // Update the form data with the selected time
      const dateString = selectedDate.toLocaleDateString('en-GB');
      const timeString = selectedTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      updateFormData('page1', { 
        appointmentDateTime: `${dateString} at ${timeString}` 
      });
    }
  };

  // Get available reps based on current user
  const getAvailableReps = (user: any) => {
    if (!user?.name) {
      return allReps; // Fallback
    }

    // Admin accounts can see all reps
    if (user.role === 'ADMIN') {
      return allReps;
    }

    // Find the user name (case-insensitive) - extract first name from full name
    const userFirstName = user.name.split(' ')[0];
    const userName = Object.keys(userRepMapping).find(
      name => name.toLowerCase() === userFirstName.toLowerCase()
    );

    if (!userName) {
      // If user is not in the mapping, show all reps (fallback)
      return allReps;
    }

    // Get allowed rep IDs for this user
    const allowedRepIds = userRepMapping[userName as keyof typeof userRepMapping];
    
    // Filter reps to only show allowed reps
    const filteredReps = allReps.filter(rep => 
      allowedRepIds.includes(rep.id)
    );

    return filteredReps;
  };

  // Fetch calendar events for rebooking (using current logged-in user)
  const fetchCalendarEvents = async (date: Date) => {
    try {
      console.log('🔍 fetchCalendarEvents: Starting fetch for current user calendar, date:', date);
      setLoadingCalendar(true);
      const { authApi } = await import('../utils/api');
      const token = await authApi.getAccessToken();
      
      const startDate = date.toISOString().split('T')[0];
      const endDate = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL || '/api/'}/calendar/current/events?startDate=${startDate}&endDate=${endDate}`;
      
      console.log('🔍 fetchCalendarEvents: API URL:', apiUrl);
      console.log('🔍 fetchCalendarEvents: Token available:', !!token);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });
      
      console.log('🔍 fetchCalendarEvents: Response status:', response.status);
      console.log('🔍 fetchCalendarEvents: Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 fetchCalendarEvents: Response data:', data);
        console.log('🔍 fetchCalendarEvents: Current user:', data.userName);
        console.log('🔍 fetchCalendarEvents: Events found:', data.events?.length || 0);
        setCalendarEvents(data.events || []);
        
        // Update the current user info
        if (data.userName) {
          setCurrentUser(data.userName);
        }
      } else {
        const errorText = await response.text();
        console.error('🔍 fetchCalendarEvents: Failed to fetch calendar events. Status:', response.status, 'Error:', errorText);
        setCalendarEvents([]);
      }
    } catch (error) {
      console.error('🔍 fetchCalendarEvents: Error fetching calendar events:', error);
      setCalendarEvents([]);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Generate time slots for rebooking
  const generateTimeSlots = (date: Date) => {
    const slots = [];
    const existingEvents = calendarEvents.filter(event => {
      // Handle both old format (event.start) and new format (event.date)
      const eventDate = event.start ? new Date(event.start) : new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });

    console.log('🔍 generateTimeSlots: Date:', date.toDateString());
    console.log('🔍 generateTimeSlots: Existing events for this date:', existingEvents.length);
    console.log('🔍 generateTimeSlots: Events details:', existingEvents.map(e => ({
      title: e.title,
      isAllDay: e.isAllDay,
      status: e.status,
      startTime: e.startTime,
      endTime: e.endTime
    })));

    // Check if there are any all-day events that would block the entire day
    const hasAllDayEvent = existingEvents.some(event => {
      const isAllDay = event.isAllDay === true || event.isAllDay === 'true';
      const isBusy = event.status === 'busy' || event.status === 'out-of-office';
      const isBlocked = event.title && (
        event.title.toLowerCase().includes('not available') ||
        event.title.toLowerCase().includes('unavailable') ||
        event.title.toLowerCase().includes('blocked') ||
        event.title.toLowerCase().includes('holiday') ||
        event.title.toLowerCase().includes('leave')
      );
      
      console.log('🔍 Event check:', {
        title: event.title,
        isAllDay,
        isBusy,
        isBlocked,
        wouldBlock: isAllDay && (isBusy || isBlocked)
      });
      
      return isAllDay && (isBusy || isBlocked);
    });

    console.log('🔍 generateTimeSlots: Has all-day blocking event:', hasAllDayEvent);

    // Generate time slots from 9 AM to 5 PM
    for (let hour = 9; hour <= 17; hour++) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);
      
      // If there's an all-day blocking event, all slots are unavailable
      if (hasAllDayEvent) {
        slots.push({
          time: `${hour.toString().padStart(2, '0')}:00`,
          available: false,
          reason: 'All-day event'
        });
        continue;
      }
      
      // Check if this time slot conflicts with existing events
      const hasConflict = existingEvents.some(event => {
        const eventStart = new Date(event.start || event.date);
        const eventEnd = new Date(event.end || event.date);
        
        // Handle all-day events
        if (event.isAllDay === true || event.isAllDay === 'true') {
          return false; // Already handled above
        }
        
        // Handle timed events
        const eventHour = eventStart.getHours();
        const eventEndHour = eventEnd.getHours();
        
        // Check if the slot hour conflicts with any event
        return hour >= eventHour && hour < eventEndHour;
      });
      
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        available: !hasConflict,
        reason: hasConflict ? 'Time conflict' : 'Available'
      });
    }
    
    console.log('🔍 generateTimeSlots: Generated slots:', slots);
    return slots;
  };

  // Get responsive styles based on screen width
  const getResponsiveStyles = () => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const isSmallScreen = screenWidth < 480;
    const isTablet = screenWidth >= 768;
    const isLandscape = screenWidth > screenHeight;
    
    return {
      timeSlotWidth: isSmallScreen ? 0.3 : isTablet ? 0.18 : 0.22,
      timeSlotMinWidth: isSmallScreen ? 60 : isTablet ? 80 : 70,
      timeSlotMaxWidth: isSmallScreen ? 80 : isTablet ? 100 : 90,
      calendarOptionMinWidth: isSmallScreen ? 90 : isTablet ? 120 : 100,
      calendarOptionMaxWidth: isSmallScreen ? 120 : isTablet ? 160 : 140,
      fontSize: isSmallScreen ? 12 : isTablet ? 15 : 13,
      modalPadding: isTablet ? 40 : 20,
      sectionSpacing: isTablet ? 30 : 20,
      buttonHeight: isTablet ? 50 : 40,
    };
  };

  // Open rebooking modal
  const openRebookingModal = () => {
    console.log('🔍 Opening rebooking modal for current user');
    setShowRebookingModal(true);
    // Fetch calendar events for current logged-in user
    fetchCalendarEvents(selectedDate);
  };

  // Handle calendar selection change (legacy - not used anymore)
  const handleCalendarChange = (calendarId: string) => {
    setSelectedCalendar(calendarId);
    setSelectedTimeSlot('');
    // This function is no longer used since we auto-detect current user
  };

  // Handle date change in rebooking modal
  const handleRebookingDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    setSelectedTimeSlot('');
    // Fetch calendar events for current user with new date
    fetchCalendarEvents(newDate);
  };

  // Handle time slot selection
  const handleTimeSlotSelect = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
  };

  // Confirm rebooking
  const confirmRebooking = () => {
    if (selectedCalendar && selectedTimeSlot) {
      const dateString = selectedDate.toLocaleDateString('en-GB');
      const selectedCalendarName = availableCalendars.find(c => c.id === selectedCalendar)?.name || selectedCalendar;
      
      updateFormData('page1', { 
        appointmentDateTime: `${dateString} at ${selectedTimeSlot} (${selectedCalendarName})` 
      });
      
      setShowRebookingModal(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  };

  const handleScaffoldingMultiSelect = (option: string) => {
    const currentSelections = formData.page8?.scaffoldingRequired || [];
    const selectionsArray: string[] = Array.isArray(currentSelections) ? currentSelections : [];
    
    let newSelections: string[];
    if (selectionsArray.includes(option)) {
      // Remove if already selected
      newSelections = selectionsArray.filter((item: string) => item !== option);
    } else {
      // Add if not selected
      newSelections = [...selectionsArray, option];
    }
    
    updateFormData('page8', { scaffoldingRequired: newSelections });
  };

  const enrichWithContactDetails = async (id: string) => {
    try {
      const { api } = await import('../utils/api');
      console.log('📍 Fetching detailed contact info for opportunity via /opportunities/:id/details', id);
      const detailsResponse = await api.get(`/opportunities/${id}/details`);
      console.log('📍 Details API response:', detailsResponse.data);

      let detailsData = detailsResponse.data as {
        contactAddress?: string | null;
        contactPostcode?: string | null;
        address?: string | null;
        contactFirstName?: string | null;
        contactLastName?: string | null;
        contactCity?: string | null;
        contactState?: string | null;
        contactAddressLine2?: string | null;
      } | null;

      // Manual opportunities: /details often returns nulls; fallback to base opportunity
      const hasNoContact =
        !detailsData?.contactFirstName &&
        !detailsData?.contactLastName &&
        !detailsData?.contactAddress &&
        !detailsData?.address;
      if (hasNoContact) {
        try {
          const baseRes = await api.get<any>(`/opportunities/${id}`);
          const opp = baseRes.success ? baseRes.data : null;
          if (opp) {
            const customerName = opp.customerName || opp.contactName || '';
            const parts = (customerName || '').trim().split(/\s+/);
            detailsData = {
              contactFirstName: parts[0] || '',
              contactLastName: parts.slice(1).join(' ') || '',
              contactAddress: opp.customerAddress || opp.contactAddress || opp.address || '',
              address: opp.customerAddress || opp.contactAddress || opp.address || '',
              contactPostcode: opp.contactPostcode || '',
              contactCity: null,
              contactState: null,
              contactAddressLine2: null,
            };
            console.log('📍 Enriched from manual opportunity base:', detailsData);
          }
        } catch (e) {
          console.warn('⚠️ Fallback GET /opportunities/:id for enrich failed:', e);
        }
      }

      if (detailsData) {
        // If detailsData has a full name but missing first/last, derive them.
        const fullName = (detailsData as any)?.customerName || (detailsData as any)?.contactName || '';
        if ((!detailsData.contactFirstName || !detailsData.contactLastName) && fullName) {
          const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
          detailsData = {
            ...detailsData,
            contactFirstName: detailsData.contactFirstName || parts[0] || '',
            contactLastName: detailsData.contactLastName || parts.slice(1).join(' ') || '',
          };
        }
        const resolvedAddress = detailsData.contactAddress || detailsData.address || '';
        const resolvedPostcode = detailsData.contactPostcode || '';
        const resolvedFirstName = detailsData.contactFirstName || '';
        const resolvedLastName = detailsData.contactLastName || '';
        const resolvedCity = detailsData.contactCity || '';
        const resolvedState = detailsData.contactState || '';
        const resolvedAddressLine2 = detailsData.contactAddressLine2 || '';

        // Update form data with enriched contact details, preserving existing values if new ones are empty
        const currentPage1 = formData.page1 || {};
        const enrichedData = {
          customerFirstName: resolvedFirstName || currentPage1.customerFirstName || '',
          customerLastName: resolvedLastName || currentPage1.customerLastName || '',
          addressLine1: resolvedAddress || currentPage1.addressLine1 || '',
          addressLine2: resolvedAddressLine2 || currentPage1.addressLine2 || '',
          town: resolvedCity || currentPage1.town || '',
          county: resolvedState || currentPage1.county || '',
          postcode: resolvedPostcode || currentPage1.postcode || '',
        };

        // Use updateFormData to update enriched data
        updateFormData('page1', enrichedData);

        // Update auto-filled details with enriched data, preserving existing values
        setAutoFilledDetails((prev: any) => {
          const currentDetails = prev || {};
          return {
            ...currentDetails,
            customerFirstName: resolvedFirstName || currentDetails.customerFirstName || '',
            customerLastName: resolvedLastName || currentDetails.customerLastName || '',
            addressLine1: resolvedAddress || currentDetails.addressLine1 || '',
            addressLine2: resolvedAddressLine2 || currentDetails.addressLine2 || '',
            town: resolvedCity || currentDetails.town || '',
            county: resolvedState || currentDetails.county || '',
            postcode: resolvedPostcode || currentDetails.postcode || '',
          };
        });

        console.log('✅ Enriched survey data with contact details:', {
          address: resolvedAddress,
          postcode: resolvedPostcode,
          city: resolvedCity,
          state: resolvedState,
          addressLine2: resolvedAddressLine2
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Failed to fetch /opportunities/:id/details:', e?.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSurvey();
    setRefreshing(false);
  };

  const reloadSurvey = async () => {
    setLoading(true);
    try {
      await loadSurvey();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = async () => {
    console.log('🔄 Resetting form data...');
    // Reset form data
    setJustReset(true); // Prevent reloading of saved data
    setResetTimestamp(Date.now()); // Set timestamp to prevent reloading
    // Reset flags set
    
    
    // Use setTimeout to ensure this runs after any pending state updates
    setTimeout(() => {
      // Reset all form data to initial state immediately
      const emptyFormData = {
        page1: {} as SurveyPage1,
        page2: {} as SurveyPage2,
        page3: {} as SurveyPage3,
        page4: {} as SurveyPage4,
        page5: {} as SurveyPage5,
        page6: {} as SurveyPage6,
        page7: {} as SurveyPage7,
        page8: {} as SurveyPage8,
      };
      setFormData(emptyFormData);
    
      // Reset all dropdown states
      setShowDropdown(false);
      setShowPropertyDropdown(false);
      setShowPropertyTypeDropdown(false);
      setShowBedroomsDropdown(false);
      setShowLengthOfStayDropdown(false);
      setShowMovingPlansDropdown(false);
      setShowOccupantsDropdown(false);
      setShowHeatingTypeDropdown(false);
      setShowAdditionalFeaturesDropdown(false);
      setShowPrepaidMeterDropdown(false);
      setShowPhaseMeterDropdown(false);
      setShowEpcRatingDropdown(false);
      setShowPreviousFundingDropdown(false);
      setShowFinancialIssuesDropdown(false);
      setShowCreditRatingDropdown(false);
      setShowInstallationAvailabilityDropdown(false);
      setShowRoofTileDropdown(false);
      setShowSolarBatteryDropdown(false);
      setShowEvChargerDropdown(false);
      setShowOptimisersDropdown(false);
      setShowScaffoldingRequiredDropdown(false);
      setShowScaffoldingThroughHouseDropdown(false);
      
      // Reset modal dropdown states
      setOpenDropdown(null);
      setShowDropdownModal(false);
      
      // Reset date and time picker states
      setShowDatePicker(false);
      setShowTimePicker(false);
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      
      // Reset scaffolding multi-select
      setShowScaffoldingMultiSelect(false);
      
      // Reset web camera and image options
      setShowWebCamera(false);
      setWebCameraFieldName('');
      setShowImageOptions(false);
      setImageOptionsFieldName('');
      setShowQuickFillConfirm(false);
      
      // Reset validation states
      setMissingFields([]);
      setShowValidationPopup(false);
      setHighlightedFields(new Set());
      
      // Clear uploaded files
      uploadedFilesRef.current = {}; // Update ref immediately BEFORE setState
      setUploadedFiles({});
      
      // Reset auto-filled details
      setAutoFilledDetails(null);
      
      // Reset to first page
      setCurrentPage(1);
      
      // Clear survey data
      setSurvey(null);
      
      console.log('✅ Form reset completed successfully');
      
      // Reset server-side data asynchronously
      (async () => {
        try {
          console.log('🔄 Clearing server-side survey data...');
          await surveyApi.resetSurvey(opportunityId);
          console.log('✅ Server-side data cleared');
        } catch (error) {
          console.error('❌ Error clearing server data:', error);
        }
      })();
      
      // Show success message
      const isWeb = typeof window !== 'undefined' && window.document;
      if (isWeb) {
        window.alert('Survey has been reset successfully!');
      } else {
        showAlert('Success', 'Survey has been reset successfully!', 'success');
      }
    }, 100); // Small delay to ensure state updates complete
  };


  const handleFileUpload = async (fieldName: string) => {
    try {
      console.log('📸 handleFileUpload called for field:', fieldName);
      console.log('📸 Platform.OS:', Platform.OS);
      console.log('📸 Current uploadedFiles state:', uploadedFiles);
      
      // For mobile, try camera first, then show options
      if (Platform.OS !== 'web') {
        console.log('📱 Mobile platform detected, trying camera first...');
        await openCamera(fieldName);
        return;
      }
      
      // For web, show custom options modal
      console.log('🌐 Web platform detected, showing options...');
      setImageOptionsFieldName(fieldName);
      setShowImageOptions(true);
    } catch (error) {
      console.error('❌ Error in handleFileUpload:', error);
      showAlert('Error', 'Failed to open image picker. Please try again.', 'error');
    }
  };

  const openCamera = async (fieldName: string) => {
    try {
      console.log('📷 openCamera called for field:', fieldName);
      
      // For web platform, use custom web camera component
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform detected, opening web camera...');
        setWebCameraFieldName(fieldName);
        setShowWebCamera(true);
        return;
      }
      
      // For mobile platforms, use expo-image-picker
      console.log('📱 Mobile platform detected, using expo-image-picker...');
      
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      
      if (status !== 'granted') {
        showAlert('Permission Required', 'Camera permission is required to take photos.', 'warning');
        return;
      }

      console.log('📷 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Ensure base64 is included
      });

      console.log('📷 Camera result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('📷 Processing', result.assets.length, 'images from camera');
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: `camera_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          size: asset.fileSize || 0,
          mimeType: 'image/jpeg',
          base64: asset.base64,
          base64Data: asset.base64, // Add base64Data for consistency
          isNew: true, // Mark as new file
          timestamp: Date.now(), // Add timestamp for uniqueness
        }));

        addFilesToField(fieldName, newFiles);
      } else {
        console.log('📷 Camera was canceled or no assets');
      }
    } catch (error) {
      console.error('❌ Error opening camera:', error);
      showAlert('Error', 'Failed to open camera. Please try again.', 'error');
    }
  };

  const handleQuickAutoFillPhotos = async () => {
    try {
      console.log('🚀 Starting quick auto-fill photos for all fields...');
      console.log('🔧 Button pressed - handleQuickAutoFillPhotos called');
      
      // Show confirmation modal for all platforms
      console.log('🔧 About to show confirmation modal...');
      setShowQuickFillConfirm(true);
    } catch (error) {
      console.error('❌ Error in handleQuickAutoFillPhotos:', error);
      showAlert('Error', 'Failed to start quick auto-fill. Please try again.', 'error');
    }
  };

  const executeQuickFill = async () => {
    try {
      // For web platform, use web camera
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform detected for quick fill, opening web camera...');
        setWebCameraFieldName('quickFill'); // Special field name for quick fill
        setShowWebCamera(true);
        return;
      }

      // Request camera permissions for mobile
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status for quick fill:', status);
      
      if (status !== 'granted') {
        showAlert('Permission Required', 'Camera permission is required to take photos for quick fill.', 'warning');
        return;
      }

      // Take one photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('📷 Photo captured for auto-fill:', asset.uri);

        // Define all the actual image fields from the survey
        const imageFields = [
          'energyBill',
          'epcCertificate',
          'frontDoor',
          'frontProperty',
          'targetRoofs',
          'propertySides',
          'roofAngle',
          'otherRoofPictures',
          'roofTileCloseup',
          'internalCeilingPictures',
          'otherBuildings',
          'electricMeter',
          'garage',
          'fuseBoard',
          'batteryInverterLocation',
          'evLocation',
          'evCharger',
          'shadingIssues',
          'scaffolding'
        ];

        // Create file object for the captured photo
        const photoFile = {
          uri: asset.uri,
          name: `auto_fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize || 0,
          mimeType: 'image/jpeg',
          base64: asset.base64,
        };

        // Add the same photo to all image fields (2 copies each to meet minimum requirement)
        imageFields.forEach(fieldName => {
          const newFiles = [photoFile, photoFile]; // 2 copies
          addFilesToField(fieldName, newFiles);
        });

        console.log('✅ Auto-fill completed: Added photo to all image fields');
        
        // Show success message
        const isWeb = typeof window !== 'undefined' && window.document;
        if (isWeb) {
          window.alert('Success! Photo has been added to all image fields in the survey. You can now review and submit.');
        } else {
          showAlert(
            'Success!', 
            'Photo has been added to all image fields in the survey. You can now review and submit.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('📷 Photo capture was canceled');
      }
    } catch (error) {
      console.error('❌ Error in executeQuickFill:', error);
      const isWeb = typeof window !== 'undefined' && window.document;
      if (isWeb) {
        window.alert('Error: Failed to capture photo for auto-fill. Please try again.');
      } else {
        showAlert('Error', 'Failed to capture photo for auto-fill. Please try again.', 'error');
      }
    }
  };

  const handleWebCameraCapture = async (imageData: string) => {
    console.log('📷 Web camera captured image for field:', webCameraFieldName);
    console.log('📷 Image data length:', imageData.length);
    console.log('📷 Image data preview:', imageData.substring(0, 50) + '...');
    
    // Extract base64 data from data URL
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    console.log('📷 Extracted base64 length:', base64Data.length);
    
    // Show compression progress
    showAlert('Processing Image', 'Compressing image for optimal performance...', 'info');
    
    try {
      // Compress image immediately to prevent performance issues
      console.log('🖼️ Compressing image immediately...');
      const compressedResult = await compressImageAuto(base64Data);
      
      console.log('✅ Image compressed successfully:', {
        originalSize: (base64Data.length / 1024 / 1024).toFixed(2) + 'MB',
        compressedSize: (compressedResult.size / 1024 / 1024).toFixed(2) + 'MB',
        compressionRatio: (((base64Data.length - compressedResult.size) / base64Data.length) * 100).toFixed(1) + '%'
      });
      
      // Convert compressed data URL to file object
      const compressedDataUrl = `data:${compressedResult.format};base64,${compressedResult.base64}`;
      
    const newFile = {
        uri: compressedDataUrl, // Use compressed data URL
      name: `web_camera_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
        size: compressedResult.size, // Use actual compressed size
        mimeType: compressedResult.format,
        base64: compressedResult.base64, // Store compressed base64 data
        base64Data: compressedResult.base64, // Store compressed base64 data
      isNew: true, // Mark as new file
      timestamp: Date.now(), // Add timestamp for uniqueness
        isCompressed: true, // Mark as compressed
        originalSize: base64Data.length, // Keep track of original size
      };
      
      console.log('📷 Created compressed file object:', {
        name: newFile.name,
        size: newFile.size,
        base64Length: newFile.base64.length,
        base64DataLength: newFile.base64Data.length,
        compressionRatio: (((newFile.originalSize - newFile.size) / newFile.originalSize) * 100).toFixed(1) + '%'
      });

    // Handle quick fill case - distribute to multiple fields
    if (webCameraFieldName === 'quickFill') {
      console.log('🚀 Quick fill: distributing photo to all image fields and filling all form data...');
      
      // Define all the actual image fields from the survey
      const imageFields = [
        'energyBill',
        'epcCertificate',
        'frontDoor',
        'frontProperty',
        'targetRoofs',
        'propertySides',
        'roofAngle',
        'otherRoofPictures',
        'roofTileCloseup',
        'internalCeilingPictures',
        'otherBuildings',
        'electricMeter',
        'garage',
        'fuseBoard',
        'batteryInverterLocation',
        'evLocation',
        'evCharger',
        'shadingIssues',
        'scaffolding',
        'customerSignature',
        'renewableExecutiveSignature'
      ];

      // Add the photo 2 times to all image fields
      imageFields.forEach(fieldName => {
        console.log(`📷 Adding photo 2 times to field: ${fieldName}`);
        // Create 2 copies of the same file with slightly different names
        // Ensure base64 data is preserved in copies
        const file1 = { 
          ...newFile, 
          name: `${newFile.name}_copy1`,
          base64: newFile.base64, // Explicitly preserve base64
          base64Data: newFile.base64Data, // Explicitly preserve base64Data
          uri: newFile.uri // Explicitly preserve uri
        };
        const file2 = { 
          ...newFile, 
          name: `${newFile.name}_copy2`,
          base64: newFile.base64, // Explicitly preserve base64
          base64Data: newFile.base64Data, // Explicitly preserve base64Data
          uri: newFile.uri // Explicitly preserve uri
        };
        
        console.log(`📷 File1 base64 length: ${file1.base64.length}, File2 base64 length: ${file2.base64.length}`);
        addFilesToField(fieldName, [file1, file2]);
      });

      // Fill all form fields with sample data
      console.log('📝 Quick fill: filling all form fields with sample data...');
      
      // Page 1 - Basic Information (already auto-filled from opportunity)
      const currentDate = new Date().toLocaleDateString('en-GB');
      updateFormData('page1', {
        date: currentDate,
        homeOwnersAvailable: 'YES_SKIP_NEXT',
        appointmentDurationConfirmed: 'Yes',
        appointmentDateTime: `${currentDate} at 10:00 AM`
      });

      // Page 2 - Solar Installation Reasons
      updateFormData('page2', {
        selectedReasons: ['Reducing your energy bills', 'Reducing your carbon footprint'],
        propertyType: 'House',
        bedrooms: '3',
        lengthOfStay: '5-10 years',
        movingPlans: 'No',
        occupants: '2-3 people',
        heatingType: 'Gas central heating'
      });

      // Page 3 - Property Information
      updateFormData('page3', {
        property: 'House',
        propertyType: 'Semi-detached',
        prepaidMeter: 'No',
        phaseMeter: 'Single phase',
        epcRating: 'C',
        previousFunding: 'No',
        financialIssues: 'None',
        creditRating: 'Good'
      });

      // Page 4 - Financial & Installation Information
      updateFormData('page4', {
        energyCompany: 'British Gas',
        monthlyElectricSpend: '£80',
        electricPricePerUnit: '28p',
        installationAvailability: 'Within 3 months',
        roofTileType: 'Concrete tiles',
        solarBatteryStorage: 'Yes',
        evChargerRequired: 'No',
        optimisersRequired: 'Yes',
        scaffoldingRequired: 'Yes'
      });

      // Page 5 - EPC & Solar Funding (images already filled above)
      updateFormData('page5', {
        epcRating: 'C',
        previousFunding: 'No'
      });

      // Page 6 - Property Assessment (images already filled above)
      // No additional form fields for page 6

      // Page 7 - Property Assessment (images already filled above)
      // No additional form fields for page 7

      // Page 8 - Installation Assessment
      updateFormData('page8', {
        evChargerRequired: 'No',
        optimisersQuantity: '20',
        optimisersRequired: 'Yes',
        scaffoldingRequired: ['1 side', '2 sides'],
        scaffoldingThroughHouse: 'No'
      });

      // Show success message
      showAlert(
        'Quick Fill Complete',
        `✅ Photos added to all ${imageFields.length} image fields\n✅ All form fields filled with sample data\n✅ Survey is now complete and ready for submission!`,
        [{ text: 'OK' }]
      );
    } else {
      // Regular single field capture
      addFilesToField(webCameraFieldName, [newFile]);
    }

    setShowWebCamera(false);
    setWebCameraFieldName('');
    } catch (error) {
      console.error('❌ Error compressing image:', error);
      showAlert('Error', 'Failed to process image. Please try again.', 'error');
      setShowWebCamera(false);
      setWebCameraFieldName('');
    }
  };

  const handleWebCameraClose = () => {
    console.log('📷 Web camera closed');
    setShowWebCamera(false);
    setWebCameraFieldName('');
  };

  const handleQuickFillConfirm = async () => {
    try {
      console.log('📷 User confirmed, executing quick fill...');
      setShowQuickFillConfirm(false);
      await executeQuickFill();
    } catch (error) {
      console.error('❌ Error executing quick fill:', error);
      showAlert('Error', 'Failed to execute quick fill. Please try again.', 'error');
    }
  };

  const handleQuickFillCancel = () => {
    console.log('📷 Quick fill canceled by user');
    setShowQuickFillConfirm(false);
  };

  const handleImageOptionSelect = (option: string) => {
    console.log(`📸 Image option selected: ${option} for field: ${imageOptionsFieldName}`);
    setShowImageOptions(false);
    
    switch (option) {
      case 'camera':
        openCamera(imageOptionsFieldName);
        break;
      case 'library':
        openImageLibrary(imageOptionsFieldName);
        break;
      case 'files':
        openFilePicker(imageOptionsFieldName);
        break;
    }
    
    setImageOptionsFieldName('');
  };

  const handleImageOptionsClose = () => {
    console.log('📸 Image options closed');
    setShowImageOptions(false);
    setImageOptionsFieldName('');
  };

  const openImageLibrary = async (fieldName: string) => {
    try {
      console.log('🖼️ openImageLibrary called for field:', fieldName);
      
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('🖼️ Media library permission status:', status);
      
      if (status !== 'granted') {
        showAlert('Permission Required', 'Photo library permission is required to select images.', 'warning');
        return;
      }

      console.log('🖼️ Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        base64: true, // Ensure base64 is included
      });

      console.log('🖼️ Image library result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('🖼️ Processing', result.assets.length, 'images from library');
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          size: asset.fileSize || 0,
          mimeType: asset.type || 'image/jpeg',
          base64: asset.base64,
          base64Data: asset.base64, // Add base64Data for consistency
          isNew: true, // Mark as new file
          timestamp: Date.now(), // Add timestamp for uniqueness
        }));

        addFilesToField(fieldName, newFiles);
      } else {
        console.log('🖼️ Image library was canceled or no assets');
      }
    } catch (error) {
      console.error('❌ Error opening image library:', error);
      showAlert('Error', 'Failed to open photo library. Please try again.', 'error');
    }
  };

  const openFilePicker = async (fieldName: string) => {
    try {
      console.log('📁 openFilePicker called for field:', fieldName);
      
      // For web, create a file input
      if (Platform.OS === 'web') {
        console.log('🌐 Web file picker - creating input element');
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,.pdf';
        
        input.onchange = async (event) => {
          const files = (event.target as HTMLInputElement).files;
          console.log('📁 Files selected:', files?.length || 0);
          
          if (files) {
            const newFiles = await Promise.all(Array.from(files).map(async (file) => {
              console.log('📁 Processing file:', file.name);
              
              // Convert file to base64 for backend processing
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  resolve(result);
                };
                reader.readAsDataURL(file);
              });

              return {
                uri: URL.createObjectURL(file), // Keep for display
                name: file.name,
                size: file.size,
                mimeType: file.type,
                base64: base64, // Add base64 data for backend
                base64Data: base64.split(',')[1], // Add base64Data for consistency (remove data URL prefix)
                isNew: true, // Mark as new file
                timestamp: Date.now(), // Add timestamp for uniqueness
              };
            }));

            console.log('📁 Processed', newFiles.length, 'files for web');
            addFilesToField(fieldName, newFiles);
          }
        };
        
        input.click();
        return;
      }

      // For mobile, use document picker
      console.log('📱 Mobile document picker - launching...');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      console.log('📱 Document picker result:', result);

      if (!result.canceled && result.assets) {
        console.log('📱 Processing', result.assets.length, 'files from document picker');
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
          isNew: true, // Mark as new file
          timestamp: Date.now(), // Add timestamp for uniqueness
        }));

        addFilesToField(fieldName, newFiles);
      } else {
        console.log('📱 Document picker was canceled or no assets');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      showAlert('Error', 'Failed to upload file. Please try again.', 'error');
    }
  };

  const addFilesToField = useCallback(async (fieldName: string, newFiles: any[]) => {
    try {
      console.log(`📷 Adding ${newFiles.length} files to field: ${fieldName}`);
      
      // Validate files before processing
      const validFiles = newFiles.filter(file => {
        if (!file) {
          console.warn('📷 Skipping null/undefined file');
          return false;
        }
        if (!file.uri && !file.base64 && !file.base64Data) {
          console.warn('📷 Skipping file without valid data:', file.name);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
        console.warn('📷 No valid files to add');
        return;
      }
      
      // Get the current state synchronously to avoid race conditions using ref
      const currentFiles = uploadedFilesRef.current[fieldName] || [];
    
      // Filter out any old files that might be causing issues
      // Keep only files that are either from API (have http URLs) or are newly uploaded (have valid data)
      const validCurrentFiles = currentFiles.filter((file: any) => {
        const isFromAPI = file.uri && typeof file.uri === 'string' && file.uri.startsWith('http');
        const hasBase64Data = file.base64Data || file.base64;
        const hasDataUrl = file.uri && typeof file.uri === 'string' && file.uri.startsWith('data:') && file.uri.length > 10;
        const hasValidData = hasBase64Data || hasDataUrl;
        const isNewlyUploaded = file.isNew || file.timestamp || hasValidData;
        const isValid = isFromAPI || isNewlyUploaded;
        
        return isValid;
      });
      
      const totalFiles = validCurrentFiles.length + validFiles.length;
      
      // Check if we're exceeding a reasonable limit (e.g., 10 images per field)
      if (totalFiles > 10) {
        showAlert('Too Many Images', 'You can upload a maximum of 10 images per category.', 'warning');
        return;
      }
      
      // Upload new images to server and get URLs
      console.log(`📤 Uploading ${validFiles.length} images to server...`);
      console.log('📤 Upload request details:', {
        opportunityId: opportunityId || '',
        fieldName,
        validFilesCount: validFiles.length,
        validFilesDetails: validFiles.map((file, index) => ({
          index,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          hasBase64Data: !!file.base64Data,
          hasBase64: !!file.base64,
          base64Length: file.base64Data?.length || file.base64?.length || 0
        }))
      });
      
      const uploadResponse = await surveyApi.uploadImagesAndGetUrls(opportunityId || '', fieldName, validFiles);
      
      console.log('📤 ===== UPLOAD RESPONSE DEBUG =====');
      console.log('📤 Full upload response object:', uploadResponse);
      console.log('📤 Upload response type:', typeof uploadResponse);
      console.log('📤 Upload response keys:', Object.keys(uploadResponse || {}));
      console.log('📤 Upload response success:', uploadResponse?.success);
      console.log('📤 Upload response success type:', typeof uploadResponse?.success);
      console.log('📤 Upload response data:', uploadResponse?.data);
      console.log('📤 Upload response data type:', typeof uploadResponse?.data);
      console.log('📤 Upload response data keys:', uploadResponse?.data ? Object.keys(uploadResponse.data) : 'No data');
      console.log('📤 Upload response data urls:', uploadResponse?.data?.urls);
      console.log('📤 Upload response data urls type:', typeof uploadResponse?.data?.urls);
      console.log('📤 Upload response data urls length:', uploadResponse?.data?.urls?.length);
      console.log('📤 Upload response data.data urls:', (uploadResponse?.data as any)?.data?.urls);
      console.log('📤 Upload response data.data urls type:', typeof (uploadResponse?.data as any)?.data?.urls);
      console.log('📤 Upload response data.data urls length:', (uploadResponse?.data as any)?.data?.urls?.length);
      console.log('📤 Upload response error:', uploadResponse?.error);
      console.log('📤 ===== END UPLOAD RESPONSE DEBUG =====');
      
      // Check if response is successful
      const isSuccess = uploadResponse?.success === true;
      // The URLs are nested: response.data.data.urls (due to backend structure)
      const urls = (uploadResponse?.data as any)?.data?.urls || uploadResponse?.data?.urls;
      const hasUrls = urls && Array.isArray(urls) && urls.length > 0;
      
      console.log('📤 Success check:', { isSuccess, hasUrls, urls });
      
      if (!isSuccess || !hasUrls) {
        console.error('❌ Upload failed - Details:', {
          success: uploadResponse?.success,
          hasData: !!uploadResponse?.data,
          hasUrls: !!urls,
          urlsLength: urls?.length,
          error: uploadResponse?.error,
          fullResponse: uploadResponse
        });
        showAlert('Error', `Failed to upload images to server. ${uploadResponse?.error || 'Unknown error'}`, 'error');
        return;
      }
      
      // Convert URLs to file objects for display
      const uploadedImageFiles = urls.map((url, index) => ({
        uri: url,
        name: validFiles[index]?.name || `image_${Date.now()}_${index}.jpg`,
        mimeType: validFiles[index]?.mimeType || 'image/jpeg',
        size: validFiles[index]?.size || 0,
        isNew: false, // Now it's uploaded to server
        timestamp: Date.now(),
        isFromServer: true // Mark as from server
      }));
      
      console.log(`✅ Successfully uploaded ${uploadedImageFiles.length} images, got URLs:`, urls);
      
      // Combine existing files with new uploaded files
      const updatedFiles = [...validCurrentFiles, ...uploadedImageFiles];
      
      // Update state
      const newState = {
        ...uploadedFilesRef.current,
        [fieldName]: updatedFiles
      };
      uploadedFilesRef.current = newState;
      setUploadedFiles(newState);
      
      // Determine correct page based on field name
      let targetPage: 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'page6' | 'page7' | 'page8' = 'page7';
      
      if (['energyBill'].includes(fieldName)) {
        targetPage = 'page4';
      } else if (['epcCertificate'].includes(fieldName)) {
        targetPage = 'page5';
      } else if (['frontDoor', 'frontProperty', 'targetRoofs', 'propertySides'].includes(fieldName)) {
        targetPage = 'page6';
      } else if (['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 'garage', 'fuseBoard', 'batteryInverterLocation'].includes(fieldName)) {
        targetPage = 'page7';
      } else if (['evLocation', 'evCharger', 'shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'].includes(fieldName)) {
        targetPage = 'page8';
      }
      
      // Store ALL URLs in form data (existing + new)
      const allImageUrls = updatedFiles.map(file => file.uri);
      
      // Update form data with ALL image URLs - debounced to prevent excessive updates
      setTimeout(() => {
        updateFormData(targetPage, { [`${fieldName}Files`]: allImageUrls });
      }, 100);

      // Show success message
      showAlert(
        'Success', 
        `${validFiles.length} image(s) uploaded successfully!\n\nNote: At least 2 images are required for each category.`,
        'success'
      );
    } catch (error) {
      console.error('❌ Error adding files to field:', error);
      showAlert('Error', 'Failed to add files. Please try again.', 'error');
    }
  }, [opportunityId, updateFormData]);

  const removeFile = async (fieldName: string, index: number) => {
    const fileToRemove = uploadedFiles[fieldName]?.[index];
    
    // Calculate the updated files array using ref for current state
    const updatedFiles = [...(uploadedFilesRef.current[fieldName] || [])];
    updatedFiles.splice(index, 1);
    
    const newState = {
      ...uploadedFilesRef.current,
      [fieldName]: updatedFiles
    };
    uploadedFilesRef.current = newState; // Update ref immediately BEFORE setState
    setUploadedFiles(newState);

    // Update form data - determine correct page based on field name
    let targetPage: 'page1' | 'page2' | 'page3' | 'page4' | 'page5' | 'page6' | 'page7' | 'page8' = 'page7'; // Default to page 7 for most image fields
    
    // Map field names to correct pages
    if (['energyBill'].includes(fieldName)) {
      targetPage = 'page4'; // energyBill is on page 4
    } else if (['epcCertificate'].includes(fieldName)) {
      targetPage = 'page5'; // epcCertificate is on page 5
    } else if (['frontDoor', 'frontProperty', 'targetRoofs', 'propertySides'].includes(fieldName)) {
      targetPage = 'page6';
    } else if (['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 'garage', 'fuseBoard', 'batteryInverterLocation'].includes(fieldName)) {
      targetPage = 'page7';
    } else if (['evLocation', 'evCharger', 'shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'].includes(fieldName)) {
      targetPage = 'page8';
    }
    
    // Update form data with remaining URLs
    const remainingUrls = updatedFiles.map(file => file.uri).filter(url => url);
    
    updateFormData(targetPage, { 
      [`${fieldName}Files`]: remainingUrls
    });

    // Note: We don't delete from server immediately as it's complex to track individual files
    // The images will be re-synced when the survey is submitted
    console.log('🗑️ File removed locally:', fileToRemove?.name);
  };

  // Helper function to check if survey exists
  const checkSurveyExists = async () => {
    try {
      const response = await surveyApi.getSurvey(opportunityId);
      return response.success;
    } catch (error) {
      return false;
    }
  };

  // Helper function to ensure survey exists before updating
  const ensureSurveyExistsAndUpdate = async (updateData: any) => {
    try {
      // First check if survey exists
      const surveyExists = await checkSurveyExists();
      
      if (!surveyExists) {
        console.log('🔧 Survey does not exist, creating new survey first...');
        
        // Create the survey
        const createResponse = await surveyApi.createSurvey(opportunityId);
        if (createResponse.success) {
          console.log('✅ Survey created successfully, now updating...');
          
          // Add a small delay to ensure the survey is fully created
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Now try to update
          const response = await surveyApi.updateSurvey(opportunityId, updateData);
          return response;
        } else {
          console.error('❌ Failed to create survey:', createResponse.error);
          return createResponse;
        }
      } else {
        // Survey exists, try to update directly
        console.log('🔧 Survey exists, updating directly...');
        const response = await surveyApi.updateSurvey(opportunityId, updateData);
        
        // If update fails with 404, there might be a backend inconsistency
        if (!response.success && (response.error?.includes('404') || response.error?.includes('Not Found'))) {
          console.log('🔧 Update failed despite survey existing - backend inconsistency detected');
          console.log('🔧 This is likely due to user mismatch. Attempting to work around this...');
          
          // Try a different approach: submit the survey data directly instead of updating
          // This bypasses the user mismatch issue by using the submit endpoint
          try {
            console.log('🔧 Attempting to submit survey data directly...');
            const submitResponse = await surveyApi.submitSurvey(opportunityId, updateData);
            if (submitResponse.success) {
              console.log('✅ Survey data submitted successfully via submit endpoint');
              return submitResponse;
            } else {
              console.log('⚠️ Submit endpoint also failed, trying to create new survey...');
            }
          } catch (submitError) {
            console.log('⚠️ Submit endpoint failed:', submitError);
          }
          
          // If submit also fails, try creating a new survey
          const createResponse = await surveyApi.createSurvey(opportunityId);
          if (createResponse.success) {
            console.log('✅ New survey created successfully, now updating...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const updateResponse = await surveyApi.updateSurvey(opportunityId, updateData);
            return updateResponse;
          } else {
            console.error('❌ Failed to create new survey:', createResponse.error);
            return createResponse;
          }
        }
        
        return response;
      }
    } catch (error) {
      console.error('❌ Error in ensureSurveyExistsAndUpdate:', error);
      return { success: false, error: (error as Error).message || 'Unknown error' };
    }
  };



  const resetSurvey = async () => {
    try {
      console.log('🔄 Reset button clicked!');
      
      const isWeb = typeof window !== 'undefined' && window.document;
      
      if (isWeb) {
        // Web environment - use window.confirm
        const confirmed = window.confirm('Are you sure you want to reset all survey data? This will clear all inputs and images.');
        if (confirmed) {
          await performReset();
        }
      } else {
        // Mobile environment - use Alert
        showAlert(
          'Reset Survey',
          'Are you sure you want to reset all survey data? This will clear all inputs and images.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: performReset,
            },
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error in reset confirmation:', error);
    }
  };

  const performReset = async () => {
    try {
      setResetting(true);
      console.log('🔄 Resetting survey...');
      
      const response = await surveyApi.resetSurvey(opportunityId);
      console.log('🔄 Survey reset response:', response);
      
      
      // Reset all form data to initial state
      setFormData({
        page1: {} as SurveyPage1,
        page2: {} as SurveyPage2,
        page3: {} as SurveyPage3,
        page4: {} as SurveyPage4,
        page5: {} as SurveyPage5,
        page6: {} as SurveyPage6,
        page7: {} as SurveyPage7,
        page8: {} as SurveyPage8,
      });
      
      // Reset all dropdown states
      setShowDropdown(false);
      setShowPropertyDropdown(false);
      setShowPropertyTypeDropdown(false);
      setShowBedroomsDropdown(false);
      setShowLengthOfStayDropdown(false);
      setShowMovingPlansDropdown(false);
      setShowOccupantsDropdown(false);
      setShowHeatingTypeDropdown(false);
      setShowAdditionalFeaturesDropdown(false);
      setShowPrepaidMeterDropdown(false);
      setShowPhaseMeterDropdown(false);
      setShowEpcRatingDropdown(false);
      setShowPreviousFundingDropdown(false);
      setShowFinancialIssuesDropdown(false);
      setShowCreditRatingDropdown(false);
      setShowInstallationAvailabilityDropdown(false);
      setShowRoofTileDropdown(false);
      setShowSolarBatteryDropdown(false);
      setShowEvChargerDropdown(false);
      setShowOptimisersDropdown(false);
      setShowScaffoldingRequiredDropdown(false);
      setShowScaffoldingThroughHouseDropdown(false);
      
      // Reset modal dropdown states
      setOpenDropdown(null);
      setShowDropdownModal(false);
      
      // Reset date and time picker states
      setShowDatePicker(false);
      setShowTimePicker(false);
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      
      // Reset scaffolding multi-select
      setShowScaffoldingMultiSelect(false);
      
      // Reset web camera and image options
      setShowWebCamera(false);
      setWebCameraFieldName('');
      setShowImageOptions(false);
      setImageOptionsFieldName('');
      setShowQuickFillConfirm(false);
      
      // Reset validation states
      setMissingFields([]);
      setShowValidationPopup(false);
      setHighlightedFields(new Set());
      
      // Clear uploaded files
      uploadedFilesRef.current = {}; // Update ref immediately BEFORE setState
      setUploadedFiles({});
      
      // Reset auto-filled details
      setAutoFilledDetails(null);
      
      // Reset to first page
      setCurrentPage(1);
      
      // Clear survey data
      setSurvey(null);
      
      
      // Reset navigation flags
      hasNavigatedRef.current = false;
      setHasManuallyNavigated(false);
      
      const isWeb = typeof window !== 'undefined' && window.document;
      if (isWeb) {
        window.alert('Survey has been reset successfully!');
      } else {
        showAlert('Success', 'Survey has been reset successfully!', 'success');
      }
    } catch (error) {
      console.error('❌ Error resetting survey:', error);
      const isWeb = typeof window !== 'undefined' && window.document;
      if (isWeb) {
        window.alert(`Failed to reset survey: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        showAlert('Error', `Failed to reset survey: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    } finally {
      setResetting(false);
    }
  };

  const submitSurvey = async () => {
    try {
      console.log('🚀 SUBMIT BUTTON CLICKED - Starting survey submission...');
      setSubmitting(true);
      console.log('🔧 Starting survey submission...');
      console.log('🔧 Opportunity ID:', opportunityId);
      
      // Validate minimum image requirements - images are REQUIRED for submission
      // THIS MUST RUN FIRST BEFORE ANY OTHER CODE
      console.log('🔍 ===== IMAGE VALIDATION START =====');
      console.log('🔍 ===== IMAGE VALIDATION START =====');
      console.log('🔍 ===== IMAGE VALIDATION START =====');
      
      // Log form data structure without base64 content
      try {
        safeLogData(formData, '🔧 Form data structure:');
      } catch (e) {
        console.log('🔧 Form data log error (non-critical):', e);
      }
      
      // Log uploaded files structure without base64 content
      try {
        safeLogData(uploadedFiles, '🔧 Uploaded files structure:');
      } catch (e) {
        console.log('🔧 Uploaded files log error (non-critical):', e);
      }
      
      console.log('🔍 Validating image requirements for submission...');
      console.log('🔍 uploadedFiles keys:', Object.keys(uploadedFiles || {}));
      console.log('🔍 uploadedFilesRef keys:', Object.keys(uploadedFilesRef.current || {}));
      
      // Fields with custom min requirements (default is 2, internalCeilingPictures requires 4)
      const requiredImageFieldsConfig: { field: string; minRequired: number }[] = [
        { field: 'energyBill', minRequired: 2 },
        { field: 'frontDoor', minRequired: 2 },
        { field: 'frontProperty', minRequired: 2 },
        { field: 'targetRoofs', minRequired: 2 },
        { field: 'roofAngle', minRequired: 2 },
        { field: 'roofTileCloseup', minRequired: 2 },
        { field: 'internalCeilingPictures', minRequired: 4 },
        { field: 'electricMeter', minRequired: 2 },
        { field: 'fuseBoard', minRequired: 2 },
        { field: 'batteryInverterLocation', minRequired: 2 }
      ];

      const missingImages: { field: string; current: number; required: number }[] = [];
      const page7Fields = ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 'garage', 'fuseBoard', 'batteryInverterLocation'];
      
      for (const { field, minRequired } of requiredImageFieldsConfig) {
        // Special case: Energy bill images are only required if hasEnergyBill is "Yes"
        if (field === 'energyBill') {
          const pageData = formData.page4;
          const hasEnergyBill = pageData?.hasEnergyBill;
          
          // If hasEnergyBill is "No", skip validation for energy bill images
          if (hasEnergyBill === 'No') {
            console.log('🔍 Skipping energy bill validation - hasEnergyBill is "No"');
            continue;
          }
        }
        
        // Check multiple sources for images:
        // 1. uploadedFiles state (current session uploads)
        // 2. uploadedFilesRef.current (current session uploads)
        // 3. Survey data (previously saved images)
        const imagesFromState = uploadedFiles[field] || [];
        const imagesFromRef = uploadedFilesRef.current[field] || [];
        
        // Check survey data for images stored on server (previously saved)
        let imagesFromSurvey: any[] = [];
        if (field === 'energyBill') {
          const page4Data = formData.page4 as any;
          const surveyPage4 = survey?.page4 as any;
          imagesFromSurvey = page4Data?.[`${field}Files`] || surveyPage4?.[`${field}Files`] || [];
        } else if (page7Fields.includes(field)) {
          const page7Data = formData.page7 as any;
          const surveyPage7 = survey?.page7 as any;
          imagesFromSurvey = page7Data?.[`${field}Files`] || surveyPage7?.[`${field}Files`] || [];
        } else {
          const page5Data = formData.page5 as any;
          const surveyPage5 = survey?.page5 as any;
          imagesFromSurvey = page5Data?.[`${field}Files`] || surveyPage5?.[`${field}Files`] || [];
        }
        
        // Count images from current session (state and ref)
        const totalFromState = Array.isArray(imagesFromState) ? imagesFromState.length : 0;
        const totalFromRef = Array.isArray(imagesFromRef) ? imagesFromRef.length : 0;
        const totalFromSurvey = Array.isArray(imagesFromSurvey) ? imagesFromSurvey.length : 0;
        
        // Use the maximum count from all sources (current uploads OR previously saved)
        // This allows validation to pass if images were uploaded in current session OR saved previously
        const totalImages = Math.max(totalFromState, totalFromRef, totalFromSurvey);
        
        console.log(`🔍 Field ${field}: ${totalImages} images total`);
        console.log(`🔍   - From state (current): ${totalFromState}`);
        console.log(`🔍   - From ref (current): ${totalFromRef}`);
        console.log(`🔍   - From survey (saved): ${totalFromSurvey}`);
        console.log(`🔍   - Total: ${totalImages}`);
        
        // Check for missing images - use field-specific min required
        if (totalImages < minRequired) {
          console.log(`❌ Field ${field} is missing images: ${totalImages}/${minRequired}`);
          missingImages.push({
            field,
            current: totalImages,
            required: minRequired
          });
        } else {
          console.log(`✅ Field ${field} has enough images: ${totalImages}/${minRequired}`);
        }
      }

      console.log('🔍 Missing images count:', missingImages.length);
      console.log('🔍 Missing images details:', missingImages);
      console.log('🔍 ===== IMAGE VALIDATION END =====');

      // Handle missing images - block submission if images are missing
      console.log('🔍 Validation check: missingImages.length =', missingImages.length);
      if (missingImages.length > 0) {
        console.log('❌ ❌ ❌ VALIDATION FAILED - BLOCKING SUBMISSION ❌ ❌ ❌');
        console.log('❌ Missing images:', JSON.stringify(missingImages, null, 2));
        setSubmitting(false);
        
        // Create detailed error message with field names
        const missingFieldsText = missingImages.map(item => {
          const fieldDisplayName = item.field
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/Energy Bill/g, 'Energy Bill')
            .replace(/Front Door/g, 'Front Door')
            .replace(/Front Property/g, 'Front of Property')
            .replace(/Target Roofs/g, 'Target Roofs')
            .replace(/Roof Angle/g, 'Roof Angle')
            .replace(/Roof Tile Closeup/g, 'Roof Tile Closeup')
            .replace(/Electric Meter/g, 'Electric Meter')
            .replace(/Fuse Board/g, 'Fuse Board')
            .replace(/Battery Inverter Location/g, 'Battery & Inverter Location')
            .replace(/Internal Ceiling Pictures/g, 'Internal Ceiling Pictures');
          
          return `• ${fieldDisplayName}: ${item.current}/${item.required} images`;
        }).join('\n');
        
        // Show alert with Skip button option
        const isWeb = typeof window !== 'undefined' && window.document;
        
        if (isWeb) {
          // Web: Use custom alert with buttons
          setCustomAlert({
            visible: true,
            title: '📸 Cannot Submit - Images Required',
            message: `You cannot submit the survey without uploading all required images.\n\nMissing images:\n${missingFieldsText}\n\nYou can skip uploading images for now and navigate between pages, but you must upload all required images before submitting the survey. Images are also required before contract generation.\n\nPlease upload images by clicking on the upload buttons and selecting "Camera", "Photo Library", or "Files".`,
            type: 'warning',
            buttons: [
              {
                text: 'Upload Images',
                onPress: () => {
                  hideCustomAlert();
                  // Stay on current page to upload images
                  console.log('📸 User chose to upload images');
                },
                style: 'default'
              },
              {
                text: 'Skip for Now',
                onPress: () => {
                  hideCustomAlert();
                  // Navigate to next workflow step (OpenSolar)
                  console.log('⏭️ Skipping image upload, navigating to next step...');
                  (navigation as any).navigate('OpenSolarWebView', { opportunityId });
                },
                style: 'cancel'
              }
            ]
          });
        } else {
          // Mobile: Use Alert with buttons
          Alert.alert(
            '📸 Cannot Submit - Images Required',
            `You cannot submit the survey without uploading all required images.\n\nMissing images:\n${missingFieldsText}\n\nYou can skip uploading images for now and navigate between pages, but you must upload all required images before submitting the survey. Images are also required before contract generation.\n\nPlease upload images by clicking on the upload buttons and selecting "Camera", "Photo Library", or "Files".`,
            [
              {
                text: 'Upload Images',
                onPress: () => {
                  console.log('📸 User chose to upload images');
                },
                style: 'default'
              },
              {
                text: 'Skip for Now',
                onPress: () => {
                  console.log('⏭️ Skipping image upload, navigating to next step...');
                  (navigation as any).navigate('OpenSolarWebView', { opportunityId });
                },
                style: 'cancel'
              }
            ]
          );
        }
        
        // CRITICAL: Block submission - return early
        console.log('🛑 🛑 🛑 SUBMISSION BLOCKED - RETURNING EARLY 🛑 🛑 🛑');
        return; // This return MUST block submission
      }
      
      console.log('✅ ✅ ✅ IMAGE VALIDATION PASSED ✅ ✅ ✅');
      
      // Enhanced validation using the new validation system (for non-image fields)
      console.log('🔍 Validating all survey fields (excluding images)...');
      const validationResult = validateAllPages(formData, uploadedFiles, surveyValidationOptions);
      
      // Filter out image field errors - we already validated images above
      const nonImageErrors = validationResult.missingFields.filter(field => field.fieldType !== 'image');
      const nonImageFieldsToHighlight = new Set<string>();
      nonImageErrors.forEach(field => nonImageFieldsToHighlight.add(field.fieldName));
      
      if (nonImageErrors.length > 0) {
        console.log('❌ Form validation failed (non-image fields)');
        setSubmitting(false);
        
        // Show enhanced validation popup with page navigation (only for non-image fields)
        setMissingFields(nonImageErrors.map(field => field.displayName));
        setHighlightedFields(nonImageFieldsToHighlight);
        setShowValidationPopup(true);
        return;
      }
      
      console.log('✅ Form validation passed');
      
      // Check backend health first
      console.log('🔍 Checking backend health...');
      const { healthCheck } = await import('../utils/api');
      const isHealthy = await healthCheck();
      console.log('🔍 Backend health check result:', isHealthy);
      if (!isHealthy) {
        console.log('❌ Backend health check failed');
        setSubmitting(false);
        showAlert(
          '🌐 Connection Error',
          'Unable to connect to the server. Please check your internet connection and try again.\n\nIf the problem persists, please contact support.'
        );
        return;
      }
      console.log('✅ Backend health check passed');
      
      // Prepare all form data for submission
      const surveyData = {
        page1: formData.page1,
        page2: formData.page2,
        page3: formData.page3,
        page4: formData.page4,
        page5: formData.page5,
        page6: formData.page6,
        page7: formData.page7,
        page8: formData.page8,
        status: 'COMPLETED' // Explicitly set status to COMPLETED instead of DRAFT
      };
      
      console.log('🔧 Survey data prepared:', surveyData);
      console.log('🔧 Survey status set to:', surveyData.status);
      console.log('🔧 Page 8 data specifically:', surveyData.page8);
      
      // Process uploaded files to ensure all have base64 data
      console.log('🔧 Processing uploaded files for submission...');
      console.log('🔧 Uploaded files structure:', typeof uploadedFiles, Object.keys(uploadedFiles));
      
      // Convert uploadedFiles object to array of all files
      const allFiles: any[] = [];
      Object.keys(uploadedFiles).forEach((fieldName: string) => {
        const fieldFiles = uploadedFiles[fieldName];
        if (Array.isArray(fieldFiles)) {
          fieldFiles.forEach((file: any) => {
            allFiles.push({
              ...file,
              fieldName: fieldName
            });
          });
        }
      });
      
      console.log('🔧 All files extracted:', allFiles.length, 'files');
      
      const filesWithBase64: any[] = allFiles.map((file: any) => {
        // If file already has base64 property, use it
        if (file.base64) {
          console.log('🔧 File already has base64:', file.fieldName, file.fileName);
          return file;
        }
        
        // If file has a data URI, extract base64 from it
        if (file.uri && typeof file.uri === 'string' && file.uri.startsWith('data:')) {
          const base64Data = file.uri.split(',')[1];
          console.log('🔧 Extracting base64 from data URI:', file.fieldName, file.fileName);
          return {
            ...file,
            base64: base64Data
          };
        }
        
        // For HTTP URLs (saved files), keep as is - backend should handle them
        if (file.uri && typeof file.uri === 'string' && file.uri.startsWith('http')) {
          console.log('🔧 Keeping HTTP URL file as is:', file.fieldName, file.fileName);
          return file;
        }
        
        // Fallback: return file as is
        console.log('🔧 Keeping file as is (fallback):', file.fieldName, file.fileName);
        return file;
      });
      
      console.log('🔧 Processed files for submission:', filesWithBase64.length, 'files');
      
      // Images are already compressed during capture, no need to compress again
      console.log('📷 Using pre-compressed images for submission...');
      
      // Convert files back to object structure for API
      const uploadedFilesObject: any = {};
      filesWithBase64.forEach((file: any) => {
        if (!uploadedFilesObject[file.fieldName]) {
          uploadedFilesObject[file.fieldName] = [];
        }
        uploadedFilesObject[file.fieldName].push(file);
      });

      // Filter images to prevent payload too large errors
      console.log('🔍 Filtering images to prevent payload too large errors...');
      const filteredFiles = filterImagesForSubmission(uploadedFilesObject, {
        maxImagesPerField: 2, // Limit to 2 images per field
        maxTotalImages: 8, // Limit to 8 total images
        maxTotalSizeBytes: 80 * 1024 * 1024 // 80MB total limit (well under 200MB backend limit)
      });

      const originalImageCount = filesWithBase64.length;
      const filteredImageCount = Object.values(filteredFiles).flat().length;
      
      console.log('📊 Image filtering complete:', {
        originalFields: Object.keys(uploadedFilesObject).length,
        filteredFields: Object.keys(filteredFiles).length,
        originalImages: originalImageCount,
        filteredImages: filteredImageCount
      });

      // Notify user if images were filtered
      if (originalImageCount > filteredImageCount) {
        console.log(`⚠️ ${originalImageCount - filteredImageCount} images were filtered out to prevent payload too large errors`);
      }
      
      console.log('🔧 Calling surveyApi.submitSurvey...');
      console.log('🔧 Survey data being sent:', surveyData);
      console.log('🔧 Uploaded files being sent (filtered):', filteredFiles);
      
      const response = await surveyApi.submitSurvey(opportunityId, surveyData, filteredFiles);
      
      console.log('🔧 Survey submission response:', response);
      console.log('🔧 Response success:', response.success);
      console.log('🔧 Response data:', response.data);
      console.log('🔧 Response error:', response.error);
      
      if (response.success && response.data) {
        console.log('🔧 Survey submission successful!');
        console.log('🔧 Survey status after submission:', response.data.status);
        setSurvey(response.data);
        
        // If we're in progress mode, call the onComplete callback
        if (props?.onComplete) {
          console.log('🔧 Calling onComplete callback...');
          console.log('🔧 onComplete callback exists:', !!props.onComplete);
          console.log('🔧 response.data:', response.data);
          props.onComplete(response.data);
          // Close the modal after successful submission
          if (props?.onClose) {
            console.log('🔧 Closing survey modal...');
            props.onClose();
          }
          return;
        } else {
          console.log('🔧 No onComplete callback found - not in progress mode');
        }

        // Update progress step status to completed
        try {
          console.log('🔧 Updating progress step status...');
          const { workflowApi } = await import('../utils/api');
          await workflowApi.completeStep(opportunityId, 1, response.data);
          console.log('🔧 Progress step 1 marked as completed');
        } catch (error) {
          console.error('🔧 Error updating progress step:', error);
        }
        
        console.log('🔍 Survey submitted successfully, showing success message...');
        setSubmitting(false);
        
        // Show success message with Next button
        const isWeb = typeof window !== 'undefined' && window.document;
        
        if (isWeb) {
          // Web: Use custom alert with Next button
          setCustomAlert({
            visible: true,
            title: '✅ Success',
            message: 'Criteria and survey assessed and Eligibility passed for stage 1 & 2',
            type: 'success',
            buttons: [
              {
                text: 'Next',
                onPress: () => {
                  hideCustomAlert();
                  console.log('🔍 Navigating to next step...');
                  (navigation as any).navigate('OpenSolarWebView', { opportunityId });
                },
                style: 'default'
              }
            ]
          });
        } else {
          // Mobile: Use Alert with Next button
          Alert.alert(
            '✅ Success',
            'Criteria and survey assessed and Eligibility passed for stage 1 & 2',
            [
              {
                text: 'Next',
                onPress: () => {
                  console.log('🔍 Navigating to next step...');
                  (navigation as any).navigate('OpenSolarWebView', { opportunityId });
                },
                style: 'default'
              }
            ]
          );
        }
        
        console.log('🔍 Success message displayed');
      } else {
        console.log('🔧 Survey submission failed - no success or data');
        console.log('🔧 Response:', response);
        setSubmitting(false);
        
        // Parse backend error message for better user experience
        let errorMessage = 'Unknown error occurred';
        if (response.error) {
          if (response.error.includes('All survey pages must be completed')) {
            errorMessage = 'Please complete all required survey pages before submitting.';
          } else if (response.error.includes('User not found')) {
            errorMessage = 'Authentication error. Please log out and log back in.';
          } else if (response.error.includes('Survey not found')) {
            errorMessage = 'Survey not found. Please refresh the page and try again.';
          } else if (response.error.includes('Invalid survey data format')) {
            errorMessage = 'There was an issue with the survey data. Please try again.';
          } else {
            errorMessage = response.error;
          }
        }
        
        showAlert(
          '❌ Submission Failed',
          `Failed to submit survey:\n\n${errorMessage}\n\nPlease try again or contact support if the problem persists.`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      console.error('❌ ERROR submitting survey:', errorMessage);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error stack:', errorStack);
      setSubmitting(false);
      
      // Parse different types of errors for better user experience
      let errorTitle = '❌ Submission Error';
      let userErrorMessage = 'An unexpected error occurred while submitting the survey.';
      
      if (error instanceof Error) {
        if (error.message.includes('Network Error') || error.message.includes('fetch')) {
          errorTitle = '🌐 Network Error';
          userErrorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout')) {
          errorTitle = '⏱️ Timeout Error';
          userErrorMessage = 'The request timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorTitle = '🔐 Authentication Error';
          userErrorMessage = 'Your session has expired. Please log out and log back in.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          errorTitle = '🔧 Server Error';
          userErrorMessage = 'There was a server error. Please try again in a few minutes or contact support.';
        } else {
          userErrorMessage = error.message;
        }
      }
      
      showAlert(
        errorTitle,
        `${userErrorMessage}\n\nIf the problem persists, please contact support.`
      );
    } finally {
      console.log('🔧 Setting submitting to false');
      setSubmitting(false);
    }
  };

  const renderPage1 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Suitability Assessment</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Complete the form to assess solar installation suitability</Text>
        
        {/* Quick Auto-fill Photo Button */}
        <TouchableOpacity
          style={[styles.quickAutoFillButton, { backgroundColor: theme.primaryButton || '#007AFF' }]}
          onPress={() => {
            console.log('🔧 Quick Fill button pressed!');
            console.log('🔧 Current page:', currentPage);
            console.log('🔧 Platform:', Platform.OS);
            console.log('🔧 Theme primary button color:', theme.primaryButton);
            
            // Test if the function exists
            if (typeof handleQuickAutoFillPhotos === 'function') {
              console.log('🔧 handleQuickAutoFillPhotos function exists, calling it...');
              handleQuickAutoFillPhotos();
            } else {
              console.error('❌ handleQuickAutoFillPhotos function does not exist!');
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={20} color="#ffffff" />
          <Text style={[styles.quickAutoFillButtonText, { color: '#ffffff' }]}>
            Quick Fill All Photos (2x each)
          </Text>
        </TouchableOpacity>

        {/* Refresh User Data Button */}
        <TouchableOpacity
          style={[styles.quickAutoFillButton, { backgroundColor: theme.secondaryButton, marginTop: 10 }]}
          onPress={manualAutoFill}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={20} color="#ffffff" />
          <Text style={[styles.quickAutoFillButtonText, { color: '#ffffff' }]}>
            Refresh User Data
          </Text>
        </TouchableOpacity>
      </View>
      
        {/* Enhanced Page Navigation */}
      <View style={styles.pageStatusContainer}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <TouchableOpacity 
              key={pageNum} 
              style={styles.pageStatusItem}
              onPress={() => navigateToPage(pageNum)}
              activeOpacity={0.7}
            >
            <View 
              style={[
                styles.pageStatusDot,
                { 
                  backgroundColor: isPageComplete(pageNum) 
                    ? '#10B981' // Green for complete
                    : pageNum === currentPage 
                      ? theme.primaryButton || '#007AFF' // Blue for current
                      : '#E5E7EB' // Gray for incomplete
                }
              ]} 
            />
            <Text style={[
              styles.pageStatusText,
              { 
                color: pageNum === currentPage 
                  ? theme.primaryText 
                  : theme.secondaryText,
                fontWeight: pageNum === currentPage ? '600' : '400'
              }
            ]}>
              {pageNum}
            </Text>
            </TouchableOpacity>
        ))}
      </View>
      
      {/* Auto-fill Notification */}
      {autoFilledDetails && (
        <View style={[styles.autoFillCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.autoFillHeader}>
            <Ionicons name="checkmark-circle" size={24} color={theme.successButton} />
            <Text style={[styles.autoFillTitle, { color: theme.primaryText }]}>Auto-filled Details</Text>
          </View>
          <Text style={[styles.autoFillDescription, { color: theme.secondaryText }]}>
            Customer details have been automatically filled from the opportunity data. Please review and confirm.
          </Text>
        </View>
      )}
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📅 Assessment Date</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="calendar-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
          <TextInput
            style={[styles.inputWithIconText, { color: theme.primaryText }]}
            value={formData.page1.date || selectedDate.toLocaleDateString('en-GB')}
            onChangeText={(text) => updateFormData('page1', { date: text })}
            placeholder="DD-MM-YYYY"
            placeholderTextColor={theme.tertiaryText}
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Renewable Executive *</Text>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.primaryText }]}>First Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.renewableExecutiveFirstName || ''}
              onChangeText={(text) => updateFormData('page1', { renewableExecutiveFirstName: text })}
              placeholder="First Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Last Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.renewableExecutiveLastName || ''}
              onChangeText={(text) => updateFormData('page1', { renewableExecutiveLastName: text })}
              placeholder="Last Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Customer Name *</Text>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>First Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.customerFirstName || ''}
              onChangeText={(text) => updateFormData('page1', { customerFirstName: text })}
              placeholder="First Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Last Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.customerLastName || ''}
              onChangeText={(text) => updateFormData('page1', { customerLastName: text })}
              placeholder="Last Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
        </View>
      </View>

      {!isAdminUser && (
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Customer Name *</Text>
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>First Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.customer2FirstName || ''}
              onChangeText={(text) => updateFormData('page1', { customer2FirstName: text })}
              placeholder="First Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>Last Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.customer2LastName || ''}
              onChangeText={(text) => updateFormData('page1', { customer2LastName: text })}
              placeholder="Last Name"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
        </View>
      </View>
      )}

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Address *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
          value={formData.page1.addressLine1 || ''}
          onChangeText={(text) => updateFormData('page1', { addressLine1: text })}
          placeholder="Address Line 1"
          placeholderTextColor={theme.tertiaryText}
          autoCorrect={false}
          autoCapitalize="words"
          blurOnSubmit={false}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
          value={formData.page1.addressLine2 || ''}
          onChangeText={(text) => updateFormData('page1', { addressLine2: text })}
          placeholder="Address Line 2"
          placeholderTextColor={theme.tertiaryText}
          autoCorrect={false}
          autoCapitalize="words"
          blurOnSubmit={false}
          returnKeyType="next"
        />
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.town || ''}
              onChangeText={(text) => updateFormData('page1', { town: text })}
              placeholder="Town"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
          <View style={styles.halfInput}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
              value={formData.page1.county || ''}
              onChangeText={(text) => updateFormData('page1', { county: text })}
              placeholder="County"
              placeholderTextColor={theme.tertiaryText}
              autoCorrect={false}
              autoCapitalize="words"
              blurOnSubmit={false}
              returnKeyType="next"
            />
          </View>
        </View>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }]}
          value={formData.page1.postcode || ''}
          onChangeText={(text) => updateFormData('page1', { postcode: text })}
          placeholder="Postcode"
          placeholderTextColor={theme.tertiaryText}
          autoCorrect={false}
          autoCapitalize="characters"
          blurOnSubmit={false}
          returnKeyType="next"
        />
      </View>

      {!isAdminUser && (
      <View>
      <ModernCard style={{ marginBottom: 20 }}>
        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            🏠 Home Owners Available <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('🏠 Home Owners Available');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page1.homeOwnersAvailable === HomeOwnerAvailability.YES_SKIP_NEXT 
                ? 'Yes, please skip to the next question'
                : formData.page1.homeOwnersAvailable === HomeOwnerAvailability.NO_REBOOK_APPOINTMENT
                ? 'No, rebook appointment'
                : 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Appointment will take up to 1hr 30mins <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Appointment will take up to 1hr 30mins');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page1.appointmentDurationConfirmed || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>
      </ModernCard>

      {/* Show rebooking if homeowners are unavailable or duration is not accepted */}
      {(formData.page1.homeOwnersAvailable === HomeOwnerAvailability.NO_REBOOK_APPOINTMENT ||
        formData.page1.appointmentDurationConfirmed === 'No') && (
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>⏰ New Appointment Date & Time</Text>
          
          {/* Rebooking Button */}
          <TouchableOpacity
            style={[styles.inputWithIcon, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={openRebookingModal}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
            <Text style={[styles.inputWithIconText, { color: theme.primaryText }]}>
              {formData.page1.appointmentDateTime || 'Select Available Time Slot'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>

          {/* Display Selected Date & Time */}
          {formData.page1.appointmentDateTime && (
            <View style={[styles.inputWithIcon, { backgroundColor: theme.tertiaryBackground, borderColor: theme.secondaryText, marginTop: 10 }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.successButton} style={styles.inputIcon} />
              <Text style={[styles.inputWithIconText, { color: theme.primaryText }]}>
                {formData.page1.appointmentDateTime}
              </Text>
            </View>
          )}

          {/* Date Picker Modal */}
          {showDatePicker && (
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Date</Text>
                  
                  {/* Web-compatible date input */}
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setSelectedDate(newDate);
                        const dateString = newDate.toLocaleDateString('en-GB');
                        const timeString = selectedTime.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        });
                        updateFormData('page1', { 
                          appointmentDateTime: `${dateString} at ${timeString}` 
                        });
                        setShowDatePicker(false);
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        padding: '10px',
                        fontSize: '16px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        margin: '10px 0',
                        width: '100%'
                      }}
                    />
                  ) : (
                    <View style={styles.dateTimeContainer}>
                      <Text style={[styles.dateTimeText, { color: theme.primaryText }]}>
                        {selectedDate.toLocaleDateString('en-GB')}
                      </Text>
                      <View style={styles.dateTimeButtons}>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { backgroundColor: theme.primaryButton }]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(newDate.getDate() + 1);
                            setSelectedDate(newDate);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+1 Day</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { backgroundColor: theme.primaryButton }]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(newDate.getDate() + 7);
                            setSelectedDate(newDate);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+1 Week</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.secondaryButton }]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => {
                        const dateString = selectedDate.toLocaleDateString('en-GB');
                        const timeString = selectedTime.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        });
                        updateFormData('page1', { 
                          appointmentDateTime: `${dateString} at ${timeString}` 
                        });
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Time Picker Modal */}
          {showTimePicker && (
            <Modal
              visible={showTimePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowTimePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Time</Text>
                  
                  {/* Web-compatible time input */}
                  {Platform.OS === 'web' ? (
                    <input
                      type="time"
                      value={selectedTime.toTimeString().slice(0, 5)}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newTime = new Date();
                        newTime.setHours(parseInt(hours), parseInt(minutes));
                        setSelectedTime(newTime);
                        const dateString = selectedDate.toLocaleDateString('en-GB');
                        const timeString = newTime.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        });
                        updateFormData('page1', { 
                          appointmentDateTime: `${dateString} at ${timeString}` 
                        });
                        setShowTimePicker(false);
                      }}
                      style={{
                        padding: '10px',
                        fontSize: '16px',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        margin: '10px 0',
                        width: '100%'
                      }}
                    />
                  ) : (
                    <View style={styles.dateTimeContainer}>
                      <Text style={[styles.dateTimeText, { color: theme.primaryText }]}>
                        {selectedTime.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        })}
                      </Text>
                      <View style={styles.dateTimeButtons}>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { backgroundColor: theme.primaryButton }]}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setHours(newTime.getHours() + 1);
                            setSelectedTime(newTime);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+1 Hour</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { backgroundColor: theme.primaryButton }]}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setMinutes(newTime.getMinutes() + 30);
                            setSelectedTime(newTime);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+30 Min</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.secondaryButton }]}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => {
                        const dateString = selectedDate.toLocaleDateString('en-GB');
                        const timeString = selectedTime.toLocaleTimeString('en-GB', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        });
                        updateFormData('page1', { 
                          appointmentDateTime: `${dateString} at ${timeString}` 
                        });
                        setShowTimePicker(false);
                      }}
                    >
                      <Text style={styles.modalButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Rebooking Modal */}
          {showRebookingModal && (
            <Modal
              visible={showRebookingModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowRebookingModal(false)}
            >
              <View style={styles.modalOverlay}>
                {(() => {
                  const responsiveStyles = getResponsiveStyles();
                  return (
                    <View style={[styles.modalContent, { 
                      backgroundColor: theme.cardBackground,
                      paddingHorizontal: responsiveStyles.modalPadding,
                    }]}>
                      {/* Modal Header */}
                      <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Available Time Slot</Text>
                        <TouchableOpacity
                          style={[styles.modalCloseButton, { backgroundColor: theme.inputBackground }]}
                          onPress={() => setShowRebookingModal(false)}
                        >
                          <Ionicons name="close" size={24} color={theme.primaryText} />
                        </TouchableOpacity>
                      </View>

                      <ScrollView 
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                      >
                  
                  {/* Current User Info */}
                  <View style={[styles.section, { marginBottom: responsiveStyles.sectionSpacing }]}>
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Current User</Text>
                    <View style={{ 
                      padding: 16, 
                      borderRadius: 8, 
                      borderWidth: 1, 
                      alignItems: 'center',
                      backgroundColor: theme.inputBackground, 
                      borderColor: theme.cardBorder 
                    }}>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600', 
                        marginBottom: 4, 
                        color: theme.primaryText 
                      }}>
                        {currentUser || 'Loading user info...'}
                      </Text>
                      <Text style={{ 
                        fontSize: 12, 
                        color: theme.secondaryText 
                      }}>
                        Using your Outlook calendar
                      </Text>
                    </View>
                  </View>

                  {/* Date Selection */}
                  <View style={[styles.section, { marginBottom: responsiveStyles.sectionSpacing }]}>
                    <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Select Date</Text>
                    <View style={styles.dateTimeContainer}>
                      <Text style={[styles.dateTimeText, { color: theme.primaryText }]}>
                        {selectedDate.toLocaleDateString('en-GB')}
                      </Text>
                      <View style={[styles.dateTimeButtons, { flexWrap: 'wrap', justifyContent: 'center', gap: 8 }]}>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { 
                            backgroundColor: theme.primaryButton,
                            minWidth: 80,
                            flex: 1,
                            maxWidth: 100
                          }]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(newDate.getDate() - 1);
                            if (newDate >= new Date()) {
                              handleRebookingDateChange(newDate);
                            }
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>-1 Day</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { 
                            backgroundColor: theme.primaryButton,
                            minWidth: 80,
                            flex: 1,
                            maxWidth: 100
                          }]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(newDate.getDate() + 1);
                            handleRebookingDateChange(newDate);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+1 Day</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.dateTimeButton, { 
                            backgroundColor: theme.primaryButton,
                            minWidth: 80,
                            flex: 1,
                            maxWidth: 100
                          }]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setDate(newDate.getDate() + 7);
                            handleRebookingDateChange(newDate);
                          }}
                        >
                          <Text style={styles.dateTimeButtonText}>+1 Week</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Time Slots */}
                  <View style={[styles.section, { marginBottom: responsiveStyles.sectionSpacing }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Available Time Slots</Text>
                      <TouchableOpacity
                        style={[styles.testButton, { backgroundColor: theme.secondaryButton }]}
                        onPress={() => {
                          console.log('🔍 Test button pressed - testing calendar integration');
                          console.log('🔍 Current user:', currentUser);
                          console.log('🔍 Selected date:', selectedDate);
                          console.log('🔍 Calendar events:', calendarEvents);
                          fetchCalendarEvents(selectedDate);
                        }}
                      >
                        <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>Test</Text>
                      </TouchableOpacity>
                    </View>
                    {loadingCalendar ? (
                      <View style={styles.rebookingLoadingContainer}>
                        <ActivityIndicator size="small" color={theme.primaryButton} />
                        <Text style={[styles.rebookingLoadingText, { color: theme.secondaryText }]}>Loading available slots...</Text>
                      </View>
                    ) : (
                      <View style={styles.timeSlotsGrid}>
                        {generateTimeSlots(selectedDate).map((slot, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.timeSlot,
                              { 
                                backgroundColor: slot.available ? theme.inputBackground : theme.tertiaryBackground,
                                borderColor: slot.available ? theme.cardBorder : theme.inactiveStatus,
                                opacity: slot.available ? 1 : 0.5,
                                flex: responsiveStyles.timeSlotWidth,
                                minWidth: responsiveStyles.timeSlotMinWidth,
                                maxWidth: responsiveStyles.timeSlotMaxWidth,
                              },
                              selectedTimeSlot === slot.time && { 
                                backgroundColor: theme.primaryButton,
                                borderColor: theme.primaryButton
                              },
                              !slot.available && slot.reason === 'All-day event' && {
                                backgroundColor: theme.tertiaryBackground,
                                borderColor: theme.dangerButton,
                                borderWidth: 2
                              }
                            ]}
                            onPress={() => slot.available && handleTimeSlotSelect(slot.time)}
                            disabled={!slot.available}
                          >
                            <Text style={[
                              styles.timeSlotText,
                              { 
                                color: slot.available 
                                  ? (selectedTimeSlot === slot.time ? '#FFFFFF' : theme.primaryText)
                                  : slot.reason === 'All-day event' 
                                    ? theme.dangerButton 
                                    : theme.inactiveStatus,
                                fontSize: responsiveStyles.fontSize
                              }
                            ]}>
                              {slot.time}
                            </Text>
                            {!slot.available && (
                              <Ionicons 
                                name={slot.reason === 'All-day event' ? "ban" : "close-circle"} 
                                size={14} 
                                color={slot.reason === 'All-day event' ? theme.dangerButton : theme.inactiveStatus} 
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    
                    {/* Debug Info */}
                    <View style={{ 
                      marginTop: 15, 
                      padding: 12, 
                      borderRadius: 8, 
                      borderWidth: 1, 
                      backgroundColor: theme.inputBackground, 
                      borderColor: theme.cardBorder 
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: theme.primaryText }}>Debug Info:</Text>
                      <Text style={{ fontSize: 12, marginBottom: 4, color: theme.secondaryText }}>Current User: {currentUser || 'Not loaded'}</Text>
                      <Text style={{ fontSize: 12, marginBottom: 4, color: theme.secondaryText }}>Selected Date: {selectedDate.toLocaleDateString()}</Text>
                      <Text style={{ fontSize: 12, marginBottom: 4, color: theme.secondaryText }}>Events Found: {calendarEvents.length}</Text>
                      <Text style={{ fontSize: 12, marginBottom: 4, color: theme.secondaryText }}>Loading: {loadingCalendar ? 'Yes' : 'No'}</Text>
                      
                      {/* Show all-day events specifically */}
                      {calendarEvents.filter(e => e.isAllDay === true || e.isAllDay === 'true').length > 0 && (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: theme.tertiaryBackground, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: theme.inactiveStatus }}>All-Day Events:</Text>
                          {calendarEvents.filter(e => e.isAllDay === true || e.isAllDay === 'true').map((e, index) => (
                            <Text key={index} style={{ fontSize: 11, marginBottom: 2, color: theme.secondaryText }}>
                              • {e.title} ({e.status}) - {e.isAllDay ? 'All Day' : 'Timed'}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {/* Show timed events */}
                      {calendarEvents.filter(e => !e.isAllDay || e.isAllDay === false || e.isAllDay === 'false').length > 0 && (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: theme.tertiaryBackground, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: theme.primaryText }}>Timed Events:</Text>
                          {calendarEvents.filter(e => !e.isAllDay || e.isAllDay === false || e.isAllDay === 'false').map((e, index) => (
                            <Text key={index} style={{ fontSize: 11, marginBottom: 2, color: theme.secondaryText }}>
                              • {e.title} ({e.startTime}-{e.endTime}) - {e.status}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {/* Show time slot availability summary */}
                      {(() => {
                        const slots = generateTimeSlots(selectedDate);
                        const availableSlots = slots.filter(s => s.available).length;
                        const blockedSlots = slots.filter(s => !s.available).length;
                        const allDayBlocked = slots.length > 0 && slots.every(s => !s.available && s.reason === 'All-day event');
                        
                        return (
                          <View style={{ marginTop: 8, padding: 8, backgroundColor: allDayBlocked ? theme.tertiaryBackground : theme.tertiaryBackground, borderRadius: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: allDayBlocked ? theme.dangerButton : theme.successButton }}>
                              Time Slot Summary:
                            </Text>
                            <Text style={{ fontSize: 11, marginBottom: 2, color: theme.secondaryText }}>
                              Available: {availableSlots} slots
                            </Text>
                            <Text style={{ fontSize: 11, marginBottom: 2, color: theme.secondaryText }}>
                              Blocked: {blockedSlots} slots
                            </Text>
                            {allDayBlocked && (
                              <Text style={{ fontSize: 11, color: theme.dangerButton, fontWeight: 'bold' }}>
                                ⚠️ All slots blocked by all-day event
                              </Text>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Modal Buttons */}
                  <View style={[styles.modalButtons, { 
                    flexDirection: 'row', 
                    gap: 12,
                    marginTop: 20,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: theme.dividerColor
                  }]}>
                    <TouchableOpacity
                      style={[styles.modalButton, { 
                        backgroundColor: theme.secondaryButton,
                        flex: 1,
                        minHeight: responsiveStyles.buttonHeight
                      }]}
                      onPress={() => setShowRebookingModal(false)}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalButton, 
                        { 
                          backgroundColor: selectedTimeSlot ? theme.primaryButton : theme.inactiveStatus,
                          opacity: selectedTimeSlot ? 1 : 0.5,
                          flex: 1,
                          minHeight: responsiveStyles.buttonHeight
                        }
                      ]}
                      onPress={confirmRebooking}
                      disabled={!selectedTimeSlot}
                    >
                      <Text style={styles.modalButtonText}>Confirm Booking</Text>
                    </TouchableOpacity>
                  </View>
                      </ScrollView>
                    </View>
                  );
                })()}
              </View>
            </Modal>
          )}

        </View>
      )}
      </View>
      )}
    </View>
  );

  const renderPage2 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Solar Installation Reasons</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Tell us what motivates you to go solar</Text>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>🌱 What are the two most important reasons for installing solar and/or battery storage? *</Text>
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Select up to two options that best describe your motivations.</Text>
        
        <View style={styles.checkboxGroup}>
          {[
            { text: 'Reducing your energy bills', icon: '💰' },
            { text: 'Reducing your carbon footprint', icon: '🌍' },
            { text: 'Adding value to your home', icon: '🏠' },
            { text: 'Looking for an investment', icon: '📈' },
            { text: 'Energy security', icon: '🔒' },
            { text: 'Becoming more sustainable', icon: '♻️' },
            { text: 'Charging an electric vehicle', icon: '🚗' },
            { text: 'Heat your home from electric', icon: '🔥' }
          ].map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.checkboxOption,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                formData.page2.selectedReasons?.includes(option.text) && { borderColor: theme.primaryButton, backgroundColor: theme.primaryButton + '10' }
              ]}
              onPress={() => {
                const currentReasons = formData.page2.selectedReasons || [];
                let newReasons;
                
                if (currentReasons.includes(option.text)) {
                  // Remove if already selected
                  newReasons = currentReasons.filter(reason => reason !== option.text);
                } else {
                  // Add if not selected (max 2)
                  if (currentReasons.length < 2) {
                    newReasons = [...currentReasons, option.text];
                  } else {
                    // Replace the first one if already at max
                    newReasons = [currentReasons[1], option.text];
                  }
                }
                
                updateFormData('page2', { selectedReasons: newReasons });
              }}
            >
              <View style={styles.checkboxInner}>
                <View style={[
                  styles.checkboxSquare,
                  { borderColor: theme.cardBorder },
                  formData.page2.selectedReasons?.includes(option.text) && { backgroundColor: theme.primaryButton, borderColor: theme.primaryButton }
                ]}>
                  {formData.page2.selectedReasons?.includes(option.text) && (
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                  )}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={styles.checkboxIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.checkboxText,
                    { color: theme.primaryText },
                    formData.page2.selectedReasons?.includes(option.text) && { color: theme.primaryButton, fontWeight: '600' }
                  ]}>
                    {option.text}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {formData.page2.selectedReasons && formData.page2.selectedReasons.length > 0 && (
          <View style={[styles.selectedSummary, { backgroundColor: theme.primaryButton + '15', borderColor: theme.primaryButton + '30' }]}>
            <Text style={[styles.selectedSummaryText, { color: theme.primaryButton }]}>
              Selected: {formData.page2.selectedReasons.join(', ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderPage3 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Property Information</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Tell us about your property and occupancy</Text>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>🏠 Property Details</Text>
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Please provide information about your property and occupancy.</Text>
        
        {/* Row 1: Property and Type of Property */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Property *</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Property');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.property || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Type of property</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Type of property');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.propertyType || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Bedrooms and Length of Stay */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>How many Bedrooms?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('How many Bedrooms');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.bedrooms || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>How Long have you lived in the property?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('How Long have you lived in the property');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.lengthOfStay || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 3: Moving Plans and Occupants */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Any plans on moving in the next 2 years? *</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Any plans on moving in the next 2 years');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.movingPlans || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>How Many Occupants live in the property?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('How Many Occupants live in the property');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.occupants || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 4: Future Occupants and Extensions */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Are there any new occupants now or in the near future?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Are there any new occupants now or in the near future');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.occupantsChangingSoon || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Any planned extensions?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Any planned extensions');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.extensionsPlanned || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 5: Roof Changes and Panel Installation Issues */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Any roof changes or alterations planned?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Any roof changes or alterations planned');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.roofChangesAlterations || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <View style={styles.column}>
            <Text style={[styles.label, { color: theme.primaryText }]}>Anything that may affect panels being installed?</Text>
            <TouchableOpacity
              style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
              onPress={() => {
                setOpenDropdown('Anything that may affect panels being installed');
                setShowDropdownModal(true);
              }}
            >
              <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                {formData.page3.panelInstallationIssues || 'Please Select'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const Page4 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Heating & Energy Information</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Tell us about your heating system and energy usage to optimize your solar solution</Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Heating & Energy Details</Text>
        
        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Heating Type <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Heating Type');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page4.heatingType || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Do you have any of the following? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Do you have any of the following');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page4.additionalFeatures || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Do you have a pre-paid meter? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Do you have a pre-paid meter');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page4.prepaidMeter || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        {formData.page4.prepaidMeter === 'Yes' && (
          <View style={[
            modernStyles.infoCard,
            { 
              backgroundColor: theme.primaryButton + '15',
              borderLeftColor: theme.primaryButton 
            }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="information-circle" 
                size={20} 
                color={theme.primaryButton} 
                style={modernStyles.infoIcon}
              />
              <Text style={[modernStyles.infoText, { color: theme.primaryButton }]}>
                A smart meter will be required to claim renewable tariffs
              </Text>
            </View>
          </View>
        )}

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            What phase meter is the property supplied by? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('What phase meter is the property supplied by');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page4.phaseMeter || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        {formData.page4.phaseMeter === '3 Phase' && (
          <View style={[
            modernStyles.infoCard,
            { 
              backgroundColor: theme.primaryButton + '15',
              borderLeftColor: theme.primaryButton 
            }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="information-circle" 
                size={20} 
                color={theme.primaryButton} 
                style={modernStyles.infoIcon}
              />
              <Text style={[modernStyles.infoText, { color: theme.primaryButton }]}>
                A three phase inverter will be required for your installation
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Energy Bill Information</Text>
        
        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Do you have an energy bill? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Do you have an energy bill');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page4.hasEnergyBill || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        {formData.page4.hasEnergyBill === 'No' && (
          <View style={[
            modernStyles.infoCard,
            { 
              backgroundColor: theme.dangerButton + '15',
              borderLeftColor: theme.dangerButton 
            }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name="warning" 
                size={20} 
                color={theme.dangerButton} 
                style={modernStyles.infoIcon}
              />
              <Text style={[modernStyles.infoText, { color: theme.dangerButton }]}>
                If you don't have an energy bill, you will need to sign a disclaimer form to proceed with the solar assessment. If you do have any bill available, please still upload it below.
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Energy Company *</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="business-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
          <TextInput
            ref={(ref) => {
              if (focusedInputRef.current === 'energyCompany') {
                ref?.focus();
              }
            }}
            style={[styles.inputWithIconText, { color: theme.primaryText }]}
            value={formData.page4.energyCompany || ''}
            onChangeText={(text: string) => {
              console.log('🔍 Energy Company onChangeText:', text);
              focusedInputRef.current = 'energyCompany';
              updateFormData('page4', { energyCompany: text });
            }}
            onFocus={() => {
              console.log('🔍 Energy Company onFocus');
              focusedInputRef.current = 'energyCompany';
            }}
            onBlur={() => {
              console.log('🔍 Energy Company onBlur');
              if (focusedInputRef.current === 'energyCompany') {
                focusedInputRef.current = null;
              }
            }}
            placeholder="e.g., British Gas, EDF Energy"
            placeholderTextColor={theme.tertiaryText}
            autoCorrect={false}
            autoCapitalize="words"
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Average Monthly Electric Spend</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="cash-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
          <TextInput
            ref={(ref) => {
              if (focusedInputRef.current === 'monthlyElectricSpend') {
                ref?.focus();
              }
            }}
            style={[styles.inputWithIconText, { color: theme.primaryText }]}
            value={formData.page4.monthlyElectricSpend || ''}
            onChangeText={(text: string) => {
              console.log('🔍 Monthly Electric Spend onChangeText:', text);
              focusedInputRef.current = 'monthlyElectricSpend';
              updateFormData('page4', { monthlyElectricSpend: text });
            }}
            onFocus={() => {
              console.log('🔍 Monthly Electric Spend onFocus');
              focusedInputRef.current = 'monthlyElectricSpend';
            }}
            onBlur={() => {
              console.log('🔍 Monthly Electric Spend onBlur');
              if (focusedInputRef.current === 'monthlyElectricSpend') {
                focusedInputRef.current = null;
              }
            }}
            placeholder="Enter amount in £"
            placeholderTextColor={theme.tertiaryText}
            keyboardType="numeric"
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Electric Price Per Unit *</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="pricetag-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
          <TextInput
            ref={(ref) => {
              if (focusedInputRef.current === 'electricPricePerUnit') {
                ref?.focus();
              }
            }}
            style={[styles.inputWithIconText, { color: theme.primaryText }]}
            value={formData.page4.electricPricePerUnit || ''}
            onChangeText={(text: string) => {
              console.log('🔍 Electric Price Per Unit onChangeText:', text);
              focusedInputRef.current = 'electricPricePerUnit';
              updateFormData('page4', { electricPricePerUnit: text });
            }}
            onFocus={() => {
              console.log('🔍 Electric Price Per Unit onFocus');
              focusedInputRef.current = 'electricPricePerUnit';
            }}
            onBlur={() => {
              console.log('🔍 Electric Price Per Unit onBlur');
              if (focusedInputRef.current === 'electricPricePerUnit') {
                focusedInputRef.current = null;
              }
            }}
            placeholder="p/kWh"
            placeholderTextColor={theme.tertiaryText}
            keyboardType="numeric"
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Annual Electric Usage *</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="flash-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
          <TextInput
            ref={(ref) => {
              if (focusedInputRef.current === 'annualElectricUsage') {
                ref?.focus();
              }
            }}
            style={[styles.inputWithIconText, { color: theme.primaryText }]}
            value={formData.page4.annualElectricUsage || ''}
            onChangeText={(text: string) => {
              console.log('🔍 Annual Electric Usage onChangeText:', text);
              focusedInputRef.current = 'annualElectricUsage';
              updateFormData('page4', { annualElectricUsage: text });
            }}
            onFocus={() => {
              console.log('🔍 Annual Electric Usage onFocus');
              focusedInputRef.current = 'annualElectricUsage';
            }}
            onBlur={() => {
              console.log('🔍 Annual Electric Usage onBlur');
              if (focusedInputRef.current === 'annualElectricUsage') {
                focusedInputRef.current = null;
              }
            }}
            placeholder="kWh"
            placeholderTextColor={theme.tertiaryText}
            keyboardType="numeric"
            autoCorrect={false}
            autoCapitalize="none"
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>
        <Text style={[styles.helperText, { color: theme.secondaryText }]}>Found on the energy bill, if no bill calculate from energy spend</Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Energy Bill</Text>
        <ModernFileUpload
          label="Picture of Energy Bill"
          fieldName="energyBill"
          onPress={() => handleFileUpload('energyBill')}
          files={(() => {
            const files = uploadedFiles.energyBill || [];
            console.log('📷 Energy Bill files for UI:', files);
            console.log('📷 Energy Bill files detailed:', files.map(file => ({
              hasUri: !!file.uri,
              hasBase64: !!file.base64,
              uri: file.uri,
              name: file.name,
              type: file.type,
              size: file.size
            })));
            return files;
          })()}
          onRemove={(index: number) => removeFile('energyBill', index)}
          required={formData.page4.hasEnergyBill === 'Yes'}
        />
        <Text style={[styles.helperText, { color: theme.secondaryText }]}>
          {formData.page4.hasEnergyBill === 'No'
            ? 'If you selected No, still upload any bill you do have so we can use it.'
            : 'Full name and address, energy usage and tariff must show'}
        </Text>
      </View>
    </View>
  );

  const renderPage5 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>EPC & Solar Funding</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Energy Performance Certificate and previous funding information</Text>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📊 Energy Performance</Text>
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Please provide information about your home's energy performance and previous solar funding.</Text>
        
        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            What is the EPC rating of your home?
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('What is the EPC rating of your home');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page5.epcRating ? `EPC Rating ${formData.page5.epcRating}` : 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            showAlert(
              'EPC Register',
              'You can check your EPC rating at: https://www.gov.uk/find-energy-certificate',
              [{ text: 'OK' }]
            );
          }}>
            <Text style={[styles.linkText, { color: theme.primaryButton }]}>EPC Register</Text>
          </TouchableOpacity>
        </View>

        <ModernFileUpload
          label="Picture of EPC certificate"
          onPress={() => handleFileUpload('epcCertificate')}
          files={(() => {
            const files = uploadedFiles.epcCertificate || [];
            console.log('📷 EPC Certificate files for UI:', files);
            console.log('📷 EPC Certificate files detailed:', files.map(file => ({
              hasUri: !!file.uri,
              hasBase64: !!file.base64,
              uri: file.uri,
              name: file.name,
              type: file.type,
              size: file.size
            })));
            return files;
          })()}
              onRemove={(index: number) => removeFile('epcCertificate', index)}
          required={false}
        />

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Have you been offered solar funding before? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Have you been offered solar funding before');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page5.previousSolarFunding || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        {formData.page5.previousSolarFunding === 'Yes' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>If yes, who was the company?</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="business-outline" size={20} color={theme.secondaryText} style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIconText}
                placeholder="Enter company name"
                value={formData.page5.previousCompany || ''}
                onChangeText={(text) => updateFormData('page5', { previousCompany: text })}
                autoCorrect={false}
                autoCapitalize="words"
                blurOnSubmit={false}
                returnKeyType="next"
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderPage6 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Financial & Installation Information</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Please provide financial and installation availability details</Text>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>💰 Financial Assessment</Text>
        <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Please provide information about your financial situation and installation availability.</Text>
        
        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Do you have any of the following? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Do you have any of the following financial issues');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page6.financialIssues || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            What is your credit rating? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('What is your credit rating');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page6.creditRating || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>

        <View style={modernStyles.inputContainer}>
          <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
            Are you available for installation within 6 weeks if eligible? <Text style={{ color: theme.dangerButton }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
            onPress={() => {
              setOpenDropdown('Are you available for installation within 6 weeks if eligible');
              setShowDropdownModal(true);
            }}
          >
            <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
              {formData.page6.installationAvailability || 'Please Select'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPage7 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Property Assessment</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Upload photos of your property for assessment</Text>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Property Exterior Pictures</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Picture of front door"
              onPress={() => handleFileUpload('frontDoor')}
              files={uploadedFiles.frontDoor || []}
              onRemove={(index: number) => removeFile('frontDoor', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Make sure all door is in the picture</Text>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Picture of the front of the property"
              onPress={() => handleFileUpload('frontProperty')}
              files={uploadedFiles.frontProperty || []}
              onRemove={(index: number) => removeFile('frontProperty', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>All of property in the picture</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Roof Pictures</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Picture of the Target roofs"
              onPress={() => handleFileUpload('targetRoofs')}
              files={uploadedFiles.targetRoofs || []}
              onRemove={(index: number) => removeFile('targetRoofs', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>All roofs where panels will be installed</Text>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Front back and sides of house"
              onPress={() => handleFileUpload('propertySides')}
              files={uploadedFiles.propertySides || []}
              onRemove={(index: number) => removeFile('propertySides', index)}
              required={false}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Full pictures property</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Roof Angle & Other Roof Pictures</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Picture of the Angle of the roof"
              onPress={() => handleFileUpload('roofAngle')}
              files={uploadedFiles.roofAngle || []}
              onRemove={(index: number) => removeFile('roofAngle', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Clear picture of apex</Text>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Other roof Pictures"
              onPress={() => handleFileUpload('otherRoofPictures')}
              files={uploadedFiles.otherRoofPictures || []}
              onRemove={(index: number) => removeFile('otherRoofPictures', index)}
              required={false}
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Type of Roof Tile</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                Type of roof tile <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  setOpenDropdown('Type of roof tile');
                  setShowDropdownModal(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {formData.page7.roofTileType || 'Please Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Close up image of roof tile"
              onPress={() => handleFileUpload('roofTileCloseup')}
              files={uploadedFiles.roofTileCloseup || []}
              onRemove={(index: number) => removeFile('roofTileCloseup', index)}
              required={true}
            />
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Internal Ceiling Pictures</Text>
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Internal Ceiling Pictures"
              onPress={() => handleFileUpload('internalCeilingPictures')}
              files={uploadedFiles.internalCeilingPictures || []}
              onRemove={(index: number) => removeFile('internalCeilingPictures', index)}
              required={true}
              minRequired={4}
              maxFiles={10}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Minimum 4 images required, up to 10</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Fuseboard and Electric Metre</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Fuse board"
              onPress={() => handleFileUpload('fuseBoard')}
              files={uploadedFiles.fuseBoard || []}
              onRemove={(index: number) => removeFile('fuseBoard', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Clear picture of fuse board</Text>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Electric meter"
              onPress={() => handleFileUpload('electricMeter')}
              files={uploadedFiles.electricMeter || []}
              onRemove={(index: number) => removeFile('electricMeter', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Clear picture of all components near this</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Garage & Other Buildings</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Picture of garage(if applicable)"
              onPress={() => handleFileUpload('garage')}
              files={uploadedFiles.garage || []}
              onRemove={(index: number) => removeFile('garage', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Internal and external</Text>
          </View>

          <View style={styles.column}>
            <ModernFileUpload
              label="Other buildings being used (if applicable)"
              onPress={() => handleFileUpload('otherBuildings')}
              files={uploadedFiles.otherBuildings || []}
              onRemove={(index: number) => removeFile('otherBuildings', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Flat roofs, or other</Text>
          </View>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Battery and inverter location</Text>
        
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <ModernFileUpload
              label="Battery & inverter location (Outside)"
              onPress={() => handleFileUpload('batteryInverterLocation')}
              files={uploadedFiles.batteryInverterLocation || []}
              onRemove={(index: number) => removeFile('batteryInverterLocation', index)}
              required={true}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Pictures showing a few locations</Text>
          </View>

          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                Does the property have solar/ Battery storage? <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  setOpenDropdown('Does the property have solar/ Battery storage');
                  setShowDropdownModal(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {formData.page7.solarBatteryStorage || 'Please Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPage8 = () => (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: theme.primaryText }]}>Installation Assessment</Text>
        <Text style={[styles.pageSubtitle, { color: theme.secondaryText }]}>Final assessment for installation requirements</Text>
      </View>
      
      {/* EV Location - Only show if EV charger is required */}
      {formData.page8?.evChargerRequired === 'Yes' && (
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>EV Location</Text>
          <View style={styles.singleColumn}>
            <ModernFileUpload
              label="EV Location"
              onPress={() => handleFileUpload('evLocation')}
              files={uploadedFiles.evLocation || []}
              onRemove={(index: number) => removeFile('evLocation', index)}
              required={false}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Ideally to the front of the property</Text>
          </View>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>EV Charger & Optimisers</Text>
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                EV charger required? <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  setOpenDropdown('EV charger required');
                  setShowDropdownModal(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {formData.page8?.evChargerRequired || 'Please Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            {formData.page8?.evChargerRequired === 'Yes' && (
              <View style={modernStyles.inputContainer}>
                <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                  EV charger quantity
                </Text>
                <TextInput
                  style={[modernStyles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                  placeholder="Enter quantity"
                  value={formData.page8?.evChargerQuantity || ''}
                  onChangeText={(text) => updateFormData('page8', { evChargerQuantity: text })}
                  keyboardType="numeric"
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
              </View>
            )}
          </View>

          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                Does the property require optimisers? <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  setOpenDropdown('Does the property require optimisers');
                  setShowDropdownModal(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {formData.page8?.optimisersRequired || 'Please Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            {formData.page8?.optimisersRequired === 'Yes' && (
              <View style={modernStyles.inputContainer}>
                <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                  Optimisers quantity
                </Text>
                <TextInput
                  style={[modernStyles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                  placeholder="Enter quantity"
                  value={formData.page8?.optimisersQuantity || ''}
                  onChangeText={(text) => updateFormData('page8', { optimisersQuantity: text })}
                  keyboardType="numeric"
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
              </View>
            )}
          </View>
        </View>

        {/* EV Charger Image Upload - Only show if EV charger is required */}
        {formData.page8?.evChargerRequired === 'Yes' && (
          <View style={styles.singleColumn}>
            <ModernFileUpload
              label="EV Charger Location"
              onPress={() => handleFileUpload('evCharger')}
              files={uploadedFiles.evCharger || []}
              onRemove={(index: number) => removeFile('evCharger', index)}
              required={false}
            />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Pictures of where the EV charger will be installed</Text>
          </View>
        )}

      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Shading Issues</Text>
        <View style={styles.singleColumn}>
          <ModernFileUpload
            label="Shading issues"
            onPress={() => handleFileUpload('shadingIssues')}
            files={uploadedFiles.shadingIssues || []}
            onRemove={(index: number) => removeFile('shadingIssues', index)}
            required={false}
          />
          <Text style={[styles.helperText, { color: theme.secondaryText }]}>Pictures showing potential shading like trees, buildings, dormers, chimney's making sure the area to be affected and objects to cause shading is in the pictures.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Scaffolding Requirements</Text>
        <View style={styles.twoColumnGrid}>
          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                What scaffolding is required? <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  console.log('🔧 Scaffolding dropdown clicked, setting showScaffoldingMultiSelect to true');
                  setShowScaffoldingMultiSelect(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {(() => {
                    const selections = formData.page8?.scaffoldingRequired || [];
                    if (Array.isArray(selections) && selections.length > 0) {
                      return selections.join(', ');
                    }
                    return 'Please Select';
                  })()}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Permit is for going on public right of way, like a path, road</Text>
          </View>

          <View style={styles.column}>
            <View style={modernStyles.inputContainer}>
              <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
                Does scaffolding have to go through the house? <Text style={{ color: theme.dangerButton }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[modernStyles.dropdownWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder }]}
                onPress={() => {
                  setOpenDropdown('Does scaffolding have to go through the house');
                  setShowDropdownModal(true);
                }}
              >
                <Text style={[modernStyles.dropdownText, { color: theme.primaryText }]}>
                  {formData.page8?.scaffoldingThroughHouse || 'Please Select'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Due to no access to rear</Text>
          </View>
        </View>

        <View style={styles.singleColumn}>
          <ModernFileUpload
            label="Scaffolding"
            onPress={() => handleFileUpload('scaffolding')}
            files={uploadedFiles.scaffolding || []}
            onRemove={(index: number) => removeFile('scaffolding', index)}
            required={false}
          />
          <Text style={[styles.helperText, { color: theme.secondaryText }]}>Pictures access and clear pictures of where it will be going making sure whole of property is in.</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Additional Information</Text>
        <View style={styles.singleColumn}>
          <View style={modernStyles.inputContainer}>
            <Text style={[modernStyles.inputLabel, { color: theme.primaryText }]}>
              Further information
            </Text>
          <TextInput
            style={[[styles.textInput, { backgroundColor: theme.inputBackground, borderColor: theme.cardBorder, color: theme.primaryText }], styles.textArea]}
            placeholder="Enter any additional information..."
            value={formData.page8?.furtherInformation || ''}
            onChangeText={(text) => updateFormData('page8', { furtherInformation: text })}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="sentences"
            blurOnSubmit={false}
            returnKeyType="next"
          />
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>Anything discussed regarding the installation please add here.</Text>
          </View>
        </View>
      </View>

      {/* Scaffolding Multi-Select Modal */}
      {showScaffoldingMultiSelect && (
        <Modal
          visible={showScaffoldingMultiSelect}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            console.log('🔧 Scaffolding modal onRequestClose called');
            setShowScaffoldingMultiSelect(false);
          }}
          onShow={() => {
            console.log('🔧 Scaffolding modal is rendering');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Select Scaffolding Requirements</Text>
              
              <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
                {['1 side', '2 sides', '3 sides', '4 sides', 'Extra elevation', 'Over 9 meters', 'Perimeter required'].map((option, index) => {
                  const selections: string[] = formData.page8?.scaffoldingRequired || [];
                  const isSelected = Array.isArray(selections) && selections.includes(option);
                  
                  return (
                    <TouchableOpacity
                      key={`scaffolding-${option}-${index}`}
                      style={[
                        styles.modalOption,
                        { 
                          backgroundColor: isSelected ? theme.primaryButton : theme.inputBackground,
                          borderColor: theme.cardBorder 
                        }
                      ]}
                      onPress={() => handleScaffoldingMultiSelect(option)}
                    >
                      <Text style={[
                        styles.modalOptionText,
                        { color: isSelected ? '#FFFFFF' : theme.primaryText }
                      ]}>
                        {option}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
                  onPress={() => setShowScaffoldingMultiSelect(false)}
                >
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 1: return renderPage1();
      case 2: return renderPage2();
      case 3: return renderPage3();
      case 4: return Page4();
      case 5: return renderPage5();
      case 6: return renderPage6();
      case 7: return renderPage7();
      case 8: return renderPage8();
      default: return null;
    }
  };

  // Function to check if a page is complete - more flexible approach
  const isPageComplete = (pageNumber: number): boolean => {
    const pageKey = `page${pageNumber}` as keyof typeof formData;
    const pageData = formData[pageKey];
    
    if (!pageData || Object.keys(pageData).length === 0) {
      console.log(`🔍 Page ${pageNumber}: No data or empty data`);
      return false;
    }
    
    // Define core required fields for each page (minimum to consider page "started")
    const coreRequiredFields: { [key: number]: string[] } = {
      1: ['customerFirstName', 'customerLastName', 'addressLine1', 'postcode', 'date', 'homeOwnersAvailable', 'appointmentDurationConfirmed', 'renewableExecutiveLastName', 'renewableExecutiveFirstName'],
      2: ['propertyType', 'bedrooms', 'lengthOfStay', 'movingPlans', 'occupants', 'heatingType'],
      3: ['prepaidMeter', 'phaseMeter', 'epcRating', 'previousFunding', 'financialIssues', 'creditRating'],
      4: ['installationAvailability', 'roofTileType', 'solarBatteryStorage', 'evChargerRequired', 'optimisersRequired', 'scaffoldingRequired'],
      5: ['energyBill', 'epcCertificate'], // Page 5 has image fields
      6: ['frontDoor', 'frontProperty', 'targetRoofs', 'propertySides'], // Page 6 has image fields
      7: ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'fuseBoard', 'electricMeter', 'garage', 'batteryInverterLocation'], // Page 7 has image fields
      8: ['shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'] // Page 8 has image fields (EV images conditional)
    };
    
    let fields = [...(coreRequiredFields[pageNumber] || [])];
    if (pageNumber === 1 && isAdminUser) {
      fields = fields.filter((f) => f !== 'homeOwnersAvailable');
      fields = fields.filter((f) => f !== 'appointmentDurationConfirmed');
    }
    
    // For page 8, conditionally include EV images only if customer has EV charger
    if (pageNumber === 8 && formData.page8?.evChargerRequired === 'Yes') {
      fields = [...fields, 'evLocation', 'evCharger'];
    }
    
    // Count how many core fields are filled
    let filledFields = 0;
    const totalFields = fields.length;
    
    fields.forEach(field => {
      const value = (pageData as any)[field];
      
      // For image fields, check if files are uploaded
      if (['energyBill', 'epcCertificate', 'frontDoor', 'frontProperty', 'targetRoofs', 'propertySides', 'roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'fuseBoard', 'electricMeter', 'garage', 'batteryInverterLocation', 'evLocation', 'evCharger', 'shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'].includes(field)) {
        const uploadedFilesForField = uploadedFiles[field] || [];
        if (uploadedFilesForField.length > 0) {
          filledFields++;
        }
      } else {
        // For regular fields, check if they have values
        const hasValue = value !== undefined && value !== null && value !== '' && value !== 'Please Select';
        if (hasValue) {
          filledFields++;
        }
      }
    });
    
    // A page is considered "complete" if at least 80% of core fields are filled
    // This allows for some optional fields to be empty
    const completionPercentage = (filledFields / totalFields) * 100;
    const isComplete = completionPercentage >= 80;
    
    console.log(`🔍 Page ${pageNumber}: ${filledFields}/${totalFields} fields filled (${completionPercentage.toFixed(1)}%) - ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    
    // Special case: If this is page 1 and it's mostly auto-filled data, 
    // we should still consider it complete if the user has made any changes
    if (pageNumber === 1 && isComplete) {
      // Check if user has made any meaningful changes beyond auto-fill
      const page1Data = pageData as any; // Type assertion for page 1 specific fields
      const hasUserInput = page1Data.customerFirstName || page1Data.customerLastName || 
                          page1Data.addressLine1 || page1Data.postcode || 
                          (!isAdminUser && page1Data.homeOwnersAvailable);
      if (hasUserInput) {
        console.log(`🔍 Page ${pageNumber}: Has user input, considering complete`);
        return true;
      }
    }
    
    return isComplete;
  };

  // Helper function to get image fields for a specific page
  const getImageFieldsForPage = (pageNumber: number): string[] => {
    const imageFieldsByPage: { [key: number]: string[] } = {
      1: [], // Page 1 has no image fields
      2: [], // Page 2 has no image fields
      3: [], // Page 3 has no image fields
      4: ['energyBill'], // Page 4 image fields
      5: ['epcCertificate'], // Page 5 image fields
      6: ['frontDoor', 'frontProperty', 'targetRoofs', 'propertySides'], // Page 6 image fields
      7: ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'fuseBoard', 'electricMeter', 'garage', 'batteryInverterLocation'], // Page 7 image fields
      8: ['shadingIssues', 'scaffolding', 'customerSignature', 'renewableExecutiveSignature'] // Page 8 image fields (EV images conditional)
    };
    
    // For page 8, conditionally include EV images only if customer has EV charger
    if (pageNumber === 8) {
      const baseFields = imageFieldsByPage[8] || [];
      if (formData.page8?.evChargerRequired === 'Yes') {
        return [...baseFields, 'evLocation', 'evCharger'];
      }
      return baseFields;
    }
    
    return imageFieldsByPage[pageNumber] || [];
  };

  // Function to find the last page with saved data (where user left off)
  const findLastSavedPage = (): number => {
    return findLastSavedPageWithData(formData);
  };

  // Function to find the last page with saved data using custom form data
  const findLastSavedPageWithData = (dataToCheck: typeof formData): number => {
    console.log('🔍 Finding last page with saved data...');
    let lastSavedPage = 1; // Default to page 1
    
    for (let i = 1; i <= totalPages; i++) {
      const pageKey = `page${i}` as keyof typeof dataToCheck;
      const pageData = dataToCheck[pageKey];
      
      // Check if page has any form data
      let hasFormData = false;
      if (pageData && Object.keys(pageData).length > 0) {
        hasFormData = Object.values(pageData).some(value => 
          value !== undefined && value !== null && value !== '' && value !== 'Please Select'
        );
      }
      
      // Check if page has any uploaded images
      let hasImages = false;
      const imageFieldsForPage = getImageFieldsForPage(i);
      if (imageFieldsForPage.length > 0) {
        hasImages = imageFieldsForPage.some(fieldName => {
          // Check both uploadedFiles state and formData for images
          const imagesInState = uploadedFiles[fieldName] || [];
          const fieldFilesKey = `${fieldName}Files` as keyof typeof pageData;
          const imagesInFormData = pageData?.[fieldFilesKey] || [];
          const hasImagesInState = Array.isArray(imagesInState) && (imagesInState as any[]).length > 0;
          const hasImagesInFormData = Array.isArray(imagesInFormData) && (imagesInFormData as any[]).length > 0;
          
          // Debug logging for page 6
          if (i === 6) {
            console.log(`🔍 Page 6 image field "${fieldName}":`, {
              imagesInState: Array.isArray(imagesInState) ? (imagesInState as any[]).length : 0,
              imagesInFormData: Array.isArray(imagesInFormData) ? (imagesInFormData as any[]).length : 0,
              hasImagesInState,
              hasImagesInFormData,
              fieldFilesKey,
              pageData: pageData
            });
          }
          
          // Debug logging for page 7
          if (i === 7) {
            console.log(`🔍 Page 7 image field "${fieldName}":`, {
              imagesInState: Array.isArray(imagesInState) ? (imagesInState as any[]).length : 0,
              imagesInFormData: Array.isArray(imagesInFormData) ? (imagesInFormData as any[]).length : 0,
              hasImagesInState,
              hasImagesInFormData,
              fieldFilesKey,
              pageData: pageData
            });
          }
          
          return hasImagesInState || hasImagesInFormData;
        });
      }
      
      // Page is considered "saved" if it has either form data OR images
      if (hasFormData || hasImages) {
        lastSavedPage = i;
        console.log(`🔍 Page ${i}: Has saved data (form: ${hasFormData}, images: ${hasImages})`);
        if (i === 7) {
          console.log(`🔍 Page 7 detailed check:`, {
            hasFormData,
            hasImages,
            pageData: pageData,
            imageFieldsForPage,
            uploadedFiles: Object.keys(uploadedFiles).filter(key => 
              ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'fuseBoard', 'electricMeter', 'garage', 'batteryInverterLocation'].includes(key)
            ).reduce((acc, key) => ({ ...acc, [key]: uploadedFiles[key]?.length || 0 }), {})
          });
        }
      } else {
        console.log(`🔍 Page ${i}: No saved data`);
        if (i === 7) {
          console.log(`🔍 Page 7 detailed check (no data):`, {
            hasFormData,
            hasImages,
            pageData: pageData,
            imageFieldsForPage,
            uploadedFiles: Object.keys(uploadedFiles).filter(key => 
              ['roofAngle', 'otherRoofPictures', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'fuseBoard', 'electricMeter', 'garage', 'batteryInverterLocation'].includes(key)
            ).reduce((acc, key) => ({ ...acc, [key]: uploadedFiles[key]?.length || 0 }), {})
          });
        }
      }
    }
    
    console.log(`🔍 Last page with saved data: ${lastSavedPage}`);
    return lastSavedPage;
  };

  // Enhanced auto-navigation function - takes user to last saved page
  const navigateToLastSavedPage = async (context: string = 'unknown') => {
    console.log(`🔍 Auto-navigation disabled: ${context}`);
    // Auto-navigation temporarily disabled
  };

  // Auto-navigation disabled to prevent performance issues and loops

  const handleNext = async () => {
    // Only validate if not on the last page (submitting)
    // The submitSurvey function has comprehensive validation for all pages
    if (currentPage < totalPages && !validateCurrentPage()) {
      return;
    }
    
    // Mark that user has manually navigated
    setHasManuallyNavigated(true);
    
    setNextButtonLoading(true);
    
    try {
      
      if (currentPage < totalPages) {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        
        // Navigation completed
        
        // Scroll to top when navigating to next page
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 50); // Reduced timeout for faster navigation
      } else {
        submitSurvey();
      }
    } finally {
      setNextButtonLoading(false);
    }
  };

  // Web-compatible alert function
  const showAlert = (title: string, message: string, typeOrButtons?: 'success' | 'error' | 'info' | 'warning' | any[], buttons?: any[]) => {
    const isWeb = typeof window !== 'undefined' && window.document;
    
    // Determine if third parameter is type or buttons
    let type: 'success' | 'error' | 'info' | 'warning' = 'info';
    let actualButtons = buttons;
    
    if (Array.isArray(typeOrButtons)) {
      // Third parameter is buttons array (old signature)
      actualButtons = typeOrButtons;
      type = 'info'; // default type
    } else if (typeof typeOrButtons === 'string') {
      // Third parameter is type (new signature)
      type = typeOrButtons;
    }
    
    if (isWeb) {
      // Web environment - use custom alert instead of window.alert
      setCustomAlert({
        visible: true,
        title,
        message,
        type,
      });
    } else {
      // Mobile environment - use Alert
      if (actualButtons && actualButtons.length > 0) {
        Alert.alert(title, message, actualButtons);
      } else {
        Alert.alert(title, message, [{ text: 'OK' }]);
      }
    }
  };

  const hideCustomAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
  };

  // Comprehensive validation function that returns detailed field information
  const validateCurrentPageDetailed = () => {
    const missingFields: string[] = [];
    const fieldsToHighlight = new Set<string>();
    
    switch (currentPage) {
      case 1:
        const page1Data = formData.page1;
        
        if (!isAdminUser) {
          // Check home owners availability
          if (!page1Data?.homeOwnersAvailable) {
            missingFields.push('Home Owners Availability');
            fieldsToHighlight.add('homeOwnersAvailable');
          }

          // Check appointment duration confirmation
          if (!page1Data?.appointmentDurationConfirmed) {
            missingFields.push('Appointment will take up to 1hr 30mins');
            fieldsToHighlight.add('appointmentDurationConfirmed');
          }
          
          // Check appointment date/time if rebooking is needed
          if (
            page1Data?.homeOwnersAvailable === HomeOwnerAvailability.NO_REBOOK_APPOINTMENT ||
            page1Data?.appointmentDurationConfirmed === 'No'
          ) {
            if (!page1Data.appointmentDateTime) {
              missingFields.push('New Appointment Date & Time');
              fieldsToHighlight.add('appointmentDateTime');
            }
          }
        }
        
        // Check customer information
        if (!page1Data?.customerFirstName) {
          missingFields.push('Customer First Name');
          fieldsToHighlight.add('customerFirstName');
        }
        if (!page1Data?.customerLastName) {
          missingFields.push('Customer Last Name');
          fieldsToHighlight.add('customerLastName');
        }
        
        // Check renewable executive information
        if (!page1Data?.renewableExecutiveFirstName) {
          missingFields.push('Renewable Executive First Name');
          fieldsToHighlight.add('renewableExecutiveFirstName');
        }
        if (!page1Data?.renewableExecutiveLastName) {
          missingFields.push('Renewable Executive Last Name');
          fieldsToHighlight.add('renewableExecutiveLastName');
        }
        
        // Check address information
        if (!page1Data?.addressLine1) {
          missingFields.push('Address Line 1');
          fieldsToHighlight.add('addressLine1');
        }
        if (!page1Data?.postcode) {
          missingFields.push('Postcode');
          fieldsToHighlight.add('postcode');
        }
        break;
        
      case 2:
        // Add page 2 validations as needed
        break;
        
      case 3:
        const page3Data = formData.page3;
        if (!page3Data?.property) {
          missingFields.push('Property Type');
          fieldsToHighlight.add('property');
        }
        if (!page3Data?.propertyType) {
          missingFields.push('Property Type Details');
          fieldsToHighlight.add('propertyType');
        }
        break;
        
      case 8:
        const page8Data = formData.page8;
        
        // Check EV charger requirement
        if (!page8Data?.evChargerRequired) {
          missingFields.push('EV charger required');
          fieldsToHighlight.add('evChargerRequired');
        }
        
        // Check optimisers requirement
        if (!page8Data?.optimisersRequired) {
          missingFields.push('Does the property require optimisers');
          fieldsToHighlight.add('optimisersRequired');
        }
        
        // Check scaffolding requirement
        if (!page8Data?.scaffoldingRequired || (Array.isArray(page8Data.scaffoldingRequired) && page8Data.scaffoldingRequired.length === 0)) {
          missingFields.push('What scaffolding is required');
          fieldsToHighlight.add('scaffoldingRequired');
        }
        
        // Check scaffolding through house
        if (!page8Data?.scaffoldingThroughHouse) {
          missingFields.push('Does scaffolding have to go through the house');
          fieldsToHighlight.add('scaffoldingThroughHouse');
        }
        break;
        
      // Add more page validations as needed
      default:
        break;
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
      fieldsToHighlight
    };
  };

  const validateCurrentPage = () => {
    const validation = validatePage(currentPage, formData, uploadedFiles, surveyValidationOptions);
    
    // Filter out image field errors - images are optional and can be uploaded later
    const nonImageErrors = validation.missingFields.filter(field => field.fieldType !== 'image');
    
    if (nonImageErrors.length > 0) {
      // Show validation popup with missing fields (excluding images)
      const missingFieldNames = nonImageErrors.map(field => field.displayName);
      const nonImageFieldsToHighlight = new Set<string>();
      nonImageErrors.forEach(field => nonImageFieldsToHighlight.add(field.fieldName));
      
      setMissingFields(missingFieldNames);
      setHighlightedFields(nonImageFieldsToHighlight);
      setShowValidationPopup(true);
      return false;
    }
    
    return true;
  };

  const handlePrevious = async () => {
    // Mark that user has manually navigated
    setHasManuallyNavigated(true);
    
    
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      
      // Navigation completed
    }
  };

  // Enhanced validation popup handlers
  const handleCloseValidationPopup = () => {
    setShowValidationPopup(false);
    setMissingFields([]);
    // Keep highlighting for a few seconds to help user find fields
    setTimeout(() => {
      setHighlightedFields(new Set());
    }, 5000);
  };

  const handleGoToField = (fieldName: string) => {
    // Find the field info to get the page number
    const fieldInfo = getFieldInfo(fieldName);
    
    if (fieldInfo) {
      // Navigate to the page containing the field
      setCurrentPage(fieldInfo.pageNumber);
    setShowValidationPopup(false);
      
      // Scroll to top after navigation
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
      
      // Keep the field highlighted for a few seconds
    setTimeout(() => {
      setHighlightedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }, 3000);
    } else {
      // Fallback: just close the popup
      setShowValidationPopup(false);
    }
  };

  // Navigate to a specific page
  const navigateToPage = useCallback(async (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) {
      return;
    }


    // Navigate to target page
    setCurrentPage(pageNumber);

    // Scroll to top
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading survey...</Text>
        </View>
      </View>
    );
  }

  if (autoNavigating) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <Feather name="navigation" size={48} color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Taking you to where you left off...</Text>
          <Text style={[styles.loadingSubText, { color: theme.secondaryText }]}>Smart navigation in progress</Text>
        </View>
      </View>
    );
  }

  if (submitting) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContent}>
          <Feather name="loader" size={48} color={theme.secondaryText} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Submitting survey...</Text>
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
      
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => {
                // If in progress mode, call onCancel, otherwise navigate to SolarWorkflowScreen
                if (props?.onCancel) {
                  props.onCancel();
                } else {
                  // Navigate directly to SolarWorkflowScreen instead of going back
                  (navigation as any).navigate('SolarWorkflow', { 
                    opportunityId: opportunityId,
                    opportunity: null // Pass null as we don't have opportunity data here
                  });
                }
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Suitability Assessment</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Complete your solar survey
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={reloadSurvey}
            >
              <Feather name="download" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={resetForm}
            >
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
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

      {/* Dropdown Options Overlay - Rendered at root level */}
      {showDropdown && (
        <View style={[styles.globalDropdownOverlay, { backgroundColor: theme.cardBackground, borderColor: theme.primaryButton }]}>
          <TouchableOpacity
            style={[styles.dropdownOption, { borderBottomColor: theme.dividerColor }]}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page1', { homeOwnersAvailable: HomeOwnerAvailability.YES_SKIP_NEXT });
              setShowDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.successButton} style={styles.dropdownOptionIcon} />
              <Text style={[styles.dropdownOptionText, { color: theme.primaryText }]}>Yes, please skip to the next question</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dropdownOption, { borderBottomColor: theme.dividerColor }]}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page1', { homeOwnersAvailable: HomeOwnerAvailability.NO_REBOOK_APPOINTMENT });
              setShowDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="calendar-outline" size={18} color={theme.inactiveStatus} style={styles.dropdownOptionIcon} />
              <Text style={[styles.dropdownOptionText, { color: theme.primaryText }]}>No, rebook appointment</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Property Dropdown Options - Rendered at root level */}
      {showPropertyDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { property: 'House' });
              setShowPropertyDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>House</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { property: 'Bungalow' });
              setShowPropertyDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Bungalow</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { property: 'Town House' });
              setShowPropertyDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Town House</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Property Type Dropdown Options */}
      {showPropertyTypeDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { propertyType: 'Detached' });
              setShowPropertyTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="business-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Detached</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { propertyType: 'Semi' });
              setShowPropertyTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="business-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Semi</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { propertyType: 'Terraced' });
              setShowPropertyTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="business-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Terraced</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { propertyType: 'Commercial' });
              setShowPropertyTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="business-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Commercial</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Bedrooms Dropdown Options */}
      {showBedroomsDropdown && (
        <View style={styles.globalDropdownOverlay}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.dropdownOption}
              onPress={(e) => {
                e.stopPropagation();
                updateFormData('page3', { bedrooms: num.toString() });
                setShowBedroomsDropdown(false);
              }}
            >
              <View style={styles.dropdownOptionContent}>
                <Ionicons name="bed-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
                <Text style={styles.dropdownOptionText}>{num}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { bedrooms: '10+' });
              setShowBedroomsDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="bed-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>10+</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Length of Stay Dropdown Options */}
      {showLengthOfStayDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { lengthOfStay: 'Less than one year' });
              setShowLengthOfStayDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="time-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Less than one year</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { lengthOfStay: '1-5 years' });
              setShowLengthOfStayDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="time-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>1-5 years</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { lengthOfStay: '10-20 years' });
              setShowLengthOfStayDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="time-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>10-20 years</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { lengthOfStay: '20+ years' });
              setShowLengthOfStayDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="time-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>20+ years</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Moving Plans Dropdown Options */}
      {showMovingPlansDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { movingPlans: 'Yes' });
              setShowMovingPlansDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="car-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { movingPlans: 'No' });
              setShowMovingPlansDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="car-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 3 Occupants Dropdown Options */}
      {showOccupantsDropdown && (
        <View style={styles.globalDropdownOverlay}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.dropdownOption}
              onPress={(e) => {
                e.stopPropagation();
                updateFormData('page3', { occupants: num.toString() });
                setShowOccupantsDropdown(false);
              }}
            >
              <View style={styles.dropdownOptionContent}>
                <Ionicons name="people-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
                <Text style={styles.dropdownOptionText}>{num}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page3', { occupants: '10+' });
              setShowOccupantsDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="people-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>10+</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 4 Heating Type Dropdown Options */}
      {showHeatingTypeDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Gas boiler' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Gas boiler</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Oil Boiler' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Oil Boiler</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'LPG Boiler' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>LPG Boiler</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Electric boiler' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Electric boiler</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Heat pump' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Heat pump</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Solid fuel' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Solid fuel</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Electric radiators' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Electric radiators</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { heatingType: 'Electric underfloor heating' });
              setShowHeatingTypeDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Electric underfloor heating</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 4 Additional Features Dropdown Options */}
      {showAdditionalFeaturesDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'Hottub' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="water-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Hottub</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'Electrical Heated pool' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="water-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Electrical Heated pool</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'Electircal car' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="car-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Electircal car</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'Fish Pond' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="water-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Fish Pond</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'Under floor heating' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="thermometer-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Under floor heating</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { additionalFeatures: 'None' });
              setShowAdditionalFeaturesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>None</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 4 Prepaid Meter Dropdown Options */}
      {showPrepaidMeterDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { prepaidMeter: 'Yes' });
              setShowPrepaidMeterDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="card-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { prepaidMeter: 'No' });
              setShowPrepaidMeterDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="card-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 4 Phase Meter Dropdown Options */}
      {showPhaseMeterDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { phaseMeter: 'Single Phase' });
              setShowPhaseMeterDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="flash-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Single Phase</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page4', { phaseMeter: '3 Phase' });
              setShowPhaseMeterDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="flash-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>3 Phase</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 5 EPC Rating Dropdown Options */}
      {showEpcRatingDropdown && (
        <View style={styles.globalDropdownOverlay}>
          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={styles.dropdownOption}
              onPress={(e) => {
                e.stopPropagation();
                updateFormData('page5', { epcRating: rating });
                setShowEpcRatingDropdown(false);
              }}
            >
              <View style={styles.dropdownOptionContent}>
                <Ionicons name="analytics-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
                <Text style={styles.dropdownOptionText}>EPC Rating {rating}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Page 5 Previous Funding Dropdown Options */}
      {showPreviousFundingDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page5', { previousSolarFunding: 'Yes' });
              setShowPreviousFundingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page5', { previousSolarFunding: 'No' });
              setShowPreviousFundingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 6 Financial Issues Dropdown Options */}
      {showFinancialIssuesDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { financialIssues: "CCJ's" });
              setShowFinancialIssuesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="warning-outline" size={18} color="#f59e0b" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>CCJ's</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { financialIssues: 'Default' });
              setShowFinancialIssuesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="warning-outline" size={18} color="#f59e0b" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Default</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { financialIssues: 'Bankruptcy' });
              setShowFinancialIssuesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="warning-outline" size={18} color="#f59e0b" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Bankruptcy</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { financialIssues: 'No' });
              setShowFinancialIssuesDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 6 Credit Rating Dropdown Options */}
      {showCreditRatingDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { creditRating: 'Very good' });
              setShowCreditRatingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="star" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Very good</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { creditRating: 'Good' });
              setShowCreditRatingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="star" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Good</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { creditRating: 'Bad' });
              setShowCreditRatingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="star" size={18} color="#f59e0b" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Bad</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { creditRating: 'Very bad' });
              setShowCreditRatingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="star" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Very bad</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { creditRating: 'No' });
              setShowCreditRatingDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="help-circle-outline" size={18} color={theme.secondaryText} style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 6 Installation Availability Dropdown Options */}
      {showInstallationAvailabilityDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { installationAvailability: 'Yes' });
              setShowInstallationAvailabilityDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page6', { installationAvailability: 'No' });
              setShowInstallationAvailabilityDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 7 Roof Tile Type Dropdown Options */}
      {showRoofTileDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Concrete' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Concrete</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Slate' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Slate</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Rosemary' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Rosemary</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Flat roof' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Flat roof</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Pantile' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Pantile</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { roofTileType: 'Other' });
              setShowRoofTileDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="home-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Other</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 7 Solar/Battery Storage Dropdown Options */}
      {showSolarBatteryDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { solarBatteryStorage: 'Solar' });
              setShowSolarBatteryDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="power-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Solar</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { solarBatteryStorage: 'Battery' });
              setShowSolarBatteryDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="battery-charging-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Battery</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { solarBatteryStorage: 'Both' });
              setShowSolarBatteryDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="power-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Both</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page7', { solarBatteryStorage: 'N/A' });
              setShowSolarBatteryDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color={theme.secondaryText} style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>N/A</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 8 EV Charger Required Dropdown Options */}
      {showEvChargerDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { evChargerRequired: 'Yes' });
              setShowEvChargerDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { evChargerRequired: 'No' });
              setShowEvChargerDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 8 Optimisers Required Dropdown Options */}
      {showOptimisersDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { optimisersRequired: 'Yes' });
              setShowOptimisersDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { optimisersRequired: 'No' });
              setShowOptimisersDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Page 8 Scaffolding Required Dropdown Options */}
      {showScaffoldingRequiredDropdown && (
        <View style={styles.globalDropdownOverlay}>
          {['1 side', '2 sides', '3 sides', '4 sides', 'Extra elevation', 'Over 9 meters', 'Perimeter required'].map((option, index) => (
            <TouchableOpacity
              key={`global-${option}-${index}`}
              style={styles.dropdownOption}
              onPress={(e) => {
                e.stopPropagation();
                updateFormData('page8', { scaffoldingRequired: option });
                setShowScaffoldingRequiredDropdown(false);
              }}
            >
              <View style={styles.dropdownOptionContent}>
                <Ionicons name="construct-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
                <Text style={styles.dropdownOptionText}>{option}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Page 8 Scaffolding Through House Dropdown Options */}
      {showScaffoldingThroughHouseDropdown && (
        <View style={styles.globalDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { scaffoldingThroughHouse: 'Yes' });
              setShowScaffoldingThroughHouseDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>Yes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownOption}
            onPress={(e) => {
              e.stopPropagation();
              updateFormData('page8', { scaffoldingThroughHouse: 'No' });
              setShowScaffoldingThroughHouseDropdown(false);
            }}
          >
            <View style={styles.dropdownOptionContent}>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" style={styles.dropdownOptionIcon} />
              <Text style={styles.dropdownOptionText}>No</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}



      {/* Page Content */}
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
          styles.contentContainer, 
          { paddingBottom: 40 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Feather name="clipboard" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Solar Suitability Assessment</Text>
          <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
            Complete all sections to assess your solar installation eligibility
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: theme.primaryText }]}>Progress</Text>
            <Text style={[styles.progressText, { color: theme.secondaryText }]}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.progressBackground }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(currentPage / totalPages) * 100}%`,
                  backgroundColor: theme.progressFill 
                }
              ]} 
            />
          </View>
        </View>

        {renderCurrentPage()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={[
        styles.navigationContainer, 
        { 
          backgroundColor: theme.cardBackground, 
          borderTopColor: theme.cardBorder,
          marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin to account for BottomNavigation
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.navButton, 
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            currentPage === 1 && { opacity: 0.5 }
          ]}
          onPress={handlePrevious}
          disabled={currentPage === 1 || resetting || submitting}
        >
          <Feather name="arrow-left" size={16} color={currentPage === 1 ? theme.tertiaryText : theme.secondaryText} />
          <Text style={[
            styles.navButtonText, 
            { color: currentPage === 1 ? theme.tertiaryText : theme.secondaryText }
          ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.secondaryButton }]}
          onPress={() => {
            showAlert('Success', 'Page saved successfully', 'success');
          }}
          disabled={resetting || submitting}
        >
          <Feather name="save" size={16} color="#ffffff" />
          <Text style={[styles.saveButtonText, { color: '#ffffff' }]}>Save</Text>
        </TouchableOpacity>

         <TouchableOpacity
           style={[
             styles.resetButton, 
             { backgroundColor: resetting ? '#ccc' : '#ef4444' }
           ]}
           onPress={async () => {
             console.log('🔄 Reset button onPress triggered!', { resetting, opportunityId });
             if (!resetting) {
               await resetForm();
             }
           }}
           disabled={resetting || submitting}
         >
          <Feather name="refresh-cw" size={16} color="#ffffff" />
          <Text style={[styles.resetButtonText, { color: '#ffffff' }]}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton, 
            styles.nextButton, 
            { backgroundColor: theme.primaryButton },
            (loading || nextButtonLoading) && { opacity: 0.7 }
          ]}
          onPress={handleNext}
          disabled={submitting || resetting || nextButtonLoading}
        >
          {nextButtonLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={[styles.navButtonText, { color: '#ffffff' }]}>
                {currentPage === totalPages ? 'Submitting...' : 'Loading...'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.navButtonText, { color: '#ffffff' }]}>
                {submitting ? 'Submitting...' : (currentPage === totalPages ? 'Submit' : 'Next')}
              </Text>
              <Feather 
                name={currentPage === totalPages ? "check" : "arrow-right"} 
                size={16} 
                color="#ffffff" 
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal (like DynamicInputsScreen) */}
      <Modal
        visible={showDropdownModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDropdownModal(false);
          setOpenDropdown(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
              Select {openDropdown || 'Option'}
            </Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {openDropdown && (() => {
                // Get options based on the open dropdown
                let options: string[] = [];
                let currentValue = '';
                
                if (openDropdown === '🏠 Home Owners Available') {
                  options = ['Yes, please skip to the next question', 'No, rebook appointment'];
                  currentValue = formData.page1.homeOwnersAvailable === HomeOwnerAvailability.YES_SKIP_NEXT 
                    ? 'Yes, please skip to the next question'
                    : formData.page1.homeOwnersAvailable === HomeOwnerAvailability.NO_REBOOK_APPOINTMENT
                    ? 'No, rebook appointment'
                    : '';
                } else if (openDropdown === 'Appointment will take up to 1hr 30mins') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page1.appointmentDurationConfirmed || '';
                } else if (openDropdown === 'Property') {
                  options = ['House', 'Flat', 'Bungalow', 'Maisonette', 'Other'];
                  currentValue = formData.page3.property || '';
                } else if (openDropdown === 'Type of property') {
                  options = ['Detached', 'Semi-detached', 'Terraced', 'End of terrace', 'Other'];
                  currentValue = formData.page3.propertyType || '';
                } else if (openDropdown === 'How many Bedrooms') {
                  options = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
                  currentValue = formData.page3.bedrooms || '';
                } else if (openDropdown === 'How Long have you lived in the property') {
                  options = ['Less than one year', '1-5 years', '10-20 years', '20+ years'];
                  currentValue = formData.page3.lengthOfStay || '';
                } else if (openDropdown === 'Any plans on moving in the next 2 years') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page3.movingPlans || '';
                } else if (openDropdown === 'How Many Occupants live in the property') {
                  options = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
                  currentValue = formData.page3.occupants || '';
                } else if (openDropdown === 'Are there any new occupants now or in the near future') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page3.occupantsChangingSoon || '';
                } else if (openDropdown === 'Any planned extensions') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page3.extensionsPlanned || '';
                } else if (openDropdown === 'Any roof changes or alterations planned') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page3.roofChangesAlterations || '';
                } else if (openDropdown === 'Anything that may affect panels being installed') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page3.panelInstallationIssues || '';
                } else if (openDropdown === 'Heating Type') {
                  options = ['Gas', 'Electric', 'Oil', 'Heat Pump', 'Other'];
                  currentValue = formData.page4.heatingType || '';
                } else if (openDropdown === 'Do you have any of the following') {
                  options = ['Hot Water Tank', 'Underfloor Heating', 'Swimming Pool', 'None of the above'];
                  currentValue = formData.page4.additionalFeatures || '';
                } else if (openDropdown === 'Do you have a pre-paid meter') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page4.prepaidMeter || '';
                } else if (openDropdown === 'What phase meter is the property supplied by') {
                  options = ['Single Phase', '3 Phase'];
                  currentValue = formData.page4.phaseMeter || '';
                } else if (openDropdown === 'Do you have an energy bill') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page4.hasEnergyBill || '';
                } else if (openDropdown === 'What is the EPC rating of your home') {
                  options = ['EPC Rating A', 'EPC Rating B', 'EPC Rating C', 'EPC Rating D', 'EPC Rating E', 'EPC Rating F', 'EPC Rating G'];
                  currentValue = formData.page5.epcRating ? `EPC Rating ${formData.page5.epcRating}` : '';
                } else if (openDropdown === 'Have you been offered solar funding before') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page5.previousSolarFunding || '';
                } else if (openDropdown === 'Do you have any of the following financial issues') {
                  options = ["CCJ's", 'Default', 'Bankruptcy', 'No'];
                  currentValue = formData.page6.financialIssues || '';
                } else if (openDropdown === 'What is your credit rating') {
                  options = ['Very good', 'Good', 'Bad', 'Very bad', 'No'];
                  currentValue = formData.page6.creditRating || '';
                } else if (openDropdown === 'Are you available for installation within 6 weeks if eligible') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page6.installationAvailability || '';
                } else if (openDropdown === 'Type of roof tile') {
                  options = ['Concrete', 'Slate', 'Rosemary', 'Flat roof', 'Pantile', 'Other'];
                  currentValue = formData.page7.roofTileType || '';
                } else if (openDropdown === 'Does the property have solar/ Battery storage') {
                  options = ['Solar', 'Battery', 'Both', 'N/A'];
                  currentValue = formData.page7.solarBatteryStorage || '';
                } else if (openDropdown === 'EV charger required') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page8?.evChargerRequired || '';
                } else if (openDropdown === 'Does the property require optimisers') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page8?.optimisersRequired || '';
                } else if (openDropdown === 'Does scaffolding have to go through the house') {
                  options = ['Yes', 'No'];
                  currentValue = formData.page8?.scaffoldingThroughHouse || '';
                }
                
                return options.map((option, index) => (
                  <TouchableOpacity
                    key={`${openDropdown}-${option}-${index}`}
                    style={[
                      styles.modalOption,
                      { 
                        borderBottomColor: theme.cardBorder,
                        backgroundColor: currentValue === option ? theme.primaryButton + '20' : 'transparent'
                      }
                    ]}
                    onPress={() => {
                      if (openDropdown === '🏠 Home Owners Available') {
                        const value = option === 'Yes, please skip to the next question' 
                          ? HomeOwnerAvailability.YES_SKIP_NEXT 
                          : HomeOwnerAvailability.NO_REBOOK_APPOINTMENT;
                        updateFormData('page1', { homeOwnersAvailable: value });
                      } else if (openDropdown === 'Appointment will take up to 1hr 30mins') {
                        updateFormData('page1', { appointmentDurationConfirmed: option });
                      } else if (openDropdown === 'Property') {
                        updateFormData('page3', { property: option });
                      } else if (openDropdown === 'Type of property') {
                        updateFormData('page3', { propertyType: option });
                      } else if (openDropdown === 'How many Bedrooms') {
                        updateFormData('page3', { bedrooms: option });
                      } else if (openDropdown === 'How Long have you lived in the property') {
                        updateFormData('page3', { lengthOfStay: option });
                      } else if (openDropdown === 'Any plans on moving in the next 2 years') {
                        updateFormData('page3', { movingPlans: option });
                      } else if (openDropdown === 'How Many Occupants live in the property') {
                        updateFormData('page3', { occupants: option });
                      } else if (openDropdown === 'Are there any new occupants now or in the near future') {
                        updateFormData('page3', { occupantsChangingSoon: option });
                      } else if (openDropdown === 'Any planned extensions') {
                        updateFormData('page3', { extensionsPlanned: option });
                      } else if (openDropdown === 'Any roof changes or alterations planned') {
                        updateFormData('page3', { roofChangesAlterations: option });
                      } else if (openDropdown === 'Anything that may affect panels being installed') {
                        updateFormData('page3', { panelInstallationIssues: option });
                      } else if (openDropdown === 'Heating Type') {
                        updateFormData('page4', { heatingType: option });
                      } else if (openDropdown === 'Do you have any of the following') {
                        updateFormData('page4', { additionalFeatures: option });
                      } else if (openDropdown === 'Do you have a pre-paid meter') {
                        updateFormData('page4', { prepaidMeter: option });
                      } else if (openDropdown === 'What phase meter is the property supplied by') {
                        updateFormData('page4', { phaseMeter: option });
                      } else if (openDropdown === 'Do you have an energy bill') {
                        updateFormData('page4', { hasEnergyBill: option });
                      } else if (openDropdown === 'What is the EPC rating of your home') {
                        // Extract the rating letter from "EPC Rating A" format
                        const rating = option.replace('EPC Rating ', '');
                        updateFormData('page5', { epcRating: rating });
                      } else if (openDropdown === 'Have you been offered solar funding before') {
                        updateFormData('page5', { previousSolarFunding: option });
                      } else if (openDropdown === 'Do you have any of the following financial issues') {
                        updateFormData('page6', { financialIssues: option });
                      } else if (openDropdown === 'What is your credit rating') {
                        updateFormData('page6', { creditRating: option });
                      } else if (openDropdown === 'Are you available for installation within 6 weeks if eligible') {
                        updateFormData('page6', { installationAvailability: option });
                      } else if (openDropdown === 'Type of roof tile') {
                        updateFormData('page7', { roofTileType: option });
                      } else if (openDropdown === 'Does the property have solar/ Battery storage') {
                        updateFormData('page7', { solarBatteryStorage: option });
                      } else if (openDropdown === 'EV charger required') {
                        updateFormData('page8', { evChargerRequired: option });
                      } else if (openDropdown === 'Does the property require optimisers') {
                        updateFormData('page8', { optimisersRequired: option });
                      } else if (openDropdown === 'Does scaffolding have to go through the house') {
                        updateFormData('page8', { scaffoldingThroughHouse: option });
                      }
                      setShowDropdownModal(false);
                      setOpenDropdown(null);
                    }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      { 
                        color: currentValue === option ? theme.primaryButton : theme.primaryText,
                        fontWeight: currentValue === option ? '600' : '400'
                      }
                    ]}>
                      {option}
                    </Text>
                    {currentValue === option && (
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
              }}
            >
              <Text style={[styles.modalCancelText, { color: theme.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Options Modal for Web */}
      {showImageOptions && (
        <Modal
          visible={showImageOptions}
          transparent={true}
          animationType="fade"
          onRequestClose={handleImageOptionsClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.imageOptionsModal}>
              <Text style={styles.imageOptionsTitle}>Select Image Source</Text>
              <Text style={styles.imageOptionsSubtitle}>Choose how you want to add images</Text>
              
              <TouchableOpacity
                style={styles.imageOptionButton}
                onPress={() => handleImageOptionSelect('camera')}
              >
                <Ionicons name="camera" size={24} color="#007AFF" />
                <Text style={styles.imageOptionText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageOptionButton}
                onPress={() => handleImageOptionSelect('library')}
              >
                <Ionicons name="images" size={24} color="#007AFF" />
                <Text style={styles.imageOptionText}>Photo Library</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageOptionButton}
                onPress={() => handleImageOptionSelect('files')}
              >
                <Ionicons name="folder" size={24} color="#007AFF" />
                <Text style={styles.imageOptionText}>Files</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.imageOptionCancelButton}
                onPress={handleImageOptionsClose}
              >
                <Text style={styles.imageOptionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Web Camera Component */}
      {showWebCamera && (
        <WebCamera
          onCapture={handleWebCameraCapture}
          onClose={handleWebCameraClose}
        />
      )}

      {/* Quick Fill Confirmation Modal */}
      {showQuickFillConfirm && (
        <Modal
          visible={showQuickFillConfirm}
          transparent={true}
          animationType="fade"
          onRequestClose={handleQuickFillCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                Quick Fill Complete Survey
              </Text>
              <Text style={[styles.modalMessage, { color: theme.secondaryText }]}>
                This will take one photo and upload it 2 times to all 20 image fields, plus fill all form fields with sample data across all pages in the survey. Continue?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.secondaryButton }]}
                  onPress={handleQuickFillCancel}
                >
                  <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.primaryButton }]}
                  onPress={handleQuickFillConfirm}
                >
                  <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Validation Popup */}
      <ValidationPopup
        visible={showValidationPopup}
        missingFields={missingFields}
        onClose={handleCloseValidationPopup}
        onGoToField={handleGoToField}
      />

      {/* Custom Alert */}
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        type={customAlert.type}
        onClose={hideCustomAlert}
        buttons={customAlert.buttons}
      />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

// Modern Styles for Enhanced UI/UX
const modernStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  inputIconContainer: {
    marginRight: 12,
    width: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  fileUploadWrapper: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    backgroundColor: 'transparent', // Will be overridden by theme.inputBackground
  },
  fileUploadContent: {
    alignItems: 'center',
  },
  fileUploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  fileUploadSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  uploadedFilesContainer: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  uploadedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  uploadedFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  uploadedFileName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  uploadedFileSize: {
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 8,
  },
  removeFileButton: {
    padding: 4,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.8,
    lineHeight: 22,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingHorizontal: 4,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageCount: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  warningIcon: {
    marginLeft: 4,
  },
  fileUploadHint: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.08, // Reduced opacity for better dark mode visibility
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  loadingSubText: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '400',
    opacity: 0.7,
  },
  // Modern Header Styles
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
  
  // Progress Section
  progressSection: {
    marginBottom: 32,
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra spacing for web
      minHeight: 60, // Ensure progress section has minimum height
    }),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  
  workflowProgress: {
    marginTop: 16,
  },
  workflowProgressText: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  workflowSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workflowStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  workflowStepActive: {
  },
  workflowStepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 16,
  },

  contentContainer: {
    paddingBottom: 24, // Add some padding at the bottom for the navigation buttons
  },
  pageContainer: {
    padding: 24,
    ...(Platform.OS === 'web' && {
      paddingBottom: 40, // Extra padding for web
      minHeight: 200, // Ensure page containers have minimum height
    }),
  },
  pageHeader: {
    marginBottom: 30,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  pageStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  pageStatusItem: {
    alignItems: 'center',
    gap: 4,
  },
  pageStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pageStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickAutoFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAutoFillButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  section: {
    marginBottom: 32,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 40, // Extra spacing for web
      minHeight: 120, // Ensure sections have minimum height
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  autoFillCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      marginBottom: 32,
      minHeight: 100,
    }),
  },
  autoFillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoFillTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: -0.2,
  },
  autoFillDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333333', // Default color for light mode, will be overridden by theme colors
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputWithIconText: {
    flex: 1,
    fontSize: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  radioOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  radioSelected: {
    shadowOpacity: 0.2,
  },
  radioInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '500',
  },
  radioTextSelected: {
    fontWeight: '600',
  },
  checkboxGroup: {
    gap: 12,
  },
  checkboxOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  checkboxSelected: {
    shadowOpacity: 0.2,
  },
  checkboxInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  checkboxIcon: {
    fontSize: 18,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareSelected: {
  },
  checkboxCheck: {
    fontSize: 16,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxTextSelected: {
    fontWeight: '600',
  },
  selectedSummary: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    ...(Platform.OS === 'web' && {
      paddingBottom: 40, // Extra padding for web
      minHeight: 80, // Ensure navigation has minimum height
      marginBottom: 65, // Add margin for BottomNavigation on web
    }),
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  navButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
  },
  nextButton: {
    shadowOpacity: 0.3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  singleColumn: {
    marginBottom: 24,
  },
  column: {
    flex: 1,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 1000,
    marginBottom: 20, // Add space below the dropdown
  },
  dropdownOptionsOverlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 2,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  globalDropdownOverlay: {
    position: 'absolute',
    top: 200, // Adjust this value based on your header height
    left: 20,
    right: 20,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownActive: {
    shadowOpacity: 0.2,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownPlaceholder: {
  },
  dropdownArrow: {
    fontSize: 16,
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 2,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
    maxHeight: 200, // Limit height to prevent overflow
  },
  dropdownOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  dropdownOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownOptionIcon: {
    marginRight: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  formGroup: {
    marginBottom: 24,
  },
  helperText: {
    fontSize: 12,
    marginTop: 8,
  },
  fileUpload: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  fileUploadContent: {
    alignItems: 'center',
  },
  fileUploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  fileUploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  fileUploadSubtitle: {
    fontSize: 12,
  },
  uploadedFilesContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  uploadedFilesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  uploadedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  uploadedFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  uploadedFileName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  uploadedFileSize: {
    fontSize: 12,
  },
  removeFileButton: {
    padding: 4,
  },
  removeFileButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 12,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  modalContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  debugSection: {
    marginTop: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    marginBottom: 4,
  },
  currentUserCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  currentUserText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentUserSubtext: {
    fontSize: 12,
  },
  
  // Validation Popup Styles
  validationPopup: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  validationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  validationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  missingFieldsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  missingFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  missingFieldText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  validationButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  validationButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  validationButtonSecondary: {
    borderWidth: 1,
  },
  validationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Enhanced validation popup styles
  validationPageSection: {
    marginBottom: 16,
  },
  validationPageTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  fieldTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fieldDetails: {
    flex: 1,
  },
  fieldTypeText: {
    fontSize: 12,
    marginTop: 2,
  },
  
  // Error Text Styles
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
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
  
  // Image Options Modal Styles
  imageOptionsModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  imageOptionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  imageOptionsSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  imageOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  imageOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 12,
  },
  imageOptionCancelButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    marginTop: 8,
  },
  imageOptionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  
  // Date/Time Picker Modal Styles
  dateTimeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  dateTimeText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  dateTimeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dateTimeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  confirmButton: {
    backgroundColor: '#059669',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    lineHeight: 22,
  },
  
  // Rebooking Modal Styles
  calendarSelector: {
    marginTop: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  calendarOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    minWidth: 110,
    maxWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  calendarOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeSlot: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    width: '22%',
    minWidth: 75,
    maxWidth: 95,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  rebookingLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  rebookingLoadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
}); 
