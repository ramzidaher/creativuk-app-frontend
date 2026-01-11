import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface RouteParams {
  pdfUrl: string;
  title: string;
}

const PDFViewerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  
  const { pdfUrl, title } = route.params as RouteParams;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string>('');

  useEffect(() => {
    const loadAuthToken = async () => {
      try {
        const token = await getAuthToken();
        setAuthToken(token);
      } catch (error) {
        console.error('Error loading auth token:', error);
        setError('Failed to load authentication token');
      }
    };
    
    loadAuthToken();
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        setError('PDF loading timeout. The file may be too large or the server is slow. Please try downloading instead.');
        setLoading(false);
      }
    }, 30000); // 30 second timeout
    
    return () => clearTimeout(timeout);
  }, [loading]);

  const handleWebViewLoad = () => {
    setLoading(false);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    
    // Handle SSL certificate errors specifically
    if (nativeEvent.code === 3 && nativeEvent.description?.includes('SSL error')) {
      setError('SSL Certificate Error: The PDF server certificate is not trusted. This is normal for development servers. The PDF viewer cannot display the file due to security restrictions, but you can still download it from the previous screen.');
    } else {
      setError('Failed to load PDF');
    }
    setLoading(false);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={handleClose}
        >
          <Feather name="x" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        
        <Text style={[styles.title, { color: theme.primaryText }]} numberOfLines={1}>
          {title || 'PDF Viewer'}
        </Text>
        
        <View style={styles.placeholder} />
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading PDF...
          </Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={[styles.errorText, { color: theme.primaryText }]}>
            {error}
          </Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: '#6b7280', marginTop: 12 }]}
              onPress={handleClose}
            >
              <Text style={styles.retryButtonText}>Go Back & Download</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* WebView */}
      {authToken && (
        <WebView
          source={{ 
            uri: pdfUrl,
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'ngrok-skip-browser-warning': 'true',
            }
          }}
          style={styles.webview}
          onLoad={handleWebViewLoad}
          onError={handleWebViewError}
          onHttpError={handleWebViewError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          // Allow mixed content for development
          mixedContentMode="compatibility"
          allowsBackForwardNavigationGestures={true}
          // For development with ngrok, we need to ignore SSL errors
          onShouldStartLoadWithRequest={(request) => {
            console.log('WebView loading:', request.url);
            return true;
          }}
        />
      )}
    </SafeAreaView>
  );
};

// Helper function to get auth token
const getAuthToken = async (): Promise<string> => {
  try {
    const { authApi } = await import('../utils/api');
    return await authApi.getAccessToken() || '';
  } catch (error) {
    console.error('Error getting auth token:', error);
    return '';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    padding: 32,
  },
  errorButtons: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

export default PDFViewerScreen;
