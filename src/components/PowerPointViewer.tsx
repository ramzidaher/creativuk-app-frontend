import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface PowerPointViewerProps {
  presentationUrl: string;
  filename?: string;
  onError?: (error: string) => void;
  onLoad?: () => void;
  style?: any;
}

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({
  presentationUrl,
  filename,
  onError,
  onLoad,
  style,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'embed' | 'download'>('embed');

  // Generate HTML content for PowerPoint display
  const generatePowerPointHTML = (url: string) => {
    // Check if it's a direct PowerPoint file URL
    const isDirectFile = url.toLowerCase().includes('.pptx') || url.toLowerCase().includes('.ppt');
    
    if (isDirectFile) {
      // For direct PowerPoint files, use Office Online viewer
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PowerPoint Viewer</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #f5f5f5;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .container {
              width: 100%;
              height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .viewer-container {
              width: 100%;
              height: 100%;
              border: none;
            }
            .error-message {
              text-align: center;
              padding: 20px;
              color: #666;
            }
            .loading {
              text-align: center;
              padding: 20px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <iframe 
              class="viewer-container"
              src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}&wdAr=1.7777777777777777"
              frameborder="0"
              allowfullscreen>
            </iframe>
          </div>
        </body>
        </html>
      `;
    } else {
      // For OneDrive/SharePoint embed URLs
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PowerPoint Viewer</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #f5f5f5;
            }
            .viewer-container {
              width: 100%;
              height: 100vh;
              border: none;
            }
          </style>
        </head>
        <body>
          <iframe 
            class="viewer-container"
            src="${url}"
            frameborder="0"
            allowfullscreen>
          </iframe>
        </body>
        </html>
      `;
    }
  };

  const handleWebViewLoad = () => {
    setLoading(false);
    setError(null);
    onLoad?.();
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    const errorMessage = `Failed to load PowerPoint: ${nativeEvent.description || 'Network error'}`;
    setError(errorMessage);
    setLoading(false);
    onError?.(errorMessage);
  };

  const handleDownloadPress = () => {
    if (Platform.OS === 'web') {
      // For web, open in new tab
      window.open(presentationUrl, '_blank');
    } else {
      // For mobile, use Linking
      const { Linking } = require('react-native');
      Linking.openURL(presentationUrl).catch((err: any) => {
        Alert.alert('Error', 'Could not open presentation');
      });
    }
  };

  const refreshViewer = () => {
    setLoading(true);
    setError(null);
  };

  if (error) {
    return (
      <View style={[styles.container, style, { backgroundColor: theme.primaryBackground }]}>
        <View style={[styles.errorContainer, { backgroundColor: theme.cardBackground }]}>
          <Feather name="alert-circle" size={48} color={theme.errorColor || '#ff6b6b'} />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>
            PowerPoint Viewer Error
          </Text>
          <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
            {error}
          </Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primaryColor }]}
              onPress={refreshViewer}
            >
              <Feather name="refresh-cw" size={16} color="white" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: theme.secondaryColor }]}
              onPress={handleDownloadPress}
            >
              <Feather name="download" size={16} color="white" />
              <Text style={styles.downloadButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { backgroundColor: theme.primaryBackground }]}>
      {/* Header with controls */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
            {filename || 'PowerPoint Presentation'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.tertiaryBackground }]}
            onPress={refreshViewer}
          >
            <Feather name="refresh-cw" size={16} color={theme.primaryText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.tertiaryBackground }]}
            onPress={handleDownloadPress}
          >
            <Feather name="download" size={16} color={theme.primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryColor} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading PowerPoint...
          </Text>
        </View>
      )}

      {/* WebView */}
      <WebView
        source={{ html: generatePowerPointHTML(presentationUrl) }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
        startInLoadingState={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsBackForwardNavigationGestures={true}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        onShouldStartLoadWithRequest={(request) => {
          // Allow navigation within Office Online and related domains
          const allowedDomains = [
            'view.officeapps.live.com',
            'office.com',
            'microsoft.com',
            'onedrive.live.com',
            'sharepoint.com',
            'localhost',
            '127.0.0.1'
          ];
          return allowedDomains.some(domain => request.url.includes(domain));
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryColor} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
              Loading PowerPoint...
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 6,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
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
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default PowerPointViewer;
