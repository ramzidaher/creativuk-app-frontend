import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import BottomNavigation from '../components/BottomNavigation';
import { useTheme } from '../context/ThemeContext';
import {
  getCustomerDetailsFromRouteParams,
  normalizeRouteParams,
} from '../utils/deepLinkParams';

const { width, height } = Dimensions.get('window');

const V44_TEMPLATE_FILE =
  'EPVS Member Calculator v4.4 - (Creativ) 15th June 2026 (1).xlsm';
const V44_SELECTED_OPTIONS = {
  solar: true,
  battery: true,
  solarHybrid: false,
  batteryInverter: false,
};

export default function CalculatorTypeSelectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark, toggleTheme } = useTheme();
  const [pressedCalculator, setPressedCalculator] = useState<string | null>(null);

  const params = normalizeRouteParams(route.params as Record<string, unknown>);
  const opportunityId = params.opportunityId as string | undefined;
  const customerDetails = getCustomerDetailsFromRouteParams(params);

  const startV44Calculator = () => {
    navigation.navigate('CustomerDetails', {
      opportunityId,
      calculatorType: 'v44',
      templateFileName: V44_TEMPLATE_FILE,
      selectedOptions: V44_SELECTED_OPTIONS,
      customerDetails,
    });
  };

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: theme.primaryBackground },
      Platform.OS === 'web' && {
        height: '100vh' as any,
        maxHeight: '100vh' as any,
        overflow: 'hidden',
      }
    ]}>
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
              onPress={() => {
                // Navigate directly to SolarWorkflowScreen instead of going back
                (navigation as any).navigate('SolarWorkflow', { 
                  opportunityId: opportunityId,
                  opportunity: null // Pass null as we don't have opportunity data here
                });
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Choose Calculator Type</Text>
              <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
                v4.4 calculator (Off Peak and Flux are no longer available for new jobs)
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
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

      {/* Scrollable Content */}
      <ScrollView 
        style={[
          styles.scrollView,
          Platform.OS === 'web' && {
            height: '100%',
            maxHeight: '100%',
          }
        ]}
        contentContainerStyle={[
          styles.scrollContent,
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
        {/* Customer Info Display */}
        {customerDetails && (
          <View style={[styles.customerInfo, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <Text style={[styles.customerInfoTitle, { color: theme.primaryText }]}>Customer: {customerDetails.customerName}</Text>
            <Text style={[styles.customerInfoAddress, { color: theme.secondaryText }]}>{customerDetails.address}</Text>
            {customerDetails.postcode && (
              <Text style={[styles.customerInfoPostcode, { color: theme.secondaryText }]}>{customerDetails.postcode}</Text>
            )}
          </View>
        )}

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.calculatorOption,
              {
                backgroundColor: pressedCalculator === 'v44'
                  ? (isDark ? 'rgba(51, 65, 85, 0.9)' : 'rgba(219, 234, 254, 0.5)')
                  : theme.cardBackground,
                borderColor: pressedCalculator === 'v44' ? '#2563EB' : theme.cardBorder,
                borderLeftWidth: 5,
                borderLeftColor: '#2563EB',
              },
              styles.calculatorOptionInteractive,
            ]}
            onPress={startV44Calculator}
            onPressIn={() => setPressedCalculator('v44')}
            onPressOut={() => setPressedCalculator(null)}
            activeOpacity={1}
          >
            <View style={styles.calculatorIconContainer}>
              <View style={[styles.iconBackground, { backgroundColor: '#DBEAFE' }]}>
                <Feather name="sun" size={36} color="#2563EB" />
              </View>
            </View>
            <Text style={[styles.calculatorTitle, { color: theme.primaryText }]}>v4.4 Calculator</Text>
            <Text style={[styles.calculatorSubtitle, { color: theme.secondaryText }]}>
              Current Creativ EPVS calculator with NewSavings and updated defaults
            </Text>
            <View style={styles.calculatorHoverEffect}>
              <Feather name="arrow-right" size={28} color="#2563EB" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
          <Text style={[styles.footerText, { color: theme.secondaryText }]}>
            Existing Off Peak / Flux jobs stay in your progress list; ask an admin to regenerate proposals or contracts on those.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  // Background Image
  backgroundImageStyle: {
    position: 'absolute',
    top: height * 0.3,
    left: 0,
    width: width,
    height: height * 0.4,
    opacity: 0.1,
    zIndex: -1,
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
  
  // ScrollView Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Customer Info
  customerInfo: {
    backgroundColor: '#ffffff',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  customerInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  customerInfoAddress: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  customerInfoPostcode: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  
  // Calculator Options Container
  optionsContainer: {
    padding: width < 768 ? 20 : 28,
    gap: 24,
    ...(Platform.OS === 'web' && {
      paddingBottom: 40,
    }),
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  noCalculatorsCard: {
    padding: 32,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCalculatorsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  noCalculatorsText: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Calculator Option Styles – more noticeable cards
  calculatorOption: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: width < 768 ? 28 : 32,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      marginBottom: 12,
      minHeight: 260,
    }),
  },
  calculatorOptionInteractive: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  calculatorIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  calculatorTitle: {
    fontSize: width < 768 ? 20 : 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  calculatorSubtitle: {
    fontSize: width < 768 ? 15 : 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    fontWeight: '500',
  },
  calculatorPoints: {
    width: '100%',
    paddingHorizontal: 4,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calculatorPoint: {
    fontSize: width < 768 ? 15 : 16,
    color: '#475569',
    lineHeight: 22,
    fontWeight: '600',
    flex: 1,
  },
  calculatorHoverEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderRadius: 20,
    opacity: 0,
    zIndex: -1,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scale: 0.8 }],
  },
  
  // Footer
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
