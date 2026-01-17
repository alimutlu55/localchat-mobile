/**
 * Subscription Related Types
 */

export interface SubscriptionLimits {
    dailyRoomLimit: number;
    maxRoomDurationHours: number;
    maxParticipants: number;
    showAds: boolean;
}

export interface SubscriptionInfo {
    userId: string;
    isPro: boolean;
    tier: 'free' | 'pro';
    productId?: string;
    expiresAt?: string;
    limits: SubscriptionLimits;
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

export const FREE_LIMITS: SubscriptionLimits = {
    dailyRoomLimit: 3,
    maxRoomDurationHours: 6,
    maxParticipants: 50,
    showAds: true,
};

export const PRO_LIMITS: SubscriptionLimits = {
    dailyRoomLimit: 20,
    maxRoomDurationHours: 168,
    maxParticipants: 9999,
    showAds: false,
};
