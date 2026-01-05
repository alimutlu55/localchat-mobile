import { useState, useEffect, useCallback, useRef } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { getInterstitialAdUnitId, AD_CONFIG } from '../config/adConfig';
import { useAdConsent } from './useAdConsent';

// Global state to persist ad instance and stats across hook mounts
let globalAd: InterstitialAd | null = null;
let isAdLoaded = false;
let globalUnsubscribe: (() => void) | null = null;

let sessionStats = {
    joinsCount: 0,
    adsShown: 0
};

/**
 * useInterstitialAd - Session-Limited Interstitial Ads with Global Preloading
 */
export function useInterstitialAd() {
    const { canShowAds } = useAdConsent();
    const [, setTick] = useState(0); // Force re-render on load

    const loadAd = useCallback(() => {
        if (!canShowAds || globalAd) return;

        const adUnitId = AD_CONFIG.isTestMode ? TestIds.INTERSTITIAL : getInterstitialAdUnitId();
        const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
            requestNonPersonalizedAdsOnly: !canShowAds,
        });

        const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            isAdLoaded = true;
            setTick(t => t + 1);
        });

        const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            isAdLoaded = false;
            globalAd = null;
            if (globalUnsubscribe) globalUnsubscribe();
            globalUnsubscribe = null;
            // Load next ad immediately
            loadAd();
            setTick(t => t + 1);
        });

        interstitial.load();
        globalAd = interstitial;
        globalUnsubscribe = () => {
            unsubscribeLoaded();
            unsubscribeClosed();
        };
    }, [canShowAds]);

    useEffect(() => {
        if (canShowAds && !globalAd) {
            loadAd();
        }
    }, [canShowAds, loadAd]);

    const showAd = useCallback(async (category?: string): Promise<boolean> => {
        if (category === 'EMERGENCY') return false;

        sessionStats.joinsCount++;

        if (!canShowAds) return false;
        if (sessionStats.joinsCount <= AD_CONFIG.INTERSTITIAL_SKIP_FIRST_JOINS) return false;
        if (sessionStats.adsShown >= AD_CONFIG.INTERSTITIAL_MAX_PER_SESSION) return false;

        if (isAdLoaded && globalAd) {
            return new Promise((resolve) => {
                const unsubscribe = globalAd!.addAdEventListener(AdEventType.CLOSED, () => {
                    unsubscribe();
                    resolve(true);
                });

                try {
                    globalAd!.show();
                    sessionStats.adsShown++;
                } catch (error) {
                    console.warn('Interstitial show error:', error);
                    unsubscribe();
                    resolve(false);
                }
            });
        }

        return false;
    }, [canShowAds]);

    return {
        showAd,
        isLoaded: isAdLoaded
    };
}
