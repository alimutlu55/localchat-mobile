import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId, AD_CONFIG } from '../config/adConfig';
import { useAdConsent } from '../hooks/useAdConsent';
import { Award, ChevronRight } from 'lucide-react-native';

export interface AdBannerProps {
    /** Optional height for the banner container */
    height?: number;
    /** Optional size override */
    size?: keyof typeof AD_CONFIG.BANNER_SIZES;
    /** Refresh interval in milliseconds (default 45s, 0 to disable) */
    refreshInterval?: number;
    /** Whether the background should be transparent */
    transparent?: boolean;
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
    transparent = false
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
        return <View style={[styles.container, transparent && styles.transparent, { height }]} />;
    }

    // Show premium placeholder if ads are disabled or failed
    // NOTE: This is NOT an ad, it's promotional content for the app's premium features
    if (!canShowAds || adError) {
        return (
            <View style={[styles.container, transparent && styles.transparent, { height }]}>
                <View style={[styles.placeholder, transparent && styles.transparentFallback]}>
                    <View style={styles.placeholderIcon}>
                        <Award size={20} color="#FF6410" />
                    </View>
                    <View style={styles.placeholderTextContainer}>
                        <Text style={styles.placeholderTitle}>Go Premium</Text>
                        <Text style={styles.placeholderSubtitle}>Remove all ads & get exclusive icons</Text>
                    </View>
                    <ChevronRight size={18} color="#FF6410" style={styles.placeholderChevron} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, transparent && styles.transparent, { height: height + 24 }]}>
            {/* Ad Label - Required by Google AdMob policies */}
            <View style={styles.adLabelContainer}>
                <Text style={styles.adLabel}>Ad</Text>
            </View>

            {/* Ad Container with clear delineation */}
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
        paddingTop: 4,
        paddingBottom: 4,
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
    placeholder: {
        backgroundColor: '#1f2937',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 12,
        borderRadius: 12,
        flex: 1,
    },
    transparentFallback: {
        backgroundColor: 'rgba(31, 41, 55, 0.7)', // Semi-transparent instead of solid black
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    placeholderIcon: {
        marginRight: 12,
    },
    placeholderTextContainer: {
        flex: 1,
    },
    placeholderTitle: {
        color: '#FF6410',
        fontSize: 14,
        fontWeight: '700',
    },
    placeholderSubtitle: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 2,
    },
    placeholderChevron: {
        marginLeft: 12,
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
