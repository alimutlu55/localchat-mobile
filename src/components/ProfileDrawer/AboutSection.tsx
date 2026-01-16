/**
 * AboutSection Component
 * 
 * App information and legal links section
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HelpCircle, Scale, Eye, Globe, MapPin, Languages, AlertCircle, Shield } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

export interface AboutSectionProps {
    appVersion: string;
    language: string;
    locationMode: string;
    onLanguagePress: () => void;
    onLocationPress: () => void;
    onTermsPress: () => void;
    onPrivacyPolicyPress: () => void;
    onReportProblemPress: () => void;
    onConsentPreferencesPress: () => void;
}

export function AboutSection({
    appVersion,
    language,
    locationMode,
    onLanguagePress,
    onLocationPress,
    onTermsPress,
    onPrivacyPolicyPress,
    onReportProblemPress,
    onConsentPreferencesPress,
}: AboutSectionProps) {
    // Format location mode for display (with fallback)
    const locationModeDisplay = locationMode
        ? locationMode.charAt(0).toUpperCase() + locationMode.slice(1)
        : 'Approximate';

    // Format language for display
    const languageDisplay = language === 'en' ? 'English' : (language || 'EN').toUpperCase();

    return (
        <>
            {/* Privacy & Safety */}
            <Section title="PRIVACY & SAFETY">
                <SettingRow
                    icon={MapPin}
                    label="Location Mode"
                    value={locationModeDisplay}
                    onPress={onLocationPress}
                />
                <SettingRow
                    icon={Shield}
                    label="Privacy Preferences"
                    onPress={onConsentPreferencesPress}
                />
            </Section>

            {/* Preferences */}
            <Section title="PREFERENCES">
                <SettingRow
                    icon={Languages}
                    label="Language"
                    value={languageDisplay}
                    onPress={onLanguagePress}
                />
            </Section>

            {/* About */}
            <Section title="ABOUT">
                <SettingRow
                    icon={AlertCircle}
                    label="Report a Problem"
                    onPress={onReportProblemPress}
                />
                <SettingRow
                    icon={Scale}
                    label="Terms of Service"
                    onPress={onTermsPress}
                />
                <SettingRow
                    icon={Eye}
                    label="Privacy Policy"
                    onPress={onPrivacyPolicyPress}
                />
                <View style={styles.settingRow}>
                    <Globe size={20} color="#6b7280" />
                    <Text style={styles.settingLabel}>Version</Text>
                    <Text style={styles.settingValue}>{appVersion}</Text>
                </View>
            </Section>
        </>
    );
}

const styles = StyleSheet.create({
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    settingLabel: {
        flex: 1,
        fontSize: 14,
        color: '#1f2937',
        marginLeft: 12,
    },
    settingValue: {
        fontSize: 14,
        color: '#9ca3af',
        marginRight: 8,
    },
});
