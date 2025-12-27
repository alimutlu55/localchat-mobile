/**
 * SettingRow Component
 * 
 * Reusable setting row with icon, label, and action (toggle or navigation)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

interface SettingRowProps {
    icon: React.ComponentType<{ size: number; color: string }>;
    label: string;
    value?: string;
    onPress?: () => void;
    isToggle?: boolean;
    isEnabled?: boolean;
    onToggle?: (value: boolean) => void;
    danger?: boolean;
}

export function SettingRow({
    icon: Icon,
    label,
    value,
    onPress,
    isToggle,
    isEnabled,
    onToggle,
    danger,
}: SettingRowProps) {
    const iconColor = danger ? '#ef4444' : '#6b7280';
    const textColor = danger ? '#ef4444' : '#1f2937';

    if (isToggle) {
        return (
            <View style={styles.settingRow}>
                <Icon size={20} color={iconColor} />
                <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
                <Switch
                    value={isEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: '#e5e7eb', true: '#fdba74' }}
                    thumbColor={isEnabled ? '#f97316' : '#f4f4f5'}
                />
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={styles.settingRow}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Icon size={20} color={iconColor} />
            <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
            {value && <Text style={styles.settingValue}>{value}</Text>}
            <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
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
