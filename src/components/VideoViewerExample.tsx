import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { ImprovedVideoViewer } from './ImprovedVideoViewer';
import { WebVideoViewer } from './WebVideoViewer';
import { VideoViewer } from './VideoViewer';
import { useTheme } from '../context/ThemeContext';

interface VideoViewerExampleProps {
  videoUrl: string;
  title?: string;
}

export const VideoViewerExample: React.FC<VideoViewerExampleProps> = ({
  videoUrl,
  title = 'Proposal Video',
}) => {
  const { theme } = useTheme();
  const [selectedViewer, setSelectedViewer] = useState<'improved' | 'web' | 'original'>('improved');
  const [showViewer, setShowViewer] = useState(false);

  const handleError = (error: any) => {
    console.error('Video error:', error);
    Alert.alert('Video Error', 'Failed to load video. Please try again.');
  };

  const renderVideoViewer = () => {
    switch (selectedViewer) {
      case 'improved':
        return (
          <ImprovedVideoViewer
            videoUrl={videoUrl}
            title={title}
            onClose={() => setShowViewer(false)}
            onError={handleError}
          />
        );
      case 'web':
        return (
          <WebVideoViewer
            videoUrl={videoUrl}
            title={title}
            onClose={() => setShowViewer(false)}
            onError={handleError}
          />
        );
      case 'original':
        return (
          <VideoViewer
            videoUrl={videoUrl}
            title={title}
            onClose={() => setShowViewer(false)}
            onError={handleError}
          />
        );
      default:
        return null;
    }
  };

  if (showViewer) {
    return renderVideoViewer();
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <Text style={[styles.title, { color: theme.primaryText }]}>
        Choose Video Player
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        Select which video player implementation you'd like to use:
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primaryButton },
            selectedViewer === 'improved' && styles.selectedButton
          ]}
          onPress={() => setSelectedViewer('improved')}
        >
          <Text style={[styles.buttonText, { color: theme.primaryBackground }]}>
            Improved (react-native-video)
          </Text>
          <Text style={[styles.buttonSubtext, { color: theme.primaryBackground }]}>
            Best performance, native controls
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primaryButton },
            selectedViewer === 'web' && styles.selectedButton
          ]}
          onPress={() => setSelectedViewer('web')}
        >
          <Text style={[styles.buttonText, { color: theme.primaryBackground }]}>
            Web-based (WebView)
          </Text>
          <Text style={[styles.buttonSubtext, { color: theme.primaryBackground }]}>
            Cross-platform, HTML5 controls
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primaryButton },
            selectedViewer === 'original' && styles.selectedButton
          ]}
          onPress={() => setSelectedViewer('original')}
        >
          <Text style={[styles.buttonText, { color: theme.primaryBackground }]}>
            Original (expo-av)
          </Text>
          <Text style={[styles.buttonSubtext, { color: theme.primaryBackground }]}>
            Your current implementation
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.launchButton, { backgroundColor: theme.successButton }]}
        onPress={() => setShowViewer(true)}
      >
        <Text style={[styles.launchButtonText, { color: 'white' }]}>
          Launch Video Player
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  buttonSubtext: {
    fontSize: 14,
    opacity: 0.8,
  },
  launchButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  launchButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
