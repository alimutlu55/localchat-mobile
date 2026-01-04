/**
 * DataControlsPage Component
 *
 * Full-page component for data control operations (GDPR/KVKK compliance).
 * Allows users to:
 * - Delete all rooms they've created
 * - Permanently delete their account and all associated data
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react-native';

interface DataControlsPageProps {
    onBack: () => void;
    onDeleteRooms: () => Promise<void>;
    onDeleteAccount: () => Promise<void>;
    isAnonymous: boolean;
    createdRoomsCount: number;
}

export function DataControlsPage({
    onBack,
    onDeleteRooms,
    onDeleteAccount,
    isAnonymous,
    createdRoomsCount,
}: DataControlsPageProps) {
    const [isDeletingRooms, setIsDeletingRooms] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const hasRooms = createdRoomsCount > 0;

    const handleDeleteRooms = async () => {
        Alert.alert(
            'Delete All My Rooms',
            'This will permanently delete all rooms you have created. All messages in these rooms will also be deleted. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All Rooms',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeletingRooms(true);
                        try {
                            await onDeleteRooms();
                        } finally {
                            setIsDeletingRooms(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account',
            'This will PERMANENTLY delete your account and ALL associated data including:\n\n• Your profile and settings\n• All rooms you created\n• All messages you sent\n• Your room participations\n\nThis action CANNOT be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: () => {
                        // Second confirmation
                        Alert.alert(
                            'Final Confirmation',
                            'Are you absolutely sure? All your data will be permanently erased and cannot be recovered.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete Everything',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setIsDeletingAccount(true);
                                        try {
                                            await onDeleteAccount();
                                        } finally {
                                            setIsDeletingAccount(false);
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                >
                    <ArrowLeft size={20} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.title}>Data Controls</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <AlertTriangle size={20} color="#f59e0b" />
                    <Text style={styles.infoText}>
                        These actions are permanent and cannot be undone. Please proceed with caution.
                    </Text>
                </View>

                {/* Delete Rooms Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delete my rooms</Text>
                    <Text style={styles.sectionDescription}>
                        {hasRooms
                            ? `You have ${createdRoomsCount} room(s). Permanently remove all rooms you have created. All messages in these rooms will also be deleted.`
                            : 'You haven\'t created any rooms yet.'
                        }
                    </Text>
                    <TouchableOpacity
                        style={[styles.dangerButton, (isDeletingRooms || !hasRooms) && styles.buttonDisabled]}
                        onPress={handleDeleteRooms}
                        disabled={isDeletingRooms || isDeletingAccount || !hasRooms}
                    >
                        {isDeletingRooms ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Trash2 size={18} color="#ffffff" />
                                <Text style={styles.dangerButtonText}>
                                    {hasRooms ? `Delete ${createdRoomsCount} Room(s)` : 'No Rooms to Delete'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Delete Account Section - Only for authenticated users */}
                {!isAnonymous && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Delete account</Text>
                        <Text style={styles.sectionDescription}>
                            Permanently remove your account and all associated data. This includes your profile, messages, rooms, and settings.
                        </Text>
                        <TouchableOpacity
                            style={[styles.dangerButton, styles.criticalButton, isDeletingAccount && styles.buttonDisabled]}
                            onPress={handleDeleteAccount}
                            disabled={isDeletingRooms || isDeletingAccount}
                        >
                            {isDeletingAccount ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <Trash2 size={18} color="#ffffff" />
                                    <Text style={styles.dangerButtonText}>Delete Account</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Anonymous user notice */}
                {isAnonymous && (
                    <View style={styles.anonymousNotice}>
                        <Text style={styles.anonymousNoticeText}>
                            As an anonymous user, deleting your rooms will remove all data associated with your session. You can create a new account at any time.
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    content: {
        flex: 1,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fef3c7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
    },
    section: {
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#991b1b',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#7f1d1d',
        lineHeight: 20,
        marginBottom: 16,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ef4444',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    criticalButton: {
        backgroundColor: '#b91c1c',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    dangerButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    anonymousNotice: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 16,
    },
    anonymousNoticeText: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
    },
});

export default DataControlsPage;
