import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { presentationApi } from '../utils/api';
import { API_BASE_URL } from '../utils/env';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
}

interface SheetInfo {
  fileName: string;
  filePath: string;
  size: number;
  lastModified: string;
  calculatorType: 'off-peak' | 'flux' | 'epvs';
  version?: number;
}

interface ExtractedData {
  customerName: string;
  date: string;
  postcode: string;
  p_w: string;
  p_q: number;
  i_s: string;
  b_s: string;
  t_y_s_o: string;
  t_y_s_g: string;
}

type Step = 'sheets' | 'extracting' | 'generating';

export default function PresentationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, opportunity: passedOpportunity } = route.params as RouteParams;
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();

  const [step, setStep] = useState<Step>('sheets');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);

  // Prefer trailing -vN.ext so EPVS-v4.4-...-v1.xlsm reads as V1, not V4
  const extractVersionFromFilename = (fileName: string): number => {
    const trailing = fileName.match(/-v(\d+)\.(xlsm|xlsx|xls)$/i);
    if (trailing) {
      return parseInt(trailing[1], 10);
    }
    const matches = [...fileName.matchAll(/-v(\d+)/gi)];
    if (matches.length > 0) {
      return parseInt(matches[matches.length - 1][1], 10);
    }
    return 1;
  };

  // Helper function to generate version name based on actual version
  const getVersionName = (sheet: SheetInfo) => {
    const baseName = sheet.calculatorType === 'flux' || sheet.calculatorType === 'epvs' 
      ? 'Flux Proposal' 
      : 'Off Peak Proposal';
    const version = sheet.version || extractVersionFromFilename(sheet.fileName);
    console.log(`🔍 getVersionName for ${sheet.fileName}:`, {
      calculatorType: sheet.calculatorType,
      version: sheet.version,
      extractedVersion: extractVersionFromFilename(sheet.fileName),
      finalVersion: version,
      baseName,
      finalName: `${baseName} V${version}`
    });
    return `${baseName} V${version}`;
  };

  // Group sheets by calculator type
  const groupedSheets = availableSheets.reduce((groups, sheet) => {
    const type = sheet.calculatorType === 'flux' || sheet.calculatorType === 'epvs' ? 'flux' : 'off-peak';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(sheet);
    return groups;
  }, {} as Record<string, SheetInfo[]>);

  // Sort sheets within each group by version
  Object.keys(groupedSheets).forEach(type => {
    groupedSheets[type].sort((a, b) => {
      const versionA = a.version || extractVersionFromFilename(a.fileName);
      const versionB = b.version || extractVersionFromFilename(b.fileName);
      return versionA - versionB;
    });
  });
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableSheets();
  }, [opportunityId]);

  const loadAvailableSheets = async () => {
    try {
      setLoading(true);
      setStep('sheets');
      
      // Get available Excel files for this opportunity
      const { api } = await import('../utils/api');
      const sheetsResponse = await api.post('/opportunity-workflow/get-opportunity-sheets', {
        opportunityId,
      });
      
      console.log('📡 API Response:', sheetsResponse);
      
      if (sheetsResponse.success) {
        // The API utility wraps the response, so we need to access response.data.data
        const responseData = sheetsResponse.data as any;
        const actualData = responseData?.data || responseData;
        const sheets = Array.isArray(actualData) ? actualData : [];
        console.log('📋 Available sheets:', sheets);
        console.log('📋 Sheet details with versions:', sheets.map(sheet => ({
          fileName: sheet.fileName,
          calculatorType: sheet.calculatorType,
          version: sheet.version,
          hasVersion: 'version' in sheet
        })));
        setAvailableSheets(sheets as SheetInfo[]);
      } else {
        throw new Error('Failed to load available sheets');
      }
    } catch (error) {
      console.error('Error loading sheets:', error);
      setExtractionError('Failed to load available Excel files');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelect = async (sheet: SheetInfo) => {
    setSelectedSheet(sheet);
    setExtractionError(null);
    
    // Auto-extract variables and generate presentation
    try {
      setStep('extracting');
      setExtractionError(null);

      // Determine calculator type from the selected sheet
      const calculatorType = sheet.calculatorType;
      console.log(`🔍 Selected sheet details:`, {
        fileName: sheet.fileName,
        calculatorType: sheet.calculatorType,
        version: sheet.version,
        size: sheet.size,
        lastModified: sheet.lastModified
      });
      console.log(`🔍 Auto-extracting variables from ${sheet.fileName} (${calculatorType})`);
      
      const result = await presentationApi.extractVariables(opportunityId, calculatorType, sheet.fileName);
      
      if (result.success) {
        setExtractedData(result.data);
        console.log('✅ Variables extracted successfully:', result.data);
        
        // Auto-generate proposal after extraction - no preview step
        console.log('🎯 About to call generatePresentationWithData with:', result.data);
        setStep('generating');
        try {
          await generatePresentationWithData(result.data, sheet);
          console.log('🎯 generatePresentationWithData completed');
        } catch (genError) {
          console.error('🎯 Error in generatePresentationWithData:', genError);
          setGenerating(false);
          setStep('sheets');
          Alert.alert('Error', 'Failed to generate proposal. Please try again.');
        }
      } else {
        throw new Error(result.error || 'Failed to extract variables');
      }
    } catch (error) {
      console.error('Auto-generation error:', error);
      setExtractionError('Failed to extract data from Excel file');
      setStep('sheets');
    }
  };


  const generatePresentationWithData = async (data: ExtractedData, sheet?: SheetInfo) => {
    console.log('🎯 generatePresentationWithData called with data:', data);
    console.log('🎯 generatePresentationWithData called with sheet:', sheet);
    
    const currentSheet = sheet || selectedSheet;
    
    if (!currentSheet) {
      console.log('❌ No selected sheet');
      Alert.alert('Error', 'Please select a sheet first');
      return;
    }

    if (!data) {
      console.log('❌ No data provided');
      Alert.alert('Error', 'No data extracted from Excel file');
      return;
    }

    try {
      console.log('🎯 Starting proposal generation...');
      setStep('generating');
      setGenerating(true);

      console.log('🎯 Starting proposal generation with data:', {
        opportunityId,
        calculatorType: currentSheet.calculatorType,
        customerName: data.customerName,
        date: data.date,
        postcode: data.postcode,
        solarData: {
          p_w: data.p_w,
          p_q: data.p_q,
          i_s: data.i_s,
          b_s: data.b_s,
          t_y_s_o: data.t_y_s_o,
          t_y_s_g: data.t_y_s_g
        }
      });

      console.log('🎯 Calling presentationApi.generateVideoPresentation...');
      const result = await presentationApi.generateVideoPresentation({
        opportunityId,
        calculatorType: currentSheet.calculatorType,
        customerName: data.customerName,
        date: data.date,
        postcode: data.postcode,
        solarData: {
          p_w: data.p_w,
          p_q: data.p_q,
          i_s: data.i_s,
          b_s: data.b_s,
          t_y_s_o: data.t_y_s_o,
          t_y_s_g: data.t_y_s_g
        }
      });
      console.log('🎯 presentationApi.generateVideoPresentation result:', result);
      console.log('🎯 Result success:', result.success);
      console.log('🎯 Result data:', result.data);

      if (result.success && result.data) {
        console.log('🎯 Video presentation generated successfully:', result.data);
        
        // Stop generating state
        setGenerating(false);
        
        // Navigate directly to video viewer, including postcode from extracted data
        navigation.navigate('VideoPresentation', {
          opportunityId,
          videoData: {
            ...result.data,
            postcode: data.postcode // Include postcode for approval code
          }
        });
      } else {
        console.log('🎯 Video presentation generation failed:', result.error);
        setGenerating(false);
        setStep('sheets'); // Go back to sheets step
        Alert.alert('Error', result.error || 'Failed to generate video presentation');
      }
    } catch (error) {
      console.error('Video presentation generation error:', error);
      setGenerating(false);
      setStep('sheets'); // Go back to sheets step
      Alert.alert('Error', 'Failed to generate video presentation. Please try again.');
    }
  };


  const downloadFile = async (filename: string, type: 'pptx') => {
    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);
      
      // Get the download URL from the API
      const downloadUrl = await presentationApi.downloadPresentation(filename);
      
      // Fix the URL by removing double slashes and ensuring proper format
      let fullDownloadUrl = downloadUrl;
      
      // First, trim any leading/trailing whitespace
      fullDownloadUrl = fullDownloadUrl.trim();
      
      if (!fullDownloadUrl.startsWith('http')) {
        // Remove leading slash if present to avoid double slashes
        fullDownloadUrl = fullDownloadUrl.startsWith('/') ? fullDownloadUrl.substring(1) : fullDownloadUrl;
        fullDownloadUrl = `/api/${fullDownloadUrl}`;
      }
      
      // Additional fix: Remove any double slashes that might exist in the URL
      fullDownloadUrl = fullDownloadUrl.replace(/\/+/g, '/').replace(':/', '://');
      
      const downloadFilename = `${filename}`;
      
      console.log('📥 Downloading Presentation from:', fullDownloadUrl);
      
      if (Platform.OS === 'web') {
        // For web, fetch with authentication headers first, then create blob download
        const { authApi } = await import('../utils/api');
        const token = await authApi.getAccessToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        setDownloadProgress(25);
        
        const response = await fetch(fullDownloadUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        setDownloadProgress(50);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Presentation file not found. Please try generating the proposal again.');
          } else if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
        }
        
        // Check if we got a valid file
        const contentType = response.headers.get('content-type');
        console.log('📥 Response content-type:', contentType);
        
        // More flexible content-type validation for presentations
        const isValidFileType = contentType && (
          contentType.includes('presentation') || 
          contentType.includes('application/vnd.openxmlformats') ||
          contentType.includes('application/octet-stream') ||
          contentType.includes('application/zip')
        );
        
        if (!isValidFileType) {
          console.error('📥 Invalid content-type received:', contentType);
          throw new Error(`Invalid file type received from server. Content-Type: ${contentType}`);
        }
        
        setDownloadProgress(75);
        
        const blob = await response.blob();
        
        // Verify blob size
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty. Please try again.');
        }
        
        setDownloadProgress(90);
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setDownloadProgress(100);
        setDownloaded(true);
        Alert.alert('Download Complete!', 'Presentation has been downloaded successfully.');
      } else {
        // For mobile, use FileSystem with authentication
        const { authApi } = await import('../utils/api');
        const token = await authApi.getAccessToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const localPath = `${(FileSystem as any).cacheDirectory}${downloadFilename}`;
        
        console.log('📁 Saving to:', localPath);
        
        // Download the file with authentication headers
        const downloadResult = await FileSystem.downloadAsync(
          fullDownloadUrl, 
          localPath,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );
        
        if (downloadResult.status === 200) {
          setLocalFilePath(downloadResult.uri);
          setDownloaded(true);
          
          Alert.alert(
            'Download Complete!',
            'Presentation has been saved to your device.',
            [
              { text: 'Open in Browser', onPress: () => Linking.openURL(downloadUrl) },
              { text: 'OK' }
            ]
          );
        } else if (downloadResult.status === 404) {
          throw new Error('Presentation file not found. Please try generating the proposal again.');
        } else if (downloadResult.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else {
          throw new Error(`Download failed with status: ${downloadResult.status}`);
        }
      }
    } catch (error) {
      console.error('📥 Presentation download error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setDownloadError(errorMessage);
      setDownloadProgress(0);
      Alert.alert('Download Error', `Failed to download Presentation: ${errorMessage}`);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const viewPresentation = async (filename: string) => {
    try {
      const viewUrl = `${API_BASE_URL}/presentation/view/${filename}`;
      const supported = await Linking.canOpenURL(viewUrl);
      
      if (supported) {
        await Linking.openURL(viewUrl);
      } else {
        Alert.alert('Error', 'Cannot view proposal in browser');
      }
    } catch (error) {
      console.error('View error:', error);
        Alert.alert('Error', 'Failed to open proposal');
    }
  };


  const goBackToSheets = () => {
    setStep('sheets');
    setSelectedSheet(null);
    setExtractedData(null);
    setExtractionError(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading available Excel files...
          </Text>
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
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => {
                // Navigate directly to SolarWorkflowScreen instead of going back
                (navigation as any).navigate('SolarWorkflow', { 
                  opportunityId: opportunityId,
                  opportunity: passedOpportunity
                });
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                {step === 'sheets' ? 'Select Excel File' : 
                 step === 'extracting' ? 'Extracting Data' : 'Generate Proposal'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {step === 'sheets' ? 'Choose which calculator file to use' :
                 step === 'extracting' ? 'Reading data from Excel file...' : 'Creating your proposal'}
              </Text>
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
      </View>

      <ScrollView 
        style={[
          styles.scrollView, 
          { backgroundColor: 'transparent' }
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
        {/* Step 1: File Selection */}
        {step === 'sheets' && (
          <>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
                <Feather name="file-text" size={32} color={theme.primaryButton} />
              </View>
              <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Please select the calculator for the proposal</Text>

            </View>

            {/* Available Files */}
            <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Available Files</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
                  Select the Excel file you want to use
                </Text>
              </View>

              {availableSheets.length === 0 ? (
                <View style={styles.noFilesContainer}>
                  <Feather name="file" size={48} color={theme.secondaryText} />
                  <Text style={[styles.noFilesText, { color: theme.secondaryText }]}>
                    No Excel files found for this opportunity
                  </Text>
                  <Text style={[styles.noFilesSubtext, { color: theme.secondaryText }]}>
                    Make sure you've completed the calculator step first
                  </Text>
                </View>
              ) : (
                Object.entries(groupedSheets).map(([type, sheets]) => (
                  <View key={type} style={styles.calculatorGroup}>
                    <View style={styles.groupHeader}>
                      <View style={[
                        styles.groupIcon,
                        { 
                          backgroundColor: type === 'flux' ? '#10b981' : '#3b82f6',
                          borderColor: type === 'flux' ? '#059669' : '#2563eb'
                        }
                      ]}>
                        <Feather 
                          name={type === 'flux' ? 'zap' : 'settings'} 
                          size={18} 
                          color="#ffffff" 
                        />
                      </View>
                      <Text style={[styles.groupTitle, { color: theme.primaryText }]}>
                        {type === 'flux' ? 'Flux Calculator Files' : 'Off Peak Calculator Files'}
                      </Text>
                      <Text style={[styles.groupCount, { color: theme.secondaryText }]}>
                        {sheets.length} file{sheets.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    
                    {sheets.map((sheet, index) => {
                      const isEPVS = sheet.calculatorType === 'flux' || sheet.calculatorType === 'epvs';
                      const isSelected = selectedSheet?.fileName === sheet.fileName;
                      const versionName = getVersionName(sheet);
                      
                      return (
                        <TouchableOpacity
                          key={`${type}-${index}`}
                          style={[
                            styles.sheetOption,
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
                          onPress={() => handleSheetSelect(sheet)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.sheetInfo}>
                            <View style={styles.sheetHeader}>
                              <View style={[
                                styles.calculatorTypeBadge,
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
                              <View style={styles.sheetNameContainer}>
                                <Text style={[styles.sheetName, { color: theme.primaryText }]}>
                                  {versionName}
                                </Text>
                                <Text style={[
                                  styles.calculatorTypeLabel,
                                  { color: isEPVS ? '#059669' : '#2563eb' }
                                ]}>
                                  {isEPVS ? 'Flux Calculator' : 'Off Peak Calculator'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.sheetDetails}>
                              <Text style={[styles.sheetSize, { color: theme.secondaryText }]}>
                                {(sheet.size / 1024 / 1024).toFixed(1)} MB
                              </Text>
                              <Text style={[styles.sheetDate, { color: theme.secondaryText }]}>
                                {new Date(sheet.lastModified).toLocaleString()}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <Feather name="check-circle" size={24} color={theme.primaryButton} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}
            </View>

          </>
        )}

        {/* Step 2: Data Extraction */}
        {step === 'extracting' && (
          <View style={styles.extractingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.extractingText, { color: theme.primaryText }]}>
              Extracting data from Excel file...
            </Text>
            <Text style={[styles.extractingSubtext, { color: theme.secondaryText }]}>
              Please wait while we read the customer details and system specifications
            </Text>
          </View>
        )}


        {/* Step 3: Generation */}
        {step === 'generating' && (
          <View style={styles.extractingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.extractingText, { color: theme.primaryText }]}>
              Generating your proposal...
            </Text>

          </View>
        )}

        {/* Error State */}
        {extractionError && (
          <View style={[styles.errorCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <View style={styles.errorHeader}>
              <Feather name="alert-circle" size={20} color="#dc2626" />
              <Text style={[styles.errorTitle, { color: '#dc2626' }]}>Extraction Failed</Text>
            </View>
            <Text style={[styles.errorText, { color: '#991b1b' }]}>
              {extractionError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#dc2626' }]}
              onPress={goBackToSheets}
            >
              <Feather name="refresh-cw" size={16} color="#ffffff" />
              <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

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
  },
  
  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
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
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
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
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: width < 768 ? 18 : 20,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
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

  // Sheet Selection Styles
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
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
    marginBottom: 12,
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
    marginBottom: 4,
    lineHeight: 20,
  },
  calculatorTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sheetSize: {
    fontSize: 14,
    fontWeight: '500',
  },
  sheetDate: {
    fontSize: 14,
    fontWeight: '500',
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
  
  // Continue Button
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 18 : 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Extracting Container
  extractingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  extractingText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  extractingSubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  
  // Data Display Styles
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  
  // Generate Button
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: width < 768 ? 18 : 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  
  // Selected File Info
  selectedFileInfo: {
    marginTop: 8,
  },
  selectedFileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  selectedFileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedFileDetails: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  selectedFileType: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Change File Button
  changeFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  changeFileText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Error Card
  errorCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
