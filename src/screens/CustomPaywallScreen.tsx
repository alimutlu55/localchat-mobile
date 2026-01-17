import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    Dimensions,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Zap, Users, Clock, ShieldCheck, Sparkles, Infinity } from 'lucide-react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { revenueCatService } from '../services/revenueCat';
import { tokens } from '../core/theme/tokens';
import { createLogger } from '../shared/utils/logger';
import { SHARE_CONFIG } from '../constants';

const { width } = Dimensions.get('window');
const log = createLogger('CustomPaywallScreen');

interface CustomPaywallScreenProps {
    navigation: any;
}

export function CustomPaywallScreen({ navigation }: CustomPaywallScreenProps) {
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);

    useEffect(() => {
        loadOfferings();
    }, []);

    const loadOfferings = async () => {
        try {
            const offerings = await revenueCatService.getOfferings();
            if (offerings?.availablePackages && offerings.availablePackages.length > 0) {
                setPackages(offerings.availablePackages);
                // Pre-select the annual package if available, otherwise the first one
                const defaultPackage = offerings.annual || offerings.availablePackages[0];
                setSelectedPackage(defaultPackage);
            }
        } catch (error) {
            log.error('Failed to load offerings', error);
            Alert.alert('Error', 'Failed to load subscription options. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        setIsPurchasing(true);
        try {
            const customerInfo = await revenueCatService.purchasePackage(selectedPackage);
            if (customerInfo && revenueCatService.isPro(customerInfo)) {
                Alert.alert('Success!', 'Welcome to BubbleUp Pro! 🎉', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }
        } catch (error: any) {
            if (!error.userCancelled) {
                Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
            }
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setIsLoading(true);
        try {
            const customerInfo = await revenueCatService.restorePurchases();
            if (customerInfo && revenueCatService.isPro(customerInfo)) {
                Alert.alert('Success!', 'Your purchases have been restored!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases to restore.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to restore purchases. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getPackageDisplayInfo = (pkg: PurchasesPackage) => {
        const identifier = pkg.identifier.toLowerCase();

        // Find monthly price for comparison if it exists
        const monthlyPkg = packages.find(p => {
            const id = p.identifier.toLowerCase();
            return id.includes('month') && !id.includes('year');
        });
        const monthlyPrice = monthlyPkg?.product.price || 0;

        if (identifier.includes('month') && !identifier.includes('year')) {
            return {
                title: 'Monthly',
                period: '/ month',
                savings: null,
                badge: null,
                subtitle: 'Flexible access',
            };
        } else if (identifier.includes('year') || identifier.includes('annual')) {
            // Calculate actual savings compared to monthly
            let savingsText = 'SAVE BIG';
            if (monthlyPrice > 0) {
                const annualPrice = pkg.product.price;
                const monthlyOfAnnual = annualPrice / 12;
                const savingsPercent = Math.round((1 - (monthlyOfAnnual / monthlyPrice)) * 100);
                if (savingsPercent > 0) {
                    savingsText = `${savingsPercent}% OFF`;
                }
            }

            return {
                title: 'Annual',
                period: '/ year',
                savings: savingsText,
                badge: 'BEST VALUE',
                subtitle: 'Most popular choice',
            };
        } else if (identifier.includes('lifetime')) {
            return {
                title: 'Lifetime',
                period: 'one-time',
                savings: 'Best Long-term',
                badge: 'ELITE',
                subtitle: 'The ultimate upgrade',
            };
        }
        return {
            title: pkg.identifier,
            period: '',
            savings: null,
            badge: null,
            subtitle: '',
        };
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={tokens.brand.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FFF5EC', '#FFFFFF']}
                style={styles.backgroundGradient}
            />

            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.closeButton}
                        >
                            <X size={24} color={tokens.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Hero Section */}
                    <Animated.View entering={FadeIn.duration(800)} style={styles.hero}>
                        <View style={styles.iconContainer}>
                            <LinearGradient
                                colors={[tokens.brand.primary, '#FF8C42']}
                                style={styles.iconGradient}
                            >
                                <Zap size={40} color="#fff" fill="#fff" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.heroTitle}>BubbleUp Pro</Text>
                    </Animated.View>

                    {/* Features Grid */}
                    <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.featuresSection}>
                        <View style={styles.featureRow}>
                            <FeatureItem
                                icon={<ShieldCheck size={20} color={tokens.brand.primary} />}
                                title="Ad-Free"
                                desc="Premium ad-free experience"
                            />
                            <FeatureItem
                                icon={<Clock size={20} color={tokens.brand.primary} />}
                                title="Extended"
                                desc="7-day room lifespan"
                            />
                        </View>
                        <View style={styles.featureRow}>
                            <FeatureItem
                                icon={<Sparkles size={20} color={tokens.brand.primary} />}
                                title="High Volume"
                                desc="Create up to 20 rooms per day"
                            />
                            <FeatureItem
                                icon={<Users size={20} color={tokens.brand.primary} />}
                                title="No Limits"
                                desc="Join & host with unlimited people"
                            />
                        </View>
                    </Animated.View>

                    {/* Package Selection */}
                    <View style={styles.packagesContainer}>
                        {packages.map((pkg, index) => {
                            const info = getPackageDisplayInfo(pkg);
                            const isSelected = selectedPackage?.identifier === pkg.identifier;

                            return (
                                <Animated.View
                                    key={pkg.identifier}
                                    entering={FadeInDown.delay(400 + index * 100).duration(800)}
                                    layout={Layout.springify()}
                                >
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={[
                                            styles.packageCard,
                                            isSelected && styles.packageCardSelected,
                                        ]}
                                        onPress={() => setSelectedPackage(pkg)}
                                    >
                                        {info.badge && (
                                            <View style={styles.badge}>
                                                <LinearGradient
                                                    colors={[tokens.brand.primary, '#FF8C42']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={styles.badgeGradient}
                                                >
                                                    <Text style={styles.badgeText}>{info.badge}</Text>
                                                </LinearGradient>
                                            </View>
                                        )}

                                        <View style={styles.cardHeader}>
                                            <View style={styles.cardTitleContainer}>
                                                <Text style={[styles.packageTitle, isSelected && styles.textSelected]}>
                                                    {info.title}
                                                </Text>
                                                <Text style={styles.packageSubtitle}>{info.subtitle}</Text>
                                            </View>
                                            <View style={styles.priceContainer}>
                                                <Text style={[styles.priceString, isSelected && styles.textSelected]}>
                                                    {pkg.product.priceString}
                                                </Text>
                                                <Text style={styles.periodText}>{info.period}</Text>
                                            </View>
                                        </View>

                                        {info.savings && (
                                            <View style={styles.savingsContainer}>
                                                <Sparkles size={12} color={tokens.brand.primary} style={{ marginRight: 4 }} />
                                                <Text style={styles.savingsText}>{info.savings}</Text>
                                            </View>
                                        )}

                                        {isSelected && (
                                            <View style={styles.selectionCircle}>
                                                <Check size={14} color="#fff" strokeWidth={3} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </View>

                </ScrollView>

                {/* Fixed CTA Area */}
                <View style={styles.ctaArea}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.ctaButton, isPurchasing && styles.disabledButton]}
                        onPress={handlePurchase}
                        disabled={isPurchasing || !selectedPackage}
                    >
                        <LinearGradient
                            colors={[tokens.brand.primary, '#FF8C42']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}
                        >
                            {isPurchasing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={styles.ctaInner}>
                                    <Text style={styles.ctaText}>Continue</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
                        <Text style={styles.restoreText}>Restore Purchases</Text>
                    </TouchableOpacity>

                    {/* Footer Info - Now Always Visible */}
                    <Text style={styles.termsText}>
                        Recurring billing. Cancel anytime in your device settings.
                        By upgrading, you agree to our{' '}
                        <Text
                            style={styles.link}
                            onPress={() => Linking.openURL(`${SHARE_CONFIG.DOMAIN}/terms.html`)}
                        >
                            Terms
                        </Text>
                        {' '}&{' '}
                        <Text
                            style={styles.link}
                            onPress={() => Linking.openURL(`${SHARE_CONFIG.DOMAIN}/privacy.html`)}
                        >
                            Privacy
                        </Text>.
                    </Text>
                </View>
            </SafeAreaView>
        </View>
    );
}

function FeatureItem({ icon, title, desc }: { icon: any; title: string; desc: string }) {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
                {icon}
            </View>
            <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDesc}>{desc}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 600,
    },
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    hero: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20, // Reduced from 30
    },
    iconContainer: {
        marginBottom: 12, // Reduced from 20
        shadowColor: tokens.brand.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    iconGradient: {
        width: 80,
        height: 80,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '-5deg' }],
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: tokens.text.primary,
        letterSpacing: -0.5,
    },
    heroSubtitle: {
        fontSize: 16,
        color: tokens.text.secondary,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    featuresSection: {
        marginBottom: 20, // Reduced from 35
    },
    featureRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    featureItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: `${tokens.brand.primary}10`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureTextContainer: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: tokens.text.primary,
        marginBottom: 2,
    },
    featureDesc: {
        fontSize: 12,
        color: tokens.text.secondary,
        lineHeight: 16,
    },
    packagesContainer: {
        marginBottom: 20,
    },
    packageCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: tokens.border.subtle,
        padding: 24,
        marginBottom: 16,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    packageCardSelected: {
        borderColor: tokens.brand.primary,
        backgroundColor: `${tokens.brand.primary}05`,
        shadowColor: tokens.brand.primary,
        shadowOpacity: 0.1,
        elevation: 4,
    },
    badge: {
        position: 'absolute',
        top: -12,
        right: 20,
        borderRadius: 10,
        overflow: 'hidden',
    },
    badgeGradient: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitleContainer: {
        flex: 1,
    },
    packageTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: tokens.text.primary,
    },
    packageSubtitle: {
        fontSize: 13,
        color: tokens.text.tertiary,
        marginTop: 2,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceString: {
        fontSize: 24,
        fontWeight: '900',
        color: tokens.text.primary,
    },
    periodText: {
        fontSize: 12,
        color: tokens.text.tertiary,
        fontWeight: '600',
    },
    savingsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: `${tokens.brand.primary}10`,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    savingsText: {
        fontSize: 12,
        fontWeight: '700',
        color: tokens.brand.primary,
    },
    selectionCircle: {
        position: 'absolute',
        top: 20,
        left: -10,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: tokens.brand.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    textSelected: {
        color: tokens.brand.primary,
    },
    termsText: {
        fontSize: 10,
        color: tokens.text.tertiary,
        textAlign: 'center',
        paddingHorizontal: 10,
        lineHeight: 14,
        marginTop: 4,
        marginBottom: 8,
    },
    link: {
        color: tokens.brand.primary,
        textDecorationLine: 'underline',
    },
    ctaArea: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.02)',
    },
    ctaButton: {
        borderRadius: 20,
        overflow: 'hidden',
        height: 64,
        shadowColor: tokens.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    ctaGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ctaInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ctaText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    disabledButton: {
        opacity: 0.6,
    },
    restoreButton: {
        marginTop: 12,
        alignSelf: 'center',
        paddingVertical: 8,
    },
    restoreText: {
        fontSize: 14,
        color: tokens.text.tertiary,
        fontWeight: '600',
    },
});
