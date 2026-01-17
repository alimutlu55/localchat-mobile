/**
 * Subscription Related Types
 */

export const UNLIMITED_PARTICIPANTS = 2147483647;

export interface SubscriptionLimits {
    tierName: string;
    dailyRoomLimit: number;
    maxRoomDurationHours: number;
    maxParticipants: number;
    showAds: boolean;
}

export interface SubscriptionInfo {
    isPro: boolean;
    planType?: string;
    expiresAt?: string;
    entitlements: string[];
    manifest: Record<string, any>;
}

export interface IsProResponse {
    isPro: boolean;
}

export interface SyncSubscriptionRequest {
    revenueCatAppUserId: string;
    isPro: boolean;
    productId?: string;
    expiresAt?: string;
}

/**
 * Fallback limits used only when backend is unreachable
 */
export const DEFAULT_FREE_LIMITS: SubscriptionLimits = {
    tierName: 'free',
    dailyRoomLimit: 3,
    maxRoomDurationHours: 6,
    maxParticipants: 50,
    showAds: true,
};

export const DEFAULT_PRO_LIMITS: SubscriptionLimits = {
    tierName: 'pro',
    dailyRoomLimit: 20,
    maxRoomDurationHours: 168,
    maxParticipants: UNLIMITED_PARTICIPANTS,
    showAds: false,
};
