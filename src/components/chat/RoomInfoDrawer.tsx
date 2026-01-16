/**
 * RoomInfoDrawer Component
 *
 * Bottom sheet drawer for chat room details and management.
 * Designed to match the provided screenshot design exactly.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Linking,
    Share,
    Alert,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Users,
    Clock,
    MapPin,
    MessageCircle,
    Share2,
    X,
    Crown,
    Lock,
    Ban,
    Info,
    Shield,
    PlusCircle,
} from 'lucide-react-native';
import { theme } from '../../core/theme';
import { Room } from '../../types';
import { ParticipantList } from './ParticipantList';
import { roomService, ParticipantDTO } from '../../services';
import { AvatarDisplay } from '../profile';
import { BannedUsersModal, ParticipantItem } from '../room';
import { formatTimeAgo } from '../../utils/format';
import { getRoomShareUrl, SHARE_CONFIG } from '../../constants';

interface RoomInfoDrawerProps {
    room: Room;
    isOpen: boolean;
    onClose: () => void;
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
    onRoomExtended?: () => void;
}

export function RoomInfoDrawer({
    room,
    isOpen,
    onClose,
    isCreator,
    currentUserId,
    onCloseRoom,
    onRoomExtended,
}: RoomInfoDrawerProps) {
    const insets = useSafeAreaInsets();
    const { height: SCREEN_HEIGHT } = useWindowDimensions();
    const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.95; // 95% of screen height for nearly fullscreen

    const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    const [showParticipantList, setShowParticipantList] = useState(false);
    const [showBannedUsers, setShowBannedUsers] = useState(false);

    const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;

    /**
     * Fetch participants for inline display
     */
    useEffect(() => {
        if (isOpen && room.id) {
            fetchParticipants();
        }
    }, [isOpen, room.id]);

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

    // Animate open/close
    useEffect(() => {
        if (isOpen) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 25,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: DRAWER_HEIGHT,
                    damping: 25,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isOpen]);

    const handleShare = async () => {
        try {
            const shareUrl = getRoomShareUrl(room.id);
            const storeUrl = Platform.OS === 'ios' ? SHARE_CONFIG.IOS_STORE_URL : SHARE_CONFIG.ANDROID_STORE_URL;

            await Share.share({
                message: `Join "${room.title}" on BubbleUp! Nearby rooms for local conversations.\n\n${shareUrl}`,
                url: storeUrl, // This provides the "Open" or "Get" functionality
            });
        } catch (error) {
            console.error('Error sharing room:', error);
        }
    };

    const handleExtendRoom = useCallback(() => {
        Alert.alert(
            'Extend Room Duration',
            'Choose how long to extend this room:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: '+1 Hour',
                    onPress: async () => {
                        try {
                            await roomService.extendRoom(room.id, '1h');
                            Alert.alert('Success', 'Room extended by 1 hour');
                            onRoomExtended?.();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to extend room');
                        }
                    },
                },
                {
                    text: '+3 Hours',
                    onPress: async () => {
                        try {
                            await roomService.extendRoom(room.id, '3h');
                            Alert.alert('Success', 'Room extended by 3 hours');
                            onRoomExtended?.();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to extend room');
                        }
                    },
                },
            ]
        );
    }, [room.id, onRoomExtended]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!isOpen && (translateY as any).__getValue() === SCREEN_HEIGHT) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, { opacity: backdropOpacity }]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    activeOpacity={1}
                />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
                style={[
                    styles.drawer,
                    {
                        height: DRAWER_HEIGHT,
                        paddingBottom: insets.bottom,
                        transform: [{ translateY }],
                    },
                ]}
            >
                {/* Horizontal Handle Only */}
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.emojiContainer, { backgroundColor: theme.tokens.action.secondary.default }]}>
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
                                    <Users size={18} color={theme.tokens.text.tertiary} />
                                    <Text style={styles.gridLabel}>Participants</Text>
                                </View>
                                <Text style={styles.gridValue}>{room.participantCount}/{room.maxParticipants}</Text>
                            </View>

                            <View style={styles.gridItem}>
                                <View style={styles.gridItemHeader}>
                                    <Clock size={18} color={theme.tokens.text.tertiary} />
                                    <Text style={styles.gridLabel}>Expires in</Text>
                                </View>
                                <Text style={styles.gridValue}>{room.timeRemaining}</Text>
                            </View>

                            <View style={styles.gridItem}>
                                <View style={styles.gridItemHeader}>
                                    <MapPin size={18} color={theme.tokens.text.tertiary} />
                                    <Text style={styles.gridLabel}>Distance</Text>
                                </View>
                                <Text style={styles.gridValue}>{room.distanceDisplay || 'Nearby'}</Text>
                            </View>

                            <View style={styles.gridItem}>
                                <View style={styles.gridItemHeader}>
                                    <MessageCircle size={18} color={theme.tokens.text.tertiary} />
                                    <Text style={styles.gridLabel}>Created</Text>
                                </View>
                                <Text style={styles.gridValue}>{formatTimeAgo(room.createdAt)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Share Button */}
                    <TouchableOpacity style={styles.shareButtonStyle} onPress={handleShare}>
                        <Share2 size={20} color={theme.tokens.text.secondary} />
                        <Text style={styles.shareButtonText}>Share Room</Text>
                    </TouchableOpacity>

                    {/* Creator Actions */}
                    {isCreator && (
                        <View style={styles.creatorSection}>
                            <View style={styles.sectionTitleRow}>
                                <Crown size={20} color={theme.tokens.status.warning.main} />
                                <Text style={styles.creatorSectionTitle}>Creator Controls</Text>
                            </View>

                            <View style={styles.creatorActions}>
                                {room.status !== 'closed' && (
                                    <>
                                        <TouchableOpacity
                                            style={styles.creatorActionButton}
                                            onPress={handleExtendRoom}
                                        >
                                            <PlusCircle size={20} color={theme.tokens.status.success.main} />
                                            <Text style={styles.creatorActionText}>Extend Time</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.creatorActionButton}
                                            onPress={() => setShowParticipantList(true)}
                                        >
                                            <Users size={20} color={theme.tokens.status.info.main} />
                                            <Text style={styles.creatorActionText}>Manage Users</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.creatorActionButton}
                                            onPress={() => setShowBannedUsers(true)}
                                        >
                                            <Ban size={20} color={theme.tokens.text.error} />
                                            <Text style={styles.creatorActionText}>Banned Users</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.creatorActionButton}
                                            onPress={() => onCloseRoom && onCloseRoom()}
                                        >
                                            <Lock size={20} color={theme.tokens.text.tertiary} />
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
                            <Users size={20} color={theme.tokens.text.tertiary} />
                            <Text style={styles.participantsSectionTitle}>Participants ({participants.length})</Text>
                        </View>

                        <View style={styles.participantsContainer}>
                            {participants.map((participant) => (
                                <ParticipantItem
                                    key={participant.userId}
                                    participant={participant}
                                    isCreator={participant.role === 'creator'}
                                    isCurrentUser={participant.userId === currentUserId}
                                />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>

            {/* Participant List Modal */}
            <ParticipantList
                roomId={room.id}
                isCreator={isCreator}
                currentUserId={currentUserId || ''}
                isOpen={showParticipantList}
                onClose={() => setShowParticipantList(false)}
            />

            {/* Banned Users Modal */}
            <BannedUsersModal
                roomId={room.id}
                isOpen={showBannedUsers}
                onClose={() => setShowBannedUsers(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    drawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.tokens.bg.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: theme.tokens.border.strong,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: theme.tokens.text.tertiary,
        borderRadius: 3,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
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
        color: theme.tokens.text.primary,
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
        backgroundColor: theme.tokens.status.info.bg,
    },
    categoryBadgeText: {
        fontSize: 12,
        color: theme.tokens.status.info.main,
        fontWeight: '500',
    },
    creatorBadge: {
        backgroundColor: theme.tokens.status.info.bg,
    },
    creatorBadgeText: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '500',
    },
    joinedBadge: {
        backgroundColor: theme.tokens.status.success.bg,
    },
    joinedBadgeText: {
        fontSize: 12,
        color: theme.tokens.status.success.main,
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.text.tertiary,
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 15,
        color: theme.tokens.text.secondary,
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
        backgroundColor: theme.tokens.bg.subtle,
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
        color: theme.tokens.text.tertiary,
    },
    gridValue: {
        fontSize: 18,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    shareButtonStyle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 12,
        paddingVertical: 14,
        gap: 8,
        marginBottom: 24,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    creatorSection: {
        marginBottom: 24,
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
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
        color: theme.tokens.text.primary,
    },
    creatorActions: {
        gap: 12,
    },
    creatorActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.tokens.bg.subtle,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 12,
    },
    creatorActionText: {
        fontSize: 15,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    participantsSection: {
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
        paddingTop: 16,
    },
    participantsSectionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.tokens.text.secondary,
    },
    participantsContainer: {
        backgroundColor: theme.tokens.bg.subtle,
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
        backgroundColor: theme.tokens.action.secondary.default,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.brand.primary,
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
        fontSize: 16,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    youBadge: {
        backgroundColor: theme.tokens.bg.subtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    youBadgeText: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
        fontWeight: '500',
    },
    modBadge: {
        backgroundColor: theme.tokens.status.info.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    modBadgeText: {
        fontSize: 11,
        color: theme.tokens.status.info.main,
        fontWeight: '500',
    },
});
