import { useEffect, useRef } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useUserStore } from '../store/UserStore';
import { revenueCatService } from '../../../services/revenueCat';
import { subscriptionApi } from '../../../services/subscriptionApi';
import { createLogger } from '../../../shared/utils/logger';
import { DEFAULT_FREE_LIMITS, Entitlement, Entitlements } from '../../../types/subscription';
import { eventBus } from '../../../core/events';

const log = createLogger('useMembership');

/**
 * Hook to access and manage the user's Pro membership status.
 * Intergrates with RevenueCat AND the backend to ensure synced enforcement.
 * 
 * SECURITY: Anonymous users are always treated as FREE tier regardless of cache.
 */
export function useMembership() {
    const rawIsPro = useUserStore((s) => s.isPro);
    const setIsPro = useUserStore((s) => s.setIsPro);
    const storedLimits = useUserStore((s) => s.subscriptionLimits);
    const setLimits = useUserStore((s) => s.setSubscriptionLimits);
    const currentUser = useUserStore((s) => s.currentUser);

    // SECURITY: Anonymous users cannot be Pro - force free tier regardless of cache
    const isAnonymous = currentUser?.isAnonymous ?? true;
    const isPro = isAnonymous ? false : rawIsPro;

    // Defensive check: ensure limits is never undefined to prevent crashes
    // Anonymous users always get free limits, even if cached limits say otherwise
    const limits = isAnonymous ? DEFAULT_FREE_LIMITS : (storedLimits || DEFAULT_FREE_LIMITS);

    // Log warning if we're blocking cached Pro status for anonymous user
    if (isAnonymous && rawIsPro) {
        log.warn('Anonymous user has cached Pro status - ignoring for security');
    }

    // Proactive Sync: If we think we are pro but have free limits, trigger a sync
    useEffect(() => {
        const tierName = limits.tierName?.toLowerCase() || '';
        const isDefaultFree = tierName === 'free' && limits.maxRoomDurationHours === 6;
        if (isPro && isDefaultFree) {
            log.info('Pro user detected with default limits, triggering manifest sync...');
            refreshMembershipStatus();
        }
    }, [isPro, limits.tierName]);

    // Debounced event emission to prevent spam during rapid store updates
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastEmittedRef = useRef<{ isPro: boolean; tierName: string | undefined } | null>(null);

    useEffect(() => {
        // Clear any pending debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce: wait 300ms before emitting to coalesce rapid changes
        debounceTimerRef.current = setTimeout(() => {
            const currentTierName = limits.tierName;
            const lastEmitted = lastEmittedRef.current;

            // Skip if no actual change from last emission
            if (lastEmitted && lastEmitted.isPro === isPro && lastEmitted.tierName === currentTierName) {
                return;
            }

            // Emit the event
            eventBus.emit('subscription.statusChanged', {
                isPro,
                tier: currentTierName,
                limits
            });
            log.debug('Emitted subscription.statusChanged event', { isPro, tier: currentTierName });

            // Track what we emitted
            lastEmittedRef.current = { isPro, tierName: currentTierName };
        }, 300);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [isPro, JSON.stringify(limits)]); // Stable dependency for limits

    /**
     * Helper to manually refresh membership status from backend (e.g., Pull to Refresh).
     * 
     * IMPORTANT: This only FETCHES from backend, does not sync RevenueCat state.
     * The backend is the single source of truth.
     */
    const refreshMembershipStatus = async () => {
        try {
            // Only FETCH from backend - don't sync RevenueCat state
            const info = await subscriptionApi.getStatus(true);
            if (info) {
                // If backend says FREE, but we are currently PRO, double check RC before downgrading
                // This prevents flickering if the background refresh happens during a purchase flow
                let finalIsPro = info.isPro;
                if (isPro && !info.isPro) {
                    try {
                        const rcInfo = await revenueCatService.getCustomerInfo();
                        if (rcInfo && revenueCatService.isPro(rcInfo)) {
                            finalIsPro = true;
                            log.info('Backend says Free but RevenueCat says Pro - maintaining Pro status');
                        }
                    } catch (rcErr) {
                        log.warn('Failed to double check RC during refresh', rcErr);
                    }
                }

                if (finalIsPro !== isPro) {
                    setIsPro(finalIsPro);
                }

                // Always update limits (backend manifest is source of truth for features)
                setLimits(info.manifest as any);
                log.info('Refreshed membership status', { tier: info.manifest?.tierName, isPro: finalIsPro });
            }
        } catch (err) {
            log.warn('Failed to refresh membership from backend', err);
        }
    };

    /**
     * Check if user belongs to one or more tiers
     */
    const isTier = (tiers: string | string[]) => {
        const tierList = (Array.isArray(tiers) ? tiers : [tiers]).map(t => t.toLowerCase());
        const currentTier = (limits.tierName || '').toLowerCase();
        return tierList.includes(currentTier);
    };

    /**
     * Granular feature check based on manifest values
     */
    const canAccess = (feature: string, requirement?: (value: any) => boolean) => {
        const featureKey = feature as keyof typeof limits;
        const value = limits[featureKey];

        if (value === undefined) {
            // Fallback for known boolean features if missing from manifest
            if (feature === 'showAds') return true;
            return false;
        }

        if (requirement) return requirement(value);

        // Default boolean check if no requirement predicate provided
        if (typeof value === 'boolean') return value;
        return true;
    };

    /**
     * Check entitlement or limit (Legacy support + convenience)
     */
    const hasEntitlement = (feature: 'NO_ADS' | 'EXTENDED_ROOMS' | 'INCREASED_QUOTA' | 'UNLIMITED_PARTICIPANTS') => {
        switch (feature) {
            case 'NO_ADS':
                return !limits.showAds;
            case 'EXTENDED_ROOMS':
                return limits.maxRoomDurationHours > 24;
            case 'INCREASED_QUOTA':
                return limits.dailyRoomLimit > 3;
            case 'UNLIMITED_PARTICIPANTS':
                return limits.maxParticipants > 500;
            default:
                return isPro;
        }
    };

    /**
     * Get specific limit
     */
    const getLimit = <K extends keyof typeof limits>(key: K) => limits[key];

    /**
     * Entitlements - Optimized for easy consumption in UI gates
     */
    const entitlements: Entitlements = {
        'NO_ADS': !limits.showAds,
        'EXTENDED_ROOMS': limits.maxRoomDurationHours > 24,
        'INCREASED_QUOTA': limits.dailyRoomLimit > 3,
        'UNLIMITED_PARTICIPANTS': limits.maxParticipants > 500,
        'PRO_BADGE': isPro,
    };

    return {
        isPro,
        tier: limits.tierName,
        limits,
        entitlements,
        isTier,
        canAccess,
        hasEntitlement,
        getLimit,
        refreshMembershipStatus,
    };
}
