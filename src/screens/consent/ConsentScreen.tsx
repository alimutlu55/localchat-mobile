/**
 * Consent Screen
 * 
 * Premium consent screen designed for trust and minimal cognitive load.
 * Leads with reassurance, uses scannable guarantees, and reduces decision friction.
 * 
 * GDPR/KVKK-compliant - accurately reflects LocalChat's data practices:
 * - Location: Randomized on device before sending to backend
 * - Rooms: Expire and become inaccessible (soft deleted)
 * - Device ID: For anonymous consent tracking and session security
 * - Location is optional: Users can browse global rooms without sharing location
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Info } from 'lucide-react-native';
import { consentService } from '../../services/consent';
import { useTheme } from '../../core/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ConsentScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const handleContinue = async () => {
        await consentService.acceptAll();
        navigation.replace('Auth', { screen: 'Welcome' });
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
        'Location: randomized before sharing',
        'Conversations expire (1-24 hours)',
        'Stay anonymous if you like',
        'We show ads to keep the app free',
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.tokens.bg.surface }]} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={theme.tokens.bg.surface} />

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
                            <View style={[styles.checkIcon, { backgroundColor: theme.tokens.brand.primary + '15' }]}>
                                <Check size={16} color={theme.tokens.brand.primary} strokeWidth={3} />
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
                        <Info size={14} color={theme.tokens.text.tertiary} />
                        <Text style={[styles.disclosureText, { color: theme.tokens.text.tertiary }]}>
                            Location sharing is optional
                        </Text>
                    </View>
                    <View style={styles.disclosureRow}>
                        <Info size={14} color={theme.tokens.text.tertiary} />
                        <Text style={[styles.disclosureText, { color: theme.tokens.text.tertiary }]}>
                            Manage preferences in settings
                        </Text>
                    </View>
                </View>
            </View>

            {/* Actions - Reduced Friction */}
            <View style={[styles.actionsContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: theme.tokens.brand.primary }]}
                    onPress={handleContinue}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.continueButtonText, { color: theme.tokens.text.onPrimary }]}>
                        Continue
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.settingsLink}
                    onPress={handlePrivacySettings}
                    activeOpacity={0.6}
                >
                    <Text style={[styles.settingsLinkText, { color: theme.tokens.text.secondary }]}>
                        Privacy settings
                    </Text>
                </TouchableOpacity>

                {/* Legal Footer */}
                <Text style={[styles.legalText, { color: theme.tokens.text.tertiary }]}>
                    By continuing, you agree to our{' '}
                    <Text style={[styles.legalLink, { color: theme.tokens.brand.primary }]} onPress={handleViewTerms}>
                        Terms
                    </Text>
                    {' '}&{' '}
                    <Text style={[styles.legalLink, { color: theme.tokens.brand.primary }]} onPress={handleViewPrivacy}>
                        Privacy Policy
                    </Text>
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: 'center',
    },
    heroSection: {
        marginBottom: 40,
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
        marginBottom: 32,
        gap: 16,
    },
    guaranteeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    checkIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guaranteeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 22,
    },
    disclosureSection: {
        gap: 10,
    },
    disclosureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    disclosureText: {
        fontSize: 13,
        lineHeight: 18,
    },
    actionsContainer: {
        paddingHorizontal: 28,
        gap: 16,
    },
    continueButton: {
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    continueButtonText: {
        fontSize: 17,
        fontWeight: '600',
    },
    settingsLink: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    settingsLinkText: {
        fontSize: 15,
        fontWeight: '500',
    },
    legalText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 8,
    },
    legalLink: {
        fontWeight: '500',
    },
});
