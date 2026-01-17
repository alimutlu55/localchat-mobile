/**
 * Data Controls Screen
 * 
 * Full standalone screen for data control operations (GDPR/KVKK compliance).
 * Pushed as a new screen from the ProfileDrawer.
 * 
 * Allows users to:
 * - Delete all rooms they've created
 * - Permanently delete their account and all associated data
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react-native';
import { theme } from '../../core/theme';
import { useCurrentUser, useIsAnonymous } from '../../features/user';
import { useMyRooms } from '../../features/rooms/hooks';
import { useRoomStore } from '../../features/rooms/store/RoomStore';
import { useAuth } from '../../features/auth';
import { authService } from '../../services/auth';
import { storage } from '../../services/storage';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('DataControlsScreen');

export default function DataControlsScreen() {
    const navigation = useNavigation();
    const user = useCurrentUser();
    const isAnonymous = useIsAnonymous();
    const { activeRooms: myRooms } = useMyRooms();
    const { hardDeleteAccount } = useAuth();

    const [isDeletingRooms, setIsDeletingRooms] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const createdRoomsCount = useMemo(() =>
        myRooms.filter(r => r.isCreator).length,
        [myRooms]
    );
    const hasRooms = createdRoomsCount > 0;

    const handleDeleteRooms = useCallback(async () => {
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
                            const store = useRoomStore.getState();
                            const result = await authService.deleteMyRooms();

                            if (result.roomsDeleted === 0) {
                                Alert.alert(
                                    'No Rooms Found',
                                    'You haven\'t created any rooms to delete.'
                                );
                            } else {
                                // Optimistically remove each created room from the store
                                store.createdRoomIds.forEach(id => {
                                    store.removeRoom(id);
                                });
                                store.setCreatedRoomIds(new Set());

                                Alert.alert(
                                    'Rooms Deleted',
                                    `${result.roomsDeleted} room(s) have been permanently deleted.`
                                );
                            }
                            log.info('Deleted user rooms', { count: result.roomsDeleted });
                        } catch (error) {
                            log.error('Failed to delete rooms', { error });
                            Alert.alert('Error', 'Failed to delete rooms. Please try again.');
                        } finally {
                            setIsDeletingRooms(false);
                        }
                    },
                },
            ]
        );
    }, []);

    const handleClearCache = useCallback(async () => {
        Alert.alert(
            'Clear App Cache',
            'This will clear all locally cached messages, rooms, and preferences. Your account and created rooms will NOT be affected and will sync back from the server.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Cache',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await storage.clear();
                            Alert.alert(
                                'Cache Cleared',
                                'App data has been cleared. The app will now restart to apply changes.',
                                [{ text: 'OK', onPress: () => { /* Restarting logic would go here if needed */ } }]
                            );
                            log.info('User cleared local app cache');
                        } catch (error) {
                            log.error('Failed to clear cache', { error });
                            Alert.alert('Error', 'Failed to clear cache. Please try again.');
                        }
                    },
                },
            ]
        );
    }, []);

    const handleDeleteAccount = useCallback(async () => {
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
                                            await storage.set('skip_auto_login', true);
                                            await hardDeleteAccount();
                                            log.info('Account hard deleted successfully');
                                        } catch (error) {
                                            log.error('Failed to hard delete account', { error });
                                            Alert.alert('Error', 'Failed to delete account. Please try again.');
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
    }, [hardDeleteAccount]);

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
                <Text style={styles.headerTitle}>Data Controls</Text>
                <View style={styles.headerSpacer} />
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

                {/* Clear Cache Section */}
                <View style={[styles.section, styles.cacheSection]}>
                    <Text style={[styles.sectionTitle, styles.cacheTitle]}>Clear App Cache</Text>
                    <Text style={[styles.sectionDescription, styles.cacheDescription]}>
                        Remove all locally stored data. This can help if the app is behaving unexpectedly.
                    </Text>
                    <TouchableOpacity
                        style={styles.cacheButton}
                        onPress={handleClearCache}
                        disabled={isDeletingRooms || isDeletingAccount}
                    >
                        <Trash2 size={18} color={theme.tokens.text.primary} />
                        <Text style={styles.cacheButtonText}>Clear Cache</Text>
                    </TouchableOpacity>
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
        </SafeAreaView>
    );
}

export { DataControlsScreen };

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
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 12,
        padding: 16,
    },
    anonymousNoticeText: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        lineHeight: 20,
    },
    cacheSection: {
        backgroundColor: theme.tokens.bg.subtle,
    },
    cacheTitle: {
        color: theme.tokens.text.primary,
    },
    cacheDescription: {
        color: theme.tokens.text.secondary,
    },
    cacheButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tokens.bg.surface,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 8,
    },
    cacheButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
});
