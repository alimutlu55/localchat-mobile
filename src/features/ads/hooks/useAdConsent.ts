import { useAds } from '../context/AdProvider';

/**
 * useAdConsent - Legacy hook refactored to use AdProvider
 * 
 * Essential vs Optional Consent Model:
 * - Basic (non-personalized) ads: Always shown when user accepts essential consent (ToS/Privacy)
 * - Personalized ads: Requires explicit opt-in via personalizedAdsConsent toggle
 */
export function useAdConsent() {
    const { canShowAds, hasPersonalizationConsent, isLoading, refresh } = useAds();

    return {
        canShowAds,
        hasPersonalizationConsent,
        isLoading,
        refresh
    };
}
