import { useState, useEffect } from 'react';
import { MobileAds, AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';

/**
 * useAdConsent - GDPR/ATT Consent Management
 * 
 * This hook manages the Google User Messaging Platform (UMP) consent flow.
 * In development, it defaults to allowing ads.
 */
export function useAdConsent() {
    const [canShowAds, setCanShowAds] = useState(__DEV__);
    const [isLoading, setIsLoading] = useState(!__DEV__);

    useEffect(() => {
        if (!__DEV__) {
            checkConsent();
        }
    }, []);

    const checkConsent = async () => {
        try {
            // 1. Request consent info update
            const consentInfo = await AdsConsent.requestInfoUpdate();

            // 2. Show the consent form if required (e.g. GDPR region or first time)
            if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
                await AdsConsent.loadAndShowConsentFormIfRequired();
            }

            // 3. Get the updated status after potential form interaction
            const updatedConsentInfo = await AdsConsent.requestInfoUpdate();

            // Check if we have obtained consent or if it's not required
            const hasConsent = updatedConsentInfo.status === AdsConsentStatus.OBTAINED ||
                updatedConsentInfo.status === AdsConsentStatus.NOT_REQUIRED;

            setCanShowAds(hasConsent);

            // 4. Initialize the Mobile Ads SDK after consent has been handled
            // This ensures we respect the user's choice from the start and avoids
            // requesting ads before consent is evaluated.
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
        } finally {
            setIsLoading(false);
        }
    };

    return {
        canShowAds,
        isLoading,
        refresh: checkConsent
    };
}
