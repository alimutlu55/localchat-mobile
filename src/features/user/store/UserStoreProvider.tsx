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
import { DEFAULT_FREE_LIMITS } from '../../../types/subscription';

const log = createLogger('UserStoreProvider');

// Avatar cache cleanup interval (5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

// Track when app session started to distinguish fresh purchases from old cache
const SESSION_START_TIME = Date.now();

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
     * Fetch subscription status from backend (source of truth).
     * 
     * IMPORTANT: We only FETCH from backend here, we don't sync RevenueCat state.
     * RevenueCat is a payment processor, not a state store.
     * The backend is the single source of truth for subscription status.
     */
    /**
     * Fetch subscription status from backend (source of truth).
     */
    const fetchSubscriptionStatus = async () => {
      // 1. Get local truth from RevenueCat first (fast, reliable for status)
      let rcIsPro = false;
      let rcInfo = null;
      try {
        rcInfo = await revenueCatService.getCustomerInfo();
        rcIsPro = rcInfo ? revenueCatService.isPro(rcInfo) : false;
      } catch (err) {
        log.warn('Failed to get RevenueCat info during fetch', err);
      }

      // 2. Get backend details (manifest, etc.)
      let backendStatus = null;
      try {
        backendStatus = await subscriptionApi.getStatus(true);
      } catch (err) {
        log.warn('Failed to fetch subscription status from backend', err);
      }

      // 3. Determine Final Status (Trust RC for "isPro" flag, use Backend for limits)
      const finalIsPro = rcIsPro || (backendStatus?.isPro ?? false);

      // Update store with determined Pro status
      useUserStore.getState().setIsPro(finalIsPro);

      if (finalIsPro) {
        // If we are Pro, decide which limits to use
        if (backendStatus?.isPro && backendStatus.manifest) {
          // Backend is in sync and has manifest - use it
          useUserStore.getState().setSubscriptionLimits(backendStatus.manifest as any);
          log.info('Subscription status: Pro (Backend Synced)', { tier: backendStatus.manifest.tierName });
        } else {
          // Fallback to default Pro limits if backend is slow/stale but RC says Pro
          const { DEFAULT_PRO_LIMITS } = require('../../../types/subscription');
          useUserStore.getState().setSubscriptionLimits(DEFAULT_PRO_LIMITS);
          log.info('Subscription status: Pro (RevenueCat Fallback)', { backendStatus: backendStatus ? 'Stale' : 'Failed' });
        }
      } else {
        // Not Pro
        useUserStore.getState().setSubscriptionLimits(DEFAULT_FREE_LIMITS);
        if (backendStatus) {
          log.info('Subscription status: Free');
        }
      }
    };

    // Initial sync on authenticated mount
    fetchSubscriptionStatus();

    // Listen for real-time updates from RevenueCat (purchases, restores, renewals)
    log.debug('Registering global RevenueCat CustomerInfo listener');
    const listener = async (info: CustomerInfo) => {
      log.info('RevenueCat customer info updated, triggering debounced sync...');
      await fetchSubscriptionStatus();
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
