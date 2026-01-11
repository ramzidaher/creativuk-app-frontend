// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   TouchableOpacity,
//   TextInput,
//   Alert,
//   ActivityIndicator,
//   Platform,
//   RefreshControl,
//   Image,
//   Dimensions,
//   KeyboardAvoidingView,
//   SafeAreaView,
// } from 'react-native';
// import { LinearGradient } from 'expo-linear-gradient';
// import { useNavigation, useRoute } from '@react-navigation/native';
// import * as ImagePicker from 'expo-image-picker';
// import { Ionicons, Feather } from '@expo/vector-icons';
// import { useAuth } from '../context/AuthContext';
// import { useTheme } from '../context/ThemeContext';
// import { 
//   Survey, 
//   SurveyPage1, 
//   SurveyPage2, 
//   SurveyPage3, 
//   SurveyPage4, 
//   SurveyPage5,
//   SurveyPage6,
//   SurveyPage7,
//   SurveyPage8,
//   SurveyStatus,
//   HomeOwnerAvailability
// } from '../types';
// import { surveyApi } from '../utils/api';

// const { width, height } = Dimensions.get('window');

// interface RouteParams {
//   opportunityId: string;
// }

// export default function EnhancedSurveyScreen() {
//   const navigation = useNavigation();
//   const route = useRoute();
//   const { opportunityId } = route.params as RouteParams;
//   const { isAuthenticated } = useAuth();
//   const { theme, isDark, toggleTheme } = useTheme();
  
//   const [currentPage, setCurrentPage] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const [survey, setSurvey] = useState<Survey | null>(null);
//   const [formData, setFormData] = useState({
//     page1: {} as SurveyPage1,
//     page2: {} as SurveyPage2,
//     page3: {} as SurveyPage3,
//     page4: {} as SurveyPage4,
//     page5: {} as SurveyPage5,
//     page6: {} as SurveyPage6,
//     page7: {} as SurveyPage7,
//     page8: {} as SurveyPage8,
//   });

//   const scrollViewRef = useRef<ScrollView>(null);
//   const totalPages = 8;

//   // Helper function to get themed input styles
//   const getThemedInputStyle = () => ({
//     backgroundColor: theme.cardBackground,
//     borderColor: theme.cardBorder,
//     color: theme.primaryText,
//   });

//   // Helper function to get themed section styles
//   const getThemedSectionStyle = () => ({
//     backgroundColor: theme.cardBackground,
//     borderColor: theme.cardBorder,
//   });

//   useEffect(() => {
//     loadSurvey();
//   }, [opportunityId]);

//   // Ensure ScrollView starts at top on web
//   useEffect(() => {
//     if (Platform.OS === 'web' && scrollViewRef.current) {
//       setTimeout(() => {
//         scrollViewRef.current?.scrollTo({ y: 0, animated: false });
//       }, 100);
//     }
//   }, []);

//   const loadSurvey = async () => {
//     setLoading(true);
//     try {
//       const response = await surveyApi.getSurvey(opportunityId);
//       if (response.success && response.data) {
//         setSurvey(response.data);
//         if (response.data.page1) setFormData(prev => ({ ...prev, page1: response.data.page1 }));
//         if (response.data.page2) setFormData(prev => ({ ...prev, page2: response.data.page2 }));
//         if (response.data.page3) setFormData(prev => ({ ...prev, page3: response.data.page3 }));
//         if (response.data.page4) setFormData(prev => ({ ...prev, page4: response.data.page4 }));
//         if (response.data.page5) setFormData(prev => ({ ...prev, page5: response.data.page5 }));
//         if (response.data.page6) setFormData(prev => ({ ...prev, page6: response.data.page6 }));
//         if (response.data.page7) setFormData(prev => ({ ...prev, page7: response.data.page7 }));
//         if (response.data.page8) setFormData(prev => ({ ...prev, page8: response.data.page8 }));
//       } else {
//         const createResponse = await surveyApi.createSurvey(opportunityId);
//         if (createResponse.success && createResponse.data) {
//           setSurvey(createResponse.data);
//         }
//       }
//     } catch (error) {
//       console.error('Error loading survey:', error);
//       Alert.alert('Error', 'Failed to load survey');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onRefresh = async () => {
//     setRefreshing(true);
//     await loadSurvey();
//     setRefreshing(false);
//   };

//   const updateFormData = (page: keyof typeof formData, data: any) => {
//     setFormData(prev => ({
//       ...prev,
//       [page]: { ...prev[page], ...data }
//     }));
//   };

//   const savePage = async (page: keyof typeof formData) => {
//     try {
//       const response = await surveyApi.updateSurvey(opportunityId, {
//         [page]: formData[page]
//       });
//       if (response.success) {
//         console.log(`Page ${page} saved successfully`);
//       }
//     } catch (error) {
//       console.error(`Error saving page ${page}:`, error);
//     }
//   };

//   const submitSurvey = async () => {
//     setSubmitting(true);
//     try {
//       // Save all pages first
//       for (const page of Object.keys(formData) as Array<keyof typeof formData>) {
//         if (Object.keys(formData[page]).length > 0) {
//           await savePage(page);
//         }
//       }

//       const response = await surveyApi.submitSurvey(opportunityId);
//       if (response.success) {
//         Alert.alert(
//           'Survey Submitted!',
//           'Your survey has been submitted successfully. You will receive an email confirmation with all the details.',
//           [
//             { 
//               text: 'OK', 
//               onPress: () => navigation.goBack() 
//             }
//           ]
//         );
//       } else {
//         Alert.alert('Error', response.error || 'Failed to submit survey');
//       }
//     } catch (error) {
//       console.error('Error submitting survey:', error);
//       Alert.alert('Error', 'Failed to submit survey');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const pickImage = async (field: string) => {
//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: true,
//         aspect: [4, 3],
//         quality: 0.8,
//       });

//       if (!result.canceled && result.assets[0]) {
//         const imageUri = result.assets[0].uri;
//         updateFormData('page7', { [field]: imageUri });
//         await savePage('page7');
//       }
//     } catch (error) {
//       console.error('Error picking image:', error);
//       Alert.alert('Error', 'Failed to pick image');
//     }
//   };

//   const renderProgressBar = () => (
//     <View style={styles.progressSection}>
//       <View style={styles.progressHeader}>
//         <Text style={[styles.progressTitle, { color: theme.primaryText }]}>Progress</Text>
//         <Text style={[styles.progressText, { color: theme.secondaryText }]}>
//           Page {currentPage} of {totalPages}
//         </Text>
//       </View>
//       <View style={[styles.progressBar, { backgroundColor: theme.progressBackground }]}>
//         <View 
//           style={[
//             styles.progressFill, 
//             { 
//               width: `${(currentPage / totalPages) * 100}%`,
//               backgroundColor: theme.progressFill 
//             }
//           ]} 
//         />
//       </View>
//     </View>
//   );

//   const renderPage1 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>📋 Basic Information</Text>
      
//       <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Renewable Executive *</Text>
//         <View style={styles.row}>
//           <View style={styles.halfInput}>
//             <Text style={[styles.label, { color: theme.primaryText }]}>First Name</Text>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.renewableExecutiveFirstName || ''}
//               onChangeText={(text) => updateFormData('page1', { renewableExecutiveFirstName: text })}
//               placeholder="First Name"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//           <View style={styles.halfInput}>
//             <Text style={[styles.label, { color: theme.primaryText }]}>Last Name</Text>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.renewableExecutiveLastName || ''}
//               onChangeText={(text) => updateFormData('page1', { renewableExecutiveLastName: text })}
//               placeholder="Last Name"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//         </View>
//       </View>

//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Customer Name *</Text>
//         <View style={styles.row}>
//           <View style={styles.halfInput}>
//             <Text style={[styles.label, { color: theme.primaryText }]}>First Name</Text>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.customerFirstName || ''}
//               onChangeText={(text) => updateFormData('page1', { customerFirstName: text })}
//               placeholder="First Name"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//           <View style={styles.halfInput}>
//             <Text style={[styles.label, { color: theme.primaryText }]}>Last Name</Text>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.customerLastName || ''}
//               onChangeText={(text) => updateFormData('page1', { customerLastName: text })}
//               placeholder="Last Name"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//         </View>
//       </View>

//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Address *</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page1.addressLine1 || ''}
//           onChangeText={(text) => updateFormData('page1', { addressLine1: text })}
//           placeholder="Address Line 1"
//           placeholderTextColor={theme.tertiaryText}
//         />
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page1.addressLine2 || ''}
//           onChangeText={(text) => updateFormData('page1', { addressLine2: text })}
//           placeholder="Address Line 2 (Optional)"
//           placeholderTextColor={theme.tertiaryText}
//         />
//         <View style={styles.row}>
//           <View style={styles.halfInput}>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.town || ''}
//               onChangeText={(text) => updateFormData('page1', { town: text })}
//               placeholder="Town"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//           <View style={styles.halfInput}>
//             <TextInput
//               style={[styles.input, getThemedInputStyle()]}
//               value={formData.page1.county || ''}
//               onChangeText={(text) => updateFormData('page1', { county: text })}
//               placeholder="County"
//               placeholderTextColor={theme.tertiaryText}
//             />
//           </View>
//         </View>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page1.postcode || ''}
//           onChangeText={(text) => updateFormData('page1', { postcode: text })}
//           placeholder="Postcode"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>

//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Home owners available? *</Text>
//         <View style={styles.radioGroup}>
//           {Object.values(HomeOwnerAvailability).map((option) => (
//             <TouchableOpacity
//               key={option}
//               style={[
//                 styles.radioOption,
//                 getThemedSectionStyle(),
//                 formData.page1.homeOwnersAvailable === option && styles.radioSelected
//               ]}
//               onPress={() => updateFormData('page1', { homeOwnersAvailable: option })}
//             >
//               <View style={styles.radioInner}>
//                 <View style={[
//                   styles.radioCircle,
//                   { borderColor: theme.cardBorder },
//                   formData.page1.homeOwnersAvailable === option && styles.radioCircleSelected
//                 ]}>
//                   {formData.page1.homeOwnersAvailable === option && (
//                     <View style={styles.radioDot} />
//                   )}
//                 </View>
//                 <Text style={[
//                   styles.radioText,
//                   { color: theme.primaryText },
//                   formData.page1.homeOwnersAvailable === option && styles.radioTextSelected
//                 ]}>
//                   {option}
//                 </Text>
//               </View>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </View>

//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Appointment Date & Time</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page1.appointmentDateTime || ''}
//           onChangeText={(text) => updateFormData('page1', { appointmentDateTime: text })}
//           placeholder="e.g., 15th Dec 2024, 2:00 PM"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>
//     </View>
//   );

//   const renderPage2 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>🎯 Solar Installation Reasons</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>What are the two most important reasons for installing solar and/or battery storage? *</Text>
//         <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Select up to two options that best describe your motivations.</Text>
        
//         <View style={styles.checkboxGroup}>
//           {[
//             'Reducing your energy bills',
//             'Reducing your carbon footprint',
//             'Adding value to your home',
//             'Looking for an investment',
//             'Energy security',
//             'Becoming more sustainable',
//             'Government incentives',
//             'Future-proofing your home'
//           ].map((reason) => (
//             <TouchableOpacity
//               key={reason}
//               style={[
//                 styles.checkboxOption,
//                 getThemedSectionStyle(),
//                 formData.page2.selectedReasons?.includes(reason) && styles.checkboxSelected
//               ]}
//               onPress={() => {
//                 const currentReasons = formData.page2.selectedReasons || [];
//                 let newReasons;
                
//                 if (currentReasons.includes(reason)) {
//                   newReasons = currentReasons.filter(r => r !== reason);
//                 } else if (currentReasons.length < 2) {
//                   newReasons = [...currentReasons, reason];
//                 } else {
//                   Alert.alert('Limit Reached', 'You can only select up to 2 reasons');
//                   return;
//                 }
                
//                 updateFormData('page2', { selectedReasons: newReasons });
//               }}
//             >
//               <View style={styles.checkboxInner}>
//                 <View style={[
//                   styles.checkboxSquare,
//                   { borderColor: theme.cardBorder },
//                   formData.page2.selectedReasons?.includes(reason) && styles.checkboxSquareSelected
//                 ]}>
//                   {formData.page2.selectedReasons?.includes(reason) && (
//                     <Text style={styles.checkmark}>✓</Text>
//                   )}
//                 </View>
//                 <Text style={[
//                   styles.checkboxText,
//                   { color: theme.primaryText },
//                   formData.page2.selectedReasons?.includes(reason) && styles.checkboxTextSelected
//                 ]}>
//                   {reason}
//                 </Text>
//               </View>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </View>
//     </View>
//   );

//   const renderPage3 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>🏠 k
// </Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Property Details</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>Property Type</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page3.propertyType || ''}
//           onChangeText={(text) => updateFormData('page3', { propertyType: text })}
//           placeholder="e.g., Detached, Semi-detached, Terraced"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Number of Bedrooms</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page3.bedrooms || ''}
//           onChangeText={(text) => updateFormData('page3', { bedrooms: text })}
//           placeholder="e.g., 3"
//           keyboardType="numeric"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>How long have you lived at this property?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page3.lengthOfStay || ''}
//           onChangeText={(text) => updateFormData('page3', { lengthOfStay: text })}
//           placeholder="e.g., 5 years"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Do you plan to move in the next 5 years?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page3.movingPlans || ''}
//           onChangeText={(text) => updateFormData('page3', { movingPlans: text })}
//           placeholder="e.g., No plans to move"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Number of occupants</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page3.occupants || ''}
//           onChangeText={(text) => updateFormData('page3', { occupants: text })}
//           placeholder="e.g., 4"
//           keyboardType="numeric"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>
//     </View>
//   );

//   const renderPage4 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>⚡ Energy Information</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Energy Details</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>Heating Type</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.heatingType || ''}
//           onChangeText={(text) => updateFormData('page4', { heatingType: text })}
//           placeholder="e.g., Gas central heating"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Energy Company</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.energyCompany || ''}
//           onChangeText={(text) => updateFormData('page4', { energyCompany: text })}
//           placeholder="e.g., British Gas"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Monthly Electric Spend (£)</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.monthlyElectricSpend || ''}
//           onChangeText={(text) => updateFormData('page4', { monthlyElectricSpend: text })}
//           placeholder="e.g., 120"
//           keyboardType="numeric"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Annual Electric Usage (kWh)</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.annualElectricUsage || ''}
//           onChangeText={(text) => updateFormData('page4', { annualElectricUsage: text })}
//           placeholder="e.g., 3500"
//           keyboardType="numeric"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Electric Price Per Unit (p/kWh)</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.electricPricePerUnit || ''}
//           onChangeText={(text) => updateFormData('page4', { electricPricePerUnit: text })}
//           placeholder="e.g., 15.5"
//           keyboardType="numeric"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Prepaid Meter?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.prepaidMeter || ''}
//           onChangeText={(text) => updateFormData('page4', { prepaidMeter: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Phase Meter?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.phaseMeter || ''}
//           onChangeText={(text) => updateFormData('page4', { phaseMeter: text })}
//           placeholder="Single/Three phase"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Additional Features</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.additionalFeatures || ''}
//           onChangeText={(text) => updateFormData('page4', { additionalFeatures: text })}
//           placeholder="e.g., Smart meter, EV charger"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>
//     </View>
//   );

//   const renderPage5 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>📊 EPC & Previous Solar</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>EPC Information</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>EPC Rating</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page5.epcRating || ''}
//           onChangeText={(text) => updateFormData('page5', { epcRating: text })}
//           placeholder="e.g., B, C, D"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Previous Solar Funding</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page5.previousSolarFunding || ''}
//           onChangeText={(text) => updateFormData('page5', { previousSolarFunding: text })}
//           placeholder="e.g., FIT, RHI, None"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Previous Company</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page5.previousCompany || ''}
//           onChangeText={(text) => updateFormData('page5', { previousCompany: text })}
//           placeholder="e.g., Company name or None"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>
//     </View>
//   );

//   const renderPage6 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>📝 Additional Information</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Additional Details</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>Credit Rating</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page6.creditRating || ''}
//           onChangeText={(text) => updateFormData('page6', { creditRating: text })}
//           placeholder="e.g., Excellent, Good, Fair"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Installation Availability</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page6.installationAvailability || ''}
//           onChangeText={(text) => updateFormData('page6', { installationAvailability: text })}
//           placeholder="e.g., Weekdays, Weekends, Flexible"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Additional Features</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page4.additionalFeatures || ''}
//           onChangeText={(text) => updateFormData('page4', { additionalFeatures: text })}
//           placeholder="e.g., Battery storage, EV charger"
//           placeholderTextColor={theme.tertiaryText}
//         />
//       </View>
//     </View>
//   );

//   const renderPage7 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>📸 Property Images</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Property Photos</Text>
//         <Text style={[styles.sectionDescription, { color: theme.secondaryText }]}>Please take photos of the following areas:</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>Roof Tile Type</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page7.roofTileType || ''}
//           onChangeText={(text) => updateFormData('page7', { roofTileType: text })}
//           placeholder="e.g., Concrete tiles, Slate, Metal"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Has Solar Battery?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page7.solarBatteryStorage || ''}
//           onChangeText={(text) => updateFormData('page7', { solarBatteryStorage: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <View style={styles.imageGrid}>
//           {[
//             { field: 'frontDoorImage', label: 'Front Door' },
//             { field: 'frontPropertyImage', label: 'Front Property' },
//             { field: 'targetRoofsImage', label: 'Target Roofs' },
//             { field: 'propertySidesImage', label: 'Property Sides' },
//             { field: 'roofAngleImage', label: 'Roof Angle' },
//             { field: 'roofTileCloseupImage', label: 'Roof Tile Closeup' },
//             { field: 'otherBuildingsImage', label: 'Other Buildings' },
//             { field: 'electricMeterImage', label: 'Electric Meter' },
//             { field: 'garageImage', label: 'Garage' },
//             { field: 'fuseBoardImage', label: 'Fuse Board' },
//             { field: 'batteryInverterLocationImage', label: 'Battery/Inverter Location' }
//           ].map(({ field, label }) => (
//             <View key={field} style={styles.imageItem}>
//               <Text style={[styles.imageLabel, { color: theme.primaryText }]}>{label}</Text>
//               {formData.page7[field as keyof typeof formData.page7] ? (
//                 <View style={styles.imageContainer}>
//                   <Image source={{ uri: formData.page7[field as keyof typeof formData.page7] }} style={styles.image} />
//                   <TouchableOpacity
//                     style={styles.changeImageButton}
//                     onPress={() => pickImage(field)}
//                   >
//                     <Text style={styles.changeImageText}>Change</Text>
//                   </TouchableOpacity>
//                 </View>
//               ) : (
//                 <TouchableOpacity
//                   style={[
//                     styles.addImageButton,
//                     { 
//                       borderColor: theme.cardBorder,
//                       backgroundColor: theme.tertiaryBackground 
//                     }
//                   ]}
//                   onPress={() => pickImage(field)}
//                 >
//                   <Text style={[styles.addImageText, { color: theme.primaryButton }]}>+ Add Photo</Text>
//                 </TouchableOpacity>
//               )}
//             </View>
//           ))}
//         </View>
//       </View>
//     </View>
//   );

//   const renderPage8 = () => (
//     <View style={styles.pageContainer}>
//       <Text style={[styles.pageTitle, { color: theme.primaryText }]}>🔧 Installation Details</Text>
      
//       <View style={[styles.section, getThemedSectionStyle()]}>
//         <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Installation Requirements</Text>
        
//         <Text style={[styles.label, { color: theme.primaryText }]}>EV Location</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.evLocation || ''}
//           onChangeText={(text) => updateFormData('page8', { evLocation: text })}
//           placeholder="e.g., Garage, Driveway"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>EV Charger Required?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.evChargerRequired || ''}
//           onChangeText={(text) => updateFormData('page8', { evChargerRequired: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Optimisers Required?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.optimisersRequired || ''}
//           onChangeText={(text) => updateFormData('page8', { optimisersRequired: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Optimiser Details</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.optimiserDetails || ''}
//           onChangeText={(text) => updateFormData('page8', { optimiserDetails: text })}
//           placeholder="e.g., Shading issues, roof orientation"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Shading Issues</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.shadingIssues || ''}
//           onChangeText={(text) => updateFormData('page8', { shadingIssues: text })}
//           placeholder="e.g., Trees, chimneys, buildings"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Scaffolding Required?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.scaffoldingRequired || ''}
//           onChangeText={(text) => updateFormData('page8', { scaffoldingRequired: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Scaffolding Through House?</Text>
//         <TextInput
//           style={[styles.input, getThemedInputStyle()]}
//           value={formData.page8.scaffoldingThroughHouse || ''}
//           onChangeText={(text) => updateFormData('page8', { scaffoldingThroughHouse: text })}
//           placeholder="Yes/No"
//           placeholderTextColor={theme.tertiaryText}
//         />

//         <Text style={[styles.label, { color: theme.primaryText }]}>Further Information</Text>
//         <TextInput
//           style={[styles.input, styles.textArea, getThemedInputStyle()]}
//           value={formData.page8.furtherInformation || ''}
//           onChangeText={(text) => updateFormData('page8', { furtherInformation: text })}
//           placeholder="Any additional information or special requirements..."
//           placeholderTextColor={theme.tertiaryText}
//           multiline
//           numberOfLines={4}
//         />
//       </View>
//     </View>
//   );

//   const renderCurrentPage = () => {
//     switch (currentPage) {
//       case 1: return renderPage1();
//       case 2: return renderPage2();
//       case 3: return renderPage3();
//       case 4: return renderPage4();
//       case 5: return renderPage5();
//       case 6: return renderPage6();
//       case 7: return renderPage7();
//       case 8: return renderPage8();
//       default: return renderPage1();
//     }
//   };

//   const handleNext = () => {
//     if (currentPage < totalPages) {
//       setCurrentPage(currentPage + 1);
//       scrollViewRef.current?.scrollTo({ y: 0, animated: true });
//     }
//   };

//   const handlePrevious = () => {
//     if (currentPage > 1) {
//       setCurrentPage(currentPage - 1);
//       scrollViewRef.current?.scrollTo({ y: 0, animated: true });
//     }
//   };

//   if (loading) {
//     return (
//       <View style={[styles.loadingContainer, { backgroundColor: theme.primaryBackground }]}>
//         <View style={styles.loadingContent}>
//           <Feather name="loader" size={48} color={theme.secondaryText} />
//           <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading survey...</Text>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <SafeAreaView style={[
//       styles.container, 
//       { backgroundColor: theme.primaryBackground },
//       Platform.OS === 'web' && {
//         height: '100vh' as any,
//         maxHeight: '100vh' as any,
//         overflow: 'hidden',
//       }
//     ]}>
//       {/* Background Image */}
//       <Image
//         source={require('../../assets/creativ.png')}
//         style={styles.backgroundImageStyle}
//         resizeMode="contain"
//       />
      
//       {/* Modern Header */}
//       <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.cardBorder }]}>
//         <View style={styles.headerTop}>
//           <View style={styles.headerLeft}>
//             <TouchableOpacity
//               style={[styles.backButton, { backgroundColor: theme.tertiaryBackground }]}
//               onPress={() => navigation.goBack()}
//             >
//               <Feather name="arrow-left" size={20} color={theme.secondaryText} />
//             </TouchableOpacity>
//             <View style={styles.headerTextContainer}>
//               <Text style={[styles.headerTitle, { color: theme.primaryText }]}>Solar Survey</Text>
//               <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
//                 Enhanced assessment form
//               </Text>
//             </View>
//           </View>
//           <View style={styles.headerRight}>
//             <TouchableOpacity 
//               style={[styles.iconButton, { backgroundColor: theme.tertiaryBackground }]} 
//               onPress={onRefresh}
//             >
//               <Feather name="refresh-cw" size={20} color={theme.secondaryText} />
//             </TouchableOpacity>
//             <TouchableOpacity 
//               style={[styles.iconButton, { backgroundColor: theme.tertiaryBackground }]} 
//               onPress={toggleTheme}
//             >
//               <Feather 
//                 name={isDark ? "sun" : "moon"} 
//                 size={20} 
//                 color={theme.secondaryText} 
//               />
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>

//       {renderProgressBar()}

//       <KeyboardAvoidingView 
//         style={styles.content}
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       >
//         <ScrollView
//           ref={scrollViewRef}
//           style={[styles.scrollView, { backgroundColor: 'transparent' }]}
//           refreshControl={
//             <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryButton} />
//           }
//           showsVerticalScrollIndicator={Platform.OS === 'web' ? true : false}
//           nestedScrollEnabled={true}
//           scrollEnabled={true}
//           bounces={Platform.OS !== 'web'}
//           alwaysBounceVertical={Platform.OS !== 'web'}
//           keyboardShouldPersistTaps="handled"
//           removeClippedSubviews={Platform.OS !== 'web'}
//           contentContainerStyle={[
//             { paddingBottom: 40 },
//             Platform.OS === 'web' && {
//               minHeight: '100vh' as any,
//               paddingBottom: 100,
//             }
//           ]}
//         >
//           {/* Hero Section */}
//           <View style={styles.heroSection}>
//             <View style={[styles.heroIcon, { backgroundColor: theme.primaryButton + '20' }]}>
//               <Feather name="clipboard" size={32} color={theme.primaryButton} />
//             </View>
//             <Text style={[styles.heroTitle, { color: theme.primaryText }]}>Enhanced Solar Survey</Text>
//             <Text style={[styles.heroSubtitle, { color: theme.secondaryText }]}>
//               Complete all sections for a comprehensive assessment
//             </Text>
//           </View>

//           {/* Progress Indicator */}
//           <View style={styles.progressSection}>
//             <View style={styles.progressHeader}>
//               <Text style={[styles.progressTitle, { color: theme.primaryText }]}>Progress</Text>
//               <Text style={[styles.progressText, { color: theme.secondaryText }]}>
//                 Page {currentPage} of {totalPages}
//               </Text>
//             </View>
//             <View style={[styles.progressBar, { backgroundColor: theme.progressBackground }]}>
//               <View 
//                 style={[
//                   styles.progressFill, 
//                   { 
//                     width: `${(currentPage / totalPages) * 100}%`,
//                     backgroundColor: theme.progressFill 
//                   }
//                 ]} 
//               />
//             </View>
//           </View>

//           {renderCurrentPage()}
//         </ScrollView>

//         <View style={[styles.navigation, { backgroundColor: theme.cardBackground, borderTopColor: theme.cardBorder }]}>
//           <TouchableOpacity
//             style={[
//               styles.navButton, 
//               { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
//               currentPage === 1 && { opacity: 0.5 }
//             ]}
//             onPress={handlePrevious}
//             disabled={currentPage === 1}
//           >
//             <Feather name="arrow-left" size={16} color={currentPage === 1 ? theme.tertiaryText : theme.secondaryText} />
//             <Text style={[
//               styles.navButtonText, 
//               { color: currentPage === 1 ? theme.tertiaryText : theme.secondaryText }
//             ]}>
//               Previous
//             </Text>
//           </TouchableOpacity>

//           {currentPage < totalPages ? (
//             <TouchableOpacity
//               style={[
//                 styles.navButton, 
//                 styles.nextButton, 
//                 { backgroundColor: theme.primaryButton }
//               ]}
//               onPress={handleNext}
//             >
//               <Text style={[styles.navButtonText, { color: '#ffffff' }]}>Next</Text>
//               <Feather name="arrow-right" size={16} color="#ffffff" />
//             </TouchableOpacity>
//           ) : (
//             <TouchableOpacity
//               style={[
//                 styles.submitButton, 
//                 { backgroundColor: theme.successButton },
//                 submitting && { opacity: 0.7 }
//               ]}
//               onPress={submitSurvey}
//               disabled={submitting}
//             >
//               {submitting ? (
//                 <ActivityIndicator size="small" color="white" />
//               ) : (
//                 <>
//                   <Text style={[styles.submitButtonText, { color: '#ffffff' }]}>Submit Survey</Text>
//                   <Feather name="check" size={16} color="#ffffff" />
//                 </>
//               )}
//             </TouchableOpacity>
//           )}
//         </View>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
  
//   // Background Image
//   backgroundImageStyle: {
//     opacity: 0.08, // Reduced opacity for better dark mode visibility
//     resizeMode: 'contain',
//     position: 'absolute',
//     top: '45%',
//     left: '50%',
//     transform: [{ translateX: -250 }, { translateY: -200 }],
//     width: 600,
//     height: 600,
//   },
  
//   // Loading States
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   loadingContent: {
//     alignItems: 'center',
//   },
//   loadingText: {
//     fontSize: 16,
//     marginTop: 16,
//     fontWeight: '500',
//   },
  
//   // Modern Header Styles
//   header: {
//     paddingTop: Platform.OS === 'ios' ? 60 : 40,
//     paddingBottom: 24,
//     paddingHorizontal: width < 768 ? 16 : 24,
//     shadowColor: 'rgba(0, 0, 0, 0.12)',
//     shadowOffset: { width: 0, height: 8 },
//     shadowOpacity: 0.16,
//     shadowRadius: 16,
//     elevation: 8,
//     borderBottomWidth: 1,
//   },
//   headerTop: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   headerLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//   },
//   headerRight: {
//     flexDirection: 'row',
//     gap: width < 768 ? 12 : 16,
//   },
//   backButton: {
//     padding: width < 768 ? 12 : 14,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//     shadowColor: 'rgba(0, 0, 0, 0.08)',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.12,
//     shadowRadius: 8,
//     elevation: 4,
//     borderWidth: 1,
//     marginRight: 16,
//   },
//   headerTextContainer: {
//     flex: 1,
//   },
//   headerTitle: {
//     fontSize: width < 768 ? 24 : 28,
//     fontWeight: '800',
//     letterSpacing: -0.8,
//   },
//   headerSubtitle: {
//     fontSize: 15,
//     marginTop: 4,
//     fontWeight: '500',
//   },
//   iconButton: {
//     padding: width < 768 ? 12 : 14,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//     shadowColor: 'rgba(0, 0, 0, 0.08)',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.12,
//     shadowRadius: 8,
//     elevation: 4,
//     borderWidth: 1,
//   },
  
//   // Content and Layout
//   content: {
//     flex: 1,
//   },
//   scrollView: {
//     flex: 1,
//   },
  
//   // Hero Section
//   heroSection: {
//     alignItems: 'center',
//     paddingVertical: 32,
//     paddingHorizontal: 20,
//   },
//   heroIcon: {
//     width: 80,
//     height: 80,
//     borderRadius: 24,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 20,
//     shadowColor: 'rgba(0, 0, 0, 0.1)',
//     shadowOffset: { width: 0, height: 8 },
//     shadowOpacity: 0.2,
//     shadowRadius: 16,
//     elevation: 8,
//   },
//   heroTitle: {
//     fontSize: 28,
//     fontWeight: '800',
//     marginBottom: 8,
//     textAlign: 'center',
//     letterSpacing: -0.8,
//   },
//   heroSubtitle: {
//     fontSize: 16,
//     textAlign: 'center',
//     lineHeight: 24,
//     fontWeight: '500',
//     maxWidth: 300,
//   },
  
//   // Progress Section
//   progressSection: {
//     marginHorizontal: 20,
//     marginBottom: 24,
//     ...(Platform.OS === 'web' && {
//       marginBottom: 32, // Extra spacing for web
//       minHeight: 60, // Ensure progress section has minimum height
//     }),
//   },
//   progressHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 12,
//   },
//   progressTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//   },
//   progressText: {
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   progressBar: {
//     height: 8,
//     borderRadius: 4,
//     overflow: 'hidden',
//   },
//   progressFill: {
//     height: '100%',
//     borderRadius: 4,
//   },
  
//   // Page Container
//   pageContainer: {
//     paddingHorizontal: 20,
//     paddingBottom: 20,
//     ...(Platform.OS === 'web' && {
//       paddingBottom: 40, // Extra padding for web
//       minHeight: 200, // Ensure page containers have minimum height
//     }),
//   },
//   pageTitle: {
//     fontSize: 24,
//     fontWeight: '800',
//     marginBottom: 24,
//     textAlign: 'center',
//     letterSpacing: -0.6,
//   },
  
//   // Section Styles
//   section: {
//     borderRadius: 16,
//     padding: 24,
//     marginBottom: 20,
//     shadowColor: 'rgba(0, 0, 0, 0.08)',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.12,
//     shadowRadius: 12,
//     elevation: 4,
//     borderWidth: 1,
//     ...(Platform.OS === 'web' && {
//       marginBottom: 32, // Extra spacing for web
//       minHeight: 120, // Ensure sections have minimum height
//     }),
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     marginBottom: 16,
//     letterSpacing: -0.4,
//   },
//   sectionDescription: {
//     fontSize: 14,
//     marginBottom: 20,
//     lineHeight: 22,
//     fontWeight: '500',
//   },
  
//   // Form Elements
//   label: {
//     fontSize: 16,
//     fontWeight: '600',
//     marginBottom: 8,
//     color: '#333333', // Default color for light mode, will be overridden by theme colors
//   },
//   input: {
//     borderWidth: 1,
//     borderRadius: 12,
//     padding: 16,
//     fontSize: 16,
//     marginBottom: 16,
//     fontWeight: '500',
//   },
//   textArea: {
//     height: 120,
//     textAlignVertical: 'top',
//   },
//   row: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     gap: 12,
//   },
//   halfInput: {
//     flex: 1,
//   },
  
//   // Radio Button Styles
//   radioGroup: {
//     marginTop: 8,
//   },
//   radioOption: {
//     marginBottom: 12,
//     padding: 16,
//     borderWidth: 1,
//     borderRadius: 12,
//   },
//   radioSelected: {
//     borderColor: '#10b981',
//     backgroundColor: 'rgba(16, 185, 129, 0.1)',
//   },
//   radioInner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   radioCircle: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     marginRight: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   radioCircleSelected: {
//     borderColor: '#10b981',
//   },
//   radioDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#10b981',
//   },
//   radioText: {
//     fontSize: 16,
//     fontWeight: '500',
//   },
//   radioTextSelected: {
//     color: '#10b981',
//     fontWeight: '600',
//   },
  
//   // Checkbox Styles
//   checkboxGroup: {
//     marginTop: 8,
//   },
//   checkboxOption: {
//     marginBottom: 12,
//     padding: 16,
//     borderWidth: 1,
//     borderRadius: 12,
//   },
//   checkboxSelected: {
//     borderColor: '#10b981',
//     backgroundColor: 'rgba(16, 185, 129, 0.1)',
//   },
//   checkboxInner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   checkboxSquare: {
//     width: 20,
//     height: 20,
//     borderWidth: 2,
//     marginRight: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 4,
//   },
//   checkboxSquareSelected: {
//     borderColor: '#10b981',
//     backgroundColor: '#10b981',
//   },
//   checkmark: {
//     color: '#ffffff',
//     fontSize: 12,
//     fontWeight: 'bold',
//   },
//   checkboxText: {
//     fontSize: 16,
//     flex: 1,
//     fontWeight: '500',
//   },
//   checkboxTextSelected: {
//     color: '#10b981',
//     fontWeight: '600',
//   },
  
//   // Image Upload Styles
//   imageGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'space-between',
//     marginTop: 16,
//     gap: 12,
//   },
//   imageItem: {
//     width: (width - 60) / 2,
//     marginBottom: 20,
//   },
//   imageLabel: {
//     fontSize: 14,
//     fontWeight: '600',
//     marginBottom: 8,
//   },
//   addImageButton: {
//     height: 100,
//     borderWidth: 2,
//     borderStyle: 'dashed',
//     borderRadius: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   addImageText: {
//     color: '#10b981',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   imageContainer: {
//     position: 'relative',
//   },
//   image: {
//     width: '100%',
//     height: 100,
//     borderRadius: 12,
//   },
//   changeImageButton: {
//     position: 'absolute',
//     bottom: 8,
//     right: 8,
//     backgroundColor: 'rgba(0,0,0,0.8)',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 8,
//   },
//   changeImageText: {
//     color: '#ffffff',
//     fontSize: 12,
//     fontWeight: '600',
//   },
  
//   // Navigation Styles
//   navigation: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     padding: 20,
//     borderTopWidth: 1,
//     shadowColor: 'rgba(0, 0, 0, 0.08)',
//     shadowOffset: { width: 0, height: -4 },
//     shadowOpacity: 0.12,
//     shadowRadius: 12,
//     elevation: 8,
//     ...(Platform.OS === 'web' && {
//       paddingBottom: 40, // Extra padding for web
//       minHeight: 80, // Ensure navigation has minimum height
//     }),
//   },
//   navButton: {
//     flex: 0.48,
//     paddingVertical: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     flexDirection: 'row',
//     gap: 8,
//     borderWidth: 1,
//   },
//   nextButton: {
//     flexDirection: 'row-reverse',
//   },
//   navButtonText: {
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   submitButton: {
//     flex: 0.48,
//     paddingVertical: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     flexDirection: 'row',
//     gap: 8,
//   },
//   submitButtonText: {
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });
