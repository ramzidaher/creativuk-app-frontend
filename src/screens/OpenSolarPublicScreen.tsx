import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';

interface CreateProjectData {
  name: string;
  address: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

interface CreateDesignData {
  name: string;
  systemType: 'solar' | 'battery' | 'hybrid';
  panels: {
    model: string;
    count: number;
    watt_per_module: number;
    manufacturer: string;
  }[];
  arrays: {
    name: string;
    panel_count: number;
    panel_model: string;
    orientation: {
      tilt: number;
      azimuth: number;
      face: string;
    };
  }[];
  batteries: {
    manufacturer: string;
    model: string;
    capacity: number;
    voltage: number;
  }[];
  inverters: {
    manufacturer: string;
    model: string;
    type: 'solar' | 'battery' | 'hybrid';
    capacity: number;
  }[];
}

interface Template {
  name: string;
  description: string;
  systemType: 'solar' | 'battery' | 'hybrid';
  panels: any[];
  arrays: any[];
  batteries: any[];
  inverters: any[];
}

export default function OpenSolarPublicScreen() {
  const [step, setStep] = useState<'main' | 'create-project' | 'create-design' | 'templates' | 'loading' | 'success'>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Project form data
  const [projectData, setProjectData] = useState<CreateProjectData>({
    name: '',
    address: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
  });

  // Design form data
  const [designData, setDesignData] = useState<CreateDesignData>({
    name: '',
    systemType: 'solar',
    panels: [],
    arrays: [],
    batteries: [],
    inverters: [],
  });

  // Template data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);

  // Success data
  const [createdProject, setCreatedProject] = useState<any>(null);
  const [createdDesign, setCreatedDesign] = useState<any>(null);

  useEffect(() => {
    if (step === 'templates') {
      loadTemplates();
    }
  }, [step]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
              const response = await fetch(' /api/opensolar-public/templates');
      const data = await response.json();
      
      if (data.success) {
        setTemplates(Object.values(data.data));
      } else {
        setError('Failed to load templates');
      }
    } catch (error) {
      console.error('Template loading error:', error);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setStep('create-project');
  };

  const handleCreateDesign = () => {
    setStep('create-design');
  };

  const handleViewTemplates = () => {
    setStep('templates');
  };

  const handleBackToMain = () => {
    setStep('main');
    setError(null);
    setProjectData({
      name: '',
      address: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
    });
    setDesignData({
      name: '',
      systemType: 'solar',
      panels: [],
      arrays: [],
      batteries: [],
      inverters: [],
    });
  };

  const handleProjectSubmit = async () => {
    if (!projectData.name.trim() || !projectData.address.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
              const response = await fetch(' /api/opensolar-public/create-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      const data = await response.json();

      if (data.success) {
        setCreatedProject(data.data.project);
        setStep('success');
      } else {
        setError(data.message || 'Failed to create project');
      }
    } catch (error) {
      console.error('Project creation error:', error);
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleDesignSubmit = async () => {
    if (!designData.name.trim()) {
      Alert.alert('Error', 'Please enter a design name');
      return;
    }

    if (!createdProject) {
      setError('No project selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
              const response = await fetch(' /api/opensolar-public/create-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...designData,
          projectId: createdProject.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCreatedDesign(data.data.design);
        setStep('success');
      } else {
        setError(data.message || 'Failed to create design');
      }
    } catch (error) {
      console.error('Design creation error:', error);
      setError('Failed to create design');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWithTemplate = async () => {
    if (!selectedTemplate) {
      Alert.alert('Error', 'Please select a template');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create project first
              const projectResponse = await fetch(' /api/opensolar-public/create-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Template Project - ${selectedTemplate.name}`,
          address: 'Address to be updated',
          customer_name: 'Guest User',
          customer_email: 'guest@example.com',
          customer_phone: '',
        }),
      });

      const projectData = await projectResponse.json();

      if (!projectData.success) {
        throw new Error('Failed to create project');
      }

      // Create design with template data
              const designResponse = await fetch(' /api/opensolar-public/create-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectData.data.project.id,
          name: selectedTemplate.name,
          systemType: selectedTemplate.systemType,
          panels: selectedTemplate.panels,
          arrays: selectedTemplate.arrays,
          batteries: selectedTemplate.batteries,
          inverters: selectedTemplate.inverters,
        }),
      });

      const designData = await designResponse.json();

      if (designData.success) {
        setCreatedProject(projectData.data.project);
        setCreatedDesign(designData.data.design);
        setStep('success');
      } else {
        throw new Error('Failed to create design');
      }
    } catch (error: any) {
      console.error('Template creation error:', error);
      setError(error.message || 'Failed to create project with template');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInOpenSolar = () => {
    if (createdProject && createdDesign) {
      Linking.openURL(`https://app.opensolar.com/projects/${createdProject.id}/systems/${createdDesign.id}`);
    } else if (createdProject) {
      Linking.openURL(`https://app.opensolar.com/projects/${createdProject.id}`);
    }
  };

  const handleOpenDesign = () => {
    if (createdProject) {
      // Open the design page directly
      Linking.openURL(`https://app.opensolar.com/projects/${createdProject.id}/design`);
    }
  };

  const renderMainScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sunny" size={48} color="#FF6B35" />
        <Text style={styles.title}>OpenSolar Integration</Text>
        <Text style={styles.subtitle}>Create solar projects and designs without signing in</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleCreateProject}>
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.buttonText}>Create New Project</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleCreateDesign}>
          <Ionicons name="color-palette" size={24} color="white" />
          <Text style={styles.buttonText}>Create New Design</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleViewTemplates}>
          <Ionicons name="library" size={24} color="white" />
          <Text style={styles.buttonText}>Use Templates</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          💡 All projects and designs are created using our OpenSolar account and can be viewed and edited in the OpenSolar app.
        </Text>
      </View>
    </View>
  );

  const renderCreateProjectScreen = () => (
    <ScrollView 
      style={[
        styles.container,
        Platform.OS === 'web' && {
          height: '100%',
          maxHeight: '100%',
        }
      ]}
      contentContainerStyle={[
        { paddingBottom: 40 },
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMain}>
          <Ionicons name="arrow-back" size={24} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Project</Text>
        <Text style={styles.subtitle}>Enter project details</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            value={projectData.name}
            onChangeText={(text) => setProjectData({ ...projectData, name: text })}
            placeholder="e.g., Residential Solar Installation"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={projectData.address}
            onChangeText={(text) => setProjectData({ ...projectData, address: text })}
            placeholder="e.g., 123 Main St, City, State"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Customer Name</Text>
          <TextInput
            style={styles.input}
            value={projectData.customer_name}
            onChangeText={(text) => setProjectData({ ...projectData, customer_name: text })}
            placeholder="Customer name (optional)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Customer Email</Text>
          <TextInput
            style={styles.input}
            value={projectData.customer_email}
            onChangeText={(text) => setProjectData({ ...projectData, customer_email: text })}
            placeholder="customer@email.com (optional)"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Customer Phone</Text>
          <TextInput
            style={styles.input}
            value={projectData.customer_phone}
            onChangeText={(text) => setProjectData({ ...projectData, customer_phone: text })}
            placeholder="Phone number (optional)"
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.submitButton]} 
          onPress={handleProjectSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.buttonText}>Create Project</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderCreateDesignScreen = () => (
    <ScrollView 
      style={[
        styles.container,
        Platform.OS === 'web' && {
          height: '100%',
          maxHeight: '100%',
        }
      ]}
      contentContainerStyle={[
        { paddingBottom: 40 },
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMain}>
          <Ionicons name="arrow-back" size={24} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Design</Text>
        <Text style={styles.subtitle}>Design a solar system</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Design Name *</Text>
          <TextInput
            style={styles.input}
            value={designData.name}
            onChangeText={(text) => setDesignData({ ...designData, name: text })}
            placeholder="e.g., Main Solar Array"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>System Type</Text>
          <View style={styles.radioContainer}>
            {(['solar', 'battery', 'hybrid'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.radioButton,
                  designData.systemType === type && styles.radioButtonSelected
                ]}
                onPress={() => setDesignData({ ...designData, systemType: type })}
              >
                <Text style={[
                  styles.radioButtonText,
                  designData.systemType === type && styles.radioButtonTextSelected
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Panels</Text>
          <TextInput
            style={styles.input}
            placeholder="Panel model (e.g., Jinko JKM400M-72HL4-V)"
            onChangeText={(text) => {
              const panels = [{ model: text, count: 20, watt_per_module: 400, manufacturer: 'Jinko' }];
              setDesignData({ ...designData, panels });
            }}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.submitButton]} 
          onPress={handleDesignSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.buttonText}>Create Design</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderTemplatesScreen = () => (
    <ScrollView 
      style={[
        styles.container,
        Platform.OS === 'web' && {
          height: '100%',
          maxHeight: '100%',
        }
      ]}
      contentContainerStyle={[
        { paddingBottom: 40 },
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMain}>
          <Ionicons name="arrow-back" size={24} color="#FF6B35" />
        </TouchableOpacity>
        <Text style={styles.title}>Solar Templates</Text>
        <Text style={styles.subtitle}>Quick start with pre-configured systems</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Use Template</Text>
          <Switch
            value={useTemplate}
            onValueChange={setUseTemplate}
            trackColor={{ false: '#767577', true: '#FF6B35' }}
            thumbColor={useTemplate ? '#fff' : '#f4f3f4'}
          />
        </View>

        {useTemplate && (
          <View style={styles.templateContainer}>
            {templates.map((template, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.templateCard,
                  selectedTemplate === template && styles.templateCardSelected
                ]}
                onPress={() => setSelectedTemplate(template)}
              >
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
                <Text style={styles.templateType}>Type: {template.systemType}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {useTemplate && selectedTemplate && (
          <TouchableOpacity 
            style={[styles.button, styles.submitButton]} 
            onPress={handleCreateWithTemplate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="rocket" size={24} color="white" />
                <Text style={styles.buttonText}>Create with Template</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderSuccessScreen = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.title}>Success!</Text>
        <Text style={styles.subtitle}>Your OpenSolar project has been created</Text>
      </View>

      <View style={styles.successContainer}>
        {createdProject && (
          <View style={styles.successItem}>
            <Text style={styles.successLabel}>Project ID:</Text>
            <Text style={styles.successValue}>{createdProject.id}</Text>
            <Text style={styles.successLabel}>Project Name:</Text>
            <Text style={styles.successValue}>{createdProject.name}</Text>
          </View>
        )}

        {createdDesign && (
          <View style={styles.successItem}>
            <Text style={styles.successLabel}>Design ID:</Text>
            <Text style={styles.successValue}>{createdDesign.id}</Text>
            <Text style={styles.successLabel}>Design Name:</Text>
            <Text style={styles.successValue}>{createdDesign.name}</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleOpenDesign}>
            <Ionicons name="color-palette" size={24} color="white" />
            <Text style={styles.buttonText}>Open Design</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleViewInOpenSolar}>
            <Ionicons name="open-outline" size={24} color="#FF6B35" />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>View in OpenSolar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleBackToMain}>
            <Ionicons name="home" size={24} color="#FF6B35" />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Another</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            🎉 Your project is ready! Click "Open Design" to start designing your solar system in OpenSolar.
          </Text>
        </View>
      </View>
    </View>
  );

  if (error) {
    Alert.alert('Error', error, [
      { text: 'OK', onPress: () => setError(null) }
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {step === 'main' && renderMainScreen()}
      {step === 'create-project' && renderCreateProjectScreen()}
      {step === 'create-design' && renderCreateDesignScreen()}
      {step === 'templates' && renderTemplatesScreen()}
      {step === 'success' && renderSuccessScreen()}
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 30,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 20,
    gap: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  submitButton: {
    marginTop: 20,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#FF6B35',
  },
  infoContainer: {
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  radioContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  radioButtonSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  radioButtonText: {
    color: '#666',
    fontSize: 14,
  },
  radioButtonTextSelected: {
    color: 'white',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  templateContainer: {
    gap: 15,
    marginBottom: 20,
  },
  templateCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  templateCardSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3F0',
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  templateType: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  successContainer: {
    padding: 20,
    alignItems: 'center',
    flex: 1,
  },
  successItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  successLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  successValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
});

