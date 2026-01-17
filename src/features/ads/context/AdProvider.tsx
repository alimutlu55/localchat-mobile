import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { consentService } from '../../../services/consent';
import { eventBus } from '../../../core/events';
import { useUserStore } from '../../user/store/UserStore';
import { FREE_LIMITS } from '../../../types/subscription';

export type AdStatus = 'idle' | 'checking_consent' | 'initializing_sdk' | 'ready' | 'error';

interface AdContextType {
    status: AdStatus;
    canShowAds: boolean;
    hasPersonalizationConsent: boolean;
    attStatus: string | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    showConsentFormIfRequired: () => Promise<void>;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1s base delay

export const AdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<AdStatus>('idle');
    const [canShowAds, setCanShowAds] = useState(false);
    const [hasPersonalizationConsent, setHasPersonalizationConsent] = useState(false);
    const [attStatus, setAttStatus] = useState<string | null>(null);
    const [error, setError] = useState<Error | null>(null);

    // Membership state
    const isPro = useUserStore(s => s.isPro);
    const subscriptionLimits = useUserStore(s => s.subscriptionLimits || FREE_LIMITS);
    const isAdsDisabledByMembership = isPro || !subscriptionLimits.showAds;

    const isInitialized = useRef(false);
    const activeCheckPromise = useRef<Promise<void> | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const requestConsentInfoWithRetry = async (retryCount = 0): Promise<any> => {
        try {
            return await AdsConsent.requestInfoUpdate();
        } catch (err) {
            if (retryCount < MAX_RETRIES && isMounted.current) {
                const delay = RETRY_DELAY * Math.pow(2, retryCount);
                console.warn(`[AdProvider] Consent check failed, retrying in ${delay}ms...`, err);
                await sleep(delay);
                return requestConsentInfoWithRetry(retryCount + 1);
            }
            throw err;
        }
    };

    const checkConsent = useCallback(async () => {
        // If already checking, return the existing promise so callers can await it
        if (activeCheckPromise.current) return activeCheckPromise.current;

        const checkTask = (async () => {
            if (!isMounted.current) return;

            // Monetization Guard: Don't even check consent if ads are disabled by membership
            if (isAdsDisabledByMembership) {
                setCanShowAds(false);
                setHasPersonalizationConsent(false);
                setStatus('ready');
                return;
            }

            setStatus('checking_consent');
            setError(null);

            try {
                // 1. Check app-level consent (Terms of Service)
                const appStatus = await consentService.getStatus();
                const hasEssentialConsent = appStatus.hasConsent;

                // 2. Update Google UMP consent info (GDPR/ATT) with retry logic
                const consentInfo = await requestConsentInfoWithRetry();

                if (!isMounted.current) return;

                // Check if GDPR allows ads (OBTAINED or NOT_REQUIRED)
                const hasGdprConsent = consentInfo.status === AdsConsentStatus.OBTAINED ||
                    consentInfo.status === AdsConsentStatus.NOT_REQUIRED;

                // 3. Update personalization/ATT state
                const wantsPersonalizedAds = appStatus.options?.personalizedAdsConsent === true;
                const hasPersonalization = wantsPersonalizedAds && consentInfo.status === AdsConsentStatus.OBTAINED;

                // Expose more details if needed
                setAttStatus(consentInfo.status === AdsConsentStatus.NOT_REQUIRED ? 'n/a' : 'managed');

                // 4. Update state atomically
                setCanShowAds(hasEssentialConsent && hasGdprConsent);
                setHasPersonalizationConsent(hasPersonalization);

                // 5. Initialize the SDK if not already done
                if (!isInitialized.current) {
                    setStatus('initializing_sdk');
                    await mobileAds().initialize();
                    isInitialized.current = true;
                    console.log('[AdProvider] Mobile Ads SDK initialized');
                }

                setStatus('ready');

            } catch (err) {
                console.error('[AdProvider] Consent error:', err);
                if (isMounted.current) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setStatus('error');

                    // Recovery: Initialize anyway, AdMob limits itself if consent is missing
                    if (!isInitialized.current) {
                        try {
                            await mobileAds().initialize();
                            isInitialized.current = true;
                        } catch (e) { /* silent init error */ }
                    }

                    // Fallback to local storage if Google UMP check fails
                    const appStatus = await consentService.getStatus();
                    setCanShowAds(appStatus.hasConsent);
                }
            } finally {
                activeCheckPromise.current = null;
            }
        })();

        activeCheckPromise.current = checkTask;
        return checkTask;
    }, [isAdsDisabledByMembership]);

    const showConsentFormIfRequired = useCallback(async () => {
        try {
            const consentInfo = await AdsConsent.requestInfoUpdate();
            if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
                await AdsConsent.loadAndShowConsentFormIfRequired();
                await checkConsent(); // Refresh state after form interaction
            }
        } catch (err) {
            console.error('[AdProvider] Error showing consent form:', err);
        }
    }, [checkConsent]);

    useEffect(() => {
        checkConsent();

        const unsubscribeConsent = eventBus.on('consent.updated', () => {
            checkConsent();
        });

        // Re-check ads if membership status changes
        // This ensures ads are immediately disabled/enabled when user upgrades or tier changes
        checkConsent();

        const unsubscribeSession = eventBus.on('session.consentChanged', () => {
            checkConsent();
        });

        return () => {
            unsubscribeSession();
            unsubscribeConsent();
        };
    }, [checkConsent]);

    const value = {
        status,
        canShowAds,
        hasPersonalizationConsent,
        attStatus,
        isLoading: status === 'checking_consent' || status === 'initializing_sdk',
        error,
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
