import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { consentService } from '../../../services/consent';
import { eventBus } from '../../../core/events';

interface AdContextType {
    canShowAds: boolean;
    hasPersonalizationConsent: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
    showConsentFormIfRequired: () => Promise<void>;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export const AdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [canShowAds, setCanShowAds] = useState(__DEV__);
    const [hasPersonalizationConsent, setHasPersonalizationConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(!__DEV__);

    const checkConsent = useCallback(async () => {
        try {
            // 1. Check app-level consent
            const appConsent = await consentService.getStatus();

            // Essential consent = user has accepted ToS (required to use app)
            const hasEssentialConsent = appConsent.hasConsent;

            // Personalized ads require explicit opt-in in our app settings
            const wantsPersonalizedAds = appConsent.options?.personalizedAdsConsent === true;

            // 2. Request UMP consent info update for GDPR regions
            // Google UMP handles basic ads consent automatically via TCF 2.0
            const consentInfo = await AdsConsent.requestInfoUpdate();

            // 3. Show the consent form if required (DEFERRED to manual trigger)
            // if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
            //     await AdsConsent.loadAndShowConsentFormIfRequired();
            // }

            // 4. Get the updated status after potential form interaction
            const updatedConsentInfo = await AdsConsent.requestInfoUpdate();

            // Check if GDPR allows ads (obtained consent or not in GDPR region)
            // This is handled entirely by Google's UMP SDK
            const hasGdprConsent = updatedConsentInfo.status === AdsConsentStatus.OBTAINED ||
                updatedConsentInfo.status === AdsConsentStatus.NOT_REQUIRED;

            // Basic ads: Show if user accepted ToS + GDPR allows (via UMP)
            setCanShowAds(hasEssentialConsent && hasGdprConsent);

            // Personalization requires: user opt-in + GDPR full consent
            setHasPersonalizationConsent(wantsPersonalizedAds &&
                updatedConsentInfo.status === AdsConsentStatus.OBTAINED);

            // 5. Initialize the Mobile Ads SDK after consent has been handled
            await mobileAds().initialize();

        } catch (error) {
            console.error('[AdProvider] Consent error:', error);
            // Fallback: Still attempt to initialize with whatever consent is available
            try {
                await mobileAds().initialize();
            } catch (initError) {
                console.error('[AdProvider] AdMob init error fallback:', initError);
            }
            // Default to canShowAds=false in production if everything fails
            if (!__DEV__) {
                // If it's a critical error but we have essential consent, 
                // we try to show basic ads at minimum
                const appConsent = await consentService.getStatus();
                setCanShowAds(appConsent.hasConsent);
                setHasPersonalizationConsent(false);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const showConsentFormIfRequired = useCallback(async () => {
        try {
            const consentInfo = await AdsConsent.requestInfoUpdate();
            if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
                await AdsConsent.loadAndShowConsentFormIfRequired();
                await checkConsent(); // Refresh state after form interaction
            }
        } catch (error) {
            console.error('[AdProvider] Error showing consent form:', error);
        }
    }, [checkConsent]);

    useEffect(() => {
        // Initial check on mount
        checkConsent();

        // Listen for consent status changes (atomic session status)
        const unsubscribeSession = eventBus.on('session.consentChanged', () => {
            checkConsent();
        });

        // Listen for specific consent updates (granular options)
        const unsubscribeConsent = eventBus.on('consent.updated', () => {
            checkConsent();
        });

        return () => {
            unsubscribeSession();
            unsubscribeConsent();
        };
    }, [checkConsent]);

    const value = {
        canShowAds,
        hasPersonalizationConsent,
        isLoading,
        refresh: checkConsent,
        showConsentFormIfRequired
    };

    return (
        <AdContext.Provider value={value}>
            {children}
        </AdContext.Provider>
    );
};

export const useAds = () => {
    const context = useContext(AdContext);
    if (context === undefined) {
        throw new Error('useAds must be used within an AdProvider');
    }
    return context;
};
