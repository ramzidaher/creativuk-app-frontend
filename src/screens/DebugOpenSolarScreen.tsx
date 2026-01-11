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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function DebugOpenSolarScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState('https://app.opensolar.com');
  const [isWeb, setIsWeb] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiKey: '',
  });
  const [showCredentials, setShowCredentials] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const addDebugInfo = (info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-4), `[${timestamp}] ${info}`]);
  };

  // Detect if running on web platform and load credentials
  useEffect(() => {
    const isWebPlatform = Platform.OS === 'web';
    setIsWeb(isWebPlatform);
    addDebugInfo(`Platform detected: ${Platform.OS} (Web: ${isWebPlatform})`);
    
    if (isWebPlatform) {
      addDebugInfo('Web platform detected - will open OpenSolar in new tab');
    } else {
      addDebugInfo('Mobile platform detected - will use WebView');
    }

    // Load saved credentials or use defaults
    const savedCredentials = {
      username: user?.email || 'your-email@example.com',
      password: 'your-password',
      apiKey: 'your-api-key',
    };
    setCredentials(savedCredentials);
    addDebugInfo('Credentials loaded');
  }, [user]);

  const handleWebViewLoad = () => {
    addDebugInfo('WebView loaded successfully');
    setLoading(false);
    setError(null);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    addDebugInfo(`WebView error: ${nativeEvent.description || 'Network error'}`);
    setError(`Failed to load OpenSolar: ${nativeEvent.description || 'Network error'}`);
    setLoading(false);
  };

  const handleRefresh = () => {
    addDebugInfo('Refreshing WebView');
    setLoading(true);
    setError(null);
  };

  const handleOpenInBrowser = async () => {
    try {
      let url = currentUrl;
      
      // If we have authentication token, use it for browser opening too
      if (authToken && orgId) {
        url = `https://app.opensolar.com/?token=${authToken}&org_id=${orgId}`;
        addDebugInfo(`Opening authenticated URL in browser: ${url}`);
      } else {
        addDebugInfo(`Opening in browser: ${url}`);
      }
      
      if (isWeb) {
        // On web, open in new tab
        window.open(url, '_blank');
        addDebugInfo('Opened OpenSolar in new tab');
      } else {
        // On mobile, use Linking
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          addDebugInfo('Opened OpenSolar in external browser');
        } else {
          Alert.alert('Error', 'Cannot open OpenSolar in browser');
        }
      }
    } catch (error) {
      console.error('Error opening OpenSolar in browser:', error);
      Alert.alert('Error', 'Failed to open OpenSolar in browser');
    }
  };

  const handleSetCredentials = () => {
    Alert.prompt(
      'Set Username',
      'Enter your OpenSolar username/email:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Next', 
          onPress: (username) => {
            if (username && username.trim()) {
              Alert.prompt(
                'Set Password',
                'Enter your OpenSolar password:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Next', 
                    onPress: (password) => {
                      if (password && password.trim()) {
                        Alert.prompt(
                          'Set API Key',
                          'Enter your OpenSolar API key (optional):',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Save', 
                              onPress: (apiKey) => {
                                setCredentials({
                                  username: username.trim(),
                                  password: password.trim(),
                                  apiKey: apiKey?.trim() || '',
                                });
                                addDebugInfo(`Credentials updated for: ${username.trim()}`);
                              }
                            }
                          ],
                          'plain-text',
                          credentials.apiKey
                        );
                      }
                    }
                  }
                ],
                'secure-text',
                credentials.password
              );
            }
          }
        }
      ],
      'plain-text',
      credentials.username
    );
  };

  const handleLoginWithCredentials = async () => {
    if (!credentials.username || !credentials.password) {
      Alert.alert('Error', 'Please set username and password first');
      return;
    }

    addDebugInfo(`Attempting API authentication with: ${credentials.username}`);
    setLoading(true);
    setError(null);

    try {
      // Use the same authentication method as the backend service
      const response = await fetch('https://api.opensolar.com/api-token-auth/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const token = data.token;
      const orgId = data.org_id || (data.orgs?.[0]?.id);

      if (!token || !orgId) {
        throw new Error('No token or org_id returned in login response');
      }

      addDebugInfo(`✅ Authentication successful! Org ID: ${orgId}`);
      
      // Store the token and orgId for later use
      setAuthToken(token);
      setOrgId(orgId.toString());
      
      // Now redirect to OpenSolar app with the token
      const appUrl = `https://app.opensolar.com/?token=${token}&org_id=${orgId}`;
      setCurrentUrl(appUrl);
      addDebugInfo(`Redirecting to OpenSolar app with token`);
      
    } catch (error) {
      console.error('OpenSolar authentication error:', error);
      addDebugInfo(`❌ Authentication failed: ${error.message}`);
      setError(`Authentication failed: ${error.message}`);
      setLoading(false);
    }
  };

  const handleInjectCredentials = () => {
    if (!credentials.username || !credentials.password) {
      Alert.alert('Error', 'Please set username and password first');
      return;
    }

    addDebugInfo('Injecting credentials into WebView');
    
    // JavaScript to inject credentials into the page
    const injectScript = `
      (function() {
        // Try to find username/email field
        const usernameField = document.querySelector('input[type="email"], input[name="email"], input[name="username"], input[placeholder*="email"], input[placeholder*="username"]');
        if (usernameField) {
          usernameField.value = '${credentials.username}';
          usernameField.dispatchEvent(new Event('input', { bubbles: true }));
          usernameField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Try to find password field
        const passwordField = document.querySelector('input[type="password"], input[name="password"]');
        if (passwordField) {
          passwordField.value = '${credentials.password}';
          passwordField.dispatchEvent(new Event('input', { bubbles: true }));
          passwordField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Try to find and click login button
        const loginButton = document.querySelector('button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign In"), .login-button, .signin-button');
        if (loginButton) {
          setTimeout(() => loginButton.click(), 1000);
        }
        
        console.log('Credentials injected successfully');
      })();
    `;

    // This would be injected via WebView's injectedJavaScript prop
    addDebugInfo('Credentials injection script prepared');
  };

  const handleClearAuth = () => {
    setAuthToken(null);
    setOrgId(null);
    setCurrentUrl('https://app.opensolar.com');
    addDebugInfo('Authentication cleared');
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
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Debug OpenSolar</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {isWeb ? 'Web: Opens in new tab' : 'Mobile: WebView with credentials'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.credentialsButton, { backgroundColor: credentials.username ? '#10b981' : '#6b7280' }]}
              onPress={handleSetCredentials}
            >
              <Feather name="user" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: authToken ? '#10b981' : '#3b82f6' }]}
              onPress={handleLoginWithCredentials}
            >
              <Feather name={authToken ? "check" : "log-in"} size={16} color="#ffffff" />
            </TouchableOpacity>
            {authToken && (
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: '#ef4444' }]}
                onPress={handleClearAuth}
              >
                <Feather name="x" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.browserButton, { backgroundColor: '#8b5cf6' }]}
              onPress={handleOpenInBrowser}
            >
              <Feather name="external-link" size={16} color="#ffffff" />
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

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading OpenSolar...
          </Text>
        </View>
      )}

      {/* Credentials Section */}
      <View style={styles.credentialsContainer}>
        <View style={[styles.credentialsCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.credentialsHeader}>
            <Text style={[styles.credentialsTitle, { color: theme.primaryText }]}>OpenSolar Credentials</Text>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: showCredentials ? '#10b981' : '#6b7280' }]}
              onPress={() => setShowCredentials(!showCredentials)}
            >
              <Feather name={showCredentials ? "eye" : "eye-off"} size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {showCredentials ? (
            <View style={styles.credentialsContent}>
              <View style={styles.credentialRow}>
                <Text style={[styles.credentialLabel, { color: theme.secondaryText }]}>Username:</Text>
                <Text style={[styles.credentialValue, { color: theme.primaryText }]}>
                  {credentials.username}
                </Text>
              </View>
              <View style={styles.credentialRow}>
                <Text style={[styles.credentialLabel, { color: theme.secondaryText }]}>Password:</Text>
                <Text style={[styles.credentialValue, { color: theme.primaryText }]}>
                  {credentials.password ? '••••••••' : 'Not set'}
                </Text>
              </View>
              {credentials.apiKey && (
                <View style={styles.credentialRow}>
                  <Text style={[styles.credentialLabel, { color: theme.secondaryText }]}>API Key:</Text>
                  <Text style={[styles.credentialValue, { color: theme.primaryText }]}>
                    {credentials.apiKey.substring(0, 8)}...
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.credentialsPlaceholder, { color: theme.secondaryText }]}>
              {credentials.username ? `Logged in as: ${credentials.username}` : 'No credentials set. Tap the 👤 button to add them.'}
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
            Mode: {isWeb ? 'New Tab' : 'WebView with Auth'}
          </Text>
          <Text style={[styles.debugText, { color: theme.primaryText, fontWeight: '600' }]}>
            Auth Status: {authToken ? '✅ Authenticated' : '❌ Not Authenticated'}
          </Text>
          {authToken && (
            <Text style={[styles.debugText, { color: theme.primaryText, fontWeight: '600' }]}>
              Org ID: {orgId}
            </Text>
          )}
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

      {/* WebView - Only show on mobile */}
      {!isWeb && (
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
            // Allow navigation within OpenSolar domain and related domains
            const allowedDomains = ['opensolar.com', 'app.opensolar.com', 'localhost', '127.0.0.1'];
            const isAllowed = allowedDomains.some(domain => request.url.includes(domain));
            console.log('WebView: Request allowed:', isAllowed);
            addDebugInfo(`Request ${isAllowed ? 'allowed' : 'blocked'}: ${request.url}`);
            return isAllowed;
          }}
          renderLoading={() => (
            <View style={styles.webviewLoadingContainer}>
              <ActivityIndicator size="large" color={theme.primaryButton} />
              <Text style={[styles.webviewLoadingText, { color: theme.secondaryText }]}>
                Loading OpenSolar...
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
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: 8,
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
  credentialsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loginButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  browserButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  credentialsContainer: {
    padding: 16,
  },
  credentialsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  credentialsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  credentialsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  credentialsContent: {
    gap: 8,
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  credentialLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  credentialValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  credentialsPlaceholder: {
    fontSize: 14,
    fontStyle: 'italic',
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
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
