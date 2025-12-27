/**
 * User Store Module
 *
 * Exports the Zustand-based user store and selectors.
 */

export {
  useUserStore,
  // Selectors
  selectCurrentUser,
  selectUserId,
  selectDisplayName,
  selectAvatarUrl,
  selectIsAnonymous,
  selectPreferences,
  selectIsLoading,
  selectIsUpdating,
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
} from './UserStore';

export { UserStoreProvider } from './UserStoreProvider';
