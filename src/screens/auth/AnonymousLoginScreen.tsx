/**
 * Anonymous Login Screen
 *
 * Allows users to join without creating an account.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, User, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../features/auth';

export default function AnonymousLoginScreen() {
  const navigation = useNavigation();
  const { loginAnonymous, isLoading, error } = useAuth();
  const [displayName, setDisplayName] = useState('');

  const handleContinue = async () => {
    if (!displayName.trim()) {
      Alert.alert('Display Name Required', 'Please enter a display name to continue.');
      return;
    }

    if (displayName.trim().length < 2) {
      Alert.alert('Display Name Too Short', 'Display name must be at least 2 characters.');
      return;
    }

    try {
      await loginAnonymous(displayName.trim());
      // Navigation will be handled by RootNavigator based on auth state
    } catch (err) {
      Alert.alert('Error', 'Failed to continue. Please try again.');
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
          <View style={styles.iconContainer}>
            <User size={32} color="#f97316" />
          </View>

          <Text style={styles.title}>Choose a Display Name</Text>
          <Text style={styles.subtitle}>
            This is how others will see you in chat rooms.
            You can change it anytime.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter display name"
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
              <Sparkles size={20} color="#f97316" />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Tip: Tap the sparkle icon for a random name
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
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
              <ActivityIndicator color="#ffffff" />
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 16,
  },
  randomButton: {
    padding: 8,
  },
  hint: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  continueButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonDisabled: {
    backgroundColor: '#fdba74',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

