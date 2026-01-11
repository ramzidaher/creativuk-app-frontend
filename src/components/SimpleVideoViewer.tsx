import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SimpleVideoViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  onError?: (error: any) => void;
}

export const SimpleVideoViewer: React.FC<SimpleVideoViewerProps> = ({
  videoUrl,
  title = 'Proposal Video',
  onClose,
  onError,
}) => {
  console.log('🎬 SimpleVideoViewer: Received videoUrl:', videoUrl);
  console.log('🎬 Platform:', Platform.OS);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Calculate responsive video size - make it fill more space
  const getVideoSize = () => {
    // Account for header and bottom controls
    // Header: padding (12) + title height + border
    // Bottom controls: paddingVertical (20) + button paddingVertical (14) + button height + gap
    const headerHeight = 12 + 20 + 1; // padding + title height + border
    const bottomControlsHeight = 20 + 14 + 20 + 20; // container padding + button padding + button height + gap
    const availableHeight = screenHeight - headerHeight - bottomControlsHeight;
    
    const maxWidth = screenWidth * 0.98; // Use more of the screen width
    const maxHeight = availableHeight * 0.95; // Use 95% of available height
    const aspectRatio = 16 / 9;
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  };

  const videoSize = getVideoSize();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // For web, we'll use a simple HTML5 video element
      const video = document.createElement('video');
      video.src = videoUrl;
      video.controls = true;
      video.style.width = `${videoSize.width}px`;
      video.style.height = `${videoSize.height}px`;
      video.style.backgroundColor = '#000';
      video.style.borderRadius = '8px';
      video.style.objectFit = 'cover'; // Fill the container without black bars
      video.style.display = 'block';
      
      video.addEventListener('loadstart', () => {
        console.log('🎬 Video load started');
        setLoading(true);
      });
      
      video.addEventListener('canplay', () => {
        console.log('🎬 Video can play');
        setLoading(false);
        // Set volume to 10% (0.1) to prevent loud sounds
        video.volume = 0.1;
      });
      
      video.addEventListener('error', (e) => {
        console.error('🎬 Video error:', e);
        setLoading(false);
        setError('Failed to load video');
        if (onError) {
          onError(e);
        }
      });
      
      videoRef.current = video;
      
      // Find the video container and append the video
      const container = document.getElementById('video-container');
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }
    }
  }, [videoUrl, videoSize.width, videoSize.height, onError]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Video Container */}
      <View style={styles.videoContainer}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}
        
        {/* Web Video Container */}
        {Platform.OS === 'web' && (
          <div
            id="video-container"
            style={{
              width: videoSize.width,
              height: videoSize.height,
              backgroundColor: '#000',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden', // Hide any overflow
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12, // Reduced padding
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
    color: '#fff',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
