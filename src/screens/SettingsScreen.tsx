/**
 * Settings Screen
 *
 * App settings and preferences.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Bell,
  MapPin,
  Globe,
  Moon,
  Trash2,
  ChevronRight,
  Shield,
  UserX,
  FileText,
  HelpCircle,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { storage, STORAGE_KEYS } from '../services';

/**
 * Setting Toggle Component
 */
interface SettingToggleProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function SettingToggle({ icon, label, description, value, onToggle }: SettingToggleProps) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#d1d5db', true: '#fdba74' }}
        thumbColor={value ? '#f97316' : '#f4f4f5'}
      />
    </View>
  );
}

/**
 * Setting Link Component
 */
interface SettingLinkProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  danger?: boolean;
}

function SettingLink({ icon, label, description, onPress, danger }: SettingLinkProps) {
  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

/**
 * Settings Screen Component
 */
export default function SettingsScreen() {
  const navigation = useNavigation();
  const { logout, user } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  /**
   * Handle notification toggle
   */
  const handleNotificationToggle = async (value: boolean) => {
    setNotifications(value);
    await storage.set('notifications_enabled', value);
  };

  /**
   * Handle location toggle
   */
  const handleLocationToggle = async (value: boolean) => {
    setLocationEnabled(value);
    await storage.set('location_enabled', value);
  };

  /**
   * Handle dark mode toggle
   */
  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    await storage.set('dark_mode', value);
    // Note: Actual dark mode implementation would require theme context
  };

  /**
   * Handle language selection
   */
  const handleLanguage = () => {
    Alert.alert(
      'Language',
      'Select your preferred language',
      [
        { text: 'English', onPress: () => console.log('English selected') },
        { text: 'Türkçe', onPress: () => console.log('Turkish selected') },
        { text: 'Español', onPress: () => console.log('Spanish selected') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  /**
   * Handle clear data
   */
  const handleClearData = () => {
    Alert.alert(
      'Clear App Data',
      'This will clear all local data including cached messages. Your account will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await storage.clear();
            Alert.alert('Done', 'App data has been cleared.');
          },
        },
      ]
    );
  };

  /**
   * Handle delete account
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Please confirm you want to delete your account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    // In production, call API to delete account
                    await logout();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionCard}>
            <SettingToggle
              icon={<Bell size={20} color="#6b7280" />}
              label="Push Notifications"
              description="Receive alerts for new messages"
              value={notifications}
              onToggle={handleNotificationToggle}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.sectionCard}>
            <SettingLink
              icon={<Shield size={20} color="#6b7280" />}
              label="Privacy & Security"
              description="Visibility, location, blocked users"
              onPress={() => navigation.navigate('PrivacySettings' as never)}
            />
            <View style={styles.divider} />
            <SettingToggle
              icon={<MapPin size={20} color="#6b7280" />}
              label="Location Services"
              description="Allow app to access your location"
              value={locationEnabled}
              onToggle={handleLocationToggle}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionCard}>
            <SettingToggle
              icon={<Moon size={20} color="#6b7280" />}
              label="Dark Mode"
              description="Use dark color theme"
              value={darkMode}
              onToggle={handleDarkModeToggle}
            />
            <View style={styles.divider} />
            <SettingLink
              icon={<Globe size={20} color="#6b7280" />}
              label="Language"
              description="English"
              onPress={handleLanguage}
            />
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.sectionCard}>
            <SettingLink
              icon={<Trash2 size={20} color="#6b7280" />}
              label="Clear App Data"
              description="Remove cached data"
              onPress={handleClearData}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <SettingLink
              icon={<Trash2 size={20} color="#ef4444" />}
              label="Delete Account"
              description="Permanently delete your account"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>LocalChat v1.0.0</Text>
          <Text style={styles.appCopyright}>© 2025 LocalChat</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconDanger: {
    backgroundColor: '#fef2f2',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingLabelDanger: {
    color: '#ef4444',
  },
  settingDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 62,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appVersion: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: '#d1d5db',
  },
});

