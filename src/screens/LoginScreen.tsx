import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { CommonActions, useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const isLargeScreen = width > 768; // Tablet/laptop breakpoint

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  
  const { login, isAuthenticated } = useAuth();
  const navigation = useNavigation<any>();

  const goToApp = React.useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      }),
    );
  }, [navigation]);

  React.useEffect(() => {
    if (isAuthenticated) {
      goToApp();
    }
  }, [isAuthenticated, goToApp]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (result.success) {
        console.log('Login successful');
        goToApp();
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#0a0a0a', '#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        {/* Background Image for small screens */}
        {!isLargeScreen && (
          <View style={styles.backgroundImageContainer}>
            <Image
              source={require('../../assets/loadingcover.jpg')}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
            <View style={styles.backgroundOverlay} />
          </View>
        )}

        <ScrollView 
          style={[
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
          <View style={styles.mainContainer}>
            {/* Left Side - Login Form */}
            <Animated.View 
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to your Creativ Solar account</Text>
              </View>

              {/* Login Form */}
              <View style={styles.form}>
                {/* Username Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Username</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Enter your username"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      selectTextOnFocus={true}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      textContentType="username"
                    />
                    <View style={styles.inputGlow} />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      selectTextOnFocus={true}
                      returnKeyType="done"
                      textContentType="password"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeText}>
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.inputGlow} />
                  </View>
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                {/* Login Button */}
                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.disabledButton]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#22c55e', '#16a34a', '#15803d']}
                    style={styles.loginButtonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.loginButtonText}>Sign In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Register Link */}
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={handleRegister} disabled={isLoading}>
                  <Text style={styles.registerLink}>Contact Administrator</Text>
                </TouchableOpacity>
              </View>

              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devCalculatorLink}
                  onPress={() => navigation.navigate('CalculatorTestingPublic')}
                  disabled={isLoading}
                >
                  <Text style={styles.devCalculatorLinkText}>
                    Dev: Calculator Testing v4.4 (no login)
                  </Text>
                </TouchableOpacity>
              )}
              
              </View>
            </Animated.View>

            {/* Right Side - Image for large screens */}
            {isLargeScreen && (
              <Animated.View 
                style={[
                  styles.imageContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateX: slideAnim }]
                  }
                ]}
              >
                <View style={styles.imageWrapper}>
                  <Image
                    source={require('../../assets/creativ NB.png')}
                    style={styles.mainImage}
                    resizeMode="contain"
                  />
                  <View style={styles.imageGlow} />
                  <View style={styles.floatingElements}>
                    <View style={styles.floatingCircle1} />
                    <View style={styles.floatingCircle2} />
                    <View style={styles.floatingCircle3} />
                  </View>
                </View>
                <Text style={styles.imageTitle}>Creativ Solar</Text>
                <Text style={styles.imageSubtitle}>Powering the future with clean energy</Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContainer: {
    flex: 1,
    flexDirection: isLargeScreen ? 'row' : 'column',
    minHeight: height,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: isLargeScreen ? 40 : 20,
    paddingTop: isLargeScreen ? 40 : 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: isLargeScreen ? 42 : 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    textShadowColor: 'rgba(34, 197, 94, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: isLargeScreen ? 18 : 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    paddingRight: 50,
    zIndex: 2,
    position: 'relative',
    // Web-specific properties for better interaction
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none' as any,
      cursor: 'text' as any,
    }),
  },
  inputGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
    zIndex: 1,
    pointerEvents: 'none', // Prevent this overlay from blocking input interaction
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
    zIndex: 3,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  eyeText: {
    fontSize: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  registerLink: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  devCalculatorLink: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.45)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  devCalculatorLinkText: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Background image styles for small screens
  backgroundImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  // Image container styles for large screens
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  imageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60, // Increased from 30 to move text down
  },
  mainImage: {
    width: width * 0.3,
    height: width * 0.3,
    zIndex: 2,
  },
  imageGlow: {
    position: 'absolute',
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: width * 0.175,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    zIndex: 1,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  floatingElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  floatingCircle1: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: 40, // Reduced from 60
    height: 40, // Reduced from 60
    borderRadius: 20, // Reduced from 30
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  floatingCircle2: {
    position: 'absolute',
    bottom: '30%',
    left: '5%',
    width: 25, // Reduced from 40
    height: 25, // Reduced from 40
    borderRadius: 12.5, // Reduced from 20
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  floatingCircle3: {
    position: 'absolute',
    top: '60%',
    right: '20%',
    width: 20, // Reduced from 30
    height: 20, // Reduced from 30
    borderRadius: 10, // Reduced from 15
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  imageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  imageSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Skip to Dashboard Button Styles
  skipContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default LoginScreen;
