/**
 * Consent Screen
 * 
 * GDPR/KVKK-compliant consent screen shown on first app launch.
 * Users must accept Terms of Service and Privacy Policy before proceeding.
 * 
 * Legal Review: This screen accurately reflects LocalChat's data practices:
 * - Location: Used in real-time for room discovery (NOT stored on servers)
 * - Device ID: For anonymous account management  
 * - Messages: Stored temporarily until room expires (1-24 hours)
 * - Third-party: Google Maps receives location data for map display
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, MessageCircle, Shield, Clock } from 'lucide-react-native';
import { consentService } from '../../services/consent';
import { getLocationPermissionStore } from '../../shared/stores/LocationConsentStore';
import { useTheme } from '../../core/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ConsentScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const handleAcceptAll = async () => {
        await consentService.acceptAll();
        navigation.replace('Auth', { screen: 'Welcome' });
    };

    const handleSetPreferences = () => {
        navigation.navigate('ConsentPreferences');
    };

    const handleOnlyEssential = async () => {
        await consentService.acceptEssential();
        navigation.replace('Auth', { screen: 'Welcome' });
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.tokens.bg.surface }]} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={theme.tokens.bg.surface} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* App Branding Icons - represent core features */}
                <View style={styles.iconRow}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.tokens.brand.primary + '10', borderColor: theme.tokens.brand.primary + '20' }]}>
                        <MapPin size={32} color={theme.tokens.brand.primary} strokeWidth={2} />
                    </View>
                    <View style={[styles.iconContainer, { backgroundColor: theme.tokens.brand.primary + '10', borderColor: theme.tokens.brand.primary + '20' }]}>
                        <MessageCircle size={32} color={theme.tokens.brand.primary} strokeWidth={2} />
                    </View>
                    <View style={[styles.iconContainer, { backgroundColor: theme.tokens.brand.primary + '10', borderColor: theme.tokens.brand.primary + '20' }]}>
                        <Clock size={32} color={theme.tokens.brand.primary} strokeWidth={2} />
                    </View>
                    <View style={[styles.iconContainer, { backgroundColor: theme.tokens.brand.primary + '10', borderColor: theme.tokens.brand.primary + '20' }]}>
                        <Shield size={32} color={theme.tokens.brand.primary} strokeWidth={2} />
                    </View>
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: theme.tokens.text.primary }]}>Your privacy matters</Text>

                {/* Main Description - Legally accurate */}
                <Text style={[styles.description, { color: theme.tokens.text.secondary }]}>
                    <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>LocalChat</Text> is a location-based ephemeral
                    chat app. To connect you with nearby rooms, we need to process certain data:
                </Text>

                {/* Data Collection Summary */}
                <View style={[styles.dataCard, { backgroundColor: theme.tokens.bg.subtle }]}>
                    <Text style={[styles.dataTitle, { color: theme.tokens.text.primary }]}>What we collect:</Text>
                    <Text style={[styles.dataItem, { color: theme.tokens.text.secondary }]}>
                        • <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Location</Text> — Used in real-time to discover
                        nearby rooms. When you create a room, only an approximate location (within ~500m) is stored—never your exact position.
                    </Text>
                    <Text style={[styles.dataItem, { color: theme.tokens.text.secondary }]}>
                        • <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Rooms & Messages</Text> — Automatically deleted
                        when rooms expire (1-24 hours).
                    </Text>
                    <Text style={[styles.dataItem, { color: theme.tokens.text.secondary }]}>
                        • <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Device ID</Text> — For anonymous account
                        management and session security.
                    </Text>
                </View>

                {/* Third-party disclosure */}
                <Text style={[styles.secondaryDescription, { color: theme.tokens.text.tertiary }]}>
                    Your location is shared with <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Google Maps</Text> to
                    display the map interface. We do not sell your data or use third-party
                    analytics.
                </Text>

                {/* Consent options explanation */}
                <Text style={[styles.optionsTitle, { color: theme.tokens.text.primary }]}>Your choices:</Text>
                <Text style={[styles.optionItem, { color: theme.tokens.text.tertiary }]}>
                    <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Accept all</Text> — Enable optional analytics to help
                    us improve LocalChat.
                </Text>
                <Text style={[styles.optionItem, { color: theme.tokens.text.tertiary }]}>
                    <Text style={[styles.bold, { color: theme.tokens.text.primary }]}>Only essential</Text> — Use LocalChat with only the
                    data required for core functionality.
                </Text>

            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.tokens.brand.primary }]}
                    onPress={handleAcceptAll}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.primaryButtonText, { color: theme.tokens.text.onPrimary }]}>Accept all</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: theme.tokens.bg.surface, borderColor: theme.tokens.border.subtle }]}
                    onPress={handleSetPreferences}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.secondaryButtonText, { color: theme.tokens.text.secondary }]}>Set preferences</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { backgroundColor: theme.tokens.bg.surface, borderColor: theme.tokens.border.subtle }]}
                    onPress={handleOnlyEssential}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.secondaryButtonText, { color: theme.tokens.text.secondary }]}>Only essential</Text>
                </TouchableOpacity>

                {/* Legal links moved to the bottom */}
                <View style={[styles.legalLinks, { borderTopColor: theme.tokens.border.subtle }]}>
                    <Text style={[styles.legalText, { color: theme.tokens.text.tertiary }]}>
                        By continuing, you agree to our{' '}
                        <Text style={[styles.link, { color: theme.tokens.brand.primary }]} onPress={handleViewTerms}>Terms of Service</Text>
                        {' '}and{' '}
                        <Text style={[styles.link, { color: theme.tokens.brand.primary }]} onPress={handleViewPrivacy}>Privacy Policy</Text>.
                    </Text>
                </View>
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
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 20,
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginBottom: 28,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 14,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 12,
        lineHeight: 32,
    },
    description: {
        fontSize: 15,
        lineHeight: 23,
        marginBottom: 16,
    },
    bold: {
        fontWeight: '600',
    },
    dataCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    dataTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    dataItem: {
        fontSize: 14,
        lineHeight: 21,
        marginBottom: 8,
    },
    secondaryDescription: {
        fontSize: 14,
        lineHeight: 21,
        marginBottom: 20,
    },
    optionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    optionItem: {
        fontSize: 14,
        lineHeight: 21,
        marginBottom: 6,
    },
    legalLinks: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
    },
    legalText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
    },
    link: {
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        paddingHorizontal: 24,
        gap: 8,
        marginTop: 12,
    },
    primaryButton: {
        paddingVertical: 12,
        borderRadius: 30,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        paddingVertical: 12,
        borderRadius: 30,
        alignItems: 'center',
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
});
