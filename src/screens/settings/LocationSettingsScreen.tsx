/**
 * Location Settings Screen
 * 
 * Displays location privacy mode information.
 * Pushed as a new screen from the ProfileDrawer.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { theme } from '../../core/theme';

export default function LocationSettingsScreen() {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <ArrowLeft size={24} color={theme.tokens.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Location Mode</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Current Setting */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CURRENT SETTING</Text>
                    <View style={styles.settingCard}>
                        <View style={styles.settingRow}>
                            <View style={styles.iconContainer}>
                                <MapPin size={20} color={theme.tokens.brand.primary} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingLabel}>Approximate</Text>
                                <Text style={styles.settingValue}>Active</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Info Text */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                        We use an approximate location to protect your privacy, which is shared only when you create a room and never reveals your exact position.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

export { LocationSettingsScreen };

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.tokens.text.tertiary,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    settingCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.tokens.brand.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    settingValue: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        marginTop: 2,
    },
    infoCard: {
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 16,
        padding: 16,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 22,
        color: theme.tokens.text.secondary,
    },
});
