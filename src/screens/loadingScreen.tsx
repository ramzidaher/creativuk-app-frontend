import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList, 'Loading'>;

type Props = {
  navigation: NavigationProp;
};

export default function LoadingScreen({ navigation }: Props) {
  const { isAuthenticated, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  const textSlideAnim = useRef(new Animated.Value(30)).current;
  const circleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const greenPulseAnim = useRef(new Animated.Value(1)).current;
  const backgroundImageAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('LoadingScreen: Starting dramatic logo animation');
    
    // Background image fade in
    Animated.timing(backgroundImageAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Main fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    // Slide up animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 1000,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    // Dramatic logo entrance sequence
    Animated.sequence([
      Animated.delay(500), // Wait for background to settle
      
      // Step 1: Logo appears with scale and opacity
      Animated.parallel([
        Animated.timing(logoOpacityAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScaleAnim, {
          toValue: 1.2, // Overshoot for bounce effect
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      
      // Step 2: Logo settles to normal size
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      
      // Step 3: Rotation and glow effects
      Animated.parallel([
        Animated.timing(logoRotateAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start();

    // Text slide animation (delayed until logo appears)
    Animated.sequence([
      Animated.delay(1800), // Wait for logo animation to complete
      Animated.timing(textSlideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Circle animation
    Animated.loop(
      Animated.timing(circleAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation (starts after logo appears)
    Animated.sequence([
      Animated.delay(2000),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    // Green pulse animation (starts after logo appears)
    Animated.sequence([
      Animated.delay(2200),
      Animated.loop(
        Animated.sequence([
          Animated.timing(greenPulseAnim, {
            toValue: 1.2,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(greenPulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();

    // Wave animation
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ).start();

    // Do not navigate here; allow React Navigation to mount with deep link state
    // Once auth completes, AppNavigator will mount the stack and linking will handle the route
  }, [navigation, isAuthenticated, isLoading]);

  const circleRotation = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const logoRotation = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  const waveTranslateY = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -10, 0],
  });

  const greenPulseScale = greenPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Image */}
      <Animated.View style={[styles.backgroundImageContainer, { opacity: backgroundImageAnim }]}>
        <Image
          source={require('../../assets/loadingcover.jpg')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(10, 10, 10, 0.7)', 'rgba(26, 26, 26, 0.8)', 'rgba(42, 42, 42, 0.9)']}
          style={styles.overlay}
        />
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Animated Circles Background */}
        <View style={styles.circlesContainer}>
          <Animated.View
            style={[
              styles.circle1,
              {
                transform: [{ rotate: circleRotation }]
              }
            ]}
          />
          <Animated.View
            style={[
              styles.circle2,
              {
                transform: [{ rotate: circleRotation }]
              }
            ]}
          />
          <Animated.View
            style={[
              styles.circle3,
              {
                transform: [{ rotate: circleRotation }]
              }
            ]}
          />
        </View>

        {/* Logo Section with Dramatic Entrance */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoOpacityAnim,
              transform: [
                { scale: logoScaleAnim },
                { rotate: logoRotation },
                { scale: pulseAnim }
              ]
            }
          ]}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/creativ NB.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            {/* Enhanced Glow Effect */}
            <Animated.View
              style={[
                styles.logoGlow,
                {
                  opacity: logoGlowAnim,
                  transform: [{ scale: greenPulseScale }]
                }
              ]}
            />
            
            {/* Green Accent Ring */}
            <Animated.View
              style={[
                styles.greenRing,
                {
                  transform: [{ scale: greenPulseScale }]
                }
              ]}
            />
          </View>
        </Animated.View>

        {/* Text Section */}
        <Animated.View 
          style={[
            styles.textSection,
            {
              transform: [{ translateY: textSlideAnim }]
            }
          ]}
        >
          <Text style={styles.mainTitle}>Welcome to</Text>
          <Text style={styles.brandTitle}>Creativ Solar</Text>
        </Animated.View>

        {/* Loading Indicator */}
        <View style={styles.loadingSection}>
          <View style={styles.loadingDots}>
            {[0, 1, 2].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    transform: [
                      {
                        translateY: waveAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0, -8, 0],
                        })
                      }
                    ],
                    opacity: waveAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.3, 1, 0.3],
                    })
                  }
                ]}
              />
            ))}
          </View>
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  circlesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  circle1: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.1)',
  },
  circle2: {
    position: 'absolute',
    bottom: '30%',
    left: '5%',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.08)',
  },
  circle3: {
    position: 'absolute',
    top: '60%',
    right: '20%',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.06)',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
    zIndex: 2,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.18,
    height: width * 0.18,
    zIndex: 3,
  },
  logoGlow: {
    position: 'absolute',
    width: width * 0.22,
    height: width * 0.22,
    borderRadius: width * 0.11,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    zIndex: 1,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8,
  },
  greenRing: {
    position: 'absolute',
    width: width * 0.26,
    height: width * 0.26,
    borderRadius: width * 0.13,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    zIndex: 2,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 60,
    zIndex: 2,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingSection: {
    alignItems: 'center',
    marginBottom: 40,
    zIndex: 2,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    marginHorizontal: 4,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
  },
});
