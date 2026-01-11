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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SignComWebScreenProps {
  route: {
    params: {
      opportunityId: string;
      customerName: string;
      customerEmail: string;
    };
  };
}

export default function SignComWebScreen({ route }: SignComWebScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { opportunityId, customerName, customerEmail } = route.params;
  
  console.log('🔍 SignComWebScreen loaded with params:', { opportunityId, customerName, customerEmail });
  console.log('🔍 SignComWebScreen: Using iframe for web compatibility!');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('SignCom: Loading timeout reached');
        setError('Loading timeout - sign.com may be taking longer than expected. Try refreshing or check your connection.');
        setLoading(false);
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleIframeLoad = () => {
    console.log('SignCom: Iframe loaded successfully');
    setLoading(false);
    setError(null);
    
    // Inject aggressive cookie and storage access workarounds
    const iframe = document.getElementById('signcom-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        // Request storage access for third-party cookies
        const script = `
          (async function() {
            console.log('SignCom: Requesting storage access...');
            
            // Request storage access API (modern browsers)
            if ('requestStorageAccess' in document) {
              try {
                await document.requestStorageAccess();
                console.log('SignCom: Storage access granted');
              } catch (e) {
                console.log('SignCom: Storage access denied:', e);
              }
            }
            
            // Override cookie handling to use localStorage as fallback
            const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
            if (originalCookieDescriptor) {
              Object.defineProperty(document, 'cookie', {
                get() {
                  const stored = localStorage.getItem('signcom_cookies') || '';
                  console.log('SignCom: Getting cookies from localStorage:', stored);
                  return stored;
                },
                set(value) {
                  console.log('SignCom: Setting cookie to localStorage:', value);
                  localStorage.setItem('signcom_cookies', value);
                  // Also try to set the real cookie
                  try {
                    originalCookieDescriptor.set?.call(this, value);
                  } catch (e) {
                    console.log('SignCom: Real cookie setting failed, using localStorage only');
                  }
                },
                configurable: true
              });
            }
            
            // Force SameSite=None for all cookies
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              const [url, options = {}] = args;
              return originalFetch(url, {
                ...options,
                credentials: 'include',
                mode: 'cors'
              });
            };
            
            console.log('SignCom: Cookie workarounds applied');
          })();
        `;
        
        // Wait for iframe to be ready, then inject script
        setTimeout(() => {
          if (iframe.contentDocument) {
            const scriptElement = iframe.contentDocument.createElement('script');
            scriptElement.textContent = script;
            iframe.contentDocument.head?.appendChild(scriptElement);
          }
        }, 1000);
      } catch (e) {
        console.log('SignCom: Could not inject cookie workarounds:', e);
      }
    }
  };

  const handleIframeError = () => {
    console.error('SignCom: Iframe error');
    setError('Failed to load sign.com. Please try again.');
    setLoading(false);
  };

  const handleOpenInBrowser = () => {
    // Open in new tab/window for better authentication support
    if (Platform.OS === 'web') {
      window.open('https://sign.com', '_blank');
    } else {
      Linking.openURL('https://sign.com');
    }
  };

  const handleRefresh = () => {
    setError(null);
    setLoading(true);
    // Force iframe reload by changing key
    window.location.reload();
  };

  const handleRequestStorageAccess = async () => {
    try {
      console.log('SignCom: Requesting storage access permission...');
      
      // Request storage access for the current domain
      if ('requestStorageAccess' in document) {
        await (document as any).requestStorageAccess();
        console.log('SignCom: Storage access granted for main document');
      }
      
      // Also request for the iframe specifically
      const iframe = document.getElementById('signcom-iframe') as HTMLIFrameElement;
      if (iframe?.contentDocument && 'requestStorageAccess' in iframe.contentDocument) {
        await (iframe.contentDocument as any).requestStorageAccess();
        console.log('SignCom: Storage access granted for iframe');
      }
      
      // Reload the iframe after getting permission
      if (iframe) {
        iframe.src = iframe.src;
      }
      
      Alert.alert('Success', 'Storage access granted! Please try logging in again.');
    } catch (error) {
      console.error('SignCom: Storage access request failed:', error);
      Alert.alert('Info', 'Storage access request failed, but you can still try logging in. Some browsers may still work.');
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
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Sign.com</Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            {customerName} - {customerEmail}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRequestStorageAccess}
          title="Fix Login Issues"
        >
          <Ionicons name="key" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.refreshButton, { marginLeft: 8 }]}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading Sign.com...
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
              onPress={handleRequestStorageAccess}
            >
              <Ionicons name="key" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Fix Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.secondaryButton, marginLeft: 8 }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.tertiaryBackground, marginLeft: 8 }]}
              onPress={handleOpenInBrowser}
            >
              <Ionicons name="globe" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Iframe for Web with aggressive cookie workarounds */}
      {Platform.OS === 'web' && (
        <iframe
          src="https://sign.com"
          style={styles.iframe}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-storage-access-by-user-activation"
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write; storage-access; cross-origin-isolated"
          referrerPolicy="no-referrer-when-downgrade"
          credentialless="true"
          title="Sign.com"
          id="signcom-iframe"
        />
      )}

      {/* Fallback for non-web platforms */}
      {Platform.OS !== 'web' && (
        <View style={styles.fallbackContainer}>
          <Ionicons name="globe" size={64} color={theme.secondaryText} />
          <Text style={[styles.fallbackTitle, { color: theme.primaryText }]}>
            Web Platform Required
          </Text>
          <Text style={[styles.fallbackMessage, { color: theme.secondaryText }]}>
            Sign.com integration requires a web browser. Please use the web version of the app.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleOpenInBrowser}
          >
            <Ionicons name="globe" size={20} color="#ffffff" />
            <Text style={styles.retryButtonText}>Open in Browser</Text>
          </TouchableOpacity>
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
  iframe: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  fallbackMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
});
