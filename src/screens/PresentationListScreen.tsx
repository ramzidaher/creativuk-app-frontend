import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { presentationApi } from '../utils/api';

const { width, height } = Dimensions.get('window');

interface Proposal {
  filename: string;
  size: number;
  created: string;
  modified: string;
}

export default function PresentationListScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const result = await presentationApi.listPresentations();
      
      if (result.success) {
        setProposals(result.data);
      } else {
        throw new Error(result.error || 'Failed to load proposals');
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
      Alert.alert('Error', 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProposals();
    setRefreshing(false);
  };

  const downloadProposal = async (filename: string) => {
    try {
      const downloadUrl = await presentationApi.downloadPresentation(filename);
      const supported = await Linking.canOpenURL(downloadUrl);
      
      if (supported) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Error', 'Cannot download PowerPoint file');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const viewProposal = async (filename: string) => {
    try {
      const viewUrl = presentationApi.getViewUrl(filename);
      const supported = await Linking.canOpenURL(viewUrl);
      
      if (supported) {
        await Linking.openURL(viewUrl);
      } else {
        Alert.alert('Error', 'Cannot view proposal in browser');
      }
    } catch (error) {
      console.error('View error:', error);
        Alert.alert('Error', 'Failed to open proposal');
    }
  };

  const getProposalInfo = async (filename: string) => {
    try {
      const result = await presentationApi.getPresentationInfo(filename);
      
      if (result.success) {
        const info = result.data;
        Alert.alert(
          'Proposal Info',
          `File: ${info.filename}\nSize: ${(info.size / 1024).toFixed(2)} KB\nCreated: ${new Date(info.created).toLocaleString()}\nModified: ${new Date(info.modified).toLocaleString()}`,
          [
            { text: 'Download', onPress: () => downloadProposal(filename) },
            { text: 'View', onPress: () => viewProposal(filename) },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to get proposal info');
      }
    } catch (error) {
      console.error('Info error:', error);
      Alert.alert('Error', 'Failed to get proposal info');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading proposals...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
      {/* Background Image */}
      <Image
        source={require('../../assets/creativ.png')}
        style={styles.backgroundImageStyle}
        resizeMode="contain"
      />
      
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>
                Generated Proposals
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={onRefresh}
            >
              <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]} 
              onPress={toggleTheme}
            >
              <Feather 
                name={isDark ? "sun" : "moon"} 
                size={20} 
                color={theme.secondaryText} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={[
          styles.scrollView, 
          { backgroundColor: 'transparent' },
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
            <Feather name="file-text" size={32} color={theme.primaryButton} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Your Proposals</Text>
          <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
            All your generated PowerPoint proposals are listed below
          </Text>
        </View>

        {/* Proposals List */}
        {proposals.length === 0 ? (
          <View style={[styles.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.noFilesContainer}>
              <Feather name="file-text" size={48} color={theme.secondaryText} />
              <Text style={[styles.noFilesText, { color: theme.secondaryText }]}>
                No proposals found
              </Text>
              <Text style={[styles.noFilesSubtext, { color: theme.secondaryText }]}>
                Generate your first proposal to see it here
              </Text>
            </View>
          </View>
        ) : (
          proposals.map((proposal, index) => (
            <View key={index} style={[styles.proposalCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <View style={styles.proposalHeader}>
                <View style={styles.proposalIcon}>
                  <Feather name="file-text" size={24} color={theme.primaryButton} />
                </View>
                <View style={styles.proposalInfo}>
                  <Text style={[styles.proposalName, { color: theme.primaryText }]} numberOfLines={2}>
                    {proposal.filename}
                  </Text>
                  <Text style={[styles.proposalDetails, { color: theme.secondaryText }]}>
                    {(proposal.size / 1024).toFixed(2)} KB • {new Date(proposal.modified).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.infoButton, { backgroundColor: theme.primaryButton + '20' }]}
                  onPress={() => getProposalInfo(proposal.filename)}
                >
                  <Feather name="info" size={16} color={theme.primaryButton} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.proposalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton, { backgroundColor: theme.primaryButton + '20' }]}
                  onPress={() => viewProposal(proposal.filename)}
                >
                  <Feather name="eye" size={16} color={theme.primaryButton} />
                  <Text style={[styles.actionButtonText, { color: theme.primaryButton }]}>View</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.downloadButton, { backgroundColor: theme.primaryButton }]}
                  onPress={() => downloadProposal(proposal.filename)}
                >
                  <Feather name="download" size={16} color="#ffffff" />
                  <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Info Section */}
        <View style={[styles.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.infoHeader}>
            <Feather name="info" size={20} color={theme.primaryButton} />
            <Text style={[styles.infoTitle, { color: theme.primaryText }]}>About Proposals</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.secondaryText }]}>
            • All proposals are generated from your Excel calculator data{'\n'}
            • PowerPoint files maintain perfect formatting and can be opened in any compatible app{'\n'}
            • View proposals online or download them to your device{'\n'}
            • Files are automatically named with customer and opportunity information{'\n'}
            • Proposals include all customer details and solar system specifications
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  // Background Image
  backgroundImageStyle: {
    opacity: 0.15,
    resizeMode: 'contain',
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: [{ translateX: -250 }, { translateY: -200 }],
    width: 600,
    height: 600,
  },
  
  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  
  // Modern Header Styles
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
  headerRight: {
    flexDirection: 'row',
    gap: width < 768 ? 12 : 16,
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
  iconButton: {
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
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: -20,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTitle: {
    fontSize: width < 768 ? 24 : 28,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
  
  // Form Cards
  formCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  
  // Proposal Card
  proposalCard: {
    marginBottom: 16,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  proposalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  proposalInfo: {
    flex: 1,
  },
  proposalName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  proposalDetails: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  viewButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  downloadButton: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // No Files Container
  noFilesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noFilesText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noFilesSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Info Card
  infoCard: {
    marginBottom: 24,
    padding: width < 768 ? 20 : 24,
    borderRadius: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: -0.1,
  },
  infoText: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    fontWeight: '500',
  },
});

