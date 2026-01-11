import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    PanResponder,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Standard 1920x1080 aspect ratio
const VIDEO_ASPECT_RATIO = 1920 / 1080; // 16:9

interface VideoViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  onError?: (error: any) => void;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
  videoUrl,
  title = 'Proposal Video',
  onClose,
  onError,
}) => {
  console.log('🎬 VideoViewer: Received videoUrl:', videoUrl);
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true); // Force controls to be visible initially
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number} | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{width: number, height: number}>({width: screenWidth, height: screenHeight});
  const [isFullscreen, setIsFullscreen] = useState(true); // Start in fullscreen mode
  const [lastTap, setLastTap] = useState(0);
  const [showSeekIndicator, setSeekIndicator] = useState(false);
  const [seekDirection, setSeekDirection] = useState<'forward' | 'backward' | null>(null);
  const [userInteracting, setUserInteracting] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
  const videoRef = useRef<any>(null);

  // Calculate responsive video dimensions for all screen sizes
  const getVideoDimensions = () => {
    const screenWidth = containerDimensions.width;
    const screenHeight = containerDimensions.height;
    
    // Determine if this is a large screen (tablet/desktop)
    const isLargeScreen = screenWidth > 768;
    const isVeryLargeScreen = screenWidth > 1200;
    
    if (isFullscreen) {
      // In fullscreen mode, use the entire screen
      return {
        width: screenWidth,
        height: screenHeight
      };
    } else {
      // In windowed mode, calculate based on screen size
      const headerHeight = isLargeScreen ? 100 : 80;
      const controlsHeight = isLargeScreen ? 140 : 120;
      const availableHeight = screenHeight - headerHeight - controlsHeight;
      const availableWidth = screenWidth;
      
      // For large screens, use a maximum width to prevent video from being too wide
      const maxVideoWidth = isVeryLargeScreen ? 1200 : (isLargeScreen ? 900 : availableWidth);
      const effectiveWidth = Math.min(availableWidth, maxVideoWidth);
      
      // Calculate video dimensions maintaining 16:9 aspect ratio
      let videoWidth = effectiveWidth;
      let videoHeight = videoWidth / VIDEO_ASPECT_RATIO;
      
      // If video height exceeds available height, scale down by height
      if (videoHeight > availableHeight) {
        videoHeight = availableHeight;
        videoWidth = videoHeight * VIDEO_ASPECT_RATIO;
      }
      
      return { 
        width: videoWidth,
        height: videoHeight
      };
    }
  };

  const videoSize = getVideoDimensions();
  
  // Get responsive styles based on screen size
  const getResponsiveStyles = () => {
    const isLargeScreen = containerDimensions.width > 768;
    const isVeryLargeScreen = containerDimensions.width > 1200;
    
    return {
      centerPlayButtonSize: isVeryLargeScreen ? 140 : (isLargeScreen ? 130 : 120),
      centerPlayIconSize: isVeryLargeScreen ? 70 : (isLargeScreen ? 65 : 60),
      playButtonSize: isVeryLargeScreen ? 110 : (isLargeScreen ? 105 : 100),
      skipButtonSize: isVeryLargeScreen ? 110 : (isLargeScreen ? 105 : 100),
      controlGap: isVeryLargeScreen ? 50 : (isLargeScreen ? 45 : 40),
      progressBarHeight: isVeryLargeScreen ? 14 : (isLargeScreen ? 13 : 12),
      progressThumbSize: isVeryLargeScreen ? 32 : (isLargeScreen ? 30 : 28),
    };
  };
  
  const responsiveStyles = getResponsiveStyles();
  
  // Debug logging
  console.log('🎬 Screen dimensions:', containerDimensions);
  console.log('🎬 Is fullscreen:', isFullscreen);
  console.log('🎬 Calculated video size:', videoSize);
  console.log('🎬 Video aspect ratio maintained:', (videoSize.width / videoSize.height).toFixed(3));
  console.log('🎬 Responsive styles:', responsiveStyles);

  // Handle screen orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setContainerDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  // Smart auto-hide functionality based on user interaction
  const startAutoHideTimer = () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    
    const timer = setTimeout(() => {
      if (!userInteracting && !isDragging && !isSeeking) {
        setShowControls(false);
        setControlsVisible(false);
        setUserInteracting(false);
      }
    }, 4000); // 4 seconds like YouTube/Netflix
    
    setAutoHideTimer(timer);
  };

  const handleUserInteraction = () => {
    setUserInteracting(true);
    setShowControls(true);
    setControlsVisible(true);
    startAutoHideTimer();
  };

  // Ensure controls are visible initially and start auto-hide timer
  useEffect(() => {
    if (!loading) {
      setShowControls(true);
      setControlsVisible(true);
      startAutoHideTimer();
    }
    
    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [loading, userInteracting, isDragging, isSeeking]);

  const handleLoad = (data: any) => {
    setLoading(false);
    console.log('🎬 Video loaded with data:', data);
    
    if (data.duration && data.duration > 0) {
      setDuration(data.duration);
      console.log('🎬 Video duration set to:', data.duration, 'seconds');
    } else {
      console.warn('🎬 No valid duration found in video data');
    }
    
    if (data.naturalSize) {
      setVideoDimensions({
        width: data.naturalSize.width,
        height: data.naturalSize.height
      });
      console.log('🎬 Video dimensions:', data.naturalSize);
      console.log('🎬 Screen dimensions:', { width: screenWidth, height: screenHeight });
      console.log('🎬 Video aspect ratio:', data.naturalSize.width / data.naturalSize.height);
      console.log('🎬 Screen aspect ratio:', screenWidth / screenHeight);
      console.log('🎬 Calculated video size:', videoSize);
    }
  };

  const handleProgress = (data: any) => {
    if (data.currentTime) {
      setCurrentTime(data.currentTime);
    }
    
    // Update duration if it wasn't set during load
    if (data.seekableDuration && data.seekableDuration > 0 && duration === 0) {
      setDuration(data.seekableDuration);
      console.log('🎬 Duration updated during progress:', data.seekableDuration, 'seconds');
    }
  };

  const handleError = (error: any) => {
    setLoading(false);
    console.error('🎬 Video playback error:', error);
    console.error('🎬 Video URL that failed:', videoUrl);
    setError(`Failed to load video: ${error.error?.errorString || error.message || 'Unknown error'}`);
    if (onError) {
      onError(error);
    }
  };

  const togglePlayPause = () => {
    setPaused(!paused);
    handleUserInteraction(); // Reset auto-hide timer
  };

  const handleSeek = (time: number) => {
    if (duration > 0) {
      // Ensure time is within valid bounds
      const validTime = Math.max(0, Math.min(time, duration));
      console.log('🎬 Seeking to:', validTime, 'Duration:', duration);
      setCurrentTime(validTime);
      setIsSeeking(false);
    }
  };

  const handleSkipForward = () => {
    if (duration > 0) {
      const newTime = Math.min(currentTime + 10, duration);
      console.log('🎬 Skip forward to:', newTime);
      handleSeek(newTime);
      handleUserInteraction(); // Reset auto-hide timer
    }
  };

  const handleSkipBackward = () => {
    if (duration > 0) {
      const newTime = Math.max(currentTime - 10, 0);
      console.log('🎬 Skip backward to:', newTime);
      handleSeek(newTime);
      handleUserInteraction(); // Reset auto-hide timer
    }
  };

  const handleProgressBarPress = (event: any) => {
    if (duration > 0) {
      const { locationX } = event.nativeEvent;
      const progressBarWidth = containerDimensions.width - 40; // Account for padding
      const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
      const newTime = progress * duration;
      console.log('🎬 Progress bar press - seeking to:', newTime);
      handleSeek(newTime);
      handleUserInteraction(); // Reset auto-hide timer
    }
  };

  const handleProgressBarDrag = (event: any) => {
    const { locationX } = event.nativeEvent;
    const progressBarWidth = containerDimensions.width - 40; // Account for padding
    const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
    const newTime = progress * duration;
    setSeekTime(newTime);
    setIsSeeking(true);
    handleUserInteraction(); // Reset auto-hide timer
  };

  const handleProgressBarRelease = () => {
    if (isSeeking) {
      handleSeek(seekTime);
      setIsSeeking(false);
      handleUserInteraction(); // Reset auto-hide timer
    }
  };

  // PanResponder for drag functionality
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      if (duration > 0) {
        setIsDragging(true);
        const { locationX } = evt.nativeEvent;
        const progressBarWidth = containerDimensions.width - 40; // Account for padding
        const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
        const newTime = progress * duration;
        setSeekTime(newTime);
        setIsSeeking(true);
        handleUserInteraction(); // Reset auto-hide timer
      }
    },
    onPanResponderMove: (evt) => {
      if (isDragging && duration > 0) {
        const { locationX } = evt.nativeEvent;
        const progressBarWidth = containerDimensions.width - 40; // Account for padding
        const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
        const newTime = progress * duration;
        setSeekTime(newTime);
        handleUserInteraction(); // Reset auto-hide timer
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (isSeeking && duration > 0) {
        handleSeek(seekTime);
        setIsSeeking(false);
        handleUserInteraction(); // Reset auto-hide timer
      }
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
      if (isSeeking && duration > 0) {
        handleSeek(seekTime);
        setIsSeeking(false);
        handleUserInteraction(); // Reset auto-hide timer
      }
    },
  });

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    handleUserInteraction(); // Show controls and reset auto-hide timer
  };

  const handleVideoPress = (event: any) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const { locationX } = event.nativeEvent;
      const screenWidth = containerDimensions.width;
      const isLeftSide = locationX < screenWidth / 2;
      
      if (isLeftSide) {
        // Double tap left side - seek backward 10 seconds
        handleSkipBackward();
        setSeekDirection('backward');
      } else {
        // Double tap right side - seek forward 10 seconds
        handleSkipForward();
        setSeekDirection('forward');
      }
      
      // Show seek indicator
      setSeekIndicator(true);
      setTimeout(() => {
        setSeekIndicator(false);
        setSeekDirection(null);
      }, 1000);
      
      // Handle user interaction for auto-hide
      handleUserInteraction();
      return;
    }
    
    setLastTap(now);
    
    // Single tap - toggle controls and handle interaction
    if (showControls) {
      setShowControls(false);
      setControlsVisible(false);
      setUserInteracting(false);
    } else {
      handleUserInteraction();
    }
  };


  const getVideoStyle = () => {
    return {
      ...styles.modernVideo,
      width: videoSize.width,
      height: videoSize.height,
    };
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.dangerButton} />
          <Text style={[styles.errorText, { color: theme.primaryText }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primaryButton }]}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
          >
            <Text style={[styles.retryButtonText, { color: theme.primaryBackground }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Status Bar for fullscreen */}
      {isFullscreen && (
        <StatusBar 
          hidden={!showControls} 
          backgroundColor="transparent" 
          translucent 
        />
      )}

      {/* Modern Header - Only show in windowed mode */}
      {!isFullscreen && (
        <View style={styles.modernHeader}>
          <TouchableOpacity onPress={onClose} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerFullscreenButton}
            onPress={toggleFullscreen}
          >
            <Ionicons name="expand" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Modern Video Container */}
      <View style={styles.modernVideoContainer}>
        <TouchableOpacity
          style={styles.modernVideoTouchable}
          onPress={handleVideoPress}
          activeOpacity={1}
        >
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={[styles.modernVideo, { width: videoSize.width, height: videoSize.height }]}
            paused={paused}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onError={handleError}
            onLoadStart={() => setLoading(true)}
            resizeMode="contain"
            controls={false}
            progressUpdateInterval={1000}
            volume={0.1}
            onSeek={(data) => {
              console.log('🎬 Seek completed:', data);
              setCurrentTime(data.currentTime);
            }}
          />

          {/* Modern Loading Overlay */}
          {loading && (
            <View style={styles.modernLoadingOverlay}>
              <View style={styles.loadingSpinner}>
                <ActivityIndicator size="large" color="#FF6B6B" />
              </View>
              <Text style={styles.modernLoadingText}>
                Loading video...
              </Text>
            </View>
          )}


          {/* Modern Top Controls */}
          {!loading && showControls && (
            <View style={styles.modernTopControls}>
              <TouchableOpacity
                style={styles.modernFullscreenButton}
                onPress={toggleFullscreen}
              >
                <Ionicons
                  name={isFullscreen ? "contract" : "expand"}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Seek Indicator */}
          {showSeekIndicator && (
            <View style={styles.seekIndicator}>
              <View style={styles.seekIndicatorContent}>
                <Ionicons
                  name={seekDirection === 'forward' ? 'play-forward' : 'play-back'}
                  size={40}
                  color="white"
                />
                <Text style={styles.seekIndicatorText}>
                  {seekDirection === 'forward' ? '+10s' : '-10s'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Modern Bottom Controls */}
      {!loading && (
        <View style={[
          styles.modernBottomControls, 
          { 
            opacity: showControls ? 1 : 0.8,
            transform: [{ translateY: showControls ? 0 : 20 }]
          }
        ]}>
          {/* Modern Progress Bar */}
          <View style={styles.modernProgressContainer}>
            <View
              style={styles.modernProgressBar}
              {...panResponder.panHandlers}
            >
              <View
                style={[
                  styles.modernProgressFill,
                  {
                    width: `${duration > 0 ? ((isSeeking ? seekTime : currentTime) / duration) * 100 : 0}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.modernProgressThumb,
                  {
                    left: `${duration > 0 ? ((isSeeking ? seekTime : currentTime) / duration) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.modernTimeContainer}>
              <Text style={styles.modernTimeText}>
                {formatTime(isSeeking ? seekTime : currentTime)}
              </Text>
              <Text style={styles.modernTimeText}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>

          {/* Modern Control Buttons */}
          <View style={styles.modernControlsRow}>
            <TouchableOpacity
              style={styles.modernSkipButton}
              onPress={handleSkipBackward}
              activeOpacity={0.7}
            >
              <Ionicons name="play-skip-back" size={28} color="white" />
              <Text style={styles.modernSkipText}>10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernPlayButton}
              onPress={togglePlayPause}
              activeOpacity={0.8}
            >
              <Ionicons
                name={paused ? 'play' : 'pause'}
                size={32}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSkipButton}
              onPress={handleSkipForward}
              activeOpacity={0.7}
            >
              <Ionicons name="play-skip-forward" size={28} color="white" />
              <Text style={styles.modernSkipText}>10s</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Modern Header Styles
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  headerFullscreenButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modern Video Container
  modernVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  modernVideoTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  modernVideo: {
    backgroundColor: '#000',
  },
  
  // Modern Loading
  modernLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingSpinner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernLoadingText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  
  
  // Modern Top Controls
  modernTopControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 600,
  },
  modernFullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  // Modern Bottom Controls
  modernBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    zIndex: 600,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  
  // Modern Progress Bar
  modernProgressContainer: {
    marginBottom: 20,
  },
  modernProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
    marginBottom: 12,
    position: 'relative',
    paddingVertical: 15,
  },
  modernProgressFill: {
    height: 6,
    backgroundColor: '#FF6B6B',
    borderRadius: 3,
    position: 'absolute',
    top: 15,
  },
  modernProgressThumb: {
    position: 'absolute',
    top: 9,
    width: 20,
    height: 20,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 3,
    borderColor: 'white',
  },
  modernTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  modernTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Modern Control Buttons
  modernControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  modernPlayButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  modernSkipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 80,
    minHeight: 60,
  },
  modernSkipText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Seek Indicator
  seekIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 700,
  },
  seekIndicatorContent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  seekIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginTop: 8,
  },
  
  // Error Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#000',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 16,
    color: 'white',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    backgroundColor: '#FF6B6B',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});
