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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../features/auth';
import { onboardingService } from '../../services/onboarding';
import { AppIcon } from '../../components/ui/AppIcon';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
type LoginRouteProp = RouteProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LoginRouteProp>();
  const { email } = route.params;

  const { login, isLoading, error, clearError } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Animation for shake effect
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Combine local and store errors
  const displayError = localError || error;
  const hasError = !!displayError;

  /**
   * Shake the form on error
   */
  const shakeForm = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  /**
   * Clear all errors
   */
  const handleClearErrors = () => {
    setLocalError(null);
    clearError();
  };

  const handleLogin = async () => {
    handleClearErrors();

    if (!password) {
      setLocalError('Please enter your password');
      shakeForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      await login(email.trim(), password);
      // Mark device as onboarded
      await onboardingService.markDeviceOnboarded();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shakeForm();
    }
  };

  const getErrorMessage = (): string => {
    if (localError) return localError;
    if (error) {
      const lowerError = error.toLowerCase();
      if (lowerError.includes('invalid') || lowerError.includes('unauthorized') || lowerError.includes('wrong') || lowerError.includes('not found')) {
        return 'Incorrect email address or password';
      }
      return 'Something went wrong. Please try again';
    }
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateX: shakeAnimation }] }
          ]}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <AppIcon size={64} rounded={true} />
          </View>

          <Text style={styles.title}>Enter your password</Text>

          {/* Read-only Email Field */}
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailValue}>{email}</Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={[
              styles.inputContainer,
              hasError && styles.inputContainerError
            ]}>
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
                style={styles.input}
                placeholder=""
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  handleClearErrors();
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                autoFocus={true}
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
            </View>

            {/* Simple inline error message */}
            {hasError && (
              <View style={styles.inlineError}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={styles.inlineErrorText}>{getErrorMessage()}</Text>
              </View>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#1f2937" />
            ) : (
              <Text style={styles.loginButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </Animated.View>
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 32,
  },
  emailContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  emailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  emailValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  inputGroup: {
    marginBottom: 20,
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
  inputContainerError: {
    borderColor: '#ef4444',
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
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  inlineErrorText: {
    fontSize: 13,
    color: '#ef4444',
  },
  loginButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});
