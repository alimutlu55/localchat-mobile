/**
 * Splash Screen
 *
 * App intro screen matching web SplashScreen:
 * - Gradient background
 * - Logo with pin overlay
 * - "Continue Anonymously" + "Sign In" buttons
 * - Animated chat bubbles (optional)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { AppIcon } from '../components/ui/AppIcon';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const navigation = useNavigation<NavigationProp>();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Logo animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Button animation (delayed)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonSlideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);
  }, []);

  const handleContinueAnonymously = () => {
    navigation.navigate('Onboarding');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <LinearGradient
      colors={['#fff7ed', '#ffffff', '#fff1f2']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Animated background bubbles */}
        <View style={styles.bubblesContainer}>
          {[...Array(6)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bubble,
                {
                  left: `${15 + (i * 15) % 70}%`,
                  top: `${10 + (i * 12) % 60}%`,
                  width: 60 + (i * 10) % 40,
                  height: 60 + (i * 10) % 40,
                  opacity: 0.1 + (i * 0.05),
                },
              ]}
            />
          ))}
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <AppIcon size={128} rounded={true} />
            <View style={styles.pinBadge}>
              <MapPin size={16} color="#ffffff" />
            </View>
          </Animated.View>

          {/* App Name */}
          <Animated.View
            style={[
              styles.titleContainer,
              { opacity: fadeAnim },
            ]}
          >
            <Text style={styles.title}>BubbleUp</Text>
            <Text style={styles.subtitle}>Moments that matter</Text>
          </Animated.View>

          {/* No signup badge */}
          <Animated.View
            style={[
              styles.badge,
              { opacity: fadeAnim },
            ]}
          >
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>No signup required</Text>
          </Animated.View>
        </View>

        {/* CTA Buttons */}
        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: buttonFadeAnim,
              transform: [{ translateY: buttonSlideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleContinueAnonymously}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6410', '#e11d48']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Continue Anonymously</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSignIn} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Privacy note */}
        <Animated.View style={[styles.privacyContainer, { opacity: buttonFadeAnim }]}>
          <Text style={styles.privacyText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: '#FF6410',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6410',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  pinBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6410',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 44,
    fontWeight: '300',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  badgeText: {
    fontSize: 14,
    color: '#374151',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 16,
  },
  primaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6410',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#6b7280',
  },
  signInLink: {
    color: '#FF6410',
    textDecorationLine: 'underline',
  },
  privacyContainer: {
    paddingHorizontal: 48,
    paddingBottom: 24,
  },
  privacyText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
