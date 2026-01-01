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
import { roomService, BannedUserDTO } from '../../../services';
import { AvatarDisplay } from '../../../components/profile';
import { useRealtimeProfile } from '../../user/hooks/useRealtimeProfile';

interface BannedUserItemProps {
    item: BannedUserDTO;
    onUnban: (userId: string) => void;
    isUnbanning: boolean;
}

function BannedUserItem({ item: initialItem, onUnban, isUnbanning }: BannedUserItemProps) {
    const item = useRealtimeProfile({
        userId: initialItem.userId,
        displayName: initialItem.displayName || 'User',
        profilePhotoUrl: initialItem.profilePhotoUrl,
    });

    return (
        <View style={styles.userItem}>
            <AvatarDisplay
                avatarUrl={item.profilePhotoUrl}
                displayName={item.displayName}
                size="md"
                style={styles.avatar}
            />
            <View style={styles.userInfo}>
                <Text style={styles.displayName}>
                    {item.displayName}
                </Text>
                <Text style={styles.bannedAt}>
                    Banned: {new Date(initialItem.bannedAt).toLocaleDateString()}
                </Text>
                {initialItem.reason && <Text style={styles.reason}>Reason: {initialItem.reason}</Text>}
            </View>
            <TouchableOpacity
                style={styles.unbanButton}
                onPress={() => onUnban(initialItem.userId)}
                disabled={isUnbanning}
            >
                {isUnbanning ? (
                    <ActivityIndicator size="small" color="#FF6410" />
                ) : (
                    <RotateCcw size={20} color="#FF6410" />
                )}
            </TouchableOpacity>
        </View>
    );
}

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
        <BannedUserItem
            item={item}
            onUnban={handleUnban}
            isUnbanning={isUnbanning === item.userId}
        />
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
                            <X size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#FF6410" style={styles.loader} />
                    ) : (
                        <FlatList
                            data={bannedUsers}
                            renderItem={renderBannedUser}
                            keyExtractor={(item) => item.userId}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <UserX size={48} color="#e5e7eb" />
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
        backgroundColor: '#ffffff',
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
        borderBottomColor: '#f3f4f6',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
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
        backgroundColor: '#f9fafb',
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
        color: '#1f2937',
        marginBottom: 2,
    },
    userId: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    bannedAt: {
        fontSize: 12,
        color: '#9ca3af',
    },
    reason: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    unbanButton: {
        padding: 8,
        backgroundColor: '#fff7ed',
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
        color: '#9ca3af',
        textAlign: 'center',
    },
});
