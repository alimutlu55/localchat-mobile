/**
 * Ads Feature - Public API
 *
 * This module provides Google AdMob integration for the app.
 * Only exports that are part of the public interface are exposed here.
 */

// Components
export { AdBanner } from './components/AdBanner';
export type { AdBannerProps } from './components/AdBanner';

// Provider
export { AdProvider, useAds } from './context/AdProvider';

// Hooks
export { useAdConsent } from './hooks/useAdConsent';
export { useInterstitialAd } from './hooks/useInterstitialAd';

// Config
export {
    AD_CONFIG,
    getBannerAdUnitId,
    getInterstitialAdUnitId,
    getRewardedAdUnitId,
} from './config/adConfig';
