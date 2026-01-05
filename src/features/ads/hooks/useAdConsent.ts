import { useState, useEffect } from 'react';
import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';
import { consentService } from '../../../services/consent';

/**
 * useAdConsent - GDPR/ATT Consent Management
 * 
 * This hook manages ad consent by:
 * 1. First checking app-level consent (from ConsentService)
 * 2. Then using Google UMP for GDPR personalization consent
 * 
 * Returns both whether ads can be shown AND whether they can be personalized.
 */
export function useAdConsent() {
    const [canShowAds, setCanShowAds] = useState(__DEV__);
    const [hasPersonalizationConsent, setHasPersonalizationConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(!__DEV__);

    useEffect(() => {
        if (!__DEV__) {
            checkConsent();
        }
    }, []);

    const checkConsent = async () => {
        try {
            // 1. Check app-level consent (adConsent controls personalization, NOT whether ads are shown)
            const appConsent = await consentService.getStatus();
            const canPersonalize = appConsent.options?.adConsent === true;

            // 2. Request UMP consent info update for GDPR regions
            const consentInfo = await AdsConsent.requestInfoUpdate();

            // 3. Show the consent form if required (e.g. GDPR region or first time)
            if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
                await AdsConsent.loadAndShowConsentFormIfRequired();
            }

            // 4. Get the updated status after potential form interaction
            const updatedConsentInfo = await AdsConsent.requestInfoUpdate();

            // Check if GDPR allows ads (obtained consent or not in GDPR region)
            const hasGdprConsent = updatedConsentInfo.status === AdsConsentStatus.OBTAINED ||
                updatedConsentInfo.status === AdsConsentStatus.NOT_REQUIRED;

            // Always show ads unless GDPR blocks them
            setCanShowAds(hasGdprConsent);

            // Personalization requires: app toggle ON + GDPR full consent
            setHasPersonalizationConsent(canPersonalize &&
                updatedConsentInfo.status === AdsConsentStatus.OBTAINED);

            // 5. Initialize the Mobile Ads SDK after consent has been handled
            await mobileAds().initialize();

        } catch (error) {
            console.error('Consent error:', error);
            // Fallback: Still attempt to initialize with whatever consent is available
            try {
                await mobileAds().initialize();
            } catch (initError) {
                console.error('AdMob init error fallback:', initError);
            }
            // Default to canShowAds=false in production if everything fails
            setCanShowAds(false);
            setHasPersonalizationConsent(false);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        canShowAds,
        hasPersonalizationConsent,
        isLoading,
        refresh: checkConsent
    };
}
