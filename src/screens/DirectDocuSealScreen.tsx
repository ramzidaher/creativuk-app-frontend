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
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface DirectDocuSealScreenProps {
  route: {
    params: {
      opportunityId: string;
      customerName: string;
      customerEmail: string;
    };
  };
}

export default function DirectDocuSealScreen({ route }: DirectDocuSealScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { opportunityId, customerName, customerEmail } = route.params;

  console.log('🔍 DirectDocuSealScreen loaded with params:', { opportunityId, customerName, customerEmail });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'selecting' | 'creating' | 'signing'>('loading');

  // DocuSeal localhost URL
  const DOCUSEAL_URL = 'http://localhost:3001';

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateUrl, setTemplateUrl] = useState<string>('');
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  useEffect(() => {
    // Load available templates when component mounts
    handleLoadTemplates();
  }, []);

  const handleLoadTemplates = async () => {
    try {
      setStep('loading');
      setError(null);
      console.log('🔍 DirectDocuSeal: Loading templates...');

      // Check if DocuSeal is running first
      let healthResponse;
      try {
        healthResponse = await fetch(`${DOCUSEAL_URL}/`, {
          method: 'GET',
          mode: 'no-cors', // This allows us to test if the server is reachable
        });
      } catch (healthError) {
        throw new Error('DocuSeal server is not running on localhost:3001. Please start DocuSeal first.');
      }

      // Try to fetch templates from DocuSeal
      // Note: This will likely fail due to CORS and authentication
      // We're showing the user how to set up DocuSeal properly
      const templatesResponse = await fetch(`${DOCUSEAL_URL}/api/templates`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          // Note: In production, you would add authentication here:
          // 'Authorization': `Bearer ${API_TOKEN}`,
        },
      });

      if (!templatesResponse.ok) {
        if (templatesResponse.status === 401) {
          throw new Error('Authentication required. You need to configure API authentication in DocuSeal.');
        }
        throw new Error(`Failed to load templates: ${templatesResponse.status}`);
      }

      const templatesData = await templatesResponse.json();
      console.log('🔍 DirectDocuSeal: Templates loaded:', templatesData);
      
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setStep('selecting');
      setLoading(false);

    } catch (error) {
      console.error('🔍 DirectDocuSeal: Template loading error:', error);
      
      let errorMessage = 'Failed to connect to DocuSeal';
      
      if (error.message.includes('NetworkError') || error.message.includes('CORS')) {
        errorMessage = `CORS Issue Detected - Let's use DocuSeal directly:

1. Click "Open DocuSeal" to create templates
2. Get the template sharing URL from DocuSeal
3. We'll embed that URL directly (no API needed!)

This bypasses CORS completely and works immediately.`;
      } else if (error.message.includes('Authentication required')) {
        errorMessage = `DocuSeal Authentication Setup Required:

1. Get an API key from DocuSeal console
2. Add authentication headers to requests
3. Or create templates via DocuSeal web interface first

Visit DocuSeal at ${DOCUSEAL_URL} to create templates.`;
      } else if (error.message.includes('not running')) {
        errorMessage = `DocuSeal Server Not Running:

1. Start DocuSeal on localhost:3001
2. Or update DOCUSEAL_URL if running elsewhere
3. Make sure DocuSeal is accessible from your app

Current URL: ${DOCUSEAL_URL}`;
      } else {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setTemplateId(templateId);
    console.log('🔍 DirectDocuSeal: Selected template:', templateId);
    
    // Now create submission with selected template
    await handleCreateSubmission(templateId);
  };

  const handleCreateSubmission = async (templateId: string) => {
    try {
      setStep('creating');
      console.log('🔍 DirectDocuSeal: Creating submission...');

      const submissionData = {
        template_id: templateId,
        send_email: false,
        submitters: [
          {
            role: 'Signer',
            name: customerName,
            email: customerEmail,
          }
        ]
      };

      const submissionResponse = await fetch(`${DOCUSEAL_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!submissionResponse.ok) {
        throw new Error(`Submission creation failed: ${submissionResponse.status}`);
      }

      const submissionResult = await submissionResponse.json();
      console.log('🔍 DirectDocuSeal: Submission created:', submissionResult);
      
      setSubmissionId(submissionResult.id);
      
      // Get signing URL
      const signingUrl = `${DOCUSEAL_URL}/s/${submissionResult.slug}`;
      setSigningUrl(signingUrl);
      setStep('signing');
      setLoading(false);

    } catch (error) {
      console.error('🔍 DirectDocuSeal: Submission creation error:', error);
      setError(`Failed to create submission: ${error.message}`);
      setLoading(false);
    }
  };

  const handleWebViewLoad = () => {
    console.log('🔍 DirectDocuSeal: WebView loaded successfully');
    setLoading(false);
    setError(null);
  };

  const handleWebViewError = (error: any) => {
    console.error('🔍 DirectDocuSeal: WebView error:', error);
    setError('Failed to load DocuSeal signing interface.');
    setLoading(false);
  };

  const handleRefresh = () => {
    setError(null);
    setLoading(true);
    setStep('loading');
    setTemplates([]);
    setSelectedTemplateId(null);
    setTemplateId(null);
    setSubmissionId(null);
    setSigningUrl(null);
    setWebViewKey(prev => prev + 1);
    handleLoadTemplates();
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('🔍 DirectDocuSeal: Received message:', data);
      
      if (data.type === 'DOCUMENT_COMPLETED') {
        Alert.alert(
          'Document Signed!',
          'The solar contract has been signed successfully.',
          [
            {
              text: 'Continue',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.log('🔍 DirectDocuSeal: Message parsing error:', error);
    }
  };

  const getStepText = () => {
    switch (step) {
      case 'loading':
        return 'Loading DocuSeal templates...';
      case 'selecting':
        return 'Select a template to sign';
      case 'creating':
        return 'Creating signing workflow...';
      case 'signing':
        return 'Ready to sign!';
      default:
        return 'Loading...';
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case 'loading':
        return 'hourglass';
      case 'selecting':
        return 'list';
      case 'creating':
        return 'settings';
      case 'signing':
        return 'document-text';
      default:
        return 'hourglass';
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
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>DocuSeal Direct</Text>
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
      </View>

      {/* Template Selection State */}
      {step === 'selecting' && templates.length > 0 && (
        <View style={styles.templateContainer}>
          <Text style={[styles.templateTitle, { color: theme.primaryText }]}>
            Choose a Template
          </Text>
          <Text style={[styles.templateSubtitle, { color: theme.secondaryText }]}>
            Select a document template to create the signing workflow
          </Text>
          
          <ScrollView style={styles.templateList}>
            {templates.map((template, index) => (
              <TouchableOpacity
                key={template.id || index}
                style={[
                  styles.templateItem,
                  { 
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    borderWidth: selectedTemplateId === template.id ? 2 : 1,
                    borderColor: selectedTemplateId === template.id ? theme.primaryButton : theme.cardBorder,
                  }
                ]}
                onPress={() => handleSelectTemplate(template.id)}
              >
                <View style={styles.templateIcon}>
                  <Ionicons 
                    name="document-text" 
                    size={32} 
                    color={selectedTemplateId === template.id ? theme.primaryButton : theme.secondaryText} 
                  />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={[styles.templateName, { color: theme.primaryText }]}>
                    {template.name || `Template ${index + 1}`}
                  </Text>
                  <Text style={[styles.templateDescription, { color: theme.secondaryText }]}>
                    {template.description || `Created ${template.created_at ? new Date(template.created_at).toLocaleDateString() : 'Recently'}`}
                  </Text>
                  {template.fields && (
                    <Text style={[styles.templateFields, { color: theme.secondaryText }]}>
                      {template.fields.length} signature field{template.fields.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={20} 
                  color={theme.secondaryText} 
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading/Progress State */}
      {(loading || (step !== 'signing' && step !== 'selecting')) && (
        <View style={styles.progressContainer}>
          <Ionicons name={getStepIcon()} size={64} color={theme.primaryButton} />
          <Text style={[styles.progressTitle, { color: theme.primaryText }]}>
            {getStepText()}
          </Text>
          
          {/* Progress Steps */}
          <View style={styles.progressSteps}>
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                { backgroundColor: step === 'loading' ? theme.primaryButton : theme.tertiaryBackground }
              ]}>
                <Ionicons 
                  name="hourglass" 
                  size={16} 
                  color={step === 'loading' ? '#ffffff' : theme.secondaryText} 
                />
              </View>
              <Text style={[styles.progressStepText, { color: theme.secondaryText }]}>Load</Text>
            </View>
            
            <View style={[styles.progressLine, { backgroundColor: theme.borderColor }]} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                { backgroundColor: step === 'selecting' ? theme.primaryButton : theme.tertiaryBackground }
              ]}>
                <Ionicons 
                  name="list" 
                  size={16} 
                  color={step === 'selecting' ? '#ffffff' : theme.secondaryText} 
                />
              </View>
              <Text style={[styles.progressStepText, { color: theme.secondaryText }]}>Select</Text>
            </View>
            
            <View style={[styles.progressLine, { backgroundColor: theme.borderColor }]} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                { backgroundColor: step === 'creating' ? theme.primaryButton : theme.tertiaryBackground }
              ]}>
                <Ionicons 
                  name="settings" 
                  size={16} 
                  color={step === 'creating' ? '#ffffff' : theme.secondaryText} 
                />
              </View>
              <Text style={[styles.progressStepText, { color: theme.secondaryText }]}>Create</Text>
            </View>
            
            <View style={[styles.progressLine, { backgroundColor: theme.borderColor }]} />
            
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                { backgroundColor: step === 'signing' ? theme.primaryButton : theme.tertiaryBackground }
              ]}>
                <Ionicons 
                  name="document-text" 
                  size={16} 
                  color={step === 'signing' ? '#ffffff' : theme.secondaryText} 
                />
              </View>
              <Text style={[styles.progressStepText, { color: theme.secondaryText }]}>Sign</Text>
            </View>
          </View>

          {loading && (
            <ActivityIndicator 
              size="large" 
              color={theme.primaryButton} 
              style={styles.loadingSpinner}
            />
          )}
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={theme.dangerButton} />
          <Text style={[styles.errorTitle, { color: theme.primaryText }]}>
            Connection Error
          </Text>
          <Text style={[styles.errorMessage, { color: theme.secondaryText }]}>
            {error}
          </Text>
          <Text style={[styles.errorHint, { color: theme.secondaryText }]}>
            Make sure DocuSeal is running on localhost:3001
          </Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#4CAF50', marginLeft: 8 }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open(DOCUSEAL_URL, '_blank');
                } else {
                  Linking.openURL(DOCUSEAL_URL);
                }
              }}
            >
              <Ionicons name="add-circle" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Open DocuSeal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#2196F3', marginLeft: 8 }]}
              onPress={() => setShowUrlInput(!showUrlInput)}
            >
              <Ionicons name="link" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Use URL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* URL Input Section */}
      {showUrlInput && (
        <View style={[styles.urlInputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.urlInputTitle, { color: theme.primaryText }]}>
            Paste DocuSeal Template URL
          </Text>
          <Text style={[styles.urlInputSubtitle, { color: theme.secondaryText }]}>
            Create a template in DocuSeal, then copy its shareable URL here
          </Text>
          <TextInput
            style={[styles.urlInput, { 
              backgroundColor: theme.primaryBackground, 
              borderColor: theme.cardBorder,
              color: theme.primaryText 
            }]}
            placeholder="https://docuseal.eu/d/XXXXXXXXX"
            placeholderTextColor={theme.secondaryText}
            value={templateUrl}
            onChangeText={setTemplateUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.urlInputButtons}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => {
                if (templateUrl.trim()) {
                  setSigningUrl(templateUrl.trim());
                  setStep('signing');
                  setShowUrlInput(false);
                  setError(null);
                } else {
                  Alert.alert('Error', 'Please enter a valid DocuSeal URL');
                }
              }}
            >
              <Ionicons name="checkmark" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Use This URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.secondaryButton, marginLeft: 8 }]}
              onPress={() => setShowUrlInput(false)}
            >
              <Ionicons name="close" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* WebView for Signing */}
      {signingUrl && step === 'signing' && !error && (
        <>
          <View style={[styles.signingInfo, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="checkmark-circle" size={24} color={theme.successButton} />
            <Text style={[styles.signingInfoText, { color: theme.primaryText }]}>
              Document ready for signing
            </Text>
          </View>
          
          {Platform.OS === 'web' ? (
            <iframe
              src={signingUrl}
              style={styles.iframe}
              onLoad={handleWebViewLoad}
              onError={handleWebViewError}
              title="DocuSeal Signing"
            />
          ) : (
            <WebView
              key={webViewKey}
              source={{ uri: signingUrl }}
              style={styles.webview}
              onLoad={handleWebViewLoad}
              onError={handleWebViewError}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={false}
              scalesPageToFit={true}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onNavigationStateChange={(navState) => {
                console.log('🔍 DirectDocuSeal: Navigation state:', navState.url);
                
                // Check if document is completed
                if (navState.url.includes('completed') || navState.url.includes('success')) {
                  Alert.alert(
                    'Document Signed!',
                    'The solar contract has been signed successfully.',
                    [
                      {
                        text: 'Continue',
                        onPress: () => navigation.goBack(),
                      },
                    ]
                  );
                }
              }}
            />
          )}
        </>
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
  progressContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStepText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginTop: 16,
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
    marginBottom: 8,
    lineHeight: 24,
  },
  errorHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  errorButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  signingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  signingInfoText: {
    fontSize: 16,
    fontWeight: '500',
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
  templateContainer: {
    flex: 1,
    padding: 20,
  },
  templateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  templateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  templateList: {
    flex: 1,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  templateIcon: {
    marginRight: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    marginBottom: 2,
  },
  templateFields: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  urlInputContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  urlInputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  urlInputSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  urlInputButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
