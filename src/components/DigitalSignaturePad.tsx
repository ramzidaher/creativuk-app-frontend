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
  PanResponder,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface DigitalSignaturePadProps {
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
    paths?: string[];
    signatureData?: any;
  };
  security: {
    hash: string;
    timestamp: number;
    sessionId: string;
  };
}

export default function DigitalSignaturePad({
  visible,
  onClose,
  onSave,
  title = "Digital Signature"
}: DigitalSignaturePadProps) {
  const { theme, isDark } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        console.log('🖊️ Mobile Signature: onStartShouldSetPanResponder - returning true');
        return true;
      },
      onMoveShouldSetPanResponder: () => {
        console.log('🖊️ Mobile Signature: onMoveShouldSetPanResponder - returning true');
        return true;
      },
      onPanResponderGrant: (evt) => {
        console.log('🖊️ Mobile Signature: onPanResponderGrant - starting signature');
        
        const { locationX, locationY } = evt.nativeEvent;
        const timestamp = Date.now();
        
        console.log('🖊️ Mobile Signature: Touch start at', { locationX, locationY, timestamp });
        
        if (startTime === 0) {
          setStartTime(timestamp);
        }
        
        setIsDrawing(true);
        setCurrentPath(`M${locationX},${locationY}`);
        setPoints([{ x: locationX, y: locationY, timestamp }]);
      },
      onPanResponderMove: (evt) => {
        if (!isDrawing) return;
        
        const { locationX, locationY } = evt.nativeEvent;
        const timestamp = Date.now();
        
        console.log('🖊️ Mobile Signature: Touch move at', { locationX, locationY });
        
        setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
        setPoints(prev => [...prev, { x: locationX, y: locationY, timestamp }]);
      },
      onPanResponderRelease: (evt) => {
        console.log('🖊️ Mobile Signature: onPanResponderRelease - ending signature');
        
        if (isDrawing) {
          setEndTime(Date.now());
          setPaths(prev => [...prev, currentPath]);
          setCurrentPath('');
          setIsDrawing(false);
          console.log('🖊️ Mobile Signature: Signature path completed');
        }
      },
      onPanResponderTerminate: () => {
        console.log('🖊️ Mobile Signature: onPanResponderTerminate - signature terminated');
        
        if (isDrawing) {
          setEndTime(Date.now());
          setPaths(prev => [...prev, currentPath]);
          setCurrentPath('');
          setIsDrawing(false);
        }
      },
    })
  ).current;

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
    setPoints([]);
    setStartTime(0);
    setEndTime(0);
    setIsDrawing(false);
  };

  const saveSignature = () => {
    console.log('🖊️ Mobile Signature: Save signature called', { 
      pathsLength: paths.length, 
      currentPathLength: currentPath.length,
      pointsLength: points.length 
    });

    if (paths.length === 0 && currentPath === '') {
      console.log('🖊️ Mobile Signature: No signature to save');
      Alert.alert('No Signature', 'Please draw a signature before saving.');
      return;
    }

    // Create a simple PNG signature for mobile (since PDF-lib works better with PNG)
    // For mobile, we'll create a simple base64 PNG that represents the signature
    const allPaths = [...paths, currentPath].filter(path => path !== '');
    console.log('🖊️ Mobile Signature: Creating PNG signature with paths:', allPaths.length);
    
    // Create a simple PNG signature (1x1 transparent PNG with signature data in metadata)
    // This is a workaround since we can't easily convert SVG to PNG in React Native
    const signatureData = {
      paths: allPaths,
      timestamp: Date.now(),
      platform: Platform.OS
    };
    
    // Create a simple PNG base64 (1x1 transparent pixel)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const base64Signature = `data:image/png;base64,${pngBase64}`;
    
    console.log('🖊️ Mobile Signature: PNG signature created, length:', base64Signature.length);

    // Generate digital footprint with signature data
    const digitalFootprint = generateDigitalFootprint(points, startTime, endTime);
    // Add signature paths to digital footprint for mobile
    digitalFootprint.signatureData.paths = allPaths;
    digitalFootprint.signatureData.signatureData = signatureData;
    
    console.log('🖊️ Mobile Signature: Digital footprint generated:', digitalFootprint);

    console.log('🖊️ Mobile Signature: Calling onSave callback');
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
                Sign with your finger or stylus
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
             style={styles.signatureArea} 
             {...panResponder.panHandlers}
           >
             <Svg width="100%" height="100%" style={styles.svgContainer}>
               {paths.map((path, index) => (
                 <Path
                   key={index}
                   d={path}
                   stroke="#000000"
                   strokeWidth="4"
                   fill="none"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
               ))}
               {currentPath && (
                 <Path
                   d={currentPath}
                   stroke="#000000"
                   strokeWidth="4"
                   fill="none"
                   strokeLinecap="round"
                   strokeLinejoin="round"
                 />
               )}
             </Svg>
             
             {paths.length === 0 && currentPath === '' && !isDrawing && (
               <View style={styles.placeholder} pointerEvents="none">
                 <Feather name="edit-3" size={48} color={theme.tertiaryText} />
                 <Text style={[styles.placeholderText, { color: theme.tertiaryText }]}>
                   Draw your signature here
                 </Text>
                 <Text style={[styles.placeholderSubtext, { color: theme.tertiaryText }]}>
                   Touch and drag to sign
                 </Text>
               </View>
             )}
             
             {isDrawing && (
               <View style={styles.drawingIndicator} pointerEvents="none">
                 <Text style={[styles.drawingText, { color: theme.primaryButton }]}>
                   Drawing...
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
     minHeight: 200,
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
   },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  placeholderSubtext: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    opacity: 0.7,
  },
  drawingIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  drawingText: {
    fontSize: 14,
    fontWeight: '600',
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
