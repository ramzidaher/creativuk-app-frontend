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
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

interface DocuSealSigningScreenProps {
  route: {
    params: {
      submissionId: string;
      signingUrl: string;
      opportunityId: string;
      customerName: string;
    };
  };
}

export default function DocuSealSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<DocuSealSigningScreenProps['route']>();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { submissionId, signingUrl, opportunityId, customerName } = route.params;

  // Desktop user agent for better compatibility
  const desktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

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

  // Check signing status periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3000/contracts/status/${submissionId}`);
        const data = await response.json();
        
        if (data.success && data.data.completed) {
          setSigningStatus('completed');
          setCanGoBack(true);
          
          // Mark workflow step 9 (Contract Signing) as completed
          try {
            const { workflowApi } = await import('../utils/api');
            await workflowApi.completeStep(opportunityId, 9, {
              signature: 'DocuSeal Digital Signature',
              signedAt: new Date().toISOString(),
              generatedAt: new Date().toISOString(),
              digitallySigned: true,
              docuSealSubmissionId: submissionId,
              docuSealSigningUrl: signingUrl
            });
            console.log('✅ Contract signing step 9 marked as completed in workflow');
          } catch (workflowError) {
            console.error('Error updating workflow:', workflowError);
          }
          
          Alert.alert(
            'Document Signed!',
            'The contract has been successfully signed and saved.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        }
      } catch (error) {
        console.log('Error checking signing status:', error);
      }
    };

    // Check status every 5 seconds
    const statusInterval = setInterval(checkStatus, 5000);

    return () => clearInterval(statusInterval);
  }, [submissionId, navigation, opportunityId]);

  const handleWebViewLoad = () => {
    console.log('DocuSeal: WebView loaded successfully');
    setLoading(false);
    setError(null);
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('DocuSeal: WebView error:', nativeEvent);
    setError(`Failed to load DocuSeal: ${nativeEvent.description || 'Unknown error'}`);
    setLoading(false);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('DocuSeal: Message from WebView:', data);
      
      if (data.type === 'signing_completed') {
        setSigningStatus('completed');
        setCanGoBack(true);
      }
    } catch (error) {
      console.log('DocuSeal: Error parsing WebView message:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    webViewRef.current?.reload();
  };

  const handleGoBack = () => {
    if (canGoBack || signingStatus === 'completed') {
      navigation.goBack();
    } else {
      Alert.alert(
        'Exit Signing?',
        'Are you sure you want to exit? Your progress will be saved and you can return later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', onPress: () => navigation.goBack() },
        ]
      );
    }
  };

  const handleDownloadSigned = async () => {
    try {
      const response = await fetch(`http://localhost:3000/contracts/download/${submissionId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Open the signed document
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Failed to download signed document');
      }
    } catch (error) {
      console.error('Error downloading signed document:', error);
      Alert.alert('Error', 'Failed to download signed document');
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.primaryButton }]}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={handleGoBack}
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: "#ffffff" }]}>
          Sign Contract
        </Text>
        <Text style={[styles.headerSubtitle, { color: "#ffffff" }]}>
          {customerName} - {opportunityId}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.headerButton}
        onPress={handleRefresh}
      >
        <Ionicons name="refresh" size={24} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  const renderStatusBar = () => (
    <View style={[styles.statusBar, { backgroundColor: theme.primaryBackground }]}>
      <View style={styles.statusContent}>
        <View style={[
          styles.statusIndicator,
          {
            backgroundColor: signingStatus === 'completed' 
              ? '#4CAF50' 
              : signingStatus === 'failed' 
                ? '#F44336' 
                : '#FF9800'
          }
        ]} />
        <Text style={[styles.statusText, { color: theme.primaryText }]}>
          {signingStatus === 'completed' 
            ? 'Document Signed Successfully' 
            : signingStatus === 'failed' 
              ? 'Signing Failed' 
              : 'Ready to Sign'}
        </Text>
      </View>
      
      {signingStatus === 'completed' && (
        <TouchableOpacity
          style={[styles.downloadButton, { backgroundColor: theme.primaryButton }]}
          onPress={handleDownloadSigned}
        >
          <Ionicons name="download" size={16} color="#ffffff" />
          <Text style={[styles.downloadButtonText, { color: "#ffffff" }]}>
            Download
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.dangerButton} />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>
            Failed to Load DocuSeal
          </Text>
          <Text style={[styles.errorMessage, { color: theme.primaryText }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: "#ffffff" }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {renderHeader()}
      {renderStatusBar()}
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading DocuSeal...
          </Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: signingUrl }}
        style={styles.webView}
        userAgent={desktopUserAgent}
        onLoad={handleWebViewLoad}
        onError={handleWebViewError}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        thirdPartyCookiesEnabled={true}
        allowsBackForwardNavigationGestures={true}
        onNavigationStateChange={(navState) => {
          console.log('DocuSeal: Navigation state changed:', navState.url);
        }}
      />
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  downloadButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
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
  },
  webView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
