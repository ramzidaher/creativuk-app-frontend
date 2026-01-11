import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

export default function DocuSealScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docuSealLoaded, setDocuSealLoaded] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log('DocuSeal: Loading timeout reached');
        setError('Loading timeout - DocuSeal may be taking longer than expected. Try refreshing or check your connection.');
        setLoading(false);
      }
    }, 30000); // 30 second timeout

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading]);

  // Mobile-optimized user agent for DocuSeal
  const mobileUserAgent = "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

  const handleWebViewLoad = () => {
    console.log('DocuSeal: WebView loaded successfully');
    setLoading(false);
    setError(null);
    setDocuSealLoaded(true);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('DocuSeal: WebView error: ', nativeEvent);
    setError(`Failed to load DocuSeal: ${nativeEvent.description || 'Unknown error'}`);
    setLoading(false);
  };

  const handleWebViewHttpError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('DocuSeal: WebView HTTP error: ', nativeEvent);
    setError(`HTTP Error ${nativeEvent.statusCode}: ${nativeEvent.description || 'Failed to load'}`);
    setLoading(false);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('DocuSeal WebView message:', data);
    } catch (e) {
      console.log('DocuSeal WebView message (non-JSON):', event.nativeEvent.data);
    }
  };

  const injectMobileOptimizationScript = () => {
    return `
      (function() {
        console.log('DocuSeal: Starting mobile optimization injection');
        
        // Optimize for mobile experience
        const style = document.createElement('style');
        style.textContent = \`
          /* Mobile-optimized styles */
          body { 
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
          }
          
          /* Ensure touch targets are large enough */
          button, input, select, textarea, a {
            min-height: 44px;
            min-width: 44px;
          }
          
          /* Optimize form inputs for mobile */
          input, textarea, select {
            font-size: 16px; /* Prevents zoom on iOS */
            border-radius: 8px;
            padding: 12px;
          }
          
          /* Improve button styling */
          button {
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 600;
          }
          
          /* Optimize document viewer */
          .document-viewer, .pdf-viewer, canvas {
            max-width: 100%;
            height: auto;
          }
          
          /* Improve signature pad */
          .signature-pad, canvas {
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
          }
        \`;
        document.head.appendChild(style);

        // Add viewport meta tag for mobile optimization
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        } else {
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
          document.head.appendChild(meta);
        }

        // Optimize touch events for better mobile experience
        document.addEventListener('touchstart', function(e) {
          // Prevent double-tap zoom
          if (e.touches.length > 1) {
            e.preventDefault();
          }
        }, { passive: false });

        // Prevent zoom on input focus (iOS)
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.addEventListener('focus', function() {
            if (this.style.fontSize !== '16px') {
              this.style.fontSize = '16px';
            }
          });
        });

        console.log('DocuSeal: Mobile optimization completed');
        
        // Notify React Native
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'docuSealOptimized',
          status: true
        }));
      })();
    `;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: theme.borderColor }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                DocuSeal
              </Text>
              {docuSealLoaded && (
                <View style={[styles.statusIndicator, { backgroundColor: theme.successButton }]}>
                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                  <Text style={styles.statusText}>Ready</Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              Mobile-optimized document signing
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.secondaryButton }]}
            onPress={() => {
              console.log('DocuSeal: Refreshing WebView');
              setError(null);
              setLoading(true);
              setDocuSealLoaded(false);
              if (webViewRef.current) {
                webViewRef.current.reload();
              }
            }}
          >
            <Text style={styles.testButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Message */}
      {docuSealLoaded && !error && (
        <View style={[styles.successContainer, { backgroundColor: theme.successButton + '20' }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.successButton} />
          <Text style={[styles.successText, { color: theme.successButton }]}>
            DocuSeal loaded successfully! Mobile-optimized for the best signing experience.
          </Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.dangerButton + '20' }]}>
          <Ionicons name="warning" size={20} color={theme.dangerButton} />
          <Text style={[styles.errorText, { color: theme.dangerButton }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => {
              setError(null);
              setLoading(true);
              if (webViewRef.current) {
                webViewRef.current.reload();
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.secondaryButton }]}
            onPress={() => {
              Alert.alert(
                'Open in Browser',
                'Would you like to open DocuSeal in your default browser instead?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Open Browser', 
                    onPress: () => Linking.openURL('https://www.docuseal.eu')
                  }
                ]
              );
            }}
          >
            <Text style={styles.retryButtonText}>Open Browser</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://www.docuseal.eu' }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onHttpError={handleWebViewHttpError}
        onMessage={handleWebViewMessage}
        onLoadStart={() => {
          console.log('DocuSeal: Starting to load DocuSeal');
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          console.log('DocuSeal: Finished loading DocuSeal');
          setLoading(false);
          // Inject mobile optimization script after load
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(injectMobileOptimizationScript());
            }
          }, 1000);
        }}
        onNavigationStateChange={(navState) => {
          console.log('DocuSeal: Navigation state changed:', navState.url);
          
          // Check if we've successfully navigated to DocuSeal content
          if (navState.url.includes('docuseal.eu') && !navState.loading) {
            setDocuSealLoaded(true);
            setError(null);
          }
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
        userAgent={mobileUserAgent}
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={true}
        automaticallyAdjustContentInsets={true}
        contentInsetAdjustmentBehavior="automatic"
        onShouldStartLoadWithRequest={(request) => {
          console.log('DocuSeal: Should start load with request:', request.url);
          // Allow navigation within DocuSeal domain and related domains
          const allowedDomains = [
            'docuseal.eu', 
            'www.docuseal.eu', 
            'app.docuseal.eu',
            'api.docuseal.eu',
            'cdn.docuseal.eu',
            'fonts.googleapis.com',
            'fonts.gstatic.com',
            'googleapis.com',
            'gstatic.com',
            'google.com',
            'www.google.com'
          ];
          const isAllowed = allowedDomains.some(domain => request.url.includes(domain));
          console.log('DocuSeal: Request allowed:', isAllowed);
          return isAllowed;
        }}
        injectedJavaScript={injectMobileOptimizationScript()}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.primaryText }]}>
              Loading DocuSeal...
            </Text>
          </View>
        )}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.primaryBackground }]}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading DocuSeal...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  testButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
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
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});
