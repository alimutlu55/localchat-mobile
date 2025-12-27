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
import { User } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

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
   * User preferences that affect UI
   */
  preferences: {
    showReadReceipts: boolean;
    showOnlineStatus: boolean;
    soundEnabled: boolean;
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
    showReadReceipts: true,
    showOnlineStatus: true,
    soundEnabled: true,
  },
  isLoading: false,
  isUpdating: false,
  lastSyncAt: null,
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
      }),
      {
        name: 'localchat-user-store',
        storage: createJSONStorage(() => AsyncStorage),
        // Only persist preferences, not user data (that's in secure storage)
        partialize: (state) => ({
          preferences: state.preferences,
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
