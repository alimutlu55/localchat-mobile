/**
 * Register Screen
 *
 * Account registration form.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { openTermsOfService, openPrivacyPolicy } from '../../shared/utils/legal';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../features/auth';
import { onboardingService } from '../../services/onboarding';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { register, isLoading, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const displayError = localError || error;

  const validateForm = (): boolean => {
    if (!displayName.trim()) {
      setLocalError('Please enter a display name');
      return false;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email address');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setLocalError('Please enter a password');
      return false;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleRegister = async () => {
    clearError();
    if (!validateForm()) return;

    try {
      await register(email.trim(), password, displayName.trim());
      await onboardingService.markDeviceOnboarded();

      // Explicitly reset to MainFlow to ensure we exit the auth stack
      // (Required when navigating from RegistrationAuth in the App Flow)
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'MainFlow' as any }],
      });
    } catch (err) {
      // Error handled by useAuth
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Join the community and start connecting
            </Text>

            {/* Display Name Input */}
            <View style={styles.inputGroup}>
              <Pressable
                style={styles.inputContainer}
                onPress={() => displayNameRef.current?.focus()}
              >
                <Text
                  style={[
                    styles.floatingLabel,
                    displayName ? styles.floatingLabelActive : {}
                  ]}
                  pointerEvents="none"
                >
                  Display Name
                </Text>
                <TextInput
                  ref={displayNameRef}
                  style={styles.input}
                  placeholder=""
                  placeholderTextColor="#9ca3af"
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    setLocalError(null);
                    clearError();
                  }}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Pressable>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Pressable
                style={styles.inputContainer}
                onPress={() => emailRef.current?.focus()}
              >
                <Text
                  style={[
                    styles.floatingLabel,
                    email ? styles.floatingLabelActive : {}
                  ]}
                  pointerEvents="none"
                >
                  Email
                </Text>
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder=""
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setLocalError(null);
                    clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </Pressable>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Pressable
                style={styles.inputContainer}
                onPress={() => passwordRef.current?.focus()}
              >
                <Text
                  style={[
                    styles.floatingLabel,
                    password ? styles.floatingLabelActive : {}
                  ]}
                  pointerEvents="none"
                >
                  Password
                </Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder=""
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setLocalError(null);
                    clearError();
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="oneTimeCode"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#9ca3af" />
                  ) : (
                    <Eye size={20} color="#9ca3af" />
                  )}
                </TouchableOpacity>
              </Pressable>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Pressable
                style={styles.inputContainer}
                onPress={() => confirmPasswordRef.current?.focus()}
              >
                <Text
                  style={[
                    styles.floatingLabel,
                    confirmPassword ? styles.floatingLabelActive : {}
                  ]}
                  pointerEvents="none"
                >
                  Confirm Password
                </Text>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder=""
                  placeholderTextColor="#9ca3af"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setLocalError(null);
                    clearError();
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="oneTimeCode"
                />
              </Pressable>
            </View>

            {/* Error Message */}
            {displayError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                isLoading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <Text style={styles.registerButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Legal Links */}
            <Text style={styles.consentText}>
              <Text style={styles.consentLink} onPress={openTermsOfService}>
                Terms of Service
              </Text>
              {' · '}
              <Text style={styles.consentLink} onPress={openPrivacyPolicy}>
                Privacy Policy
              </Text>
            </Text>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmailEntry')}>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 22,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    position: 'relative',
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    top: 18,
    fontSize: 16,
    color: '#9ca3af',
    zIndex: 1,
  },
  floatingLabelActive: {
    top: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingTop: 24,
    paddingBottom: 12,
  },
  errorContainer: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
  },
  registerButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  loginText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  consentText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  consentLink: {
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});

