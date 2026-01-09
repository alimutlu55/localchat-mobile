/**
 * Consent Preferences Screen
 * 
 * GDPR/KVKK-compliant preferences screen.
 * Essential consents (ToS + Privacy) are always required and cannot be toggled off.
 * Optional consents (Analytics, Marketing) can be customized.
 * 
 * Legal Note: Essential processing is based on "contractual necessity" and 
 * "legitimate interests" (security, fraud prevention). Optional consents are
 * based on explicit user consent.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check, Lock, BarChart3, Tv } from 'lucide-react-native';
import { consentService } from '../../services/consent';
import { getLocationPermissionStore } from '../../shared/stores/LocationConsentStore';
import { useTheme } from '../../core/theme';

type NavigationProp = NativeStackNavigationProp<any>;

export default function ConsentPreferencesScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();

    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
    const [personalizedAdsEnabled, setPersonalizedAdsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load existing consent preferences on mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const status = await consentService.getStatus();
                if (status.options) {
                    setAnalyticsEnabled(status.options.analyticsConsent || false);
                    setPersonalizedAdsEnabled(status.options.personalizedAdsConsent || false);
                }
            } catch (error) {
                console.error('[ConsentPreferences] Failed to load preferences:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPreferences();
    }, []);

    const handleSave = async () => {
        await consentService.saveConsent({
            tosAccepted: true,
            privacyAccepted: true,
            analyticsConsent: analyticsEnabled,
            locationConsent: false, // Will be set after OS permission is granted
            personalizedAdsConsent: personalizedAdsEnabled,
        });
        // Navigate back instead of replacing to Welcome
        navigation.goBack();
    };

    const handleBack = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Preferences</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Essential Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Lock size={16} color="#6b7280" />
                        <Text style={styles.sectionTitle}>Essential (Required)</Text>
                    </View>
                    <Text style={styles.sectionDescription}>
                        Required for BubbleUp to function. These cannot be disabled.
                    </Text>

                    <View style={styles.preferenceItem}>
                        <View style={styles.preferenceInfo}>
                            <Text style={styles.preferenceTitle}>Terms of Service</Text>
                            <Text style={styles.preferenceDescription}>
                                Agreement to our usage rules, including acceptable behavior,
                                account types, and content policies.
                            </Text>
                        </View>
                        <View style={styles.checkContainer}>
                            <Check size={18} color="#22c55e" strokeWidth={3} />
                        </View>
                    </View>

                    <View style={styles.preferenceItem}>
                        <View style={styles.preferenceInfo}>
                            <Text style={styles.preferenceTitle}>Privacy Policy</Text>
                            <Text style={styles.preferenceDescription}>
                                How we collect, use, and protect your data including location,
                                messages, and account information.
                            </Text>
                        </View>
                        <View style={styles.checkContainer}>
                            <Check size={18} color="#22c55e" strokeWidth={3} />
                        </View>
                    </View>
                </View>

                {/* Optional Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Optional</Text>
                    <Text style={styles.sectionDescription}>
                        These help improve your experience but are not required.
                    </Text>

                    <View style={styles.preferenceItem}>
                        <View style={styles.iconContainer}>
                            <Tv size={20} color="#6366F1" />
                        </View>
                        <View style={styles.preferenceInfo}>
                            <Text style={styles.preferenceTitle}>Personalized Ads</Text>
                            <Text style={styles.preferenceDescription}>
                                Ads tailored to your interests. Basic ads consent is managed through Google's consent dialog in GDPR regions.
                            </Text>
                        </View>
                        <Switch
                            value={personalizedAdsEnabled}
                            onValueChange={setPersonalizedAdsEnabled}
                            trackColor={{ false: '#d1d5db', true: '#6366F1' }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    <View style={styles.preferenceItem}>
                        <View style={styles.iconContainer}>
                            <BarChart3 size={20} color="#6366F1" />
                        </View>
                        <View style={styles.preferenceInfo}>
                            <Text style={styles.preferenceTitle}>Usage Analytics</Text>
                            <Text style={styles.preferenceDescription}>
                                Help us improve BubbleUp with anonymized usage data.
                            </Text>
                        </View>
                        <Switch
                            value={analyticsEnabled}
                            onValueChange={setAnalyticsEnabled}
                            trackColor={{ false: '#d1d5db', true: '#6366F1' }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </View>

                {/* Legal note */}
                <View style={styles.legalNote}>
                    <Text style={styles.legalNoteText}>
                        We process essential data based on contractual necessity and legitimate
                        interests (security, service delivery). Optional data processing is
                        based on your explicit consent.
                    </Text>
                </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.tokens.brand.primary }]}
                    onPress={handleSave}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.saveButtonText, { color: theme.tokens.text.onPrimary }]}>Confirm & Continue</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 20,
    },
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 12,
        lineHeight: 18,
    },
    preferenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    preferenceInfo: {
        flex: 1,
        marginRight: 12,
    },
    preferenceTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 2,
    },
    preferenceDescription: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 17,
    },
    checkContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionalBadge: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6b7280',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    legalNote: {
        backgroundColor: '#f9fafb',
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
    },
    legalNoteText: {
        fontSize: 12,
        color: '#9ca3af',
        lineHeight: 17,
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    saveButton: {
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
