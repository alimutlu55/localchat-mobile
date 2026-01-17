import { useEffect } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useUserStore } from '../store/UserStore';
import { revenueCatService } from '../../../services/revenueCat';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useMembership');

/**
 * Hook to access and manage the user's Pro membership status.
 * Integrates with RevenueCat to sync real subscription status to the global store.
 */
export function useMembership() {
    const isPro = useUserStore((s) => s.isPro);
    const setIsPro = useUserStore((s) => s.setIsPro);

    // Sync RevenueCat status to global store
    useEffect(() => {
        // Initial check
        const checkStatus = async () => {
            try {
                const info = await revenueCatService.getCustomerInfo();
                const proStatus = revenueCatService.isPro(info);
                if (proStatus !== isPro) {
                    // Only update if different to avoid loops (though zustand is stable)
                    setIsPro(proStatus);
                    log.info('Synced membership status', { isPro: proStatus });
                }
            } catch (err) {
                log.warn('Failed to check initial membership', err);
            }
        };

        checkStatus();

        // Listen for real-time updates (purchases, restores, expirations)
        const listener = (info: CustomerInfo) => {
            const proStatus = revenueCatService.isPro(info);
            setIsPro(proStatus);
            log.info('Received membership update', { isPro: proStatus });
        };

        const subscription = Purchases.addCustomerInfoUpdateListener(listener);

        return () => {
            (subscription as any)?.remove();
        };
    }, []); // Run once on mount (of the component using this hook)

    /**
     * Check entitlement
     */
    const hasEntitlement = (feature: 'NO_ADS' | 'EXTENDED_ROOMS' | 'INCREASED_QUOTA' | 'UNLIMITED_PARTICIPANTS') => {
        return isPro;
    };

    /**
     * Manual refresh
     */
    const refreshMembershipStatus = async () => {
        const info = await revenueCatService.getCustomerInfo();
        const proStatus = revenueCatService.isPro(info);
        setIsPro(proStatus);
    };

    return {
        isPro,
        setIsPro, // Kept for dev simulation override if needed
        hasEntitlement,
        refreshMembershipStatus,
    };
}
