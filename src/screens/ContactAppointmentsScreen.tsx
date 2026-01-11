import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { opportunitiesApi, api } from '../utils/api';

interface ContactAppointmentsResponse {
  contactId: string;
  appointments: any[];
  appointmentCount: number;
  hasAppointments: boolean;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export default function ContactAppointmentsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const [data, setData] = useState<ContactAppointmentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactId, setContactId] = useState('1tgZIsLJ9WsueSNUQLKh'); // Default contact ID
  const [isCreatingContract, setIsCreatingContract] = useState(false);

  const fetchContactAppointments = async () => {
    if (!contactId.trim()) {
      Alert.alert('Error', 'Please enter a contact ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Contact Appointments: Fetching appointments for contact:', contactId);

      if (!isAuthenticated) {
        console.log('Contact Appointments: User not authenticated, skipping API call');
        setLoading(false);
        return;
      }

      const response = await opportunitiesApi.getContactAppointments(contactId);
      console.log('Contact Appointments: API response received:', response);

      if (response.success && response.data) {
        setData(response.data);
        console.log('Contact Appointments: Loaded appointments successfully');
      } else {
        console.error('Contact Appointments: API failed:', response.error);
        setError(response.error || 'Failed to load contact appointments');
        Alert.alert('Error', response.error || 'Failed to load contact appointments');
      }
    } catch (error) {
      console.error('Contact Appointments: Fetch error:', error);
      setError('Failed to load contact appointments');
      Alert.alert('Error', 'Failed to load contact appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocuSealContract = async () => {
    if (!contactId.trim()) {
      Alert.alert('Error', 'Please enter a contact ID first');
      return;
    }

    setIsCreatingContract(true);
    try {
      console.log('🔍 Creating DocuSeal contract for contact:', contactId);
      
      // Create DocuSeal contract signing workflow
      const contractResponse = await api.post('/contracts/create-signing-workflow', {
        opportunityId: `contact-${contactId}`, // Use contact ID as opportunity ID
        customerName: data?.user?.name || 'Contact Customer',
        customerEmail: 'contact@example.com',
        date: new Date().toISOString().split('T')[0],
        postcode: '12345',
        contractType: 'appointment_contract',
        solarData: {
          systemSize: '10kW',
          estimatedSavings: '$2,500/year',
          paybackPeriod: '7 years'
        }
      });

      if (contractResponse.data.success) {
        console.log('🔍 DocuSeal contract created:', contractResponse.data.data);
        
        // Navigate to DocuSeal signing screen
        navigation.navigate('DocuSealSigning', {
          submissionId: contractResponse.data.data.submissionId,
          signingUrl: contractResponse.data.data.signingUrl,
          opportunityId: `contact-${contactId}`,
          customerName: data?.user?.name || 'Contact Customer',
        });
      } else {
        throw new Error(contractResponse.data.error || 'Failed to create DocuSeal contract');
      }
    } catch (error) {
      console.error('🔍 Error creating DocuSeal contract:', error);
      Alert.alert('Error', 'Failed to create DocuSeal contract. Please try again.');
    } finally {
      setIsCreatingContract(false);
    }
  };

  const renderSummary = () => {
    if (!data) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📊 Summary</Text>
        <View style={[styles.summaryContainer, { backgroundColor: theme.tertiaryBackground }]}>
          <Text style={[styles.summaryText, { color: theme.primaryText }]}>Contact ID: {data.contactId}</Text>
          <Text style={[styles.summaryText, { color: theme.primaryText }]}>Appointment Count: {data.appointmentCount}</Text>
          <Text style={[styles.summaryText, { color: theme.primaryText }]}>Has Appointments: {data.hasAppointments ? 'Yes' : 'No'}</Text>
          <Text style={[styles.summaryText, { color: theme.primaryText }]}>User: {data.user.name} ({data.user.role})</Text>
        </View>
        
        {/* DocuSeal Contract Section */}
        <View style={[styles.docusealSection, { backgroundColor: theme.primaryButton + '10', borderColor: theme.primaryButton + '30' }]}>
          <View style={styles.docusealHeader}>
            <Ionicons name="document-text" size={24} color={theme.primaryButton} />
            <Text style={[styles.docusealTitle, { color: theme.primaryButton }]}>DocuSeal Contract</Text>
          </View>
          <Text style={[styles.docusealDescription, { color: theme.secondaryText }]}>
            Create a professional contract for this contact using DocuSeal
          </Text>
          <TouchableOpacity 
            style={[styles.docusealButton, { backgroundColor: theme.primaryButton }]}
            onPress={handleCreateDocuSealContract}
            disabled={isCreatingContract}
          >
            {isCreatingContract ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#ffffff" />
            )}
            <Text style={styles.docusealButtonText}>
              {isCreatingContract ? 'Creating Contract...' : 'Create DocuSeal Contract'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAppointments = () => {
    if (!data?.appointments || data.appointments.length === 0) {
      return (
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📅 Appointments</Text>
          <Text style={[styles.noDataText, { color: theme.secondaryText }]}>No appointments found for this contact</Text>
        </View>
      );
    }

    return (
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>📅 Appointments ({data.appointments.length})</Text>
        {data.appointments.map((appointment, index) => (
          <View key={appointment.id || index} style={[styles.appointmentItem, { backgroundColor: theme.tertiaryBackground }]}>
            <Text style={[styles.appointmentTitle, { color: theme.primaryText }]}>
              {index + 1}. {appointment.title || 'No Title'}
            </Text>
            <Text style={[styles.appointmentDetails, { color: theme.secondaryText }]}>
              ID: {appointment.id || 'N/A'}
            </Text>
            <Text style={[styles.appointmentDetails, { color: theme.secondaryText }]}>
              Status: {appointment.status || appointment.appoinmentStatus || 'N/A'}
            </Text>
            <Text style={[styles.appointmentDetails, { color: theme.secondaryText }]}>
              Date: {appointment.startTime || appointment.start_time || 'N/A'}
            </Text>
            {appointment.location && (
              <Text style={[styles.appointmentDetails, { color: theme.secondaryText }]}>
                Location: {appointment.location}
              </Text>
            )}
            {appointment.notes && (
              <Text style={[styles.appointmentDetails, { color: theme.secondaryText }]}>
                Notes: {appointment.notes}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderRawData = () => {
    if (!data) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>🔍 Raw JSON Data</Text>
        <ScrollView style={[styles.rawDataContainer, { backgroundColor: theme.tertiaryBackground }]}>
          <Text style={[styles.rawDataText, { color: theme.primaryText }]}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView 
      style={[
        styles.container,
        { backgroundColor: theme.primaryBackground },
        Platform.OS === 'web' && {
          height: '100vh' as any,
          maxHeight: '100vh' as any,
          overflow: 'hidden',
        }
      ]}
      showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
      nestedScrollEnabled={true}
      scrollEnabled={true}
      bounces={Platform.OS !== 'web'}
      alwaysBounceVertical={Platform.OS !== 'web'}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={Platform.OS !== 'web'}
      contentContainerStyle={[
        { paddingBottom: 40 },
        Platform.OS === 'web' && {
          minHeight: '100vh' as any,
          paddingBottom: 100,
        }
      ]}
    >
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: theme.primaryButton }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.primaryText }]}>Contact Appointments</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchContactAppointments}>
          <Ionicons name="refresh" size={20} color={theme.primaryButton} />
        </TouchableOpacity>
      </View>

      <View style={[styles.inputSection, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
        <Text style={[styles.inputLabel, { color: theme.primaryText }]}>Contact ID:</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.tertiaryBackground, borderColor: theme.borderColor, color: theme.primaryText }]}
          value={contactId}
          onChangeText={setContactId}
          placeholder="Enter contact ID"
          placeholderTextColor={theme.secondaryText}
        />
        <TouchableOpacity style={[styles.fetchButton, { backgroundColor: theme.primaryButton }]} onPress={fetchContactAppointments}>
          <Text style={styles.fetchButtonText}>Fetch Appointments</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.primaryText }]}>Loading appointments...</Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.errorText, { color: theme.errorColor || '#ff3b30' }]}>Error: {error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primaryButton }]} onPress={fetchContactAppointments}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && data && (
        <>
          {renderSummary()}
          {renderAppointments()}
          {renderRawData()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  inputSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      marginBottom: 20, // Extra spacing for web scrolling
      minHeight: 120, // Ensure input section has minimum height
    }),
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  fetchButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fetchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 20,
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
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      marginBottom: 20, // Extra spacing between sections on web
      minHeight: 100, // Ensure sections have minimum height
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  appointmentItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    ...(Platform.OS === 'web' && {
      marginBottom: 12, // Extra spacing between appointment items on web
      minHeight: 80, // Ensure appointment items have minimum height
    }),
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  appointmentDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  rawDataContainer: {
    maxHeight: 300,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  rawDataText: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
  },
  docusealSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  docusealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  docusealTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  docusealDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  docusealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  docusealButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 