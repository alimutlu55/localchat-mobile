/**
 * Privacy Settings Screen
 *
 * Privacy and security settings including:
 * - Visibility toggles
 * - Location mode
 * - Blocked users
 * - Data controls
 */

import React, { useState, useEffect } from 'react';
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
  Eye,
  EyeOff,
  MapPin,
  UserX,
  Check,
  ChevronRight,
  Globe,
  Clock,
  Trash2,
  BarChart3,
  Bell,
  Download,
} from 'lucide-react-native';
import { useSettings } from '../../features/user';
import { blockService, BlockedUser, consentService } from '../../services';
import { theme } from '../../core/theme';

type LocationMode = 'precise' | 'approximate' | 'manual' | 'off';

const LOCATION_MODES: { value: LocationMode; label: string; description: string }[] = [
  { value: 'precise', label: 'Precise', description: 'Exact location (within 10m)' },
  { value: 'approximate', label: 'Approximate', description: 'Nearby area (within 1km)' },
  { value: 'manual', label: 'Manual', description: 'Set location manually on map' },
  { value: 'off', label: 'Off', description: 'Don\'t share location' },
];

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { settings, updateSettings } = useSettings();

  const [showOnlineStatus, setShowOnlineStatus] = useState(settings?.showOnlineStatus ?? true);
  const [showLastSeen, setShowLastSeen] = useState(settings?.showLastSeen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(settings?.showReadReceipts ?? true);
  const [locationMode, setLocationMode] = useState<LocationMode>(settings?.locationMode ?? 'approximate');
  const [blockedCount, setBlockedCount] = useState(0);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Consent state
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Load consent preferences on mount
  useEffect(() => {
    const loadConsent = async () => {
      try {
        const status = await consentService.getStatus();
        if (status.options) {
          setAnalyticsConsent(status.options.analyticsConsent);
          setMarketingConsent(status.options.marketingConsent);
        }
      } catch (error) {
        console.error('Failed to load consent preferences:', error);
      }
    };
    loadConsent();
  }, []);

  // Load blocked users count
  useEffect(() => {
    const loadBlockedCount = async () => {
      try {
        const blocked = await blockService.getBlockedUsers();
        setBlockedCount(blocked.length);
      } catch (error) {
        console.error('Failed to load blocked users:', error);
      }
    };
    loadBlockedCount();
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
      switch (key) {
        case 'showOnlineStatus':
          setShowOnlineStatus(value);
          break;
        case 'showLastSeen':
          setShowLastSeen(value);
          break;
        case 'showReadReceipts':
          setShowReadReceipts(value);
          break;
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleLocationModeChange = async (mode: LocationMode) => {
    try {
      await updateSettings({ locationMode: mode });
      setLocationMode(mode);
      setShowLocationPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update location mode');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Account deletion will be available soon.');
          },
        },
      ]
    );
  };

  // Consent handlers - GDPR/KVKK
  const handleAnalyticsToggle = async (value: boolean) => {
    try {
      await consentService.updatePreferences(undefined, value);
      setAnalyticsConsent(value);
      if (!value) {
        Alert.alert(
          'Analytics Disabled',
          'Your preference has been saved. We will no longer collect analytics data.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to update analytics consent:', error);
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    }
  };

  const handleMarketingToggle = async (value: boolean) => {
    try {
      await consentService.updatePreferences(value, undefined);
      setMarketingConsent(value);
      if (!value) {
        Alert.alert(
          'Marketing Disabled',
          'Your preference has been saved. You will no longer receive marketing communications.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to update marketing consent:', error);
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      'Export Your Data',
      'This will download all your personal data in JSON format. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              Alert.alert(
                'Export Requested',
                'Your data export is being prepared. For now, please contact support@localchat.app to receive your data export.',
                [{ text: 'OK' }]
              );
              // TODO: Implement actual download when API is ready
              // const data = await api.get('/consent/export');
              // Share or save the data
            } catch (error) {
              console.error('Failed to export data:', error);
              Alert.alert('Error', 'Failed to export data. Please try again.');
            }
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
          <ArrowLeft size={24} color={theme.tokens.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Visibility Section */}
        <Text style={styles.sectionTitle}>Visibility</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Eye size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Show Online Status</Text>
              <Text style={styles.settingDescription}>
                Let others see when you're online
              </Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={(value) => handleToggle('showOnlineStatus', value)}
              trackColor={{ false: theme.tokens.border.strong, true: theme.tokens.action.secondary.active }}
              thumbColor={showOnlineStatus ? theme.tokens.brand.primary : theme.tokens.bg.subtle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Clock size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Show Last Seen</Text>
              <Text style={styles.settingDescription}>
                Show when you were last active
              </Text>
            </View>
            <Switch
              value={showLastSeen}
              onValueChange={(value) => handleToggle('showLastSeen', value)}
              trackColor={{ false: theme.tokens.border.strong, true: theme.tokens.action.secondary.active }}
              thumbColor={showLastSeen ? theme.tokens.brand.primary : theme.tokens.bg.subtle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Check size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Read Receipts</Text>
              <Text style={styles.settingDescription}>
                Show when you've read messages
              </Text>
            </View>
            <Switch
              value={showReadReceipts}
              onValueChange={(value) => handleToggle('showReadReceipts', value)}
              trackColor={{ false: theme.tokens.border.strong, true: theme.tokens.action.secondary.active }}
              thumbColor={showReadReceipts ? theme.tokens.brand.primary : theme.tokens.bg.subtle}
            />
          </View>
        </View>

        <Text style={styles.sectionHint}>
          These settings affect how others see your activity in rooms.
        </Text>

        {/* Location Section */}
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowLocationPicker(!showLocationPicker)}
          >
            <View style={styles.settingIcon}>
              <MapPin size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Location Mode</Text>
              <Text style={styles.settingDescription}>
                {LOCATION_MODES.find(m => m.value === locationMode)?.label}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.tokens.text.tertiary} />
          </TouchableOpacity>

          {showLocationPicker && (
            <View style={styles.locationPicker}>
              {LOCATION_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.value}
                  style={styles.locationOption}
                  onPress={() => handleLocationModeChange(mode.value)}
                >
                  <View style={styles.radioOuter}>
                    {locationMode === mode.value && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <View style={styles.locationOptionContent}>
                    <Text style={styles.locationOptionLabel}>{mode.label}</Text>
                    <Text style={styles.locationOptionDescription}>
                      {mode.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Blocked Users Section */}
        <Text style={styles.sectionTitle}>Blocked Users</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate('BlockedUsers' as never)}
          >
            <View style={styles.settingIcon}>
              <UserX size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Blocked Users</Text>
              <Text style={styles.settingDescription}>
                {blockedCount} blocked user{blockedCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.tokens.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Data Consent Section - GDPR/KVKK Compliance */}
        <Text style={styles.sectionTitle}>Data Consent</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <BarChart3 size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Usage Analytics</Text>
              <Text style={styles.settingDescription}>
                Help improve LocalChat with anonymized usage data
              </Text>
            </View>
            <Switch
              value={analyticsConsent}
              onValueChange={handleAnalyticsToggle}
              trackColor={{ false: theme.tokens.border.strong, true: theme.tokens.action.secondary.active }}
              thumbColor={analyticsConsent ? theme.tokens.brand.primary : theme.tokens.bg.subtle}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Bell size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Product Updates</Text>
              <Text style={styles.settingDescription}>
                Receive emails about new features and tips
              </Text>
            </View>
            <Switch
              value={marketingConsent}
              onValueChange={handleMarketingToggle}
              trackColor={{ false: theme.tokens.border.strong, true: theme.tokens.action.secondary.active }}
              thumbColor={marketingConsent ? theme.tokens.brand.primary : theme.tokens.bg.subtle}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleExportData}
          >
            <View style={styles.settingIcon}>
              <Download size={20} color={theme.tokens.text.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Export My Data</Text>
              <Text style={styles.settingDescription}>
                Download all your personal data (GDPR)
              </Text>
            </View>
            <ChevronRight size={20} color={theme.tokens.text.tertiary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHint}>
          You can withdraw consent at any time. This won't affect the lawfulness of processing based on consent before withdrawal.
        </Text>

        {/* Data & Account Section */}
        <Text style={styles.sectionTitle}>Data & Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleDeleteAccount}
          >
            <Trash2 size={20} color={theme.tokens.text.error} />
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Delete Account
              </Text>
              <Text style={styles.settingDescription}>
                Permanently delete your account and data
              </Text>
            </View>
            <ChevronRight size={20} color={theme.tokens.text.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.tokens.bg.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.tokens.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.tokens.border.subtle,
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
    color: theme.tokens.text.primary,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.tokens.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: theme.tokens.status.error.bg,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.tokens.text.primary,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.tokens.text.secondary,
    marginTop: 2,
  },
  dangerText: {
    color: theme.tokens.text.error,
  },
  divider: {
    height: 1,
    backgroundColor: theme.tokens.border.subtle,
    marginLeft: 68,
  },
  locationPicker: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.tokens.border.subtle,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.tokens.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.tokens.brand.primary,
  },
  locationOptionContent: {
    flex: 1,
  },
  locationOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.tokens.text.primary,
  },
  locationOptionDescription: {
    fontSize: 13,
    color: theme.tokens.text.secondary,
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});

export { PrivacySettingsScreen };

