import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Import react-player for web compatibility
let ReactPlayer: any = null;
if (Platform.OS === 'web') {
  try {
    ReactPlayer = require('react-player').default;
  } catch (error) {
    console.warn('ReactPlayer not available for web:', error);
  }
}

// Import react-native-video for mobile
let Video: any = null;
if (Platform.OS !== 'web') {
  try {
    Video = require('react-native-video').default;
  } catch (error) {
    console.warn('react-native-video not available for mobile:', error);
  }
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface UniversalVideoViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  onError?: (error: any) => void;
}

export const UniversalVideoViewer: React.FC<UniversalVideoViewerProps> = ({
  videoUrl,
  title = 'Proposal Video',
  onClose,
  onError,
}) => {
  console.log('🎬 UniversalVideoViewer: Received videoUrl:', videoUrl);
  console.log('🎬 Platform:', Platform.OS);
  
  const theme = useTheme();
  const isDark = theme?.isDark || false;
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<any>(null);

  // Auto-hide controls after 4 seconds
  const handleUserInteraction = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  // Calculate responsive video size
  const getVideoSize = () => {
    const maxWidth = screenWidth * 0.95;
    const maxHeight = screenHeight * 0.6;
    const aspectRatio = 16 / 9; // Standard video aspect ratio
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  };

  const videoSize = getVideoSize();

  // Handle video load
  const handleLoad = (data: any) => {
    setLoading(false);
    console.log('🎬 Video loaded with data:', data);
    
    if (data.duration) {
      setDuration(data.duration);
      console.log('🎬 Video duration set to:', data.duration, 'seconds');
    }
  };

  // Handle video progress
  const handleProgress = (data: any) => {
    if (!isSeeking) {
      setCurrentTime(data.currentTime || data.playedSeconds || 0);
    }
    
    // Update duration if not set
    if (data.duration && duration === 0) {
      setDuration(data.duration);
    }
  };

  // Handle video error
  const handleError = (error: any) => {
    console.error('🎬 Video error:', error);
    setLoading(false);
    setError('Failed to load video');
    if (onError) {
      onError(error);
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    setPaused(!paused);
    handleUserInteraction();
  };

  // Handle seek
  const handleSeek = (time: number) => {
    if (duration > 0) {
      const validTime = Math.max(0, Math.min(time, duration));
      console.log('🎬 Seeking to:', validTime, 'Duration:', duration);
      setCurrentTime(validTime);
      setIsSeeking(false);
      
      // For react-native-video, we need to use the ref
      if (Platform.OS !== 'web' && videoRef.current) {
        videoRef.current.seek(validTime);
      }
    }
  };

  // Skip forward/backward
  const skipTime = (seconds: number) => {
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    setCurrentTime(newTime);
    handleUserInteraction();
    
    if (Platform.OS !== 'web' && videoRef.current) {
      videoRef.current.seek(newTime);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    handleUserInteraction();
  };

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle progress bar press
  const handleProgressPress = (event: any) => {
    if (duration > 0) {
      const { locationX } = event.nativeEvent;
      const progress = locationX / videoSize.width;
      const newTime = progress * duration;
      handleSeek(newTime);
    }
  };

  useEffect(() => {
    handleUserInteraction();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme?.colors?.background || '#000' }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme?.colors?.error || '#ff4444'} />
          <Text style={[styles.errorText, { color: theme?.colors?.text || '#fff' }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme?.colors?.primary || '#007AFF' }]}
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
    <View style={[styles.container, { backgroundColor: theme?.colors?.background || '#000' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme?.colors?.surface || '#1a1a1a' }]}>
        <Text style={[styles.title, { color: theme?.colors?.text || '#fff' }]}>{title}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme?.colors?.text || '#fff'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Video Container */}
      <View style={styles.videoContainer}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme?.colors?.primary || '#007AFF'} />
            <Text style={[styles.loadingText, { color: theme?.colors?.text || '#fff' }]}>
              Loading video...
            </Text>
          </View>
        )}

        {/* Web Video Player */}
        {Platform.OS === 'web' && ReactPlayer && (
          <ReactPlayer
            ref={videoRef}
            url={videoUrl}
            width={videoSize.width}
            height={videoSize.height}
            playing={!paused}
            onReady={handleLoad}
            onProgress={handleProgress}
            onError={handleError}
            onDuration={setDuration}
            controls={false}
            volume={0.1}
            style={styles.webVideo}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  disablePictureInPicture: true,
                },
              },
            }}
          />
        )}

        {/* Mobile Video Player */}
        {Platform.OS !== 'web' && Video && (
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={[styles.mobileVideo, { width: videoSize.width, height: videoSize.height }]}
            paused={paused}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onError={handleError}
            onLoadStart={() => setLoading(true)}
            resizeMode="contain"
            controls={false}
            progressUpdateInterval={1000}
            volume={0.1}
          />
        )}

        {/* Custom Controls Overlay */}
        <TouchableOpacity
          style={styles.videoOverlay}
          onPress={handleUserInteraction}
          activeOpacity={1}
        >
          {showControls && (
            <View style={styles.controlsOverlay}>
              {/* Top Controls */}
              <View style={styles.topControls}>
                <TouchableOpacity onPress={toggleFullscreen} style={styles.controlButton}>
                  <Ionicons 
                    name={isFullscreen ? "contract" : "expand"} 
                    size={24} 
                    color="white" 
                  />
                </TouchableOpacity>
              </View>

              {/* Center Play Button */}
              <View style={styles.centerControls}>
                <TouchableOpacity onPress={() => skipTime(-10)} style={styles.skipButton}>
                  <Ionicons name="play-back" size={32} color="white" />
                  <Text style={styles.skipText}>10s</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
                  <Ionicons 
                    name={paused ? "play" : "pause"} 
                    size={48} 
                    color="white" 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => skipTime(10)} style={styles.skipButton}>
                  <Ionicons name="play-forward" size={32} color="white" />
                  <Text style={styles.skipText}>10s</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom Controls */}
              <View style={styles.bottomControls}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                
                <TouchableOpacity 
                  style={styles.progressBar}
                  onPress={handleProgressPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.progressTrack}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                      ]} 
                    />
                  </View>
                </TouchableOpacity>
                
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
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
  },
  webVideo: {
    backgroundColor: '#000',
  },
  mobileVideo: {
    backgroundColor: '#000',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 24,
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playButton: {
    padding: 16,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    marginHorizontal: 20,
  },
  skipButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  skipText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    marginHorizontal: 16,
    height: 40,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff4444',
    borderRadius: 2,
  },
  timeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
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
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
