/**
 * Sidebar Component
 *
 * Slide-in drawer showing user's rooms (created, joined, expired)
 * with search functionality and profile access.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Dimensions,
    Animated,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Search,
    User,
    MessageSquare,
    ChevronRight,
    X,
} from 'lucide-react-native';
import { Room } from '../types';
import { useCurrentUser } from '../features/user/store';
import { AvatarDisplay } from './profile';
import { theme } from '../core/theme';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.80;

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    rooms: Room[];
    onRoomSelect: (room: Room) => void;
    onProfilePress: () => void;
}

/**
 * Room Item Component
 */
const RoomItem = React.memo(function RoomItem({
    room,
    isCreator,
    isExpired,
    onPress,
}: {
    room: Room;
    isCreator?: boolean;
    isExpired?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.roomItem, isExpired && styles.roomItemExpired]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.roomEmoji, isExpired && styles.roomEmojiExpired]}>
                <Text style={styles.roomEmojiText}>{room.emoji}</Text>
                {isCreator && (
                    <View style={styles.creatorBadge}>
                        <Text style={styles.creatorBadgeText}>★</Text>
                    </View>
                )}
            </View>
            <View style={styles.roomInfo}>
                <Text
                    style={[styles.roomTitle, isExpired && styles.roomTitleExpired]}
                    numberOfLines={1}
                >
                    {room.title}
                </Text>
                <Text style={styles.roomMeta}>
                    {isExpired
                        ? 'Expired'
                        : `${room.participantCount} ${room.participantCount === 1 ? 'member' : 'members'} • ${room.timeRemaining}`}
                </Text>
            </View>
            <ChevronRight size={16} color={theme.tokens.text.tertiary} />
        </TouchableOpacity>
    );
});

/**
 * Section Header Component
 */
const SectionHeader = React.memo(function SectionHeader({ title }: { title: string }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionLine} />
        </View>
    );
});

/**
 * Empty State Component
 */
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
                <MessageSquare size={24} color={theme.tokens.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>
                {hasSearch ? 'No rooms found' : 'No rooms yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
                {hasSearch ? 'Try a different search' : 'Create or join a room'}
            </Text>
        </View>
    );
}

/**
 * Main Sidebar Component
 */
export function Sidebar({
    isOpen,
    onClose,
    rooms,
    onRoomSelect,
    onProfilePress,
}: SidebarProps) {
    const insets = useSafeAreaInsets();
    const user = useCurrentUser();
    const avatarUrl = user?.profilePhotoUrl;
    const displayName = user?.displayName || 'User';
    const isAnonymous = user?.isAnonymous ?? true;
    const [searchQuery, setSearchQuery] = useState('');
    const translateX = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;

    // Animate open/close
    React.useEffect(() => {
        Animated.parallel([
            Animated.spring(translateX, {
                toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
                damping: 28,
                stiffness: 280,
                mass: 0.8,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: isOpen ? 1 : 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isOpen]);

    // Pan gesture for swipe-to-close
    const panResponder = React.useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Ignore small movements to prevent conflict with button taps
                // Also ensure the movement is predominantly horizontal
                return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dx < 0) {
                    translateX.setValue(gestureState.dx);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -50 || gestureState.vx < -0.5) {
                    onClose();
                } else {
                    Animated.spring(translateX, {
                        toValue: 0,
                        damping: 25,
                        stiffness: 300,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // Filter and categorize rooms
    const { createdRooms, joinedRooms, expiredRooms } = useMemo(() => {
        const now = new Date();
        const filtered = rooms.filter((room) =>
            room.title.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const active = filtered.filter(
            (r) => r.status !== 'closed' && r.expiresAt > now
        );
        const expired = filtered.filter(
            (r) => r.status !== 'closed' && r.expiresAt <= now
        );

        return {
            createdRooms: active.filter((r) => r.isCreator),
            joinedRooms: active.filter((r) => !r.isCreator),
            expiredRooms: expired,
        };
    }, [rooms, searchQuery]);

    const handleRoomPress = useCallback(
        (room: Room) => {
            onRoomSelect(room);
            onClose();
        },
        [onRoomSelect, onClose]
    );

    const hasNoRooms =
        createdRooms.length === 0 &&
        joinedRooms.length === 0 &&
        expiredRooms.length === 0;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
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

            {/* Sidebar Panel */}
            <Animated.View
                style={[
                    styles.sidebar,
                    {
                        width: SIDEBAR_WIDTH,
                        paddingTop: insets.top + 16,
                        paddingBottom: insets.bottom,
                        transform: [{ translateX }],
                    },
                ]}
                {...panResponder.panHandlers}
            >


                {/* Search */}
                <View style={styles.searchContainer}>
                    <Search size={18} color={theme.tokens.text.tertiary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search rooms..."
                        placeholderTextColor={theme.tokens.text.tertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Room List */}
                <ScrollView
                    style={styles.roomList}
                    contentContainerStyle={styles.roomListContent}
                    showsVerticalScrollIndicator={false}
                >
                    {hasNoRooms ? (
                        <EmptyState hasSearch={searchQuery.length > 0} />
                    ) : (
                        <>
                            {/* Created by You */}
                            {createdRooms.length > 0 && (
                                <View style={styles.section}>
                                    <SectionHeader title="CREATED BY YOU" />
                                    {createdRooms.map((room) => (
                                        <RoomItem
                                            key={room.id}
                                            room={room}
                                            isCreator
                                            onPress={() => handleRoomPress(room)}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* Joined */}
                            {joinedRooms.length > 0 && (
                                <View style={styles.section}>
                                    <SectionHeader title="JOINED" />
                                    {joinedRooms.map((room) => (
                                        <RoomItem
                                            key={room.id}
                                            room={room}
                                            onPress={() => handleRoomPress(room)}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* Expired */}
                            {expiredRooms.length > 0 && (
                                <View style={[styles.section, styles.expiredSection]}>
                                    <SectionHeader title="EXPIRED" />
                                    {expiredRooms.map((room) => (
                                        <RoomItem
                                            key={room.id}
                                            room={room}
                                            isExpired
                                            onPress={() => handleRoomPress(room)}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>

                {/* Profile Button */}
                <TouchableOpacity
                    style={[styles.profileButton, { marginBottom: insets.bottom > 0 ? 0 : 16 }]}
                    onPress={onProfilePress}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <AvatarDisplay
                        avatarUrl={avatarUrl ?? undefined}
                        displayName={displayName}
                        size="md"
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        {isAnonymous && (
                            <Text style={styles.profileType}>Anonymous</Text>
                        )}
                    </View>
                    <ChevronRight size={16} color={theme.tokens.text.tertiary} />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sidebar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: theme.tokens.bg.surface,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.tokens.bg.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.tokens.bg.subtle,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 15,
        color: theme.tokens.text.primary,
    },
    roomList: {
        flex: 1,
    },
    roomListContent: {
        paddingHorizontal: 12,
    },
    section: {
        marginBottom: 20,
    },
    expiredSection: {
        opacity: 0.6,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.tokens.text.tertiary,
        letterSpacing: 0.5,
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.tokens.border.subtle,
        marginLeft: 12,
    },
    roomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        marginBottom: 4,
    },
    roomItemExpired: {
        opacity: 0.7,
    },
    roomEmoji: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: theme.tokens.bg.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    roomEmojiExpired: {
        backgroundColor: theme.tokens.bg.subtle,
    },
    roomEmojiText: {
        fontSize: 20,
    },
    creatorBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: theme.tokens.status.warning.main,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    creatorBadgeText: {
        fontSize: 8,
        color: theme.tokens.text.onPrimary,
        fontWeight: 'bold',
    },
    roomInfo: {
        flex: 1,
        marginLeft: 12,
    },
    roomTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.tokens.text.primary,
        marginBottom: 2,
    },
    roomTitleExpired: {
        color: theme.tokens.text.secondary,
    },
    roomMeta: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: theme.tokens.bg.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.tokens.text.secondary,
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
    },
    profileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
    },
    profileInfo: {
        flex: 1,
        marginLeft: 12,
    },
    profileName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
    profileType: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
});

export default React.memo(Sidebar);
