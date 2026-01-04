/**
 * AboutSection Component
 * 
 * App information and legal links section
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HelpCircle, Scale, Eye, Globe, MapPin, Languages, AlertCircle } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AboutSectionProps {
    appVersion: string;
    language: string;
    locationMode: string;
    onHelpPress: () => void;
    onLanguagePress: () => void;
    onLocationPress: () => void;
    onTermsPress: () => void;
    onPrivacyPolicyPress: () => void;
    onReportProblemPress: () => void;
}

export function AboutSection({
    appVersion,
    language,
    locationMode,
    onHelpPress,
    onLanguagePress,
    onLocationPress,
    onTermsPress,
    onPrivacyPolicyPress,
    onReportProblemPress,
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
                    icon={HelpCircle}
                    label="About & Help"
                    onPress={onHelpPress}
                />
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
