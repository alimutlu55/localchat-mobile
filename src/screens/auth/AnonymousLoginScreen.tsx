/**
 * Anonymous Login Screen
 *
 * Allows users to join without creating an account.
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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, User, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../features/auth';
import { onboardingService } from '../../services/onboarding';

export default function AnonymousLoginScreen() {
  const navigation = useNavigation();
  const { loginAnonymous, isLoading, error } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleContinue = async () => {
    if (!displayName.trim()) {
      return;
    }

    try {
      await loginAnonymous(displayName.trim());
      await onboardingService.markDeviceOnboarded();
    } catch (err) {
      console.error('[AnonymousLoginScreen] error:', err);
    }
  };

  const generateRandomName = () => {
    const adjectives = ['Happy', 'Swift', 'Clever', 'Bright', 'Calm', 'Bold', 'Kind', 'Wise'];
    const nouns = ['Traveler', 'Explorer', 'Dreamer', 'Wanderer', 'Seeker', 'Pioneer', 'Nomad'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    setDisplayName(`${adj}${noun}${num}`);
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
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <User size={32} color="#FF6410" />
            </View>
          </View>

          <Text style={styles.title}>Choose a display name</Text>
          <Text style={styles.subtitle}>
            This is how others will see you in chat rooms.
            You can change it anytime.
          </Text>

          <View style={styles.inputGroup}>
            <Pressable
              style={styles.inputContainer}
              onPress={() => inputRef.current?.focus()}
            >
              <Text style={[
                styles.floatingLabel,
                displayName && styles.floatingLabelActive
              ]}>
                Display Name
              </Text>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder=""
                placeholderTextColor="#9ca3af"
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={20}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.randomButton}
                onPress={generateRandomName}
              >
                <Sparkles size={20} color="#9ca3af" />
              </TouchableOpacity>
            </Pressable>

            <Text style={styles.hint}>
              Tip: Tap the sparkle icon for a random name
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton,
              (!displayName.trim() || isLoading) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!displayName.trim() || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#1f2937" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.infoText}>
            Anonymous accounts are device-specific.
            Create an account to sync across devices.
          </Text>
        </View>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
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
  randomButton: {
    padding: 8,
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    marginLeft: 4,
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
  continueButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

