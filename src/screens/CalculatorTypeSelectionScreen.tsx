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

const { width, height } = Dimensions.get('window');

export default function CalculatorTypeSelectionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme, isDark, toggleTheme } = useTheme();
  const [pressedCalculator, setPressedCalculator] = useState<string | null>(null);
  
  // Get parameters from the previous screen
  const opportunityId = route.params?.opportunityId;
  const templateFileName = route.params?.templateFileName;
  const selectedOptions = route.params?.selectedOptions;
  const customerDetails = route.params?.customerDetails;

  const handleCalculatorTypeSelection = (calculatorType: 'flux' | 'off-peak') => {
    // If we have template selection data, go to Customer Details
    if (templateFileName && selectedOptions) {
      navigation.navigate('CustomerDetails', {
        opportunityId,
        templateFileName,
        selectedOptions,
        calculatorType: calculatorType
      });
    } else {
      // If no template selection yet, go to the appropriate template selection screen
          if (calculatorType === 'flux') {
      navigation.navigate('FluxTemplateSelection', {
          opportunityId,
          calculatorType: calculatorType
        });
      } else {
        navigation.navigate('TemplateSelection', {
          opportunityId,
          calculatorType: calculatorType
        });
      }
    }
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
                Select the type of calculation you want to perform
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
          {/* Off Peak Calculator Option */}
          <TouchableOpacity
            style={[
              styles.calculatorOption, 
              { 
                backgroundColor: pressedCalculator === 'offpeak' 
                  ? (isDark ? 'rgba(51, 65, 85, 0.9)' : 'rgba(248, 250, 252, 0.95)')
                  : theme.cardBackground,
                borderColor: theme.cardBorder
              },
              styles.calculatorOptionInteractive
            ]}
            onPress={() => handleCalculatorTypeSelection('off-peak')}
            onPressIn={() => setPressedCalculator('offpeak')}
            onPressOut={() => setPressedCalculator(null)}
            activeOpacity={1}
          >
            <View style={styles.calculatorIconContainer}>
              <View style={[styles.iconBackground, { backgroundColor: '#FEF3C7' }]}>
                <Feather name="zap" size={28} color="#F59E0B" />
              </View>
            </View>
            <Text style={[styles.calculatorTitle, { color: theme.primaryText }]}>Off Peak Calculator</Text>
            <Text style={[styles.calculatorSubtitle, { color: theme.secondaryText }]}>
              Standard off-peak electricity tariff calculations
            </Text>
            <View style={styles.calculatorPoints}>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Single/dual rate tariffs</Text>
              </View>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Economy 7 support</Text>
              </View>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Standard solar calculations</Text>
              </View>
            </View>
            <View style={styles.calculatorHoverEffect}>
              <Feather name="arrow-right" size={24} color="#F59E0B" />
            </View>
          </TouchableOpacity>

          {/* Flux Calculator Option */}
          <TouchableOpacity
            style={[
              styles.calculatorOption, 
              { 
                backgroundColor: pressedCalculator === 'flux' 
                  ? (isDark ? 'rgba(51, 65, 85, 0.9)' : 'rgba(248, 250, 252, 0.95)')
                  : theme.cardBackground,
                borderColor: theme.cardBorder
              },
              styles.calculatorOptionInteractive
            ]}
            onPress={() => handleCalculatorTypeSelection('flux')}
            onPressIn={() => setPressedCalculator('flux')}
            onPressOut={() => setPressedCalculator(null)}
            activeOpacity={1}
          >
            <View style={styles.calculatorIconContainer}>
              <View style={[styles.iconBackground, { backgroundColor: '#EDE9FE' }]}>
                <Feather name="trending-up" size={28} color="#8B5CF6" />
              </View>
            </View>
            <Text style={[styles.calculatorTitle, { color: theme.primaryText }]}>Flux Calculator</Text>
            <Text style={[styles.calculatorSubtitle, { color: theme.secondaryText }]}>
              Enhanced Performance Value System calculation
            </Text>
            <View style={styles.calculatorPoints}>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Advanced performance metrics</Text>
              </View>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Enhanced value calculations</Text>
              </View>
              <View style={styles.pointItem}>
                <View style={[styles.pointDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.calculatorPoint, { color: theme.secondaryText }]}>Optimized system analysis</Text>
              </View>
            </View>
            <View style={styles.calculatorHoverEffect}>
              <Feather name="arrow-right" size={24} color="#8B5CF6" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
          <Text style={[styles.footerText, { color: theme.secondaryText }]}>
            💡 Both calculators use the same customer details and template selection
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
    padding: width < 768 ? 16 : 20,
    gap: 20,
    ...(Platform.OS === 'web' && {
      paddingBottom: 40, // Extra padding for web scrolling
    }),
  },
  
  // Calculator Option Styles
  calculatorOption: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      marginBottom: 8, // Extra spacing between options on web
      minHeight: 200, // Ensure options have minimum height
    }),
  },
  calculatorOptionInteractive: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  calculatorIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBackground: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  calculatorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  calculatorSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  calculatorPoints: {
    width: '100%',
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calculatorPoint: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '500',
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
