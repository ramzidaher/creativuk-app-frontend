import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  Dimensions, 
  Animated,
  Image,
  Platform 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const isLargeScreen = width > 768;

interface LoadingScreenProps {
  message?: string;
  size?: 'small' | 'large';
}

export default function LoadingScreen({ message = 'Loading...', size = 'large' }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entrance animations
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Start continuous rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
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

        <View style={styles.mainContainer}>
          {/* Left Side - Loading Content */}
          <Animated.View 
            style={[
              styles.loadingContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome to Creativ Solar</Text>
              <Text style={styles.subtitle}>Initializing your dashboard...</Text>
            </View>

            {/* Loading Content */}
            <View style={styles.loadingContent}>
              {/* Animated Logo */}
              <Animated.View 
                style={[
                  styles.logoContainer,
                  { transform: [{ rotate: spin }] }
                ]}
              >
                <View style={styles.logoWrapper}>
                  <Image
                    source={require('../../assets/creativ NB.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <View style={styles.logoGlow} />
                </View>
              </Animated.View>

              {/* Loading Indicator */}
              <View style={styles.indicatorContainer}>
                <ActivityIndicator size={size} color="#22c55e" />
                <Text style={styles.message}>{message}</Text>
              </View>

              {/* Progress Dots */}
              <View style={styles.progressContainer}>
                <Animated.View style={[styles.progressDot, { opacity: fadeAnim }]} />
                <Animated.View style={[styles.progressDot, { opacity: fadeAnim }]} />
                <Animated.View style={[styles.progressDot, { opacity: fadeAnim }]} />
              </View>
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
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    flexDirection: isLargeScreen ? 'row' : 'column',
    minHeight: height,
  },
  loadingContainer: {
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
  loadingContent: {
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
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    zIndex: 1,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 60,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  floatingCircle2: {
    position: 'absolute',
    bottom: '30%',
    left: '5%',
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  floatingCircle3: {
    position: 'absolute',
    top: '60%',
    right: '20%',
    width: 20,
    height: 20,
    borderRadius: 10,
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
}); 