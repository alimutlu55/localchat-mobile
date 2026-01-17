import { useEffect } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useUserStore } from '../store/UserStore';
import { revenueCatService } from '../../../services/revenueCat';
import { subscriptionApi } from '../../../services/subscriptionApi';
import { createLogger } from '../../../shared/utils/logger';
import { FREE_LIMITS } from '../../../types/subscription';

const log = createLogger('useMembership');

/**
 * Hook to access and manage the user's Pro membership status.
 * Integrates with RevenueCat AND the backend to ensure synced enforcement.
 */
export function useMembership() {
    const isPro = useUserStore((s) => s.isPro);
    const setIsPro = useUserStore((s) => s.setIsPro);
    const storedLimits = useUserStore((s) => s.subscriptionLimits);
    const setLimits = useUserStore((s) => s.setSubscriptionLimits);

    // Defensive check: ensure limits is never undefined to prevent crashes
    const limits = storedLimits || FREE_LIMITS;

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
                setLimits(info.limits);
                log.info('Manually synced membership with backend', { tier: info.tier });
            }
        } catch (err) {
            log.warn('Manual sync failed', err);
        }
    };

    /**
     * Check entitlement or limit
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
        limits,
        hasEntitlement,
        getLimit,
        refreshMembershipStatus,
    };
}
