import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import PowerPointViewer from './PowerPointViewer';

interface PowerPointViewerDemoProps {
  onClose?: () => void;
}

const PowerPointViewerDemo: React.FC<PowerPointViewerDemoProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const [showViewer, setShowViewer] = useState(false);

  // Example PowerPoint URLs for testing
  const exampleUrls = [
    {
      name: 'Sample PowerPoint (Office Online)',
      url: 'https://view.officeapps.live.com/op/embed.aspx?src=https://www.learningcontainer.com/wp-content/uploads/2019/09/sample-pptx-file.pptx',
    },
    {
      name: 'Microsoft Sample',
      url: 'https://view.officeapps.live.com/op/embed.aspx?src=https://file-examples.com/storage/fe68c0b0a0a0a0a0a0a0a0a/2017/08/file_example_PPTX_1MB.pptx',
    },
  ];

  const handleTestViewer = (url: string, name: string) => {
    setShowViewer(true);
  };

  const handleViewerError = (error: string) => {
    Alert.alert('Viewer Error', error);
    setShowViewer(false);
  };

  const handleViewerLoad = () => {
    console.log('PowerPoint viewer loaded successfully');
  };

  if (showViewer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={[styles.header, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.tertiaryBackground }]}
            onPress={() => setShowViewer(false)}
          >
            <Feather name="x" size={20} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
            PowerPoint Viewer Demo
          </Text>
        </View>
        
        <PowerPointViewer
          presentationUrl={exampleUrls[0].url}
          filename="Sample Presentation.pptx"
          onError={handleViewerError}
          onLoad={handleViewerLoad}
          style={styles.viewer}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: theme.tertiaryBackground }]}
          onPress={onClose}
        >
          <Feather name="x" size={20} color={theme.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
          PowerPoint Viewer Demo
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
          <Feather name="info" size={24} color={theme.primaryColor} />
          <Text style={[styles.infoTitle, { color: theme.primaryText }]}>
            PowerPoint Viewer Features
          </Text>
          <Text style={[styles.infoText, { color: theme.secondaryText }]}>
            • View PowerPoint presentations directly in the app{'\n'}
            • Works on both web and mobile platforms{'\n'}
            • Supports Office Online viewer{'\n'}
            • Automatic fallback to PDF if PowerPoint fails{'\n'}
            • Download functionality included
          </Text>
        </View>

        <View style={[styles.testCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.testTitle, { color: theme.primaryText }]}>
            Test PowerPoint Viewer
          </Text>
          
          {exampleUrls.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.testButton, { backgroundColor: theme.primaryColor }]}
              onPress={() => handleTestViewer(example.url, example.name)}
            >
              <Feather name="play" size={16} color="white" />
              <Text style={styles.testButtonText}>{example.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.usageCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.usageTitle, { color: theme.primaryText }]}>
            How to Use
          </Text>
          <Text style={[styles.usageText, { color: theme.secondaryText }]}>
            1. Pass a PowerPoint URL to the PowerPointViewer component{'\n'}
            2. The component will automatically detect the file type{'\n'}
            3. It uses Office Online viewer for PowerPoint files{'\n'}
            4. Includes error handling and fallback options{'\n'}
            5. Works seamlessly on web and mobile
          </Text>
        </View>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  viewer: {
    flex: 1,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  testCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  usageText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PowerPointViewerDemo;
