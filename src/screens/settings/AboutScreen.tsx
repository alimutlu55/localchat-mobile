/**
 * About Screen
 *
 * MVP About section with essential information:
 * - App info and version
 * - How it works (quick start)
 * - Privacy Policy link
 * - Terms of Service link
 * - Data usage explanation
 * - Contact/Support
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
    ArrowLeft,
    Shield,
    FileText,
    Mail,
    Bug,
    ChevronRight,
    MapPin,
    MessageCircle,
    Users,
    Clock,
    Smartphone,
    ExternalLink,
    Heart,
    Info,
} from 'lucide-react-native';
// Note: Clipboard functionality removed to avoid extra dependency
import { theme } from '../../core/theme';
import { APP_VERSION } from '../../version';
import { AppIcon } from '../../components/ui/AppIcon';

// App version info (synced with app.json)
const BUILD_NUMBER = '1';
const SUPPORT_EMAIL = 'localchat.official@gmail.com';

/**
 * Feature Item Component
 */
interface FeatureItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureIcon}>{icon}</View>
            <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    );
}

/**
 * Link Item Component
 */
interface LinkItemProps {
    icon: React.ReactNode;
    label: string;
    description?: string;
    onPress: () => void;
    external?: boolean;
}

function LinkItem({ icon, label, description, onPress, external }: LinkItemProps) {
    return (
        <TouchableOpacity style={styles.linkItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.linkIcon}>{icon}</View>
            <View style={styles.linkContent}>
                <Text style={styles.linkLabel}>{label}</Text>
                {description && <Text style={styles.linkDescription}>{description}</Text>}
            </View>
            {external ? (
                <ExternalLink size={18} color={theme.tokens.text.tertiary} />
            ) : (
                <ChevronRight size={20} color={theme.tokens.text.tertiary} />
            )}
        </TouchableOpacity>
    );
}

/**
 * About Screen Component
 */
export default function AboutScreen() {
    const navigation = useNavigation();

    /**
     * Show version info (useful for bug reports)
     */
    const handleShowVersion = () => {
        const versionString = `BubbleUp v${APP_VERSION} (${BUILD_NUMBER})\nPlatform: ${Platform.OS}`;
        Alert.alert('Version Info', versionString, [{ text: 'OK' }]);
    };

    /**
     * Open email for support
     */
    const handleContactSupport = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    };

    /**
     * Share app
     */
    const handleShareApp = async () => {
        try {
            await Share.share({
                message: 'Check out BubbleUp - Connect with people nearby! https://bubbleup.app',
                title: 'BubbleUp',
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color={theme.tokens.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>About</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* App Info Card */}
                <TouchableOpacity
                    style={styles.appInfoCard}
                    onPress={handleShowVersion}
                    activeOpacity={0.8}
                >
                    <AppIcon size={64} rounded={true} />
                    <Text style={styles.appName}>BubbleUp</Text>
                    <Text style={styles.appTagline}>Moments that matter</Text>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>v{APP_VERSION}</Text>
                        <Info size={12} color={theme.tokens.text.tertiary} style={styles.copyIcon} />
                    </View>
                    <Text style={styles.tapHint}>Tap for version info</Text>
                </TouchableOpacity>

                {/* How It Works Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>How It Works</Text>
                    <View style={styles.sectionCard}>
                        <FeatureItem
                            icon={<MapPin size={20} color={theme.tokens.brand.primary} />}
                            title="Location-Based Rooms"
                            description="Discover chat rooms near your current location"
                        />
                        <View style={styles.divider} />
                        <FeatureItem
                            icon={<Users size={20} color={theme.tokens.brand.primary} />}
                            title="Join & Chat"
                            description="Join rooms to connect with people in your area"
                        />
                        <View style={styles.divider} />
                        <FeatureItem
                            icon={<Clock size={20} color={theme.tokens.brand.primary} />}
                            title="Ephemeral Conversations"
                            description="Rooms expire automatically - keeping things fresh"
                        />
                        <View style={styles.divider} />
                        <FeatureItem
                            icon={<Smartphone size={20} color={theme.tokens.brand.primary} />}
                            title="Create Your Own"
                            description="Start a room for your neighborhood, event, or topic"
                        />
                    </View>
                </View>

                {/* Legal Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Legal</Text>
                    <View style={styles.sectionCard}>
                        <LinkItem
                            icon={<Shield size={20} color={theme.tokens.text.secondary} />}
                            label="Privacy Policy"
                            description="How we protect your data"
                            onPress={() => navigation.navigate('PrivacyPolicy' as never)}
                        />
                        <View style={styles.divider} />
                        <LinkItem
                            icon={<FileText size={20} color={theme.tokens.text.secondary} />}
                            label="Terms of Service"
                            description="Rules for using BubbleUp"
                            onPress={() => navigation.navigate('TermsOfService' as never)}
                        />
                    </View>
                </View>

                {/* Data & Permissions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data & Permissions</Text>
                    <View style={styles.dataCard}>
                        <View style={styles.dataItem}>
                            <MapPin size={18} color={theme.tokens.brand.primary} />
                            <View style={styles.dataContent}>
                                <Text style={styles.dataTitle}>Location</Text>
                                <Text style={styles.dataDescription}>
                                    Used to show nearby rooms and your approximate position on the map.
                                    Your exact location is never shared with other users.
                                </Text>
                            </View>
                        </View>
                        <View style={styles.dataDivider} />
                        <View style={styles.dataItem}>
                            <MessageCircle size={18} color={theme.tokens.brand.primary} />
                            <View style={styles.dataContent}>
                                <Text style={styles.dataTitle}>Messages</Text>
                                <Text style={styles.dataDescription}>
                                    Messages are stored temporarily and deleted when rooms expire.
                                    We don't read or analyze your conversations.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.sectionCard}>
                        <LinkItem
                            icon={<Mail size={20} color={theme.tokens.text.secondary} />}
                            label="Contact Support"
                            description={SUPPORT_EMAIL}
                            onPress={handleContactSupport}
                            external
                        />
                    </View>
                </View>

                {/* Share Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={handleShareApp}
                        activeOpacity={0.8}
                    >
                        <Heart size={18} color="#fff" />
                        <Text style={styles.shareButtonText}>Share BubbleUp</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with ❤️ for local communities</Text>
                    <Text style={styles.copyright}>© 2026 BubbleUp. All rights reserved.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.tokens.bg.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
    headerSpacer: {
        width: 44,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },

    // App Info Card
    appInfoCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    appLogo: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: theme.tokens.brand.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    appName: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.tokens.text.primary,
        marginBottom: 4,
    },
    appTagline: {
        fontSize: 15,
        color: theme.tokens.text.secondary,
        marginBottom: 12,
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.tokens.bg.subtle,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    versionText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.text.secondary,
    },
    copyIcon: {
        marginLeft: 6,
    },
    tapHint: {
        fontSize: 11,
        color: theme.tokens.text.tertiary,
        marginTop: 8,
    },

    // Section
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.tokens.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    // Feature Items
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: `${theme.tokens.brand.primary}15`,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginBottom: 2,
    },
    featureDescription: {
        fontSize: 13,
        color: theme.tokens.text.secondary,
        lineHeight: 18,
    },

    // Link Items
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    linkIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: theme.tokens.bg.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    linkContent: {
        flex: 1,
    },
    linkLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    linkDescription: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
        marginTop: 2,
    },

    divider: {
        height: 1,
        backgroundColor: theme.tokens.border.subtle,
        marginLeft: 62,
    },

    // Data Card
    dataCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dataItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dataContent: {
        flex: 1,
        marginLeft: 12,
    },
    dataTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginBottom: 4,
    },
    dataDescription: {
        fontSize: 13,
        color: theme.tokens.text.secondary,
        lineHeight: 18,
    },
    dataDivider: {
        height: 1,
        backgroundColor: theme.tokens.border.subtle,
        marginVertical: 12,
    },

    // Share Button
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tokens.brand.primary,
        borderRadius: 12,
        paddingVertical: 14,
        shadowColor: theme.tokens.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 8,
    },

    // Footer
    footer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    footerText: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        marginBottom: 4,
    },
    copyright: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
});

export { AboutScreen };
