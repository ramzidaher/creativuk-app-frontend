// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   FlatList,
//   Alert,
//   ActivityIndicator,
//   SafeAreaView,
//   Platform,
//   ScrollView,
//   Linking,
// } from 'react-native';
// import { useNavigation, useRoute } from '@react-navigation/native';
// import { Ionicons } from '@expo/vector-icons';

// interface RouteParams {
//   opportunityId: string;
// }

// interface OpenSolarProject {
//   id: number;
//   address?: string;
//   display_name?: string;
//   name?: string;
// }

// export default function OpenSolarIntegrationScreen() {
//   const navigation = useNavigation<any>();
//   const route = useRoute();
//   const { opportunityId } = route.params as RouteParams;
  
//   const [step, setStep] = useState<'main' | 'search' | 'select' | 'loading' | 'linked'>('main');
//   const [searchAddress, setSearchAddress] = useState('');
//   const [projects, setProjects] = useState<OpenSolarProject[]>([]);
//   const [selectedProject, setSelectedProject] = useState<OpenSolarProject | null>(null);
//   const [linkedProject, setLinkedProject] = useState<any>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     // Check if we already have OpenSolar data for this opportunity
//     checkExistingProject();
//   }, []);

//   const checkExistingProject = async () => {
//     try {
//       const { api } = await import('../utils/api');
//       const response: any = await api.get(`/opensolar/opportunity/${opportunityId}`);
      
//       if (response.data?.success && response.data?.data) {
//         // We have existing OpenSolar data, show linked state
//         setLinkedProject(response.data.data);
//         setStep('linked');
//       }
//     } catch (error) {
//       // No existing project, show main options
//       console.log('No existing OpenSolar project found');
//     }
//   };

//   const handleCreateProject = () => {
//     // Open OpenSolar in browser
//     Linking.openURL('https://app.opensolar.com');
//   };

//   const handleSearchProjects = () => {
//     setStep('search');
//   };

//   const handleSearch = async () => {
//     console.log('🔍 handleSearch called with address:', searchAddress);
    
//     if (!searchAddress.trim()) {
//       console.log('❌ No address entered');
//       Alert.alert('Error', 'Please enter an address to search');
//       return;
//     }

//     console.log('🔍 Starting search for address:', searchAddress.trim());
//     setLoading(true);
//     setError(null);

//     try {
//       console.log('🔍 Importing API module...');
//       const { api } = await import('../utils/api');
//       console.log('🔍 API module imported successfully');
      
//       console.log('🔍 Making POST request to /opensolar/search...');
//       const response: any = await api.post('/opensolar/search', {
//         address: searchAddress.trim()
//       });
      
//       console.log('🔍 Search response received:', response);
//       console.log('🔍 Response success:', response.data?.success);
//       console.log('🔍 Response data:', response.data?.data);
//       console.log('🔍 Response message:', response.data?.message);

//       if (response.data?.success) {
//         console.log('✅ Search successful, setting projects and moving to select step');
//         console.log('🔍 Raw projects data:', JSON.stringify(response.data.data, null, 2));
        
//         // Validate and normalize the projects data
//         const projects = response.data.data || [];
//         console.log('🔍 Number of projects found:', projects.length);
        
//         if (projects.length > 0) {
//           console.log('🔍 First project structure:');
//           console.log('  - ID:', projects[0].id, '(type:', typeof projects[0].id, ')');
//           console.log('  - Name:', projects[0].display_name || projects[0].name);
//           console.log('  - Address:', projects[0].address);
//           console.log('  - Full object:', JSON.stringify(projects[0], null, 2));
//         }
        
//         setProjects(projects);
//         setStep('select');
//       } else {
//         console.log('❌ Search failed:', response.data?.message);
//         setError(response.data?.message || 'Failed to search projects');
//       }
//     } catch (error: any) {
//       console.error('❌ Error searching OpenSolar projects:', error);
//       console.error('❌ Error details:', {
//         message: error.message,
//         stack: error.stack,
//         response: error.response?.data
//       });
//       setError('Failed to search OpenSolar projects');
//     } finally {
//       console.log('🔍 Search completed, setting loading to false');
//       setLoading(false);
//     }
//   };

//   const handleProjectSelect = async (project: OpenSolarProject) => {
//     console.log('🔍 handleProjectSelect called with project:', project);
//     console.log('🔍 Project ID:', project.id, '(type:', typeof project.id, ')');
//     console.log('🔍 Project name:', project.display_name || project.name);
//     console.log('🔍 Project address:', project.address);
    
//     setSelectedProject(project);
//     setLoading(true);

//     try {
//       const { api } = await import('../utils/api');
//       console.log('🔍 Making save-project request with:', {
//         opportunityId,
//         opensolarProjectId: project.id
//       });
      
//       const response: any = await api.post('/opensolar/save-project', {
//         opportunityId,
//         opensolarProjectId: project.id
//       });

//       if (response.data?.success) {
//         // Mark OpenSolar step as completed
//         const { workflowApi } = await import('../utils/api');
//         await workflowApi.completeStep(opportunityId, 2, {
//           opensolarProjectId: project.id,
//           projectName: project.display_name || project.name || `Project ${project.id}`,
//           completedAt: new Date().toISOString()
//         });

//         // Set linked project and show success
//         setLinkedProject({
//           projectId: project.id,
//           projectName: project.display_name || project.name || `Project ${project.id}`,
//           address: project.address
//         });
//         setStep('linked');
//       } else {
//         setError(response.data?.message || 'Failed to save project');
//         setStep('select');
//       }
//     } catch (error) {
//       console.error('Error saving OpenSolar project:', error);
//       setError('Failed to save OpenSolar project');
//       setStep('select');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleBack = () => {
//     if (step === 'select') {
//       setStep('search');
//       setProjects([]);
//       setSelectedProject(null);
//     } else if (step === 'search') {
//       setStep('main');
//       setSearchAddress('');
//       setError(null);
//     } else {
//       navigation.goBack();
//     }
//   };

//   const handleContinueToCalculator = () => {
//     navigation.goBack();
//   };

//   const renderProjectItem = ({ item }: { item: OpenSolarProject }) => (
//     <TouchableOpacity
//       style={styles.projectItem}
//       onPress={() => handleProjectSelect(item)}
//       disabled={loading}
//     >
//       <View style={styles.projectInfo}>
//         <Text style={styles.projectName}>
//           {item.display_name || item.name || `Project ${item.id}`}
//         </Text>
//         {item.address && (
//           <Text style={styles.projectAddress}>{item.address}</Text>
//         )}
//         <Text style={styles.projectId}>Project ID: {item.id}</Text>
//       </View>
//       <Ionicons name="chevron-forward" size={20} color="#64748b" />
//     </TouchableOpacity>
//   );

//   if (step === 'loading') {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#B4F35B" />
//           <Text style={styles.loadingText}>Linking OpenSolar project...</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (step === 'linked') {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.header}>
//           <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//             <Ionicons name="arrow-back" size={24} color="#1e293b" />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>OpenSolar Integration</Text>
//           <View style={styles.headerSpacer} />
//         </View>

//         <View style={styles.linkedContainer}>
//           <View style={styles.successCard}>
//             <View style={styles.successIcon}>
//               <Ionicons name="checkmark-circle" size={60} color="#10b981" />
//             </View>
//             <Text style={styles.linkedTitle}>Project Successfully Linked!</Text>
//             <Text style={styles.linkedSubtitle}>
//               Your OpenSolar project has been connected to this opportunity.
//             </Text>
//           </View>

//           <View style={styles.projectCard}>
//             <Text style={styles.projectCardTitle}>🌞 Linked Project</Text>
//             <Text style={styles.projectCardName}>
//               {linkedProject?.projectName || `Project ${linkedProject?.projectId}`}
//             </Text>
//             {linkedProject?.address && (
//               <Text style={styles.projectCardAddress}>{linkedProject.address}</Text>
//             )}
//             <Text style={styles.projectCardId}>Project ID: {linkedProject?.projectId}</Text>
//           </View>

//           <View style={styles.linkedActions}>
//             <TouchableOpacity style={styles.relinkButton} onPress={() => setStep('main')}>
//               <Ionicons name="refresh" size={20} color="#1e293b" />
//               <Text style={styles.relinkButtonText}>Link Different Project</Text>
//             </TouchableOpacity>
            
//             <TouchableOpacity style={styles.continueButton} onPress={handleContinueToCalculator}>
//               <Text style={styles.continueButtonText}>Continue to Calculator</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.header}>
//         <TouchableOpacity style={styles.backButton} onPress={handleBack}>
//           <Ionicons name="arrow-back" size={24} color="#1e293b" />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>
//           {step === 'main' ? 'OpenSolar Integration' : 
//            step === 'search' ? 'Search Projects' : 'Select Project'}
//         </Text>
//         <View style={styles.headerSpacer} />
//       </View>

//       <ScrollView 
//         style={styles.scrollView}
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scrollViewContent}
//       >
//         {error && (
//           <View style={styles.errorContainer}>
//             <Text style={styles.errorText}>{error}</Text>
//           </View>
//         )}

//         {step === 'main' && (
//           <View style={styles.mainContainer}>
//             <View style={styles.introSection}>
//               <Text style={styles.introTitle}>Connect Your OpenSolar Project</Text>
//               <Text style={styles.introSubtitle}>
//                 Link your existing OpenSolar project or create a new one to automatically import your solar design data.
//               </Text>
//             </View>

//             <View style={styles.optionsContainer}>
//               <TouchableOpacity style={styles.optionCard} onPress={handleCreateProject}>
//                 <View style={styles.optionIcon}>
//                   <Ionicons name="add-circle" size={32} color="#B4F35B" />
//                 </View>
//                 <Text style={styles.optionTitle}>Create New Project</Text>
//                 <Text style={styles.optionSubtitle}>
//                   Open OpenSolar to create a new project for this opportunity
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity style={styles.optionCard} onPress={handleSearchProjects}>
//                 <View style={styles.optionIcon}>
//                   <Ionicons name="search" size={32} color="#B4F35B" />
//                 </View>
//                 <Text style={styles.optionTitle}>Search Existing Project</Text>
//                 <Text style={styles.optionSubtitle}>
//                   Find and link an existing OpenSolar project by address
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         )}

//         {step === 'search' && (
//           <View style={styles.searchContainer}>
//             <View style={styles.searchSection}>
//               <Text style={styles.searchTitle}>Search for Your Project</Text>
//               <Text style={styles.searchSubtitle}>
//                 Enter the address used in your OpenSolar project to find and link it.
//               </Text>
//             </View>

//             <View style={styles.searchForm}>
//               <TextInput
//                 style={styles.searchInput}
//                 placeholder="Enter project address..."
//                 value={searchAddress}
//                 onChangeText={setSearchAddress}
//                 multiline
//                 numberOfLines={3}
//               />
              
//               <TouchableOpacity
//                 style={[styles.searchButton, loading && styles.searchButtonDisabled]}
//                 onPress={() => {
//                   console.log('🔍 Search button pressed');
//                   handleSearch();
//                 }}
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <ActivityIndicator size="small" color="#ffffff" />
//                 ) : (
//                   <>
//                     <Ionicons name="search" size={20} color="#ffffff" />
//                     <Text style={styles.searchButtonText}>Search Projects</Text>
//                   </>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </View>
//         )}

//         {step === 'select' && (
//           <View style={styles.selectContainer}>
//             <View style={styles.selectSection}>
//               <Text style={styles.selectTitle}>Select Your Project</Text>
//               <Text style={styles.selectSubtitle}>
//                 Found {projects.length} project(s) for "{searchAddress}"
//               </Text>
//             </View>
            
//             {projects.length === 0 ? (
//               <View style={styles.noResultsContainer}>
//                 <Ionicons name="search-outline" size={48} color="#94a3b8" />
//                 <Text style={styles.noResultsText}>No projects found</Text>
//                 <Text style={styles.noResultsSubtext}>
//                   Try searching with a different address or create a new project in OpenSolar.
//                 </Text>
//               </View>
//             ) : (
//               <FlatList
//                 data={projects}
//                 renderItem={renderProjectItem}
//                 keyExtractor={(item) => item.id.toString()}
//                 style={styles.projectsList}
//                 showsVerticalScrollIndicator={false}
//                 scrollEnabled={false}
//               />
//             )}
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f8fafc',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     backgroundColor: '#ffffff',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e2e8f0',
//   },
//   backButton: {
//     padding: 8,
//     borderRadius: 8,
//     backgroundColor: '#f1f5f9',
//   },
//   headerTitle: {
//     flex: 1,
//     fontSize: 18,
//     fontWeight: '600',
//     textAlign: 'center',
//     color: '#1e293b',
//     marginHorizontal: 16,
//   },
//   headerSpacer: {
//     width: 40,
//   },
//   errorContainer: {
//     backgroundColor: '#fef2f2',
//     borderWidth: 1,
//     borderColor: '#fecaca',
//     borderRadius: 12,
//     padding: 16,
//     margin: 20,
//   },
//   errorText: {
//     color: '#dc2626',
//     fontSize: 14,
//     textAlign: 'center',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 40,
//   },
//   loadingText: {
//     fontSize: 16,
//     fontWeight: '500',
//     color: '#64748b',
//     marginTop: 16,
//     textAlign: 'center',
//   },
//   mainContainer: {
//     flex: 1,
//     padding: 20,
//   },
//   introSection: {
//     marginBottom: 32,
//   },
//   introTitle: {
//     fontSize: 24,
//     fontWeight: '700',
//     color: '#1e293b',
//     marginBottom: 8,
//   },
//   introSubtitle: {
//     fontSize: 16,
//     color: '#64748b',
//     lineHeight: 24,
//   },
//   optionsContainer: {
//     gap: 16,
//   },
//   optionCard: {
//     backgroundColor: '#ffffff',
//     borderRadius: 16,
//     padding: 24,
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   optionIcon: {
//     marginBottom: 16,
//   },
//   optionTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#1e293b',
//     marginBottom: 8,
//   },
//   optionSubtitle: {
//     fontSize: 14,
//     color: '#64748b',
//     lineHeight: 20,
//   },
//   searchContainer: {
//     flex: 1,
//     padding: 20,
//   },
//   searchSection: {
//     marginBottom: 32,
//   },
//   searchTitle: {
//     fontSize: 24,
//     fontWeight: '700',
//     color: '#1e293b',
//     marginBottom: 8,
//   },
//   searchSubtitle: {
//     fontSize: 16,
//     color: '#64748b',
//     lineHeight: 24,
//   },
//   searchForm: {
//     gap: 16,
//   },
//   searchInput: {
//     backgroundColor: '#ffffff',
//     borderWidth: 1,
//     borderColor: '#d1d5db',
//     borderRadius: 12,
//     padding: 16,
//     fontSize: 16,
//     minHeight: 80,
//     textAlignVertical: 'top',
//   },
//   searchButton: {
//     backgroundColor: '#B4F35B',
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 16,
//     borderRadius: 12,
//   },
//   searchButtonDisabled: {
//     opacity: 0.6,
//   },
//   searchButtonText: {
//     color: '#1e293b',
//     fontSize: 16,
//     fontWeight: '600',
//     marginLeft: 8,
//   },
//   selectContainer: {
//     flex: 1,
//     padding: 20,
//   },
//   selectSection: {
//     marginBottom: 24,
//   },
//   selectTitle: {
//     fontSize: 24,
//     fontWeight: '700',
//     color: '#1e293b',
//     marginBottom: 8,
//   },
//   selectSubtitle: {
//     fontSize: 16,
//     color: '#64748b',
//   },
//   projectsList: {
//     flex: 1,
//   },
//   projectItem: {
//     backgroundColor: '#ffffff',
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 12,
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//   },
//   projectInfo: {
//     flex: 1,
//   },
//   projectName: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#1e293b',
//     marginBottom: 4,
//   },
//   projectAddress: {
//     fontSize: 14,
//     color: '#64748b',
//     marginBottom: 4,
//   },
//   projectId: {
//     fontSize: 12,
//     color: '#94a3b8',
//   },
//   noResultsContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 40,
//   },
//   noResultsText: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#1e293b',
//     marginTop: 16,
//     marginBottom: 8,
//   },
//   noResultsSubtext: {
//     fontSize: 14,
//     color: '#64748b',
//     textAlign: 'center',
//     lineHeight: 20,
//   },
//   linkedContainer: {
//     flex: 1,
//     padding: 20,
//   },
//   successCard: {
//     backgroundColor: '#ffffff',
//     borderRadius: 16,
//     padding: 24,
//     alignItems: 'center',
//     marginBottom: 24,
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   successIcon: {
//     marginBottom: 16,
//   },
//   linkedTitle: {
//     fontSize: 20,
//     fontWeight: '600',
//     color: '#1e293b',
//     marginBottom: 8,
//     textAlign: 'center',
//   },
//   linkedSubtitle: {
//     fontSize: 14,
//     color: '#64748b',
//     textAlign: 'center',
//     lineHeight: 20,
//   },
//   projectCard: {
//     backgroundColor: '#f0f9ff',
//     borderWidth: 1,
//     borderColor: '#0ea5e9',
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 32,
//   },
//   projectCardTitle: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#0c4a6e',
//     marginBottom: 8,
//   },
//   projectCardName: {
//     fontSize: 14,
//     fontWeight: '500',
//     color: '#0369a1',
//     marginBottom: 8,
//   },
//   projectCardAddress: {
//     fontSize: 12,
//     color: '#64748b',
//     marginBottom: 4,
//   },
//   projectCardId: {
//     fontSize: 12,
//     color: '#94a3b8',
//   },
//   continueButton: {
//     backgroundColor: '#B4F35B',
//     paddingVertical: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//   },
//   continueButtonText: {
//     color: '#1e293b',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   linkedActions: {
//     gap: 12,
//   },
//   relinkButton: {
//     backgroundColor: '#f1f5f9',
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 16,
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: '#cbd5e1',
//   },
//   relinkButtonText: {
//     color: '#1e293b',
//     fontSize: 16,
//     fontWeight: '600',
//     marginLeft: 8,
//   },
//   scrollView: {
//     flex: 1,
//   },
//   scrollViewContent: {
//     paddingBottom: 20, // Add some padding at the bottom for the last section
//   },
// });
