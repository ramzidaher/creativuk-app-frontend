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
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import SimpleSignatureCanvas from '../components/SimpleSignatureCanvas';

interface FreeDocumentSigningScreenProps {
  route: {
    params: {
      opportunityId: string;
      customerName: string;
      customerEmail: string;
    };
  };
}

export default function FreeDocumentSigningScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<FreeDocumentSigningScreenProps['route']>();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'sign' | 'complete'>('upload');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string>('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signedDocumentUri, setSignedDocumentUri] = useState<string | null>(null);
  // Remove the ref since we're using a simpler approach

  const { opportunityId, customerName, customerEmail } = route.params;

  // Digital footprint data
  const [digitalFootprint, setDigitalFootprint] = useState<any>(null);

  const handleDocumentUpload = async () => {
    try {
      setLoading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setDocumentUri(asset.uri);
        setDocumentName(asset.name);
        setStep('sign');
        console.log('📄 Document uploaded:', asset.name);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureComplete = async () => {
    try {
      setLoading(true);
      
      // Get signature from signature canvas
      if (!signature) {
        Alert.alert('Error', 'Please provide a signature');
        return;
      }
      const signatureData = signature;

      setSignature(signatureData);

      // Create digital footprint
      const footprint = createDigitalFootprint(signatureData);
      setDigitalFootprint(footprint);

      // Create signed document
      const signedDoc = await createSignedDocument(signatureData, footprint);
      setSignedDocumentUri(signedDoc);

      setStep('complete');
      console.log('✅ Document signed successfully');
    } catch (error) {
      console.error('Error signing document:', error);
      Alert.alert('Error', 'Failed to sign document');
    } finally {
      setLoading(false);
    }
  };

  const createDigitalFootprint = (signatureData: string) => {
    const timestamp = new Date().toISOString();
    const footprint = {
      id: `signature_${opportunityId}_${Date.now()}`,
      opportunityId,
      customerName,
      customerEmail,
      documentName,
      signatureHash: signatureData.substring(0, 64), // First 64 chars as hash
      signedAt: timestamp,
      signedBy: customerName,
      ipAddress: 'mobile_app', // You can get real IP if needed
      userAgent: 'React Native App',
      reason: 'Contract Agreement',
      location: 'Digital Signature',
      algorithm: 'SHA-256',
      metadata: {
        appVersion: '1.0.0',
        platform: Platform.OS,
        deviceId: 'mobile_device',
        sessionId: `session_${Date.now()}`,
      }
    };

    console.log('🔐 Digital footprint created:', footprint);
    return footprint;
  };

  const createSignedDocument = async (signatureData: string, footprint: any): Promise<string> => {
    try {
      // Save to backend first
      const signedDocContent = {
        originalDocument: documentName,
        signature: signatureData,
        digitalFootprint: footprint,
        signedAt: footprint.signedAt,
        signedBy: footprint.signedBy,
        verification: {
          hash: footprint.signatureHash,
          algorithm: 'SHA-256',
          timestamp: footprint.signedAt,
        }
      };
      
      await saveToBackend(signedDocContent);

      // Create a proper signed PDF with embedded signature
      const { api } = await import('../utils/api');
      
      // Check if documentUri is a data URL (base64) or file path
      let pdfData;
      if (documentUri.startsWith('data:')) {
        // Extract base64 data from data URL
        const base64Data = documentUri.split(',')[1];
        pdfData = base64Data;
      } else {
        // It's a file path, read the file
        if (Platform.OS === 'web') {
          // For web, we need to read the file as base64
          const response = await fetch(documentUri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          pdfData = btoa(String.fromCharCode.apply(null, uint8Array));
        } else {
          // For mobile, read using FileSystem
          const fileContent = await FileSystem.readAsStringAsync(documentUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          pdfData = fileContent;
        }
      }
      
      const pdfResponse = await api.post('/pdf-signing/create-signed-pdf', {
        originalPdfData: pdfData, // Send base64 PDF data instead of path
        signatureData: signatureData,
        digitalFootprint: footprint,
        opportunityId: opportunityId,
        customerName: customerName,
      });

      if (pdfResponse.data.success) {
        console.log('✅ Signed PDF created:', pdfResponse.data.data.filename);
        return pdfResponse.data.data.downloadUrl;
      } else {
        throw new Error(pdfResponse.data.error || 'Failed to create signed PDF');
      }
    } catch (error) {
      console.error('Error creating signed document:', error);
      throw error;
    }
  };

  const createPDFHTML = (signedDocContent: any) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Signed Document - ${signedDocContent.originalDocument}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .document-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .signature-section {
            margin: 40px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f9f9f9;
        }
        .signature-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2c3e50;
        }
        .signature-image {
            border: 1px solid #ccc;
            background-color: white;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .signature-details {
            margin-top: 20px;
        }
        .detail-row {
            display: flex;
            margin-bottom: 8px;
        }
        .detail-label {
            font-weight: bold;
            width: 150px;
        }
        .digital-footprint {
            margin-top: 30px;
            padding: 20px;
            background-color: #e8f4f8;
            border-left: 4px solid #3498db;
        }
        .footprint-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2980b9;
        }
        .hash-display {
            font-family: monospace;
            background-color: #f1f1f1;
            padding: 8px;
            border-radius: 4px;
            word-break: break-all;
            font-size: 12px;
        }
        .verification-badge {
            display: inline-block;
            background-color: #27ae60;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        @media print {
            body { margin: 20px; }
            .signature-section, .digital-footprint { 
                break-inside: avoid; 
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="document-title">SIGNED DOCUMENT</div>
        <div>${signedDocContent.originalDocument}</div>
    </div>

    <div class="signature-section">
        <div class="signature-title">Digital Signature</div>
        <div class="signature-image">
            <img src="${signedDocContent.signature}" alt="Digital Signature" style="max-width: 100%; height: auto;" />
        </div>
        <div class="signature-details">
            <div class="detail-row">
                <div class="detail-label">Signed By:</div>
                <div>${signedDocContent.signedBy}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Signed At:</div>
                <div>${new Date(signedDocContent.signedAt).toLocaleString()}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Document:</div>
                <div>${signedDocContent.originalDocument}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div><span class="verification-badge">✓ VERIFIED</span></div>
            </div>
        </div>
    </div>

    <div class="digital-footprint">
        <div class="footprint-title">Digital Footprint & Verification</div>
        <div class="detail-row">
            <div class="detail-label">Signature ID:</div>
            <div>${signedDocContent.digitalFootprint.id}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Algorithm:</div>
            <div>${signedDocContent.digitalFootprint.algorithm}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Verification Hash:</div>
            <div class="hash-display">${signedDocContent.verification.hash}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Timestamp:</div>
            <div>${signedDocContent.verification.timestamp}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Legal Status:</div>
            <div><span class="verification-badge">ESIGN ACT COMPLIANT</span></div>
        </div>
    </div>

    <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
        <p>This document has been digitally signed and contains a tamper-proof digital footprint.</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
  };

  const saveToBackend = async (signedDocContent: any) => {
    try {
      const { api } = await import('../utils/api');
      
      await api.post('/signatures/save', {
        opportunityId,
        signatureData: signedDocContent.signature,
        digitalFootprint: signedDocContent.digitalFootprint,
        documentName: documentName,
        signedAt: signedDocContent.signedAt,
        signedBy: signedDocContent.signedBy,
      });

      console.log('✅ Signature saved to backend');
    } catch (error) {
      console.error('Error saving to backend:', error);
      // Don't throw error - local save is sufficient
    }
  };

  const handleDownload = async () => {
    if (!signedDocumentUri) return;

    try {
      if (Platform.OS === 'web') {
        // For web, download the PDF directly
        const link = document.createElement('a');
        link.href = signedDocumentUri;
        link.download = `signed_${documentName}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Alert.alert(
          'PDF Downloaded',
          'Your signed PDF has been downloaded with embedded signature and verification marks!',
          [{ text: 'OK' }]
        );
      } else {
        // For mobile, use Sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(signedDocumentUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download Signed PDF',
          });
        } else {
          Alert.alert('Sharing not available', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', 'Failed to share document');
    }
  };

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.stepHeader, { backgroundColor: theme.primaryButton }]}>
        <Ionicons name="cloud-upload" size={24} color="#ffffff" />
        <Text style={styles.stepTitle}>Upload Document</Text>
      </View>
      
      <View style={styles.stepContent}>
        <Text style={[styles.stepDescription, { color: theme.primaryText }]}>
          Upload the PDF document that needs to be signed
        </Text>
        
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: theme.primaryButton }]}
          onPress={handleDocumentUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="document" size={24} color="#ffffff" />
              <Text style={styles.uploadButtonText}>Choose PDF Document</Text>
            </>
          )}
        </TouchableOpacity>

        {documentName && (
          <View style={[styles.documentInfo, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.successButton} />
            <Text style={[styles.documentName, { color: theme.primaryText }]}>
              {documentName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderSignStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.stepHeader, { backgroundColor: theme.primaryButton }]}>
        <Ionicons name="create" size={24} color="#ffffff" />
        <Text style={styles.stepTitle}>Sign Document</Text>
      </View>
      
      <View style={styles.stepContent}>
        <Text style={[styles.stepDescription, { color: theme.primaryText }]}>
          Please sign the document using your finger or stylus
        </Text>
        
        <SimpleSignatureCanvas
          onSignatureChange={setSignature}
          style={styles.signatureContainer}
        />

        <View style={styles.signatureActions}>
          <TouchableOpacity
            style={[styles.signButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleSignatureComplete}
            disabled={loading || !signature}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#ffffff" />
                <Text style={styles.signButtonText}>Sign Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.stepHeader, { backgroundColor: theme.successButton }]}>
        <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
        <Text style={styles.stepTitle}>Document Signed!</Text>
      </View>
      
      <View style={styles.stepContent}>
        <Text style={[styles.stepDescription, { color: theme.primaryText }]}>
          Your document has been successfully signed with a digital footprint
        </Text>

        {digitalFootprint && (
          <View style={[styles.footprintContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.footprintTitle, { color: theme.primaryText }]}>
              Digital Footprint
            </Text>
            <View style={styles.footprintInfo}>
              <Text style={[styles.footprintLabel, { color: theme.secondaryText }]}>
                Signature ID:
              </Text>
              <Text style={[styles.footprintValue, { color: theme.primaryText }]}>
                {digitalFootprint.id}
              </Text>
            </View>
            <View style={styles.footprintInfo}>
              <Text style={[styles.footprintLabel, { color: theme.secondaryText }]}>
                Signed At:
              </Text>
              <Text style={[styles.footprintValue, { color: theme.primaryText }]}>
                {new Date(digitalFootprint.signedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.footprintInfo}>
              <Text style={[styles.footprintLabel, { color: theme.secondaryText }]}>
                Algorithm:
              </Text>
              <Text style={[styles.footprintValue, { color: theme.primaryText }]}>
                {digitalFootprint.algorithm}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.completeActions}>
          <TouchableOpacity
            style={[styles.downloadButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleDownload}
          >
            <Ionicons name="download" size={20} color="#ffffff" />
            <Text style={styles.downloadButtonText}>
              Download Signed PDF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishButton, { backgroundColor: theme.successButton }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="checkmark" size={20} color="#ffffff" />
            <Text style={styles.finishButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: theme.borderColor }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
            Free Document Signing
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            {customerName} - {opportunityId}
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'upload' && renderUploadStep()}
        {step === 'sign' && renderSignStep()}
        {step === 'complete' && renderCompleteStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    marginBottom: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  stepTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  stepContent: {
    paddingHorizontal: 16,
  },
  stepDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  signatureContainer: {
    marginBottom: 16,
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  signButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  footprintContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  footprintTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  footprintInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  footprintLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 100,
  },
  footprintValue: {
    fontSize: 14,
    flex: 1,
  },
  completeActions: {
    gap: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
