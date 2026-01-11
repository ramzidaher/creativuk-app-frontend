import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import PowerPointViewer from '../components/PowerPointViewer';
import { useTheme } from '../context/ThemeContext';
import { workflowApi } from '../utils/api';

const { width } = Dimensions.get('window');

interface RouteParams {
  filename: string;
  opportunityId: string;
  customerName: string;
  pptxUrl?: string;
  pdfUrl?: string;
}

const PowerPointViewerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  
  const { filename, opportunityId, customerName, pptxUrl, pdfUrl } = route.params as RouteParams;
  
  const [viewMode, setViewMode] = useState<'powerpoint' | 'pdf'>('powerpoint');
  const [powerPointUrl, setPowerPointUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeViewer();
  }, []);

  const initializeViewer = async () => {
    try {
      setLoading(true);
      setError(null);

      // If pptxUrl is provided directly, use it
      if (pptxUrl) {
        setPowerPointUrl(pptxUrl);
        setLoading(false);
        return;
      }

      // Otherwise, try to get the PowerPoint URL from the backend
      const baseUrl = ' /api/'; // Your current backend URL
      const pptxUrl = `${baseUrl}/presentation/view/${filename}`;
      
      // Test if the PowerPoint file is accessible
      try {
        const response = await fetch(pptxUrl, {
          method: 'HEAD', // Just check if file exists
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (response.ok) {
          setPowerPointUrl(pptxUrl);
        } else {
          throw new Error('PowerPoint file not accessible');
        }
      } catch (fetchError) {
        console.log('PowerPoint file not accessible, falling back to PDF mode');
        setViewMode('pdf');
        setError('PowerPoint file not available. Showing PDF version instead.');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error initializing PowerPoint viewer:', error);
      setError('Failed to load presentation');
      setLoading(false);
    }
  };

  const handlePowerPointError = (error: string) => {
    console.error('PowerPoint viewer error:', error);
    setError(error);
    // Automatically fallback to PDF mode
    setViewMode('pdf');
  };

  const handlePowerPointLoad = () => {
    console.log('PowerPoint loaded successfully');
    setError(null);
  };

  const toggleViewMode = () => {
    if (viewMode === 'powerpoint' && pdfUrl) {
      setViewMode('pdf');
    } else if (viewMode === 'pdf' && powerPointUrl) {
      setViewMode('powerpoint');
    }
  };

  const handleDownload = async () => {
    try {
      const downloadUrl = viewMode === 'powerpoint' 
        ? powerPointUrl.replace('/view/', '/download/')
        : pdfUrl?.replace('/view/', '/download/');
      
      if (!downloadUrl) {
        Alert.alert('Error', 'Download URL not available');
        return;
      }

      if (Platform.OS === 'web') {
        // For web, open in new tab
        window.open(downloadUrl, '_blank');
      } else {
        // For mobile, use Linking
        const { Linking } = require('react-native');
        await Linking.openURL(downloadUrl);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const handleCompleteStep = async () => {
    try {
      // Mark the presentation step as completed
      await workflowApi.completeStep(opportunityId, 'presentation', {
        viewed: true,
        viewMode: viewMode,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        'Step Completed',
        'Presentation viewing step has been marked as complete.',
        [
          {
            text: 'OK',
            onPress: () => {
              (navigation as any).navigate('SolarWorkflow', { 
                opportunityId: opportunityId,
                opportunity: null
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error completing step:', error);
      Alert.alert('Error', 'Failed to complete step');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading presentation...
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
        source={require('../../assets/creativ NB.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Header */}
      <SafeAreaView style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={() => {
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
                {viewMode === 'powerpoint' ? 'PowerPoint Presentation' : 'PDF Presentation'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {customerName || 'Solar Proposal'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* View Mode Toggle */}
            {(powerPointUrl && pdfUrl) && (
              <TouchableOpacity
                style={[styles.modeButton, { backgroundColor: theme.tertiaryBackground }]}
                onPress={toggleViewMode}
              >
                <Feather 
                  name={viewMode === 'powerpoint' ? 'file-text' : 'monitor'} 
                  size={16} 
                  color={theme.primaryText} 
                />
                <Text style={[styles.modeButtonText, { color: theme.primaryText }]}>
                  {viewMode === 'powerpoint' ? 'PDF' : 'PPT'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Download Button */}
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: theme.primaryColor }]}
              onPress={handleDownload}
            >
              <Feather name="download" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Error Message */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.errorBackground || '#ffebee' }]}>
          <Feather name="alert-circle" size={16} color={theme.errorColor || '#f44336'} />
          <Text style={[styles.errorText, { color: theme.errorColor || '#f44336' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {viewMode === 'powerpoint' && powerPointUrl ? (
          <PowerPointViewer
            presentationUrl={powerPointUrl}
            filename={filename}
            onError={handlePowerPointError}
            onLoad={handlePowerPointLoad}
            style={styles.viewer}
          />
        ) : pdfUrl ? (
          <PowerPointViewer
            presentationUrl={pdfUrl}
            filename={filename.replace('.pptx', '.pdf')}
            onError={handlePowerPointError}
            onLoad={handlePowerPointLoad}
            style={styles.viewer}
          />
        ) : (
          <View style={[styles.noContentContainer, { backgroundColor: theme.cardBackground }]}>
            <Feather name="file" size={48} color={theme.secondaryText} />
            <Text style={[styles.noContentTitle, { color: theme.primaryText }]}>
              No Presentation Available
            </Text>
            <Text style={[styles.noContentText, { color: theme.secondaryText }]}>
              The presentation file could not be loaded. Please try generating the proposal again.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primaryColor }]}
              onPress={initializeViewer}
            >
              <Feather name="refresh-cw" size={16} color="white" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Footer with Complete Step Button */}
      <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.borderColor }]}>
        <TouchableOpacity
          style={[styles.completeButton, { backgroundColor: theme.primaryColor }]}
          onPress={handleCompleteStep}
        >
          <Feather name="check" size={16} color="white" />
          <Text style={styles.completeButtonText}>Complete Step</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImageStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    zIndex: -1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  viewer: {
    flex: 1,
  },
  noContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  noContentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noContentText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PowerPointViewerScreen;
