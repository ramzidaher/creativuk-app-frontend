import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WebVideoViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
  onError?: (error: any) => void;
}

export const WebVideoViewer: React.FC<WebVideoViewerProps> = ({
  videoUrl,
  title = 'Proposal Video',
  onClose,
  onError,
}) => {
  console.log('🎬 WebVideoViewer: Received videoUrl:', videoUrl);
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Calculate responsive video dimensions
  const getVideoDimensions = () => {
    const isLargeScreen = screenWidth > 768;
    const isVeryLargeScreen = screenWidth > 1200;
    
    const headerHeight = isLargeScreen ? 100 : 80;
    const controlsHeight = isLargeScreen ? 60 : 50;
    const availableHeight = screenHeight - headerHeight - controlsHeight;
    const availableWidth = screenWidth;
    
    const maxVideoWidth = isVeryLargeScreen ? 1200 : (isLargeScreen ? 900 : availableWidth);
    const effectiveWidth = Math.min(availableWidth, maxVideoWidth);
    
    // Calculate video dimensions maintaining 16:9 aspect ratio
    let videoWidth = effectiveWidth;
    let videoHeight = videoWidth / (16/9);
    
    if (videoHeight > availableHeight) {
      videoHeight = availableHeight;
      videoWidth = videoHeight * (16/9);
    }
    
    return { 
      width: videoWidth,
      height: videoHeight
    };
  };

  const videoSize = getVideoDimensions();

  // HTML template for the video player
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background: #000;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .video-container {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
        }
        
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }
        
        .loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 16px;
          text-align: center;
        }
        
        .error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #ff6b6b;
          font-size: 16px;
          text-align: center;
          padding: 20px;
        }
        
        .controls-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          padding: 20px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .video-container:hover .controls-overlay {
          opacity: 1;
        }
        
        .progress-container {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.3);
          border-radius: 3px;
          margin-bottom: 10px;
          cursor: pointer;
        }
        
        .progress-bar {
          height: 100%;
          background: #ff6b6b;
          border-radius: 3px;
          width: 0%;
          transition: width 0.1s ease;
        }
        
        .controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .play-pause {
          background: #ff6b6b;
          border: none;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .time {
          color: white;
          font-size: 14px;
          min-width: 100px;
        }
        
        .volume {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        
        .fullscreen {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 10px;
        }
      </style>
    </head>
    <body>
      <div class="video-container">
        <video id="video" controls preload="metadata">
          <source src="${videoUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        
        <div class="loading" id="loading">
          Loading video...
        </div>
        
        <div class="error" id="error" style="display: none;">
          Failed to load video. Please check your connection.
        </div>
        
        <div class="controls-overlay">
          <div class="progress-container" id="progressContainer">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="controls">
            <button class="play-pause" id="playPause">▶</button>
            <div class="time" id="time">0:00 / 0:00</div>
            <input type="range" class="volume" id="volume" min="0" max="1" step="0.1" value="0.1">
            <button class="fullscreen" id="fullscreen">⛶</button>
          </div>
        </div>
      </div>
      
      <script>
        const video = document.getElementById('video');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const playPause = document.getElementById('playPause');
        const progressBar = document.getElementById('progressBar');
        const progressContainer = document.getElementById('progressContainer');
        const time = document.getElementById('time');
        const volume = document.getElementById('volume');
        const fullscreen = document.getElementById('fullscreen');
        
        let isPlaying = false;
        let isDragging = false;
        
        // Format time
        function formatTime(seconds) {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
        
        // Update progress bar
        function updateProgress() {
          if (!isDragging && video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            progressBar.style.width = progress + '%';
          }
        }
        
        // Update time display
        function updateTime() {
          if (video.duration) {
            time.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
          }
        }
        
        // Video event listeners
        video.addEventListener('loadstart', () => {
          loading.style.display = 'block';
          error.style.display = 'none';
        });
        
        video.addEventListener('canplay', () => {
          loading.style.display = 'none';
          error.style.display = 'none';
          // Set volume to 10% (0.1) to prevent loud sounds
          video.volume = 0.1;
        });
        
        video.addEventListener('error', () => {
          loading.style.display = 'none';
          error.style.display = 'block';
        });
        
        video.addEventListener('play', () => {
          isPlaying = true;
          playPause.textContent = '⏸';
        });
        
        video.addEventListener('pause', () => {
          isPlaying = false;
          playPause.textContent = '▶';
        });
        
        video.addEventListener('timeupdate', () => {
          updateProgress();
          updateTime();
        });
        
        video.addEventListener('loadedmetadata', () => {
          updateTime();
        });
        
        // Control event listeners
        playPause.addEventListener('click', () => {
          if (isPlaying) {
            video.pause();
          } else {
            video.play();
          }
        });
        
        progressContainer.addEventListener('click', (e) => {
          if (video.duration) {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
          }
        });
        
        volume.addEventListener('input', (e) => {
          video.volume = e.target.value;
        });
        
        fullscreen.addEventListener('click', () => {
          if (video.requestFullscreen) {
            video.requestFullscreen();
          } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
          } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
          }
        });
        
        // Touch events for mobile
        let touchStartX = 0;
        let touchStartTime = 0;
        
        video.addEventListener('touchstart', (e) => {
          touchStartX = e.touches[0].clientX;
          touchStartTime = Date.now();
        });
        
        video.addEventListener('touchend', (e) => {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndTime = Date.now();
          const deltaX = touchEndX - touchStartX;
          const deltaTime = touchEndTime - touchStartTime;
          
          // Double tap detection
          if (deltaTime < 300 && Math.abs(deltaX) < 50) {
            if (isPlaying) {
              video.pause();
            } else {
              video.play();
            }
          }
        });
      </script>
    </body>
    </html>
  `;

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('🎬 WebView error:', nativeEvent);
    setError('Failed to load video player');
    setLoading(false);
    if (onError) {
      onError(nativeEvent);
    }
  };

  const handleWebViewLoad = () => {
    console.log('🎬 WebView loaded successfully');
    setLoading(false);
    setError(null);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Video Container */}
      <View style={[styles.videoContainer, { width: videoSize.width, height: videoSize.height }]}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FF6B6B" />
            <Text style={styles.loadingText}>Loading video player...</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          onError={handleWebViewError}
          onLoad={handleWebViewLoad}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={false}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  loadingOverlay: {
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
  loadingText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
    marginTop: 16,
  },
  
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
