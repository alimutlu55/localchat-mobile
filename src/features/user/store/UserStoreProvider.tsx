/**
 * UserStoreProvider
 *
 * Initializes the UserStore with EventBus subscriptions for real-time updates.
 * Should be mounted at the app level.
 *
 * CRITICAL: Now uses auth status state machine to handle transitions safely.
 * EventBus handlers check auth status before processing.
 *
 * Handles:
 * - Subscribing to EventBus profile update events
 * - Preloading user avatars
 * - Periodic avatar cache cleanup
 *
 * Note: User data is set by AuthStore after login, not synced from AuthContext anymore.
 */

import React, { useEffect, useRef } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useUserStore, useCurrentUser } from './UserStore';
import { useAppStore, selectAuthStatus } from '../../../shared/stores';
import { eventBus } from '../../../core/events';
import { createLogger } from '../../../shared/utils/logger';
import { notificationService } from '../../../services';
import { subscriptionApi } from '../../../services/subscriptionApi';
import { revenueCatService } from '../../../services/revenueCat';

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
  const authStatus = useAppStore(selectAuthStatus);

  // Get store actions
  const updateUser = useUserStore((s) => s.updateUser);
  const pruneAvatarCache = useUserStore((s) => s.pruneAvatarCache);
  const preloadAvatar = useUserStore((s) => s.preloadAvatar);

  // Set up notification settings getter from UserStore
  useEffect(() => {
    notificationService.setSettingsGetter(() => {
      const state = useUserStore.getState();
      return {
        pushNotifications: state.preferences.notificationsEnabled,
        messageNotifications: state.preferences.messageNotificationsEnabled,
      };
    });
    log.debug('Notification settings getter configured');
  }, []);

  // Sync subscription status on login and handle RevenueCat updates
  useEffect(() => {
    if (!currentUser || authStatus !== 'authenticated') return;

    /**
     * Sync local RevenueCat status to backend and update the store
     */
    const syncSubscription = async () => {
      try {
        const info = await subscriptionApi.syncToBackend();
        if (info) {
          useUserStore.getState().setIsPro(info.isPro);
          useUserStore.getState().setSubscriptionLimits(info.limits);
          log.info('Synced membership and limits with backend', { tier: info.tier, isPro: info.isPro });
        }
      } catch (err) {
        log.warn('Failed to sync membership with backend', err);

        // Fallback: sync local RevenueCat status directly if backend fails
        const info = await revenueCatService.getCustomerInfo();
        if (info) {
          const proStatus = revenueCatService.isPro(info);
          useUserStore.getState().setIsPro(proStatus);
        }
      }
    };

    // Initial sync on authenticated mount
    syncSubscription();

    // Listen for real-time updates from RevenueCat (purchases, restores, renewals)
    log.debug('Registering global RevenueCat CustomerInfo listener');
    const listener = async (info: CustomerInfo) => {
      log.info('RevenueCat customer info updated, triggering debounced sync...');
      await syncSubscription();
    };

    const subscription = Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      log.debug('Removing global RevenueCat CustomerInfo listener');
      (subscription as any)?.remove();
    };
  }, [currentUser?.id, authStatus]);

  // Subscribe to EventBus profile updates (from other devices/sessions)
  useEffect(() => {
    if (!currentUser) return;

    // Don't subscribe during logout - prevents stale closure issues
    if (authStatus === 'loggingOut') {
      log.debug('Skipping EventBus subscription - auth status is loggingOut');
      return;
    }

    const handleProfileUpdated = (payload: { userId: string; displayName?: string; profilePhotoUrl?: string }) => {
      // GUARD: Check auth status before processing
      const currentStatus = useAppStore.getState().authStatus;
      if (currentStatus !== 'authenticated') {
        log.debug('Skipping profile update - not authenticated', { currentStatus });
        return;
      }

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
  }, [currentUser, authStatus, updateUser, preloadAvatar]);

  // Set current user ID in notification service (to avoid self-notifications)
  useEffect(() => {
    notificationService.setCurrentUser(currentUser?.id ?? null);
  }, [currentUser?.id]);

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
