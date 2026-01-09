/**
 * Consent Screen
 * 
 * Premium consent screen designed for trust and minimal cognitive load.
 * Leads with reassurance, uses scannable guarantees, and reduces decision friction
 * while maintaining full GDPR/KVKK compliance.
 * 
 * Legal Requirements Addressed:
 * - GDPR Article 7(4): Consent is specific and granular (unbundled)
 * - GDPR Article 4(11): Clear affirmative action (checkboxes)
 * - GDPR Article 7(2): Request for consent clearly distinguishable
 * - KVKK Article 6: Explicit consent separate from general terms
 * 
 * Privacy Disclosures:
 * - Location: Randomized on device before sending to backend
 * - Rooms: Expire and become inaccessible (soft deleted)
 * - Device ID: For anonymous consent tracking and session security
 * - Location is optional: Users can browse global rooms without sharing location
 */

import * as React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Info } from 'lucide-react-native';
import { consentService } from '../../services/consent';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useTheme } from '../../core/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ConsentScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { logout } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Explicit consent checkboxes - GDPR Article 7 compliant
    const [tosAccepted, setTosAccepted] = React.useState(false);
    const [privacyAccepted, setPrivacyAccepted] = React.useState(false);

    // Both consents required to proceed
    const canContinue = tosAccepted && privacyAccepted;

    const handleContinue = async () => {
        if (!canContinue) return;

        setIsSubmitting(true);
        try {
            // 1. Force logout any stale session (e.g. from iOS Keychain persistence)
            await logout();

            // 2. Accept essential consents (ToS, Privacy)
            // Optional consents (location, ads, analytics) will be managed separately
            await consentService.acceptAll();

            // SessionManager and RootNavigator will reactively move the user 
            // to the WelcomeScreen once consentService.acceptAll() completes.
        } catch (error) {
            console.error('[ConsentScreen] Error during continuation:', error);
            // Fallback: attempt manual navigation if state sync fails
            navigation.replace('Auth', { screen: 'Welcome' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrivacySettings = () => {
        navigation.navigate('ConsentPreferences');
    };

    const handleViewTerms = () => {
        navigation.navigate('Auth', {
            screen: 'TermsOfService'
        });
    };

    const handleViewPrivacy = () => {
        navigation.navigate('Auth', {
            screen: 'PrivacyPolicy'
        });
    };

    const guarantees = [
        'Your exact location stays private',
        'Conversations expire (1-24 hours)',
        'Stay anonymous if you like',
        'We show ads to keep the app free',
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.tokens.bg.surface }]} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={theme.tokens.bg.surface} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    {/* Hero Section - Reassurance First */}
                    <View style={styles.heroSection}>
                        <Text style={[styles.title, { color: theme.tokens.text.primary }]}>
                            Your privacy comes first
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.tokens.text.secondary }]}>
                            We collect only what's needed to connect you with people nearby or around the world.
                        </Text>
                    </View>

                    {/* Core Guarantees - Scannable */}
                    <View style={styles.guaranteesSection}>
                        {guarantees.map((guarantee, index) => (
                            <View key={index} style={styles.guaranteeRow}>
                                <View style={[styles.guaranteeIcon, { backgroundColor: theme.tokens.brand.primary + '15' }]}>
                                    <Check size={14} color={theme.tokens.brand.primary} strokeWidth={3} />
                                </View>
                                <Text style={[styles.guaranteeText, { color: theme.tokens.text.primary }]}>
                                    {guarantee}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Subtle Disclosure */}
                    <View style={styles.disclosureSection}>
                        <View style={styles.disclosureRow}>
                            <Info size={12} color={theme.tokens.text.tertiary} />
                            <Text style={[styles.disclosureText, { color: theme.tokens.text.tertiary }]}>
                                Location sharing is optional
                            </Text>
                        </View>
                        <View style={styles.disclosureRow}>
                            <Info size={12} color={theme.tokens.text.tertiary} />
                            <Text style={[styles.disclosureText, { color: theme.tokens.text.tertiary }]}>
                                Manage preferences in settings anytime
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Actions - Premium feel with legal compliance */}
            <View style={[styles.actionsContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {/* Elegant Consent Acknowledgments */}
                <View style={styles.consentSection}>
                    <TouchableOpacity
                        style={styles.consentRow}
                        onPress={() => setTosAccepted(!tosAccepted)}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.checkbox,
                            { borderColor: tosAccepted ? theme.tokens.brand.primary : theme.tokens.border.subtle },
                            tosAccepted && { backgroundColor: theme.tokens.brand.primary }
                        ]}>
                            {tosAccepted && <Check size={10} color="#ffffff" strokeWidth={3} />}
                        </View>
                        <Text style={[styles.consentText, { color: theme.tokens.text.secondary }]}>
                            I agree to the{' '}
                            <Text
                                style={[styles.consentLink, { color: theme.tokens.brand.primary }]}
                                onPress={handleViewTerms}
                            >
                                Terms of Service
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.consentRow}
                        onPress={() => setPrivacyAccepted(!privacyAccepted)}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.checkbox,
                            { borderColor: privacyAccepted ? theme.tokens.brand.primary : theme.tokens.border.subtle },
                            privacyAccepted && { backgroundColor: theme.tokens.brand.primary }
                        ]}>
                            {privacyAccepted && <Check size={10} color="#ffffff" strokeWidth={3} />}
                        </View>
                        <Text style={[styles.consentText, { color: theme.tokens.text.secondary }]}>
                            I acknowledge the{' '}
                            <Text
                                style={[styles.consentLink, { color: theme.tokens.brand.primary }]}
                                onPress={handleViewPrivacy}
                            >
                                Privacy Policy
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        { backgroundColor: canContinue ? theme.tokens.brand.primary : theme.tokens.bg.subtle },
                        isSubmitting && { opacity: 0.8 }
                    ]}
                    onPress={handleContinue}
                    activeOpacity={0.8}
                    disabled={!canContinue || isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={theme.tokens.text.onPrimary} />
                    ) : (
                        <Text style={[
                            styles.continueButtonText,
                            { color: canContinue ? theme.tokens.text.onPrimary : theme.tokens.text.tertiary }
                        ]}>
                            Continue
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.settingsLink}
                    onPress={handlePrivacySettings}
                    activeOpacity={0.6}
                >
                    <Text style={[styles.settingsLinkText, { color: theme.tokens.text.tertiary }]}>
                        Privacy settings
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 28,
    },
    heroSection: {
        marginBottom: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        lineHeight: 34,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 24,
    },
    guaranteesSection: {
        marginBottom: 28,
        gap: 14,
    },
    guaranteeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    guaranteeIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guaranteeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 21,
    },
    disclosureSection: {
        gap: 8,
    },
    disclosureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    disclosureText: {
        fontSize: 12,
        lineHeight: 16,
    },
    actionsContainer: {
        paddingHorizontal: 28,
        paddingTop: 16,
    },
    consentSection: {
        gap: 12,
        marginBottom: 16,
    },
    consentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    checkbox: {
        width: 16,
        height: 16,
        borderRadius: 3,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    consentText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    consentLink: {
        fontWeight: '500',
    },
    continueButton: {
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 12,
    },
    continueButtonText: {
        fontSize: 17,
        fontWeight: '600',
    },
    settingsLink: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    settingsLinkText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
