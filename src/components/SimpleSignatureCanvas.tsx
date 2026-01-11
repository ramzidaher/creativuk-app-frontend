import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface SimpleSignatureCanvasProps {
  onSignatureChange: (signature: string) => void;
  style?: any;
}

export default function SimpleSignatureCanvas({ onSignatureChange, style }: SimpleSignatureCanvasProps) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setIsDrawing(true);
      setCurrentPath(`M${locationX},${locationY}`);
    },
    
    onPanResponderMove: (evt) => {
      if (!isDrawing) return;
      
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
    },
    
    onPanResponderRelease: () => {
      if (isDrawing) {
        const newPaths = [...paths, currentPath];
        setPaths(newPaths);
        
        // Generate signature data
        const svgContent = `
          <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
            ${newPaths.map(path => `<path d="${path}" stroke="black" stroke-width="2" fill="none"/>`).join('')}
          </svg>
        `;
        const signatureData = `data:image/svg+xml;base64,${btoa(svgContent)}`;
        
        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          onSignatureChange(signatureData);
        }, 0);
        
        setCurrentPath('');
        setIsDrawing(false);
      }
    },
  });

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
    onSignatureChange('');
  };

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[styles.signatureArea, { backgroundColor: theme.cardBackground }]}
        {...panResponder.panHandlers}
      >
        <Svg height="200" width="100%">
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke="#000000"
              strokeWidth="2"
              fill="none"
            />
          ))}
          {currentPath && (
            <Path
              d={currentPath}
              stroke="#000000"
              strokeWidth="2"
              fill="none"
            />
          )}
        </Svg>
        
        {paths.length === 0 && !isDrawing && (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderText, { color: theme.secondaryText }]}>
              Sign here with your finger
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controls}>
        <Text style={[styles.clearText, { color: theme.secondaryText }]} onPress={clearSignature}>
          Clear Signature
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  signatureArea: {
    height: 200,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    opacity: 0.6,
  },
  controls: {
    paddingTop: 8,
    alignItems: 'center',
  },
  clearText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
