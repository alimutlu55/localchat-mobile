/**
 * Ad Configuration
 *
 * 🚨 PRODUCTION SETUP:
 * Replace the PROD_* values below with your actual AdMob Ad Unit IDs from:
 * https://admob.google.com/
 *
 * This is the SINGLE source of truth for all ad unit IDs.
 */

import { Platform } from 'react-native';

// =============================================================================
// Google Test Ad Unit IDs (Safe for development - DO NOT REMOVE)
// These are official Google test IDs that show test ads
// =============================================================================

const TEST_AD_UNITS = {
    // Banner Ads
    BANNER_IOS: 'ca-app-pub-3940256099942544/2934735716',
    BANNER_ANDROID: 'ca-app-pub-3940256099942544/6300978111',

    // Interstitial Ads
    INTERSTITIAL_IOS: 'ca-app-pub-3940256099942544/4411468910',
    INTERSTITIAL_ANDROID: 'ca-app-pub-3940256099942544/1033173712',

    // Rewarded Ads (for future use)
    REWARDED_IOS: 'ca-app-pub-3940256099942544/1712485313',
    REWARDED_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
} as const;

// =============================================================================
// 🚨 PRODUCTION Ad Unit IDs - REPLACE THESE BEFORE RELEASE
// =============================================================================

const PROD_AD_UNITS = {
    // TODO: Replace with your actual AdMob Banner Ad Unit IDs
    BANNER_IOS: 'ca-app-pub-XXXXX/BANNER_IOS',
    BANNER_ANDROID: 'ca-app-pub-XXXXX/BANNER_ANDROID',

    // TODO: Replace with your actual AdMob Interstitial Ad Unit IDs
    INTERSTITIAL_IOS: 'ca-app-pub-XXXXX/INTERSTITIAL_IOS',
    INTERSTITIAL_ANDROID: 'ca-app-pub-XXXXX/INTERSTITIAL_ANDROID',

    // TODO: Replace with your actual AdMob Rewarded Ad Unit IDs (if used)
    REWARDED_IOS: 'ca-app-pub-XXXXX/REWARDED_IOS',
    REWARDED_ANDROID: 'ca-app-pub-XXXXX/REWARDED_ANDROID',
} as const;

// =============================================================================
// Environment Configuration
// =============================================================================

const isDevelopment = __DEV__;
const isIOS = Platform.OS === 'ios';

// Select the appropriate ad unit set based on environment
const AD_UNITS = isDevelopment ? TEST_AD_UNITS : PROD_AD_UNITS;

// =============================================================================
// Exported Functions - Use these to get Ad Unit IDs
// =============================================================================

/** Get Banner Ad Unit ID for current platform */
export const getBannerAdUnitId = (): string =>
    isIOS ? AD_UNITS.BANNER_IOS : AD_UNITS.BANNER_ANDROID;

/** Get Interstitial Ad Unit ID for current platform */
export const getInterstitialAdUnitId = (): string =>
    isIOS ? AD_UNITS.INTERSTITIAL_IOS : AD_UNITS.INTERSTITIAL_ANDROID;

/** Get Rewarded Ad Unit ID for current platform (for future use) */
export const getRewardedAdUnitId = (): string =>
    isIOS ? AD_UNITS.REWARDED_IOS : AD_UNITS.REWARDED_ANDROID;

// =============================================================================
// Exported Configuration
// =============================================================================

export const AD_CONFIG = {
    /** Whether using test ads (always true in __DEV__) */
    isTestMode: isDevelopment,

    /** Request timeout in milliseconds */
    REQUEST_TIMEOUT: 10000,

    /** Interstitial: Skip first N room joins before showing ad */
    INTERSTITIAL_SKIP_FIRST_JOINS: 1,

    /** Interstitial: Max ads per session */
    INTERSTITIAL_MAX_PER_SESSION: 1,

    /** Banner sizes */
    BANNER_SIZES: {
        BANNER: 'BANNER',
        LARGE_BANNER: 'LARGE_BANNER',
        MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
        ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
    } as const,
} as const;
