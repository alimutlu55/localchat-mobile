/**
 * Manage Subscription Screen
 * 
 * Screen for Pro users to view their subscription details and manage their plan.
 * Includes:
 * - Current plan information
 * - Manage/cancel subscription (via RevenueCat Customer Center)
 * - Terms of Service link
 * - Privacy Policy link
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import {
    ArrowLeft,
    Crown,
    CreditCard,
    FileText,
    Shield,
    ExternalLink,
    Check,
    AlertTriangle,
} from 'lucide-react-native';
import { theme } from '../../core/theme';
import { useMembership } from '../../features/user/hooks/useMembership';
import { revenueCatService } from '../../services/revenueCat';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('ManageSubscriptionScreen');

// Legal URLs
const LEGAL_URLS = {
    termsOfService: 'https://bubbleupapp.com/terms.html',
    privacyPolicy: 'https://bubbleupapp.com/privacy.html',
};

export default function ManageSubscriptionScreen() {
    const navigation = useNavigation();
    const { isPro, limits, tier } = useMembership();
    const [isLoading, setIsLoading] = useState(false);

    const handleManageSubscription = useCallback(async () => {
        setIsLoading(true);
        try {
            await revenueCatService.presentCustomerCenter();
        } catch (error) {
            log.error('Failed to open subscription management', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const openTermsOfService = useCallback(async () => {
        try {
            await WebBrowser.openBrowserAsync(LEGAL_URLS.termsOfService, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                controlsColor: '#6366f1',
            });
        } catch (error) {
            log.error('Failed to open Terms of Service', error);
        }
    }, []);

    const openPrivacyPolicy = useCallback(async () => {
        try {
            await WebBrowser.openBrowserAsync(LEGAL_URLS.privacyPolicy, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                controlsColor: '#6366f1',
            });
        } catch (error) {
            log.error('Failed to open Privacy Policy', error);
        }
    }, []);

    // Get tier display name from actual limits
    const getTierDisplayName = () => {
        const tierName = limits?.tierName?.toLowerCase() || 'free';
        if (tierName === 'pro' || tierName === 'premium') return 'BubbleUp Pro';
        if (tierName === 'plus') return 'BubbleUp Plus';
        if (tierName === 'free') return 'Free';
        // Capitalize first letter for any other tier
        return tierName.charAt(0).toUpperCase() + tierName.slice(1);
    };

    // Build subscription benefits dynamically from actual limits
    const getSubscriptionBenefits = () => {
        const benefits: { label: string; included: boolean }[] = [];

        // Room creation limit
        const dailyLimit = limits?.dailyRoomLimit ?? 3;
        benefits.push({ label: `${dailyLimit} rooms per day`, included: true });

        // Room duration
        const durationHours = limits?.maxRoomDurationHours ?? 6;
        if (durationHours >= 168) {
            benefits.push({ label: 'Extended room duration (7 days)', included: true });
        } else if (durationHours >= 24) {
            benefits.push({ label: `${durationHours} hour room duration`, included: true });
        } else {
            benefits.push({ label: `${durationHours} hour room duration`, included: true });
        }

        // Ads
        const showAds = limits?.showAds ?? true;
        if (!showAds) {
            benefits.push({ label: 'No advertisements', included: true });
        } else {
            benefits.push({ label: 'Ads supported', included: true });
        }

        // Participants
        const maxParticipants = limits?.maxParticipants ?? 50;
        const UNLIMITED_THRESHOLD = 2147483647; // UNLIMITED_PARTICIPANTS constant
        if (maxParticipants >= UNLIMITED_THRESHOLD) {
            benefits.push({ label: 'Unlimited participants', included: true });
        } else {
            benefits.push({ label: `Up to ${maxParticipants} participants`, included: true });
        }

        return benefits;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <ArrowLeft size={24} color={theme.tokens.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Current Plan Card */}
                <View style={[styles.planCard, isPro && styles.planCardPro]}>
                    <View style={styles.planHeader}>
                        <View style={[styles.planIconContainer, isPro && styles.planIconContainerPro]}>
                            <Crown size={28} color={isPro ? '#fbbf24' : '#6b7280'} />
                        </View>
                        <View style={styles.planInfo}>
                            <Text style={[styles.planLabel, isPro && styles.planLabelPro]}>Current Plan</Text>
                            <Text style={[styles.planName, isPro && styles.planNamePro]}>
                                {getTierDisplayName()}
                            </Text>
                        </View>
                        {isPro && (
                            <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                        )}
                    </View>

                    {/* Benefits List */}
                    <View style={styles.benefitsList}>
                        {getSubscriptionBenefits().map((benefit, index) => (
                            <View key={index} style={styles.benefitRow}>
                                <Check size={16} color={isPro ? '#10b981' : '#6b7280'} />
                                <Text style={[styles.benefitText, isPro && styles.benefitTextPro]}>
                                    {benefit.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Manage Subscription Section */}
                {isPro && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Manage Your Subscription</Text>
                        <Text style={styles.sectionDescription}>
                            View billing details, update payment method, or cancel your subscription.
                        </Text>
                        <TouchableOpacity
                            style={styles.manageButton}
                            onPress={handleManageSubscription}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <CreditCard size={18} color="#ffffff" />
                                    <Text style={styles.manageButtonText}>Manage Subscription</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Upgrade CTA for Free Users */}
                {!isPro && (
                    <View style={styles.upgradeSection}>
                        <Crown size={24} color="#fbbf24" />
                        <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
                        <Text style={styles.upgradeDescription}>
                            Get unlimited rooms, longer durations, no ads, and more!
                        </Text>
                        <TouchableOpacity
                            style={styles.upgradeButton}
                            onPress={() => navigation.navigate('CustomPaywall' as never)}
                        >
                            <Text style={styles.upgradeButtonText}>View Plans</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Legal Section */}
                <View style={styles.legalSection}>
                    <Text style={styles.legalSectionTitle}>Legal</Text>

                    <TouchableOpacity style={styles.legalRow} onPress={openTermsOfService}>
                        <View style={styles.legalRowLeft}>
                            <FileText size={20} color={theme.tokens.text.secondary} />
                            <Text style={styles.legalRowText}>Terms of Service</Text>
                        </View>
                        <ExternalLink size={16} color={theme.tokens.text.tertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.legalRow} onPress={openPrivacyPolicy}>
                        <View style={styles.legalRowLeft}>
                            <Shield size={20} color={theme.tokens.text.secondary} />
                            <Text style={styles.legalRowText}>Privacy Policy</Text>
                        </View>
                        <ExternalLink size={16} color={theme.tokens.text.tertiary} />
                    </TouchableOpacity>
                </View>

                {/* Subscription Info */}
                <View style={styles.infoSection}>
                    <AlertTriangle size={16} color={theme.tokens.text.tertiary} />
                    <Text style={styles.infoText}>
                        All purchases are handled securely through the App Store. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export { ManageSubscriptionScreen };

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    // Plan Card
    planCard: {
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
    },
    planCardPro: {
        backgroundColor: '#fef3c7',
        borderColor: '#fbbf24',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    planIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: theme.tokens.bg.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    planIconContainerPro: {
        backgroundColor: '#fde68a',
    },
    planInfo: {
        flex: 1,
        marginLeft: 16,
    },
    planLabel: {
        fontSize: 13,
        color: theme.tokens.text.secondary,
        marginBottom: 2,
    },
    planLabelPro: {
        color: '#92400e',
    },
    planName: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.tokens.text.primary,
    },
    planNamePro: {
        color: '#78350f',
    },
    activeBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    benefitsList: {
        gap: 10,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    benefitText: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
    },
    benefitTextPro: {
        color: '#78350f',
    },
    // Manage Section
    section: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        lineHeight: 20,
        marginBottom: 16,
    },
    manageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tokens.brand.primary,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    manageButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    // Upgrade Section
    upgradeSection: {
        backgroundColor: '#fef3c7',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    upgradeTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#78350f',
        marginTop: 12,
        marginBottom: 8,
    },
    upgradeDescription: {
        fontSize: 14,
        color: '#92400e',
        textAlign: 'center',
        marginBottom: 16,
    },
    upgradeButton: {
        backgroundColor: '#f59e0b',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    upgradeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    // Legal Section
    legalSection: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
    },
    legalSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.tokens.text.secondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    legalRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    legalRowText: {
        fontSize: 15,
        color: theme.tokens.text.primary,
    },
    // Info Section
    infoSection: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: theme.tokens.text.tertiary,
        lineHeight: 18,
    },
});
