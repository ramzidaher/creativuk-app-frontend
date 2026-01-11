import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function DebugSignScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState('https://acrobat.adobe.com');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isWeb, setIsWeb] = useState(false);

  const addDebugInfo = (info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-4), `[${timestamp}] ${info}`]);
  };

  // Detect if running on web platform
  useEffect(() => {
    const isWebPlatform = Platform.OS === 'web';
    setIsWeb(isWebPlatform);
    addDebugInfo(`Platform detected: ${Platform.OS} (Web: ${isWebPlatform})`);
    
    if (isWebPlatform) {
      addDebugInfo('Web platform detected - will open Adobe Acrobat in new tab');
    } else {
      addDebugInfo('Mobile platform detected - will use WebView');
    }
  }, []);

  const handleWebViewLoad = () => {
    addDebugInfo('WebView loaded successfully');
    setLoading(false);
    setError(null);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    addDebugInfo(`WebView error: ${nativeEvent.description || 'Network error'}`);
    setError(`Failed to load Adobe Acrobat: ${nativeEvent.description || 'Network error'}`);
    setLoading(false);
  };

  const handleRefresh = () => {
    addDebugInfo('Refreshing WebView');
    setLoading(true);
    setError(null);
  };

  const handleTestUrl = () => {
    const testUrl = 'https://www.google.com';
    addDebugInfo(`Switching to test URL: ${testUrl}`);
    setCurrentUrl(testUrl);
    setLoading(true);
    setError(null);
  };

  const handleAdobeUrl = () => {
    const adobeUrl = 'https://acrobat.adobe.com';
    addDebugInfo(`Switching to Adobe Acrobat: ${adobeUrl}`);
    setCurrentUrl(adobeUrl);
    setLoading(true);
    setError(null);
  };

  const handleOpenInBrowser = async () => {
    try {
      let url = 'https://acrobat.adobe.com';
      
      // If PDF URL is provided, try to open it with Adobe Acrobat
      if (pdfUrl) {
        // Adobe Acrobat supports opening PDFs via URL parameters
        url = `https://acrobat.adobe.com/link/track?uri=${encodeURIComponent(pdfUrl)}`;
        addDebugInfo(`Opening PDF with Adobe Acrobat: ${pdfUrl}`);
      } else {
        addDebugInfo(`Opening Adobe Acrobat: ${url}`);
      }
      
      if (isWeb) {
        // On web, open in new tab
        window.open(url, '_blank');
        addDebugInfo('Opened Adobe Acrobat in new tab');
      } else {
        // On mobile, use Linking
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          addDebugInfo('Opened Adobe Acrobat in external browser');
        } else {
          Alert.alert('Error', 'Cannot open Adobe Acrobat in browser');
        }
      }
    } catch (error) {
      console.error('Error opening Adobe Acrobat in browser:', error);
      Alert.alert('Error', 'Failed to open Adobe Acrobat in browser');
    }
  };

  const handleSetPdfUrl = () => {
    Alert.prompt(
      'Set PDF URL',
      'Enter the URL of the PDF to sign:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Set', 
          onPress: (url) => {
            if (url && url.trim()) {
              setPdfUrl(url.trim());
              addDebugInfo(`PDF URL set: ${url.trim()}`);
            }
          }
        }
      ],
      'plain-text',
      pdfUrl || 'https://example.com/document.pdf'
    );
  };

  const handleClearPdfUrl = () => {
    setPdfUrl(null);
    addDebugInfo('PDF URL cleared');
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Debug Adobe Acrobat</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {isWeb ? 'Web: Opens in new tab' : 'Mobile: WebView integration'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.pdfButton, { backgroundColor: pdfUrl ? '#10b981' : '#6b7280' }]}
              onPress={handleSetPdfUrl}
            >
              <Feather name="file-text" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adobeButton, { backgroundColor: '#ff0000' }]}
              onPress={handleAdobeUrl}
            >
              <Feather name="edit" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.browserButton, { backgroundColor: '#3b82f6' }]}
              onPress={handleOpenInBrowser}
            >
              <Feather name={isWeb ? "external-link" : "external-link"} size={16} color="#ffffff" />
            </TouchableOpacity>
            {!isWeb && (
              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: theme.primaryButton }]}
                onPress={handleRefresh}
              >
                <Feather name="refresh-cw" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
          }
        ]}
      >

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
              Loading Adobe Acrobat...
            </Text>
          </View>
        )}

        {/* PDF URL Section */}
        <View style={styles.pdfContainer}>
          <View style={[styles.pdfCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.pdfHeader}>
              <Text style={[styles.pdfTitle, { color: theme.primaryText }]}>PDF Configuration</Text>
              {pdfUrl && (
                <TouchableOpacity
                  style={[styles.clearButton, { backgroundColor: '#ef4444' }]}
                  onPress={handleClearPdfUrl}
                >
                  <Feather name="x" size={14} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
            {pdfUrl ? (
              <View style={styles.pdfUrlContainer}>
                <Text style={[styles.pdfUrlLabel, { color: theme.secondaryText }]}>PDF URL:</Text>
                <Text style={[styles.pdfUrlText, { color: theme.primaryText }]} numberOfLines={2}>
                  {pdfUrl}
                </Text>
              </View>
            ) : (
              <Text style={[styles.pdfPlaceholder, { color: theme.secondaryText }]}>
                No PDF URL set. Tap the 📄 button to add one.
              </Text>
            )}
          </View>
        </View>

        {/* Debug Info */}
        <View style={styles.debugContainer}>
          <View style={[styles.debugCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.debugTitle, { color: theme.primaryText }]}>Debug Info</Text>
            <Text style={[styles.debugText, { color: theme.primaryText, fontWeight: '600' }]}>
              Platform: {Platform.OS} {isWeb ? '(Web)' : '(Mobile)'}
            </Text>
            <Text style={[styles.debugText, { color: theme.primaryText, fontWeight: '600' }]}>
              Mode: {isWeb ? 'New Tab' : 'WebView'}
            </Text>
            <Text style={[styles.debugText, { color: theme.primaryText, fontWeight: '600' }]}>
              URL: {currentUrl}
            </Text>
            {debugInfo.map((info, index) => (
              <Text key={index} style={[styles.debugText, { color: theme.secondaryText }]}>
                {info}
              </Text>
            ))}
          </View>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <View style={[styles.errorCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Ionicons name="warning-outline" size={48} color="#ef4444" />
              <Text style={[styles.errorTitle, { color: theme.primaryText }]}>Connection Error</Text>
              <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
                {error}
              </Text>
              <View style={styles.errorButtons}>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
                  onPress={handleRefresh}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.browserButton, { backgroundColor: '#3b82f6' }]}
                  onPress={handleOpenInBrowser}
                >
                  <Text style={styles.retryButtonText}>Open in Browser</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* WebView */}
      <WebView
        source={{ uri: currentUrl }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
        onLoadStart={() => {
          console.log('WebView: Starting to load', currentUrl);
          addDebugInfo(`Starting to load: ${currentUrl}`);
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          console.log('WebView: Finished loading', currentUrl);
          addDebugInfo(`Finished loading: ${currentUrl}`);
          setLoading(false);
        }}
        onNavigationStateChange={(navState) => {
          console.log('WebView: Navigation state changed:', navState.url);
          addDebugInfo(`Navigation: ${navState.url}`);
        }}
        startInLoadingState={true}
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
          console.log('WebView: Should start load with request:', request.url);
          // Allow navigation within Adobe domains, google.com for testing, and localhost
          const allowedDomains = ['adobe.com', 'acrobat.adobe.com', 'google.com', 'localhost', '127.0.0.1'];
          const isAllowed = allowedDomains.some(domain => request.url.includes(domain));
          console.log('WebView: Request allowed:', isAllowed);
          addDebugInfo(`Request ${isAllowed ? 'allowed' : 'blocked'}: ${request.url}`);
          return isAllowed;
        }}
        renderLoading={() => (
          <View style={styles.webviewLoadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.webviewLoadingText, { color: theme.secondaryText }]}>
              Loading {currentUrl}...
            </Text>
          </View>
        )}
        renderError={(errorDomain, errorCode, errorDesc) => (
          <View style={styles.errorContainer}>
            <View style={[styles.errorCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Ionicons name="warning-outline" size={48} color="#ef4444" />
              <Text style={[styles.errorTitle, { color: theme.primaryText }]}>WebView Error</Text>
              <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
                Domain: {errorDomain}
              </Text>
              <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
                Code: {errorCode}
              </Text>
              <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
                Description: {errorDesc}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
                onPress={handleRefresh}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: width * 0.8,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  browserButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  testButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  adobeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  debugContainer: {
    padding: 16,
  },
  debugCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  webview: {
    flex: 1,
  },
  webviewLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  webviewLoadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
