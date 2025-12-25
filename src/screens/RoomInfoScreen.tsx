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
import { RootStackParamList } from '../navigation/types';
import { Room } from '../types';
import { roomService, ParticipantDTO } from '../services';
import { AvatarDisplay } from '../components/profile';
import { BannedUsersModal } from '../components/room/BannedUsersModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoomInfo'>;
type RoomInfoRouteProp = RouteProp<RootStackParamList, 'RoomInfo'>;

export default function RoomInfoScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RoomInfoRouteProp>();
    const { room, isCreator, currentUserId, onCloseRoom } = route.params;
    
    const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    const [showBannedUsers, setShowBannedUsers] = useState(false);

    /**
     * Fetch participants for inline display
     */
    useEffect(() => {
        fetchParticipants();
    }, [room.id]);

    const fetchParticipants = async () => {
        setIsLoadingParticipants(true);
        try {
            const data = await roomService.getParticipants(room.id);
            setParticipants(data);
        } catch (err) {
            console.error('Failed to fetch participants:', err);
        } finally {
            setIsLoadingParticipants(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join "${room.title}" on LocalChat! Nearby rooms for local conversations.`,
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
                            await roomService.kickUser(room.id, userId);
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
                            await roomService.banUser(room.id, userId);
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
                                <Text style={styles.gridValue}>{room.participantCount}/{room.maxParticipants}</Text>
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
                                <Text style={styles.gridValue}>0m ago</Text>
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
                                            onPress={() => onCloseRoom && onCloseRoom()}
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
                                const canModerate = isCreator && !isCurrentUser && participant.role !== 'creator';
                                
                                return (
                                    <View key={participant.userId} style={styles.participantRow}>
                                        <View style={styles.avatar}>
                                            <AvatarDisplay
                                                avatarUrl={participant.profilePhotoUrl}
                                                displayName={participant.displayName}
                                                size="md"
                                                style={{ width: 44, height: 44, borderRadius: 22 }}
                                            />
                                        </View>
                                        <View style={styles.participantInfoText}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.participantName}>{participant.displayName}</Text>
                                                {participant.role === 'creator' && (
                                                    <View style={[styles.roleBadge, styles.creatorRoleBadge]}>
                                                        <Crown size={10} color="#f59e0b" />
                                                        <Text style={styles.creatorRoleText}>Creator</Text>
                                                    </View>
                                                )}
                                                {participant.role === 'moderator' && (
                                                    <View style={[styles.roleBadge, styles.modRoleBadge]}>
                                                        <Shield size={10} color="#3b82f6" />
                                                        <Text style={styles.modRoleText}>Mod</Text>
                                                    </View>
                                                )}
                                                {isCurrentUser && (
                                                    <View style={styles.youBadge}>
                                                        <Text style={styles.youBadgeText}>You</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        
                                        {canModerate && (
                                            <View style={styles.inlineActions}>
                                                <TouchableOpacity
                                                    style={styles.inlineActionButton}
                                                    onPress={() => handleKickUser(participant.userId, participant.displayName)}
                                                >
                                                    <UserX size={16} color="#f97316" />
                                                    <Text style={styles.inlineActionText}>Kick</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.inlineActionButton}
                                                    onPress={() => handleBanUser(participant.userId, participant.displayName)}
                                                >
                                                    <Ban size={16} color="#ef4444" />
                                                    <Text style={styles.inlineActionText}>Ban</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
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
