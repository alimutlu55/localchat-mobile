import { useEffect } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useUserStore } from '../store/UserStore';
import { revenueCatService } from '../../../services/revenueCat';
import { subscriptionApi } from '../../../services/subscriptionApi';
import { createLogger } from '../../../shared/utils/logger';
import { DEFAULT_FREE_LIMITS } from '../../../types/subscription';

const log = createLogger('useMembership');

/**
 * Hook to access and manage the user's Pro membership status.
 * Intergrates with RevenueCat AND the backend to ensure synced enforcement.
 */
export function useMembership() {
    const isPro = useUserStore((s) => s.isPro);
    const setIsPro = useUserStore((s) => s.setIsPro);
    const storedLimits = useUserStore((s) => s.subscriptionLimits);
    const setLimits = useUserStore((s) => s.setSubscriptionLimits);

    // Defensive check: ensure limits is never undefined to prevent crashes
    const limits = storedLimits || DEFAULT_FREE_LIMITS;

    // Proactive Sync: If we think we are pro but have free limits, trigger a sync
    useEffect(() => {
        const tierName = limits.tierName?.toLowerCase() || '';
        const isDefaultFree = tierName === 'free' && limits.maxRoomDurationHours === 6;
        if (isPro && isDefaultFree) {
            log.info('Pro user detected with default limits, triggering manifest sync...');
            refreshMembershipStatus();
        }
    }, [isPro, limits.tierName]);

    /**
     * Helper to manually trigger a sync if needed (e.g., Pull to Refresh)
     */
    const refreshMembershipStatus = async () => {
        try {
            const info = await subscriptionApi.syncToBackend();
            if (info) {
                if (info.isPro !== isPro) {
                    setIsPro(info.isPro);
                }
                const newLimits = await subscriptionApi.getLimits();
                setLimits(newLimits);
                log.info('Manually synced membership with backend', { tier: info.manifest.tierName });
            }
        } catch (err) {
            log.warn('Manual sync failed', err);
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

    return {
        isPro,
        tier: limits.tierName,
        limits,
        isTier,
        canAccess,
        hasEntitlement,
        getLimit,
        refreshMembershipStatus,
    };
}
