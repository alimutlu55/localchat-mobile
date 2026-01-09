/**
 * Welcome Screen
 *
 * First screen users see - allows them to choose login method.
 * For returning anonymous users (device already onboarded), skips to direct login.
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, User } from 'lucide-react-native';
import * as Location from 'expo-location';
import { AuthStackParamList } from '../../navigation/types';
import { onboardingService } from '../../services/onboarding';
import { storage } from '../../services/storage';
import { useAuth } from '../../features/auth';
import { GoogleSignInButton } from '../../components/auth';
import { getLocationPermissionStore } from '../../shared/stores/LocationConsentStore';
import { AppIcon } from '../../components/ui/AppIcon';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { loginAnonymous, tryRestoreAnonymousSession, isLoading: authLoading, error, clearError } = useAuth();

  // Start as false to avoid showing loading state when arriving from logout
  // The loading state was causing a flicker during the logout → welcome transition
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);
  const [isDirectLoginLoading, setIsDirectLoginLoading] = useState(false);
  const hasCheckedRef = useRef(false);

  // Use useFocusEffect to only run when this screen is actually focused
  // This prevents auto-login from triggering when user is on Login/Register screen
  useFocusEffect(
    useCallback(() => {
      // Simply show the welcome screen - no auto-login
      // User must explicitly tap "Continue Anonymously" to login anonymously
      clearError();
      setIsCheckingDevice(false);

      return () => {
        // Cleanup if needed
      };
    }, [clearError])
  );



  /**
   * Handle "Continue Anonymously" button press.
   * Always checks backend first to see if an existing anonymous account exists for this device.
   * If found, restores it silently. If not, proceeds to display name entry.
   */
  const handleContinueAnonymously = async () => {
    // Clear any stale errors
    clearError();
    setIsDirectLoginLoading(true);

    try {
      // 1. Always attempt backend restoration first
      // This is the source of truth and works after reinstalls
      const { user, isNewUser } = await tryRestoreAnonymousSession();

      if (!isNewUser && user) {
        // Success! User is restored and RootNavigator will take them to the app
        return;
      }

      // 2. No existing user - take to display name entry
      console.log('[WelcomeScreen] No existing session found, showing onboarding');
      navigation.navigate('AnonymousLogin');
    } catch (error) {
      console.error('[WelcomeScreen] Failed to handle anonymous continuation:', error);
      // Fallback: take to display name entry anyway
      navigation.navigate('AnonymousLogin');
    } finally {
      setIsDirectLoginLoading(false);
    }
  };

  // Show loading while checking device status or performing direct login
  if (isCheckingDevice || isDirectLoginLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.logoContainer}>
            <AppIcon size={64} rounded={true} />
          </View>
          <Text style={styles.title}>BubbleUp</Text>
          <ActivityIndicator size="large" color="#FF6410" style={styles.loader} />
          <Text style={styles.loadingText}>
            {isDirectLoginLoading ? 'Signing you in...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <AppIcon size={64} rounded={true} />
          </View>
          <Text style={styles.title}>Welcome to BubbleUp</Text>
          <Text style={styles.subtitle}>
            Moments that matter.{'\n'}Connect with people nearby.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
            onPress={() => navigation.navigate('EmailEntry')}
            activeOpacity={0.8}
            disabled={authLoading}
          >
            <Mail size={20} color="#1f2937" />
            <Text style={styles.primaryButtonText}>Sign in with Email</Text>
          </TouchableOpacity>

          <GoogleSignInButton
            onError={(error) => console.error('Google sign-in error:', error)}
            disabled={authLoading}
          />

          <TouchableOpacity
            style={[styles.secondaryButton, authLoading && styles.buttonDisabled]}
            onPress={handleContinueAnonymously}
            activeOpacity={0.8}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#374151" />
            ) : (
              <>
                <User size={20} color="#374151" />
                <Text style={styles.secondaryButtonText}>Continue Anonymously</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer - Legal Links */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          <Text style={styles.footerLink} onPress={() => navigation.navigate('TermsOfService')}>
            Terms of Service
          </Text>
          {' · '}
          <Text style={styles.footerLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loader: {
    marginTop: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  signupText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6410',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
});
