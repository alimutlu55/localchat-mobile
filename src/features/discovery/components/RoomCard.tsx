/**
 * RoomCard Component
 *
 * Pure presentational component for displaying a room in list views.
 * Extracted from RoomListView for reusability and testability.
 *
 * Features:
 * - Gradient emoji background with status badges (New/Active)
 * - Distance, participant count, time remaining display
 * - Category badge
 * - Custom memo comparison for optimal re-renders
 */

import React, { memo, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Users, Clock, Sparkles, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../../../types';
import { theme } from '../../../core/theme';
import { calculateDistance } from '../../../utils/geo';
import { formatDistanceShort, getTimeColor as getTimeColorUtil, isExpiringSoon } from '../../../utils/format';
import { CATEGORIES } from '../../../constants';

// =============================================================================
// Types
// =============================================================================

export interface RoomCardProps {
    /** Room data to display */
    room: Room;
    /** Whether the user has joined this room */
    hasJoined: boolean;
    /** User's current location for distance calculation */
    userLocation?: { latitude: number; longitude: number } | null;
    /** Callback when card is pressed */
    onPress?: (room: Room) => void;
    /** Custom style overrides */
    style?: object;
}

// =============================================================================
// Helpers
// =============================================================================

/** Get category label from ID */
const getCategoryLabel = (categoryId: string): string => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.label || categoryId;
};

/** Get distance color based on meters */
const getDistanceColor = (meters: number): string => {
    if (meters < 500) return theme.tokens.text.success;
    if (meters < 2000) return theme.tokens.brand.primary;
    return theme.tokens.text.tertiary;
};

/** Get time color based on expiry */
const getTimeColor = (expiresAt: Date): string => {
    const hoursLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < 0.25) return theme.tokens.text.error;
    if (hoursLeft < 1) return theme.tokens.brand.primary;
    return theme.tokens.text.success;
};

/** Format distance for display */
const formatDistance = (meters: number): string => {
    if (meters < 500) return 'Nearby';
    if (meters < 1000) return `${Math.round(meters)}m away`;
    const km = meters / 1000;
    if (km < 10) return `${km.toFixed(1)}km away`;
    return `${Math.round(km)}km away`;
};

/** Get gradient colors for emoji background */
const getGradientColors = (isExpiringSoon: boolean): [string, string] => {
    if (isExpiringSoon) {
        return [theme.palette.orange[400], theme.palette.orange[300]];
    }
    return [theme.tokens.action.secondary.default, theme.tokens.action.secondary.active];
};

// =============================================================================
// Component
// =============================================================================

export const RoomCard = memo(function RoomCard({
    room,
    hasJoined,
    userLocation,
    onPress,
    style,
}: RoomCardProps) {
    // Calculate room distance
    const roomDistance = useMemo(() => {
        if (room.distance !== undefined && room.distance > 0) {
            return room.distance;
        }
        if (room.latitude && room.longitude && userLocation) {
            return calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                room.latitude,
                room.longitude
            );
        }
        return 0;
    }, [room.distance, room.latitude, room.longitude, userLocation]);

    const timeColor = getTimeColor(room.expiresAt);
    const distanceColor = getDistanceColor(roomDistance);
    const gradientColors = getGradientColors(room.isExpiringSoon || false);

    const handlePress = () => {
        onPress?.(room);
    };

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                {/* Emoji with Gradient Background */}
                <View style={styles.emojiContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.emojiGradient}
                    >
                        <Text style={styles.emojiText}>{room.emoji}</Text>
                    </LinearGradient>

                    {/* Status Badges */}
                    <View style={styles.badgesContainer}>
                        {room.isNew && (
                            <View style={[styles.badge, styles.newBadge]}>
                                <Sparkles size={8} color={theme.tokens.text.onPrimary} />
                                <Text style={styles.badgeText}>New</Text>
                            </View>
                        )}
                        {room.isHighActivity && (
                            <View style={[styles.badge, styles.activeBadge]}>
                                <Zap size={8} color={theme.tokens.text.onPrimary} />
                                <Text style={styles.badgeText}>Active</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.info}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>
                            {room.title}
                        </Text>
                        <View style={styles.distanceContainer}>
                            {room.isExpiringSoon && (
                                <Clock size={12} color={theme.tokens.brand.primary} strokeWidth={3} />
                            )}
                            <Text style={[styles.distanceText, { color: distanceColor }]}>
                                {formatDistance(roomDistance)}
                            </Text>
                        </View>
                    </View>

                    {/* Meta Row */}
                    <View style={styles.meta}>
                        <View style={styles.metaItem}>
                            <Users size={12} color={theme.tokens.text.tertiary} />
                            <Text style={styles.metaText}>{room.participantCount}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Clock size={12} color={timeColor} />
                            <Text style={[styles.timeText, { color: timeColor }]}>
                                {room.timeRemaining}
                            </Text>
                        </View>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>
                                {getCategoryLabel(room.category)}
                            </Text>
                        </View>
                    </View>

                    {room.description && (
                        <Text style={styles.description} numberOfLines={1}>
                            {room.description}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for optimal re-renders
    return (
        prevProps.room.id === nextProps.room.id &&
        prevProps.room.participantCount === nextProps.room.participantCount &&
        prevProps.room.isExpiringSoon === nextProps.room.isExpiringSoon &&
        prevProps.hasJoined === nextProps.hasJoined
    );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    content: {
        flexDirection: 'row',
        padding: 12,
    },
    emojiContainer: {
        position: 'relative',
    },
    emojiGradient: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emojiText: {
        fontSize: 28,
    },
    badgesContainer: {
        position: 'absolute',
        top: -4,
        right: -4,
        gap: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 2,
    },
    newBadge: {
        backgroundColor: theme.tokens.brand.primary,
    },
    activeBadge: {
        backgroundColor: theme.tokens.text.success,
    },
    badgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: theme.tokens.text.onPrimary,
    },
    info: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    distanceText: {
        fontSize: 12,
        fontWeight: '600',
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
    timeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    categoryBadge: {
        backgroundColor: theme.tokens.bg.subtle,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.tokens.text.secondary,
    },
    description: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
        marginTop: 2,
    },
});

export default RoomCard;
