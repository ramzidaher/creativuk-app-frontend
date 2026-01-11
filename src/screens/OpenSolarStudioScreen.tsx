import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  projectId?: number;
}

export default function OpenSolarStudioScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { opportunityId, projectId } = route.params as RouteParams;
  const { theme } = useTheme();
  
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [studioReady, setStudioReady] = useState(false);
  const [projectData, setProjectData] = useState<any>(null);

  // OpenSolar Studio HTML with SDK integration
  const studioHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OpenSolar Studio</title>
      <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #studio-container { width: 100vw; height: 100vh; }
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
        .controls { position: fixed; top: 20px; right: 20px; z-index: 1000; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .control-btn { margin: 5px; padding: 8px 16px; border: none; border-radius: 4px; background: #007bff; color: white; cursor: pointer; }
        .control-btn:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="controls">
        <button class="control-btn" onclick="addSolarPanels()">Add Solar Panels</button>
        <button class="control-btn" onclick="addBattery()">Add Battery</button>
        <button class="control-btn" onclick="addInverter()">Add Inverter</button>
        <button class="control-btn" onclick="saveDesign()">Save Design</button>
        <button class="control-btn" onclick="getDesignData()">Get Design Data</button>
      </div>
      
      <div id="studio-container">
        <div class="loading">
          <h2>Loading OpenSolar Studio...</h2>
          <p>Initializing 2D/3D design interface</p>
        </div>
      </div>

      <script src="https://cdn.opensolar.com/sdk/latest/ossdk.js"></script>
      <script>
        let ossdk;
        let projectId = ${projectId || 'null'};
        
        // Initialize OpenSolar SDK
        async function initStudio() {
          try {
            // Initialize the SDK
            ossdk = await window.ossdk.init({
              apiKey: 'your-api-key-here', // Replace with your OpenSolar API key
              projectId: projectId
            });
            
            console.log('OpenSolar SDK initialized');
            
            // Load the studio interface
            await loadStudioInterface();
            
          } catch (error) {
            console.error('Failed to initialize OpenSolar SDK:', error);
            document.getElementById('studio-container').innerHTML = 
              '<div style="padding: 20px; text-align: center;"><h3>Error Loading Studio</h3><p>Please check your connection and try again.</p></div>';
          }
        }
        
        // Load the studio interface
        async function loadStudioInterface() {
          try {
            // Create a new project if none exists
            if (!projectId) {
              const project = await ossdk.project_form.create({
                name: 'Solar Project',
                address: 'Project Address',
                customer_name: 'Customer Name'
              });
              projectId = project.id;
              console.log('Created new project:', projectId);
            }
            
            // Load the studio view
            await ossdk.studio.load(projectId);
            
            // Hide loading and show studio
            document.querySelector('.loading').style.display = 'none';
            document.getElementById('studio-container').style.display = 'block';
            
            // Notify React Native that studio is ready
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'studio_ready',
              projectId: projectId
            }));
            
          } catch (error) {
            console.error('Failed to load studio:', error);
            throw error;
          }
        }
        
        // Add solar panels to the design
        async function addSolarPanels() {
          try {
            await ossdk.studio.setComponents([
              { code: 'Solaria PowerXT-400R-PM', quantity: 20 }
            ]);
            console.log('Solar panels added');
            showNotification('Solar panels added to design');
          } catch (error) {
            console.error('Failed to add solar panels:', error);
            showNotification('Failed to add solar panels', 'error');
          }
        }
        
        // Add battery to the design
        async function addBattery() {
          try {
            await ossdk.studio.setComponents([
              { code: 'EVOLVE LFP 5kW/14kWh', quantity: 1 }
            ]);
            console.log('Battery added');
            showNotification('Battery added to design');
          } catch (error) {
            console.error('Failed to add battery:', error);
            showNotification('Failed to add battery', 'error');
          }
        }
        
        // Add inverter to the design
        async function addInverter() {
          try {
            await ossdk.studio.setComponents([
              { code: 'Fronius Primo 5.0-1 208-240 [240V]', quantity: 1 }
            ]);
            console.log('Inverter added');
            showNotification('Inverter added to design');
          } catch (error) {
            console.error('Failed to add inverter:', error);
            showNotification('Failed to add inverter', 'error');
          }
        }
        
        // Save the current design
        async function saveDesign() {
          try {
            await ossdk.project_form.save();
            console.log('Design saved');
            showNotification('Design saved successfully');
            
            // Notify React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'design_saved',
              projectId: projectId
            }));
            
          } catch (error) {
            console.error('Failed to save design:', error);
            showNotification('Failed to save design', 'error');
          }
        }
        
        // Get design data
        async function getDesignData() {
          try {
            const designData = await ossdk.project_form.getDesignData();
            console.log('Design data:', designData);
            
            // Notify React Native with design data
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'design_data',
              data: designData,
              projectId: projectId
            }));
            
            showNotification('Design data retrieved');
          } catch (error) {
            console.error('Failed to get design data:', error);
            showNotification('Failed to get design data', 'error');
          }
        }
        
        // Show notification
        function showNotification(message, type = 'success') {
          const notification = document.createElement('div');
          notification.style.cssText = \`
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            background: \${type === 'error' ? '#dc3545' : '#28a745'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          \`;
          notification.textContent = message;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.remove();
          }, 3000);
        }
        
        // Initialize when page loads
        window.addEventListener('load', initStudio);
        
        // Handle messages from React Native
        window.addEventListener('message', function(event) {
          console.log('Message from React Native:', event.data);
        });
      </script>
    </body>
    </html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', data);
      
      switch (data.type) {
        case 'studio_ready':
          setStudioReady(true);
          setLoading(false);
          setProjectData({ projectId: data.projectId });
          break;
          
        case 'design_saved':
          Alert.alert('Success', 'Design saved successfully!');
          break;
          
        case 'design_data':
          console.log('Design data received:', data.data);
          // You can store this data or send it to your backend
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      // Trigger save in WebView
      webViewRef.current?.postMessage(JSON.stringify({ action: 'save_design' }));
      
      // Wait a moment for save to complete
      setTimeout(() => {
        // Navigate back to workflow
        navigation.goBack();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving design:', error);
      Alert.alert('Error', 'Failed to save design');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.primaryText} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.primaryText }]}>OpenSolar Studio</Text>
        
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primaryButton }]}
          onPress={handleSaveAndContinue}
          disabled={!studioReady}
        >
          <Text style={[styles.saveButtonText, { color: '#ffffff' }]}>Save & Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Studio WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: studioHTML }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.primaryBackground }]}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>
            Loading OpenSolar Studio...
          </Text>
        </View>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});

