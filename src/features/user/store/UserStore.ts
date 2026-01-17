/**
 * UserStore - Zustand-based User State Management
 *
 * Single source of truth for user data throughout the application.
 * 
 * Design Principles:
 * - Immutable updates for predictable re-renders
 * - Optimized selectors for minimal re-renders
 * - WebSocket sync for real-time profile updates
 * - Avatar preloading for smooth UI
 * - Persist critical data to storage
 *
 * Architecture:
 * - UserStore: Pure data store (user, avatar cache, preferences)
 * - useUserStore: Zustand hook with selectors
 * - Feature hooks (useCurrentUser): Convenient accessors
 * - AuthContext: Uses UserStore internally for backward compat
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { User } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { SubscriptionLimits, DEFAULT_FREE_LIMITS } from '../../../types/subscription';

const log = createLogger('UserStore');

// =============================================================================
// Types
// =============================================================================

/**
 * Avatar cache entry with loading state
 */
export interface AvatarCacheEntry {
  url: string;
  isLoaded: boolean;
  loadedAt: number;
  error?: boolean;
}

/**
 * User presence state (can be extended for online status)
 */
export interface UserPresence {
  isOnline: boolean;
  lastActiveAt: Date | null;
}

export interface UserStoreState {
  /**
   * Current authenticated user - THE source of truth
   */
  currentUser: User | null;

  /**
   * User ID for quick access without full user object
   */
  userId: string | null;

  /**
   * Avatar loading cache - tracks loaded status for smooth UI
   * Key: avatar URL, Value: cache entry
   */
  avatarCache: Map<string, AvatarCacheEntry>;

  /**
   * User preferences that affect UI and behavior
   * Includes both backend-synced and local-only settings
   */
  preferences: {
    // Privacy settings
    showReadReceipts: boolean;
    showOnlineStatus: boolean;
    showLastSeen: boolean;

    // Notification settings
    notificationsEnabled: boolean;
    messageNotificationsEnabled: boolean;
    roomUpdatesEnabled: boolean;
    soundEnabled: boolean;

    // Behavior settings
    typingIndicatorsEnabled: boolean;
    profanityFilterEnabled: boolean;

    // View settings
    defaultView: 'list' | 'map';
    locationMode: 'precise' | 'approximate' | 'manual' | 'off';

    // UI settings
    theme: 'light' | 'dark' | 'system';
    language: string;
    textSize: 'small' | 'medium' | 'large';
  };

  /**
   * Loading states
   */
  isLoading: boolean;
  isUpdating: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncAt: number | null;

  /**
   * Membership status - Unlock Pro features
   */
  isPro: boolean;

  /**
   * Feature limits based on subscription tier
   */
  subscriptionLimits: SubscriptionLimits;
}

export interface UserStoreActions {
  // =========================================================================
  // User Data Operations
  // =========================================================================

  /**
   * Set the current user (after login/register)
   */
  setUser: (user: User | null) => void;

  /**
   * Update specific user fields (optimistic updates)
   */
  updateUser: (updates: Partial<User>) => void;

  /**
   * Clear user data (on logout)
   */
  clearUser: () => void;

  /**
   * Get current user synchronously
   */
  getUser: () => User | null;

  /**
   * Get user ID synchronously (fast path)
   */
  getUserId: () => string | null;

  // =========================================================================
  // Avatar Cache Operations
  // =========================================================================

  /**
   * Mark an avatar URL as loaded
   */
  setAvatarLoaded: (url: string) => void;

  /**
   * Mark an avatar URL as failed
   */
  setAvatarError: (url: string) => void;

  /**
   * Check if avatar is loaded (synchronous)
   */
  isAvatarLoaded: (url: string) => boolean;

  /**
   * Preload an avatar (register for caching)
   */
  preloadAvatar: (url: string) => void;

  /**
   * Clear old avatar cache entries
   */
  pruneAvatarCache: () => void;

  // =========================================================================
  // Preferences
  // =========================================================================

  /**
   * Update user preferences
   */
  setPreference: <K extends keyof UserStoreState['preferences']>(
    key: K,
    value: UserStoreState['preferences'][K]
  ) => void;

  /**
   * Update multiple preferences at once
   */
  updatePreferences: (updates: Partial<UserStoreState['preferences']>) => Promise<void>;

  // =========================================================================
  // Loading States
  // =========================================================================

  setLoading: (isLoading: boolean) => void;
  setUpdating: (isUpdating: boolean) => void;

  // =========================================================================
  // Sync
  // =========================================================================

  /**
   * Mark store as synced
   */
  markSynced: () => void;

  /**
   * Reset store to initial state
   */
  reset: () => void;

  /**
   * Set membership status
   */
  setIsPro: (isPro: boolean) => void;

  /**
   * Set subscription limits
   */
  setSubscriptionLimits: (limits: UserStoreState['subscriptionLimits']) => void;
}

export type UserStore = UserStoreState & UserStoreActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: UserStoreState = {
  currentUser: null,
  userId: null,
  avatarCache: new Map(),
  preferences: {
    // Privacy
    showReadReceipts: true,
    showOnlineStatus: true,
    showLastSeen: true,

    // Notifications
    notificationsEnabled: true,
    messageNotificationsEnabled: true,
    roomUpdatesEnabled: false,
    soundEnabled: true,

    // Behavior
    typingIndicatorsEnabled: true,
    profanityFilterEnabled: true,

    // View
    defaultView: 'list',
    locationMode: 'approximate',

    // UI
    theme: 'light',
    language: 'en',
    textSize: 'medium',
  },
  isLoading: false,
  isUpdating: false,
  lastSyncAt: null,
  isPro: false,
  subscriptionLimits: DEFAULT_FREE_LIMITS,
};

// Avatar cache max age (1 hour)
const AVATAR_CACHE_MAX_AGE = 60 * 60 * 1000;

// =============================================================================
// Store Implementation
// =============================================================================

/**
 * Main user store with persistence for preferences
 */
export const useUserStore = create<UserStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        ...initialState,

        // =========================================================================
        // User Data Operations
        // =========================================================================

        setUser: (user: User | null) => {
          log.debug('Setting user', { userId: user?.id });
          set({
            currentUser: user,
            userId: user?.id || null,
            lastSyncAt: Date.now(),
          });

          // Preload user's avatar if present
          if (user?.profilePhotoUrl) {
            get().preloadAvatar(user.profilePhotoUrl);
          }
        },

        updateUser: (updates: Partial<User>) => {
          set((state) => {
            if (!state.currentUser) {
              log.warn('Cannot update user - no current user');
              return state;
            }

            const updatedUser = { ...state.currentUser, ...updates };
            log.debug('Updating user', { updates: Object.keys(updates) });

            // Preload new avatar if changed
            if (updates.profilePhotoUrl && updates.profilePhotoUrl !== state.currentUser.profilePhotoUrl) {
              get().preloadAvatar(updates.profilePhotoUrl);
            }

            return {
              currentUser: updatedUser,
              lastSyncAt: Date.now(),
            };
          });
        },

        clearUser: () => {
          log.debug('Clearing user');
          set({
            currentUser: null,
            userId: null,
            lastSyncAt: null,
          });
        },

        getUser: () => get().currentUser,

        getUserId: () => get().userId,

        // =========================================================================
        // Avatar Cache Operations
        // =========================================================================

        setAvatarLoaded: (url: string) => {
          set((state) => {
            const newCache = new Map(state.avatarCache);
            newCache.set(url, {
              url,
              isLoaded: true,
              loadedAt: Date.now(),
              error: false,
            });
            return { avatarCache: newCache };
          });
        },

        setAvatarError: (url: string) => {
          set((state) => {
            const newCache = new Map(state.avatarCache);
            newCache.set(url, {
              url,
              isLoaded: false,
              loadedAt: Date.now(),
              error: true,
            });
            return { avatarCache: newCache };
          });
        },

        isAvatarLoaded: (url: string) => {
          const entry = get().avatarCache.get(url);
          if (!entry) return false;

          // Check if cache is stale
          if (Date.now() - entry.loadedAt > AVATAR_CACHE_MAX_AGE) {
            return false;
          }

          return entry.isLoaded && !entry.error;
        },

        preloadAvatar: (url: string) => {
          const cache = get().avatarCache;
          if (cache.has(url)) return;

          // Register URL in cache as pending
          set((state) => {
            const newCache = new Map(state.avatarCache);
            newCache.set(url, {
              url,
              isLoaded: false,
              loadedAt: Date.now(),
            });
            return { avatarCache: newCache };
          });

          // Actually prefetch the image into React Native's native cache
          // This makes it instantly available when AvatarDisplay renders
          Image.prefetch(url)
            .then(() => {
              log.debug('Avatar prefetched successfully', { url: url.substring(0, 50) + '...' });
              get().setAvatarLoaded(url);
            })
            .catch((err: unknown) => {
              log.warn('Avatar prefetch failed', { url: url.substring(0, 50) + '...', error: err });
              get().setAvatarError(url);
            });
        },

        pruneAvatarCache: () => {
          const now = Date.now();
          set((state) => {
            const newCache = new Map<string, AvatarCacheEntry>();
            state.avatarCache.forEach((entry, url) => {
              if (now - entry.loadedAt < AVATAR_CACHE_MAX_AGE) {
                newCache.set(url, entry);
              }
            });
            log.debug('Pruned avatar cache', {
              before: state.avatarCache.size,
              after: newCache.size,
            });
            return { avatarCache: newCache };
          });
        },

        // =========================================================================
        // Preferences
        // =========================================================================

        setPreference: (key, value) => {
          set((state) => ({
            preferences: {
              ...state.preferences,
              [key]: value,
            },
          }));
        },

        updatePreferences: async (updates) => {
          const prevPreferences = get().preferences;

          log.info('Updating preferences', {
            updates,
            prevNotificationsEnabled: prevPreferences.notificationsEnabled,
            prevMessageNotificationsEnabled: prevPreferences.messageNotificationsEnabled,
          });

          // Update state optimistically
          set((state) => ({
            preferences: { ...state.preferences, ...updates },
            isUpdating: true,
          }));

          // Log the new state immediately after set
          const newPreferences = get().preferences;
          log.info('Preferences state updated', {
            newNotificationsEnabled: newPreferences.notificationsEnabled,
            newMessageNotificationsEnabled: newPreferences.messageNotificationsEnabled,
          });

          try {
            // Separate backend and local settings
            const backendKeys = ['defaultView', 'locationMode', 'notificationsEnabled', 'typingIndicatorsEnabled', 'profanityFilterEnabled'];
            const backendUpdates: any = {};
            const localUpdates: any = {};

            for (const [key, value] of Object.entries(updates)) {
              if (backendKeys.includes(key)) {
                backendUpdates[key] = value;
              } else {
                localUpdates[key] = value;
              }
            }

            // Update backend settings if user is authenticated
            if (Object.keys(backendUpdates).length > 0 && get().currentUser) {
              const { settingsService } = await import('../../../services');
              await settingsService.updateSettings(backendUpdates);
              log.debug('Backend settings synced', { backendUpdates });
            }

            // Update local settings (always persisted)
            if (Object.keys(localUpdates).length > 0) {
              const { settingsService } = await import('../../../services');
              await settingsService.updateLocalSettings(localUpdates);
              log.debug('Local settings synced', { localUpdates });
            }

            log.debug('Preferences updated successfully', { updates });
          } catch (error) {
            log.error('Failed to update preferences', { error });
            // Revert on error
            set({ preferences: prevPreferences });
            throw error;
          } finally {
            set({ isUpdating: false });
          }
        },

        // =========================================================================
        // Loading States
        // =========================================================================

        setLoading: (isLoading: boolean) => set({ isLoading }),
        setUpdating: (isUpdating: boolean) => set({ isUpdating }),

        // =========================================================================
        // Sync
        // =========================================================================

        markSynced: () => set({ lastSyncAt: Date.now() }),

        reset: () => {
          log.debug('Resetting user store');
          set({
            ...initialState,
            // Keep preferences after reset (don't lose user settings)
            preferences: get().preferences,
          });
        },

        setIsPro: (isPro: boolean) => {
          log.info('Updating membership status', { isPro });
          set({ isPro });
        },

        setSubscriptionLimits: (limits: UserStoreState['subscriptionLimits']) => {
          log.debug('Updating subscription limits', limits);
          set({ subscriptionLimits: limits });
        },
      }),
      {
        name: 'localchat-user-store',
        storage: createJSONStorage(() => AsyncStorage),
        // Persist preferences and membership status
        partialize: (state) => ({
          preferences: state.preferences,
          isPro: state.isPro,
          subscriptionLimits: state.subscriptionLimits,
        }),
      }
    )
  )
);

// =============================================================================
// Selectors (for optimized subscriptions)
// =============================================================================

/**
 * Select current user
 */
export const selectCurrentUser = (state: UserStore) => state.currentUser;

/**
 * Select user ID only (minimal re-renders)
 */
export const selectUserId = (state: UserStore) => state.userId;

/**
 * Select user display name
 */
export const selectDisplayName = (state: UserStore) => state.currentUser?.displayName || null;

/**
 * Select user avatar URL
 */
export const selectAvatarUrl = (state: UserStore) => state.currentUser?.profilePhotoUrl || null;

/**
 * Select if user is anonymous
 */
export const selectIsAnonymous = (state: UserStore) => state.currentUser?.isAnonymous ?? true;

/**
 * Select preferences
 */
export const selectPreferences = (state: UserStore) => state.preferences;

/**
 * Select loading state
 */
export const selectIsLoading = (state: UserStore) => state.isLoading;

/**
 * Select updating state
 */
export const selectIsUpdating = (state: UserStore) => state.isUpdating;

// =============================================================================
// Derived Hooks (for common use cases)
// =============================================================================

/**
 * Hook to get current user with stable reference
 */
export function useCurrentUser(): User | null {
  return useUserStore(selectCurrentUser);
}

/**
 * Hook to get user ID only (minimal re-renders)
 */
export function useUserId(): string | null {
  return useUserStore(selectUserId);
}

/**
 * Hook to get user display name
 */
export function useDisplayName(): string | null {
  return useUserStore(selectDisplayName);
}

/**
 * Hook to get user avatar URL
 */
export function useAvatarUrl(): string | null {
  return useUserStore(selectAvatarUrl);
}

/**
 * Hook to check if user is anonymous
 */
export function useIsAnonymous(): boolean {
  return useUserStore(selectIsAnonymous);
}

/**
 * Hook to get user preferences
 */
export function useUserPreferences() {
  return useUserStore(selectPreferences);
}

/**
 * Hook to check if avatar is loaded
 */
export function useIsAvatarLoaded(url: string | null | undefined): boolean {
  return useUserStore((state) => {
    if (!url) return false;
    const entry = state.avatarCache.get(url);
    if (!entry) return false;
    if (Date.now() - entry.loadedAt > AVATAR_CACHE_MAX_AGE) return false;
    return entry.isLoaded && !entry.error;
  });
}

export default useUserStore;
