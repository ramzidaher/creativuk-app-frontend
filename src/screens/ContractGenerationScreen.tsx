import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import CustomAlert from '../components/CustomAlert';
import ExcelSheetPicker from '../components/ExcelSheetPicker';
import { useTheme } from '../context/ThemeContext';
import { ExcelSheetInfo, sortSheetsByVersion } from '../utils/excelSheetVersion';
import { buildApiUrl } from '../utils/api';

interface RouteParams {
  opportunityId: string;
}

type SheetInfo = ExcelSheetInfo & {
  filePath: string;
  size?: number;
  lastModified: string;
};

/** Backend may return HTTP 200 with success:false and no pdfUrl — avoid .startsWith on undefined. */
function resolveContractPdfFromApiResponse(
  pdfData: Record<string, unknown> | null | undefined,
  opportunityId: string,
  isEpvsFamily: boolean,
): { pdfUrl: string | null; pdfPath: string | null; error?: string } {
  if (!pdfData) {
    return { pdfUrl: null, pdfPath: null, error: 'Empty response from server' };
  }
  if (pdfData.success === false) {
    return {
      pdfUrl: null,
      pdfPath: null,
      error: String(pdfData.error || pdfData.message || 'PDF generation failed on the server'),
    };
  }

  const pdfPath = typeof pdfData.pdfPath === 'string' ? pdfData.pdfPath : null;
  let pdfUrl = typeof pdfData.pdfUrl === 'string' ? pdfData.pdfUrl : null;

  if (!pdfUrl) {
    pdfUrl = isEpvsFamily
      ? `/epvs-automation/pdf/${opportunityId}`
      : `/excel-automation/pdf/${opportunityId}`;
  }

  return { pdfUrl, pdfPath };
}

function toAbsolutePdfUrl(relativeOrAbsoluteUrl: string): string {
  if (!relativeOrAbsoluteUrl?.trim()) {
    throw new Error('PDF URL is missing from the server response');
  }
  if (relativeOrAbsoluteUrl.startsWith('http')) {
    return relativeOrAbsoluteUrl;
  }
  if (relativeOrAbsoluteUrl.startsWith('/')) {
    const cleanPath = relativeOrAbsoluteUrl.startsWith('/api/')
      ? relativeOrAbsoluteUrl.substring(5)
      : relativeOrAbsoluteUrl.substring(1);
    return buildApiUrl(cleanPath);
  }
  return buildApiUrl(relativeOrAbsoluteUrl);
}

export default function ContractGenerationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [step, setStep] = useState<'sheets' | 'generating' | 'preview'>('sheets');
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
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

  // Function to download and share PDF on mobile - using same logic as PresentationViewerScreen
  const downloadAndSharePDF = async (pdfUrl: string, opportunityId: string) => {
    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);
      
      // Fix the URL by removing double slashes and ensuring proper format
      let downloadUrl = pdfUrl;
      
      console.log('🔧 DEBUG ContractGeneration: Original pdfUrl:', pdfUrl);
      
      // First, trim any leading/trailing whitespace
      downloadUrl = (downloadUrl || '').trim();

      if (!downloadUrl) {
        throw new Error('Contract PDF URL is missing. Please try generating the contract again.');
      }
      
      if (!downloadUrl.startsWith('http')) {
        // If the URL already starts with /api/, don't add it again
        if (downloadUrl.startsWith('/api/')) {
          // URL already has /api/ prefix, use as is
          console.log('🔧 DEBUG ContractGeneration: URL already has /api/ prefix, using as-is');
          downloadUrl = downloadUrl;
        } else {
          // Remove leading slash if present to avoid double slashes
          console.log('🔧 DEBUG ContractGeneration: URL does not have /api/ prefix, adding it');
          downloadUrl = downloadUrl.startsWith('/') ? downloadUrl.substring(1) : downloadUrl;
          downloadUrl = `/api/${downloadUrl}`;
        }
      }
      
      console.log('🔧 DEBUG ContractGeneration: Final downloadUrl:', downloadUrl);
      
      // Additional fix: Remove any double slashes that might exist in the URL
      downloadUrl = downloadUrl.replace(/\/+/g, '/').replace(':/', '://');
      
      // Convert view URL to download URL
      downloadUrl = downloadUrl.replace('/view/', '/download/');
      
      console.log('📥 Downloading Contract PDF from:', downloadUrl);
      console.log('📥 Current pdfFileName state:', pdfFileName);
      
      if (Platform.OS === 'web') {
        // For web, use public download URL (no authentication required)
        setDownloadProgress(25);
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        setDownloadProgress(50);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Contract PDF file not found. Please try generating the contract again.');
          } else {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
        }
        
        // Check if we got a valid file
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        console.log('📥 Response content-type:', contentType);
        console.log('📥 Response content-disposition:', contentDisposition);
        
        // Priority: Use pdfFileName (from UI/backend response) first, then Content-Disposition, then default
        let downloadFilename = `Contract-${opportunityId}.pdf`;
        
        // First priority: Use the filename from backend response (what's shown in UI)
        if (pdfFileName) {
          downloadFilename = pdfFileName;
          console.log('📥 Using pdfFileName from state:', downloadFilename);
        } else if (contentDisposition) {
          // Second priority: Extract from Content-Disposition header if pdfFileName not available
          // Content-Disposition format: attachment; filename="filename.pdf" or attachment; filename=filename.pdf
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            let extractedFilename = filenameMatch[1].replace(/['"]/g, ''); // Remove quotes
            // Decode URI if needed
            try {
              extractedFilename = decodeURIComponent(extractedFilename);
            } catch (e) {
              console.warn('⚠️ Could not decode filename, using as-is');
            }
            downloadFilename = extractedFilename;
            console.log('📥 Extracted filename from Content-Disposition:', downloadFilename);
          }
        }
        
        console.log('📥 Final download filename:', downloadFilename);
        console.log('📥 pdfFileName state value:', pdfFileName);
        
        // More flexible content-type validation
        const isValidFileType = contentType && (
          contentType.includes('pdf') || 
          contentType.includes('application/octet-stream') ||
          contentType.includes('application/pdf')
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
        Alert.alert('Download Complete!', 'Contract PDF has been downloaded successfully.');
      } else {
        // For mobile, use public download URL (no authentication required)
        console.log('📱 Downloading Contract PDF for mobile...');
        setDownloadProgress(25);
        
        // Use fetch with public URL (no authentication required)
        const fetchPromise = fetch(downloadUrl, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Download timeout after 60 seconds')), 60000);
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
        setDownloadProgress(50);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Contract PDF file not found. Please try generating the contract again.');
          } else {
            throw new Error(`Download failed with status: ${response.status}`);
          }
        }
        
        setDownloadProgress(75);
        const blob = await response.blob();
        console.log('📱 Downloaded blob size:', blob.size);
        
        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('content-disposition');
        let downloadFilename = pdfFileName || `Contract-${opportunityId}.pdf`;
        
        if (contentDisposition) {
          // Content-Disposition format: attachment; filename="filename.pdf" or attachment; filename=filename.pdf
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            let extractedFilename = filenameMatch[1].replace(/['"]/g, ''); // Remove quotes
            // Decode URI if needed
            try {
              extractedFilename = decodeURIComponent(extractedFilename);
            } catch (e) {
              console.warn('⚠️ Could not decode filename, using as-is');
            }
            downloadFilename = extractedFilename;
            console.log('📱 Extracted filename from Content-Disposition:', downloadFilename);
          }
        }
        
        console.log('📱 Final download filename:', downloadFilename);
        
        setDownloadProgress(90);
        setDownloadProgress(100);
        setDownloaded(true);
        
        // For mobile, we need to save the file to a local path
        // Convert blob to base64 and save using FileSystem
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              const localPath = `${FileSystem.documentDirectory}${downloadFilename}`;
              
              await FileSystem.writeAsStringAsync(localPath, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              console.log('📱 File saved to:', localPath);
              setLocalFilePath(localPath);
              
              Alert.alert(
                'Download Complete!',
                'Contract PDF has been saved to your device. What would you like to do?',
                [
                  { 
                    text: 'View PDF', 
                    onPress: () => Linking.openURL(pdfUrl) 
                  },
                  { 
                    text: 'Share File', 
                    onPress: () => Share.share({
                      url: localPath,
                      title: 'Share Contract PDF',
                      message: 'Sharing Contract PDF'
                    })
                  },
                  { text: 'OK' }
                ]
              );
              resolve(localPath);
            } catch (saveError) {
              console.error('📱 Error saving file:', saveError);
              Alert.alert('Error', 'Failed to save file to device');
              reject(saveError);
            }
          };
          reader.onerror = () => {
            console.error('📱 FileReader error');
            reject(new Error('Failed to read file data'));
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('📥 Contract download error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setDownloadError(errorMessage);
      setDownloadProgress(0);
      Alert.alert('Download Error', `Failed to download Contract PDF: ${errorMessage}`);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  useEffect(() => {
    loadAvailableSheets();
    
    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, []);

  // No longer need auto-retry since we're using direct URL
  // The browser will handle loading the PDF directly via iframe/object tag

  const loadAvailableSheets = async () => {
    try {
      setLoadingSheets(true);
      setError(null);

      // Use the API utility which handles authentication automatically
      const { api } = await import('../utils/api');
      
             const response = await api.post('/opportunity-workflow/get-opportunity-sheets', {
         opportunityId,
       });

       console.log('📡 API Response:', response);
       console.log('📡 Response success:', response.success);
       console.log('📡 Response data:', response.data);
       console.log('📡 Response data type:', typeof response.data);
       console.log('📡 Response data is array:', Array.isArray(response.data));

              if (response.success) {
         // The API utility wraps the response, so we need to access response.data.data
         const responseData = response.data as any;
         const actualData = responseData?.data || responseData;
         const sheets = Array.isArray(actualData) ? actualData : [];
         console.log('📋 Available sheets (raw):', sheets);
         
         setAvailableSheets(sortSheetsByVersion(sheets as SheetInfo[]) as SheetInfo[]);
       } else {
        setError('Failed to load available sheets');
      }
    } catch (error) {
      console.error('Error loading sheets:', error);
      setError('Failed to load available sheets');
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleSheetSelect = (sheet: SheetInfo) => {
    console.log('🔍 Sheet selected:', sheet);
    console.log('🔍 Sheet fileName:', sheet.fileName);
    console.log('🔍 Sheet calculatorType:', sheet.calculatorType);
    setSelectedSheet(sheet);
  };

  const validateSurveyImages = async (): Promise<{ isValid: boolean; missingFields: string[] }> => {
    try {
      const { surveyApi } = await import('../utils/api');
      
      // Fetch survey data
      const surveyResponse = await surveyApi.getSurvey(opportunityId);
      if (!surveyResponse.success || !surveyResponse.data) {
        console.error('❌ Failed to fetch survey data:', surveyResponse);
        return { isValid: false, missingFields: ['Unable to fetch survey data'] };
      }

      const surveyData = surveyResponse.data;
      
      // If survey is submitted, approved, or completed, skip validation
      // The backend has already validated everything during submission
      if (surveyData.status === 'SUBMITTED' || surveyData.status === 'APPROVED' || surveyData.status === 'COMPLETED') {
        console.log(`✅ Survey status is ${surveyData.status} - skipping image validation (already validated during submission)`);
        return { isValid: true, missingFields: [] };
      }
      
      console.log('🔍 Survey data structure:', {
        status: surveyData.status,
        hasPage4: !!surveyData.page4,
        hasPage5: !!surveyData.page5,
        rootKeys: Object.keys(surveyData),
        page4Keys: surveyData.page4 ? Object.keys(surveyData.page4) : [],
        page5Keys: surveyData.page5 ? Object.keys(surveyData.page5) : [],
      });
      
      // Also fetch images from the images endpoint
      const imagesResponse = await surveyApi.getSurveyImages(opportunityId);
      const imagesList = imagesResponse.success && Array.isArray(imagesResponse.data) ? imagesResponse.data : [];
      console.log('🔍 Images from images endpoint:', imagesList.length, 'images found');
      
      // Group images by field name
      const imagesByField: { [key: string]: any[] } = {};
      imagesList.forEach((img: any) => {
        const fieldName = img.fieldName || img.field || img.name?.split('_')[0];
        if (fieldName) {
          if (!imagesByField[fieldName]) {
            imagesByField[fieldName] = [];
          }
          imagesByField[fieldName].push(img);
        }
      });
      console.log('🔍 Images grouped by field:', imagesByField);
      
      const requiredImageFieldsConfig: { field: string; minRequired: number }[] = [
        { field: 'energyBill', minRequired: 1 },
        { field: 'frontDoor', minRequired: 1 },
        { field: 'frontProperty', minRequired: 1 },
        { field: 'targetRoofs', minRequired: 1 },
        { field: 'roofAngle', minRequired: 1 },
        { field: 'roofTileCloseup', minRequired: 1 },
        { field: 'internalCeilingPictures', minRequired: 4 },
        { field: 'electricMeter', minRequired: 1 },
        { field: 'fuseBoard', minRequired: 1 },
        { field: 'batteryInverterLocation', minRequired: 1 }
      ];
      const page7Fields = ['roofAngle', 'roofTileCloseup', 'internalCeilingPictures', 'otherBuildings', 'electricMeter', 'garage', 'fuseBoard', 'batteryInverterLocation'];

      const missingFields: string[] = [];
      
      for (const { field, minRequired } of requiredImageFieldsConfig) {
        // Special case: Energy bill images are only required if hasEnergyBill is "Yes"
        if (field === 'energyBill') {
          const pageData = surveyData.page4;
          const hasEnergyBill = pageData?.hasEnergyBill;
          
          console.log(`🔍 Energy Bill check - hasEnergyBill: ${hasEnergyBill}`);
          
          // If hasEnergyBill is "No", skip validation for energy bill images
          if (hasEnergyBill === 'No') {
            console.log(`✅ Skipping energyBill validation (hasEnergyBill is "No")`);
            continue;
          }
        }
        
        // Check multiple possible locations for images
        let fieldFiles: any = null;
        let foundLocation = '';
        
        // 0. First check images endpoint data (most reliable)
        if (imagesByField[field] && imagesByField[field].length > 0) {
          fieldFiles = imagesByField[field];
          foundLocation = 'images.endpoint';
        }
        // 1. Check root level with Files suffix
        else if (surveyData[`${field}Files`]) {
          fieldFiles = surveyData[`${field}Files`];
          foundLocation = 'root';
        }
        // 2. Check page4 for energyBill
        else if (field === 'energyBill' && surveyData.page4?.[`${field}Files`]) {
          fieldFiles = surveyData.page4[`${field}Files`];
          foundLocation = 'page4';
        }
        // 3. Check page7 for page7 image fields
        else if (page7Fields.includes(field) && surveyData.page7?.[`${field}Files`]) {
          fieldFiles = surveyData.page7[`${field}Files`];
          foundLocation = 'page7';
        }
        // 4. Check page5 for other images
        else if (field !== 'energyBill' && surveyData.page5?.[`${field}Files`]) {
          fieldFiles = surveyData.page5[`${field}Files`];
          foundLocation = 'page5';
        }
        // 5. Check if images are stored directly in the field (without Files suffix) - for energyBill
        else if (field === 'energyBill' && Array.isArray(surveyData.page4?.[field])) {
          fieldFiles = surveyData.page4[field];
          foundLocation = 'page4.direct';
        }
        // 6. Check page7 direct field for page7 fields
        else if (page7Fields.includes(field) && Array.isArray(surveyData.page7?.[field])) {
          fieldFiles = surveyData.page7[field];
          foundLocation = 'page7.direct';
        }
        // 7. Check page5 direct field (without Files suffix)
        else if (field !== 'energyBill' && Array.isArray(surveyData.page5?.[field])) {
          fieldFiles = surveyData.page5[field];
          foundLocation = 'page5.direct';
        }
        // 8. Check if images are in a nested images object
        else if (surveyData.images && typeof surveyData.images === 'object') {
          // Check if there's an images object with field-specific arrays
          if (Array.isArray(surveyData.images[field])) {
            fieldFiles = surveyData.images[field];
            foundLocation = 'images.object';
          }
          // Check if images is an array with fieldName matching
          else if (Array.isArray(surveyData.images)) {
            const matchingImages = surveyData.images.filter((img: any) => 
              img.fieldName === field || img.field === field
            );
            if (matchingImages.length > 0) {
              fieldFiles = matchingImages.map((img: any) => img.url || img);
              foundLocation = 'images.array';
            }
          }
        }
        
        const imageCount = Array.isArray(fieldFiles) ? fieldFiles.length : 0;
        
        console.log(`🔍 Field: ${field} - Found: ${imageCount} images at location: ${foundLocation || 'none'}`);
        if (fieldFiles && !Array.isArray(fieldFiles)) {
          console.log(`⚠️ Field ${field} data is not an array:`, typeof fieldFiles, fieldFiles);
        }
        if (fieldFiles && Array.isArray(fieldFiles) && fieldFiles.length > 0) {
          console.log(`📸 Sample image data for ${field}:`, fieldFiles[0]);
        }
        
        if (imageCount < minRequired) {
          const fieldDisplayName = field
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/Energy Bill/g, 'Energy Bill')
            .replace(/Front Door/g, 'Front Door')
            .replace(/Front Property/g, 'Front of Property')
            .replace(/Target Roofs/g, 'Target Roofs')
            .replace(/Roof Angle/g, 'Roof Angle')
            .replace(/Roof Tile Closeup/g, 'Roof Tile Closeup')
            .replace(/Internal Ceiling Pictures/g, 'Internal Ceiling Pictures')
            .replace(/Electric Meter/g, 'Electric Meter')
            .replace(/Fuse Board/g, 'Fuse Board')
            .replace(/Battery Inverter Location/g, 'Battery & Inverter Location');
          
          missingFields.push(`${fieldDisplayName} (${imageCount}/${minRequired} images)`);
        } else {
          console.log(`✅ Field ${field} has ${imageCount} images - VALID`);
        }
      }

      console.log('🔍 Validation result:', {
        isValid: missingFields.length === 0,
        missingCount: missingFields.length,
        missingFields
      });

      return {
        isValid: missingFields.length === 0,
        missingFields
      };
    } catch (error) {
      console.error('❌ Error validating survey images:', error);
      return { isValid: false, missingFields: ['Error validating images'] };
    }
  };

  const handleGenerateContract = async () => {
    console.log('🔍 Generate Contract button clicked!');
    console.log('🔍 Selected sheet:', selectedSheet);
    console.log('🔍 Selected sheet fileName:', selectedSheet?.fileName);
    
    if (!selectedSheet) {
      Alert.alert('Error', 'Please select a sheet first');
      return;
    }

    // Capture the selected sheet filename immediately to avoid closure/stale state issues
    const selectedSheetFileName = selectedSheet.fileName;
    const selectedSheetCalculatorType = selectedSheet.calculatorType;
    
    console.log('🔍 CAPTURED selectedSheetFileName:', selectedSheetFileName);
    console.log('🔍 CAPTURED selectedSheetCalculatorType:', selectedSheetCalculatorType);

    try {
      // Validate that all required images are uploaded before contract generation
      console.log('🔍 Validating survey images before contract generation...');
      const imageValidation = await validateSurveyImages();
      console.log('🔍 Image validation result:', imageValidation);
      
      if (!imageValidation.isValid) {
        const missingFieldsText = imageValidation.missingFields.join('\n');
        const alertMessage = `Please upload all required images before generating the contract:\n\n${missingFieldsText}\n\nYou can upload images in the Survey screen.`;
        
        // Use CustomAlert for web, Alert for mobile
        if (Platform.OS === 'web') {
          setCustomAlert({
            visible: true,
            title: '📸 Images Required',
            message: alertMessage,
            type: 'warning',
            buttons: [
              {
                text: 'Go to Survey',
                onPress: () => {
                  setCustomAlert(prev => ({ ...prev, visible: false }));
                  (navigation as any).navigate('Survey', { opportunityId });
                },
                style: 'default'
              },
              {
                text: 'Cancel',
                onPress: () => {
                  setCustomAlert(prev => ({ ...prev, visible: false }));
                },
                style: 'cancel'
              }
            ]
          });
        } else {
          Alert.alert(
            '📸 Images Required',
            alertMessage,
            [
              {
                text: 'Go to Survey',
                onPress: () => {
                  (navigation as any).navigate('Survey', { opportunityId });
                }
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        }
        return;
      }

      console.log('✅ All required images are uploaded');
      
      setStep('generating');
      setGenerating(true);
      setError(null);

      // Determine which calculator was used and generate appropriate PDF
      const { api } = await import('../utils/api');
      console.log('🔍 Fetching workflow progress...');
      
      const progressResponse = await api.get(`/opportunity-workflow/progress/${opportunityId}`);
      console.log('🔍 Progress response:', progressResponse);
      const progressResult = progressResponse.data as any;
      const workflowCalculatorType = progressResult?.steps?.find((s: any) => s.stepNumber === 3)?.data?.calculatorType;
      
      // Use captured calculator type as primary source, fallback to workflow data
      const calculatorType = selectedSheetCalculatorType || workflowCalculatorType || 'v44';
      
      console.log('🔍 Contract Generation Debug:');
      console.log('  - Progress result:', progressResult);
      console.log('  - Calculator type from workflow:', workflowCalculatorType);
      console.log('  - Selected sheet calculator type (captured):', selectedSheetCalculatorType);
      console.log('  - Final calculator type used:', calculatorType);
      console.log('🔍 ABOUT TO CALL API - selectedSheetFileName:', selectedSheetFileName);

      let pdfResponse;
      const isEpvsFamily =
        calculatorType === 'flux' ||
        calculatorType === 'epvs' ||
        calculatorType === 'v44' ||
        String(selectedSheetFileName || '').toLowerCase().includes('v4.4') ||
        String(selectedSheetFileName || '').toLowerCase().includes('epvs-v4');

      if (isEpvsFamily) {
        // Generate Flux / EPVS / v4.4 PDF (v4.4 uses PrintProposal VBA on the server)
        console.log('🔍 Using EPVS automation service for calculator type:', calculatorType);
        console.log('🔍 Calling POST /epvs-automation/generate-pdf with:', {
          opportunityId,
          selectedSheet: selectedSheetFileName,
        });
        console.log('🔍 VERIFYING - selectedSheetFileName value RIGHT BEFORE API CALL:', selectedSheetFileName);
        pdfResponse = await api.post('/epvs-automation/generate-pdf', {
          opportunityId,
          selectedSheet: selectedSheetFileName,
        });
        console.log('🔍 EPVS PDF response:', pdfResponse);
      } else {
        // Generate Regular Off-Peak PDF
        console.log('🔍 Using Excel automation service for calculator type:', calculatorType);
        console.log('🔍 Calling POST /excel-automation/generate-pdf with:', {
          opportunityId,
          selectedSheet: selectedSheetFileName,
        });
        console.log('🔍 VERIFYING - selectedSheetFileName value RIGHT BEFORE API CALL:', selectedSheetFileName);
        pdfResponse = await api.post('/excel-automation/generate-pdf', {
          opportunityId,
          selectedSheet: selectedSheetFileName,
        });
        console.log('🔍 Excel PDF response:', pdfResponse);
      }

      const pdfResult = pdfResponse;
      console.log('🔍 PDF Result:', pdfResult);
      console.log('🔍 PDF Result success:', pdfResult.success);
      console.log('🔍 PDF Result data:', pdfResult.data);
      console.log('🔍 PDF Result error:', pdfResult.error);

      const pdfData = (pdfResult.data || {}) as Record<string, unknown>;
      const resolved = resolveContractPdfFromApiResponse(pdfData, opportunityId, isEpvsFamily);

      if (pdfResult.success && pdfResult.data && !resolved.error && resolved.pdfUrl) {
        console.log('📄 PDF Data:', pdfData);
        console.log('📄 PDF URL:', resolved.pdfUrl);
        console.log('📄 PDF Path:', resolved.pdfPath);
        console.log('📄 PDF Filename:', pdfData.pdfFileName || pdfData.filename || pdfData.fileName);
        
        // Store the PDF filename from backend if available
        const backendFileName =
          (typeof pdfData.pdfFileName === 'string' && pdfData.pdfFileName) ||
          (typeof pdfData.filename === 'string' && pdfData.filename) ||
          (typeof pdfData.fileName === 'string' && pdfData.fileName) ||
          null;
        if (backendFileName) {
          setPdfFileName(backendFileName);
          console.log('📄 Using backend PDF filename:', backendFileName);
        } else {
          const urlFileName = resolved.pdfUrl.split('/').pop()?.split('?')[0];
          const fallbackFileName = urlFileName || `Contract-${opportunityId}.pdf`;
          setPdfFileName(fallbackFileName);
          console.log('📄 Using fallback filename:', fallbackFileName);
        }
        
        let fullPdfUrl = resolved.pdfUrl;
        if (Platform.OS === 'web') {
          fullPdfUrl = toAbsolutePdfUrl(fullPdfUrl);
        }
        
        console.log('🔧 DEBUG ContractGeneration: fullPdfUrl after API prefix logic:', fullPdfUrl);
        
        // Fix any double slashes in the URL
        fullPdfUrl = fullPdfUrl.replace(/\/+/g, '/').replace(':/', '://');
        
        console.log('📄 Full PDF URL:', fullPdfUrl);
        setPdfUrl(fullPdfUrl);
        setPdfPath(resolved.pdfPath);
        
        // For web, fetch PDF as blob to create a blob URL for viewing
        if (Platform.OS === 'web' && fullPdfUrl) {
          try {
            setPdfLoading(true);
            setPdfLoadError(null);
            console.log('🔍 PDF Viewer: Starting to fetch PDF from:', fullPdfUrl);
            
            const apiModule = await import('../utils/api');
            const storage = apiModule.getStorage();
            const token = storage ? await storage.getItem('accessToken') : null;
            
            console.log('🔍 PDF Viewer: Token available:', !!token);
            console.log('🔍 PDF Viewer: Making fetch request...');
            
            const response = await fetch(fullPdfUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true',
              },
            });
            
            console.log('🔍 PDF Viewer: Response status:', response.status);
            console.log('🔍 PDF Viewer: Response ok:', response.ok);
            console.log('🔍 PDF Viewer: Response headers:', {
              'content-type': response.headers.get('content-type'),
              'content-length': response.headers.get('content-length'),
            });
            
            if (response.ok) {
              // Verify the PDF is valid by checking the blob
              const blob = await response.blob();
              console.log('🔍 PDF Viewer: Blob created:', {
                size: blob.size,
                type: blob.type,
              });
              
              if (blob.size === 0) {
                console.warn('⚠️ PDF Viewer: Blob is empty (0 bytes). PDF may still be generating.');
                setPdfBlobUrl(null);
                setPdfLoadError('PDF file is still empty. Please wait a moment and retry.');
              } else if (!blob.type.includes('pdf') && !blob.type.includes('application/octet-stream')) {
                console.warn('⚠️ PDF Viewer: Unexpected blob type:', blob.type);
                const text = await blob.text();
                console.error('❌ PDF Viewer: Response text:', text.substring(0, 200));
                throw new Error(`Unexpected content type: ${blob.type}. Response: ${text.substring(0, 100)}`);
              } else {
                // Use blob URL for iframe preview — avoids X-Frame-Options on /api proxy
                // and mixed-content blocks when the PDF is served cross-origin.
                const objectUrl = URL.createObjectURL(blob);
                console.log('✅ PDF Viewer: PDF is valid (size:', blob.size, 'bytes). Using blob URL for preview.');
                setPdfBlobUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return objectUrl;
                });
                setPdfLoadError(null);
              }
            } else {
              const errorText = await response.text().catch(() => 'Unable to read error response');
              console.error('❌ PDF Viewer: Failed to fetch PDF:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200),
              });
              setPdfLoadError(`Failed to load PDF: ${response.status} ${response.statusText}. ${errorText.substring(0, 100)}`);
            }
          } catch (error) {
            console.error('❌ PDF Viewer: Error creating PDF blob URL:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setPdfLoadError(`Error loading PDF: ${errorMessage}`);
          } finally {
            setPdfLoading(false);
          }
        }
        
        setStep('preview');
        setGenerating(false);
      } else {
        const errorMessage =
          resolved.error ||
          pdfResult.error ||
          (typeof pdfData.error === 'string' ? pdfData.error : null) ||
          (typeof pdfData.message === 'string' ? pdfData.message : null) ||
          'Unknown error occurred';
        console.error('❌ PDF generation failed:', errorMessage);
        setError(errorMessage);
        setStep('sheets');
        setGenerating(false);
        
        if (Platform.OS === 'web') {
          setCustomAlert({
            visible: true,
            title: 'Generation Failed',
            message: `Failed to generate contract PDF: ${errorMessage}`,
            type: 'error',
            buttons: [{ text: 'OK', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
          });
        } else {
          Alert.alert(
            'Generation Failed',
            `Failed to generate contract PDF: ${errorMessage}`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error generating contract:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      setStep('sheets');
      setGenerating(false);
      
      if (Platform.OS === 'web') {
        setCustomAlert({
          visible: true,
          title: 'Generation Error',
          message: `An error occurred while generating the contract: ${errorMessage}`,
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
        });
      } else {
        Alert.alert(
          'Generation Error',
          `An error occurred while generating the contract: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      }
    }
  };


  const checkIfDisclaimerNeeded = async (): Promise<boolean> => {
    try {
      console.log('🔍 ContractGenerationScreen: Checking if disclaimer is needed for opportunity:', opportunityId);
      const { resolveDisclaimerNeededForOpportunity } = await import('../utils/disclaimerDisplay');
      return await resolveDisclaimerNeededForOpportunity(opportunityId);
    } catch (error) {
      console.error('🔍 ContractGenerationScreen: Error checking disclaimer requirement:', error);
      return true;
    }
  };

  const handleAgreeAndContinue = async () => {
    // Complete the step and navigate to next step
    console.log('🔍 Completing contract generation step...');
    
    try {
      const { workflowApi } = await import('../utils/api');
      
      // Get workflow progress to find the correct step number for PROPOSAL_GENERATION
      // Step numbers can vary depending on whether disclaimer step is shown
      let proposalStepNumber = 7; // Default fallback
      try {
        const progressResponse = await workflowApi.getOpportunityProgress(opportunityId);
        if (progressResponse && progressResponse.success && progressResponse.data && progressResponse.data.steps) {
          const proposalStep = progressResponse.data.steps.find((s: any) => s.stepType === 'PROPOSAL_GENERATION');
          if (proposalStep && proposalStep.stepNumber) {
            proposalStepNumber = proposalStep.stepNumber;
            console.log('🔍 Found PROPOSAL_GENERATION step number:', proposalStepNumber);
          } else {
            console.warn('⚠️ PROPOSAL_GENERATION step not found in progress, using default:', proposalStepNumber);
          }
        } else {
          console.warn('⚠️ Invalid progress response, using default step number:', proposalStepNumber);
        }
      } catch (progressError) {
        console.warn('⚠️ Could not fetch workflow progress, using default step number:', proposalStepNumber, progressError);
      }
      
      // Mark PROPOSAL_GENERATION step as completed
      const result = await workflowApi.completeStep(opportunityId, proposalStepNumber, {
        pdfPath,
        pdfUrl,
        selectedSheet: selectedSheet?.fileName,
        generatedAt: new Date().toISOString()
      });
      
      console.log('✅ Contract generation step completed:', result);
      console.log('✅ Completed step number:', proposalStepNumber);
      
      // Verify the step was actually completed
      if (result && result.success) {
        console.log('🔍 Contract generation step completed successfully, checking next step...');
        console.log('🔍 Navigation params:', { opportunityId });
        
        // Check if disclaimer step is needed before navigating
        const shouldShowDisclaimer = await checkIfDisclaimerNeeded();
        
        if (shouldShowDisclaimer) {
          console.log('🔍 Disclaimer step is needed, navigating to DisclaimerSigning...');
          navigation.navigate('DisclaimerSigning', { opportunityId });
        } else {
          console.log('🔍 Disclaimer step not needed, navigating directly to ContractSigning...');
          navigation.navigate('ContractSigning', { opportunityId });
        }
        
        console.log('🔍 Navigation call completed');
      } else {
        console.error('❌ Step completion failed:', result);
        Alert.alert('Error', 'Failed to complete contract generation step. Please try again.');
      }
    } catch (error) {
      console.error('🔍 Error completing step:', error);
      Alert.alert('Error', 'Failed to complete step');
    }
  };



  const handleRetry = () => {
    setError(null);
    setStep('sheets');
    loadAvailableSheets();
  };

  // Step 1: Show available sheets
  console.log('🔍 Current step:', step, 'availableSheets:', availableSheets);
  if (step === 'sheets') {
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
          source={require('../../assets/creativ NB.png')}
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
                    opportunity: null
                  });
                }}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Select Contract Sheet
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Choose which calculator file to use for your contract
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
        
        {loadingSheets ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.primaryText }]}>Loading available sheets...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color={theme.dangerButton} />
            <Text style={[styles.errorTitle, { color: theme.primaryText }]}>Failed to Load Sheets</Text>
            <Text style={[styles.errorText, { color: theme.secondaryText }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primaryButton }]} onPress={handleRetry}>
              <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.content, selectedSheet && styles.contentWithStickyButton]}>
            <View style={styles.infoHeader}>
              <Ionicons name="document-text" size={48} color={theme.primaryButton} />
              <Text style={[styles.infoTitle, { color: theme.primaryText }]}>Select Calculator</Text>
              <Text style={[styles.infoSubtext, { color: theme.secondaryText }]}>
                Choose a calculator to generate your contract PDF
              </Text>
            </View>
            
            <ScrollView 
              style={[
                styles.sheetsContainer,
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
                { paddingBottom: 20, paddingHorizontal: 16 },
                Platform.OS === 'web' && {
                  minHeight: '100vh' as any,
                  paddingBottom: 100,
                }
              ]}
            >
              <ExcelSheetPicker
                sheets={availableSheets}
                selectedSheet={selectedSheet}
                onSelect={(sheet) => handleSheetSelect(sheet as SheetInfo)}
                loading={loadingSheets}
                emptyTitle="No calculators available"
                emptyMessage="Complete the calculator step first, then come back here."
                introText="Tap a calculator below. Files are listed from V1 to the latest."
              />
            </ScrollView>
          </View>
        )}
        
        {/* Sticky Generate Contract Button */}
        {selectedSheet && step === 'sheets' && (
          <View style={[styles.stickyButtonContainer, { backgroundColor: theme.primaryBackground, borderTopColor: theme.cardBorder }]}>
            <TouchableOpacity 
              style={[
                styles.generateButton, 
                { backgroundColor: theme.primaryButton },
                (generating || loadingSheets) && styles.generateButtonDisabled
              ]} 
              onPress={handleGenerateContract}
              disabled={generating || loadingSheets}
              activeOpacity={0.7}
            >
              {generating ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={[styles.generateButtonText, { color: '#ffffff' }]}>Generating...</Text>
                </>
              ) : (
                <Text style={[styles.generateButtonText, { color: '#ffffff' }]}>Generate Contract</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
        
        {/* Custom Alert for Web */}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          type={customAlert.type}
          buttons={customAlert.buttons}
          onClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
        />
      </View>
    );
  }

  // Step 2: Generating PDF
  if (step === 'generating') {
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
          source={require('../../assets/creativ NB.png')}
          style={styles.backgroundImageStyle}
          resizeMode="contain"
        />
        
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
                onPress={() => setStep('sheets')}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Generating Contract
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Please wait while we create your proposal
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
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Generating your contract PDF...</Text>
          <Text style={[styles.loadingSubtext, { color: theme.secondaryText }]}>Please wait while we create your proposal</Text>
        </View>

        {/* Bottom Navigation */}
        <BottomNavigation />
        
        {/* Custom Alert for Web */}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          type={customAlert.type}
          buttons={customAlert.buttons}
          onClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
        />
      </View>
    );
  }

    // Step 3: PDF Preview
  if (step === 'preview') {
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
          source={require('../../assets/creativ NB.png')}
          style={styles.backgroundImageStyle}
          resizeMode="contain"
        />
        
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
                onPress={() => setStep('sheets')}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Contract Generated
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Your contract is ready for download
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
        
        <View style={[styles.content, styles.contentWithStickyButton]}>
          {Platform.OS !== 'web' && (
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={48} color={theme.successButton} />
              <Text style={[styles.successTitle, { color: theme.primaryText }]}>Contract Ready!</Text>
              <Text style={[styles.successSubtext, { color: theme.secondaryText }]}>Please review your contract before proceeding</Text>
            </View>
          )}
          
          {/* PDF Viewer */}
          {(() => { 
            console.log('🔍 PDF Viewer Debug:', {
              pdfUrl,
              pdfBlobUrl,
              pdfLoading,
              pdfLoadError,
              hasBlobUrl: !!pdfBlobUrl,
            }); 
            return null; 
          })()}
          <View style={[styles.pdfContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            {pdfUrl ? (
              Platform.OS === 'web' ? (
                <View style={styles.pdfViewerContainer}>
                  {/* PDF Viewer */}
                  {pdfLoading ? (
                    <View style={styles.pdfLoadingContainer}>
                      <ActivityIndicator size="large" color={theme.primaryButton} />
                      <Text style={[styles.pdfLoadingText, { color: theme.secondaryText }]}>
                        Loading PDF...
                      </Text>
                    </View>
                  ) : pdfLoadError ? (
                    <View style={styles.pdfErrorContainer}>
                      <Ionicons name="alert-circle" size={64} color={theme.dangerButton} />
                      <Text style={[styles.pdfErrorText, { color: theme.dangerButton }]}>
                        Failed to Load PDF
                      </Text>
                      <Text style={[styles.pdfErrorSubtext, { color: theme.secondaryText }]}>
                        {pdfLoadError}
                      </Text>
                      <Text style={[styles.pdfErrorSubtext, { color: theme.tertiaryText, fontSize: 12, marginTop: 8 }]}>
                        PDF URL: {pdfUrl}
                      </Text>
                      <Text style={[styles.pdfErrorSubtext, { color: theme.tertiaryText, fontSize: 12, marginTop: 8 }]}>
                        The PDF may still be generating. Please wait a moment and retry.
                      </Text>
                      <TouchableOpacity
                        style={[styles.retryButton, { backgroundColor: theme.primaryButton, marginTop: 16 }]}
                        onPress={async () => {
                          // Retry loading the PDF
                          if (pdfUrl) {
                            setPdfLoadError(null);
                            setPdfBlobUrl(null);
                            setPdfLoading(true);
                            try {
                              const apiModule = await import('../utils/api');
                              const storage = apiModule.getStorage();
                              const token = storage ? await storage.getItem('accessToken') : null;
                              
                              console.log('🔍 PDF Viewer: Retrying fetch from:', pdfUrl);
                              const response = await fetch(pdfUrl, {
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'ngrok-skip-browser-warning': 'true',
                                },
                              });
                              
                              console.log('🔍 PDF Viewer: Retry response status:', response.status);
                              console.log('🔍 PDF Viewer: Retry content-length:', response.headers.get('content-length'));
                              
                              if (response.ok) {
                                const blob = await response.blob();
                                console.log('🔍 PDF Viewer: Retry blob size:', blob.size);
                                
                                if (blob.size > 0) {
                                  const blobUrl = URL.createObjectURL(blob);
                                  setPdfBlobUrl(blobUrl);
                                  setPdfLoadError(null);
                                  console.log('✅ PDF Viewer: Retry successful, blob URL created');
                                } else {
                                  setPdfLoadError('PDF file is still empty. The PDF may still be generating on the server. Please wait and try again.');
                                }
                              } else {
                                setPdfLoadError(`HTTP ${response.status}: ${response.statusText}`);
                              }
                            } catch (error) {
                              console.error('❌ PDF Viewer: Retry error:', error);
                              setPdfLoadError(error instanceof Error ? error.message : 'Unknown error');
                            } finally {
                              setPdfLoading(false);
                            }
                          }
                        }}
                      >
                        <Text style={[styles.retryButtonText, { color: '#ffffff' }]}>Retry Loading PDF</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* Prefer blob URL (same-origin) so iframe isn't blocked by X-Frame-Options on /api */}
                      {(pdfBlobUrl || pdfUrl) ? (
                        <>
                          <object
                            data={pdfBlobUrl || pdfUrl}
                            type="application/pdf"
                            style={styles.pdfIframe as any}
                            onLoad={() => {
                              console.log('✅ PDF Viewer: Object loaded:', pdfBlobUrl || pdfUrl);
                            }}
                            onError={(e) => {
                              console.error('❌ PDF Viewer: Object error:', e);
                              console.log('⚠️ PDF Viewer: Object failed, will try iframe fallback');
                            }}
                          >
                            <iframe
                              src={pdfBlobUrl || pdfUrl}
                              style={styles.pdfIframe as any}
                              title="Contract PDF Viewer"
                              onLoad={() => {
                                console.log('✅ PDF Viewer: Fallback iframe loaded:', pdfBlobUrl || pdfUrl);
                              }}
                            />
                          </object>
                        </>
                      ) : (
                        <View style={styles.pdfLoadingContainer}>
                          <ActivityIndicator size="large" color={theme.primaryButton} />
                          <Text style={[styles.pdfLoadingText, { color: theme.secondaryText }]}>
                            PDF is being generated...
                          </Text>
                          <Text style={[styles.pdfLoadingSubtext, { color: theme.tertiaryText }]}>
                            Please wait while the PDF is created on the server
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.pdfPreviewContainer}>
                  <Ionicons name="document-text" size={80} color={theme.primaryButton} />
                  <Text style={[styles.pdfPreviewTitle, { color: theme.primaryText }]}>Contract PDF Generated</Text>
                  <Text style={[styles.pdfPreviewSubtext, { color: theme.secondaryText }]}>
                    Your contract has been successfully generated and is ready for download.
                  </Text>
                  
                  {downloading && (
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { backgroundColor: theme.borderColor }]}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${downloadProgress}%`, backgroundColor: theme.primaryButton }
                          ]} 
                        />
                      </View>
                      <Text style={[styles.progressText, { color: theme.secondaryText }]}>
                        {downloadProgress}% Complete
                      </Text>
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={[
                      styles.downloadButton, 
                      { backgroundColor: theme.primaryButton },
                      downloading && styles.downloadButtonDisabled
                    ]}
                    onPress={async () => {
                      if (pdfUrl) {
                        await downloadAndSharePDF(pdfUrl, opportunityId);
                      }
                    }}
                    disabled={downloading}
                  >
                    <Ionicons 
                      name={downloading ? "hourglass" : "download-outline"} 
                      size={20} 
                      color="#ffffff" 
                      style={downloading && styles.spinningIcon}
                    />
                    <Text style={[styles.downloadButtonText, { color: '#ffffff' }]}>
                      {downloading 
                        ? `Downloading... ${downloadProgress}%` 
                        : downloadError 
                          ? 'Retry Download' 
                          : 'Download Contract PDF'
                      }
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.pdfPreviewNote, { color: theme.tertiaryText }]}>
                    Click the button above to download your contract PDF
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.pdfErrorContainer}>
                <Ionicons name="document-outline" size={64} color={theme.tertiaryText} />
                <Text style={[styles.pdfErrorText, { color: theme.secondaryText }]}>PDF URL not available</Text>
                <Text style={[styles.pdfErrorSubtext, { color: theme.tertiaryText }]}>The PDF may still be generating</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Sticky Agree & Continue Button */}
        {step === 'preview' && pdfUrl && (
          <View style={[styles.stickyButtonContainer, { backgroundColor: theme.primaryBackground, borderTopColor: theme.cardBorder }]}>
            <TouchableOpacity 
              style={[styles.agreeButton, { backgroundColor: theme.successButton }]} 
              onPress={() => {
                console.log('🔍 Agree & Continue button pressed!');
                handleAgreeAndContinue();
              }}
            >
              <Text style={[styles.agreeButtonText, { color: '#ffffff' }]}>Agree & Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
        
        {/* Custom Alert for Web */}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          type={customAlert.type}
          buttons={customAlert.buttons}
          onClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
        />
      </View>
    );
  }


}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImageStyle: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
    opacity: 0.03,
    zIndex: 0,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1,
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
    padding: 12,
    borderRadius: 16,
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: 12,
    borderRadius: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 1,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 1,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewInNewTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewInNewTabButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
    zIndex: 1,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      paddingBottom: 40, // Extra padding for web scrolling
      marginBottom: 65, // Add margin for BottomNavigation on web
    } as any),
  },
  contentWithStickyButton: {
    flex: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 180 : 160, // Extra padding for sticky button + BottomNavigation
    zIndex: 1,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      paddingBottom: 160, // Extra padding for sticky button + BottomNavigation on web
      marginBottom: 65, // Add margin for BottomNavigation on web
    } as any),
  },
  infoHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
  sheetsContainer: {
    flex: 1,
    marginBottom: 20,
  },
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
  },
  noSheetsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noSheetsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  noSheetsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
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
  generateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
     pdfContainer: {
     flex: 1,
     borderRadius: 12,
     borderWidth: 1,
     overflow: 'hidden',
     position: 'relative',
     ...(Platform.OS === 'web' && {
       minHeight: 600,
       height: Platform.OS === 'web' ? 'calc(100vh - 250px)' : '100%',
       display: 'flex',
       flexDirection: 'column',
     } as any),
   },
   pdfPreviewContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     padding: 40,
   },
   pdfPreviewTitle: {
     fontSize: 24,
     fontWeight: '700',
     marginTop: 20,
     marginBottom: 12,
     textAlign: 'center',
   },
   pdfPreviewSubtext: {
     fontSize: 16,
     textAlign: 'center',
     marginBottom: 32,
     lineHeight: 24,
   },
   viewPdfButton: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 24,
     paddingVertical: 16,
     borderRadius: 12,
     marginBottom: 16,
   },
   viewPdfButtonText: {
     fontSize: 18,
     fontWeight: '700',
     marginLeft: 8,
   },
   pdfPreviewNote: {
     fontSize: 14,
     textAlign: 'center',
     fontStyle: 'italic',
   },
  pdfIframe: {
   width: '100%',
   height: '100%',
   flex: 1,
   minHeight: 600,
   ...(Platform.OS === 'web' && {
     border: 'none',
     display: 'block',
   } as any),
  },
  pdfViewerContainer: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: 600,
    ...(Platform.OS === 'web' && {
      display: 'flex',
    } as any),
  },
  pdfViewerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  downloadButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    maxWidth: 200,
  },
  progressBarInline: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressTextInline: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
  },
  pdfWebView: {
    flex: 1,
  },
  pdfLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  pdfLoadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  pdfLoadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
     pdfErrorContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     padding: 20,
   },
   pdfInfoContainer: {
     flexDirection: 'row',
     alignItems: 'flex-start',
     padding: 12,
     borderRadius: 8,
     marginTop: 8,
     gap: 8,
   },
   pdfInfoText: {
     fontSize: 12,
     flex: 1,
     lineHeight: 16,
   },
   pdfErrorOverlay: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     backgroundColor: 'rgba(255, 255, 255, 0.95)',
     justifyContent: 'center',
     alignItems: 'center',
     padding: 20,
   },
     pdfErrorText: {
     fontSize: 16,
     marginBottom: 8,
   },
   pdfErrorSubtext: {
     fontSize: 14,
     textAlign: 'center',
     marginBottom: 16,
   },
     downloadButton: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingHorizontal: 24,
     paddingVertical: 16,
     borderRadius: 12,
     marginBottom: 16,
     gap: 8,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 4,
     elevation: 3,
   },
   downloadButtonDisabled: {
     opacity: 0.6,
   },
   downloadButtonText: {
     fontSize: 18,
     fontWeight: '700',
     color: '#ffffff',
   },
   progressContainer: {
     marginBottom: 20,
   },
   progressBar: {
     height: 8,
     borderRadius: 4,
     overflow: 'hidden',
     marginBottom: 8,
   },
   progressFill: {
     height: '100%',
     borderRadius: 4,
   },
   progressText: {
     textAlign: 'center',
     fontSize: 14,
     fontWeight: '500',
   },
   spinningIcon: {
     transform: [{ rotate: '0deg' }],
   },
  agreeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  agreeButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Account for BottomNavigation
    borderTopWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      paddingBottom: 80,
    } as any),
  },
});
