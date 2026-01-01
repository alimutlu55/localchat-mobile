/**
 * useProfileDrawer Hook
 *
 * Centralizes all data and actions for the ProfileDrawer component.
 * Provides a clean API that hides the complexity of multiple data sources.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { RootStackParamList } from '../../../navigation/types';
import { useCurrentUser } from '../store';
import { useSettings } from './useSettings';
import { useBlockedUsers } from './useBlockedUsers';
import { useMyRooms } from '../../rooms/hooks';
import { useAuth } from '../../auth';
import { Room } from '../../../types';
import { storage } from '../../../services/storage';
import { authService } from '../../../services/auth';
import { eventBus } from '../../../core/events/EventBus';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useProfileDrawer');

// Legal URLs - should be moved to constants in production
const LEGAL_URLS = {
  termsOfService: 'https://localchat.app/terms',
  privacyPolicy: 'https://localchat.app/privacy',
  helpCenter: 'https://localchat.app/help',
};

/**
 * User statistics for profile display
 */
export interface ProfileStats {
  roomsJoined: number;
  messagesSent: number | null; // null = not available
  memberSince: string;
}

/**
 * Privacy settings
 */
export interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
}

/**
 * Notification settings
 */
export interface NotificationSettingsData {
  pushNotifications: boolean;
  messageNotifications: boolean;
}

interface UseProfileDrawerReturn {
  // =========================================================================
  // User Data
  // =========================================================================

  /** Current user or null if not authenticated */
  user: ReturnType<typeof useCurrentUser>;

  /** Whether user is anonymous */
  isAnonymous: boolean;

  /** Whether user is authenticated */
  isAuthenticated: boolean;

  /** User statistics */
  stats: ProfileStats;

  // =========================================================================
  // Rooms
  // =========================================================================

  /** User's active rooms */
  myRooms: Room[];

  // =========================================================================
  // Blocked Users
  // =========================================================================

  /** Blocked users state and actions */
  blockedUsers: ReturnType<typeof useBlockedUsers>;

  // =========================================================================
  // Settings
  // =========================================================================

  /** Notification settings */
  notificationSettings: NotificationSettingsData;

  /** Privacy settings */
  privacySettings: PrivacySettings;

  /** Update notification settings */
  updateNotificationSettings: (settings: Partial<NotificationSettingsData>) => void;

  /** Update privacy settings */
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // =========================================================================
  // App Info
  // =========================================================================

  /** App version string */
  appVersion: string;

  /** Current language */
  language: string;

  /** Location mode */
  locationMode: string;

  // =========================================================================
  // Actions
  // =========================================================================

  /** Navigate to edit profile screen */
  handleEditProfile: (onClose: () => void) => void;

  /** Navigate to a room */
  handleRoomPress: (room: Room, onClose: () => void) => void;

  /** Handle upgrade for anonymous users */
  handleUpgrade: (onClose: () => void) => void;

  /** Sign out with confirmation */
  handleSignOut: (onClose: () => void) => void;

  /** Delete account with confirmation */
  handleDeleteAccount: (onClose: () => void) => void;

  /** Open terms of service */
  openTermsOfService: () => void;

  /** Open privacy policy */
  openPrivacyPolicy: () => void;

  /** Open help center */
  openHelpCenter: () => void;
}

export function useProfileDrawer(): UseProfileDrawerReturn {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useCurrentUser();
  const { rooms: myRooms } = useMyRooms();
  const { settings, updateSettings } = useSettings();
  const { logout, deleteAccount, isAuthenticated } = useAuth();
  const blockedUsers = useBlockedUsers();

  // Fetch user stats (message count) and subscribe to updates
  const [messagesSent, setMessagesSent] = useState<number | null>(null);

  // Fetch stats from backend on mount
  useEffect(() => {
    if (isAuthenticated) {
      authService.getUserStats()
        .then((stats) => setMessagesSent(stats.messagesSent))
        .catch((err) => log.warn('Failed to fetch user stats', err));
    }
  }, [isAuthenticated]);

  // Subscribe to message.new events to increment count in real-time
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = eventBus.on('message.new', (payload) => {
      // Only increment if the current user sent the message
      if (payload.sender?.id === user.id) {
        setMessagesSent((prev) => (prev ?? 0) + 1);
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  // =========================================================================
  // Derived Data
  // =========================================================================

  const isAnonymous = user?.isAnonymous ?? true;

  const stats = useMemo<ProfileStats>(() => {
    const memberSince = user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
      : 'Recently';

    return {
      roomsJoined: myRooms.length,
      messagesSent, // From backend API
      memberSince,
    };
  }, [user?.createdAt, myRooms.length, messagesSent]);

  const appVersion = useMemo(() => {
    return Constants.expoConfig?.version || '1.0.0';
  }, []);

  const notificationSettings = useMemo<NotificationSettingsData>(
    () => ({
      pushNotifications: settings.notificationsEnabled,
      messageNotifications: settings.messageNotificationsEnabled,
    }),
    [settings.notificationsEnabled, settings.messageNotificationsEnabled]
  );

  const privacySettings = useMemo<PrivacySettings>(
    () => ({
      showOnlineStatus: settings.showOnlineStatus,
      showLastSeen: settings.showLastSeen,
      showReadReceipts: settings.showReadReceipts,
    }),
    [settings.showOnlineStatus, settings.showLastSeen, settings.showReadReceipts]
  );

  // =========================================================================
  // Settings Updates
  // =========================================================================

  const updateNotificationSettings = useCallback(
    (updates: Partial<NotificationSettingsData>) => {
      const mappedUpdates: Partial<typeof settings> = {};

      if (updates.pushNotifications !== undefined) {
        mappedUpdates.notificationsEnabled = updates.pushNotifications;
      }
      if (updates.messageNotifications !== undefined) {
        mappedUpdates.messageNotificationsEnabled = updates.messageNotifications;
      }

      log.info('Updating notification settings', {
        uiUpdates: updates,
        mappedUpdates,
        currentSettings: {
          notificationsEnabled: settings.notificationsEnabled,
          messageNotificationsEnabled: settings.messageNotificationsEnabled,
        }
      });

      updateSettings(mappedUpdates);
    },
    [updateSettings, settings.notificationsEnabled, settings.messageNotificationsEnabled]
  );

  const updatePrivacySettings = useCallback(
    (updates: Partial<PrivacySettings>) => {
      updateSettings(updates);
      log.info('Privacy settings updated', updates);
    },
    [updateSettings]
  );

  // =========================================================================
  // Navigation Actions
  // =========================================================================

  const handleEditProfile = useCallback(
    (onClose: () => void) => {
      onClose();
      navigation.navigate('EditProfile');
    },
    [navigation]
  );

  const handleRoomPress = useCallback(
    (room: Room, onClose: () => void) => {
      onClose();
      navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
    },
    [navigation]
  );

  const handleUpgrade = useCallback(
    async (onClose: () => void) => {
      onClose();
      // Set a flag to tell WelcomeScreen NOT to auto-login as anonymous
      // This prevents the loop where user logs out but gets immediately logged back in
      await storage.set('skip_auto_login', true);
      // Log out the anonymous user
      // RootNavigator will automatically show the Auth flow (Login/Register options)
      logout();
      log.info('Anonymous user initiating sign in - logging out to show auth flow');
    },
    [logout]
  );

  // =========================================================================
  // Account Actions
  // =========================================================================

  const handleSignOut = useCallback(
    (onClose: () => void) => {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // Set flag to prevent auto-login as anonymous on WelcomeScreen
            await storage.set('skip_auto_login', true);
            logout();
            onClose();
            log.info('User logged out');
          },
        },
      ]);
    },
    [logout]
  );

  const handleDeleteAccount = useCallback((onClose: () => void) => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you sure?',
              'Please confirm you want to permanently delete your account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Set flag to prevent auto-login as anonymous on WelcomeScreen
                      await storage.set('skip_auto_login', true);
                      // Close drawer first for smooth transition
                      onClose();
                      // Delete account (this transitions to guest state)
                      await deleteAccount();
                      log.info('Account deleted successfully');
                    } catch (error) {
                      log.error('Failed to delete account', { error });
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  // =========================================================================
  // External Links
  // =========================================================================

  const openUrl = useCallback(async (url: string, name: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open ${name}`);
      }
    } catch (error) {
      log.error(`Failed to open ${name}`, { url, error });
      Alert.alert('Error', `Failed to open ${name}`);
    }
  }, []);

  const openTermsOfService = useCallback(() => {
    openUrl(LEGAL_URLS.termsOfService, 'Terms of Service');
  }, [openUrl]);

  const openPrivacyPolicy = useCallback(() => {
    openUrl(LEGAL_URLS.privacyPolicy, 'Privacy Policy');
  }, [openUrl]);

  const openHelpCenter = useCallback(() => {
    openUrl(LEGAL_URLS.helpCenter, 'Help Center');
  }, [openUrl]);

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // User data
    user,
    isAnonymous,
    isAuthenticated,
    stats,

    // Rooms
    myRooms,

    // Blocked users
    blockedUsers,

    // Settings
    notificationSettings,
    privacySettings,
    updateNotificationSettings,
    updatePrivacySettings,

    // App info
    appVersion,
    language: settings.language,
    locationMode: settings.locationMode,

    // Actions
    handleEditProfile,
    handleRoomPress,
    handleUpgrade,
    handleSignOut,
    handleDeleteAccount,
    openTermsOfService,
    openPrivacyPolicy,
    openHelpCenter,
  };
}

export default useProfileDrawer;
