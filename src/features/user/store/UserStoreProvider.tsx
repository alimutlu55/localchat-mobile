/**
 * UserStoreProvider
 *
 * Initializes the UserStore with EventBus subscriptions for real-time updates.
 * Should be mounted at the app level.
 *
 * Handles:
 * - Subscribing to EventBus profile update events
 * - Preloading user avatars
 * - Periodic avatar cache cleanup
 *
 * Note: User data is set by AuthStore after login, not synced from AuthContext anymore.
 */

import React, { useEffect, useRef } from 'react';
import { useUserStore, useCurrentUser } from './UserStore';
import { eventBus } from '../../../core/events';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('UserStoreProvider');

// Avatar cache cleanup interval (5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

interface UserStoreProviderProps {
  children: React.ReactNode;
}

/**
 * Internal component that handles store initialization and EventBus sync
 */
function UserStoreInitializer() {
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentUser = useCurrentUser();

  // Get store actions
  const updateUser = useUserStore((s) => s.updateUser);
  const pruneAvatarCache = useUserStore((s) => s.pruneAvatarCache);
  const preloadAvatar = useUserStore((s) => s.preloadAvatar);

  // Subscribe to EventBus profile updates (from other devices/sessions)
  useEffect(() => {
    if (!currentUser) return;

    const handleProfileUpdated = (payload: { userId: string; displayName?: string; profilePhotoUrl?: string }) => {
      // Only update if it's the current user's profile
      if (payload.userId === currentUser.id) {
        log.debug('Profile update received via EventBus', { payload });

        const updates: Partial<typeof currentUser> = {};
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

    const unsubProfile = eventBus.on('user.profileUpdated', handleProfileUpdated);

    log.debug('Subscribed to profile update events');

    return () => {
      unsubProfile();
      log.debug('Unsubscribed from profile update events');
    };
  }, [currentUser, updateUser, preloadAvatar]);

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
