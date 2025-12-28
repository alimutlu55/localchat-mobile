import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { X, UserX, RotateCcw } from 'lucide-react-native';
import { roomService, BannedUserDTO } from '../../services';
import { AvatarDisplay } from '../profile';
import { theme } from '../../core/theme';

interface BannedUsersModalProps {
    roomId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function BannedUsersModal({
    roomId,
    isOpen,
    onClose,
}: BannedUsersModalProps) {
    const [bannedUsers, setBannedUsers] = useState<BannedUserDTO[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUnbanning, setIsUnbanning] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadBannedUsers();
        }
    }, [isOpen, roomId]);

    const loadBannedUsers = async () => {
        setIsLoading(true);
        try {
            const users = await roomService.getBannedUsers(roomId);
            setBannedUsers(users);
        } catch (error) {
            console.error('Failed to load banned users:', error);
            Alert.alert('Error', 'Failed to load banned users');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnban = async (userId: string) => {
        setIsUnbanning(userId);
        try {
            await roomService.unbanUser(roomId, userId);
            setBannedUsers((prev) => prev.filter((u) => u.userId !== userId));
            Alert.alert('Success', 'User has been unbanned');
        } catch (error) {
            console.error('Failed to unban user:', error);
            Alert.alert('Error', 'Failed to unban user');
        } finally {
            setIsUnbanning(null);
        }
    };

    const renderBannedUser = ({ item }: { item: BannedUserDTO }) => (
        <View style={styles.userItem}>
            <AvatarDisplay
                avatarUrl={item.profilePhotoUrl}
                displayName={item.displayName || 'User'}
                size="md"
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.displayName}>
                    {item.displayName || `User ${item.userId.substring(0, 8)}...`}
                </Text>
                <Text style={styles.bannedAt}>
                    Banned: {new Date(item.bannedAt).toLocaleDateString()}
                </Text>
                {item.reason && <Text style={styles.reason}>Reason: {item.reason}</Text>}
            </View>
            <TouchableOpacity
                style={styles.unbanButton}
                onPress={() => handleUnban(item.userId)}
                disabled={!!isUnbanning}
            >
                {isUnbanning === item.userId ? (
                    <ActivityIndicator size="small" color={theme.tokens.brand.primary} />
                ) : (
                    <RotateCcw size={20} color={theme.tokens.brand.primary} />
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Banned Users</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={theme.tokens.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color={theme.tokens.brand.primary} style={styles.loader} />
                    ) : (
                        <FlatList
                            data={bannedUsers}
                            renderItem={renderBannedUser}
                            keyExtractor={(item) => item.userId}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <UserX size={48} color={theme.tokens.border.subtle} />
                                    <Text style={styles.emptyText}>No banned users in this room</Text>
                                </View>
                            }
                            contentContainerStyle={styles.listContainer}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: theme.tokens.bg.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.tokens.text.primary,
    },
    closeButton: {
        padding: 4,
    },
    loader: {
        marginTop: 40,
    },
    listContainer: {
        padding: 16,
        flexGrow: 1,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.tokens.bg.canvas,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    displayName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginBottom: 2,
    },
    userId: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.tokens.text.secondary,
        marginBottom: 2,
    },
    bannedAt: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
    reason: {
        fontSize: 13,
        color: theme.tokens.text.secondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    unbanButton: {
        padding: 8,
        backgroundColor: theme.tokens.action.secondary.default,
        borderRadius: 8,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: theme.tokens.text.tertiary,
        textAlign: 'center',
    },
});
