import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform, Alert } from 'react-native';
import { createLogger } from '../shared/utils/logger';
import { subscriptionApi } from './subscriptionApi';

const log = createLogger('RevenueCatService');

const API_KEYS = {
    ios: 'appl_llwWxUfoMtiFuLmhJnZfsxrMVPl',
    android: 'test_HcoITydNOJwWCjbBxmNyQtxTAOf',
};

// As requested by the user
export const ENTITLEMENT_ID = 'BubbleUp Pro';

class RevenueCatService {
    private isConfigured = false;

    /**
     * Initialize RevenueCat SDK
     */
    async configure() {
        if (this.isConfigured) return;

        const apiKey = Platform.select({
            ios: API_KEYS.ios,
            android: API_KEYS.android,
        });

        if (!apiKey) {
            log.warn('No RevenueCat API key found for this platform.');
            return;
        }

        try {
            Purchases.setLogLevel(LOG_LEVEL.VERBOSE); // Enable verbose logs for debugging
            Purchases.configure({ apiKey });
            this.isConfigured = true;
            log.info('RevenueCat configured successfully');
        } catch (error) {
            log.error('Failed to configure RevenueCat', error);
        }
    }

    /**
     * Login to RevenueCat with the backend user ID.
     * This binds the RevenueCat session to the authenticated user,
     * preventing old anonymous subscriptions from carrying over.
     * 
     * Call this after successful login (Google/Apple/email/register).
     */
    async loginUser(userId: string): Promise<CustomerInfo | null> {
        try {
            if (!this.isConfigured) {
                await this.configure();
            }
            const { customerInfo } = await Purchases.logIn(userId);
            log.info('RevenueCat user logged in', { userId, hasEntitlement: this.isPro(customerInfo) });
            return customerInfo;
        } catch (error) {
            log.error('Failed to login RevenueCat user', error);
            return null;
        }
    }

    /**
     * Logout from RevenueCat, resetting to anonymous state.
     * 
     * Call this on user logout to prevent subscription state from persisting.
     */
    async logoutUser(): Promise<void> {
        try {
            if (!this.isConfigured) return;
            await Purchases.logOut();
            log.info('RevenueCat user logged out');
        } catch (error) {
            log.error('Failed to logout RevenueCat user', error);
        }
    }

    /**
     * Present the Paywall (RevenueCat UI)
     * Handles the entire purchase flow for Monthly/Yearly/Lifetime
     */
    async presentPaywall(): Promise<boolean> {
        try {
            const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

            switch (paywallResult) {
                case PAYWALL_RESULT.NOT_PRESENTED:
                case PAYWALL_RESULT.ERROR:
                    // If paywall failed to show, check if we should fallback to mock
                    if (__DEV__) {
                        return this.presentMockPaywall();
                    }
                    return false;
                case PAYWALL_RESULT.CANCELLED:
                    return false;
                case PAYWALL_RESULT.PURCHASED:
                case PAYWALL_RESULT.RESTORED:
                    // Optimistic Update: Grant Pro immediately to update UI
                    try {
                        const { useUserStore } = require('../features/user/store/UserStore');
                        const { DEFAULT_PRO_LIMITS } = require('../types/subscription');
                        useUserStore.getState().setIsPro(true);
                        useUserStore.getState().setSubscriptionLimits(DEFAULT_PRO_LIMITS);
                        log.info('Optimistically granted Pro access and limits after successful purchase/restore');
                    } catch (err) {
                        log.warn('Failed to optimistically update UserStore', err);
                    }

                    // Sync with backend after successful purchase/restore
                    await this.syncWithBackend();
                    return true;
                default:
                    return false;
            }
        } catch (error) {
            log.error('Failed to present paywall', error);
            if (__DEV__) {
                return this.presentMockPaywall();
            }
            return false;
        }
    }

    private async presentMockPaywall(): Promise<boolean> {
        log.info('Presenting Mock Paywall');
        return new Promise((resolve) => {
            Alert.alert(
                'Mock Paywall',
                'Native Paywall failed (likely no products configured). Choose a mock option to test:',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => resolve(false)
                    },
                    {
                        text: 'Buy Lifetime ($99.99)',
                        onPress: () => {
                            this.purchasePackage(this.createMockPackage('lifetime', 'Life', '$99', 99))
                                .then(() => resolve(true));
                        }
                    },
                    {
                        text: 'Buy Monthly ($4.99)',
                        onPress: () => {
                            this.purchasePackage(this.createMockPackage('monthly', 'Month', '$4', 4))
                                .then(() => resolve(true));
                        }
                    }
                ]
            );
        });
    }

    /**
     * Present Customer Center for subscription management
     */
    async presentCustomerCenter(): Promise<void> {
        try {
            await RevenueCatUI.presentCustomerCenter();
        } catch (error) {
            // Fallback to standard restore if Customer Center fails or isn't configured
            log.warn('Failed to present customer center, falling back to restore', error);
            await this.restorePurchases();
        }
    }

    /**
     * Get available offerings (products)
     */
    async getOfferings(): Promise<PurchasesOffering | null> {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                return offerings.current;
            }
            log.info('No current offering configured in RevenueCat console');
        } catch (error) {
            log.error('Error fetching offerings', error);
        }

        // Fallback for Development/Testing when real StoreKit connection fails OR returns empty
        if (__DEV__) {
            log.info('Returning MOCK offerings for development (Native offerings were empty/failed)');
            return this.getMockOfferings();
        }

        return null;
    }

    /**
     * Purchase a specific package (Manual fallback)
     */
    async purchasePackage(pack: PurchasesPackage): Promise<CustomerInfo | null> {
        try {
            // Check if it's a mock package
            if (pack.product.identifier.startsWith('mock_')) {
                log.info('Simulating purchase for mock product');
                const mockInfo = this.getMockCustomerInfo();
                // Sync mock purchase with backend
                await this.syncWithBackend();
                return mockInfo;
            }

            const { customerInfo } = await Purchases.purchasePackage(pack);

            // Optimistic Update: Grant Pro immediately
            try {
                const { useUserStore } = require('../features/user/store/UserStore');
                const { DEFAULT_PRO_LIMITS } = require('../types/subscription');
                useUserStore.getState().setIsPro(true);
                useUserStore.getState().setSubscriptionLimits(DEFAULT_PRO_LIMITS);
                log.info('Optimistically granted Pro access and limits after successful package purchase');
            } catch (err) {
                log.warn('Failed to optimistically update UserStore', err);
            }

            // Sync with backend after successful purchase
            await this.syncWithBackend();
            return customerInfo;
        } catch (error: any) {
            if (!error.userCancelled) {
                log.error('Purchase failed', error);
            }
            throw error;
        }
    }

    /**
     * Restore previous purchases
     */
    async restorePurchases(): Promise<CustomerInfo | null> {
        try {
            if (__DEV__) {
                log.info('Simulating restore for development');
                const mockInfo = this.getMockCustomerInfo();
                // Sync mock restore with backend
                await this.syncWithBackend();
                return mockInfo;
            }
            const customerInfo = await Purchases.restorePurchases();

            // Optimistic Update: Grant Pro immediately logic (check if active first to be safe, but for restore we usually assume attempt)
            // Ideally we check entitlement here, but to ensure responsiveness we force true if successful restore call
            // Actually restore returns customerInfo, let's check it
            try {
                const { useUserStore } = require('../features/user/store/UserStore');
                // Check if restored info actually has the entitlement
                if (this.isPro(customerInfo)) {
                    const { DEFAULT_PRO_LIMITS } = require('../types/subscription');
                    useUserStore.getState().setIsPro(true);
                    useUserStore.getState().setSubscriptionLimits(DEFAULT_PRO_LIMITS);
                    log.info('Optimistically granted Pro access and limits after successful restore');
                }
            } catch (err) {
                log.warn('Failed to optimistically update UserStore', err);
            }

            // Sync with backend after successful restore
            await this.syncWithBackend();
            return customerInfo;
        } catch (error) {
            log.error('Restore failed', error);
            throw error;
        }
    }

    /**
     * Get current customer info (status)
     */
    async getCustomerInfo(): Promise<CustomerInfo | null> {
        try {
            return await Purchases.getCustomerInfo();
        } catch (error) {
            log.error('Error getting customer info', error);
            return null;
        }
    }

    /**
     * Check if user has 'BubbleUp Pro' entitlement
     */
    isPro(customerInfo: CustomerInfo | null): boolean {
        if (!customerInfo) return false;
        // Check strict entitlement
        return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    }

    /**
     * Private helper to sync RevenueCat status with our backend
     */
    private async syncWithBackend() {
        try {
            const customerInfo = await this.getCustomerInfo();
            if (customerInfo) {
                const backendInfo = await subscriptionApi.syncToBackend(customerInfo);

                // If backend sync succeeded, update UserStore with the latest limits
                if (backendInfo) {
                    try {
                        const { useUserStore } = require('../features/user/store/UserStore');
                        useUserStore.getState().setSubscriptionLimits(backendInfo.manifest);
                        log.info('Updated UserStore limits after backend sync', { tier: backendInfo.manifest.tierName });
                    } catch (err) {
                        log.warn('Failed to update UserStore limits after sync', err);
                    }
                }
            }
        } catch (error) {
            log.error('Auto-sync with backend failed', error);
        }
    }

    // --- Mocks for Development ---

    private getMockOfferings(): any {
        return {
            serverDescription: 'Mock Offering',
            identifier: 'default',
            availablePackages: [],
            lifetime: this.createMockPackage('lifetime', 'Lifetime Access', '$99.99', 99.99),
            annual: this.createMockPackage('yearly', 'Yearly Access', '$39.99', 39.99),
            monthly: this.createMockPackage('monthly', 'Monthly Access', '$4.99', 4.99),
            weekly: null,
            sixMonth: null,
            threeMonth: null,
            twoMonth: null
        };
    }

    private createMockPackage(identifier: string, title: string, priceString: string, price: number): any {
        return {
            identifier: identifier,
            packageType: identifier.toUpperCase(),
            product: {
                identifier: `mock_${identifier}`,
                description: 'Mock Product for Testing',
                title: title,
                price: price,
                priceString: priceString,
                currencyCode: 'USD',
                introPrice: null,
                discounts: [],
            },
            offeringIdentifier: 'default',
        };
    }

    private getMockCustomerInfo(): any {
        return {
            entitlements: {
                active: {
                    [ENTITLEMENT_ID]: {
                        identifier: ENTITLEMENT_ID,
                        isActive: true,
                        isSandbox: true,
                        willRenew: true,
                        periodType: 'NORMAL',
                        latestPurchaseDate: new Date().toISOString(),
                        originalPurchaseDate: new Date().toISOString(),
                        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        store: 'APP_STORE',
                        productIdentifier: 'mock_monthly',
                        isFamilyShare: false,
                    }
                },
                all: {}
            },
            activeSubscriptions: ['mock_monthly'],
            allPurchasedProductIdentifiers: ['mock_monthly'],
            nonSubscriptionTransactions: [],
            originalAppUserId: 'mock-user-id',
            managementURL: null,
            latestExpirationDate: null,
            firstSeen: new Date().toISOString(),
            originalApplicationVersion: '1.0',
            originalPurchaseDate: new Date().toISOString(),
            requestDate: new Date().toISOString(),
        };
    }
}

export const revenueCatService = new RevenueCatService();
