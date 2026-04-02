import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { presentationApi } from '../utils/api';
import { API_BASE_URL } from '../utils/env';
import { jsPDF } from 'jspdf';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
  videoData?: any; // Keep for backward compatibility, but will be used as imageData
}

interface ExtractedData {
  customerName: string;
  date: string;
  postcode: string;
  p_w: number;
  p_q: number;
  i_s: number;
  b_s: number;
  t_y_s_o: number;
  t_y_s_g: number;
}

interface SheetInfo {
  fileName: string;
  filePath: string;
  size: number;
  calculatorType: 'flux' | 'off-peak' | 'epvs';
}

type Step = 'sheets' | 'extracting' | 'generating' | 'viewing';

export default function VideoPresentationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, opportunity: passedOpportunity, videoData: passedVideoData } = route.params as RouteParams;
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [step, setStep] = useState<Step>('sheets');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetInfo | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [imageData, setImageData] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isCompletingStep, setIsCompletingStep] = useState(false);
  const preloadedImagesRef = useRef<Set<number>>(new Set());
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasShownApprovalModal, setHasShownApprovalModal] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Function to extract only numbers from postcode
  const extractPostcodeNumbers = (postcode: string): string => {
    if (!postcode) return '';
    return postcode.replace(/[^0-9]/g, '');
  };

  // Generate the approval code
  const getApprovalCode = (): string => {
    const postcode = imageData?.postcode || extractedData?.postcode || '';
    const postcodeNumbers = extractPostcodeNumbers(postcode);
    return `CREFUND99${postcodeNumbers}`;
  };

  // Auto-show approval modal when on the last slide
  useEffect(() => {
    if (
      step === 'viewing' && 
      imageData?.publicUrls && 
      currentImageIndex === imageData.publicUrls.length - 1 && 
      !hasShownApprovalModal
    ) {
      // Small delay to let the slide transition complete
      const timer = setTimeout(() => {
        setShowApprovalModal(true);
        setHasShownApprovalModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentImageIndex, step, imageData, hasShownApprovalModal]);

  useEffect(() => {
    // If image data is passed directly, skip sheet loading and go straight to viewing
    if (passedVideoData) {
      console.log('🎯 Image data passed directly, skipping sheet loading');
      setImageData(passedVideoData);
      setStep('viewing');
      setLoading(false);
    } else {
      loadAvailableSheets();
    }
  }, [opportunityId, passedVideoData]);

  const loadAvailableSheets = async () => {
    try {
      setLoading(true);
      const response = await presentationApi.getAvailableSheets(opportunityId);
      
      if (response.success) {
        const sheets = Array.isArray(response.data) ? response.data : (response.data as any)?.sheets || [];
        setAvailableSheets(sheets);
      } else {
        Alert.alert('Error', response.error || 'Failed to load available sheets');
      }
    } catch (error) {
      console.error('Error loading sheets:', error);
      Alert.alert('Error', 'Failed to load available sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetSelect = async (sheet: SheetInfo) => {
    try {
      setSelectedSheet(sheet);
      setStep('extracting');
      setExtractionError(null);

      console.log('🎯 Starting data extraction for sheet:', sheet.fileName);
      const response = await presentationApi.extractDataFromSheet(opportunityId, sheet.fileName);
      
      if (response.success) {
        console.log('✅ Data extraction successful:', response.data);
        setExtractedData(response.data);
        setStep('generating');
        
        // Automatically start image generation after successful extraction
        console.log('🎯 Starting image generation after successful extraction...');
        await generateImagePresentationWithData(response.data, sheet);
      } else {
        console.log('❌ Data extraction failed:', response.error);
        setExtractionError(response.error || 'Failed to extract data from sheet');
        setStep('sheets');
      }
    } catch (error) {
      console.error('❌ Error extracting data:', error);
      setExtractionError('Failed to extract data from sheet');
      setStep('sheets');
    }
  };

  const generateImagePresentationWithData = async (data: ExtractedData, sheet?: SheetInfo) => {
    console.log('🎯 generateImagePresentationWithData called with data:', data);
    console.log('🎯 generateImagePresentationWithData called with sheet:', sheet);
    
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
      console.log('🎯 Starting image proposal generation...');
      setStep('generating');
      setGenerating(true);

      console.log('🎯 Starting image proposal generation with data:', {
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
      
      // Add timeout protection to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timeout after 5 minutes')), 5 * 60 * 1000);
      });
      
      const generationPromise = presentationApi.generateVideoPresentation({
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
      
      const result = await Promise.race([generationPromise, timeoutPromise]) as any;
      
      console.log('🎯 presentationApi.generateVideoPresentation result:', result);
      console.log('🎯 Result success:', result?.success);
      console.log('🎯 Result data:', result?.data);

      if (result?.success && result?.data) {
        console.log('✅ Image presentation generated successfully');
        console.log('✅ Response data structure:', {
          hasImages: !!result.data.images,
          hasPublicUrls: !!result.data.publicUrls,
          imagesCount: result.data.images?.length || 0,
          publicUrlsCount: result.data.publicUrls?.length || 0,
          images: result.data.images,
          publicUrls: result.data.publicUrls
        });
        
        // Validate that we have the required data
        if (!result.data.publicUrls || !Array.isArray(result.data.publicUrls) || result.data.publicUrls.length === 0) {
          console.error('❌ Invalid response format: missing or empty publicUrls array');
          Alert.alert('Error', 'Invalid response format: No image URLs received');
          setStep('sheets');
          return;
        }
        
        // Store the calculator type and postcode in the image data for later retrieval
        const imageDataWithCalculatorType = {
          ...result.data,
          calculatorType: currentSheet.calculatorType,
          postcode: data.postcode // Include postcode for approval code
        };
        setImageData(imageDataWithCalculatorType);
        setCurrentImageIndex(0);
        setStep('viewing');
        console.log('✅ Image data set, navigating to viewing step');
      } else {
        console.log('❌ Image presentation generation failed:', result?.error);
        Alert.alert('Error', result?.error || 'Failed to generate image presentation');
        setStep('sheets');
      }
    } catch (error) {
      console.error('❌ Image presentation generation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'Image generation timeout after 5 minutes') {
        Alert.alert('Timeout', 'Image generation is taking longer than expected. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to generate image presentation');
      }
      setStep('sheets');
    } finally {
      setGenerating(false);
    }
  };

  // Preload adjacent images for smooth transitions
  useEffect(() => {
    if (!imageData?.publicUrls || imageData.publicUrls.length === 0) return;

    const urls = imageData.publicUrls;
    const preloadImage = (index: number) => {
      if (preloadedImagesRef.current.has(index)) return;
      if (index < 0 || index >= urls.length) return;
      
      const imageUrl = `${API_BASE_URL.replace(/\/$/, '')}${urls[index]}`;
      
      // Use platform-specific preloading
      if (Platform.OS === 'web') {
        // For web, use HTML Image constructor
        const img = document.createElement('img');
        img.onload = () => {
          preloadedImagesRef.current.add(index);
        };
        img.onerror = () => {
          console.error('Failed to preload image:', imageUrl);
        };
        img.src = imageUrl;
      } else {
        // For React Native, use Image.prefetch
        Image.prefetch(imageUrl)
          .then(() => {
            preloadedImagesRef.current.add(index);
          })
          .catch((error) => {
            console.error('Failed to preload image:', error);
          });
      }
    };

    // Preload current, next, and previous images
    preloadImage(currentImageIndex);
    if (currentImageIndex > 0) {
      preloadImage(currentImageIndex - 1);
    }
    if (currentImageIndex < urls.length - 1) {
      preloadImage(currentImageIndex + 1);
    }
    // Only depend on currentImageIndex and the length of URLs to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageIndex, imageData?.publicUrls?.length]);

  const handleNextImage = () => {
    if (imageData?.publicUrls && currentImageIndex < imageData.publicUrls.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      // Zoom persists across images
    }
  };

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      // Zoom persists across images
    }
  };

  const handleZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.25, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.25, 0.5)); // Min zoom 0.5x
  };

  const handleResetZoom = () => {
    setImageScale(1);
  };

  const handleDownloadImage = async () => {
    if (!imageData?.publicUrls || !imageData.publicUrls[currentImageIndex]) {
      Alert.alert('Error', 'No image URL available');
      return;
    }

    try {
      setDownloading(true);
      setDownloadError(null);

      const imageUrl = `${API_BASE_URL.replace(/\/$/, '')}${imageData.publicUrls[currentImageIndex]}`;
      const filename = imageData.images?.[currentImageIndex] || `proposal_${opportunityId}_slide_${currentImageIndex + 1}.png`;
      // For web, use a temporary location; for mobile, use document directory
      const baseDir = Platform.OS === 'web' ? '' : ((FileSystem as any).documentDirectory || '');
      const localUri = baseDir + filename;

      console.log('Downloading image from:', imageUrl);
      console.log('Saving to:', localUri);

      const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
      
      if (downloadResult.status === 200) {
        setLocalFilePath(downloadResult.uri);
        setDownloaded(true);
        Alert.alert('Success', 'Image downloaded successfully!');
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDownloadError(errorMessage);
      Alert.alert('Download Error', errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  const handleShareImage = async () => {
    if (!imageData?.publicUrls || !imageData.publicUrls[currentImageIndex]) {
      Alert.alert('Error', 'No image URL available');
      return;
    }

    try {
      const imageUrl = `${API_BASE_URL.replace(/\/$/, '')}${imageData.publicUrls[currentImageIndex]}`;
      await Share.share({
        message: `Check out this solar proposal slide for ${imageData.customerName}`,
        url: imageUrl,
        title: 'Solar Proposal Slide',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  };

  const handleDownloadPdf = async () => {
    if (!imageData?.publicUrls || imageData.publicUrls.length === 0) {
      Alert.alert('Error', 'No images available to download');
      return;
    }

    try {
      setDownloadingPdf(true);
      
      if (Platform.OS === 'web') {
        // Use jsPDF for web
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [1920, 1080] // Standard presentation size
        });

        // Load and add each image to PDF
        for (let i = 0; i < imageData.publicUrls.length; i++) {
          const imageUrl = `${API_BASE_URL.replace(/\/$/, '')}${imageData.publicUrls[i]}`;
          
          // Fetch image as blob
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Add page for each image (except first one which is already there)
          if (i > 0) {
            pdf.addPage();
          }

          // Get image dimensions using browser's native Image constructor
          const img = document.createElement('img');
          img.src = imageDataUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
          });

          // Calculate dimensions to fit page while maintaining aspect ratio
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = img.naturalWidth || img.width;
          const imgHeight = img.naturalHeight || img.height;
          
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
          const width = imgWidth * ratio;
          const height = imgHeight * ratio;
          const x = (pageWidth - width) / 2;
          const y = (pageHeight - height) / 2;

          pdf.addImage(imageDataUrl, 'PNG', x, y, width, height);
        }

        // Generate filename
        const customerName = imageData.customerName || 'Proposal';
        const filename = `${customerName.replace(/[^a-z0-9]/gi, '_')}_Proposal.pdf`;
        
        // Save PDF
        pdf.save(filename);
        Alert.alert('Success', 'PDF downloaded successfully!');
      } else {
        // For mobile, use expo-print
        const { printToFileAsync } = await import('expo-print');
        const { shareAsync } = await import('expo-sharing');
        
        // Create HTML content with all images
        const imagesHtml = imageData.publicUrls.map((url: string) => {
          const fullUrl = `${API_BASE_URL.replace(/\/$/, '')}${url}`;
          return `<img src="${fullUrl}" style="width: 100%; page-break-after: always;" />`;
        }).join('');

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; }
                img { width: 100%; height: auto; display: block; }
              </style>
            </head>
            <body>
              ${imagesHtml}
            </body>
          </html>
        `;

        const { uri } = await printToFileAsync({ html });
        const customerName = imageData.customerName || 'Proposal';
        const filename = `${customerName.replace(/[^a-z0-9]/gi, '_')}_Proposal.pdf`;
        
        await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save PDF' });
        Alert.alert('Success', 'PDF generated successfully!');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to generate PDF: ${errorMessage}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCompleteStep = async () => {
    try {
      setIsCompletingStep(true);
      console.log('🔧 Starting video presentation step completion...');
      console.log('🔧 Opportunity ID:', opportunityId);
      
      // Mark proposal generation step (step 4) as completed
      const { workflowApi } = await import('../utils/api');
      const stepData = {
        imageUrls: imageData?.publicUrls,
        images: imageData?.images,
        customerName: imageData?.customerName,
        completedAt: new Date().toISOString(),
        imagesGenerated: true
      };
      
      console.log('🔧 Calling workflowApi.completeStep with data:', stepData);
      const result = await workflowApi.completeStep(opportunityId, 4, stepData);
      console.log('✅ Video presentation step completed successfully:', result);
      
      // Verify the step was actually completed
      if (result && result.success) {
        console.log('🔍 Video presentation step completed successfully, navigating to next step...');
        console.log('🔍 Navigation params:', { opportunityId });
        
        // Navigate directly to the next step: Solar Projection (step 5)
        // Pass the calculator type that was used in the proposal
        let calculatorType = imageData?.calculatorType;
        
        // Fallback: determine calculator type from selectedSheet if not in imageData
        if (!calculatorType && selectedSheet?.calculatorType) {
          calculatorType = selectedSheet.calculatorType;
        }
        
        // Fallback: determine calculator type from filename if not set
        if (!calculatorType && selectedSheet?.fileName) {
          const fileName = selectedSheet.fileName.toLowerCase();
          if (fileName.includes('epvs')) {
            calculatorType = 'epvs';
          } else if (fileName.includes('flux')) {
            calculatorType = 'flux';
          } else {
            calculatorType = 'off-peak';
          }
        }
        
        // Final fallback
        calculatorType = calculatorType || 'off-peak';
        
        console.log('🔍 Image data:', imageData);
        console.log('🔍 Selected sheet:', selectedSheet);
        console.log('🔍 Calculator type being passed:', calculatorType);
        navigation.navigate('SolarProjection', { opportunityId, calculatorType });
        
        console.log('🔍 Navigation call completed');
      } else {
        console.error('❌ Step completion failed:', result);
        Alert.alert('Error', 'Failed to complete video presentation step. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error completing video presentation step:', error);
      Alert.alert('Error', 'Failed to complete step. Please try again.');
    } finally {
      setIsCompletingStep(false);
    }
  };

  const renderSheetsStep = () => (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
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
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
              Video Presentation
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              Generate proposal images
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.themeButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={toggleTheme}
            >
              <Ionicons name={isDark ? "sunny" : "moon"} size={20} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { backgroundColor: theme.primaryBackground }]}>
        <Text style={[styles.stepTitle, { color: theme.primaryText }]}>
          Select Excel Sheet
        </Text>
        <Text style={[styles.stepDescription, { color: theme.primaryText }]}>
          Choose the Excel sheet containing the solar calculation data to generate an image presentation.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.primaryText }]}>
              Loading available sheets...
            </Text>
          </View>
        ) : (
          <View style={styles.sheetsContainer}>
            {availableSheets.map((sheet, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.sheetCard,
                  { backgroundColor: theme.secondaryBackground },
                  selectedSheet?.fileName === sheet.fileName && styles.selectedSheetCard
                ]}
                onPress={() => handleSheetSelect(sheet)}
              >
                <View style={styles.sheetHeader}>
                  <Ionicons
                    name="document-text"
                    size={24}
                    color={theme.primaryButton}
                  />
                  <Text style={[styles.sheetName, { color: theme.primaryText }]}>
                    {sheet.fileName}
                  </Text>
                </View>
                <Text style={[styles.sheetType, { color: theme.primaryText }]}>
                  Type: {sheet.calculatorType.toUpperCase()}
                </Text>
                <Text style={[styles.sheetSize, { color: theme.primaryText }]}>
                  Size: {(sheet.size / 1024 / 1024).toFixed(2)} MB
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );

  const renderGeneratingStep = () => (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
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
              onPress={() => setStep('sheets')}
            >
              <Ionicons name="arrow-back" size={20} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
              Generating Video
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              Creating your proposal images
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <View style={[styles.themeButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]} />
          </View>
        </View>
      </View>

      <View style={styles.generatingContainer}>
        <ActivityIndicator size="large" color={theme.primaryButton} />
        <Text style={[styles.generatingTitle, { color: theme.primaryText }]}>
          Creating Image Presentation
        </Text>
        <Text style={[styles.generatingDescription, { color: theme.primaryText }]}>
          Please wait while we generate your personalized solar proposal images...
        </Text>
      </View>
    </View>
  );

  const renderViewingStep = () => (
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
              onPress={() => setStep('sheets')}
            >
              <Ionicons name="arrow-back" size={20} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
              Video Presentation
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              {imageData?.customerName ? `Proposal for ${imageData.customerName}` : 'Your proposal images'}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.themeButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={toggleTheme}
            >
              <Ionicons name={isDark ? "sunny" : "moon"} size={20} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
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
          { flexGrow: 1 },
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
      >
        <View style={styles.imageContainer}>
          {imageData?.publicUrls && imageData.publicUrls.length > 0 && (
            <>
              <ScrollView
                showsHorizontalScrollIndicator={imageScale > 1}
                showsVerticalScrollIndicator={imageScale > 1}
                scrollEnabled={imageScale > 1}
                bounces={imageScale > 1}
                style={styles.imageScrollView}
                contentContainerStyle={styles.imageScrollContainer}
              >
                <View style={[styles.imageWrapper, { transform: [{ scale: imageScale }] }]}>
                  <Image
                    key={`image-${currentImageIndex}`} // Force re-render on index change
                    source={{ uri: `${API_BASE_URL.replace(/\/$/, '')}${imageData.publicUrls[currentImageIndex]}` }}
                    style={styles.presentationImage}
                    resizeMode="contain"
                    onLoad={() => {
                      // Mark as preloaded when loaded
                      preloadedImagesRef.current.add(currentImageIndex);
                    }}
                    onError={(error) => {
                      console.error('Image error:', error);
                      Alert.alert('Image Error', 'Failed to load image');
                    }}
                  />
                </View>
              </ScrollView>
              
              {/* Zoom Controls */}
              <View style={styles.zoomControls}>
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    imageScale <= 0.5 && styles.zoomButtonDisabled
                  ]}
                  onPress={handleZoomOut}
                  disabled={imageScale <= 0.5}
                >
                  <Ionicons name="remove-outline" size={20} color={imageScale <= 0.5 ? theme.secondaryText : theme.primaryText} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }
                  ]}
                  onPress={handleResetZoom}
                >
                  <Text style={[styles.zoomButtonText, { color: theme.primaryText }]}>
                    {Math.round(imageScale * 100)}%
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.zoomButton,
                    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                    imageScale >= 3 && styles.zoomButtonDisabled
                  ]}
                  onPress={handleZoomIn}
                  disabled={imageScale >= 3}
                >
                  <Ionicons name="add-outline" size={20} color={imageScale >= 3 ? theme.secondaryText : theme.primaryText} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.imageNavigation}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    { backgroundColor: theme.primaryButton },
                    currentImageIndex === 0 && styles.navButtonDisabled
                  ]}
                  onPress={handlePreviousImage}
                  disabled={currentImageIndex === 0}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                  <Text style={styles.navButtonText}>Previous</Text>
                </TouchableOpacity>
                
                <Text style={[styles.imageCounter, { color: theme.primaryText }]}>
                  {currentImageIndex + 1} / {imageData.publicUrls.length}
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    { backgroundColor: theme.primaryButton },
                    currentImageIndex === imageData.publicUrls.length - 1 && styles.navButtonDisabled
                  ]}
                  onPress={handleNextImage}
                  disabled={currentImageIndex === imageData.publicUrls.length - 1}
                >
                  <Text style={styles.navButtonText}>Next</Text>
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={[styles.actionsContainer, { backgroundColor: theme.secondaryBackground }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
            onPress={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="document-text" size={20} color="white" />
            )}
            <Text style={styles.actionButtonText}>
              {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.secondaryButton }]}
            onPress={handleShareImage}
          >
            <Ionicons name="share" size={20} color="white" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowHelpModal(true)}
          >
            <Ionicons name="help-circle" size={24} color={theme.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.successButton || '#10B981' }]}
            onPress={handleCompleteStep}
            disabled={isCompletingStep}
          >
            {isCompletingStep ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="arrow-forward" size={20} color="white" />
            )}
            <Text style={styles.nextButtonText}>
              {isCompletingStep ? 'Completing...' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Approval Code Modal - Auto-shows on last slide */}
      <Modal
        visible={showApprovalModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.approvalModalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.approvalIconContainer}>
              <View style={[styles.approvalIconCircle, { backgroundColor: '#10B981' }]}>
                <Ionicons name="checkmark-circle" size={48} color="white" />
              </View>
            </View>
            
            <Text style={[styles.approvalTitle, { color: theme.primaryText }]}>
              Assessment Code:
            </Text>
            
            <View style={[styles.approvalCodeContainer, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}>
              <Text style={[styles.approvalCode, { color: theme.primaryButton }]}>
                {getApprovalCode()}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.nextStepButton, { backgroundColor: theme.successButton || '#10B981' }]}
              onPress={() => {
                setShowApprovalModal(false);
                handleCompleteStep();
              }}
              disabled={isCompletingStep}
            >
              {isCompletingStep ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text style={styles.nextStepButtonText}>Next Step</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowApprovalModal(false)}
            >
              <Text style={[styles.closeModalText, { color: theme.secondaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help/Tutorial Modal */}
      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.helpModalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.helpModalHeader}>
              <Ionicons name="videocam" size={32} color={theme.accent} />
              <Text style={[styles.helpModalTitle, { color: theme.primaryText }]}>
                Presentation Guide
              </Text>
            </View>
            <Text style={[styles.helpModalDescription, { color: theme.secondaryText }]}>
              Watch this video tutorial to learn how to present the solar proposal effectively to your customers.
            </Text>
            <TouchableOpacity
              style={[styles.watchVideoButton, { backgroundColor: '#FF0000' }]}
              onPress={() => {
                Linking.openURL('https://www.youtube.com/watch?v=y7PbP45moQo');
              }}
            >
              <Ionicons name="logo-youtube" size={24} color="#ffffff" />
              <Text style={styles.watchVideoButtonText}>Watch on YouTube</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.helpModalCloseButton, { borderColor: theme.cardBorder }]}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={[styles.helpModalCloseText, { color: theme.secondaryText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 'sheets':
        return renderSheetsStep();
      case 'extracting':
      case 'generating':
        return renderGeneratingStep();
      case 'viewing':
        return renderViewingStep();
      default:
        return renderSheetsStep();
    }
  };

  return renderCurrentStep();
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
    transform: [{ translateX: -width * 0.4 }, { translateY: -height * 0.2 }],
    width: width * 0.8,
    height: height * 0.4,
    zIndex: 0,
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
    zIndex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    lineHeight: 34,
  },
  stepDescription: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  sheetsContainer: {
    gap: 16,
  },
  sheetCard: {
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'white',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedSheetCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    shadowColor: 'rgba(0, 122, 255, 0.2)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  sheetType: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetSize: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: width < 768 ? 24 : 32,
    paddingVertical: 48,
  },
  generatingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  generatingDescription: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
    maxWidth: 300,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
    minHeight: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageScrollView: {
    flex: 1,
    width: '100%',
  },
  imageScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height * 0.6,
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    minHeight: height * 0.6,
  },
  presentationImage: {
    width: width,
    height: height * 0.7,
    maxWidth: '100%',
    maxHeight: '100%',
  },
  zoomControls: {
    position: 'absolute',
    top: width < 768 ? 12 : 16,
    right: width < 768 ? 12 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: width < 768 ? 6 : 8,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: width < 768 ? 10 : 12,
    padding: width < 768 ? 4 : 6,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  imageNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: '100%',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingVertical: 20,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Help Button
  helpButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  approvalModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  approvalIconContainer: {
    marginBottom: 24,
  },
  approvalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  approvalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  approvalCodeContainer: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 28,
    alignItems: 'center',
  },
  approvalCode: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  nextStepButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  nextStepButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeModalText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Help Modal Styles
  helpModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  helpModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  helpModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  helpModalDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  watchVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  watchVideoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpModalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  helpModalCloseText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
