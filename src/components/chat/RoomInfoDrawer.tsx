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
    Dimensions,
    Share,
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
} from 'lucide-react-native';
import { Room } from '../../types';
import { ParticipantList } from './ParticipantList';
import { roomService, ParticipantDTO } from '../../services';
import { AvatarDisplay } from '../profile';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.85;

interface RoomInfoDrawerProps {
    room: Room;
    isOpen: boolean;
    onClose: () => void;
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
}

export function RoomInfoDrawer({
    room,
    isOpen,
    onClose,
    isCreator,
    currentUserId,
    onCloseRoom,
}: RoomInfoDrawerProps) {
    const insets = useSafeAreaInsets();
    const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    const [showParticipantList, setShowParticipantList] = useState(false);

    const translateY = React.useRef(new Animated.Value(DRAWER_HEIGHT)).current;
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
            await Share.share({
                message: `Join "${room.title}" on LocalChat! Nearby rooms for local conversations.`,
                url: 'https://localchat.app', // Fallback URL
            });
        } catch (error) {
            console.error('Error sharing room:', error);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!isOpen && (translateY as any).__getValue() === DRAWER_HEIGHT) return null;

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
                                <Crown size={20} color="#1f2937" />
                                <Text style={styles.creatorSectionTitle}>Creator Actions</Text>
                            </View>

                            <View style={styles.actionGrid}>
                                {room.status !== 'closed' && (
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => onCloseRoom && onCloseRoom()}
                                    >
                                        <View style={styles.actionIconContainer}>
                                            <Lock size={20} color="#6b7280" />
                                        </View>
                                        <Text style={styles.actionLabel}>Close Room</Text>
                                        <Text style={styles.actionSub}>(read-only mode)</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => setShowParticipantList(true)}
                                >
                                    <View style={styles.actionIconContainer}>
                                        <Ban size={20} color="#1f2937" />
                                    </View>
                                    <Text style={styles.actionLabel}>Manage Bans</Text>
                                    <Text style={styles.actionSub}>(view banned)</Text>
                                </TouchableOpacity>
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
                            {participants.map((participant) => (
                                <View key={participant.userId} style={styles.participantRow}>
                                    <View style={styles.avatar}>
                                        <AvatarDisplay
                                            avatarUrl={participant.profilePhotoUrl}
                                            displayName={participant.displayName}
                                            size="md"
                                            style={{ width: 44, height: 44, borderRadius: 12 }}
                                        />
                                    </View>
                                    <View style={styles.participantInfoText}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.participantName}>{participant.displayName}</Text>
                                            <Shield size={14} color="#3b82f6" />
                                            {participant.userId === currentUserId && (
                                                <View style={styles.youBadge}>
                                                    <Text style={styles.youBadgeText}>You</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.modBadge}>
                                            <Text style={styles.modBadgeText}>Mod</Text>
                                        </View>
                                    </View>
                                </View>
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
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
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
        backgroundColor: '#94a3b8',
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
        width: (Dimensions.get('window').width - 48) / 2,
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
        paddingTop: 16,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    creatorSectionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    actionCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    actionSub: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
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
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
    },
    youBadge: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    youBadgeText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    modBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    modBadgeText: {
        fontSize: 11,
        color: '#2563eb',
        fontWeight: '500',
    },
});
