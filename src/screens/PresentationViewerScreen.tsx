import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Linking,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { workflowApi } from '../utils/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RouteParams {
  filename: string;
  opportunityId: string;
  customerName: string;
  pdfUrl: string;
}

const PresentationViewerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const { filename, opportunityId, customerName, pdfUrl } = route.params as RouteParams;
  
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isCompletingStep, setIsCompletingStep] = useState(false);

  useEffect(() => {
    // Component mounted
  }, []);


  const handleDownloadToPhone = async () => {
    // Check if PDF URL is available, otherwise fallback to PowerPoint
    let downloadUrl: string = '';
    let fileType: string = 'File';
    let downloadFilename: string = '';
    let fullDownloadUrl: string = '';
    
    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);
      
      if (pdfUrl) {
        downloadUrl = pdfUrl.replace('/view/', '/download/');
        fileType = 'PDF';
        downloadFilename = filename.replace('.pptx', '.pdf');
      } else {
        // Fallback to PowerPoint file
        downloadUrl = `/presentation/download/${filename}`;
        fileType = 'PowerPoint';
        downloadFilename = filename;
      }
      
      const fullDownloadUrl = downloadUrl.startsWith('http') ? downloadUrl : ` /api/${downloadUrl}`;
      
      console.log('📥 Original pdfUrl (for viewing):', pdfUrl);
      console.log('📥 Download URL (for downloading):', fullDownloadUrl);
      console.log('📥 Download filename:', downloadFilename);
      
      if (typeof window !== 'undefined') {
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
            throw new Error(`${fileType} file not found. Please try generating the proposal again.`);
          } else if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
        }
        
        // Check if we got a valid file
        const contentType = response.headers.get('content-type');
        console.log('📥 Response content-type:', contentType);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        // More flexible content-type validation
        const isValidFileType = contentType && (
          contentType.includes('pdf') || 
          contentType.includes('presentation') ||
          contentType.includes('application/octet-stream') ||
          contentType.includes('application/vnd.openxmlformats')
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
        Alert.alert('Download Complete!', `${fileType} has been downloaded successfully.`);
      } else {
        // For mobile, use public download URL (no authentication required)
        const publicDownloadUrl = fullDownloadUrl.replace('/presentation/download/', '/public/presentation/download/');
        console.log('📥 Using public download URL:', publicDownloadUrl);
        
        const fileName = downloadFilename;
        // Use cache directory instead of document directory for better compatibility
        const localPath = `${FileSystem.cacheDirectory}${fileName}`;
        
        console.log('📁 Saving to:', localPath);
        
        // Use fetch with public URL (no authentication required)
        const response = await fetch(publicDownloadUrl, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Download failed with status: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('📥 Downloaded blob size:', blob.size);
        
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
              
              console.log('📥 File saved to:', localPath);
              
              setLocalFilePath(localPath);
              setDownloaded(true);
              
              // Show options for what to do with the downloaded file
              Alert.alert(
                'Download Complete!',
                `${fileType} has been saved to your device. What would you like to do?`,
                [
                  { 
                    text: typeof window !== 'undefined' ? 'View in Browser' : 'View PDF', 
                    onPress: () => handleOpenInBrowser(pdfUrl) 
                  },
                  { 
                    text: 'Share File', 
                    onPress: () => handleShareFile(localPath, downloadFilename)
                  },
                  { text: 'OK' }
                ]
              );
              resolve(localPath);
            } catch (saveError) {
              console.error('📥 Error saving file:', saveError);
              setDownloadError('Failed to save file to device');
              setDownloading(false);
              reject(saveError);
            }
          };
          reader.onerror = () => {
            console.error('📥 FileReader error');
            setDownloadError('Failed to read file data');
            setDownloading(false);
            reject(new Error('Failed to read file data'));
          };
          reader.readAsDataURL(blob);
        });
        
        // The download is handled in the Promise above
      }
    } catch (error) {
      console.error('📥 Download error:', error);
      console.error('📥 Download URL was:', fullDownloadUrl);
      console.error('📥 File type was:', fileType);
      console.error('📥 Download filename was:', downloadFilename);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setDownloadError(errorMessage);
      setDownloadProgress(0);
      Alert.alert('Download Error', `Failed to download ${fileType}: ${errorMessage}`);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleOpenInBrowser = async (url?: string) => {
    try {
      // Always use the original PDF URL for browser viewing, not blob URLs
      const urlToOpen = url || pdfUrl;
      
      console.log('🌐 Original pdfUrl:', pdfUrl);
      console.log('🌐 URL to open:', urlToOpen);
      
      // If it's a blob URL, use the original PDF URL instead
      let finalUrl = urlToOpen;
      if (urlToOpen && urlToOpen.startsWith('blob:')) {
        console.log('🌐 Detected blob URL, using original PDF URL instead');
        finalUrl = pdfUrl; // Use the original PDF URL
      }
      
      // Convert to public view URL for better compatibility
      if (finalUrl && finalUrl.includes('/presentation/view/')) {
        finalUrl = finalUrl.replace('/presentation/view/', '/public/presentation/view/');
        console.log('🌐 Using public view URL:', finalUrl);
      }
      
      // Ensure we have a full URL with protocol for Linking
      if (finalUrl && !finalUrl.startsWith('http')) {
        finalUrl = ` /api/${finalUrl}`;
      }
      
      console.log('🌐 Final URL for browser:', finalUrl);
      
      if (typeof window !== 'undefined') {
        // For web (laptop/desktop), open in new tab - this works fine
        const supported = await Linking.canOpenURL(finalUrl);
        console.log('🌐 URL supported:', supported);
        
        if (supported) {
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert('Error', 'Cannot open this file in browser');
        }
      } else {
        // For mobile, open the PDF URL directly in the browser
        // This works better than trying to download and open with system apps
        console.log('📱 Mobile detected - opening PDF URL in browser');
        const supported = await Linking.canOpenURL(finalUrl);
        console.log('📱 URL supported:', supported);
        
        if (supported) {
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert('Error', 'Cannot open this PDF on your device. Please try downloading it instead.');
        }
      }
    } catch (error) {
      console.error('Error opening in browser:', error);
      Alert.alert('Error', 'Could not open file in browser');
    }
  };


  const handleShareFile = async (fileUri: string, filename: string) => {
    try {
      // For mobile, use Share to open the file with system apps
      // This will show options to open with PDF viewers, email, etc.
      await Share.share({
        url: fileUri,
        title: `Share ${filename}`,
        message: `Sharing ${filename}`
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Could not share file. Try using "View in Browser" instead.');
    }
  };

  const handleOpenDownloadedFile = async (fileUri: string) => {
    try {
      // For mobile, use Share to open the file with system apps
      await Share.share({
        url: fileUri,
        title: 'Open PDF',
        message: 'Opening PDF file'
      });
    } catch (error) {
      console.error('Error opening downloaded file:', error);
      Alert.alert('Error', 'Could not open downloaded file. Try using the "View in Browser" option instead.');
    }
  };

  const handleCompleteStep = async () => {
    try {
      setIsCompletingStep(true);
      console.log('🔧 Starting proposal generation step completion...');
      console.log('🔧 Opportunity ID:', opportunityId);
      
      // Mark proposal generation step as completed
      const stepData = {
        filename: filename,
        customerName: customerName,
        pdfUrl: pdfUrl,
        completedAt: new Date().toISOString(),
        downloaded: downloaded
      };
      
      console.log('🔧 Calling workflowApi.completeStep with data:', stepData);
      const result = await workflowApi.completeStep(opportunityId, 4, stepData);
      console.log('✅ Proposal generation step completed successfully:', result);
      
      // Verify the step was actually completed
      if (result && result.success) {
        console.log('🔍 Proposal generation step completed successfully, navigating to next step...');
        console.log('🔍 Navigation params:', { opportunityId });
        
        // Navigate directly to the next step: Contract Generation (step 5)
        (navigation as any).navigate('ContractGeneration', { opportunityId });
        
        console.log('🔍 Navigation call completed');
      } else {
        console.error('❌ Step completion failed:', result);
        Alert.alert('Error', 'Failed to complete proposal generation step. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error completing proposal generation step:', error);
      Alert.alert('Error', 'Failed to mark step as complete. Please try again.');
    } finally {
      setIsCompletingStep(false);
    }
  };




  return (
    <View style={[
      styles.container,
      { backgroundColor: theme.primaryBackground },
      ...(typeof window !== 'undefined' ? [{
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden' as const,
      }] : [])
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
              Proposal Generated
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              Your proposal is ready for download
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
      
      <View style={styles.content}>
        {/* Success Card */}
        <View style={[styles.successCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.successIconContainer}>
            <Feather name="check-circle" size={48} color="#10b981" />
          </View>
          <Text style={[styles.successTitle, { color: theme.primaryText }]}>
            Proposal Generated Successfully!
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.secondaryText }]}>
            Your solar proposal for {customerName} has been created and is ready for download.
          </Text>
        </View>

        {/* Download Section */}
        <View style={[styles.downloadCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.downloadHeader}>
            <Feather name="download" size={24} color={theme.primaryButton} />
            <Text style={[styles.downloadTitle, { color: theme.primaryText }]}>
              Download Your Proposal
            </Text>
          </View>
          
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
            onPress={handleDownloadToPhone}
            disabled={downloading}
          >
            <Feather 
              name={downloading ? "loader" : "download"} 
              size={20} 
              color="#fff" 
              style={downloading && styles.spinningIcon}
            />
            <Text style={styles.downloadButtonText}>
              {downloading 
                ? `Downloading... ${downloadProgress}%` 
                : downloadError 
                  ? 'Retry Download' 
                  : (pdfUrl ? 'Download & Save PDF' : 'Download PowerPoint')
              }
            </Text>
          </TouchableOpacity>

          {pdfUrl && (
            <TouchableOpacity 
              style={[styles.viewButton, { borderColor: theme.primaryButton }]} 
              onPress={() => handleOpenInBrowser(pdfUrl)}
            >
              <Feather name="eye" size={20} color={theme.primaryButton} />
              <Text style={[styles.viewButtonText, { color: theme.primaryButton }]}>
                {typeof window !== 'undefined' ? 'View in Browser' : 'View PDF'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Downloaded File Options */}
          {downloaded && localFilePath && (
            <View style={[styles.downloadedFileCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.downloadedFileHeader}>
                <Feather name="check-circle" size={20} color="#10b981" />
                <Text style={[styles.downloadedFileTitle, { color: theme.primaryText }]}>
                  File Downloaded Successfully
                </Text>
              </View>
              
              <View style={styles.downloadedFileActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: theme.primaryButton }]}
                  onPress={() => handleOpenInBrowser(pdfUrl)}
                >
                  <Feather name="eye" size={16} color="white" />
                  <Text style={styles.actionButtonText}>
                    {typeof window !== 'undefined' ? 'View in Browser' : 'View PDF'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: '#6b7280' }]}
                  onPress={() => handleShareFile(localFilePath, filename)}
                >
                  <Feather name="share" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Share File</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>


        {/* Complete Step Section */}
        <View style={[styles.completeCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.completeHeader}>
            <Feather name="check-square" size={24} color="#10b981" />
            <Text style={[styles.completeTitle, { color: theme.primaryText }]}>
              Mark Step as Complete
            </Text>
          </View>
          <Text style={[styles.completeSubtitle, { color: theme.secondaryText }]}>
            Once you've downloaded the proposal, mark this step as complete to continue with the workflow. Your proposal files will be automatically copied to the OneDrive quotations folder.
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.completeButton, 
              { backgroundColor: theme.successButton },
              isCompletingStep && styles.completeButtonDisabled
            ]} 
            onPress={handleCompleteStep}
            disabled={isCompletingStep}
          >
            <Feather 
              name={isCompletingStep ? "loader" : "check"} 
              size={20} 
              color="#fff" 
              style={isCompletingStep && styles.spinningIcon}
            />
            <Text style={styles.completeButtonText}>
              {isCompletingStep ? 'Completing...' : 'Complete Step'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.05,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  },
  
  // Modern Header Styles
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: screenWidth < 768 ? 16 : 24,
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
    gap: screenWidth < 768 ? 12 : 16,
  },
  backButton: {
    padding: screenWidth < 768 ? 12 : 14,
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
    fontSize: screenWidth < 768 ? 24 : 28,
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
    padding: screenWidth < 768 ? 12 : 14,
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
  
  // Content Styles
  content: {
    flex: 1,
    paddingHorizontal: screenWidth < 768 ? 16 : 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  
  // Success Card
  successCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  
  // Download Card
  downloadCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  downloadTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
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
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Complete Card
  completeCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  completeTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  completeSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 20,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Animation
  spinningIcon: {
    transform: [{ rotate: '0deg' }],
  },
  
  // Downloaded File Section
  downloadedFileCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 12,
  },
  downloadedFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  downloadedFileTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  downloadedFileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PresentationViewerScreen;
