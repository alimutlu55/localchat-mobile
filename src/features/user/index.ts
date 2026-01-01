/**
 * User Feature Module
 *
 * Exports user-related state management and hooks.
 */

// Store exports
export {
  useUserStore,
  UserStoreProvider,
  // Selectors (prefixed with 'user' to avoid conflicts)
  selectCurrentUser,
  selectUserId,
  selectDisplayName,
  selectAvatarUrl,
  selectIsAnonymous,
  selectPreferences as selectUserPreferences,
  selectIsLoading as selectUserIsLoading,
  selectIsUpdating as selectUserIsUpdating,
  // Derived hooks
  useCurrentUser,
  useUserId,
  useDisplayName,
  useAvatarUrl,
  useIsAnonymous,
  useUserPreferences,
  useIsAvatarLoaded,
  // Types
  type UserStore,
  type UserStoreState,
  type UserStoreActions,
  type AvatarCacheEntry,
} from './store';

// Hook exports
export {
  useUserAvatar,
  useAvatarLoading,
  useSettings,
  useBlockedUsers,
  useProfileDrawer,
  useRealtimeProfile,
} from './hooks';

// Type exports
export type {
  ProfileStats,
  PrivacySettings,
  NotificationSettingsData,
} from './hooks';
