import React, { useState, useRef, useEffect } from 'react';
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
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface WebCompatibleSignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureData: string, digitalFootprint: any) => void;
  title?: string;
}

interface Point {
  x: number;
  y: number;
  timestamp: number;
}

interface DigitalFootprint {
  deviceInfo: {
    platform: string;
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
  };
  signatureData: {
    totalPoints: number;
    duration: number;
    startTime: number;
    endTime: number;
    pressurePoints: number[];
    velocityPoints: number[];
    boundingBox: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
  };
  security: {
    hash: string;
    timestamp: number;
    sessionId: string;
  };
}

export default function WebCompatibleSignaturePad({
  visible,
  onClose,
  onSave,
  title = "Digital Signature"
}: WebCompatibleSignaturePadProps) {
  const { theme, isDark } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  
  const signatureRef = useRef<View>(null);

  // Web-compatible mouse/touch handlers
  const handleStart = (evt: any) => {
    console.log('🖊️ Signature: Mouse/Touch start detected');
    evt.preventDefault();
    evt.stopPropagation();
    
    const rect = signatureRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const clientX = evt.clientX || evt.touches?.[0]?.clientX || 0;
    const clientY = evt.clientY || evt.touches?.[0]?.clientY || 0;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const timestamp = Date.now();
    
    console.log('🖊️ Signature: Starting at', { x, y, timestamp });
    
    if (startTime === 0) {
      setStartTime(timestamp);
    }
    
    setIsDrawing(true);
    setCurrentPath(`M${x},${y}`);
    setCurrentPoints([{ x, y, timestamp }]);
    setPoints([{ x, y, timestamp }]);
  };

  const handleMove = (evt: any) => {
    if (!isDrawing) return;
    
    evt.preventDefault();
    evt.stopPropagation();
    
    const rect = signatureRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const clientX = evt.clientX || evt.touches?.[0]?.clientX || 0;
    const clientY = evt.clientY || evt.touches?.[0]?.clientY || 0;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const timestamp = Date.now();
    
    setCurrentPath(prev => `${prev} L${x},${y}`);
    setCurrentPoints(prev => [...prev, { x, y, timestamp }]);
    setPoints(prev => [...prev, { x, y, timestamp }]);
  };

  const handleEnd = (evt: any) => {
    if (isDrawing) {
      console.log('🖊️ Signature: Mouse/Touch end detected');
      evt.preventDefault();
      evt.stopPropagation();
      
      setEndTime(Date.now());
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath('');
      setIsDrawing(false);
    }
  };

  // Add event listeners for web
  useEffect(() => {
    if (Platform.OS === 'web' && signatureRef.current) {
      const element = signatureRef.current as any;
      console.log('🖊️ Signature: Setting up web event listeners');
      
      // Mouse events
      element.addEventListener('mousedown', handleStart);
      element.addEventListener('mousemove', handleMove);
      element.addEventListener('mouseup', handleEnd);
      element.addEventListener('mouseleave', handleEnd);
      
      // Touch events
      element.addEventListener('touchstart', handleStart, { passive: false });
      element.addEventListener('touchmove', handleMove, { passive: false });
      element.addEventListener('touchend', handleEnd, { passive: false });
      
      return () => {
        console.log('🖊️ Signature: Cleaning up event listeners');
        element.removeEventListener('mousedown', handleStart);
        element.removeEventListener('mousemove', handleMove);
        element.removeEventListener('mouseup', handleEnd);
        element.removeEventListener('mouseleave', handleEnd);
        element.removeEventListener('touchstart', handleStart);
        element.removeEventListener('touchmove', handleMove);
        element.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDrawing, currentPath]);

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
    setPoints([]);
    setCurrentPoints([]);
    setStartTime(0);
    setEndTime(0);
    setIsDrawing(false);
  };

  const saveSignature = () => {
    if (paths.length === 0 && currentPath === '') {
      Alert.alert('No Signature', 'Please draw a signature before saving.');
      return;
    }

    // Create SVG signature
    const allPaths = [...paths, currentPath].filter(path => path !== '');
    const svgSignature = `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="transparent"/>
        ${allPaths.map(path => `<path d="${path}" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      </svg>
    `;

    // Convert SVG to base64
    const base64Signature = `data:image/svg+xml;base64,${base64Encode(svgSignature)}`;

    // Generate digital footprint
    const digitalFootprint = generateDigitalFootprint(points, startTime, endTime);

    onSave(base64Signature, digitalFootprint);
  };

  const generateDigitalFootprint = (signaturePoints: Point[], start: number, end: number): DigitalFootprint => {
    const duration = end - start;
    const totalPoints = signaturePoints.length;
    
    // Calculate pressure points (simulated based on drawing speed)
    const pressurePoints = signaturePoints.map((point, index) => {
      if (index === 0) return 1.0;
      const prevPoint = signaturePoints[index - 1];
      const timeDiff = point.timestamp - prevPoint.timestamp;
      const distance = Math.sqrt(
        Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
      );
      const speed = distance / timeDiff;
      // Higher speed = lower pressure (simulated)
      return Math.max(0.1, Math.min(1.0, 1.0 - (speed / 10)));
    });

    // Calculate velocity points
    const velocityPoints = signaturePoints.map((point, index) => {
      if (index === 0) return 0;
      const prevPoint = signaturePoints[index - 1];
      const timeDiff = point.timestamp - prevPoint.timestamp;
      const distance = Math.sqrt(
        Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
      );
      return distance / timeDiff;
    });

    // Calculate bounding box
    const boundingBox = signaturePoints.reduce((box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }), {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    });

    // Generate hash from signature data
    const signatureData = JSON.stringify({
      points: signaturePoints,
      duration,
      totalPoints,
      pressurePoints,
      velocityPoints,
      boundingBox,
    });
    
    const hash = generateHash(signatureData);

    return {
      deviceInfo: {
        platform: Platform.OS,
        userAgent: Platform.OS === 'web' ? navigator.userAgent : 'React Native',
        screenResolution: `${width}x${height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || 'en-US',
      },
      signatureData: {
        totalPoints,
        duration,
        startTime: start,
        endTime: end,
        pressurePoints,
        velocityPoints,
        boundingBox,
      },
      security: {
        hash,
        timestamp: Date.now(),
        sessionId: generateSessionId(),
      },
    };
  };

  const generateHash = (data: string): string => {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  const generateSessionId = (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const base64Encode = (str: string): string => {
    if (Platform.OS === 'web') {
      return btoa(str);
    } else {
      // For React Native, use a simple base64 implementation
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      while (i < str.length) {
        const a = str.charCodeAt(i++);
        const b = i < str.length ? str.charCodeAt(i++) : 0;
        const c = i < str.length ? str.charCodeAt(i++) : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
      }
      
      return result;
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
          <View 
            ref={signatureRef}
            style={styles.signatureArea}
          >
            <Svg width="100%" height="100%" style={styles.svgContainer}>
              {paths.map((path, index) => (
                <Path
                  key={index}
                  d={path}
                  stroke={theme.primaryText}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath && (
                <Path
                  d={currentPath}
                  stroke={theme.primaryText}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
            
            {paths.length === 0 && currentPath === '' && (
              <View style={styles.placeholder}>
                <Feather name="edit-3" size={48} color={theme.tertiaryText} />
                <Text style={[styles.placeholderText, { color: theme.tertiaryText }]}>
                  {Platform.OS === 'web' ? 'Click and drag to draw your signature' : 'Draw your signature here'}
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
    position: 'relative',
    cursor: Platform.OS === 'web' ? 'crosshair' : 'default',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
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
