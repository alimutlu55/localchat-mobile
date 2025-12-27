/**
 * UserStoreProvider
 *
 * Initializes the UserStore with WebSocket subscriptions for real-time updates.
 * Should be mounted at the app level, after AuthProvider.
 *
 * Handles:
 * - Syncing user data from AuthContext to UserStore
 * - Subscribing to WebSocket profile update events
 * - Preloading user avatars
 * - Periodic avatar cache cleanup
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserStore } from './UserStore';
import { wsService, WS_EVENTS } from '../../../services';
import { ProfileUpdatedPayload } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('UserStoreProvider');

// Avatar cache cleanup interval (5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

interface UserStoreProviderProps {
  children: React.ReactNode;
}

/**
 * Internal component that handles store initialization and WebSocket sync
 */
function UserStoreInitializer() {
  const { user } = useAuth();
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get store actions
  const setUser = useUserStore((s) => s.setUser);
  const updateUser = useUserStore((s) => s.updateUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const pruneAvatarCache = useUserStore((s) => s.pruneAvatarCache);
  const preloadAvatar = useUserStore((s) => s.preloadAvatar);

  // Sync user from AuthContext to UserStore
  useEffect(() => {
    if (user) {
      log.debug('Syncing user to UserStore', { userId: user.id });
      setUser(user);
    } else {
      log.debug('User logged out, clearing UserStore');
      clearUser();
    }
  }, [user, setUser, clearUser]);

  // Subscribe to WebSocket profile updates (from other devices/sessions)
  useEffect(() => {
    if (!user) return;

    const handleProfileUpdated = (payload: ProfileUpdatedPayload) => {
      // Only update if it's the current user's profile
      if (payload.userId === user.id) {
        log.debug('Profile update received via WebSocket', { payload });

        const updates: Partial<typeof user> = {};
        if (payload.displayName !== undefined) {
          updates.displayName = payload.displayName;
        }
        if (payload.profilePhotoUrl !== undefined) {
          updates.profilePhotoUrl = payload.profilePhotoUrl;
          // Preload new avatar
          if (payload.profilePhotoUrl) {
            preloadAvatar(payload.profilePhotoUrl);
          }
        }

        if (Object.keys(updates).length > 0) {
          updateUser(updates);
        }
      }
    };

    const unsubProfile = wsService.on<ProfileUpdatedPayload>(WS_EVENTS.PROFILE_UPDATED, handleProfileUpdated);

    log.debug('Subscribed to profile update events');

    return () => {
      unsubProfile();
      log.debug('Unsubscribed from profile update events');
    };
  }, [user, updateUser, preloadAvatar]);

  // Periodic avatar cache cleanup
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      pruneAvatarCache();
    }, CACHE_CLEANUP_INTERVAL);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [pruneAvatarCache]);

  return null;
}

/**
 * UserStoreProvider Component
 *
 * Wraps children and initializes the UserStore.
 * Note: Zustand stores don't need a React context provider,
 * but we use this component to handle initialization logic.
 */
export function UserStoreProvider({ children }: UserStoreProviderProps) {
  return (
    <>
      <UserStoreInitializer />
      {children}
    </>
  );
}

export default UserStoreProvider;
