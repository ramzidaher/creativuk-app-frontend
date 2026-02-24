import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
// Digital signature components
import MobileCanvasSignaturePad from '../components/MobileCanvasSignaturePad';
import SimpleSignaturePad from '../components/SimpleSignaturePad';

interface RouteParams {
  opportunityId: string;
}

export default function ContractSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId } = route.params as RouteParams;
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [step, setStep] = useState<'loading' | 'selecting' | 'signing' | 'verification' | 'processing' | 'status'>('loading');
  const [signature, setSignature] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localFilePath, setLocalFilePath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  // Digital signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSigningPDF, setIsSigningPDF] = useState(false);
  const [selectedPdfPath, setSelectedPdfPath] = useState<string | null>(null);
  
  // Contract state
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [loadingContracts, setLoadingContracts] = useState(false);
  
  // Calculator type selection state
  const [selectedCalculatorType, setSelectedCalculatorType] = useState<'flux' | 'off-peak' | null>(null);
  
  // Customer details state
  const [customerName, setCustomerName] = useState<string>('Contract Signer');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(true);
  
  // Override field for email editing only
  const [overrideCustomerEmail, setOverrideCustomerEmail] = useState<string>('');
  
  // Signing status state
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [signingStatus, setSigningStatus] = useState<'pending' | 'sent' | 'opened' | 'completed' | 'awaiting' | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [signerInfo, setSignerInfo] = useState<any>(null);
  
  // Template verification state
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [embeddedFormUrl, setEmbeddedFormUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCredentials, setPreviewCredentials] = useState<{ email: string; password: string } | null>(null);
  const [formBuilderToken, setFormBuilderToken] = useState<string | null>(null);
  const [isCreatingSubmission, setIsCreatingSubmission] = useState(false);
  const [isFormVerified, setIsFormVerified] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(true);
  const [formLoadError, setFormLoadError] = useState<string | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);
  const builderRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Load customer details and existing PDF for this opportunity
    loadCustomerDetails();
    loadExistingPDF();
    // Set initial step to selecting calculator type
    setStep('selecting');
  }, []);

  // Auto-poll status every 5 seconds when on status step
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (step === 'status' && signingStatus !== 'completed') {
      console.log('🔄 Starting status polling for contract...');
      
      // Initial check after 3 seconds
      const initialTimeout = setTimeout(() => {
        checkSigningStatus();
      }, 3000);
      
      // Then poll every 5 seconds
      pollInterval = setInterval(async () => {
        console.log('🔄 Polling contract status...');
        await checkSigningStatus();
      }, 5000);
      
      return () => {
        console.log('🛑 Stopping contract status polling');
        clearTimeout(initialTimeout);
        if (pollInterval) clearInterval(pollInterval);
      };
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [step, signingStatus, submissionId, opportunityId]);

  // Set up DocuSeal form when embedded form URL is available (only if no formBuilderToken)
  useEffect(() => {
    // Skip this useEffect if we have a formBuilderToken - we'll use the Form Builder instead
    if (formBuilderToken) return;

    if (Platform.OS === 'web' && embeddedFormUrl && typeof window !== 'undefined' && typeof document !== 'undefined' && !useIframeFallback) {
      let timeoutId: NodeJS.Timeout | null = null;
      let formElement: HTMLElement | null = null;
      let handleCompleted: ((e: any) => void) | null = null;
      let handleDeclined: ((e: any) => void) | null = null;
      let loadTimeoutId: NodeJS.Timeout | null = null;
      let isCleanedUp = false;
      let retryCount = 0;
      const MAX_RETRIES = 10;

      // Reset states
      setIsFormLoading(true);
      setFormLoadError(null);

      // Fix URL if it has typo (https:/.docuseal.eu -> https://docuseal.eu)
      const fixedUrl = embeddedFormUrl.replace(/https:\/\./, 'https://');

      // Function to ensure DocuSeal script is loaded
      const ensureScriptLoaded = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (isCleanedUp) return resolve();
          
          // Check if custom element is already registered
          if (typeof customElements !== 'undefined' && customElements.get('docuseal-form')) {
            resolve();
            return;
          }

          // Check if script already exists
          const existingScript = document.querySelector('script[src*="docuseal"][src*="/js/form.js"]');
          
          if (existingScript) {
            // Wait for custom element to be defined
            let attempts = 0;
            const checkInterval = setInterval(() => {
              if (isCleanedUp) {
                clearInterval(checkInterval);
                resolve();
                return;
              }
              attempts++;
              if (typeof customElements !== 'undefined' && customElements.get('docuseal-form')) {
                clearInterval(checkInterval);
                resolve();
              } else if (attempts > 50) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            return;
          }

          // Load the script
          const script = document.createElement('script');
          script.src = 'https://cdn.docuseal.eu/js/form.js';
          script.async = true;
          script.onload = () => {
            if (isCleanedUp) return resolve();
            let attempts = 0;
            const checkInterval = setInterval(() => {
              if (isCleanedUp) {
                clearInterval(checkInterval);
                resolve();
                return;
              }
              attempts++;
              if (typeof customElements !== 'undefined' && customElements.get('docuseal-form')) {
                clearInterval(checkInterval);
                resolve();
              } else if (attempts > 50) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          };
          script.onerror = () => {
            reject(new Error('Failed to load DocuSeal script'));
          };
          document.head.appendChild(script);
        });
      };

      // Function to create and inject the form element
      const createFormElement = async () => {
        if (isCleanedUp) return;
        
        const container = document.getElementById('docusealFormContainer');
        
        if (!container) {
          retryCount++;
          if (retryCount < MAX_RETRIES && !isCleanedUp) {
            timeoutId = setTimeout(createFormElement, 500);
          }
          return;
        }

        // Ensure script is loaded
        try {
          await ensureScriptLoaded();
        } catch (error) {
          if (!isCleanedUp) {
            setFormLoadError('Failed to load DocuSeal script. Try using the iframe fallback.');
            setIsFormLoading(false);
          }
          return;
        }

        if (isCleanedUp) return;

        // Check if form already exists
        if (container.querySelector('docuseal-form')) {
          setIsFormLoading(false);
          return;
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create the docuseal-form element
        formElement = document.createElement('docuseal-form');
        formElement.setAttribute('id', 'docusealForm');
        formElement.setAttribute('data-src', fixedUrl);
        formElement.setAttribute('data-host', 'docuseal.eu'); // Use EU server
        formElement.setAttribute('data-preview', 'true');
        if (previewCredentials?.email || customerEmail) {
          formElement.setAttribute('data-email', previewCredentials?.email || customerEmail || '');
        }
        if (customerName) {
          formElement.setAttribute('data-name', customerName);
        }
        formElement.style.width = '100%';
        formElement.style.minHeight = '600px';
        formElement.style.display = 'block';

        container.appendChild(formElement);

        // Set loading to false after a short delay
        loadTimeoutId = setTimeout(() => {
          if (!isCleanedUp) setIsFormLoading(false);
        }, 2000);

        // Set up event listeners
        handleCompleted = () => {
          if (!isCleanedUp) {
            setIsFormVerified(true);
            setIsFormLoading(false);
          }
        };

        handleDeclined = () => {};

        formElement.addEventListener('completed', handleCompleted);
        formElement.addEventListener('declined', handleDeclined);
        formElement.addEventListener('load', () => {
          if (!isCleanedUp) setIsFormLoading(false);
        });
      };

      // Start creating the form element after a short delay
      timeoutId = setTimeout(createFormElement, 300);

      // Cleanup function
      return () => {
        isCleanedUp = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (loadTimeoutId) clearTimeout(loadTimeoutId);
        if (formElement && handleCompleted && handleDeclined) {
          formElement.removeEventListener('completed', handleCompleted);
          formElement.removeEventListener('declined', handleDeclined);
        }
      };
    }
  }, [embeddedFormUrl, previewCredentials, customerEmail, customerName, useIframeFallback, formBuilderToken]);

  // Set up DocuSeal Form Builder when formBuilderToken is available
  useEffect(() => {
    if (Platform.OS === 'web' && formBuilderToken && templateId && typeof window !== 'undefined' && typeof document !== 'undefined') {
      let timeoutId: NodeJS.Timeout | null = null;
      let builderElement: HTMLElement | null = null;
      let handleLoad: ((e: any) => void) | null = null;
      let handleSave: ((e: any) => void) | null = null;
      let isCleanedUp = false;
      let retryCount = 0;
      const MAX_RETRIES = 10;

      // Function to ensure the builder script is loaded
      const ensureBuilderScriptLoaded = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (isCleanedUp) return resolve();
          
          // Check if custom element is already registered
          if (customElements.get('docuseal-builder') || customElements.get('docuseal-form-builder')) {
            resolve();
            return;
          }

          // Check if script already exists (check both .com and .eu versions)
          const existingScript = document.querySelector('script[src*="docuseal"][src*="/js/builder"]');
          if (existingScript) {
            // Wait for custom element to be defined
            let attempts = 0;
            const checkInterval = setInterval(() => {
              if (isCleanedUp) {
                clearInterval(checkInterval);
                resolve();
                return;
              }
              attempts++;
              if (customElements.get('docuseal-builder') || customElements.get('docuseal-form-builder')) {
                clearInterval(checkInterval);
                resolve();
              } else if (attempts > 20) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            return;
          }

          // Load the builder script from EU CDN
          const script = document.createElement('script');
          script.src = 'https://cdn.docuseal.eu/js/builder.js';
          script.async = true;
          
          script.onload = () => {
            if (isCleanedUp) return resolve();
            setTimeout(() => resolve(), 500);
          };
          
          script.onerror = (err) => {
            console.error('❌ Failed to load DocuSeal builder script:', err);
            reject(new Error('Failed to load DocuSeal builder script'));
          };
          
          document.head.appendChild(script);
        });
      };

      const createBuilderElement = async () => {
        if (isCleanedUp) return;
        
        const container = document.getElementById('docusealBuilderContainer');

        if (!container) {
          retryCount++;
          if (retryCount < MAX_RETRIES && !isCleanedUp) {
            timeoutId = setTimeout(createBuilderElement, 500);
          }
          return;
        }

        // Ensure script is loaded first
        try {
          await ensureBuilderScriptLoaded();
        } catch (error) {
          if (!isCleanedUp) {
            setFormLoadError('Failed to load DocuSeal builder. Please try using manual verification.');
            setIsFormLoading(false);
          }
          return;
        }

        if (isCleanedUp) return;

        // Determine which custom element to use
        const builderTagName = customElements.get('docuseal-builder') ? 'docuseal-builder' : 'docuseal-form-builder';

        // Check if builder already exists
        if (container.querySelector(builderTagName)) {
          setIsFormLoading(false);
          return;
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create the builder element
        builderElement = document.createElement(builderTagName);
        builderElement.setAttribute('id', 'docusealBuilder');
        builderElement.setAttribute('data-token', formBuilderToken);
        builderElement.setAttribute('host', 'docuseal.eu'); // Use EU server
        builderElement.setAttribute('data-host', 'docuseal.eu'); // Use EU server (backup)
        console.log('🔍 Builder attributes set:', {
          token: formBuilderToken ? 'present' : 'missing',
          host: 'docuseal.eu',
          templateId
        });
        builderElement.setAttribute('data-preview', 'false');
        builderElement.setAttribute('data-with-send-button', 'false');
        builderElement.setAttribute('data-with-upload-button', 'false');
        builderElement.setAttribute('data-with-sign-yourself-button', 'false');
        builderElement.setAttribute('data-autosave', 'true');
        builderElement.setAttribute('data-with-documents-list', 'true');
        builderElement.setAttribute('data-with-fields-list', 'true');
        
        // Apply dark/light mode theming
        if (isDark) {
          builderElement.setAttribute('data-background-color', '#1a1a2e');
          const darkModeCSS = [
            '.bg-white { background-color: #1e293b !important; }',
            '.bg-gray-50 { background-color: #1e293b !important; }',
            '.bg-gray-100 { background-color: #334155 !important; }',
            '.bg-gray-200 { background-color: #475569 !important; }',
            '[class*="bg-white"] { background-color: #1e293b !important; }',
            '[class*="bg-gray-50"] { background-color: #1e293b !important; }',
            '.text-gray-500 { color: #94a3b8 !important; }',
            '.text-gray-600 { color: #cbd5e1 !important; }',
            '.text-gray-700 { color: #e2e8f0 !important; }',
            '.text-gray-800 { color: #f1f5f9 !important; }',
            '.text-gray-900 { color: #f8fafc !important; }',
            '.text-black { color: #f8fafc !important; }',
            '[class*="text-gray-"] { color: #e2e8f0 !important; }',
            '.border-gray-200 { border-color: #475569 !important; }',
            '.border-gray-300 { border-color: #64748b !important; }',
            '[class*="border-gray-"] { border-color: #475569 !important; }',
            '.divide-gray-200 > * + * { border-color: #475569 !important; }',
            'input { background-color: #334155 !important; color: #f8fafc !important; border-color: #64748b !important; }',
            'select { background-color: #334155 !important; color: #f8fafc !important; border-color: #64748b !important; }',
            'textarea { background-color: #334155 !important; color: #f8fafc !important; border-color: #64748b !important; }',
            'button:not([class*="bg-blue"]):not([class*="bg-green"]):not([class*="bg-red"]) { background-color: #475569 !important; color: #f8fafc !important; }',
            '.hover\\:bg-gray-50:hover { background-color: #334155 !important; }',
            '.hover\\:bg-gray-100:hover { background-color: #475569 !important; }',
            'aside { background-color: #1e293b !important; }',
            'nav { background-color: #1e293b !important; }',
            'header { background-color: #1e293b !important; }',
            'main { background-color: #0f172a !important; }',
            'ul { color: #e2e8f0 !important; }',
            'li { color: #e2e8f0 !important; }',
            'svg { color: inherit !important; }',
            '.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4) !important; }',
            '.shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4) !important; }',
            '.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4) !important; }',
            '.ring-1 { --tw-ring-color: #64748b !important; }',
          ].join(' ');
          builderElement.setAttribute('data-custom-css', darkModeCSS);
        } else {
          builderElement.setAttribute('data-background-color', '#ffffff');
          builderElement.setAttribute('data-custom-css', '.bg-gray-50 { background-color: #f8fafc !important; }');
        }
        
        builderElement.style.width = '100%';
        builderElement.style.minHeight = '700px';
        builderElement.style.display = 'block';
        builderElement.style.borderRadius = '8px';
        builderElement.style.overflow = 'hidden';

        // Append to container
        container.appendChild(builderElement);
        builderRef.current = builderElement;

        // Set up event listeners
        handleLoad = () => {
          if (!isCleanedUp) setIsFormLoading(false);
        };

        handleSave = () => {
          if (!isCleanedUp) setIsFormVerified(true);
        };

        builderElement.addEventListener('load', handleLoad);
        builderElement.addEventListener('save', handleSave);
        builderElement.addEventListener('onLoad', handleLoad);
        builderElement.addEventListener('onSave', handleSave);

        // Set loading to false after a delay as fallback
        setTimeout(() => {
          if (!isCleanedUp) setIsFormLoading(false);
        }, 3000);
      };

      // Start creating the builder element after a short delay
      timeoutId = setTimeout(createBuilderElement, 300);

      // Cleanup function
      return () => {
        isCleanedUp = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (builderElement && handleLoad && handleSave) {
          builderElement.removeEventListener('load', handleLoad);
          builderElement.removeEventListener('save', handleSave);
          builderElement.removeEventListener('onLoad', handleLoad);
          builderElement.removeEventListener('onSave', handleSave);
        }
      };
    }
  }, [formBuilderToken, templateId, isDark]);

  // Load customer details from opportunity data
  const loadCustomerDetails = async () => {
    try {
      setIsLoadingCustomerDetails(true);
      console.log('🔍 ContractSigningScreen: Loading customer details for opportunityId:', opportunityId);
      
      if (opportunityId) {
        const { api } = await import('../utils/api');
        
        // Try to get customer details from customer-details endpoint first
        try {
          const customerResponse = await api.get(`/opportunities/${opportunityId}/customer-details`);
          if (customerResponse.success && customerResponse.data) {
            const customerData = customerResponse.data as any;
            const extractedEmail = customerData.email || customerData.contactEmail || '';
            let extractedName = customerData.name || 'Contract Signer';
            
            // If name contains "POSTCODE, NAME" format, extract just the name
            if (extractedName && extractedName.includes(', ')) {
              const nameParts = extractedName.split(', ');
              if (nameParts.length >= 2) {
                extractedName = nameParts[1].trim();
              }
            }
            
            setCustomerName(extractedName);
            setCustomerEmail(extractedEmail);
            // Initialize override field with loaded email value
            setOverrideCustomerEmail(extractedEmail);
            
            console.log('✅ Customer details loaded:', { 
              name: extractedName, 
              email: extractedEmail,
              rawData: customerData
            });
            setIsLoadingCustomerDetails(false);
            return;
          }
        } catch (customerError) {
          console.log('⚠️ Customer details endpoint failed, falling back to opportunity data', customerError);
        }
        
        // Fallback to opportunity data
        console.log('🌐 Making API call to:', `/opportunities/${opportunityId}`);
        const response = await api.get(`/opportunities/${opportunityId}`);
        console.log('📡 API Response:', response.data);
        
        if ((response.data as any)?.success && (response.data as any)?.data) {
          const opportunity = (response.data as any).data;
          
          // Parse the name field which contains "N12 9JA, Lisa Jones" format
          let extractedCustomerName = 'Contract Signer';
          
          if (opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              extractedCustomerName = nameParts[1].trim();
            } else if (nameParts.length === 1) {
              extractedCustomerName = nameParts[0].trim();
            }
          }
          
          setCustomerName(extractedCustomerName);
          setCustomerEmail(opportunity.contactEmail || '');
          // Initialize override field with loaded email value
          setOverrideCustomerEmail(opportunity.contactEmail || '');
          console.log('✅ Customer details extracted from opportunity:', { 
            name: extractedCustomerName, 
            email: opportunity.contactEmail
          });
        } else {
          // Fallback parsing
          const opportunity = response.data as any;
          if (opportunity && opportunity.name) {
            const nameParts = opportunity.name.split(', ');
            if (nameParts.length >= 2) {
              const name = nameParts[1].trim();
              setCustomerName(name);
            } else if (nameParts.length === 1) {
              const name = nameParts[0].trim();
              setCustomerName(name);
            }
          }
          if (opportunity) {
            const email = opportunity.contactEmail || '';
            setCustomerEmail(email);
            setOverrideCustomerEmail(email);
          }
        }
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      // Keep default customer name
    } finally {
      setIsLoadingCustomerDetails(false);
    }
  };

  const loadExistingPDF = async () => {
    try {
      console.log('🔍 Loading contract for opportunity:', opportunityId);
      setLoadingContracts(true);
      
      // Get workflow progress to find the calculator type and PDF info
      const { api } = await import('../utils/api');
      const progressResponse = await api.get(`/opportunity-workflow/progress/${opportunityId}`);
      const progressResult = progressResponse.data as any;
      
      // Find the calculator step to determine type (now step 3)
      const calculatorStep = progressResult?.steps?.find((s: any) => s.stepNumber === 3);
      const calculatorType = calculatorStep?.data?.calculatorType || 'off-peak';
      
      // Find the contract generation step (step 8) to get PDF path
      const contractStep = progressResult?.steps?.find((s: any) => s.stepNumber === 8);
      const pdfPath = contractStep?.data?.pdfPath;
      const pdfUrl = contractStep?.data?.pdfUrl;
      
      // Create a default contract object
      const defaultContract = {
        id: 'default-contract',
        name: calculatorType === 'flux' || calculatorType === 'epvs' ? 'Flux Contract' : 'Off Peak Contract',
        type: calculatorType === 'flux' || calculatorType === 'epvs' ? 'Flux Calculator' : 'Off Peak Calculator',
        description: `Contract generated from ${calculatorType === 'flux' || calculatorType === 'epvs' ? 'Flux' : 'Off Peak'} calculator data`,
        filePath: pdfPath || (calculatorType === 'flux' || calculatorType === 'epvs' 
          ? `src/excel-file-calculator/epvs-opportunities/pdfs/EPVS Calculator - ${opportunityId}.pdf`
          : `src/excel-file-calculator/opportunities/pdfs/Off Peak Calculator - ${opportunityId}.pdf`),
        pdfUrl: pdfUrl || (calculatorType === 'flux' || calculatorType === 'epvs'
          ? `/api/epvs-automation/pdf/${opportunityId}`
          : `/api/excel-automation/pdf/${opportunityId}`),
        calculatorType: calculatorType,
        isEPVS: calculatorType === 'flux' || calculatorType === 'epvs',
      };
      
      setSelectedContract(defaultContract);
      setSelectedPdfPath(defaultContract.filePath);
      setPdfUrl(defaultContract.pdfUrl);
      
      // Go directly to signing step
      setStep('signing');
      
    } catch (error) {
      console.error('🔍 Error loading contract:', error);
      setError('Failed to load contract');
      // Still go to signing step even if there's an error
      setStep('signing');
    } finally {
      setLoadingContracts(false);
    }
  };



  // DocuSeal workflow handler - Step 1: Create template for verification
  const handleCreateDocuSealWorkflow = async (calculatorType: 'flux' | 'off-peak') => {
    // Prevent multiple clicks - disable immediately
    if (isCreatingWorkflow) {
      return;
    }

    // Set loading state immediately to prevent double clicks
    setIsCreatingWorkflow(true);
    setError(null);
    setSelectedCalculatorType(calculatorType);

    try {
      // Import API once at the start
      const { api } = await import('../utils/api');
      
      console.log('🔍 Creating DocuSeal template for verification, calculator type:', calculatorType);
      
      // Get current date in YYYY-MM-DD format
      const date = new Date().toISOString().split('T')[0];
      
      // Determine the route based on calculator type - use /template endpoint
      const route = calculatorType === 'flux' 
        ? '/docuseal/contract/flux/template'
        : '/docuseal/contract/off-peak/template';
      
      // Prepare request body - only opportunityId and contractData for template creation
      const requestBody: any = {
        opportunityId,
        contractData: {
          customerName: customerName,
          date,
          postcode: 'N/A' // Backend may require it
        }
      };
      
      // Only include contractPdfPath if we have it (for flux or if explicitly provided)
      if (selectedContract?.filePath || selectedPdfPath) {
        requestBody.contractPdfPath = selectedContract?.filePath || selectedPdfPath;
      }
      
      console.log('🔍 Calling route:', route);
      console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2));
      
      // Use the appropriate route based on calculator type
      const contractResponse = await api.post(route, requestBody);

      const responseData = contractResponse.data as any;

      if (responseData.success) {
        console.log('✅ DocuSeal template created:', responseData.data);
        console.log('📋 Full response data:', JSON.stringify(responseData, null, 2));
        
        // Store template data from response
        const data = responseData.data || responseData;
        const receivedTemplateId = data.templateId || data.id || data.template_id;
        const receivedTemplateSlug = data.templateSlug || data.template_slug;
        const receivedEmbeddedFormUrl = data.embeddedFormUrl || data.embedded_form_url;
        const receivedPreviewUrl = data.previewUrl || data.preview_url;
        const receivedCredentials = data.previewCredentials || data.preview_credentials;
        const receivedFormBuilderToken = data.formBuilderToken || data.form_builder_token;
        
        console.log('🔍 TemplateId from response:', receivedTemplateId);
        console.log('🔍 TemplateSlug from response:', receivedTemplateSlug);
        console.log('🔍 EmbeddedFormUrl from response:', receivedEmbeddedFormUrl);
        console.log('🔍 PreviewUrl from response:', receivedPreviewUrl);
        console.log('🔍 FormBuilderToken from response:', receivedFormBuilderToken ? 'Present' : 'Not present');
        
        if (receivedTemplateId) {
          setTemplateId(receivedTemplateId);
        }
        if (receivedTemplateSlug) {
          setTemplateSlug(receivedTemplateSlug);
        }
        if (receivedEmbeddedFormUrl) {
          setEmbeddedFormUrl(receivedEmbeddedFormUrl);
        }
        if (receivedPreviewUrl) {
          setPreviewUrl(receivedPreviewUrl);
        }
        if (receivedCredentials) {
          setPreviewCredentials(receivedCredentials);
        }
        if (receivedFormBuilderToken) {
          setFormBuilderToken(receivedFormBuilderToken);
        }
        
        // Go to verification step to allow user to verify field positions
        setStep('verification');
      } else {
        throw new Error(responseData.error || 'Failed to create DocuSeal template');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create DocuSeal template. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  // Step 2: Create submission from verified template
  const handleCreateSubmission = async () => {
    if (!templateId) {
      Alert.alert('Error', 'Template ID is missing. Please create a template first.');
      return;
    }

    // Use override email if provided, otherwise use loaded value
    const finalCustomerEmail = overrideCustomerEmail.trim() || customerEmail;

    if (!finalCustomerEmail) {
      Alert.alert('Error', 'Customer email is required. Please enter an email address.');
      return;
    }

    setIsCreatingSubmission(true);
    setError(null);

    try {
      const { api } = await import('../utils/api');
      
      console.log('🔍 Creating submission from template:', templateId);
      
      // Get current date in YYYY-MM-DD format
      const date = new Date().toISOString().split('T')[0];
      
      // Prepare request body for submission creation
      const requestBody = {
        opportunityId,
        customerData: {
          name: customerName,
          email: finalCustomerEmail
        },
        contractData: {
          customerName: customerName,
          date,
          postcode: 'N/A'
        }
      };
      
      console.log('🔍 Calling route:', `/docuseal/template/${templateId}/submit`);
      console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2));
      
      // Create submission from verified template
      const submissionResponse = await api.post(`/docuseal/template/${templateId}/submit`, requestBody);

      const responseData = submissionResponse.data as any;

      if (responseData.success) {
        console.log('✅ DocuSeal submission created:', responseData.data);
        console.log('📋 Full response data:', JSON.stringify(responseData, null, 2));
        
        // Store submission ID from response
        const data = responseData.data || responseData;
        const receivedSubmissionId = data.submissionId || data.id || data.submission_id;
        
        console.log('🔍 SubmissionId from response:', receivedSubmissionId);
        
        // Always go to status screen after sending (document is sent via email)
        if (receivedSubmissionId) {
          setSubmissionId(receivedSubmissionId);
        }
        setSigningStatus('sent');
        setStep('status');
        
        // Start checking status if we have a valid submission ID
        if (receivedSubmissionId && receivedSubmissionId !== 'unknown') {
          setTimeout(() => {
            checkSigningStatus(receivedSubmissionId);
          }, 1000);
        }
      } else {
        throw new Error(responseData.error || 'Failed to create DocuSeal submission');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal submission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create DocuSeal submission. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCreatingSubmission(false);
    }
  };

  // Check signing status - uses new endpoint that syncs with DocuSeal
  const checkSigningStatus = async (submissionIdToCheck?: string) => {
    const idToCheck = submissionIdToCheck || submissionId;
    
    setIsCheckingStatus(true);
    try {
      const { api } = await import('../utils/api');
      
      // If we have a valid submissionId, use the refresh endpoint
      if (idToCheck && idToCheck !== 'unknown') {
        console.log('🔍 Refreshing status for submissionId:', idToCheck);
        const response = await api.get(`/docuseal/submissions/${idToCheck}/refresh-status`);
        
        if (response.success && response.data) {
          // The response.data might be the entire response object or just the data
          // Handle both cases: response.data.data or response.data
          const statusData = (response.data as any).data || response.data;
          console.log('📊 Status data extracted:', statusData);
          updateStatusFromResponse(statusData);
        }
      } else {
        // If no submissionId, use opportunity endpoint which auto-syncs
        console.log('🔍 Checking status by opportunityId:', opportunityId);
        const response = await api.get(`/docuseal/submissions/opportunity/${opportunityId}`);
        
        if (response.success && response.data) {
          // Response structure: { contract: {...}, disclaimer: {...}, booking-confirmation: {...} }
          const submissionsData = response.data as any;
          
          // Get contract submission (key is 'contract')
          const contractSubmission = submissionsData.contract;
          
          if (contractSubmission) {
            console.log('✅ Found contract submission:', contractSubmission);
            // Update submissionId if we found one
            if (contractSubmission.submissionId && !submissionId) {
              setSubmissionId(contractSubmission.submissionId);
            }
            updateStatusFromResponse(contractSubmission);
          } else {
            console.log('⚠️ No contract submission found in response:', submissionsData);
          }
        }
      }
    } catch (error) {
      console.error('Error checking signing status:', error);
      // Don't show error to user, just log it
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Helper function to update status from API response
  const getContractSigningStepNumber = async (): Promise<number> => {
    try {
      const { workflowApi } = await import('../utils/api');
      const progressResponse = await workflowApi.getOpportunityProgress(opportunityId);
      if (progressResponse?.success && progressResponse.data?.steps) {
        const step = progressResponse.data.steps.find((s: any) => s.stepType === 'CONTRACT_SIGNING');
        if (step?.stepNumber) {
          return step.stepNumber;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch workflow progress for contract signing step number:', error);
    }
    // Default fallback: contract signing is typically step 9
    return 9;
  };

  const updateStatusFromResponse = (statusData: any) => {
    console.log('📊 Updating status from response:', JSON.stringify(statusData, null, 2));
    
    // Handle status values: "pending", "completed", "declined", "expired"
    let currentStatus: 'awaiting' | 'sent' | 'opened' | 'completed' | null = null;
    
    // Check overall submission status - handle both direct status and nested data
    const actualStatus = statusData.status || (statusData.data && statusData.data.status);
    if (actualStatus) {
      // Map API status to our status values
      const apiStatus = actualStatus.toLowerCase();
      console.log('📊 API Status:', apiStatus);
      
      if (apiStatus === 'completed') {
        currentStatus = 'completed';
      } else if (apiStatus === 'pending') {
        currentStatus = 'sent'; // Map pending to 'sent' for display
      } else if (apiStatus === 'declined') {
        currentStatus = 'sent'; // Map declined to 'sent' for display
      } else if (apiStatus === 'expired') {
        currentStatus = 'sent'; // Map expired to 'sent' for display
      }
    } else {
      console.log('⚠️ No status found in response. Available keys:', Object.keys(statusData));
    }
    
    // Update submissionId if available (check both direct and nested)
    const actualSubmissionId = statusData.submissionId || (statusData.data && statusData.data.submissionId);
    if (actualSubmissionId && !submissionId) {
      setSubmissionId(actualSubmissionId);
    }
    
    // Extract signer info if available (from refresh-status endpoint)
    const submitters = statusData.submitters || (statusData.data && statusData.data.submitters);
    if (submitters && Array.isArray(submitters) && submitters.length > 0) {
      const customerEmailToCheck = overrideCustomerEmail.trim() || customerEmail;
      const customerSigner = submitters.find((s: any) => 
        s.email && s.email.toLowerCase() === customerEmailToCheck.toLowerCase()
      ) || submitters[0];
      
      setSignerInfo(customerSigner);
      
      // Use signer status if available (more specific)
      if (customerSigner.status) {
        const signerStatus = customerSigner.status.toLowerCase();
        if (signerStatus === 'completed') {
          currentStatus = 'completed';
        } else if (signerStatus === 'opened') {
          currentStatus = 'opened';
        } else if (signerStatus === 'sent' && !currentStatus) {
          currentStatus = 'sent';
        } else if (signerStatus === 'pending' && !currentStatus) {
          currentStatus = 'sent';
        }
      }
    }
    
    // Update status if we determined one
    if (currentStatus) {
      console.log('✅ Setting status to:', currentStatus);
      setSigningStatus(currentStatus as 'pending' | 'sent' | 'opened' | 'completed' | 'awaiting' | null);
      
      // If completed, update workflow (stay on status screen)
      if (currentStatus === 'completed') {
        console.log('🎉 Contract signing completed!');
        
        // Update workflow step as completed
        (async () => {
          try {
            const { workflowApi } = await import('../utils/api');
            const contractStepNumber = await getContractSigningStepNumber();
            await workflowApi.completeStep(opportunityId, contractStepNumber, {
              submissionId: submissionId,
              signedAt: new Date().toISOString(),
              status: 'completed'
            });
            console.log(`✅ Workflow step ${contractStepNumber} marked as completed`);
          } catch (error) {
            console.warn('Failed to update workflow step:', error);
          }
        })();
      }
    } else {
      console.log('⚠️ Could not determine status from response');
    }
  };

  const handleRefreshStatus = async () => {
    // Use the new endpoint that syncs with DocuSeal
    // This will use refresh-status if we have submissionId, or opportunity endpoint if we don't
    await checkSigningStatus();
  };

  // Digital signature handlers (kept for backward compatibility, but not used in new flow)
  const handleTestDigitalSignature = () => {
    console.log('🖊️ Contract Signing: Digital signature button clicked');
    // Redirect to calculator type selection if not already selected
    if (!selectedCalculatorType) {
      setStep('selecting');
    } else {
      // If calculator type is selected, show alert to use the proper button
      Alert.alert('Info', 'Please use the "Send Contract for Signing" button after selecting calculator type and entering email.');
    }
  };

  const handleSignatureSave = async (signatureData: string, digitalFootprint: any) => {
    console.log('🖊️ Contract Signing: Signature save called', { 
      signatureDataLength: signatureData.length,
      digitalFootprint: digitalFootprint ? 'present' : 'missing'
    });
    try {
      setIsSigningPDF(true);
      setShowSignaturePad(false);
      setStep('processing');

      // Call the backend to sign the PDF with digital signature
      const baseURL = '/api/';
      const response = await fetch(`${baseURL}digital-signature/sign-pdf`, {
        method: 'POST',
            headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfPath: selectedPdfPath,
          signatureData,
          digitalFootprint,
          opportunityId: opportunityId,
          signedBy: customerName,
          pageNumbers: [6, 19, 21, 23] // Sign on pages 6, 19, 21, and 23
        }),
      });

      console.log('🖊️ Contract Signing: API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('🖊️ Contract Signing: Error response:', errorText);
        
        // Handle specific error cases
        if (response.status === 400 && errorText.includes('ENOENT')) {
          throw new Error('Contract PDF not found. Please generate the contract first in the previous step.');
            } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const result = await response.json();
      console.log('🖊️ Contract Signing: API response result:', result);

      if (result.success) {
        // Mark step 9 (Contract Signing) as completed with signature
      const { workflowApi } = await import('../utils/api');
        const contractStepNumber = await getContractSigningStepNumber();
        await workflowApi.completeStep(opportunityId, contractStepNumber, {
        signature: signatureData,
        signedAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
          digitallySigned: true,
          signatureId: result.metadata?.signatureId,
          verificationHash: result.metadata?.verificationHash
      });
      
      console.log('🔍 Contract signing completed successfully');
      // Stay on status screen - user can navigate via "Next: Payment" button
      setSigningStatus('completed');
      } else {
        throw new Error(result.message || 'Failed to sign PDF');
      }
    } catch (error) {
      console.error('🖊️ Contract Signing: Error signing PDF:', error);
      setError(`Failed to sign PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('signing');
      Alert.alert(
        'Error', 
        `Failed to sign PDF: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n1. Backend server is running\n2. PDF file exists\n3. Network connection`
      );
    } finally {
      setIsSigningPDF(false);
    }
  };

  const handleSignatureCancel = () => {
    // Navigate directly to SolarWorkflowScreen instead of going back
    (navigation as any).navigate('SolarWorkflow', { 
      opportunityId: opportunityId,
      opportunity: null
    });
  };

  const handleDownloadPDF = async () => {
    console.log('🔍 Download button pressed, pdfUrl:', pdfUrl);
    if (!pdfUrl) {
      Alert.alert('Error', 'PDF not available for download');
      return;
    }

    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);
      
      // Fix the URL by removing double slashes and ensuring proper format
      let downloadUrl = pdfUrl;
      
      console.log('🔧 DEBUG: Original pdfUrl:', pdfUrl);
      
      // First, trim any leading/trailing whitespace
      downloadUrl = downloadUrl.trim();
      
      if (!downloadUrl.startsWith('http')) {
        // If the URL already starts with /api/, don't add it again (reverse proxy handles this)
        if (downloadUrl.startsWith('/api/')) {
          // URL already has /api/ prefix, use as is
          console.log('🔧 DEBUG: URL already has /api/ prefix, using as-is');
          downloadUrl = downloadUrl;
        } else {
          // Remove leading slash if present to avoid double slashes
          console.log('🔧 DEBUG: URL does not have /api/ prefix, adding it');
          downloadUrl = downloadUrl.startsWith('/') ? downloadUrl.substring(1) : downloadUrl;
          downloadUrl = `/api/${downloadUrl}`;
        }
      }
      
      console.log('🔧 DEBUG: After API prefix logic:', downloadUrl);
      
      // Additional fix: Remove any double slashes that might exist in the URL
      downloadUrl = downloadUrl.replace(/\/+/g, '/').replace(':/', '://');
      
      console.log('🔧 DEBUG: After double slash fix:', downloadUrl);
      
      // Convert view URL to download URL
      downloadUrl = downloadUrl.replace('/view/', '/download/');
      
      const downloadFilename = `Signed-Contract-${opportunityId}.pdf`;
      
      console.log('📥 Downloading Signed Contract PDF from:', downloadUrl);
      
      if (Platform.OS === 'web') {
        // For web, fetch with authentication headers first, then create blob download
        const { authApi } = await import('../utils/api');
        const token = await authApi.getAccessToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        setDownloadProgress(25);
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        setDownloadProgress(50);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Signed contract PDF file not found. Please try generating the contract again.');
          } else if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          } else {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
        }
        
        // Check if we got a valid file
        const contentType = response.headers.get('content-type');
        console.log('📥 Response content-type:', contentType);
        
        // More flexible content-type validation
        const isValidFileType = contentType && (
          contentType.includes('pdf') || 
          contentType.includes('application/octet-stream') ||
          contentType.includes('application/pdf')
        );
        
        if (!isValidFileType) {
          console.error('📥 Invalid content-type received:', contentType);
          throw new Error(`Invalid file type received from server. Content-Type: ${contentType}`);
        }
        
        setDownloadProgress(75);
        
        const blob = await response.blob();
        
        // Verify blob size
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty. Please try again.');
        }
        
        setDownloadProgress(90);
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setDownloadProgress(100);
        setDownloaded(true);
        Alert.alert('Download Complete!', 'Signed contract PDF has been downloaded successfully.');
      } else {
        // For mobile, use FileSystem with authentication
        const { authApi } = await import('../utils/api');
        const token = await authApi.getAccessToken();
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const localPath = `${FileSystem.documentDirectory}${downloadFilename}`;
        
        console.log('📁 Saving to:', localPath);
        
        // Download the file with authentication headers
        const downloadResult = await FileSystem.downloadAsync(
          downloadUrl, 
          localPath,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }
        );
        
        if (downloadResult.status === 200) {
          setLocalFilePath(downloadResult.uri);
          setDownloaded(true);
          
          Alert.alert(
            'Download Complete!',
            'Signed contract PDF has been saved to your device.',
            [
              { text: 'Open in Browser', onPress: () => Linking.openURL(pdfUrl) },
              { text: 'OK' }
            ]
          );
        } else if (downloadResult.status === 404) {
          throw new Error('Signed contract PDF file not found. Please try generating the contract again.');
        } else if (downloadResult.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else {
          throw new Error(`Download failed with status: ${downloadResult.status}`);
        }
      }
    } catch (error) {
      console.error('📥 Signed contract download error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setDownloadError(errorMessage);
      setDownloadProgress(0);
      Alert.alert('Download Error', `Failed to download Signed Contract PDF: ${errorMessage}`);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (step === 'loading') {
    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        }
      ]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Loading available contracts...</Text>
        </View>
      </SafeAreaView>
    );
  }


  if (step === 'processing') {
    return (
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        }
      ]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Processing signature...</Text>
          <Text style={[styles.loadingSubtext, { color: theme.secondaryText }]}>Adding signature to contract PDF</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'status') {
    const getStatusIcon = () => {
      switch (signingStatus) {
        case 'completed':
          return 'checkmark-circle';
        case 'opened':
          return 'eye';
        case 'sent':
          return 'mail';
        default:
          return 'time';
      }
    };

    const getStatusColor = () => {
      switch (signingStatus) {
        case 'completed':
          return theme.successButton;
        case 'opened':
          return '#FF9800';
        case 'sent':
          return theme.primaryButton;
        default:
          return theme.secondaryText;
      }
    };

    const getStatusText = () => {
      switch (signingStatus) {
        case 'completed':
          return 'Contract Signed';
        case 'opened':
          return 'Email Opened';
        case 'sent':
          return 'Email Sent';
        case 'awaiting':
          return 'Awaiting Send';
        default:
          return 'Checking Status...';
      }
    };

    const getStatusDescription = () => {
      switch (signingStatus) {
        case 'completed':
          return 'The customer has successfully signed the contract.';
        case 'opened':
          return 'The customer has opened the signing email but has not yet signed.';
        case 'sent':
          return 'The signing email has been sent to the customer. Waiting for them to sign.';
        case 'awaiting':
          return 'The contract is being prepared. The email will be sent shortly.';
        default:
          return 'Checking signing status...';
      }
    };

    return (
      <SafeAreaView style={[
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
                style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
                onPress={() => setStep('signing')}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Signing Status
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Monitor contract signing progress
                </Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.statusContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.statusContent}>
            {/* Status Icon */}
            <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor() + '20' }]}>
              <Ionicons name={getStatusIcon()} size={64} color={getStatusColor()} />
            </View>

            {/* Status Title */}
            <Text style={[styles.statusTitle, { color: theme.primaryText }]}>
              {getStatusText()}
            </Text>

            {/* Status Description */}
            <Text style={[styles.statusDescription, { color: theme.secondaryText }]}>
              {getStatusDescription()}
            </Text>

            {/* Signer Info */}
            {signerInfo && (
              <View style={[styles.signerInfoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.signerInfoTitle, { color: theme.primaryText }]}>Signer Information</Text>
                <View style={styles.signerInfoRow}>
                  <Ionicons name="person-outline" size={16} color={theme.tertiaryText} />
                  <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                    {signerInfo.name || customerName}
                  </Text>
                </View>
                <View style={styles.signerInfoRow}>
                  <Ionicons name="mail-outline" size={16} color={theme.tertiaryText} />
                  <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                    {signerInfo.email || overrideCustomerEmail || customerEmail}
                  </Text>
                </View>
                {signerInfo.completed_at && (
                  <View style={styles.signerInfoRow}>
                    <Ionicons name="time-outline" size={16} color={theme.tertiaryText} />
                    <Text style={[styles.signerInfoText, { color: theme.secondaryText }]}>
                      Signed: {new Date(signerInfo.completed_at).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Refresh Button */}
            <TouchableOpacity
              style={[
                styles.refreshButton, 
                { backgroundColor: theme.primaryButton },
                (!submissionId || submissionId === 'unknown') && { opacity: 0.7 }
              ]}
              onPress={handleRefreshStatus}
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="refresh" size={20} color="white" />
              )}
              <Text style={styles.refreshButtonText}>
                {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
              </Text>
            </TouchableOpacity>

            {/* Next Button - Show when contract is signed */}
            {signingStatus === 'completed' && (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: theme.successButton }]}
                onPress={async () => {
                  // Mark contract signing step as completed
                  try {
                    const { workflowApi } = await import('../utils/api');
                    const contractStepNumber = await getContractSigningStepNumber();
                    await workflowApi.completeStep(opportunityId, contractStepNumber, {
                      signedAt: new Date().toISOString(),
                      submissionId: submissionId,
                      status: 'completed'
                    });
                    // Navigate to Express Consent (new step after contract signing)
                    navigation.navigate('ExpressConsentSigning', { opportunityId });
                  } catch (error) {
                    console.error('Error completing contract signing step:', error);
                    // Still navigate even if step completion fails
                    navigation.navigate('ExpressConsentSigning', { opportunityId });
                  }
                }}
              >
                <Text style={styles.nextButtonText}>Next: Express Consent</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            )}
            
            {(!submissionId || submissionId === 'unknown') && (
              <View style={[styles.warningContainer, { backgroundColor: 'rgba(255, 165, 0, 0.1)', borderColor: 'rgba(255, 165, 0, 0.3)' }]}>
                <Ionicons name="information-circle-outline" size={16} color="#FFA500" />
                <Text style={[styles.refreshNote, { color: theme.secondaryText }]}>
                  Status checking is limited without a submission ID. The contract has been sent successfully to the customer.
                </Text>
              </View>
            )}

            {/* Info Message */}
            <View style={[styles.infoMessage, { backgroundColor: theme.tertiaryBackground }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.secondaryText} />
              <Text style={[styles.infoText, { color: theme.secondaryText }]}>
                ✨ Status updates automatically every 5 seconds. The customer will receive an email with a link to sign the contract.
              </Text>
            </View>
            
            {/* Warning if no submissionId */}
            {!submissionId && (
              <View style={[styles.warningContainer, { backgroundColor: '#FF9800' + '20', borderColor: '#FF9800' }]}>
                <Ionicons name="warning-outline" size={16} color="#FF9800" />
                <Text style={[styles.warningText, { color: '#FF9800' }]}>
                  Status checking may be limited. The contract has been sent successfully.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </SafeAreaView>
    );
  }

  if (step === 'verification') {
    return (
      <SafeAreaView style={[
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
                style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
                onPress={() => setStep('signing')}
              >
                <Feather name="arrow-left" size={20} color={theme.secondaryText} />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                  Verify Template
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                  Review field positions before sending
                </Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView style={styles.verificationContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.verificationContent}>
            {/* Success Icon */}
            <View style={[styles.verificationIconContainer, { backgroundColor: theme.primaryButton + '20' }]}>
              <Ionicons name="checkmark-circle" size={64} color={theme.primaryButton} />
            </View>

            {/* Title */}
            <Text style={[styles.verificationTitle, { color: theme.primaryText }]}>
              Template Created Successfully
            </Text>

            {/* Description */}
            <Text style={[styles.verificationDescription, { color: theme.secondaryText }]}>
              Please verify the field positions in the template preview. Once verified, you can proceed to send the contract to the customer for signing.
            </Text>

            {/* Form Builder Card - Web Platform with Token */}
            {Platform.OS === 'web' && formBuilderToken && templateId && (
              <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.builderHeaderRow}>
                  <Ionicons name="construct-outline" size={24} color={theme.primaryButton} />

                </View>

                
                {/* Loading indicator */}
                {isFormLoading && (
                  <View style={styles.formLoadingContainer}>
                    <ActivityIndicator size="large" color={theme.primaryButton} />
                    <Text style={[styles.formLoadingText, { color: theme.secondaryText }]}>
                      Loading Form Builder...
                    </Text>
                  </View>
                )}

                {/* DocuSeal Form Builder Container */}
                <View style={styles.embeddedFormContainer}>
                  <div 
                    id="docusealBuilderContainer"
                    ref={(node) => {
                      builderRef.current = node as any;
                    }}
                    style={{
                      width: '100%',
                      minHeight: 700,
                      display: 'block',
                      border: `1px solid ${isDark ? '#475569' : '#e0e0e0'}`,
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    }}
                  />
                </View>

                {isFormVerified ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: theme.successButton + '20', borderColor: theme.successButton }]}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.successButton} />
                    <Text style={[styles.verifiedText, { color: theme.successButton }]}>
                      Fields Verified Successfully
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.verifyFieldsButton, { backgroundColor: theme.successButton, marginTop: 16 }]}
                    onPress={() => setIsFormVerified(true)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.verifyFieldsButtonText}>
                      Fields Look Good - Continue
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Fallback: Embedded Form Card - Web Platform (when no builder token) */}
            {Platform.OS === 'web' && !formBuilderToken && embeddedFormUrl && (
              <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.previewCardTitle, { color: theme.primaryText }]}>Verify Signature Field Positions</Text>
                <Text style={[styles.previewCardDescription, { color: theme.secondaryText }]}>
                  Review the template below and verify that all signature fields are positioned correctly. Complete the form to verify the fields.
                </Text>
                
                {/* Loading indicator */}
                {isFormLoading && !useIframeFallback && (
                  <View style={styles.formLoadingContainer}>
                    <ActivityIndicator size="large" color={theme.primaryButton} />
                    <Text style={[styles.formLoadingText, { color: theme.secondaryText }]}>
                      Loading signature form...
                    </Text>
                  </View>
                )}

                {/* Error message */}
                {formLoadError && !useIframeFallback && (
                  <View style={[styles.formErrorContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
                    <Ionicons name="warning-outline" size={24} color={theme.dangerButton} />
                    <Text style={[styles.formErrorText, { color: theme.dangerButton }]}>
                      {formLoadError}
                    </Text>
                    <TouchableOpacity
                      style={[styles.fallbackButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => setUseIframeFallback(true)}
                    >
                      <Text style={styles.fallbackButtonText}>Use Iframe Fallback</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Embedded DocuSeal Form - Web Component */}
                {!useIframeFallback && (
                  <View style={styles.embeddedFormContainer}>
                    {/* Use a web-native div for the DocuSeal form container */}
                    <div 
                      id="docusealFormContainer"
                      ref={(node) => {
                        formRef.current = node as any;
                      }}
                      style={{
                        width: '100%',
                        minHeight: 600,
                        display: 'block',
                        border: `1px solid ${isDark ? '#475569' : '#e0e0e0'}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      }}
                    />
                  </View>
                )}

                {/* Iframe Fallback */}
                {useIframeFallback && (
                  <View style={styles.embeddedFormContainer}>
                    <iframe
                      src={embeddedFormUrl.replace(/https:\/\./, 'https://')}
                      style={{
                        width: '100%',
                        height: 700,
                        border: `1px solid ${isDark ? '#475569' : '#e0e0e0'}`,
                        borderRadius: 8,
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      }}
                      title="DocuSeal Form Preview"
                      allow="camera; microphone"
                    />
                    <TouchableOpacity
                      style={[styles.switchViewButton, { borderColor: theme.primaryButton }]}
                      onPress={() => setUseIframeFallback(false)}
                    >
                      <Text style={[styles.switchViewButtonText, { color: theme.primaryButton }]}>
                        Switch back to embedded form
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Form view toggle button */}
                {!isFormLoading && !formLoadError && !useIframeFallback && (
                  <TouchableOpacity
                    style={[styles.switchViewButton, { borderColor: theme.secondaryText, marginTop: 12 }]}
                    onPress={() => setUseIframeFallback(true)}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color={theme.secondaryText} />
                    <Text style={[styles.switchViewButtonText, { color: theme.secondaryText }]}>
                      Having issues? Try iframe view
                    </Text>
                  </TouchableOpacity>
                )}

                {isFormVerified ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: theme.successButton + '20', borderColor: theme.successButton }]}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.successButton} />
                    <Text style={[styles.verifiedText, { color: theme.successButton }]}>
                      Fields Verified Successfully
                    </Text>
                  </View>
                ) : (
                  <>
                    {previewCredentials && (
                      <View style={[styles.credentialsCard, { backgroundColor: theme.tertiaryBackground }]}>
                        <Text style={[styles.credentialsTitle, { color: theme.secondaryText }]}>Preview Credentials (if needed):</Text>
                        <Text style={[styles.credentialsText, { color: theme.primaryText }]}>
                          Email: {previewCredentials.email}
                        </Text>
                        <Text style={[styles.credentialsText, { color: theme.primaryText }]}>
                          Password: {previewCredentials.password}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.verifyFieldsButton, { backgroundColor: theme.successButton, marginTop: 16 }]}
                      onPress={() => setIsFormVerified(true)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                      <Text style={styles.verifyFieldsButtonText}>
                        Fields Look Good - Continue
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Fallback Preview URL Card - Mobile Platform or if embeddedFormUrl not available */}
            {((Platform.OS !== 'web' || !embeddedFormUrl) && previewUrl) && (
              <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <Text style={[styles.previewCardTitle, { color: theme.primaryText }]}>Template Preview</Text>
                <Text style={[styles.previewCardDescription, { color: theme.secondaryText }]}>
                  {Platform.OS === 'web' 
                    ? 'Click the button below to open the template preview in a new window. Verify that all signature fields are positioned correctly.'
                    : 'Tap the button below to open the template preview. Verify that all signature fields are positioned correctly.'}
                </Text>
                
                <TouchableOpacity
                  style={[styles.previewButton, { backgroundColor: theme.primaryButton }]}
                  onPress={() => {
                    if (previewUrl) {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(previewUrl, '_blank');
                      } else {
                        Linking.openURL(previewUrl);
                      }
                    }
                  }}
                >
                  <Ionicons name="open-outline" size={20} color="white" />
                  <Text style={styles.previewButtonText}>Open Preview</Text>
                </TouchableOpacity>

                {previewCredentials && (
                  <View style={[styles.credentialsCard, { backgroundColor: theme.tertiaryBackground }]}>
                    <Text style={[styles.credentialsTitle, { color: theme.secondaryText }]}>Preview Credentials:</Text>
                    <Text style={[styles.credentialsText, { color: theme.primaryText }]}>
                      Email: {previewCredentials.email}
                    </Text>
                    <Text style={[styles.credentialsText, { color: theme.primaryText }]}>
                      Password: {previewCredentials.password}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Email Input Section */}
            <View style={[styles.contractInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.inputLabel, { color: theme.secondaryText }]}>CUSTOMER EMAIL:</Text>
              <TextInput
                style={[styles.inputField, { 
                  backgroundColor: theme.tertiaryBackground, 
                  color: theme.primaryText,
                  borderColor: theme.cardBorder
                }]}
                value={overrideCustomerEmail}
                onChangeText={setOverrideCustomerEmail}
                placeholder="Enter email address"
                placeholderTextColor={theme.tertiaryText}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isCreatingSubmission}
              />
            </View>

            {/* Create Submission Button */}
            <TouchableOpacity
              style={[
                styles.submitButton, 
                { backgroundColor: theme.successButton },
                (!templateId || !overrideCustomerEmail.trim() || (Platform.OS === 'web' && !isFormVerified)) && { opacity: 0.6 }
              ]}
              onPress={handleCreateSubmission}
              disabled={isCreatingSubmission || !templateId || !overrideCustomerEmail.trim() || (Platform.OS === 'web' && !isFormVerified)}
            >
              {isCreatingSubmission ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send-outline" size={24} color="white" />
              )}
              <Text style={styles.submitButtonText}>
                {isCreatingSubmission 
                  ? 'Creating Submission...' 
                  : Platform.OS === 'web' && !isFormVerified
                    ? 'Verify Fields First'
                    : 'Send Contract for Signing'}
              </Text>
            </TouchableOpacity>

            {Platform.OS === 'web' && !isFormVerified && embeddedFormUrl && (
              <View style={[styles.warningContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
                <Ionicons name="information-circle-outline" size={16} color={theme.dangerButton} />
                <Text style={[styles.warningText, { color: theme.dangerButton }]}>
                  Please complete the form above to verify field positions before sending the contract.
                </Text>
              </View>
            )}

            {/* Info Message */}
            <View style={[styles.infoMessage, { backgroundColor: theme.tertiaryBackground }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.secondaryText} />
              <Text style={[styles.infoText, { color: theme.secondaryText }]}>
                After verification, the contract will be sent to the customer's email for signing. You can track the signing status on the next screen.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor }]}
              onPress={handleSignatureCancel}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Sign Contract
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                Please sign below to confirm your agreement
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather 
                name={isDark ? "sun" : "moon"} 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.dangerButton + '20', borderColor: theme.dangerButton }]}>
          <Text style={[styles.errorText, { color: theme.dangerButton }]}>{error}</Text>
        </View>
      )}

      {/* Streamlined Contract Signing Interface */}
      <View style={styles.signingContainer}>
        <View style={styles.contractHeader}>
          <View style={[styles.contractIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Ionicons name="document-text-outline" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.contractTitle, { color: theme.primaryText }]}>
            Contract Signing
          </Text>
          <Text style={[styles.contractSubtitle, { color: theme.secondaryText }]}>
            {selectedCalculatorType 
              ? `Sign your ${selectedCalculatorType === 'flux' ? 'Flux' : 'Off Peak'} contract digitally`
              : 'Select calculator type to begin'
            }
          </Text>
        </View>

        {/* Calculator Type Selection */}
        {!selectedCalculatorType && (
          <View style={[styles.contractInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.inputLabel, { color: theme.secondaryText, marginBottom: 16 }]}>
              SELECT CALCULATOR TYPE:
            </Text>
            <View style={styles.calculatorTypeButtons}>
              <TouchableOpacity
                style={[styles.calculatorTypeButton, { 
                  backgroundColor: theme.primaryButton,
                  borderColor: theme.primaryButton
                }]}
                onPress={() => setSelectedCalculatorType('flux')}
              >
                <Ionicons name="flash-outline" size={24} color="white" />
                <Text style={styles.calculatorTypeButtonText}>Flux</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.calculatorTypeButton, { 
                  backgroundColor: theme.secondaryButton || theme.primaryButton,
                  borderColor: theme.secondaryButton || theme.primaryButton
                }]}
                onPress={() => setSelectedCalculatorType('off-peak')}
              >
                <Ionicons name="time-outline" size={24} color="white" />
                <Text style={styles.calculatorTypeButtonText}>Off Peak</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Create Template Button - Only show after calculator type is selected */}
        {selectedCalculatorType && (
          <>
            <View style={[styles.contractInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              {/* Read-only Customer Name */}
              <View style={styles.contractDetailRow}>
                <Ionicons name="person-outline" size={18} color={theme.tertiaryText} />
                <Text style={[styles.customerNameText, { color: theme.primaryText }]}>
                  {customerName || 'Customer'}
                </Text>
              </View>
              
              {/* Digital signature info */}
              <View style={styles.verificationRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.successButton} />
                <Text style={[styles.verificationText, { color: theme.secondaryText }]}>
                  Digital signature with verification
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.signButton, { backgroundColor: theme.primaryButton }]}
              onPress={() => handleCreateDocuSealWorkflow(selectedCalculatorType)}
              disabled={isCreatingWorkflow || isLoadingCustomerDetails}
            >
              {isCreatingWorkflow ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="document-text-outline" size={24} color="white" />
              )}
              <Text style={styles.signButtonText}>
                {isCreatingWorkflow ? 'Creating Template...' : 'Create Template for Verification'}
              </Text>
            </TouchableOpacity>

            {/* Change Calculator Type Button */}
            <TouchableOpacity
              style={[styles.changeTypeButton, { borderColor: theme.borderColor }]}
              onPress={() => setSelectedCalculatorType(null)}
            >
              <Ionicons name="arrow-back-outline" size={18} color={theme.secondaryText} />
              <Text style={[styles.changeTypeButtonText, { color: theme.secondaryText }]}>
                Change Calculator Type
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.signingFeatures}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Legally binding signature via DocuSeal
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="mail-outline" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Signing link emailed to customer
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={16} color={theme.successButton} />
            <Text style={[styles.featureText, { color: theme.secondaryText }]}>
              Secure digital signature workflow
            </Text>
          </View>
        </View>
        
      </View>

      {/* Digital Signature Pad Modal */}
      {Platform.OS === 'web' ? (
        <SimpleSignaturePad
          visible={showSignaturePad}
          onClose={() => setShowSignaturePad(false)}
          onSave={handleSignatureSave}
          title="Sign Contract"
        />
      ) : (
        <MobileCanvasSignaturePad
          visible={showSignaturePad}
          onClose={() => setShowSignaturePad(false)}
          onSave={handleSignatureSave}
          title="Sign Contract"
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    zIndex: 1,
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
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  iconButton: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    ...(Platform.OS === 'web' && {
      minHeight: '60vh' as any, // Ensure loading container has proper height on web
    }),
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    margin: 20,
    ...(Platform.OS === 'web' && {
      marginBottom: 24, // Extra spacing for web
      minHeight: 60, // Ensure error container has minimum height
    }),
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      minHeight: '60vh' as any, // Ensure complete container has proper height on web
      paddingBottom: 60, // Extra padding for web
      marginBottom: 65, // Add margin for BottomNavigation on web
    }),
  },
  successIcon: {
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 20,
    width: '100%',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  spinningIcon: {
    transform: [{ rotate: '0deg' }],
  },
  downloadNote: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  redirectText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  signingContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-start',
    paddingTop: 32,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      marginBottom: 65, // Add margin for BottomNavigation on web
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  contractHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  contractIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  contractTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  contractSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  contractInfo: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    gap: 20,
  },
  contractDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  emailInputSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  contractDetailText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 32,
    marginTop: 8,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
  },
  signButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  calculatorTypeButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  calculatorTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  calculatorTypeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  changeTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    gap: 8,
  },
  changeTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signingFeatures: {
    gap: 14,
    paddingHorizontal: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  contractSelectionContainer: {
    flex: 1,
    padding: 24,
    marginBottom: Platform.OS === 'ios' ? 85 : 65, // Add margin for BottomNavigation
    ...(Platform.OS === 'web' && {
      marginBottom: 65, // Add margin for BottomNavigation on web
    }),
  },
  contractSelectionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  contractSelectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  contractSelectionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  loadingContractsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingContractsText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  contractsList: {
    paddingBottom: 20,
  },
  contractCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  contractCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  calculatorTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 12,
  },
  contractCardContent: {
    flex: 1,
  },
  contractCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  contractCardType: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contractCardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  contractCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contractDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractSize: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
  },
  contractStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  contractStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  contractDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 48,
    width: '100%',
  },
  statusContainer: {
    flex: 1,
    padding: 24,
    marginBottom: Platform.OS === 'ios' ? 85 : 65,
    ...(Platform.OS === 'web' && {
      marginBottom: 65,
    }),
  },
  statusContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  statusDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  signerInfoCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  signerInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  signerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  signerInfoText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  refreshNote: {
    fontSize: 12,
    textAlign: 'left',
    marginTop: 0,
    marginBottom: 0,
    fontStyle: 'italic',
    paddingHorizontal: 0,
    flex: 1,
    marginLeft: 8,
  },
  verificationContainer: {
    flex: 1,
    padding: 24,
    marginBottom: Platform.OS === 'ios' ? 85 : 65,
    ...(Platform.OS === 'web' && {
      marginBottom: 65,
    }),
  },
  verificationContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  verificationIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verificationTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  verificationDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  previewCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  previewCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  previewCardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  previewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  credentialsCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  credentialsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  credentialsText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 24,
    marginTop: 8,
    gap: 12,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
    width: '100%',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  embeddedFormContainer: {
    width: '100%',
    minHeight: 600,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  embeddedFormWrapper: {
    width: '100%',
    minHeight: 600,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    gap: 8,
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  formLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 200,
  },
  formLoadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  formErrorContainer: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  formErrorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  fallbackButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  fallbackButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  switchViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    alignSelf: 'center',
  },
  switchViewButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  manualVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    gap: 8,
    alignSelf: 'center',
  },
  manualVerifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  verifyFieldsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 10,
    alignSelf: 'center',
  },
  verifyFieldsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  builderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
});

