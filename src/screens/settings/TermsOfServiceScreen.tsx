/**
 * Terms of Service Screen
 *
 * Displays the terms of service for LocalChat.
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
interface TermsSectionProps {
    title: string;
    children: React.ReactNode;
}

function TermsSection({ title, children }: TermsSectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

/**
 * Terms of Service Screen Component
 */
export default function TermsOfServiceScreen() {
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
                <Text style={styles.headerTitle}>Terms of Service</Text>
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
                        Welcome to LocalChat! These Terms of Service govern your use of our
                        location-based ephemeral chat application. By using LocalChat, you
                        agree to these terms.
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

                {/* 1. Acceptance of Terms */}
                <TermsSection title="1. Acceptance of Terms">
                    <Text style={styles.paragraph}>
                        By downloading, installing, or using LocalChat, you agree to be bound
                        by these Terms of Service and our Privacy Policy. If you do not agree,
                        please do not use the app.
                    </Text>
                </TermsSection>

                {/* 2. Eligibility */}
                <TermsSection title="2. Eligibility">
                    <Text style={styles.paragraph}>
                        To use LocalChat, you must:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Be at least <Text style={styles.bold}>13 years of age</Text>
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Have parental/guardian consent if you are under 18
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Not be prohibited from using the service under applicable laws
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Have a device capable of accessing location services
                    </Text>
                </TermsSection>

                {/* 3. Account Types */}
                <TermsSection title="3. Account Types">
                    <Text style={styles.subheading}>Anonymous Accounts</Text>
                    <Text style={styles.bulletItem}>
                        • You can use LocalChat without registering by using a device-linked
                        anonymous account
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Anonymous accounts are tied to your device ID
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You can upgrade to a registered account at any time
                    </Text>

                    <Text style={styles.subheading}>Registered Accounts</Text>
                    <Text style={styles.bulletItem}>
                        • Register with email/password or Google Sign-In
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Provides account recovery and cross-device access
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You are responsible for maintaining account security
                    </Text>
                </TermsSection>

                {/* 4. How LocalChat Works */}
                <TermsSection title="4. How LocalChat Works">
                    <Text style={styles.subheading}>Location-Based Discovery</Text>
                    <Text style={styles.bulletItem}>
                        • Rooms are tied to geographic locations
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You can discover and join rooms near your current location
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Location permission is required for the app to function
                    </Text>

                    <Text style={styles.subheading}>Ephemeral Rooms</Text>
                    <Text style={styles.bulletItem}>
                        • Rooms automatically expire after <Text style={styles.bold}>1-24 hours</Text>
                        {' '}(set by the creator)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • When a room expires, it becomes inaccessible to all users
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Room creators can close rooms early
                    </Text>

                    <Text style={styles.subheading}>Room Categories</Text>
                    <Text style={styles.bulletItem}>
                        • Traffic & Transit, Events & Gatherings, Emergency & Safety,
                        Lost & Found, Sports & Recreation, Food & Dining, Neighborhood, and General
                    </Text>
                </TermsSection>

                {/* 5. Acceptable Use */}
                <TermsSection title="5. Acceptable Use">
                    <Text style={styles.paragraph}>
                        You agree to use LocalChat responsibly. You must <Text style={styles.bold}>NOT</Text>:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Post illegal, harmful, threatening, or abusive content
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Harass, bully, or intimidate other users
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Share personal information of others without consent
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Impersonate any person or entity
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Spam, advertise, or promote commercial content
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Share sexually explicit content or solicit minors
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Attempt to hack, exploit, or disrupt the service
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Create rooms in locations where you are not physically present
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Use the app for any illegal purpose
                    </Text>
                </TermsSection>

                {/* 6. Room Creator Responsibilities */}
                <TermsSection title="6. Room Creator Responsibilities">
                    <Text style={styles.paragraph}>
                        When you create a room, you have additional responsibilities:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Use appropriate titles and descriptions
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Select the correct category for your room
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You can <Text style={styles.bold}>kick</Text> users who misbehave (they can rejoin)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You can <Text style={styles.bold}>ban</Text> users who violate guidelines (permanent
                        removal from your room)
                    </Text>
                    <Text style={styles.bulletItem}>
                        • You can close your room at any time
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Room creation limits may apply (currently 3 rooms per day)
                    </Text>
                </TermsSection>

                {/* 7. Content Ownership */}
                <TermsSection title="7. Content Ownership">
                    <Text style={styles.paragraph}>
                        You retain ownership of content you post. By posting, you grant LocalChat
                        a license to display and distribute your content within the app during the
                        room's lifetime. When the room expires, your content is deleted.
                    </Text>
                    <Text style={styles.paragraph}>
                        You represent that you have the right to share any content you post and
                        that it does not violate any laws or these terms.
                    </Text>
                </TermsSection>

                {/* 8. Blocking and Reporting */}
                <TermsSection title="8. Blocking and Reporting">
                    <Text style={styles.bulletItem}>
                        • You can block other users to hide their messages from your view
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Blocking is one-way: blocked users can still see your messages
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Room creators can ban users who violate room rules
                    </Text>
                </TermsSection>

                {/* 9. Termination */}
                <TermsSection title="9. Termination">
                    <Text style={styles.paragraph}>
                        We may suspend or terminate your account if you:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Violate these Terms of Service
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Engage in harmful or abusive behavior
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Create legal risk for LocalChat
                    </Text>
                    <Text style={styles.paragraph}>
                        You may delete your account at any time through Settings. Account
                        deletion is permanent.
                    </Text>
                </TermsSection>

                {/* 10. Disclaimers */}
                <TermsSection title="10. Disclaimers">
                    <Text style={styles.paragraph}>
                        LocalChat is provided "as is" without warranties. We do not guarantee:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Uninterrupted or error-free service
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Accuracy of content shared by users
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Safety of in-person meetings with other users
                    </Text>
                    <View style={styles.warningBox}>
                        <Text style={styles.warningText}>
                            ⚠️ <Text style={styles.bold}>Safety Warning:</Text> Exercise caution
                            when meeting people from online platforms in person. LocalChat is not
                            responsible for offline interactions.
                        </Text>
                    </View>
                </TermsSection>

                {/* 11. Limitation of Liability */}
                <TermsSection title="11. Limitation of Liability">
                    <Text style={styles.paragraph}>
                        To the maximum extent permitted by law, LocalChat shall not be liable
                        for any indirect, incidental, special, or consequential damages, including:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Loss of data or profits
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Personal injury from offline meetings
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Actions of other users
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Service interruptions
                    </Text>
                </TermsSection>

                {/* 12. Content Moderation */}
                <TermsSection title="12. Content Moderation">
                    <Text style={styles.paragraph}>
                        We reserve the right to:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Remove or refuse any content without prior notice
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Suspend or terminate accounts for violations
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Cooperate with law enforcement when required
                    </Text>
                    <Text style={styles.paragraph}>
                        Users are responsible for all content they post. LocalChat acts as a
                        platform provider, not a publisher of user content.
                    </Text>
                </TermsSection>

                {/* 13. Reporting Violations */}
                <TermsSection title="13. Reporting Violations">
                    <Text style={styles.paragraph}>
                        To report content or behavior that violates these Terms:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Use the in-app Report feature on any message or user
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Email: localchat.official@gmail.com
                    </Text>
                    <Text style={styles.paragraph}>
                        We review all reports and take appropriate action.
                    </Text>
                </TermsSection>

                {/* 14. Indemnification */}
                <TermsSection title="14. Indemnification">
                    <Text style={styles.paragraph}>
                        You agree to defend, indemnify, and hold harmless LocalChat and its
                        operators from any claims, damages, or expenses arising from:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Your use of the Service
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Content you post or transmit
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Violation of these Terms
                    </Text>
                    <Text style={styles.bulletItem}>
                        • Infringement of any third-party rights
                    </Text>
                </TermsSection>

                {/* 15. Governing Law */}
                <TermsSection title="15. Governing Law">
                    <Text style={styles.paragraph}>
                        These Terms shall be governed by and construed in accordance with
                        applicable laws based on your location:
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>EU/EEA users</Text> - Laws of your country of residence
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>US users</Text> - Laws of the State of Delaware
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Turkey users</Text> - Laws of the Republic of Turkey
                    </Text>
                    <Text style={styles.bulletItem}>
                        • <Text style={styles.bold}>Other</Text> - Laws of the State of Delaware, USA
                    </Text>
                </TermsSection>

                {/* 16. Changes to Terms */}
                <TermsSection title="16. Changes to Terms">
                    <Text style={styles.paragraph}>
                        We may update these Terms of Service. Significant changes will be
                        notified through the app. Continued use after changes constitutes
                        acceptance.
                    </Text>
                </TermsSection>

                {/* 17. Contact */}
                <TermsSection title="17. Contact">
                    <Text style={styles.paragraph}>
                        For questions about these Terms of Service:
                    </Text>
                    <View style={styles.contactCard}>
                        <Text style={styles.contactLabel}>Email</Text>
                        <Text style={styles.contactValue}>localchat.official@gmail.com</Text>
                    </View>
                </TermsSection>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        By using LocalChat, you acknowledge that you have read, understood,
                        and agree to these Terms of Service.
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

    // Warning Box
    warningBox: {
        backgroundColor: theme.tokens.status.warning.bg,
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    warningText: {
        fontSize: 14,
        color: theme.tokens.text.primary,
        lineHeight: 20,
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
        lineHeight: 20,
    },
});

export { TermsOfServiceScreen };
