/**
 * Subscription Screen
 * 
 * Premium upgrade page for BubbleUp Pro.
 * Designed with a clean, high-converting "OpenAI-style" aesthetic (White Background).
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert, // Added
    ActivityIndicator, // Added
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PurchasesPackage } from 'react-native-purchases'; // Added
import {
    X,
    Check,
    Zap,
} from 'lucide-react-native';
import { theme } from '../core/theme';
import { useMembership } from '../features/user/hooks/useMembership';
import { revenueCatService } from '../services/revenueCat'; // Added
import { createLogger } from '../shared/utils/logger'; // Added

const log = createLogger('SubscriptionScreen');

/**
 * Feature Item Component
 * A clean row with a checkmark and text.
 */
function FeatureItem({ text }: { text: string }) {
    return (
        <View style={styles.featureItem}>
            <Check size={20} color={theme.tokens.brand.primary} style={styles.checkIcon} />
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

/**
 * Subscription Screen Component
 */
export default function SubscriptionScreen() {
    const navigation = useNavigation();
    const { isPro } = useMembership();
    const [isLoading, setIsLoading] = useState(false);

    const handleUpgrade = async () => {
        setIsLoading(true);
        try {
            // Present the native RevenueCat Paywall
            // This handles the selection of Monthly/Yearly/Lifetime automatically
            const purchased = await revenueCatService.presentPaywall();
            if (purchased) {
                Alert.alert('Success', 'Welcome to BubbleUp Pro!');
                navigation.goBack();
            }
        } catch (error) {
            log.error('Paywall error', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManage = async () => {
        // Use Customer Center if available, or fall back to native management
        await revenueCatService.presentCustomerCenter();
    };

    const handleRestore = async () => {
        setIsLoading(true);
        try {
            const customerInfo = await revenueCatService.restorePurchases();
            if (customerInfo && revenueCatService.isPro(customerInfo)) {
                Alert.alert('Success', 'Purchases restored. You are Pro!');
                navigation.goBack();
            } else {
                Alert.alert('Notice', 'No active Pro subscription found to restore.');
            }
        } catch (error: any) {
            Alert.alert('Error', 'Failed to restore purchases: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

                {/* Header - Minimal with Close Button */}
                <View style={styles.header}>
                    <View style={styles.headerSpacer} />
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    >
                        <X size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Section */}
                    <View style={styles.heroSection}>
                        <View style={styles.iconContainer}>
                            <Zap size={40} color="#fff" fill="#fff" />
                        </View>
                        <Text style={styles.title}>BubbleUp Pro</Text>
                        <Text style={styles.subtitle}>
                            Get more access to our most popular features
                        </Text>
                    </View>

                    {/* Features Card - Bordered, clean look */}
                    <View style={styles.featuresCard}>
                        <FeatureItem text="Ad-free experience" />
                        <FeatureItem text="7-day room duration" />
                        <FeatureItem text="Create up to 20 rooms daily" />
                        <FeatureItem text="Unlimited participants per room" />
                        <FeatureItem text="Early access to new features" />
                    </View>

                    {/* Active Status Message */}
                    {isPro && (
                        <View style={styles.activeStatusContainer}>
                            <Text style={styles.activeStatusText}>
                                🎉 You are currently a Pro member.
                            </Text>
                        </View>
                    )}

                </ScrollView>

                {/* Bottom Action Area */}
                <View style={styles.footer}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color={theme.tokens.brand.primary} style={{ marginBottom: 20 }} />
                    ) : !isPro ? (
                        <>
                            <TouchableOpacity
                                style={styles.upgradeButton}
                                onPress={handleUpgrade}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.upgradeButtonText}>
                                    View Plans & Upgrade
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
                                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={styles.manageButton}
                            onPress={handleManage}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.manageButtonText}>Manage Subscription</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.legalText}>
                        Auto-renews monthly, yearly, or lifetime. Cancel anytime.
                    </Text>
                </View>

            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas, // Use app canvas color (likely off-white)
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerSpacer: {
        width: 24,
    },
    closeButton: {
        padding: 4,
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 20,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
        alignItems: 'center',
    },

    // Hero
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: theme.tokens.brand.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: theme.tokens.brand.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: theme.tokens.text.primary,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: theme.tokens.text.secondary,
        textAlign: 'center',
        maxWidth: '80%',
        lineHeight: 24,
    },

    // Features Card
    featuresCard: {
        width: '100%',
        backgroundColor: theme.tokens.bg.surface,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
        borderRadius: 24,
        padding: 24,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    checkIcon: {
        marginRight: 16,
    },
    featureText: {
        fontSize: 15,
        fontWeight: '500',
        color: theme.tokens.text.primary,
        flex: 1,
        lineHeight: 22,
    },

    // Active Status
    activeStatusContainer: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: theme.tokens.status.success.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.tokens.status.success.bg, // blended border
    },
    activeStatusText: {
        color: theme.tokens.status.success.main,
        fontWeight: '600',
        fontSize: 14,
    },

    // Dev Section
    devSection: {
        marginTop: 40,
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
        paddingTop: 20,
    },
    devRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    devLabel: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
        fontWeight: '500',
    },

    // Footer Buttons
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 16,
        backgroundColor: theme.tokens.bg.canvas, // Ensure footer blends
    },
    upgradeButton: {
        backgroundColor: theme.tokens.brand.primary, // App primary brand color (Orange)
        borderRadius: 30,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: theme.tokens.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    upgradeButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
    },
    disabledButton: {
        opacity: 0.5,
    },
    restoreButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    restoreButtonText: {
        color: theme.tokens.text.secondary,
        fontSize: 14,
        fontWeight: '600',
    },
    manageButton: {
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 30,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 16,
    },
    manageButtonText: {
        color: theme.tokens.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    legalText: {
        textAlign: 'center',
        color: theme.tokens.text.tertiary,
        fontSize: 12,
        lineHeight: 16,
    },
});
