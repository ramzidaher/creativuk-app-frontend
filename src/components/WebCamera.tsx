import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WebCameraProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const WebCamera: React.FC<WebCameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCamera, setCurrentCamera] = useState<'environment' | 'user'>('environment');
  const [isSwitching, setIsSwitching] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // Check browser compatibility and HTTPS requirement
  const checkBrowserCompatibility = () => {
    console.log('🔍 Checking browser compatibility...');
    console.log('🔍 Current location:', window.location.href);
    console.log('🔍 Protocol:', window.location.protocol);
    console.log('🔍 Hostname:', window.location.hostname);
    
    // For the specific development IP, skip HTTPS requirement entirely
    if (window.location.hostname === '172.187.217.251') {
      console.log('🔍 Development IP detected, skipping HTTPS requirement');
    } else {
      // Check if we're on HTTPS, localhost, or 127.0.0.1
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        return 'Camera access requires HTTPS. Please access this site over HTTPS or use localhost/127.0.0.1 for development.';
      }
    }
    
    // Check if MediaDevices API is available
    if (!navigator.mediaDevices) {
      console.log('❌ navigator.mediaDevices not available');
      if (window.location.hostname === '172.187.217.251' && window.location.protocol === 'http:') {
        return 'Camera access requires HTTPS even for development IPs. Please access the site via HTTPS or use localhost for development.';
      }
      return 'Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.';
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices.getUserMedia) {
      console.log('❌ navigator.mediaDevices.getUserMedia not available');
      return 'Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.';
    }
    
    console.log('✅ Browser compatibility check passed');
    return null;
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Check browser compatibility first
      const compatibilityError = checkBrowserCompatibility();
      if (compatibilityError) {
        setError(compatibilityError);
        return;
      }
      
      enumerateDevices();
      
      // Listen for device changes (when cameras are connected/disconnected)
      const handleDeviceChange = () => {
        console.log('🔌 Device change detected, re-enumerating...');
        enumerateDevices();
      };
      
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      
      return () => {
        stopCamera();
        if (navigator.mediaDevices) {
          navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        }
      };
    }
    return () => {
      stopCamera();
    };
  }, []);

  const enumerateDevices = async () => {
    try {
      console.log('🔍 Enumerating camera devices...');
      console.log('🔍 navigator.mediaDevices available:', !!navigator.mediaDevices);
      console.log('🔍 Current URL:', window.location.href);
      
      // Skip the temporary stream approach as it might be causing conflicts
      // Just try to enumerate devices directly
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('📹 Found video devices:', videoDevices.map(d => ({
        deviceId: d.deviceId,
        label: d.label || 'Unknown Camera',
        groupId: d.groupId
      })));
      
      setAvailableDevices(videoDevices);
      
      if (videoDevices.length > 0) {
        console.log('🎥 Starting camera with found devices...');
        await startCamera();
      } else {
        console.log('🎥 No devices found, trying direct camera access...');
        // Try direct camera access without device enumeration
        try {
          await startCameraWithFacingMode();
        } catch (directErr) {
          console.error('Direct camera access also failed:', directErr);
          setError('No camera devices found. Please ensure your camera is connected and not being used by another application.');
        }
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
      const error = err as Error;
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No camera found. Please ensure your camera is connected and not being used by another application.');
      } else if (error.name === 'NotSupportedError') {
        setError('Camera access is not supported in this browser or requires HTTPS.');
      } else {
        setError('Unable to access camera devices. Please check your browser permissions and try again.');
      }
    }
  };

  const startCamera = async (deviceIndex?: number) => {
    try {
      console.log('🎥 startCamera called with deviceIndex:', deviceIndex);
      setError(null);
      
      // Ensure any existing stream is properly stopped first
      await stopCamera();
      
      // Add a longer delay to ensure the stream is fully released
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use provided device index or current one
      const targetDeviceIndex = deviceIndex !== undefined ? deviceIndex : currentDeviceIndex;
      
      if (availableDevices.length === 0) {
        console.log('🎥 No devices available, using facingMode fallback');
        try {
          await startCameraWithFacingMode();
        } catch (fallbackErr) {
          console.error('FacingMode fallback failed:', fallbackErr);
          throw fallbackErr;
        }
        return;
      }
      
      const targetDevice = availableDevices[targetDeviceIndex];
      console.log('🎥 Starting camera with device:', {
        index: targetDeviceIndex,
        deviceId: targetDevice.deviceId,
        label: targetDevice.label || 'Unknown Camera'
      });
      
      // Try with more flexible constraints first
      let constraints: MediaStreamConstraints = {
        video: {
          deviceId: { ideal: targetDevice.deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      
      let stream: MediaStream;
      
      try {
        console.log('🎥 Attempting getUserMedia with constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ getUserMedia successful with ideal constraints');
      } catch (exactErr) {
        console.log('🎥 Ideal device ID failed, trying with exact constraint...', exactErr);
        // If ideal fails, try with exact
        constraints = {
          video: {
            deviceId: { exact: targetDevice.deviceId },
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };
        try {
          console.log('🎥 Attempting getUserMedia with exact constraints:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ getUserMedia successful with exact constraints');
        } catch (exactErr2) {
          console.log('🎥 Exact device ID failed, trying with minimal constraints...', exactErr2);
          // If exact fails, try with minimal constraints
          constraints = {
            video: {
              deviceId: { exact: targetDevice.deviceId }
            }
          };
          console.log('🎥 Attempting getUserMedia with minimal constraints:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ getUserMedia successful with minimal constraints');
        }
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
        setCurrentDeviceIndex(targetDeviceIndex);
        
        // Update current camera type based on device label
        const isFrontCamera = targetDevice.label?.toLowerCase().includes('front') || 
                             targetDevice.label?.toLowerCase().includes('user') ||
                             targetDevice.label?.toLowerCase().includes('facing');
        setCurrentCamera(isFrontCamera ? 'user' : 'environment');
        
        console.log('🎥 Camera started successfully with device:', targetDevice.label);
      }
    } catch (err) {
      console.error('Error accessing camera with device:', err);
      
      // Fallback to facingMode if device selection fails
      console.log('🎥 Falling back to facingMode...');
      try {
        await startCameraWithFacingMode();
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        
        // Try to retry if we haven't exceeded the retry limit
        if (retryCount < 2) {
          const newRetryCount = retryCount + 1;
          console.log(`🔄 Retrying camera access (attempt ${newRetryCount}/3)...`);
          setRetryCount(newRetryCount);
          setTimeout(() => {
            enumerateDevices();
          }, 3000); // Increased delay to 3 seconds
        } else {
          console.log('🔄 Max retries reached, showing error');
          setError('Unable to access camera. This may be because:\n• Camera is in use by another app\n• Browser permissions are denied\n• Camera hardware issue\n\nPlease try closing other apps using the camera and retry.');
          Alert.alert(
            'Camera Access Denied',
            'Unable to access camera. This may be because:\n• Camera is in use by another app\n• Browser permissions are denied\n• Camera hardware issue\n\nPlease try closing other apps using the camera and retry.',
            [{ text: 'OK', onPress: onClose }]
          );
        }
      }
    }
  };

  const startCameraWithFacingMode = async () => {
    try {
      
      // Ensure any existing stream is properly stopped first
      await stopCamera();
      
      // Add a longer delay to ensure the stream is fully released
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🎥 Starting camera with facingMode:', currentCamera);
      
      // Try with minimal constraints first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: currentCamera,
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
      } catch (minimalErr) {
        console.log('🎥 Minimal constraints failed, trying even more basic...');
        // Try with even more basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: currentCamera
          }
        });
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
        console.log('🎥 Camera started with facingMode:', currentCamera);
      }
    } catch (err) {
      console.error('Error starting camera with facingMode:', err);
      throw err;
    }
  };

  const stopCamera = async () => {
    if (streamRef.current) {
      console.log('🛑 Stopping camera stream...');
      streamRef.current.getTracks().forEach(track => {
        console.log('🛑 Stopping track:', track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
      videoRef.current.load(); // Reset the video element
    }
    
    setIsStreaming(false);
    console.log('🛑 Camera stream stopped');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      Alert.alert('Error', 'Camera is not ready. Please try again.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      Alert.alert('Error', 'Unable to capture photo. Please try again.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 with ultra low quality for backend limits
    const imageData = canvas.toDataURL('image/jpeg', 0.4);
    
    // Stop camera and return the image
    stopCamera();
    onCapture(imageData);
  };

  const switchCamera = async () => {
    if (isSwitching) {
      console.log('🔄 Camera switch already in progress, ignoring request');
      return;
    }
    
    console.log('🔄 Switching camera from device index:', currentDeviceIndex);
    setIsSwitching(true);
    stopCamera();
    
      // Re-enumerate devices in case new ones became available
      try {
        console.log('🔄 Re-enumerating devices before switch...');
        
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('📹 Re-enumeration found devices:', videoDevices.map(d => ({
        deviceId: d.deviceId,
        label: d.label || 'Unknown Camera',
        groupId: d.groupId
      })));
      
      setAvailableDevices(videoDevices);
      
      if (videoDevices.length <= 1) {
        console.log('🔄 Only one camera available after re-enumeration, using facingMode toggle');
        await switchCameraWithFacingMode();
        return;
      }
      
      // Cycle to next available device
      const nextDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
      console.log('🔄 Switching to device index:', nextDeviceIndex);
      
      // Add a small delay to ensure the stream is fully stopped
      setTimeout(async () => {
        try {
          await startCamera(nextDeviceIndex);
          console.log('✅ Camera switch completed successfully');
        } catch (error) {
          console.error('Failed to switch to new camera, falling back to original:', error);
          // If the new camera fails, try to go back to the original camera
          try {
            await startCamera(currentDeviceIndex);
            console.log('✅ Fallback to original camera successful');
          } catch (fallbackError) {
            console.error('Failed to fallback to original camera:', fallbackError);
            setError('Unable to switch camera. Please try again.');
          }
        } finally {
          setIsSwitching(false);
        }
      }, 100);
      
    } catch (enumError) {
      console.error('Failed to re-enumerate devices:', enumError);
      // Fallback to facingMode switching
      await switchCameraWithFacingMode();
    }
  };

  const switchCameraWithFacingMode = async () => {
    if (isSwitching) {
      return;
    }
    
    console.log('🔄 Switching camera with facingMode from:', currentCamera);
    setIsSwitching(true);
    stopCamera();
    
    // Toggle between front and back camera using facingMode
    const newCameraType = currentCamera === 'environment' ? 'user' : 'environment';
    console.log('🔄 Switching to facingMode:', newCameraType);
    
    setTimeout(async () => {
      try {
        setCurrentCamera(newCameraType);
        await startCameraWithFacingMode();
        console.log('✅ Camera switch with facingMode completed successfully');
      } catch (error) {
        console.error('Failed to switch camera with facingMode:', error);
        setError('Unable to switch camera. Please try again.');
      } finally {
        setIsSwitching(false);
      }
    }, 100);
  };

  const getCameraDisplayText = () => {
    if (availableDevices.length === 0) {
      return currentCamera === 'environment' ? '📷 Back Camera' : '🤳 Front Camera';
    }
    
    const currentDevice = availableDevices[currentDeviceIndex];
    if (currentDevice) {
      const deviceName = currentDevice.label || 'Unknown Camera';
      const emoji = currentCamera === 'environment' ? '📷' : '🤳';
      return `${emoji} ${deviceName}`;
    }
    
    return currentCamera === 'environment' ? '📷 Back Camera' : '🤳 Front Camera';
  };

  const getSwitchButtonText = () => {
    if (availableDevices.length <= 1) {
      return currentCamera === 'environment' ? '📷' : '🤳';
    }
    
    // Show camera count if multiple devices
    return `${currentCamera === 'environment' ? '📷' : '🤳'} ${currentDeviceIndex + 1}/${availableDevices.length}`;
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Take Photo</Text>
          <Text style={styles.cameraIndicator}>
            {isSwitching ? '⏳ Switching Camera...' : getCameraDisplayText()}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Camera Access Issue</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          {/* Additional help text for common issues */}
          {error.includes('HTTPS') && (
            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>How to fix:</Text>
              <Text style={styles.helpText}>• Use HTTPS instead of HTTP (https://172.187.217.251/)</Text>
              <Text style={styles.helpText}>• For development, use localhost or 127.0.0.1</Text>
              <Text style={styles.helpText}>• Modern browsers require HTTPS for camera access</Text>
              <Text style={styles.helpText}>• Check your browser's security settings</Text>
            </View>
          )}
          
          {error.includes('permissions') && (
            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>How to fix:</Text>
              <Text style={styles.helpText}>• Click the camera icon in your browser's address bar</Text>
              <Text style={styles.helpText}>• Select "Allow" for camera access</Text>
              <Text style={styles.helpText}>• Refresh the page and try again</Text>
            </View>
          )}
          
          {error.includes('browser') && (
            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>Recommended browsers:</Text>
              <Text style={styles.helpText}>• Google Chrome (latest version)</Text>
              <Text style={styles.helpText}>• Mozilla Firefox (latest version)</Text>
              <Text style={styles.helpText}>• Safari (latest version)</Text>
              <Text style={styles.helpText}>• Microsoft Edge (latest version)</Text>
            </View>
          )}
          
          {error.includes('development IPs') && (
            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>Development Solutions:</Text>
              <Text style={styles.helpText}>• Use HTTPS: https://172.187.217.251/</Text>
              <Text style={styles.helpText}>• Use localhost: http://localhost/</Text>
              <Text style={styles.helpText}>• Use 127.0.0.1: http://127.0.0.1/</Text>
              <Text style={styles.helpText}>• Set up SSL certificate for your development server</Text>
            </View>
          )}
          
          <View style={styles.errorButtons}>
            <TouchableOpacity 
              onPress={() => {
                setError(null);
                setRetryCount(0);
                enumerateDevices();
              }} 
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>🔄 Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeErrorButton}>
              <Text style={styles.closeErrorButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.cameraContainer}>
            <video
              ref={videoRef}
              style={styles.video as any}
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              style={styles.canvas as any}
            />
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              onPress={switchCamera}
              style={[
                styles.switchButton, 
                !isStreaming && styles.switchButtonDisabled,
                isSwitching && styles.switchButtonSwitching
              ]}
              disabled={!isStreaming || isSwitching}
              activeOpacity={0.7}
            >
              <Text style={styles.switchButtonText}>
                {isSwitching ? '⏳' : getSwitchButtonText()}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={capturePhoto}
              style={[styles.captureButton, !isStreaming && styles.captureButtonDisabled]}
              disabled={!isStreaming}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.placeholder} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraIndicator: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
    fontWeight: '600',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  canvas: {
    display: 'none',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  switchButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  switchButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.5,
  },
  switchButtonSwitching: {
    backgroundColor: 'rgba(255, 193, 7, 0.6)',
    borderColor: 'rgba(255, 193, 7, 0.8)',
    transform: [{ scale: 0.95 }],
  },
  switchButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  helpContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  helpTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  helpText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.9,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeErrorButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeErrorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WebCamera;

