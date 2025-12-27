/**
 * Edit Profile Screen
 *
 * User profile editing form with:
 * - Avatar picker (DiceBear)
 * - Display name editing
 * - Bio field
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Camera, User, Mail, Shield, FileText, Check } from 'lucide-react-native';
import { useAuth } from '../features/auth';
import { useCurrentUser } from '../features/user/store';
import { AvatarPicker, UpgradeBenefitsModal, AvatarDisplay } from '../components/profile';

const MAX_DISPLAY_NAME_LENGTH = 30;
const MAX_BIO_LENGTH = 150;
const AUTO_SAVE_DELAY = 1000;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { updateProfile } = useAuth();
  const user = useCurrentUser();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.profilePhotoUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [isBioSaved, setIsBioSaved] = useState(false);

  const nameChanged = displayName.trim() !== (user?.displayName || '');
  const bioChanged = bio.trim() !== (user?.bio || '');
  const hasUnsavedChanges = nameChanged || bioChanged;

  /**
   * Navigation Guard
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them and leave?',
        [
          { text: "Don't leave", style: 'cancel', onPress: () => { } },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  /**
   * Handle display name change
   */
  const handleDisplayNameChange = (text: string) => {
    if (text.length <= MAX_DISPLAY_NAME_LENGTH) {
      setDisplayName(text);
    }
  };

  /**
   * Handle bio change
   */
  const handleBioChange = (text: string) => {
    if (text.length <= MAX_BIO_LENGTH) {
      setBio(text);
    }
  };

  /**
   * Save Display Name
   */
  const handleSaveName = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    if (displayName.trim().length < 2) {
      Alert.alert('Error', 'Display name must be at least 2 characters.');
      return;
    }

    setIsSavingName(true);
    try {
      await updateProfile({ displayName: displayName.trim() });
      setIsNameSaved(true);
      setTimeout(() => setIsNameSaved(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to update display name.');
    } finally {
      setIsSavingName(false);
    }
  };

  /**
   * Save Bio
   */
  const handleSaveBio = async () => {
    setIsSavingBio(true);
    try {
      await updateProfile({ bio: bio.trim() });
      setIsBioSaved(true);
      setTimeout(() => setIsBioSaved(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to update bio.');
    } finally {
      setIsSavingBio(false);
    }
  };

  /**
   * Handle avatar selection - Saves immediately
   */
  const handleAvatarSelect = async (url: string) => {
    setIsLoading(true);
    try {
      await updateProfile({ profilePhotoUrl: url });
      setAvatarUrl(url);
      Alert.alert('Success', 'Avatar updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update avatar.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle upgrade
   */
  const handleUpgrade = async () => {
    setShowUpgradeModal(false);
    setIsLoading(true);
    try {
      // @ts-ignore
      await user?.isAnonymous ? Alert.alert('Info', 'In a real app, this would start the registration flow.') : null;
      navigation.navigate('Onboarding');
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate upgrade.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => setShowAvatarPicker(true)}>
              <View style={styles.avatar}>
                <AvatarDisplay
                  avatarUrl={avatarUrl}
                  displayName={displayName}
                  size="xl"
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              </View>
              <View style={styles.avatarEditBadge}>
                <Camera size={14} color="#ffffff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change avatar</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Display Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Display Name</Text>
                <Text style={styles.charCount}>{displayName.length}/{MAX_DISPLAY_NAME_LENGTH}</Text>
              </View>
              <View style={styles.inputContainer}>
                <User size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter display name"
                  placeholderTextColor="#9ca3af"
                  value={displayName}
                  onChangeText={handleDisplayNameChange}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  autoCapitalize="none"
                />
                {(nameChanged || isSavingName || isNameSaved) && (
                  <TouchableOpacity
                    onPress={handleSaveName}
                    disabled={isSavingName || isNameSaved}
                    style={[styles.saveButton, isNameSaved && styles.saveButtonSuccess]}
                  >
                    {isSavingName ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {isNameSaved ? 'Saved' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.inputHint}>
                This is how others will see you in chat rooms.
              </Text>
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Bio</Text>
                <Text style={styles.charCount}>{bio.length}/{MAX_BIO_LENGTH}</Text>
              </View>
              <View style={[styles.inputContainer, styles.bioInputContainer]}>
                <FileText size={20} color="#9ca3af" style={styles.bioIcon} />
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  placeholder="Tell others about yourself..."
                  placeholderTextColor="#9ca3af"
                  value={bio}
                  onChangeText={handleBioChange}
                  maxLength={MAX_BIO_LENGTH}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                {(bioChanged || isSavingBio || isBioSaved) && (
                  <TouchableOpacity
                    onPress={handleSaveBio}
                    disabled={isSavingBio || isBioSaved}
                    style={[
                      styles.saveButton,
                      { position: 'absolute', bottom: 10, right: 10 },
                      isBioSaved && styles.saveButtonSuccess
                    ]}
                  >
                    {isSavingBio ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {isBioSaved ? 'Saved' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.inputHint}>
                Optional. Visible to others in rooms you join.
              </Text>
            </View>

            {/* Email (read-only for non-anonymous users) */}
            {!user?.isAnonymous && user?.email && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputContainer, styles.inputDisabled]}>
                  <Mail size={20} color="#9ca3af" />
                  <Text style={styles.inputDisabledText}>{user.email}</Text>
                </View>
                <Text style={styles.inputHint}>
                  Email cannot be changed.
                </Text>
              </View>
            )}

            {/* Account Type Badge */}
            <View style={styles.accountTypeCard}>
              <View style={styles.accountTypeIcon}>
                <Shield size={24} color={user?.isAnonymous ? '#9ca3af' : '#22c55e'} />
              </View>
              <View style={styles.accountTypeContent}>
                <Text style={styles.accountTypeTitle}>
                  {user?.isAnonymous ? 'Anonymous Account' : 'Verified Account'}
                </Text>
                <Text style={styles.accountTypeDescription}>
                  {user?.isAnonymous
                    ? 'Upgrade to sync across devices'
                    : 'Your account is linked to your email'}
                </Text>
              </View>
            </View>

            {/* Upgrade Button (for anonymous users) */}
            {user?.isAnonymous && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => setShowUpgradeModal(true)}
              >
                <Text style={styles.upgradeButtonText}>Upgrade Account</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        currentAvatarUrl={avatarUrl}
        onSelect={handleAvatarSelect}
      />

      {/* Upgrade Benefits Modal */}
      <UpgradeBenefitsModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonSuccess: {
    backgroundColor: '#6b7280',
  },
  saveButtonDisabled: {
    backgroundColor: '#fdba74',
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#f97316',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    gap: 12,
  },
  bioInputContainer: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingBottom: 40, // More space for the button
  },
  bioIcon: {
    marginTop: 4,
  },
  bioInput: {
    minHeight: 80,
    paddingTop: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 14,
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
  },
  inputDisabledText: {
    flex: 1,
    fontSize: 16,
    color: '#6b7280',
    paddingVertical: 14,
  },
  inputHint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  accountTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  accountTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTypeContent: {
    flex: 1,
  },
  accountTypeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  accountTypeDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  upgradeButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  inlineSaveButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
  },
  statusContainer: {
    paddingHorizontal: 8,
    minWidth: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  savedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
});

