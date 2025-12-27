/**
 * Section Component
 * 
 * Reusable section wrapper with title and content
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionContent}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9ca3af',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionContent: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        overflow: 'hidden',
    },
});
