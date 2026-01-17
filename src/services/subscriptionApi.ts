/**
 * Subscription API Service
 * 
 * Syncs subscription status between mobile (RevenueCat) and backend.
 * Backend is the source of truth for subscription enforcement.
 */

import { api } from './api';
import { createLogger } from '../shared/utils/logger';
import {
    SubscriptionInfo,
    IsProResponse,
    SyncSubscriptionRequest,
    SubscriptionLimits,
    FREE_LIMITS
} from '../types/subscription';

const log = createLogger('SubscriptionApi');

// Types moved to src/types/subscription.ts

// ============================================================================
// Subscription API Service
// ============================================================================

class SubscriptionApiService {
    private cachedInfo: SubscriptionInfo | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    // Prevent concurrent sync requests
    private syncInProgress: boolean = false;
    private pendingSyncPromise: Promise<SubscriptionInfo | null> | null = null;
    private lastSyncTime: number = 0;
    private readonly SYNC_DEBOUNCE_MS = 2000; // 2 second debounce

    /**
     * Get subscription status from backend
     * Cached for 5 minutes to reduce API calls
     */
    async getStatus(forceRefresh = false): Promise<SubscriptionInfo> {
        // Return cached if valid
        if (!forceRefresh && this.cachedInfo && Date.now() < this.cacheExpiry) {
            return this.cachedInfo;
        }

        try {
            const info = await api.get<SubscriptionInfo>('/subscriptions/status');
            this.cachedInfo = info;
            this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
            log.info('Fetched subscription status', { tier: info.tier, isPro: info.isPro });
            return info;
        } catch (error) {
            log.error('Failed to fetch subscription status', error);
            // Return cached or default free tier on error
            return this.cachedInfo ?? this.getDefaultFreeInfo();
        }
    }

    /**
     * Quick check if user is Pro
     */
    async isPro(): Promise<boolean> {
        try {
            const response = await api.get<IsProResponse>('/subscriptions/is-pro');
            return response.isPro;
        } catch (error) {
            log.error('Failed to check Pro status', error);
            return false;
        }
    }

    /**
     * Sync subscription from RevenueCat to backend
     * Caller should provide customer info
     * 
     * DEBOUNCED: Prevents multiple concurrent sync requests from racing.
     * If a sync is in progress, returns the existing promise.
     * If synced recently (within 2 seconds), skips and returns cached.
     */
    async syncToBackend(customerInfo?: any): Promise<SubscriptionInfo | null> {
        const now = Date.now();

        // If synced very recently, return cached to prevent rapid fire
        if (now - this.lastSyncTime < this.SYNC_DEBOUNCE_MS && this.cachedInfo) {
            log.debug('Skipping sync - recently synced');
            return this.cachedInfo;
        }

        // If a sync is already in progress, return the pending promise
        if (this.syncInProgress && this.pendingSyncPromise) {
            log.debug('Sync already in progress, waiting for existing request');
            return this.pendingSyncPromise;
        }

        // Start a new sync
        this.syncInProgress = true;
        this.pendingSyncPromise = this.performSync(customerInfo);

        try {
            const result = await this.pendingSyncPromise;
            this.lastSyncTime = Date.now();
            return result;
        } finally {
            this.syncInProgress = false;
            this.pendingSyncPromise = null;
        }
    }

    /**
     * Internal method to actually perform the sync
     */
    private async performSync(customerInfo?: any): Promise<SubscriptionInfo | null> {
        let rcInfo = customerInfo;
        if (!rcInfo) {
            try {
                const { revenueCatService } = await import('./revenueCat');
                rcInfo = await revenueCatService.getCustomerInfo();
            } catch (e) {
                log.error('Failed to dynamic import revenueCatService', e);
            }
        }

        if (!rcInfo) {
            log.warn('No customer info available for sync');
            return null;
        }

        try {
            // Check entitlement - hardcoded here to avoid circular dep on revenueCatService
            const ENTITLEMENT_ID = 'BubbleUp Pro';
            const isPro = typeof rcInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
            const entitlement = rcInfo.entitlements.active[ENTITLEMENT_ID];

            const request: SyncSubscriptionRequest = {
                revenueCatAppUserId: rcInfo.originalAppUserId,
                isPro,
                productId: entitlement?.productIdentifier ?? undefined,
                expiresAt: entitlement?.expirationDate ?? undefined,
            };

            const backendInfo = await api.post<SubscriptionInfo>('/subscriptions/sync', request);

            // Update cache
            this.cachedInfo = backendInfo;
            this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

            log.info('Synced subscription to backend', { tier: backendInfo.tier, isPro: backendInfo.isPro });
            return backendInfo;
        } catch (error) {
            log.error('Failed to sync subscription to backend', error);
            return null;
        }
    }

    /**
     * Get subscription limits based on current status
     */
    async getLimits(): Promise<SubscriptionLimits> {
        const info = await this.getStatus();
        return info.limits;
    }

    /**
     * Clear cached subscription info
     * Call on logout or subscription change
     */
    clearCache(): void {
        this.cachedInfo = null;
        this.cacheExpiry = 0;
    }

    /**
     * Get default free tier info (fallback)
     */
    private getDefaultFreeInfo(): SubscriptionInfo {
        return {
            userId: '',
            isPro: false,
            tier: 'free',
            limits: FREE_LIMITS,
        };
    }
}

export const subscriptionApi = new SubscriptionApiService();

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Sync subscription status after purchase or restore
 * Call this in the purchase success flow
 */
export async function syncSubscriptionAfterPurchase(): Promise<void> {
    const { revenueCatService } = await import('./revenueCat');
    const customerInfo = await revenueCatService.getCustomerInfo();
    if (customerInfo) {
        await subscriptionApi.syncToBackend(customerInfo);
    }
}

/**
 * Get feature limits for UI decisions
 * E.g., showing upgrade prompts, limiting room creation
 */
export async function getSubscriptionLimits(): Promise<SubscriptionLimits> {
    return subscriptionApi.getLimits();
}

/**
 * Check if user can create a room (based on daily limit)
 */
export async function canCreateRoom(currentRoomCount: number): Promise<boolean> {
    const limits = await subscriptionApi.getLimits();
    return currentRoomCount < limits.dailyRoomLimit;
}
