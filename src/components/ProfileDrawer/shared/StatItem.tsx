/**
 * StatItem Component
 * 
 * Displays a single statistic with icon, value, and label
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatItemProps {
    label: string;
    value: string | number | null;
    icon: React.ComponentType<{ size: number; color: string }>;
}

export function StatItem({ label, value, icon: Icon }: StatItemProps) {
    // Format display value - show dash for null
    const displayValue = value === null ? '—' : value;

    return (
        <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
                <Icon size={16} color="#FF6410" />
            </View>
            <Text style={styles.statValue}>{displayValue}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 11,
        color: '#6b7280',
    },
});
