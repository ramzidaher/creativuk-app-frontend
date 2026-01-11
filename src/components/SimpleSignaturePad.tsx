import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

interface SimpleSignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureData: string, digitalFootprint: any) => void;
  title?: string;
}

export default function SimpleSignaturePad({
  visible,
  onClose,
  onSave,
  title = "Digital Signature"
}: SimpleSignaturePadProps) {
  const { theme, isDark } = useTheme();
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clearSignature = () => {
    setSignature('');
    setStartTime(0);
    setEndTime(0);
    setIsDrawing(false);
    
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveSignature = () => {
    if (!signature && Platform.OS === 'web' && canvasRef.current) {
      // Get signature from canvas
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL('image/png');
      setSignature(dataURL);
    }

    if (!signature) {
      Alert.alert('No Signature', 'Please draw a signature before saving.');
      return;
    }

    // Generate digital footprint
    const digitalFootprint = {
      deviceInfo: {
        platform: Platform.OS,
        userAgent: Platform.OS === 'web' ? navigator.userAgent : 'React Native',
        screenResolution: `${width}x${height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || 'en-US',
      },
      signatureData: {
        totalPoints: 1,
        duration: endTime - startTime,
        startTime: startTime,
        endTime: endTime,
        pressurePoints: [1.0],
        velocityPoints: [0],
        boundingBox: {
          minX: 0,
          minY: 0,
          maxX: 400,
          maxY: 200,
        },
      },
      security: {
        hash: 'simple-hash-' + Date.now(),
        timestamp: Date.now(),
        sessionId: 'session-' + Math.random().toString(36).substring(2),
      },
    };

    onSave(signature, digitalFootprint);
  };

  // Web canvas drawing functions
  const startDrawing = (e: any) => {
    console.log('🖊️ Simple Signature: Start drawing');
    setIsDrawing(true);
    setStartTime(Date.now());
    
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    console.log('🖊️ Simple Signature: Stop drawing');
    setIsDrawing(false);
    setEndTime(Date.now());
    
    if (Platform.OS === 'web' && canvasRef.current) {
      const canvas = canvasRef.current;
      const dataURL = canvas.toDataURL('image/png');
      setSignature(dataURL);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={onClose}
            >
              <Feather name="x" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
            
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>{title}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {Platform.OS === 'web' ? 'Click and drag to sign' : 'Sign with your finger or stylus'}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={clearSignature}
            >
              <Feather name="trash-2" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Signature Area */}
        <View style={[styles.signatureContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.signatureArea}>
            {Platform.OS === 'web' ? (
              <canvas
                ref={canvasRef}
                width={400}
                height={200}
                style={styles.canvas}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  startDrawing(mouseEvent);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  draw(mouseEvent);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDrawing();
                }}
              />
            ) : (
              <View style={styles.mobilePlaceholder}>
                <Feather name="edit-3" size={48} color={theme.tertiaryText} />
                <Text style={[styles.placeholderText, { color: theme.tertiaryText }]}>
                  Mobile signature not implemented yet
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: theme.secondaryButton }]}
            onPress={clearSignature}
          >
            <Feather name="refresh-cw" size={20} color="white" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primaryButton }]}
            onPress={saveSignature}
          >
            <Feather name="check" size={20} color="white" />
            <Text style={styles.saveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  signatureContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  signatureArea: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    border: '1px solid #ccc',
    borderRadius: 8,
    cursor: 'crosshair',
  },
  mobilePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 16,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});