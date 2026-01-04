/**
 * Room Info Screen
 *
 * Full screen for room details and management.
 * Displays room info, participants, and creator controls.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Share,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    Users,
    Clock,
    MapPin,
    MessageCircle,
    Share2,
    ArrowLeft,
    Crown,
    Lock,
    Ban,
    Shield,
    UserX,
} from 'lucide-react-native';
import { RootStackParamList } from '../../../navigation/types';
import { Room, deserializeRoom } from '../../../types';
import { roomService, ParticipantDTO } from '../../../services';
import { ParticipantItem } from '../../../components/room';
import { theme } from '../../../core/theme';
import { eventBus } from '../../../core/events';
import { BannedUsersModal } from '../components';
import { useRoom } from '../hooks';
import { useRoomStore } from '../store/RoomStore';
import { formatTimeAgo } from '../../../utils/format';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoomInfo'>;
type RoomInfoRouteProp = RouteProp<RootStackParamList, 'RoomInfo'>;

export default function RoomInfoScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RoomInfoRouteProp>();

    // Support both new (roomId) and legacy (room) navigation params
    const params = route.params;
    const roomId = params.roomId || params.room?.id;
    // Deserialize initialRoom if it came from navigation (has string dates)
    const initialRoom = params.initialRoom
        ? deserializeRoom(params.initialRoom as any)
        : params.room;
    const { isCreator, currentUserId, onCloseRoom } = params;
    // Note: onCloseSuccess no longer used - using EventBus 'room.closeInitiated' instead

    // Guard: roomId is required
    if (!roomId) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>Room not found</Text>
            </SafeAreaView>
        );
    }

    // Use the useRoom hook for reactive data (WebSocket updates)
    const { room: cachedRoom, isLoading: isRoomLoading } = useRoom(roomId, { skipFetchIfCached: true });
    // Prefer cached room (has real-time updates), fallback to route params
    const room = cachedRoom || initialRoom;

    const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    const [showBannedUsers, setShowBannedUsers] = useState(false);

    // Loading guard - show loading if we don't have room data yet
    if (!room && isRoomLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Not found guard
    if (!room) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Room not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    /**
     * Fetch participants for inline display and subscribe to membership events
     */
    const fetchParticipants = async () => {
        if (!roomId) return;
        setIsLoadingParticipants(true);
        try {
            const data = await roomService.getParticipants(roomId);
            setParticipants(data);

            // Sync with store to ensure other screens have accurate count
            // We use getState() inside the async function to avoid hook usage issues
            const state = useRoomStore.getState();
            state.updateRoom(roomId, { participantCount: data.length });
        } catch (err) {
            console.error('Failed to fetch participants:', err);
        } finally {
            setIsLoadingParticipants(false);
        }
    };

    useEffect(() => {
        // Initial load
        fetchParticipants();

        // Subscribe to membership events so the participants list stays in sync
        const unsubJoined = eventBus.on('room.userJoined', (payload) => {
            if (payload.roomId === roomId) {
                // Refresh participants to include the new user
                fetchParticipants();
            }
        });

        const unsubLeft = eventBus.on('room.userLeft', (payload) => {
            if (payload.roomId === roomId) {
                // Refresh participants to remove the user
                fetchParticipants();
            }
        });

        const unsubKicked = eventBus.on('room.userKicked', (payload) => {
            if (payload.roomId === roomId) {
                // Refresh participants to reflect the removal
                fetchParticipants();
            }
        });

        const unsubBanned = eventBus.on('room.userBanned', (payload) => {
            if (payload.roomId === roomId) {
                // Refresh participants and possibly update UI
                fetchParticipants();
            }
        });

        return () => {
            unsubJoined();
            unsubLeft();
            unsubKicked();
            unsubBanned();
        };
    }, [roomId]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join "${room?.title || 'this room'}" on LocalChat! Nearby rooms for local conversations.`,
                url: 'https://localchat.app',
            });
        } catch (error) {
            console.error('Error sharing room:', error);
        }
    };

    const handleKickUser = (userId: string, displayName: string) => {
        Alert.alert(
            'Remove User',
            `Are you sure you want to remove ${displayName} from this room?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await roomService.kickUser(roomId, userId);
                            // Refresh participants list
                            fetchParticipants();
                            Alert.alert('Success', `${displayName} has been removed`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove user');
                        }
                    },
                },
            ]
        );
    };

    const handleBanUser = (userId: string, displayName: string) => {
        Alert.alert(
            'Ban User',
            `${displayName} will not be able to rejoin this room. Add a reason (optional):`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Ban',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await roomService.banUser(roomId, userId);
                            // Refresh participants list
                            fetchParticipants();
                            Alert.alert('Success', `${displayName} has been banned`);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to ban user');
                        }
                    },
                },
            ]
        );
    };

    const handleLocalCloseRoom = () => {
        Alert.alert(
            'Close Room',
            'This will prevent any new messages. The room will become read-only.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close Room',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Emit event so ChatRoomScreen knows we're closing the room
                            // This prevents duplicate alerts when room.closed arrives
                            eventBus.emit('room.closeInitiated', { roomId });

                            await roomService.closeRoom(roomId);

                            Alert.alert('Success', 'Room has been closed', [
                                {
                                    text: 'OK',
                                    onPress: () => {
                                        // If navigation param onCloseRoom was provided (legacy), call it
                                        if (onCloseRoom) {
                                            onCloseRoom();
                                        } else {
                                            // Standard behavior for room closure:
                                            // Reset to home to clear all room-related screens
                                            navigation.reset({
                                                index: 0,
                                                routes: [{ name: 'Discovery' }],
                                            });
                                        }
                                    }
                                }
                            ]);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to close room');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ArrowLeft size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Room Info</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Room Header */}
                <View style={styles.roomHeader}>
                    <View style={[styles.emojiContainer, { backgroundColor: '#fff5f5' }]}>
                        <Text style={styles.emoji}>💬</Text>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>{room.title}</Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.badge, styles.categoryBadge]}>
                                <Text style={styles.categoryBadgeText}>{room.category || 'general'}</Text>
                            </View>
                            {isCreator && (
                                <View style={[styles.badge, styles.creatorBadge]}>
                                    <Text style={styles.creatorBadgeText}>Creator</Text>
                                </View>
                            )}
                            {room.hasJoined && (
                                <View style={[styles.badge, styles.joinedBadge]}>
                                    <Text style={styles.joinedBadgeText}>Joined</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>About</Text>
                    <Text style={styles.descriptionText}>{room.description || 'No description provided.'}</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>Room Info</Text>
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <View style={styles.gridItemHeader}>
                                <Users size={18} color="#6b7280" />
                                <Text style={styles.gridLabel}>Participants</Text>
                            </View>
                            <Text style={styles.gridValue}>
                                {Math.max(room.participantCount || 0, participants.length)}/{room.maxParticipants}
                            </Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridItemHeader}>
                                <Clock size={18} color="#6b7280" />
                                <Text style={styles.gridLabel}>Expires in</Text>
                            </View>
                            <Text style={styles.gridValue}>{room.timeRemaining}</Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridItemHeader}>
                                <MapPin size={18} color="#6b7280" />
                                <Text style={styles.gridLabel}>Distance</Text>
                            </View>
                            <Text style={styles.gridValue}>{room.distanceDisplay || 'Nearby'}</Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridItemHeader}>
                                <MessageCircle size={18} color="#6b7280" />
                                <Text style={styles.gridLabel}>Created</Text>
                            </View>
                            <Text style={styles.gridValue}>{formatTimeAgo(room.createdAt)}</Text>
                        </View>
                    </View>
                </View>

                {/* Share Button */}
                <TouchableOpacity style={styles.shareButtonStyle} onPress={handleShare}>
                    <Share2 size={20} color="#374151" />
                    <Text style={styles.shareButtonText}>Share Room</Text>
                </TouchableOpacity>

                {/* Creator Actions */}
                {isCreator && (
                    <View style={styles.creatorSection}>
                        <View style={styles.sectionTitleRow}>
                            <Crown size={20} color="#f59e0b" />
                            <Text style={styles.creatorSectionTitle}>Creator Controls</Text>
                        </View>

                        <View style={styles.creatorActions}>
                            {room.status !== 'closed' && (
                                <>
                                    <TouchableOpacity
                                        style={styles.creatorActionButton}
                                        onPress={() => setShowBannedUsers(true)}
                                    >
                                        <Ban size={20} color="#ef4444" />
                                        <Text style={styles.creatorActionText}>Banned Users</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.creatorActionButton}
                                        onPress={handleLocalCloseRoom}
                                    >
                                        <Lock size={20} color="#64748b" />
                                        <Text style={styles.creatorActionText}>Close Room</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* Participants Inline List */}
                <View style={styles.participantsSection}>
                    <View style={styles.sectionTitleRow}>
                        <Users size={20} color="#6b7280" />
                        <Text style={styles.participantsSectionTitle}>Participants ({participants.length})</Text>
                    </View>

                    <View style={styles.participantsContainer}>
                        {participants.map((participant) => {
                            const isCurrentUser = participant.userId === currentUserId;
                            return (
                                <ParticipantItem
                                    key={participant.userId}
                                    participant={participant}
                                    isCreator={participant.role === 'creator'}
                                    isCurrentUser={isCurrentUser}
                                    canModerate={isCreator && !isCurrentUser}
                                    onKick={handleKickUser}
                                    onBan={handleBanUser}
                                />
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Banned Users Modal */}
            <BannedUsersModal
                roomId={room.id}
                isOpen={showBannedUsers}
                onClose={() => setShowBannedUsers(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    headerRight: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    roomHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    emojiContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    emoji: {
        fontSize: 28,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 6,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
    },
    categoryBadge: {
        backgroundColor: '#f3e8ff',
    },
    categoryBadgeText: {
        fontSize: 12,
        color: '#9333ea',
        fontWeight: '500',
    },
    creatorBadge: {
        backgroundColor: '#dbeafe',
    },
    creatorBadgeText: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '500',
    },
    joinedBadge: {
        backgroundColor: '#dcfce7',
    },
    joinedBadgeText: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    gridItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
    },
    gridItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    gridLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    gridValue: {
        fontSize: 18,
        fontWeight: '500',
        color: '#1f2937',
    },
    shareButtonStyle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
        marginBottom: 24,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
    },
    creatorSection: {
        marginBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 20,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    creatorSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    creatorActions: {
        gap: 12,
    },
    creatorActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 12,
    },
    creatorActionText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1f2937',
    },
    participantsSection: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 16,
    },
    participantsSectionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    participantsContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 8,
        marginTop: 8,
    },
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#ffedd5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#9a3412',
    },
    participantInfoText: {
        flex: 1,
        gap: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    participantName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1f2937',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    creatorRoleBadge: {
        backgroundColor: '#fef3c7',
    },
    creatorRoleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#f59e0b',
    },
    modRoleBadge: {
        backgroundColor: '#dbeafe',
    },
    modRoleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3b82f6',
    },
    youBadge: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    youBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4f46e5',
    },
    inlineActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
    },
    inlineActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 4,
    },
    inlineActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
});
