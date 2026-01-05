import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId, AD_CONFIG } from '../config/adConfig';
import { useAdConsent } from '../hooks/useAdConsent';

export interface AdBannerProps {
    /** Optional height for the banner container */
    height?: number;
    /** Optional size override */
    size?: keyof typeof AD_CONFIG.BANNER_SIZES;
    /** Refresh interval in milliseconds (default 45s, 0 to disable) */
    refreshInterval?: number;
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
    refreshInterval = 45000 // 45 seconds default for balance between revenue and UX
}) => {
    const { canShowAds, hasPersonalizationConsent, isLoading: isConsentLoading } = useAdConsent();
    const [isAdLoaded, setIsAdLoaded] = useState(false);
    const [adError, setAdError] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const appState = useRef(AppState.currentState);

    // Refresh Logic
    useEffect(() => {
        if (refreshInterval <= 0 || !canShowAds) return;

        const interval = setInterval(() => {
            if (appState.current === 'active') {
                setRefreshKey(prev => prev + 1);
                setIsAdLoaded(false); // Show loader for new ad
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

    // Don't show anything if consent is still loading
    if (isConsentLoading) {
        return <View style={[styles.container, { height }]} />;
    }

    // Show premium placeholder if ads are disabled or failed
    if (!canShowAds || adError) {
        return (
            <View style={[styles.container, styles.placeholder, { height }]}>
                <View style={styles.placeholderContent}>
                    <Text style={styles.placeholderBrand}>Huddle</Text>
                    <Text style={styles.placeholderText}>Connecting people near you</Text>
                </View>
                <View style={styles.adBadge}>
                    <Text style={styles.adBadgeText}>SPONSORED</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { height }]}>
            {!isAdLoaded && (
                <View style={styles.loader}>
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
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    loader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    placeholder: {
        backgroundColor: '#1f2937',
        flexDirection: 'row',
        paddingHorizontal: 16,
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
    },
    placeholderBrand: {
        color: '#FF6410',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    placeholderText: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 2,
    },
    adBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'center',
    },
    adBadgeText: {
        color: '#9ca3af',
        fontSize: 8,
        fontWeight: '600',
    },
});

export default AdBanner;
