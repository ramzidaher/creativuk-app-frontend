import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
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

interface FullScreenVideoViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  onError?: (error: any) => void;
}

export const FullScreenVideoViewer: React.FC<FullScreenVideoViewerProps> = ({
  videoUrl,
  title = 'Proposal Video',
  onClose,
  onError,
}) => {
  console.log('🎬 FullScreenVideoViewer: Received videoUrl:', videoUrl);
  console.log('🎬 Platform:', Platform.OS);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<Video | null>(null);

  // Calculate full screen video size - maximize space usage
  const getVideoSize = () => {
    // For scrollable layout, use a more reasonable height that works well in scroll view
    const maxWidth = screenWidth;
    const maxHeight = screenHeight * 0.7; // Use 70% of screen height for better scroll experience
    
    return { width: maxWidth, height: maxHeight };
  };

  const videoSize = getVideoSize();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // For web, we'll use a simple HTML5 video element
      const video = document.createElement('video');
      video.src = videoUrl;
      video.controls = true;
      video.autoplay = true;
      video.style.width = `${videoSize.width}px`;
      video.style.height = `${videoSize.height}px`;
      video.style.backgroundColor = '#000';
      video.style.objectFit = 'contain'; // Maintain aspect ratio but fill container
      video.style.display = 'block';
      video.style.margin = '0 auto';
      
      video.addEventListener('loadstart', () => {
        console.log('🎬 Video load started');
        setLoading(false); // Stop loading as soon as video starts loading
        setHasInitiallyLoaded(true);
      });
      
      video.addEventListener('canplay', () => {
        console.log('🎬 Video can play');
        setLoading(false);
        // Allow user to control volume - don't override their settings
      });
      
      video.addEventListener('error', (e) => {
        console.error('🎬 Video error:', e);
        setLoading(false);
        setError('Failed to load video');
        if (onError) {
          onError(e);
        }
      });
      
      webVideoRef.current = video;
      
      // Find the video container and append the video
      const container = document.getElementById('fullscreen-video-container');
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }
    } else {
      // For mobile, set loading to false after a short delay to allow react-native-video to load
      console.log('🎬 Mobile video loading, setting up react-native-video');
      setLoading(true);
      
      // Set a timeout to stop loading state if video doesn't load
      const timeout = setTimeout(() => {
        console.log('🎬 Mobile video load timeout, stopping loading state');
        setLoading(false);
      }, 5000); // 5 second timeout
      
      return () => clearTimeout(timeout);
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
      {/* Full Screen Video Container */}
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
            id="fullscreen-video-container"
            style={{
              width: videoSize.width,
              height: videoSize.height,
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )}

        {/* Mobile Video Player */}
        {Platform.OS !== 'web' && (
          <Video
            ref={mobileVideoRef}
            source={{ uri: videoUrl }}
            style={{
              width: videoSize.width,
              height: videoSize.height,
              backgroundColor: '#000',
            }}
            useNativeControls={true}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            onLoad={(status) => {
              console.log('🎬 Mobile video loaded successfully:', status);
              setLoading(false);
              setHasInitiallyLoaded(true);
              // Allow user to control volume - don't override their settings
            }}
            onLoadStart={() => {
              console.log('🎬 Mobile video load started');
              setLoading(false); // Stop loading as soon as video starts loading
              setHasInitiallyLoaded(true);
            }}
            onError={(error) => {
              console.error('🎬 Mobile video error:', error);
              setLoading(false);
              setError('Failed to load video');
              if (onError) {
                onError(error);
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                if (status.isBuffering && !hasInitiallyLoaded) {
                  console.log('🎬 Mobile video buffering (initial load)');
                  setLoading(true);
                } else if (!status.isBuffering && hasInitiallyLoaded) {
                  setLoading(false);
                }
                // Don't show loading during buffering after initial load
              }
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
    padding: 8, // Minimal padding
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    height: 50, // Fixed height
  },
  title: {
    fontSize: 16, // Smaller font
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
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
