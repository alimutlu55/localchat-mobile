import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AD_CONFIG, getBannerAdUnitId } from '../config/adConfig';
import { useAdConsent } from '../hooks/useAdConsent';
import { useMembership } from '../../user/hooks/useMembership';

export interface AdBannerProps {
    /** Optional height for the banner container */
    height?: number;
    /** Optional size override */
    size?: keyof typeof AD_CONFIG.BANNER_SIZES;
    /** refresh interval in milliseconds (default 45s, 0 to disable) */
    refreshInterval?: number;
    /** Whether the background should be transparent */
    transparent?: boolean;
    /** Called when the banner's visibility changes (e.g. ad failed to load or consent denied) */
    onVisibilityChange?: (isVisible: boolean) => void;
}

/**
 * AdBanner - Premium Google AdMob Banner
 * 
 * Features:
 * - Robust error handling with premium fallback UI
 * - Respects user consent (GDPR/ATT)
 * - Automatic sizing based on device
 * - Skeleton loader while ad is fetching
 */
export const AdBanner: React.FC<AdBannerProps> = ({
    height = 60,
    size = 'ANCHORED_ADAPTIVE_BANNER',
    refreshInterval = 45000, // 45 seconds default for balance between revenue and UX
    transparent = false,
    onVisibilityChange
}) => {
    const {
        canShowAds,
        hasPersonalizationConsent,
        isLoading: isConsentLoading,
    } = useAdConsent();
    const { hasEntitlement } = useMembership();

    const [isAdLoaded, setIsAdLoaded] = useState(false);
    const [adError, setAdError] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const appState = useRef(AppState.currentState);

    // Reset error state when consent status changes or refresh is triggered
    useEffect(() => {
        if (canShowAds) {
            setAdError(false);
            setIsAdLoaded(false);
        }
    }, [canShowAds, refreshKey]);

    // Refresh Logic
    useEffect(() => {
        if (refreshInterval <= 0 || !canShowAds) return;

        const interval = setInterval(() => {
            if (appState.current === 'active') {
                setRefreshKey(prev => (prev + 1) % 1000);
            }
        }, refreshInterval);

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            appState.current = nextAppState;
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [refreshInterval, canShowAds]);

    const adUnitId = AD_CONFIG.isTestMode ? TestIds.BANNER : getBannerAdUnitId();
    const adSize = BannerAdSize[size as keyof typeof BannerAdSize] || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

    const isVisible = canShowAds && !adError;

    // Timeout logic for loading state
    useEffect(() => {
        if (isVisible && !isAdLoaded) {
            const timer = setTimeout(() => {
                if (!isAdLoaded && isVisible) {
                    setIsAdLoaded(true); // Stop showing loader even if ad didn't technically "load"
                }
            }, 10000); // 10s timeout
            return () => clearTimeout(timer);
        }
    }, [isVisible, isAdLoaded]);

    // Notify parent of visibility changes
    useEffect(() => {
        onVisibilityChange?.(isVisible);
    }, [isVisible, onVisibilityChange]);

    // Don't show anything if consent is still loading
    if (isConsentLoading) {
        return <View style={[styles.container, transparent && styles.transparent, { height }]} />;
    }

    // Monetization: Hide ads for Pro members
    if (hasEntitlement('NO_ADS')) {
        return null;
    }

    if (!isVisible) {
        return null;
    }

    return (
        <View style={[styles.container, transparent && styles.transparent, { height }]}>
            {/* Ad Label - Required by Google AdMob policies */}
            <View style={styles.adLabelContainer}>
                <Text style={styles.adLabel}>Ad</Text>
            </View>

            {/* Ad Container */}
            <View style={styles.adWrapper}>
                {!isAdLoaded && (
                    <View style={[styles.loader, transparent && styles.transparent]}>
                        <ActivityIndicator size="small" color="#FF6410" />
                    </View>
                )}
                <BannerAd
                    key={refreshKey}
                    unitId={adUnitId}
                    size={adSize}
                    requestOptions={{
                        // Non-personalized ads when user hasn't given full personalization consent
                        requestNonPersonalizedAdsOnly: !hasPersonalizationConsent,
                    }}
                    onAdLoaded={() => {
                        setIsAdLoaded(true);
                        setAdError(false); // Reset error state on successful load
                    }}
                    onAdFailedToLoad={(error) => {
                        console.warn('Banner Ad failed to load:', error);
                        setAdError(true);
                    }}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: 'transparent',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 2,
    },
    adLabelContainer: {
        width: '100%',
        paddingHorizontal: 16,
        paddingBottom: 2,
    },
    adLabel: {
        fontSize: 9,
        color: '#d1d5db',
        fontWeight: '400',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    adWrapper: {
        width: '100%',
        backgroundColor: '#fafafa',
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    transparent: {
        backgroundColor: 'transparent',
    },
});

export default AdBanner;
