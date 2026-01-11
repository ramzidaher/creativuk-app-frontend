import React, { useState, useEffect } from 'react';
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
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface AdobeSignScreenProps {
  route: {
    params: {
      opportunityId: string;
      customerName: string;
      customerEmail: string;
    };
  };
}

export default function AdobeSignScreen({ route }: AdobeSignScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { opportunityId, customerName, customerEmail } = route.params;

  console.log('🔍 AdobeSignScreen loaded with params:', { opportunityId, customerName, customerEmail });
  console.log('🔍 AdobeSignScreen: Adobe Sign has better mobile support!');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('AdobeSign: Loading timeout reached');
        setError('Loading timeout - Adobe Sign may be taking longer than expected. Try refreshing or check your connection.');
        setLoading(false);
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleWebViewLoad = () => {
    console.log('AdobeSign: WebView loaded successfully');
    setLoading(false);
    setError(null);
  };

  const handleWebViewError = (error: any) => {
    console.error('AdobeSign: WebView error:', error);
    setError('Failed to load Adobe Sign. Please try again.');
    setLoading(false);
  };

  const handleOpenInBrowser = () => {
    // Open in external browser for better compatibility
    if (Platform.OS === 'web') {
      window.open('https://documentcloud.adobe.com/link/home/', '_blank');
    } else {
      Linking.openURL('https://documentcloud.adobe.com/link/home/');
    }
  };

  const handleRefresh = () => {
    setError(null);
    setLoading(true);
    setWebViewKey(prev => prev + 1); // Force WebView reload
  };

  // Adobe Sign optimized JavaScript injection
  const adobeSignScript = `
    (function() {
      console.log('🔍 Adobe Sign: Initializing mobile optimizations...');
      
      // Adobe Sign mobile optimizations
      const style = document.createElement('style');
      style.textContent = \`
        /* Force mobile-friendly layout */
        body {
          font-size: 16px !important;
          -webkit-text-size-adjust: 100% !important;
          zoom: 1 !important;
        }
        
        /* Optimize form elements for touch */
        input, button, select, textarea {
          font-size: 16px !important;
          padding: 12px !important;
          min-height: 44px !important;
          touch-action: manipulation !important;
        }
        
        /* Improve signature pad for mobile */
        .signature-pad, [class*="signature"] {
          min-height: 200px !important;
          touch-action: none !important;
        }
        
        /* Mobile-friendly navigation */
        .nav, .navigation, [class*="nav"] {
          font-size: 18px !important;
          padding: 15px !important;
        }
        
        /* Responsive containers */
        .container, .main, [class*="container"] {
          max-width: 100% !important;
          padding: 10px !important;
          margin: 0 !important;
        }
        
        /* Hide desktop-only elements */
        [class*="desktop"], .desktop-only {
          display: none !important;
        }
        
        /* Optimize modal dialogs */
        .modal, [class*="modal"] {
          width: 95% !important;
          max-width: 95% !important;
          margin: 10px auto !important;
        }
      \`;
      document.head.appendChild(style);
      
      // Auto-fill customer information if forms are present
      setTimeout(() => {
        const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
        emailInputs.forEach(input => {
          if (input && !input.value) {
            input.value = '${customerEmail}';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('🔍 Adobe Sign: Auto-filled email');
          }
        });
        
        const nameInputs = document.querySelectorAll('input[name*="name"], input[placeholder*="name" i], input[name*="signer"]');
        nameInputs.forEach(input => {
          if (input && !input.value) {
            input.value = '${customerName}';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('🔍 Adobe Sign: Auto-filled name');
          }
        });
      }, 2000);
      
      // Monitor for signature completion
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Look for completion indicators
            const completionElements = document.querySelectorAll('[class*="complete"], [class*="success"], [class*="finished"]');
            if (completionElements.length > 0) {
              console.log('🔍 Adobe Sign: Document signing may be complete');
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'SIGNATURE_COMPLETE',
                message: 'Document signing completed'
              }));
            }
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('🔍 Adobe Sign: Mobile optimizations applied');
    })();
    
    true; // Prevent any return value issues
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('🔍 Adobe Sign: Received message:', data);
      
      if (data.type === 'SIGNATURE_COMPLETE') {
        Alert.alert(
          'Signature Complete',
          'Document has been signed successfully!',
          [
            {
              text: 'Continue',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.log('🔍 Adobe Sign: Message parsing error:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Adobe Sign</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            {customerName} - {customerEmail}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.refreshButton, { marginLeft: 8 }]}
          onPress={handleOpenInBrowser}
        >
          <Ionicons name="globe" size={24} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading Adobe Sign...
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={theme.dangerButton} />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>
            Loading Error
          </Text>
          <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
            {error}
          </Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.secondaryButton, marginLeft: 8 }]}
              onPress={handleOpenInBrowser}
            >
              <Ionicons name="globe" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Open Browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* WebView for Mobile and Web */}
      {Platform.OS === 'web' ? (
        <iframe
          src="https://documentcloud.adobe.com/link/home/"
          style={styles.iframe}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-storage-access-by-user-activation"
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write; storage-access"
          referrerPolicy="no-referrer-when-downgrade"
          title="Adobe Sign"
        />
      ) : (
        <WebView
          key={webViewKey}
          source={{ uri: 'https://documentcloud.adobe.com/link/home/' }}
          style={styles.webview}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          onMessage={handleWebViewMessage}
          injectedJavaScript={adobeSignScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
          allowsBackForwardNavigationGestures={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          userAgent="Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
          onShouldStartLoadWithRequest={(request) => {
            console.log('🔍 Adobe Sign: Navigation to:', request.url);
            return true;
          }}
          onNavigationStateChange={(navState) => {
            console.log('🔍 Adobe Sign: Navigation state:', navState.url);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  webview: {
    flex: 1,
  },
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
  } as any,
});
