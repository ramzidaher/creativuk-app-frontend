import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminGuard from '../components/AdminGuard';
import { useTheme } from '../context/ThemeContext';
import { adminOpportunityDetailsApi, opportunitiesApi } from '../utils/api';

const { width } = Dimensions.get('window');

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: any;
  nested?: boolean;
}> = ({ title, isOpen, onToggle, children, theme, nested = false }) => {
  return (
    <View style={[
      styles.collapsibleSection, 
      { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
      nested && { marginLeft: 16, marginTop: 8 }
    ]}>
      <TouchableOpacity
        style={[styles.collapsibleHeader, { borderBottomColor: theme.cardBorder }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.collapsibleTitle, { color: theme.primaryText, fontSize: nested ? 16 : 18 }]}>
          {title}
        </Text>
        <Feather 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={nested ? 18 : 20} 
          color={theme.primaryText} 
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.collapsibleContent}>
          {children}
        </View>
      )}
    </View>
  );
};

// Nested Collapsible for complex objects
const NestedCollapsible: React.FC<{
  title: string;
  data: any;
  theme: any;
  level?: number;
  expandedState: Record<string, boolean>;
  onToggle: (key: string) => void;
  parentKey?: string;
}> = ({ title, data, theme, level = 0, expandedState, onToggle, parentKey = '' }) => {
  const fullKey = parentKey ? `${parentKey}.${title}` : title;
  const isOpen = expandedState[fullKey] || false;
  
  if (!data || (typeof data !== 'object' && !Array.isArray(data))) {
    return (
      <View style={[styles.infoRow, { borderBottomColor: theme.cardBorder, marginLeft: level * 16 }]}>
        <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>{title}</Text>
        <Text style={[styles.infoValue, { color: theme.primaryText }]}>
          {data === null || data === undefined ? 'Not set' : String(data)}
        </Text>
      </View>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    
    return (
      <CollapsibleSection
        title={`${title} (${data.length})`}
        isOpen={isOpen}
        onToggle={() => onToggle(fullKey)}
        theme={theme}
        nested={level > 0}
      >
        <View style={{ padding: 12 }}>
          {data.map((item, index) => (
            <View key={index} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: index < data.length - 1 ? 1 : 0, borderBottomColor: theme.cardBorder }}>
              {typeof item === 'object' && item !== null ? (
                <NestedCollapsible
                  title={`Item ${index + 1}`}
                  data={item}
                  theme={theme}
                  level={level + 1}
                  expandedState={expandedState}
                  onToggle={onToggle}
                  parentKey={fullKey}
                />
              ) : (
                <Text style={[styles.infoValue, { color: theme.primaryText }]}>{String(item)}</Text>
              )}
            </View>
          ))}
        </View>
      </CollapsibleSection>
    );
  }

  // It's an object
  const keys = Object.keys(data).filter(key => {
    // Hide internal IDs except opportunity ID
    if (key.toLowerCase().includes('id') && !key.toLowerCase().includes('opportunity')) return false;
    // Show all other fields, even if they're null/undefined (we'll handle that in display)
    return true;
  });

  // Filter out only truly empty objects
  const validKeys = keys.filter(key => {
    const value = data[key];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
    return true;
  });

  if (validKeys.length === 0) return null;

  return (
    <CollapsibleSection
      title={title}
      isOpen={isOpen}
      onToggle={() => onToggle(fullKey)}
      theme={theme}
      nested={level > 0}
    >
      <View style={{ padding: 12 }}>
        {validKeys.map((key) => {
          const value = data[key];
          const formattedKey = formatFieldName(key);
          if (!formattedKey) return null;

          // Handle arrays
          if (Array.isArray(value)) {
            if (value.length === 0) return null;
            return (
              <NestedCollapsible
                key={key}
                title={formattedKey}
                data={value}
                theme={theme}
                level={level + 1}
                expandedState={expandedState}
                onToggle={onToggle}
                parentKey={fullKey}
              />
            );
          }

          // Handle nested objects
          if (typeof value === 'object' && value !== null) {
            return (
              <NestedCollapsible
                key={key}
                title={formattedKey}
                data={value}
                theme={theme}
                level={level + 1}
                expandedState={expandedState}
                onToggle={onToggle}
                parentKey={fullKey}
              />
            );
          }

          // Handle simple values
          return (
            <View key={key} style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>{formattedKey}</Text>
              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                {value === null || value === undefined ? 'Not set' : String(value)}
              </Text>
            </View>
          );
        })}
      </View>
    </CollapsibleSection>
  );
};

// Helper function to format field names
const formatFieldName = (key: string): string => {
  // Hide IDs except opportunity ID
  if (key.toLowerCase().includes('id') && !key.toLowerCase().includes('opportunity')) {
    return null; // Don't show internal IDs
  }
  
  // Format field names
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Reuse the renderFormattedCalculatorData function from StatisticsAnalyticsScreen
const renderFormattedCalculatorData = (calcData: any, theme: any, hideIds: boolean = true) => {
  if (!calcData) return null;

  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <Text style={[styles.detailValue, { color: theme.secondaryText, fontStyle: 'italic' }]}>Not set</Text>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (
        <View style={{ marginLeft: depth * 16, marginTop: 8 }}>
          {value.map((item, index) => (
            <View key={index} style={{ marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: theme.cardBorder }}>
              {renderValue(item, depth + 1)}
            </View>
          ))}
        </View>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value).filter(key => {
        if (hideIds && key.toLowerCase().includes('id') && !key.toLowerCase().includes('opportunity')) {
          return false; // Hide internal IDs
        }
        return value[key] !== null && value[key] !== undefined;
      });
      
      if (keys.length === 0) return null;
      
      return (
        <View style={{ marginLeft: depth * 16, marginTop: 8 }}>
          {keys.map((key) => {
            const formattedKey = formatFieldName(key);
            if (!formattedKey) return null; // Skip hidden fields
            
            return (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
                  {formattedKey}:
                </Text>
                {renderValue(value[key], depth + 1)}
              </View>
            );
          })}
        </View>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <Text style={[styles.detailValue, { color: value ? theme.successButton : theme.secondaryText }]}>
          {value ? 'Yes' : 'No'}
        </Text>
      );
    }

    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return (
            <Text style={[styles.detailValue, { color: theme.primaryText }]}>
              {date.toLocaleString()}
            </Text>
          );
        }
      } catch (e) {
        // Not a valid date, continue as string
      }
    }

    return (
      <Text style={[styles.detailValue, { color: theme.primaryText }]}>
        {String(value)}
      </Text>
    );
  };

  const excludeFields = ['_reactInternalInstance', '_owner', '$$typeof', '__typename'];
  const filteredData = Object.keys(calcData)
    .filter(key => {
      if (excludeFields.includes(key)) return false;
      if (hideIds && key.toLowerCase().includes('id') && !key.toLowerCase().includes('opportunity')) return false;
      return calcData[key] !== null && calcData[key] !== undefined;
    })
    .reduce((obj: any, key) => {
      obj[key] = calcData[key];
      return obj;
    }, {});

  return (
    <View>
      {Object.keys(filteredData).map((key) => {
        const formattedKey = formatFieldName(key);
        if (!formattedKey) return null;
        
        const value = filteredData[key];
        if (value === null || value === undefined || 
            (typeof value === 'object' && Object.keys(value).length === 0)) {
          return null;
        }

        return (
          <View key={key} style={{ marginBottom: 16 }}>
            <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>
              {formattedKey}:
            </Text>
            {renderValue(value)}
          </View>
        );
      })}
    </View>
  );
};

const AdminOpportunityDetailsScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const opportunityId = route.params?.opportunityId;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [opportunityDetails, setOpportunityDetails] = useState<any | null>(null);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    opportunity: true,
    user: false,
    survey: false,
    calculator: false,
    openSolar: false,
    files: false,
    solarProjection: false,
  });
  
  // Nested sections state (for complex nested data)
  const [expandedNested, setExpandedNested] = useState<Record<string, boolean>>({});
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
  
  const toggleNested = (key: string) => {
    setExpandedNested(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (opportunityId) {
      loadOpportunityDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  const loadOpportunityDetails = async () => {
    try {
      setLoading(true);
      const response = await adminOpportunityDetailsApi.getOpportunityDetails(opportunityId);
      
      console.log('📋 Full response from getOpportunityDetails:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        const data = response.data?.data || response.data;
        console.log('📋 Processed opportunity details:', JSON.stringify(data, null, 2));
        
        // Use the data directly from the admin endpoint - no fallback fetching
        setOpportunityDetails(data);
      } else {
        console.error('❌ Failed to load opportunity details:', response.error);
        if (!response.error?.includes('404')) {
          Alert.alert('Error', response.error || 'Failed to load opportunity details');
        } else {
          Alert.alert(
            'Endpoint Not Available',
            'The admin opportunity details endpoint is not yet deployed. Please contact the backend team.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Error loading opportunity details:', error);
      Alert.alert('Error', 'Failed to load opportunity details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOpportunityDetails();
    setRefreshing(false);
  };

  const isManualOpportunity =
    opportunityDetails?.opportunity?.source === 'MANUAL' || opportunityDetails?.source === 'MANUAL';

  const handleDelete = () => {
    if (!opportunityId || !isManualOpportunity) return;

    const manualId =
      opportunityDetails?.opportunity?.id ||
      opportunityDetails?.id ||
      opportunityId;

    const doDelete = async () => {
      setDeleting(true);
      try {
        const response = await opportunitiesApi.deleteManualOpportunity(manualId);
        if (response.success) {
          if (navigation.canGoBack?.()) navigation.goBack();
          else navigation.navigate('OpportunityManagement');
          Alert.alert('Deleted', 'Manual opportunity has been deleted.', [{ text: 'OK' }]);
        } else {
          setDeleting(false);
          Alert.alert('Error', response.error || 'Failed to delete opportunity');
        }
      } catch (e) {
        setDeleting(false);
        Alert.alert('Error', (e as Error)?.message || 'Failed to delete opportunity');
      }
    };

    // Alert confirmations can be unreliable on web; use window.confirm there.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm('Delete this manual opportunity? This cannot be undone.');
      if (ok) void doDelete();
      return;
    }

    Alert.alert('Delete manual opportunity', 'Are you sure you want to delete this manual opportunity? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primaryBackground }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primaryButton} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            Loading opportunity details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminGuard>
      <SafeAreaView 
        style={[
          styles.container, 
          { backgroundColor: theme.primaryBackground },
          Platform.OS === 'web' && {
            height: '100vh',
            maxHeight: '100vh',
          }
        ]}
      >
        <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
          <View style={[styles.headerTop, { justifyContent: 'space-between' }]}>
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.borderColor }]}
              onPress={() => {
                if (navigation.canGoBack?.()) navigation.goBack();
                else navigation.navigate('MainTabs', { screen: 'Profile' });
              }}
            >
              <Feather name="arrow-left" size={24} color={theme.primaryText} />
            </TouchableOpacity>
            {isManualOpportunity && (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.primaryButton }]}
                  onPress={() => {
                    const manualId =
                      opportunityDetails?.opportunity?.id ||
                      opportunityDetails?.id ||
                      opportunityId;
                    navigation.navigate('EditManualOpportunity', { opportunityId: manualId });
                  }}
                >
                  <Feather name="edit-2" size={18} color="#fff" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: theme.dangerButton }]}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="trash-2" size={18} color="#fff" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.primaryText }]}>Opportunity Details</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              {isManualOpportunity ? 'Manual opportunity (admin)' : 'Complete opportunity information'}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primaryButton} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {opportunityDetails ? (
            <View style={styles.dataSection}>
              {/* Assigned to (prominent) */}
              {(() => {
                const opp = opportunityDetails.opportunity || opportunityDetails;
                const assignedName =
                  opp?.owner?.name ||
                  opp?.owner?.username ||
                  opp?.assignedToName ||
                  opp?.user?.name ||
                  opp?.user?.username;
                const assignedId = opp?.userId || opp?.owner?.id;
                if (!assignedName && !assignedId) return null;
                return (
                  <View style={[styles.assignedToCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                    <Feather name="user" size={18} color={theme.primaryButton} />
                    <Text style={[styles.assignedToLabel, { color: theme.secondaryText }]}>Assigned to</Text>
                    <Text style={[styles.assignedToValue, { color: theme.primaryText }]}>
                      {assignedName || '—'}
                    </Text>
                  </View>
                );
              })()}

              {/* Opportunity Information */}
              {opportunityDetails.opportunity && (
                <CollapsibleSection
                  title="Opportunity Information"
                  isOpen={expandedSections.opportunity}
                  onToggle={() => toggleSection('opportunity')}
                  theme={theme}
                >
                  <View style={{ padding: 16 }}>
                    {/* Show ALL opportunity data with nested collapsibles */}
                    {(() => {
                      const opp = opportunityDetails.opportunity;
                      const keys = Object.keys(opp).filter(key => {
                        // Always show opportunity ID
                        if (key.toLowerCase().includes('opportunity') && key.toLowerCase().includes('id')) return true;
                        // Hide other internal IDs
                        if (key.toLowerCase().includes('id') && !key.toLowerCase().includes('opportunity')) return false;
                        return opp[key] !== null && opp[key] !== undefined;
                      });

                      return keys.map((key) => {
                        const value = opp[key];
                        const formattedKey = formatFieldName(key);
                        if (!formattedKey) return null;

                        // Handle simple values
                        if (typeof value !== 'object' || value === null || (Array.isArray(value) && value.length === 0)) {
                          return (
                            <View key={key} style={[styles.infoRow, { borderBottomColor: theme.cardBorder }]}>
                              <Text style={[styles.infoLabel, { color: theme.secondaryText }]}>{formattedKey}</Text>
                              <Text style={[styles.infoValue, { color: theme.primaryText }]}>
                                {value === null || value === undefined ? 'Not set' : String(value)}
                              </Text>
                            </View>
                          );
                        }

                        // Handle complex objects and arrays with nested collapsibles
                        return (
                          <View key={key} style={{ marginBottom: 8 }}>
                            <NestedCollapsible
                              title={formattedKey}
                              data={value}
                              theme={theme}
                              level={0}
                              expandedState={expandedNested}
                              onToggle={toggleNested}
                              parentKey="opportunity"
                            />
                          </View>
                        );
                      });
                    })()}
                  </View>
                </CollapsibleSection>
              )}

              {/* User Information */}
              {opportunityDetails.opportunity?.user && (
                <CollapsibleSection
                  title="User Information"
                  isOpen={expandedSections.user}
                  onToggle={() => toggleSection('user')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    <NestedCollapsible
                      title="User Details"
                      data={opportunityDetails.opportunity.user}
                      theme={theme}
                      level={0}
                      expandedState={expandedNested}
                      onToggle={toggleNested}
                      parentKey="user"
                    />
                  </View>
                </CollapsibleSection>
              )}

              {/* Survey Data */}
              {opportunityDetails.survey && (
                <CollapsibleSection
                  title="Survey Data"
                  isOpen={expandedSections.survey}
                  onToggle={() => toggleSection('survey')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    {opportunityDetails.survey.data && (
                      <NestedCollapsible
                        title="Survey Details"
                        data={opportunityDetails.survey.data}
                        theme={theme}
                        level={0}
                        expandedState={expandedNested}
                        onToggle={toggleNested}
                        parentKey="survey"
                      />
                    )}
                    {opportunityDetails.survey.images && Array.isArray(opportunityDetails.survey.images) && opportunityDetails.survey.images.length > 0 && (
                      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
                        <Text style={[styles.detailLabel, { color: theme.secondaryText, marginBottom: 8 }]}>Survey Images</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {opportunityDetails.survey.images.map((image: any, imgIndex: number) => (
                            <View key={imgIndex} style={{ marginBottom: 8 }}>
                              <Image
                                source={{ uri: image.url }}
                                style={{ width: 150, height: 150, borderRadius: 8 }}
                                resizeMode="cover"
                              />
                              <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: 10, marginTop: 4 }]}>
                                {image.fieldName || image.fileName}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </CollapsibleSection>
              )}

              {/* Calculator Data */}
              {opportunityDetails.calculator && (
                <CollapsibleSection
                  title="Calculator Data"
                  isOpen={expandedSections.calculator}
                  onToggle={() => toggleSection('calculator')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    {/* Show all calculator data with nested collapsibles */}
                    <NestedCollapsible
                      title="All Calculator Data"
                      data={opportunityDetails.calculator}
                      theme={theme}
                      level={0}
                      expandedState={expandedNested}
                      onToggle={toggleNested}
                      parentKey="calculator"
                    />
                    
                    {/* Also explicitly show calculator types if they exist */}
                    {opportunityDetails.calculator.calculators && (
                      <>
                        {opportunityDetails.calculator.calculators['off-peak'] && (
                          <View style={{ marginTop: 12 }}>
                            <NestedCollapsible
                              title="Off-Peak Calculator"
                              data={opportunityDetails.calculator.calculators['off-peak']}
                              theme={theme}
                              level={0}
                              expandedState={expandedNested}
                              onToggle={toggleNested}
                              parentKey="calculator.off-peak"
                            />
                          </View>
                        )}
                        {opportunityDetails.calculator.calculators.flux && (
                          <View style={{ marginTop: 12 }}>
                            <NestedCollapsible
                              title="Flux Calculator"
                              data={opportunityDetails.calculator.calculators.flux}
                              theme={theme}
                              level={0}
                              expandedState={expandedNested}
                              onToggle={toggleNested}
                              parentKey="calculator.flux"
                            />
                          </View>
                        )}
                        {opportunityDetails.calculator.calculators.epvs && (
                          <View style={{ marginTop: 12 }}>
                            <NestedCollapsible
                              title="EPVS Calculator"
                              data={opportunityDetails.calculator.calculators.epvs}
                              theme={theme}
                              level={0}
                              expandedState={expandedNested}
                              onToggle={toggleNested}
                              parentKey="calculator.epvs"
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </CollapsibleSection>
              )}

              {/* OpenSolar Project */}
              {opportunityDetails.openSolar && (
                <CollapsibleSection
                  title="OpenSolar Project"
                  isOpen={expandedSections.openSolar}
                  onToggle={() => toggleSection('openSolar')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    {/* Show all OpenSolar data with nested collapsibles */}
                    <NestedCollapsible
                      title="All OpenSolar Data"
                      data={opportunityDetails.openSolar}
                      theme={theme}
                      level={0}
                      expandedState={expandedNested}
                      onToggle={toggleNested}
                      parentKey="openSolar"
                    />
                    
                    {/* Explicitly show systems if they exist */}
                    {opportunityDetails.openSolar.systems && Array.isArray(opportunityDetails.openSolar.systems) && opportunityDetails.openSolar.systems.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <NestedCollapsible
                          title={`Systems (${opportunityDetails.openSolar.systems.length})`}
                          data={opportunityDetails.openSolar.systems}
                          theme={theme}
                          level={0}
                          expandedState={expandedNested}
                          onToggle={toggleNested}
                          parentKey="openSolar.systems"
                        />
                      </View>
                    )}
                  </View>
                </CollapsibleSection>
              )}

              {/* Files */}
              {opportunityDetails.files && (
                <CollapsibleSection
                  title="Files"
                  isOpen={expandedSections.files}
                  onToggle={() => toggleSection('files')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    <NestedCollapsible
                      title="All Files"
                      data={opportunityDetails.files}
                      theme={theme}
                      level={0}
                      expandedState={expandedNested}
                      onToggle={toggleNested}
                      parentKey="files"
                    />
                  </View>
                </CollapsibleSection>
              )}

              {/* Solar Projection */}
              {opportunityDetails.solarProjection && (
                <CollapsibleSection
                  title="Solar Projection"
                  isOpen={expandedSections.solarProjection}
                  onToggle={() => toggleSection('solarProjection')}
                  theme={theme}
                >
                  <View style={{ padding: 12 }}>
                    <NestedCollapsible
                      title="All Projections"
                      data={opportunityDetails.solarProjection}
                      theme={theme}
                      level={0}
                      expandedState={expandedNested}
                      onToggle={toggleNested}
                      parentKey="solarProjection"
                    />
                  </View>
                </CollapsibleSection>
              )}

              {/* Show any other top-level data that might exist */}
              {Object.keys(opportunityDetails).filter(key => 
                !['opportunity', 'user', 'survey', 'calculator', 'openSolar', 'files', 'solarProjection'].includes(key)
              ).map((key) => {
                const value = opportunityDetails[key];
                if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return null;
                
                return (
                  <CollapsibleSection
                    key={key}
                    title={formatFieldName(key) || key}
                    isOpen={expandedSections[key] || false}
                    onToggle={() => toggleSection(key)}
                    theme={theme}
                  >
                    <View style={{ padding: 12 }}>
                      <NestedCollapsible
                        title={formatFieldName(key) || key}
                        data={value}
                        theme={theme}
                        level={0}
                        expandedState={expandedNested}
                        onToggle={toggleNested}
                        parentKey={key}
                      />
                    </View>
                  </CollapsibleSection>
                );
              })}
            </View>
          ) : (
            <View style={[styles.dataSection, { padding: 20, alignItems: 'center' }]}>
              <Feather name="alert-circle" size={48} color={theme.secondaryText} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={[styles.dataItemSubtitle, { color: theme.secondaryText, textAlign: 'center' }]}>
                No details available for this opportunity.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: width < 768 ? 16 : 24,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    alignItems: 'center',
  },
  title: {
    fontSize: width < 768 ? 28 : 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: width < 768 ? 16 : 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  dataSection: {
    marginBottom: 24,
  },
  assignedToCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  assignedToLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  assignedToValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  detailSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    marginBottom: 8,
  },
  dataItemSubtitle: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  collapsibleSection: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  collapsibleTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  collapsibleContent: {
    padding: 0,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 140,
    flexShrink: 0,
    textTransform: 'capitalize',
  },
  infoValue: {
    fontSize: 15,
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default AdminOpportunityDetailsScreen;

