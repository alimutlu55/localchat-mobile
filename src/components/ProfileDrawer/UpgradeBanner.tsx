/**
 * UpgradeBanner Component
 * 
 * Displays upgrade prompt for anonymous users
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';

interface UpgradeBannerProps {
    isAnonymous: boolean;
    onUpgrade: () => void;
}

export function UpgradeBanner({ isAnonymous, onUpgrade }: UpgradeBannerProps) {
    if (!isAnonymous) {
        return null;
    }

    return (
        <View style={styles.upgradeBanner}>
            <View style={styles.upgradeIcon}>
                <Sparkles size={20} color="#FF6410" />
            </View>
            <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeTitle}>Upgrade to Account</Text>
                <Text style={styles.upgradeSubtitle}>
                    Save your preferences and history
                </Text>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
                <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    upgradeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff7ed',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    upgradeIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    upgradeInfo: {
        flex: 1,
    },
    upgradeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
    },
    upgradeSubtitle: {
        fontSize: 12,
        color: '#9ca3af',
    },
    upgradeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    upgradeButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#1f2937',
    },
});
