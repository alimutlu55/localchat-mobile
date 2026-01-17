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
     * Sync local RevenueCat status to backend and update the store
     */
    const syncWithBackend = async () => {
        try {
            const info = await subscriptionApi.syncToBackend();
            if (info) {
                if (info.isPro !== isPro) {
                    setIsPro(info.isPro);
                }
                setLimits(info.limits);
                log.info('Synced membership and limits with backend', { tier: info.tier });
            }
        } catch (err) {
            log.warn('Failed to sync membership with backend', err);

            // Fallback: sync local RevenueCat status directly if backend fails
            const info = await revenueCatService.getCustomerInfo();
            const proStatus = revenueCatService.isPro(info);
            if (proStatus !== isPro) {
                setIsPro(proStatus);
            }
        }
    };

    // Sync status on mount and listen for updates
    useEffect(() => {
        syncWithBackend();

        // Listen for real-time updates from RevenueCat (purchases, restores)
        const listener = async (info: CustomerInfo) => {
            log.info('RevenueCat customer info updated, syncing with backend...');
            await syncWithBackend();
        };

        const subscription = Purchases.addCustomerInfoUpdateListener(listener);

        return () => {
            (subscription as any)?.remove();
        };
    }, []);

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
        refreshMembershipStatus: syncWithBackend,
    };
}
