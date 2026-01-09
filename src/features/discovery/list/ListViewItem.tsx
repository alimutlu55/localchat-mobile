/**
 * ListViewItem Component
 *
 * Room card component for the room list view.
 * Styles match the original RoomListView.tsx exactly.
 */

import React, { memo, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { Users, Clock, Zap, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../../../types';
import { CATEGORIES } from '../../../constants';
import { calculateDistance } from '../../../utils/format';
import { theme } from '../../../core/theme';

// =============================================================================
// Helpers
// =============================================================================

// Helper to get category label from ID
const getCategoryLabel = (categoryId: string): string => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.label || categoryId;
};

// =============================================================================
// Types
// =============================================================================

export interface ListViewItemProps {
    room: Room;
    hasJoined: boolean;
    userLocation?: { latitude: number; longitude: number } | null;
    onJoin?: (room: Room) => void;
    onEnter?: (room: Room) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ListViewItem - Room card component
 *
 * Displays:
 * - Emoji with gradient background
 * - Status badges (New, Active)
 * - Title, distance, participant count
 * - Time remaining, category badge
 * - Description (if present)
 */
export const ListViewItem = memo(
    function ListViewItem({
        room,
        hasJoined,
        userLocation,
        onJoin,
        onEnter,
    }: ListViewItemProps) {
        // Calculate room distance
        const roomDistance = useMemo(() => {
            // Only show distance if we have a real user location to compare against.
            // If userLocation is null, we are in discovery fallback mode (map center).
            if (!userLocation) {
                return null;
            }

            if (room.distance !== undefined && room.distance > 0) {
                return room.distance;
            }

            if (room.latitude && room.longitude) {
                return calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    room.latitude,
                    room.longitude
                );
            }
            return null;
        }, [room.distance, room.latitude, room.longitude, userLocation]);

        const getTimeColor = useCallback(() => {
            const hoursLeft = (room.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursLeft < 0.25) return theme.tokens.text.error;
            if (hoursLeft < 1) return theme.tokens.brand.primary;
            return theme.tokens.text.success;
        }, [room.expiresAt]);

        const formatDistance = useCallback((meters: number | null): string => {
            if (meters === null) return '';
            if (meters < 500) return 'Nearby';
            if (meters < 1000) return `${Math.round(meters)}m away`;
            const km = meters / 1000;
            if (km < 10) return `${km.toFixed(1)}km away`;
            return `${Math.round(km)}km away`;
        }, []);

        const getDistanceColor = useCallback((meters: number | null): string => {
            if (meters === null) return theme.tokens.text.tertiary; // Disabled
            if (meters < 500) return theme.tokens.text.success; // Green - very close
            if (meters < 2000) return theme.tokens.brand.primary; // Orange - nearby
            return theme.tokens.text.tertiary; // Gray - far
        }, []);

        const getGradientColors = useCallback((): [string, string] => {
            // Soft Peach/Apricot Palette - "Just enough color"
            if (room.isExpiringSoon) {
                return [theme.palette.orange[400], theme.palette.orange[300]]; // Warmer orange-peach
            }
            // Smooth Peach - A step up from cream, elegant and visible
            return [theme.tokens.action.secondary.default, theme.tokens.action.secondary.active]; // Very light peach to soft apricot
        }, [room.isExpiringSoon]);

        const handlePress = useCallback(() => {
            if (hasJoined) {
                onEnter?.(room);
            } else {
                onJoin?.(room);
            }
        }, [hasJoined, room, onJoin, onEnter]);

        return (
            <TouchableOpacity
                style={styles.roomCard}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <View style={styles.roomCardContent}>
                    {/* Emoji with Gradient Background */}
                    <View style={styles.emojiContainer}>
                        <LinearGradient
                            colors={getGradientColors() as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.roomEmoji}
                        >
                            <Text style={styles.roomEmojiText}>{room.emoji}</Text>
                        </LinearGradient>

                        {/* Status Badges */}
                        <View style={styles.statusBadgesContainer}>
                            {room.isNew && (
                                <View style={[styles.statusBadge, styles.newBadge]}>
                                    <Sparkles size={8} color={theme.tokens.text.onPrimary} />
                                    <Text style={styles.statusBadgeText}>New</Text>
                                </View>
                            )}
                            {room.isHighActivity && (
                                <View style={[styles.statusBadge, styles.activeBadge]}>
                                    <Zap size={8} color={theme.tokens.text.onPrimary} />
                                    <Text style={styles.statusBadgeText}>Active</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Info */}
                    <View style={styles.roomInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.roomTitle} numberOfLines={1}>
                                {room.title}
                            </Text>
                            <View style={styles.topRightMeta}>
                                {room.isExpiringSoon && (
                                    <Clock size={12} color={theme.tokens.brand.primary} strokeWidth={3} />
                                )}
                                <Text style={[styles.metaText, { color: getDistanceColor(roomDistance), fontWeight: '600' }]}>
                                    {formatDistance(roomDistance)}
                                </Text>
                            </View>
                        </View>

                        {/* Meta Row: People & Time */}
                        <View style={styles.roomMeta}>
                            <View style={styles.metaItem}>
                                <Users size={12} color={theme.tokens.text.tertiary} />
                                <Text style={styles.metaText}>
                                    {room.participantCount}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Clock size={12} color={getTimeColor()} />
                                <Text style={[styles.timeText, { color: getTimeColor() }]}>
                                    {room.timeRemaining}
                                </Text>
                            </View>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryBadgeText}>{getCategoryLabel(room.category)}</Text>
                            </View>
                        </View>

                        {room.description ? (
                            <Text style={styles.roomDescription} numberOfLines={1}>
                                {room.description}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </TouchableOpacity>
        );
    },
    (prevProps, nextProps) => {
        // Custom comparison function for optimal re-render control
        return (
            prevProps.room.id === nextProps.room.id &&
            prevProps.room.participantCount === nextProps.room.participantCount &&
            prevProps.room.isExpiringSoon === nextProps.room.isExpiringSoon &&
            prevProps.hasJoined === nextProps.hasJoined
        );
    }
);

// =============================================================================
// Styles - MATCHES ORIGINAL RoomListView.tsx EXACTLY
// =============================================================================

const styles = StyleSheet.create({
    roomCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    roomCardContent: {
        flexDirection: 'row',
        gap: 12,
    },
    emojiContainer: {
        position: 'relative',
    },
    roomEmoji: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#f3f4f6', // Softer default gray
        justifyContent: 'center',
        alignItems: 'center',
    },
    roomEmojiText: {
        fontSize: 20,
    },
    statusBadgesContainer: {
        position: 'absolute',
        bottom: -6,
        left: -4,
        right: -4,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    newBadge: {
        backgroundColor: '#10b981',
    },
    activeBadge: {
        backgroundColor: '#f43f5e',
    },
    statusBadgeText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '700',
    },
    roomInfo: {
        flex: 1,
        flexShrink: 1,
    },
    titleRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    roomTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
        flex: 1,
        flexShrink: 1,
        marginRight: 8,
    },
    topRightMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    roomMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#6b7280',
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    categoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#f3e8ff',
    },
    categoryBadgeText: {
        fontSize: 10,
        color: '#7c3aed',
        fontWeight: '600',
    },
    roomDescription: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
        lineHeight: 16,
    },
});

export default ListViewItem;
