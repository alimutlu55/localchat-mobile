/**
 * Privacy Policy Screen
 *
 * Displays the privacy policy for BubbleUp.
 * Content is 100% accurate based on codebase investigation.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../core/theme';

const EFFECTIVE_DATE = 'January 4, 2026';
const LAST_UPDATED = 'January 4, 2026';

/**
 * Section Component
 */
interface PolicySectionProps {
    title: string;
    children: React.ReactNode;
}

function PolicySection({ title, children }: PolicySectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

/**
 * Privacy Policy Screen Component
 */
export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();

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
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Introduction */}
                <View style={styles.introCard}>
                    <Text style={styles.introText}>
                        Your privacy is important to us. This Privacy Policy explains how BubbleUp
                        collects, uses, and protects your information when you use our location-based
                        chat application.
                    </Text>
                    <View style={styles.dateRow}>
                        <Text style={styles.dateLabel}>Effective Date:</Text>
                        <Text style={styles.dateValue}>{EFFECTIVE_DATE}</Text>
                    </View>
                    <View style={styles.dateRow}>
                        <Text style={styles.dateLabel}>Last Updated:</Text>
                        <Text style={styles.dateValue}>{LAST_UPDATED}</Text>
                    </View>
                </View>

                {/* 1. Information We Collect */}
                <PolicySection title="1. Information We Collect">
                    <Text style={styles.subheading}>Account Information</Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Email address</Text> - For account login and recovery
                        (not required for anonymous users)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Password</Text> - Securely hashed;
                        we never store or see your plain-text password
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Display name</Text> - Visible to other users in rooms
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Bio</Text> - Optional profile description you choose to share
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Profile photo URL</Text> - Optional profile image
                    </Text>

                    <Text style={styles.subheading}>Device Information</Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Device ID</Text> - A randomly generated identifier
                        for your device, used for anonymous login and session management
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Device platform</Text> - iOS or Android, for app compatibility
                    </Text>

                    <Text style={styles.subheading}>Location Data</Text>
                    <Text style={styles.bulletItem}>
                        • Your GPS coordinates are used <Text style={styles.bold}>only</Text> to discover
                        nearby chat rooms and display your approximate position on the map
                    </Text>
                    <Text style={styles.bulletItem}>
                        • When you create a room, only an <Text style={styles.bold}>approximate location</Text> (randomly
                        offset by ~500m) is stored—your exact position is never sent to our servers
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Other users see only that you are "nearby" - they cannot see your exact coordinates
                    </Text>

                    <Text style={styles.subheading}>Usage Data</Text>
                    <Text style={styles.bulletItem}>
                        • Rooms you create (title, description, location, category)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Messages you send within rooms
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Users you block
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Your notification and privacy preferences
                    </Text>

                    <Text style={styles.subheading}>OAuth Data (if you sign in with Google)</Text>
                    <Text style={styles.bulletItem}>
                        • Google account ID (to link your account)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Email address from Google (for account identification)
                    </Text>
                </PolicySection>

                {/* 2. How We Use Your Information */}
                <PolicySection title="2. How We Use Your Information">
                    <Text style={styles.paragraph}>
                        We use your information exclusively to provide and improve BubbleUp:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Room Discovery</Text> - Show you chat rooms near your location
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Authentication</Text> - Verify your identity and manage your session
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Messaging</Text> - Deliver your messages to room participants
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Notifications</Text> - Alert you about new messages (if enabled)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Moderation</Text> - Enforce community guidelines and handle reports
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Account Recovery</Text> - Help you regain access if needed
                    </Text>
                </PolicySection>

                {/* 3. Data Sharing */}
                <PolicySection title="3. Data Sharing">
                    <Text style={styles.paragraph}>
                        We do <Text style={styles.bold}>not sell</Text> your personal information.
                        Data is shared only in these limited circumstances:
                    </Text>

                    <Text style={styles.subheading}>With Other Users</Text>
                    <Text style={styles.bulletItem}>
                        • Your display name, bio, and profile photo are visible to users in rooms you join
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Messages you send are visible to all participants in that room
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Your approximate location is shown on the map when you create a room
                    </Text>

                    <Text style={styles.subheading}>Third-Party Services</Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Google Maps</Text> - Your location is sent to Google
                        to display map tiles (subject to Google's Privacy Policy)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • We do <Text style={styles.bold}>not</Text> use any analytics or tracking SDKs
                    </Text>

                    <Text style={styles.subheading}>Legal Requirements</Text>
                    <Text style={styles.bulletItem}>
                        • We may disclose information when required by law or to protect safety
                    </Text>
                </PolicySection>

                {/* 4. Data Retention */}
                <PolicySection title="4. Data Retention">
                    <Text style={styles.paragraph}>
                        We retain your data as follows:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Rooms</Text> - Automatically expire and become
                        inaccessible 1-24 hours after creation (based on room duration)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Messages</Text> - Become inaccessible when the room
                        expires; message data may be retained briefly for moderation and legal
                        compliance before permanent deletion
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Account data</Text> - Kept until you delete your account
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Session tokens</Text> - Expire automatically and are
                        cleared on logout
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Location</Text> - Your exact location is never stored;
                        room locations are approximate (~500m offset) and deleted when rooms expire
                    </Text>

                    <Text style={styles.paragraph}>
                        When you delete your account, your data is "soft-deleted" (marked as deleted)
                        and your email becomes available for re-registration.
                    </Text>
                </PolicySection>

                {/* 5. Your Rights */}
                <PolicySection title="5. Your Rights">
                    <Text style={styles.paragraph}>
                        You have full control over your data:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Access</Text> - View your profile data anytime in the app
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Correction</Text> - Edit your display name, bio, and photo
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Deletion</Text> - Delete your account from Settings
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Location Control</Text> - Disable location services
                        in your device settings (app requires location to function)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Notifications</Text> - Toggle push notifications in Settings
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Blocking</Text> - Block users you don't want to interact with
                    </Text>
                </PolicySection>

                {/* 6. Data Security */}
                <PolicySection title="6. Data Security">
                    <Text style={styles.paragraph}>
                        We implement industry-standard security measures to protect your data:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Password Protection</Text> - Passwords are securely
                        hashed and never stored in plain text
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Secure Storage</Text> - Sensitive data is stored
                        using platform-provided secure storage
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Encrypted Transmission</Text> - All data is transmitted
                        using encryption
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Access Controls</Text> - Database access is restricted
                        and monitored
                    </Text>
                </PolicySection>

                {/* 7. Children's Privacy */}
                <PolicySection title="7. Children's Privacy">
                    <Text style={styles.paragraph}>
                        BubbleUp is not intended for users under 13 years of age. We do not knowingly
                        collect information from children under 13. If you believe a child under 13 has
                        provided us with personal information, please contact us immediately.
                    </Text>
                    <Text style={styles.paragraph}>
                        If you are between 13 and 18, you may need parental consent depending on your jurisdiction.
                    </Text>
                </PolicySection>

                {/* 8. Regional Rights */}
                <PolicySection title="8. Your Regional Rights">
                    <Text style={styles.subheading}>European Union (GDPR)</Text>
                    <Text style={styles.paragraph}>
                        If you are in the EU/EEA, you have the right to:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Access, correct, or delete your personal data
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Object to or restrict processing
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Data portability
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Withdraw consent at any time
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Lodge a complaint with your local data protection authority
                    </Text>

                    <Text style={styles.subheading}>United States (CCPA/CPRA)</Text>
                    <Text style={styles.paragraph}>
                        California residents have the right to:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Know what data we collect and how it's used
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Delete your personal information
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Opt out of data sales (we do not sell your data)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Non-discrimination for exercising rights
                    </Text>

                    <Text style={styles.subheading}>Turkey (KVKK)</Text>
                    <Text style={styles.paragraph}>
                        Turkish residents have the right to:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Learn whether your data is processed
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Request information about processing
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Request correction or deletion
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Object to automated decision-making
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Claim compensation for damages from unlawful processing
                    </Text>
                </PolicySection>

                {/* 9. Legal Basis for Processing */}
                <PolicySection title="9. Legal Basis for Processing">
                    <Text style={styles.paragraph}>
                        We process your data based on:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Consent</Text> - Location data, optional profile info
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Contract</Text> - Account and messaging functionality
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Legitimate Interest</Text> - Security, fraud prevention
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Legal Obligation</Text> - Compliance with laws
                    </Text>
                </PolicySection>

                {/* 10. How to Withdraw Consent */}
                <PolicySection title="10. How to Withdraw Consent">
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Location</Text> - Go to your device Settings {'>'}
                        {' '}BubbleUp {'>'} Location
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Notifications</Text> - In-app Settings or device Settings
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Delete Account</Text> - In-app Settings {'>'} Delete Account
                    </Text>
                </PolicySection>

                {/* 11. Changes to This Policy */}
                <PolicySection title="11. Changes to This Policy">
                    <Text style={styles.paragraph}>
                        We may update this Privacy Policy periodically. We will notify you of significant
                        changes through the app. Your continued use after changes constitutes acceptance
                        of the updated policy.
                    </Text>
                </PolicySection>

                {/* 12. Contact Us */}
                <PolicySection title="12. Contact Us">
                    <Text style={styles.paragraph}>
                        For privacy-related questions or to exercise your data rights:
                    </Text>
                    <View style={styles.contactCard}>
                        <Text style={styles.contactLabel}>Email</Text>
                        <Text style={styles.contactValue}>localchat.official@gmail.com</Text>
                    </View>
                </PolicySection>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        By using BubbleUp, you agree to this Privacy Policy.
                    </Text>
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

    // Intro Card
    introCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    introText: {
        fontSize: 15,
        color: theme.tokens.text.primary,
        lineHeight: 22,
        marginBottom: 16,
    },
    dateRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    dateLabel: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
        width: 100,
    },
    dateValue: {
        fontSize: 13,
        color: theme.tokens.text.secondary,
        fontWeight: '500',
    },

    // Sections
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.tokens.text.primary,
        marginBottom: 12,
    },
    subheading: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginTop: 12,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        lineHeight: 22,
        marginBottom: 8,
    },
    bulletItem: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        lineHeight: 22,
        marginBottom: 6,
        paddingLeft: 8,
    },
    bold: {
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },

    // Contact Card
    contactCard: {
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    contactLabel: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
        marginBottom: 2,
    },
    contactValue: {
        fontSize: 15,
        color: theme.tokens.brand.primary,
        fontWeight: '500',
    },

    // Footer
    footer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
        textAlign: 'center',
    },
});

export { PrivacyPolicyScreen };
