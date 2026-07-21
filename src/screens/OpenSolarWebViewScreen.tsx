import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  OPENSOLAR_LINK_BY_ADDRESS_HINT,
  OPENSOLAR_LINK_BY_ID_HINT,
  OPENSOLAR_LINK_SCREEN_INTRO,
  OPENSOLAR_LINK_SCREEN_TITLE,
} from '../constants/opensolarWorkflow';
import {
  PROPERTY_NOT_VISIBLE_CALLOUT_TITLE,
  PROPERTY_NOT_VISIBLE_SECTION_INTRO,
  PROPERTY_NOT_VISIBLE_SHORT_HINT,
  PROPERTY_NOT_VISIBLE_STEPS,
} from '../constants/findPropertyGuide';

const { width, height } = Dimensions.get('window');

interface RouteParams {
  opportunityId: string;
  opportunity?: any;
}

export default function OpenSolarProjectScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { opportunityId, opportunity } = route.params as RouteParams;
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const isTrainingOpportunity = opportunity?.source === 'TRAINING';
  
  console.log('OpenSolarProject: Opportunity:', opportunity?.name);
  
  const [openSolarProject, setOpenSolarProject] = useState<any>(null);
  const [isLinkingProject, setIsLinkingProject] = useState(false);
  const [manualProjectId, setManualProjectId] = useState('');
  const [showManualLink, setShowManualLink] = useState(false);
  const [isCompletingStep, setIsCompletingStep] = useState(false);
  
  // Search and link existing project states
  const [searchStep, setSearchStep] = useState<'main' | 'search' | 'select'>('main');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchProjects, setSearchProjects] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showProjectIdUpdate, setShowProjectIdUpdate] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [isUpdatingProjectId, setIsUpdatingProjectId] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Log component state on mount
  useEffect(() => {
    console.log('OpenSolarProject: Component mounted');
  }, []);

  // Ensure ScrollView starts at top on web
  useEffect(() => {
    if (Platform.OS === 'web' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, []);

  // Search for existing OpenSolar projects by property address
  const getOpportunityAddress = () => {
    if (!opportunity) return '';
    const parts = [opportunity.contactAddress, opportunity.contactPostcode].filter(Boolean);
    return parts.join(', ');
  };

  const handleSearchProjects = () => {
    const prefilledAddress = getOpportunityAddress();
    if (prefilledAddress) {
      setSearchAddress(prefilledAddress);
    }
    setSearchStep('search');
    setSearchError(null);
  };

  const handleSearch = async () => {
    console.log('🔍 handleSearch called with address:', searchAddress);
    
    if (!searchAddress.trim()) {
      console.log('❌ No address entered');
      Alert.alert('Error', 'Please enter an address to search');
      return;
    }

    console.log('🔍 Starting search for address:', searchAddress.trim());
    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('🔍 Importing API module...');
      const { api } = await import('../utils/api');
      console.log('🔍 API module imported successfully');
      
      console.log('🔍 Making POST request to /opensolar/search...');
      const response: any = await api.post('/opensolar/search', {
        address: searchAddress.trim()
      });
      
      console.log('🔍 Search response received:', response);
      console.log('🔍 Response success:', response.data?.success);
      console.log('🔍 Response data:', response.data?.data);
      console.log('🔍 Response message:', response.data?.message);

      if (response.data?.success) {
        console.log('✅ Search successful, setting projects and moving to select step');
        console.log('🔍 Raw projects data:', JSON.stringify(response.data, null, 2));
        
        // Validate and normalize the projects data
        const projects = response.data.data || [];
        console.log('🔍 Number of projects found:', projects.length);
        
        if (projects.length > 0) {
          console.log('🔍 First project structure:');
          console.log('  - ID:', projects[0].id, '(type:', typeof projects[0].id, ')');
          console.log('  - Name:', projects[0].display_name || projects[0].name);
          console.log('  - Address:', projects[0].address);
          console.log('  - Full object:', JSON.stringify(projects[0], null, 2));
        }
        
        setSearchProjects(projects);
        setSearchStep('select');
      } else {
        console.log('❌ Search failed:', response.data?.message);
        
        // Check if it's a rate limiting issue
        const errorMessage = response.data?.message || 'Failed to search projects';
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          setSearchError('OpenSolar API is temporarily unavailable due to high usage. Please try again in a few minutes.');
        } else {
          setSearchError(errorMessage);
        }
      }
    } catch (error: any) {
      console.error('❌ Error searching OpenSolar projects:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      // Check if it's a rate limiting issue
      const errorMessage = error.message || 'Failed to search OpenSolar projects';
      if (errorMessage.includes('rate limit') || errorMessage.includes('429') || 
          error.response?.status === 429) {
        setSearchError('OpenSolar API is temporarily unavailable due to high usage. Please try again in a few minutes.');
      } else {
        setSearchError('Failed to search OpenSolar projects');
      }
    } finally {
      console.log('🔍 Search completed, setting loading to false');
      setIsSearching(false);
    }
  };

  const handleProjectSelect = async (project: any) => {
    console.log('🔍 handleProjectSelect called with project:', project);
    console.log('🔍 Project ID:', project.id, '(type:', typeof project.id, ')');
    console.log('🔍 Project name:', project.display_name || project.name);
    console.log('🔍 Project address:', project.address);
    
    try {
      const { api } = await import('../utils/api');
      console.log('🔍 Making save-project request with:', {
        opportunityId,
        opensolarProjectId: project.id
      });
      
      const response: any = await api.post('/opensolar/save-project', {
        opportunityId,
        opensolarProjectId: project.id
      });

      console.log('🔍 Save project response:', response);

      // Check both response.success and response.data.success for compatibility
      const isSuccess = response.success || (response.data && response.data.success);
      
      if (isSuccess) {
        console.log('✅ Project saved successfully, updating UI state');
        
        // Set the linked project
        const linkedProject = {
          id: project.id,
          title: project.display_name || project.name || `Project ${project.id}`,
          address: project.address,
          isLinked: true
        };
        
        console.log('🔍 Setting openSolarProject to:', linkedProject);
        setOpenSolarProject(linkedProject);
        
        // Reset search states (but don't go back to main - stay in linked state)
        setSearchAddress('');
        setSearchProjects([]);
        setSearchError(null);
        
        console.log('🔍 State updated - openSolarProject should now be set');
        
        // Show success message with better UX
        Alert.alert(
          '🎉 Project Linked Successfully!', 
          `Your OpenSolar project has been linked!\n\nProject: ${project.display_name || project.name}\nProject ID: ${project.id}\n\nYou can now open the design page using the "Open Design" button below.`,
          [
            {
              text: 'Open Design Now',
              onPress: () => {
                // Automatically open the design page
                const designUrl = `https://app.opensolar.com/projects/${project.id}/design`;
                console.log('🔗 Opening design URL:', designUrl);
                if (Platform.OS === 'web') {
                  window.open(designUrl, '_blank');
                } else {
                  Linking.openURL(designUrl);
                }
              }
            },
            {
              text: 'Stay Here',
              style: 'cancel'
            }
          ]
        );
      } else {
        console.log('❌ Save project failed:', response.message || response.data?.message);
        
        // Even if the API fails, we can still link the project locally for the user to access
        // This handles cases where the backend has issues but the project ID is valid
        console.log('🔄 Attempting to link project locally despite API error...');
        
        const linkedProject = {
          id: project.id,
          title: project.display_name || project.name || `Project ${project.id}`,
          address: project.address,
          isLinked: true
        };
        
        console.log('🔍 Setting openSolarProject locally:', linkedProject);
        setOpenSolarProject(linkedProject);
        
        // Reset search states
        setSearchAddress('');
        setSearchProjects([]);
        setSearchError(null);
        
        Alert.alert(
          '⚠️ Project Linked (Local)', 
          `Project linked locally!\n\nProject: ${project.display_name || project.name}\nProject ID: ${project.id}\n\nNote: There was an issue saving to the backend, but you can still access the design page.`,
          [
            {
              text: 'Open Design Now',
              onPress: () => {
                const designUrl = `https://app.opensolar.com/projects/${project.id}/design`;
                console.log('🔗 Opening design URL:', designUrl);
                if (Platform.OS === 'web') {
                  window.open(designUrl, '_blank');
                } else {
                  Linking.openURL(designUrl);
                }
              }
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error saving OpenSolar project:', error);
      setSearchError('Failed to save OpenSolar project');
    }
  };

  // Link to existing OpenSolar project (manual entry)
  const linkToExistingProject = async () => {
    if (!manualProjectId.trim()) {
      Alert.alert('Error', 'Please enter a valid project ID');
      return;
    }

    try {
      setIsLinkingProject(true);
      
      // Save the project to the backend
      const { api } = await import('../utils/api');
      const response: any = await api.post('/opensolar/save-project', {
        opportunityId,
        opensolarProjectId: manualProjectId.trim()
      });

      // Check both response.success and response.data.success for compatibility
      const isSuccess = response.success || (response.data && response.data.success);
      
      if (isSuccess) {
        // Set the linked project
        setOpenSolarProject({
          id: manualProjectId.trim(),
          title: `Linked Project ${manualProjectId.trim()}`,
          isLinked: true
        });
        
        setShowManualLink(false);
        setManualProjectId('');
        
        Alert.alert(
          '🎉 Project Linked Successfully!', 
          `Your OpenSolar project has been linked!\n\nProject ID: ${manualProjectId.trim()}\n\nYou can now open the design page using the "Open Design" button below.`,
          [
            {
              text: 'Open Design Now',
              onPress: () => {
                const designUrl = `https://app.opensolar.com/projects/${manualProjectId.trim()}/design`;
                console.log('🔗 Opening design URL:', designUrl);
                if (Platform.OS === 'web') {
                  window.open(designUrl, '_blank');
                } else {
                  Linking.openURL(designUrl);
                }
              }
            },
            {
              text: 'Stay Here',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || response.data?.message || 'Failed to link project');
      }
    } catch (error: any) {
      console.error('❌ Error linking to project:', error);
      Alert.alert('Error', `Failed to link to project: ${error.message}`);
    } finally {
      setIsLinkingProject(false);
    }
  };

  // Update OpenSolar project ID
  const handleUpdateProjectId = async () => {
    if (!newProjectId.trim()) {
      Alert.alert('Error', 'Please enter a valid project ID');
      return;
    }

    setIsUpdatingProjectId(true);
    try {
      const { api } = await import('../utils/api');
      
      const response = await api.post(`/opensolar/update-project-id/${opportunityId}`, {
        projectId: parseInt(newProjectId.trim())
      });

      if (response.data?.success) {
        console.log('✅ Project ID updated successfully:', response.data.data);
        setOpenSolarProject({
          id: newProjectId.trim(),
          title: response.data.data.projectName || `Project ${newProjectId.trim()}`,
          isLinked: true
        });
        setShowProjectIdUpdate(false);
        setNewProjectId('');
        
        Alert.alert(
          'Success', 
          `Project ID updated successfully!\n\nProject: ${response.data.data.projectName}\nNew Project ID: ${response.data.data.opensolarProjectId}`,
          [
            {
              text: 'Open Design',
              onPress: () => {
                const designUrl = `https://app.opensolar.com/projects/${response.data.data.opensolarProjectId}/design`;
                if (Platform.OS === 'web') {
                  window.open(designUrl, '_blank');
                } else {
                  Linking.openURL(designUrl);
                }
              }
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } else {
        console.log('❌ Update project ID failed:', response.data?.message);
        Alert.alert('Error', response.data?.message || 'Failed to update project ID');
      }
    } catch (error) {
      console.error('❌ Error updating project ID:', error);
      Alert.alert('Error', 'Failed to update project ID. Please try again.');
    } finally {
      setIsUpdatingProjectId(false);
    }
  };

  // Open design page for current project
  const openDesignPage = () => {
    if (!openSolarProject) {
      console.log('❌ No OpenSolar project linked');
      return;
    }
    
    const designUrl = `https://app.opensolar.com/projects/${openSolarProject.id}/design`;
    console.log('🔗 Opening design URL:', designUrl);
    
    if (Platform.OS === 'web') {
      window.open(designUrl, '_blank');
    } else {
      Linking.openURL(designUrl);
    }
  };

  // Complete the OpenSolar step and navigate to next step
  const completeOpenSolarStep = async () => {
    // Prevent multiple calls
    if (isCompletingStep) {
      console.log('🔧 Step completion already in progress, ignoring duplicate call');
      return;
    }

    try {
      setIsCompletingStep(true);
      console.log('🔧 Starting OpenSolar step completion...');
      console.log('🔧 Opportunity ID:', opportunityId);
      console.log('🔧 OpenSolar Project:', openSolarProject);
      
      // Mark OpenSolar step (step 2) as completed
      const { workflowApi } = await import('../utils/api');
      const stepData = {
        opensolarProjectId: openSolarProject?.id,
        projectName: openSolarProject?.title || openSolarProject?.name,
        projectUrl: openSolarProject?.url,
        completedAt: new Date().toISOString(),
        isLinked: openSolarProject?.isLinked || false
      };
      
      console.log('🔧 Calling workflowApi.completeStep with data:', stepData);
      const result = await workflowApi.completeStep(opportunityId, 2, stepData);
      console.log('✅ OpenSolar step completed successfully:', result);
      
      // Verify the step was actually completed
      if (result && result.success) {
        console.log('🔍 OpenSolar step completed successfully, navigating to next step...');
        console.log('🔍 Navigation params:', { opportunityId });
        
        // Navigate directly to the next step without showing alert
        // This provides a smoother user experience
        navigation.navigate('CustomerDetails', {
          opportunityId,
          calculatorType: 'v44',
        });
        console.log('🔍 Navigation call completed');
      } else {
        console.error('❌ Step completion failed:', result);
        console.error('❌ Result details:', {
          success: result?.success,
          data: result?.data,
          error: result?.error
        });
        Alert.alert('Error', `Failed to complete OpenSolar step: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('❌ Error completing OpenSolar step:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response?.data
      });
      Alert.alert('Error', `Failed to complete OpenSolar step: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsCompletingStep(false);
    }
  };

  // Debug logging for render
  console.log('🔍 Render state:', {
    searchStep,
    openSolarProject: !!openSolarProject,
    openSolarProjectId: openSolarProject?.id,
    searchProjectsCount: searchProjects.length
  });

  // Render the simplified OpenSolar project management screen
  return (
    <View style={[
      styles.container, 
      { backgroundColor: theme.cardBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => {
                // Navigate directly to SolarWorkflowScreen instead of going back
                (navigation as any).navigate('SolarWorkflow', { 
                  opportunityId: opportunityId,
                  opportunity: opportunity
                });
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>{OPENSOLAR_LINK_SCREEN_TITLE}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {opportunity?.name || 'Solar Project'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={[
          styles.content,
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]} 
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS === 'web' && {
            minHeight: '100vh' as any,
            paddingBottom: 100,
          }
        ]}
        showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={Platform.OS !== 'web'}
        alwaysBounceVertical={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS !== 'web'}
      >
        {openSolarProject ? (
          // Project Linked Section - Show this when a project is linked
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                Project Successfully Linked!
              </Text>
            </View>
            
            <View style={[styles.projectInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Project ID:</Text>
              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                {openSolarProject.id}
              </Text>
              
              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Title:</Text>
              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                {openSolarProject.title || openSolarProject.name}
              </Text>
              
              {openSolarProject.isLinked && (
                <>
                  <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Status:</Text>
                  <Text style={[styles.infoValue, { color: theme.primaryButton }]}>
                    Manually Linked
                  </Text>
                </>
              )}
            </View>

            {/* Prominent Open Design Button */}
            <View style={[styles.designButtonContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              </View>
              <Text style={[styles.designButtonTitle, { color: theme.primaryText }]}>
                🎉 Project Successfully Linked!
              </Text>
              <Text style={[styles.designButtonSubtitle, { color: theme.secondaryText }]}>
                Your OpenSolar project is ready for design. Click below to open the design page and start creating your solar system layout.
              </Text>
              
              <TouchableOpacity
                style={[styles.designButton, { backgroundColor: theme.primaryButton }]}
                onPress={openDesignPage}
              >
                <Ionicons name="color-palette" size={24} color="#ffffff" />
                <Text style={styles.designButtonText}>
                  Open Design Page
                </Text>
              </TouchableOpacity>
              
              <Text style={[styles.designButtonNote, { color: theme.secondaryText }]}>
                This will open OpenSolar in a new tab where you can design your solar system
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primaryButton }]}
              onPress={() => setShowProjectIdUpdate(true)}
            >
              <Feather name="edit" size={20} color={theme.primaryButton} />
              <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>
                Update Project ID
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.cardBorder }]}
              onPress={() => setSearchStep('main')}
            >
              <Feather name="arrow-left" size={20} color={theme.primaryText} />
              <Text style={[styles.secondaryButtonText, { color: theme.primaryText }]}>
                Back to Options
              </Text>
            </TouchableOpacity>

            {/* Complete Step Button */}
            <TouchableOpacity
              style={[
                styles.completeButton, 
                { 
                  backgroundColor: (!openSolarProject || isCompletingStep) 
                    ? theme.secondaryText + '40' 
                    : theme.primaryButton 
                }
              ]}
              onPress={completeOpenSolarStep}
              disabled={!openSolarProject || isCompletingStep}
              activeOpacity={(!openSolarProject || isCompletingStep) ? 1 : 0.8}
            >
              {isCompletingStep ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="check-circle" size={16} color="#ffffff" />
              )}
              <Text style={styles.completeButtonText}>
                {isCompletingStep 
                  ? 'Completing...' 
                  : 'Complete Step'
                }
              </Text>
            </TouchableOpacity>
          </View>
        ) : searchStep === 'main' ? (
          // Main linking options — project ID first, then address
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="link" size={32} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                {OPENSOLAR_LINK_SCREEN_TITLE}
              </Text>
            </View>

            <View style={[styles.infoCallout, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
              <Text style={[styles.infoCalloutText, { color: '#1e40af' }]}>{OPENSOLAR_LINK_SCREEN_INTRO}</Text>
            </View>

            <View style={[styles.propertyFallbackCallout, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
              <Text style={styles.propertyFallbackCalloutTitle}>{PROPERTY_NOT_VISIBLE_CALLOUT_TITLE}</Text>
              {isTrainingOpportunity ? (
                <>
                  <Text style={[styles.propertyFallbackSectionIntro, { color: theme.secondaryText }]}>
                    {PROPERTY_NOT_VISIBLE_SECTION_INTRO}
                  </Text>
                  {PROPERTY_NOT_VISIBLE_STEPS.map((step, index) => (
                    <View key={step.title} style={styles.propertyFallbackStep}>
                      <Text style={[styles.propertyFallbackStepTitle, { color: theme.primaryText }]}>
                        {index + 1}. {step.title}
                      </Text>
                      <Text style={[styles.propertyFallbackStepDetail, { color: theme.secondaryText }]}>
                        {step.detail}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[styles.propertyFallbackShortHint, { color: theme.secondaryText }]}>
                  {PROPERTY_NOT_VISIBLE_SHORT_HINT}
                </Text>
              )}
            </View>

            <Text style={[styles.linkMethodTitle, { color: theme.primaryText }]}>Option 1 — Project ID (recommended)</Text>
            <Text style={[styles.linkMethodHint, { color: theme.secondaryText }]}>{OPENSOLAR_LINK_BY_ID_HINT}</Text>

            <TextInput
              style={[styles.projectIdInput, {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
                color: theme.primaryText,
              }]}
              placeholder="Enter OpenSolar project ID (e.g. 7910393)"
              placeholderTextColor={theme.secondaryText}
              value={manualProjectId}
              onChangeText={setManualProjectId}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: theme.primaryButton }]}
              onPress={linkToExistingProject}
              disabled={isLinkingProject}
            >
              {isLinkingProject ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="link" size={20} color="#ffffff" />
                  <Text style={styles.searchButtonText}>Link by Project ID</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.linkDivider}>
              <View style={[styles.linkDividerLine, { backgroundColor: theme.cardBorder }]} />
              <Text style={[styles.linkDividerText, { color: theme.secondaryText }]}>or</Text>
              <View style={[styles.linkDividerLine, { backgroundColor: theme.cardBorder }]} />
            </View>

            <Text style={[styles.linkMethodTitle, { color: theme.primaryText }]}>Option 2 — Property address</Text>
            <Text style={[styles.linkMethodHint, { color: theme.secondaryText }]}>{OPENSOLAR_LINK_BY_ADDRESS_HINT}</Text>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primaryButton }]}
              onPress={handleSearchProjects}
            >
              <Feather name="map-pin" size={20} color={theme.primaryButton} />
              <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>
                Link by Property Address
              </Text>
            </TouchableOpacity>
          </View>
        ) : searchStep === 'search' ? (
          // Search Projects Section
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="map-pin" size={32} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                Link by Property Address
              </Text>
            </View>
            
            <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
              {OPENSOLAR_LINK_BY_ADDRESS_HINT}
            </Text>

            <View style={styles.searchForm}>
              <TextInput
                style={[styles.searchInput, { 
                  backgroundColor: theme.cardBackground, 
                  borderColor: theme.cardBorder,
                  color: theme.primaryText 
                }]}
                placeholder="Enter the property address from OpenSolar..."
                placeholderTextColor={theme.secondaryText}
                value={searchAddress}
                onChangeText={setSearchAddress}
                multiline
                numberOfLines={3}
              />
              
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: theme.primaryButton }]}
                onPress={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="search" size={20} color="#ffffff" />
                    <Text style={styles.searchButtonText}>Find Matching Project</Text>
                  </>
                )}
              </TouchableOpacity>

              {searchError && (
                <View style={[styles.errorContainer, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.errorText, { color: '#dc2626' }]}>{searchError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.searchBackButton, { borderColor: theme.cardBorder }]}
                onPress={() => setSearchStep('main')}
              >
                <Feather name="arrow-left" size={20} color={theme.primaryText} />
                <Text style={[styles.searchBackButtonText, { color: theme.primaryText }]}>Back to Options</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : searchStep === 'select' ? (
          // Select Project Section
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="list" size={32} color={theme.primaryButton} />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                Select the Correct Design
              </Text>
            </View>
            
            <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]}>
              Found {searchProjects.length} project(s) for "{searchAddress}". Choose the design that matches this customer.
            </Text>
            
            {searchProjects.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={48} color="#94a3b8" />
                <Text style={[styles.noResultsText, { color: theme.primaryText }]}>No projects found</Text>
                <Text style={[styles.noResultsSubtext, { color: theme.secondaryText }]}>
                  {searchError && searchError.includes('rate limit') 
                    ? 'OpenSolar API is temporarily unavailable due to high usage. Please try again in a few minutes.'
                    : 'No projects were found for this address.'
                  }
                </Text>
                
                {!searchError || !searchError.includes('rate limit') ? (
                  <View style={styles.noResultsOptions}>
                    <TouchableOpacity
                      style={[styles.optionButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => setSearchStep('search')}
                    >
                      <Ionicons name="refresh" size={20} color="#ffffff" />
                      <Text style={styles.optionButtonText}>
                        Search Again
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.noResultsOptions}>
                    <TouchableOpacity
                      style={[styles.optionButton, { backgroundColor: theme.primaryButton }]}
                      onPress={() => {
                        setSearchError(null);
                        setSearchStep('search');
                      }}
                    >
                      <Ionicons name="refresh" size={20} color="#ffffff" />
                      <Text style={styles.optionButtonText}>
                        Try Again
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.projectsList}>
                {searchProjects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.projectItem, { 
                      backgroundColor: theme.cardBackground, 
                      borderColor: theme.cardBorder 
                    }]}
                    onPress={() => handleProjectSelect(project)}
                  >
                    <View style={styles.searchProjectInfo}>
                      <Text style={[styles.searchProjectName, { color: theme.primaryText }]}>
                        {project.display_name || project.name || `Project ${project.id}`}
                      </Text>
                      {project.address && (
                        <Text style={[styles.searchProjectAddress, { color: theme.secondaryText }]}>
                          {project.address}
                        </Text>
                      )}
                      <Text style={[styles.searchProjectId, { color: theme.secondaryText }]}>
                        Project ID: {project.id}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.searchBackButton, { borderColor: theme.cardBorder }]}
              onPress={() => setSearchStep('search')}
            >
              <Feather name="arrow-left" size={20} color={theme.primaryText} />
              <Text style={[styles.searchBackButtonText, { color: theme.primaryText }]}>Back to Search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Project Linked Section
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                Project Successfully Linked!
              </Text>
            </View>
            
            <View style={[styles.projectInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Project ID:</Text>
              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                {openSolarProject.id}
              </Text>
              
              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Title:</Text>
              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                {openSolarProject.title || openSolarProject.name}
              </Text>
              
              {openSolarProject.isLinked && (
                <>
                  <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>Status:</Text>
                  <Text style={[styles.infoValue, { color: theme.primaryButton }]}>
                    Manually Linked
                  </Text>
                </>
              )}
            </View>

            {/* Prominent Open Design Button */}
            <View style={[styles.designButtonContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              </View>
              <Text style={[styles.designButtonTitle, { color: theme.primaryText }]}>
                🎉 Project Successfully Linked!
              </Text>
              <Text style={[styles.designButtonSubtitle, { color: theme.secondaryText }]}>
                Your OpenSolar project is ready for design. Click below to open the design page and start creating your solar system layout.
              </Text>
              
              <TouchableOpacity
                style={[styles.designButton, { backgroundColor: theme.primaryButton }]}
                onPress={openDesignPage}
              >
                <Ionicons name="color-palette" size={24} color="#ffffff" />
                <Text style={styles.designButtonText}>
                  Open Design Page
                </Text>
              </TouchableOpacity>
              
              <Text style={[styles.designButtonNote, { color: theme.secondaryText }]}>
                This will open OpenSolar in a new tab where you can design your solar system
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.primaryButton }]}
              onPress={() => setShowProjectIdUpdate(true)}
            >
              <Feather name="edit" size={20} color={theme.primaryButton} />
              <Text style={[styles.secondaryButtonText, { color: theme.primaryButton }]}>
                Update Project ID
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.cardBorder }]}
              onPress={() => setSearchStep('main')}
            >
              <Feather name="arrow-left" size={20} color={theme.primaryText} />
              <Text style={[styles.secondaryButtonText, { color: theme.primaryText }]}>
                Back to Options
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Link Modal */}
        {showManualLink && (
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.modal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                Link to Existing Project
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                Enter the OpenSolar project ID to link to an existing project.
              </Text>
              
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.cardBackground, 
                  borderColor: theme.cardBorder,
                  color: theme.primaryText 
                }]}
                placeholder="Enter Project ID (e.g., 7910393)"
                placeholderTextColor={theme.secondaryText}
                value={manualProjectId}
                onChangeText={setManualProjectId}
                keyboardType="numeric"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { borderColor: theme.cardBorder }]}
                  onPress={() => setShowManualLink(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.secondaryText }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
                  onPress={linkToExistingProject}
                  disabled={isLinkingProject}
                >
                  {isLinkingProject ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>
                      Link Project
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Project ID Update Modal */}
        {showProjectIdUpdate && (
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.modal, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.primaryText }]}>
                Update Project ID
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                Enter the new OpenSolar project ID. This is useful when a project has been transferred to another account.
              </Text>
              
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.cardBackground, 
                  borderColor: theme.cardBorder,
                  color: theme.primaryText 
                }]}
                placeholder="Enter New Project ID (e.g., 7910393)"
                placeholderTextColor={theme.secondaryText}
                value={newProjectId}
                onChangeText={setNewProjectId}
                keyboardType="numeric"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                  onPress={() => {
                    setShowProjectIdUpdate(false);
                    setNewProjectId('');
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: theme.primaryText }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: theme.primaryButton }]}
                  onPress={handleUpdateProjectId}
                  disabled={isUpdatingProjectId}
                >
                  {isUpdatingProjectId ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>
                      Update Project ID
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    backgroundColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: width < 768 ? 12 : 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  projectInfo: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 12,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Search and project selection styles
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  infoCallout: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoCalloutText: {
    fontSize: 13,
    lineHeight: 19,
  },
  propertyFallbackCallout: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  propertyFallbackCalloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 6,
  },
  propertyFallbackSectionIntro: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  propertyFallbackShortHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  propertyFallbackStep: {
    marginTop: 8,
  },
  propertyFallbackStepTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  propertyFallbackStepDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    paddingLeft: 14,
  },
  linkMethodTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  linkMethodHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  projectIdInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
    marginBottom: 12,
  },
  linkDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  linkDividerLine: {
    flex: 1,
    height: 1,
  },
  linkDividerText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  searchForm: {
    gap: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  searchBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
  },
  searchBackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  noResultsOptions: {
    marginTop: 20,
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  projectsList: {
    gap: 12,
    marginBottom: 20,
  },
  projectItem: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchProjectInfo: {
    flex: 1,
  },
  searchProjectName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchProjectAddress: {
    fontSize: 14,
    marginBottom: 4,
  },
  searchProjectId: {
    fontSize: 12,
  },
  designButtonContainer: {
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  designButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  designButtonSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  designButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 12,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  designButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  designButtonNote: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
