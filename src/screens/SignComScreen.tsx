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

// Web-compatible iframe component
const WebIframe = ({ source, style, onLoad, onError }: any) => {
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={source.uri}
        style={style}
        onLoad={onLoad}
        onError={onError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="camera; microphone; geolocation"
      />
    );
  }
  return null;
};

interface SignComScreenProps {
  route: {
    params: {
      opportunityId: string;
      customerName: string;
      customerEmail: string;
    };
  };
}

export default function SignComScreen({ route }: SignComScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { opportunityId, customerName, customerEmail } = route.params;
  
  console.log('🔍 SignComScreen loaded with params:', { opportunityId, customerName, customerEmail });
  console.log('🔍 SignComScreen: This should show Sign.com, NOT DocuSeal!');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desktopSpoofingActive, setDesktopSpoofingActive] = useState(false);
  const [signComLoaded, setSignComLoaded] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log('SignCom: Loading timeout reached');
        setError('Loading timeout - sign.com may be taking longer than expected. Try refreshing or check your connection.');
        setLoading(false);
      }
    }, 45000); // 45 second timeout (increased for better UX)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading]);

  // AGGRESSIVE desktop user agent to completely fool sign.com
  const desktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

  const handleWebViewLoad = () => {
    console.log('SignCom: WebView loaded successfully');
    setLoading(false);
    setError(null);
    setSignComLoaded(true);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('SignCom: WebView error: ', nativeEvent);
    setError(`Failed to load sign.com: ${nativeEvent.description || 'Unknown error'}`);
    setLoading(false);
  };

  const handleWebViewHttpError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('SignCom: WebView HTTP error: ', nativeEvent);
    setError(`HTTP Error ${nativeEvent.statusCode}: ${nativeEvent.description || 'Failed to load'}`);
    setLoading(false);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', data);
      
      if (data.type === 'desktopSpoofingActive') {
        setDesktopSpoofingActive(data.status);
      }
    } catch (e) {
      console.log('WebView message (non-JSON):', event.nativeEvent.data);
    }
  };

  const injectDesktopSpoofingScript = () => {
    return `
      (function() {
        console.log('SignCom: Starting ULTRA-AGGRESSIVE desktop spoofing injection');
        
        // ULTRA-AGGRESSIVE: Override ALL screen properties with multiple attempts
        const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth', 'orientation'];
        screenProps.forEach(prop => {
          try {
            Object.defineProperty(screen, prop, {
              get: function() { 
                if (prop === 'width' || prop === 'availWidth') return 1920;
                if (prop === 'height' || prop === 'availHeight') return 1080;
                if (prop === 'colorDepth' || prop === 'pixelDepth') return 24;
                if (prop === 'orientation') return { type: 'landscape-primary', angle: 0 };
                return 1920;
              },
              configurable: true,
              enumerable: true
            });
          } catch(e) {
            try {
              screen[prop] = (prop === 'width' || prop === 'availWidth') ? 1920 : 
                           (prop === 'height' || prop === 'availHeight') ? 1080 : 
                           (prop === 'colorDepth' || prop === 'pixelDepth') ? 24 : 1920;
            } catch(e2) {}
          }
        });

        // ULTRA-AGGRESSIVE: Override ALL navigator properties
        const navigatorProps = ['platform', 'maxTouchPoints', 'userAgent', 'vendor', 'vendorSub', 'productSub', 'appName', 'appVersion', 'appCodeName', 'hardwareConcurrency', 'deviceMemory', 'connection', 'onLine', 'language', 'languages', 'cookieEnabled', 'doNotTrack'];
        navigatorProps.forEach(prop => {
          try {
            Object.defineProperty(navigator, prop, {
              get: function() { 
                if (prop === 'platform') return 'Win32';
                if (prop === 'maxTouchPoints') return 0;
                if (prop === 'userAgent') return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
                if (prop === 'vendor') return 'Google Inc.';
                if (prop === 'vendorSub') return '';
                if (prop === 'productSub') return '20030107';
                if (prop === 'appName') return 'Netscape';
                if (prop === 'appVersion') return '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
                if (prop === 'appCodeName') return 'Mozilla';
                if (prop === 'hardwareConcurrency') return 8;
                if (prop === 'deviceMemory') return 8;
                if (prop === 'connection') return { effectiveType: '4g', downlink: 10, rtt: 50 };
                if (prop === 'onLine') return true;
                if (prop === 'language') return 'en-US';
                if (prop === 'languages') return ['en-US', 'en'];
                if (prop === 'cookieEnabled') return true;
                if (prop === 'doNotTrack') return null;
                return undefined;
              },
              configurable: true,
              enumerable: true
            });
          } catch(e) {
            try {
              navigator[prop] = (prop === 'platform') ? 'Win32' :
                              (prop === 'maxTouchPoints') ? 0 :
                              (prop === 'userAgent') ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' :
                              (prop === 'vendor') ? 'Google Inc.' :
                              (prop === 'hardwareConcurrency') ? 8 :
                              (prop === 'deviceMemory') ? 8 : undefined;
            } catch(e2) {}
          }
        });

        // ULTRA-AGGRESSIVE: Override window properties
        const windowProps = ['innerWidth', 'innerHeight', 'outerWidth', 'outerHeight', 'screenX', 'screenY', 'devicePixelRatio', 'screenLeft', 'screenTop'];
        windowProps.forEach(prop => {
          try {
            Object.defineProperty(window, prop, {
              get: function() { 
                if (prop === 'innerWidth' || prop === 'outerWidth') return 1920;
                if (prop === 'innerHeight' || prop === 'outerHeight') return 1080;
                if (prop === 'screenX' || prop === 'screenY' || prop === 'screenLeft' || prop === 'screenTop') return 0;
                if (prop === 'devicePixelRatio') return 1;
                return 1920;
              },
              configurable: true,
              enumerable: true
            });
          } catch(e) {
            try {
              window[prop] = (prop === 'innerWidth' || prop === 'outerWidth') ? 1920 :
                           (prop === 'innerHeight' || prop === 'outerHeight') ? 1080 :
                           (prop === 'screenX' || prop === 'screenY' || prop === 'screenLeft' || prop === 'screenTop') ? 0 :
                           (prop === 'devicePixelRatio') ? 1 : 1920;
            } catch(e2) {}
          }
        });

        // ULTRA-AGGRESSIVE: Remove ALL touch events and properties
        const touchEvents = ['ontouchstart', 'ontouchend', 'ontouchmove', 'ontouchcancel'];
        touchEvents.forEach(event => {
          try {
            if (window[event] !== undefined) window[event] = undefined;
            if (document[event] !== undefined) document[event] = undefined;
            if (document.body && document.body[event] !== undefined) document.body[event] = undefined;
          } catch(e) {}
        });

        // ULTRA-AGGRESSIVE: Override touch detection methods
        const touchClasses = ['TouchEvent', 'Touch', 'TouchList'];
        touchClasses.forEach(touchClass => {
          try {
            if (window[touchClass]) {
              window[touchClass] = undefined;
            }
            if (window[touchClass + 'Prototype']) {
              window[touchClass + 'Prototype'] = undefined;
            }
          } catch(e) {}
        });

        // ULTRA-AGGRESSIVE: Override media queries completely
        if (window.matchMedia) {
          const originalMatchMedia = window.matchMedia;
          window.matchMedia = function(query) {
            console.log('SignCom: Intercepting media query:', query);
            // Always return desktop-friendly results
            const isMobileQuery = query.includes('(max-width: 768px)') || 
                                 query.includes('(max-width: 1024px)') ||
                                 query.includes('(max-width: 480px)') ||
                                 query.includes('(max-width: 640px)') ||
                                 query.includes('(max-width: 1023px)') ||
                                 query.includes('(max-width: 767px)') ||
                                 query.includes('(max-width: 479px)') ||
                                 query.includes('(max-width: 639px)') ||
                                 query.includes('(orientation: portrait)') ||
                                 query.includes('(pointer: coarse)') ||
                                 query.includes('(hover: none)');
            
            return {
              matches: !isMobileQuery,
              media: query,
              onchange: null,
              addListener: function() {},
              removeListener: function() {},
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return false; }
            };
          };
        }

        // ULTRA-AGGRESSIVE: Override common mobile detection variables
        const mobileVars = ['isMobile', 'isTablet', 'isDesktop', 'isTouchDevice', 'isMobileDevice', 'isTabletDevice', 'isDesktopDevice', 'isPhone', 'isAndroid', 'isiOS', 'isWindows', 'isMac', 'isLinux'];
        mobileVars.forEach(varName => {
          try {
            window[varName] = varName.includes('Mobile') || varName.includes('Phone') || varName.includes('Touch') || varName.includes('Android') || varName.includes('iOS') ? false : true;
          } catch(e) {}
        });

        // ULTRA-AGGRESSIVE: Override CSS media queries by injecting comprehensive styles
        const ultraAggressiveStyle = document.createElement('style');
        ultraAggressiveStyle.textContent = \`
          /* Force desktop layout - ULTRA AGGRESSIVE */
          * { 
            -webkit-touch-callout: none !important;
            -webkit-user-select: text !important;
            -khtml-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
            -webkit-tap-highlight-color: transparent !important;
            -webkit-tap-highlight-color: rgba(0,0,0,0) !important;
          }
          
          /* Hide ALL mobile-specific elements */
          .mobile-only, .mobile, .Mobile, [class*="mobile"], [class*="Mobile"],
          .tablet-only, .tablet, .Tablet, [class*="tablet"], [class*="Tablet"],
          .touch-only, .touch, .Touch, [class*="touch"], [class*="Touch"],
          .phone-only, .phone, .Phone, [class*="phone"], [class*="Phone"],
          .android-only, .android, .Android, [class*="android"], [class*="Android"],
          .ios-only, .ios, .iOS, [class*="ios"], [class*="iOS"],
          .responsive-mobile, .responsive-tablet, .responsive-phone,
          [class*="responsive-mobile"], [class*="responsive-tablet"], [class*="responsive-phone"],
          .hide-desktop, .show-mobile, .show-tablet, .show-phone,
          [class*="hide-desktop"], [class*="show-mobile"], [class*="show-tablet"], [class*="show-phone"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
          
          /* Show desktop elements */
          .desktop-only, .desktop, .Desktop, [class*="desktop"], [class*="Desktop"],
          .no-touch, .no-touch-only, [class*="no-touch"],
          .hide-mobile, .hide-tablet, .hide-phone,
          [class*="hide-mobile"], [class*="hide-tablet"], [class*="hide-phone"],
          .show-desktop, [class*="show-desktop"] {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Override ALL mobile-specific CSS media queries */
          @media (max-width: 768px), @media (max-width: 1024px), @media (max-width: 480px), 
          @media (max-width: 640px), @media (max-width: 1023px), @media (max-width: 767px), 
          @media (max-width: 479px), @media (max-width: 639px), @media (orientation: portrait),
          @media (pointer: coarse), @media (hover: none) {
            .mobile-warning, .mobile-notice, .mobile-block, .mobile-only, .mobile,
            [class*="mobile-warning"], [class*="mobile-notice"], [class*="mobile-block"], 
            [class*="mobile-only"], [class*="mobile"], .tablet-only, .tablet,
            [class*="tablet-only"], [class*="tablet"], .phone-only, .phone,
            [class*="phone-only"], [class*="phone"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              height: 0 !important;
              width: 0 !important;
              overflow: hidden !important;
            }
            
            .desktop-only, .desktop, .no-touch, [class*="desktop"], [class*="no-touch"] {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          }
          
          /* Force desktop viewport and layout */
          body, html { 
            min-width: 1024px !important;
            min-height: 768px !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            width: 100% !important;
            height: 100% !important;
            -webkit-text-size-adjust: 100% !important;
            -ms-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
          }
          
          /* Override any viewport restrictions */
          .container, .wrapper, .content, .main, .app, .page {
            min-width: 1024px !important;
            width: 100% !important;
            max-width: none !important;
          }
          
          /* Force desktop form elements */
          input, textarea, select, button {
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            border-radius: 0 !important;
          }
          
          /* Hide mobile navigation and show desktop navigation */
          .mobile-nav, .mobile-menu, .mobile-header, .mobile-footer,
          [class*="mobile-nav"], [class*="mobile-menu"], [class*="mobile-header"], [class*="mobile-footer"] {
            display: none !important;
          }
          
          .desktop-nav, .desktop-menu, .desktop-header, .desktop-footer,
          [class*="desktop-nav"], [class*="desktop-menu"], [class*="desktop-header"], [class*="desktop-footer"] {
            display: block !important;
          }
        \`;
        document.head.appendChild(ultraAggressiveStyle);

        // ULTRA-AGGRESSIVE: Override viewport meta tag
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          viewportMeta.setAttribute('content', 'width=1920, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no');
        } else {
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=1920, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no';
          document.head.appendChild(meta);
        }

        // ULTRA-AGGRESSIVE: Remove mobile detection scripts and override detection functions
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
          if (script.textContent && (
            script.textContent.includes('mobile') || 
            script.textContent.includes('touch') ||
            script.textContent.includes('isMobile') ||
            script.textContent.includes('maxTouchPoints') ||
            script.textContent.includes('navigator.userAgent') ||
            script.textContent.includes('window.innerWidth') ||
            script.textContent.includes('screen.width')
          )) {
            try {
              script.remove();
            } catch(e) {}
          }
        });

        // ULTRA-AGGRESSIVE: Override common detection functions
        window.isMobile = function() { return false; };
        window.isTablet = function() { return false; };
        window.isDesktop = function() { return true; };
        window.isTouchDevice = function() { return false; };
        window.isMobileDevice = function() { return false; };
        window.isTabletDevice = function() { return false; };
        window.isDesktopDevice = function() { return true; };
        window.isPhone = function() { return false; };
        window.isAndroid = function() { return false; };
        window.isiOS = function() { return false; };
        window.isWindows = function() { return true; };
        window.isMac = function() { return false; };
        window.isLinux = function() { return false; };

        // ULTRA-AGGRESSIVE: Override device detection libraries
        if (window.DeviceDetector) {
          window.DeviceDetector.isMobile = function() { return false; };
          window.DeviceDetector.isTablet = function() { return false; };
          window.DeviceDetector.isDesktop = function() { return true; };
        }

        console.log('SignCom: ULTRA-AGGRESSIVE desktop spoofing completed');
        
        // Notify React Native
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'desktopSpoofingActive',
          status: true
        }));
        
        // Auto-fill login if available (with multiple attempts)
        const autoFillLogin = () => {
          const emailField = document.querySelector('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]');
          const passwordField = document.querySelector('input[type="password"], input[name="password"], input[placeholder*="password" i], input[placeholder*="Password" i]');

          if (emailField && passwordField) {
            emailField.value = customerEmail || 'karl.gedney@creativuk.co.uk';
            passwordField.value = 'Docu247398?';
            
            // Trigger events to ensure form validation
            emailField.dispatchEvent(new Event('input', { bubbles: true }));
            emailField.dispatchEvent(new Event('change', { bubbles: true }));
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log('SignCom: Auto-filled login credentials');
          }
        };

        // Try auto-fill multiple times
        setTimeout(autoFillLogin, 1000);
        setTimeout(autoFillLogin, 3000);
        setTimeout(autoFillLogin, 5000);
        
        // Re-inject spoofing periodically to ensure it sticks
        setInterval(() => {
          try {
            // Re-apply critical overrides
            if (navigator.maxTouchPoints !== 0) {
              Object.defineProperty(navigator, 'maxTouchPoints', {
                get: function() { return 0; },
                configurable: true
              });
            }
            if (window.innerWidth < 1024) {
              Object.defineProperty(window, 'innerWidth', {
                get: function() { return 1920; },
                configurable: true
              });
            }
          } catch(e) {}
        }, 2000);
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
              Sign.com
            </Text>
              {desktopSpoofingActive && (
                <View style={[styles.statusIndicator, { backgroundColor: theme.successButton }]}>
                  <Ionicons name="desktop" size={12} color="#ffffff" />
                  <Text style={styles.statusText}>Desktop</Text>
                </View>
              )}
              {signComLoaded && (
                <View style={[styles.statusIndicator, { backgroundColor: theme.primaryButton, marginLeft: 4 }]}>
                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                  <Text style={styles.statusText}>Loaded</Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
              {customerName} - {customerEmail}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.secondaryButton }]}
            onPress={() => {
              console.log('SignCom: Testing WebView with Google');
              setError(null);
              setLoading(true);
              if (webViewRef.current) {
                webViewRef.current.reload();
              }
            }}
          >
            <Text style={styles.testButtonText}>Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primaryButton, marginLeft: 8 }]}
            onPress={() => {
              console.log('SignCom: FORCE injecting desktop spoofing script');
              if (webViewRef.current) {
                // Inject multiple times to ensure it sticks
                webViewRef.current.injectJavaScript(injectDesktopSpoofingScript());
                setTimeout(() => {
                  webViewRef.current?.injectJavaScript(injectDesktopSpoofingScript());
                }, 500);
                setTimeout(() => {
                  webViewRef.current?.injectJavaScript(injectDesktopSpoofingScript());
                }, 1000);
              }
            }}
          >
            <Text style={styles.testButtonText}>Force Desktop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.secondaryButton, marginLeft: 8 }]}
            onPress={() => {
              console.log('SignCom: Refreshing WebView');
              setError(null);
              setLoading(true);
              setSignComLoaded(false);
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
      {signComLoaded && !error && (
        <View style={[styles.successContainer, { backgroundColor: theme.successButton + '20' }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.successButton} />
          <Text style={[styles.successText, { color: theme.successButton }]}>
            Sign.com loaded successfully! Desktop spoofing is active.
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
                'Would you like to open sign.com in your default browser instead?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Open Browser', 
                    onPress: () => Linking.openURL('https://sign.com')
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
        source={{ uri: 'https://sign.com' }}
        style={styles.webview}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onHttpError={handleWebViewHttpError}
        onMessage={handleWebViewMessage}
        onLoadStart={() => {
          console.log('SignCom: Starting to load sign.com');
          setLoading(true);
          setError(null);
          setSignComLoaded(false);
        }}
        onLoadEnd={() => {
          console.log('SignCom: Finished loading sign.com');
          setLoading(false);
          // Inject spoofing script immediately after load with multiple attempts
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(injectDesktopSpoofingScript());
            }
          }, 500);
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(injectDesktopSpoofingScript());
            }
          }, 1500);
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(injectDesktopSpoofingScript());
            }
          }, 3000);
        }}
        onNavigationStateChange={(navState) => {
          console.log('SignCom: Navigation state changed:', navState.url);
          
          // Check if we've successfully navigated to sign.com content
          if (navState.url.includes('sign.com') && !navState.loading) {
            setSignComLoaded(true);
            setError(null);
            
            // Re-inject spoofing script on navigation
            setTimeout(() => {
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(injectDesktopSpoofingScript());
              }
            }, 1000);
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
        userAgent={desktopUserAgent}
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={true}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        incognito={false}
        onShouldStartLoadWithRequest={(request) => {
          console.log('SignCom: Should start load with request:', request.url);
          // Allow navigation within sign.com domain and related domains
          const allowedDomains = [
            'sign.com', 
            'www.sign.com', 
            'app.sign.com',
            'secure.sign.com',
            'api.sign.com',
            'cdn.sign.com',
            'fonts.googleapis.com',
            'fonts.gstatic.com',
            'googleapis.com',
            'gstatic.com',
            'google.com',
            'www.google.com',
            'jsdelivr.net',
            'cdnjs.cloudflare.com',
            'unpkg.com',
            'stackpath.bootstrapcdn.com',
            'maxcdn.bootstrapcdn.com',
            'ajax.googleapis.com',
            'code.jquery.com',
            'cdn.jsdelivr.net'
          ];
          const isAllowed = allowedDomains.some(domain => request.url.includes(domain));
          console.log('SignCom: Request allowed:', isAllowed, 'for URL:', request.url);
          return isAllowed;
        }}
        injectedJavaScript={injectDesktopSpoofingScript()}
        injectedJavaScriptBeforeContentLoaded={injectDesktopSpoofingScript()}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primaryButton} />
            <Text style={[styles.loadingText, { color: theme.primaryText }]}>
              Loading Sign.com...
            </Text>
            <Text style={[styles.loadingSubtext, { color: theme.secondaryText }]}>
              Applying desktop compatibility mode...
            </Text>
          </View>
        )}
        onContentProcessDidTerminate={() => {
          console.log('SignCom: Content process terminated, reloading...');
          setError('WebView crashed, reloading...');
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }, 1000);
        }}
        onRenderProcessGone={() => {
          console.log('SignCom: Render process gone, reloading...');
          setError('WebView render process crashed, reloading...');
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }, 1000);
        }}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.primaryBackground }]}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading Sign.com...
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
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
});
