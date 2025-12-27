/**
 * AboutSection Component
 * 
 * App information and legal links section
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HelpCircle, Scale, Eye, Globe, MapPin, Languages } from 'lucide-react-native';
import { Section, SettingRow } from './shared';

interface AboutSectionProps {
    onHelpPress: () => void;
    onLanguagePress: () => void;
    onLocationPress: () => void;
}

export function AboutSection({
    onHelpPress,
    onLanguagePress,
    onLocationPress,
}: AboutSectionProps) {
    return (
        <>
            {/* Privacy & Safety */}
            <Section title="PRIVACY & SAFETY">
                <SettingRow
                    icon={MapPin}
                    label="Location Mode"
                    value="Precise"
                    onPress={onLocationPress}
                />
            </Section>

            {/* Preferences */}
            <Section title="PREFERENCES">
                <SettingRow
                    icon={Languages}
                    label="Language"
                    value="English"
                    onPress={onLanguagePress}
                />
            </Section>

            {/* About */}
            <Section title="ABOUT">
                <SettingRow
                    icon={HelpCircle}
                    label="Help Center"
                    onPress={onHelpPress}
                />
                <SettingRow
                    icon={Scale}
                    label="Terms of Service"
                    onPress={() => console.log('Terms')}
                />
                <SettingRow
                    icon={Eye}
                    label="Privacy Policy"
                    onPress={() => console.log('Privacy policy')}
                />
                <View style={styles.settingRow}>
                    <Globe size={20} color="#6b7280" />
                    <Text style={styles.settingLabel}>Version</Text>
                    <Text style={styles.settingValue}>1.0.0</Text>
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
