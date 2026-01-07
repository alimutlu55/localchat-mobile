import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Users, Zap, Lock } from 'lucide-react-native';
import { Room, RoomCategory } from '../../../types';

// restored missing mapping
const CATEGORY_TO_FAMILY: Record<string, string> = {
    TRAFFIC_TRANSIT: 'PULSE', SAFETY_HAZARDS: 'PULSE', LOST_FOUND: 'PULSE', EVENTS_FESTIVALS: 'SPIRIT',
    SOCIAL_MEETUPS: 'SPIRIT', ATMOSPHERE_MUSIC: 'SPIRIT', SIGHTSEEING_GEMS: 'FLOW', NEWS_INTEL: 'FLOW',
    RETAIL_WAIT: 'FLOW', SPORTS_FITNESS: 'PLAY', DEALS_POPUPS: 'PLAY', MARKETS_FINDS: 'PLAY',
    FOOD_DINING: 'FOOD', GENERAL: 'GENERAL', TRAFFIC: 'PULSE', EMERGENCY: 'PULSE', SOCIAL: 'SPIRIT',
    ATMOSPHERE: 'SPIRIT', EVENTS: 'SPIRIT', SIGHTSEEING: 'FLOW', NEWS: 'FLOW', RETAIL: 'FLOW',
    SPORTS: 'PLAY', DEALS: 'PLAY', MARKETS: 'PLAY', FOOD: 'FOOD', NEIGHBORHOOD: 'GENERAL',
};

interface MiniRoomCardProps {
    room: Room;
    isSelected: boolean;
}

export const MiniRoomCard = memo(({ room, isSelected }: MiniRoomCardProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.1 : 1,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
        }).start();
    }, [isSelected]);

    // Restored Category Logic
    const categoryKey = (room.category?.toUpperCase() || 'GENERAL') as RoomCategory;
    const familyKey = CATEGORY_TO_FAMILY[categoryKey] || 'GENERAL';

    const familyColors: Record<string, string> = {
        PULSE: '#3b82f6', SPIRIT: '#ec4899', FLOW: '#10b981',
        PLAY: '#f59e0b', FOOD: '#ef4444', GENERAL: '#6366f1',
    };

    const accentColor = familyColors[familyKey];

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[
                styles.card,
                isSelected && { borderColor: accentColor, shadowOpacity: 0.2 }
            ]}>

                {/* Title: Truncated strictly to prevent long cards */}
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    {room.title}
                </Text>

                <View style={styles.infoRow}>
                    <View style={styles.leftInfo}>
                        <Text style={styles.emoji}>{room.emoji}</Text>
                        <Users size={10} color="#94a3b8" style={styles.userIcon} />
                        <Text style={styles.metaText}>{room.participantCount}</Text>
                    </View>

                    {/* Status Indicators */}
                    {room.isHighActivity ? (
                        <Zap size={10} color={accentColor} fill={accentColor} />
                    ) : room.isFull ? (
                        <Lock size={10} color="#cbd5e1" />
                    ) : null}
                </View>

                {/* Premium selection accent */}
                {isSelected && <View style={[styles.selectionLine, { backgroundColor: accentColor }]} />}
            </View>
            <View style={styles.pointer} />
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    card: {
        width: 95, // Strict width for a "Token" look
        backgroundColor: '#ffffff',
        borderRadius: 8,
        paddingTop: 6,
        paddingBottom: 6,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    title: {
        fontSize: 10,
        fontWeight: '800', // Bold is better for small tokens
        color: '#1e293b',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 10,
        marginRight: 4,
    },
    userIcon: {
        marginRight: 2,
    },
    metaText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#64748b',
    },
    selectionLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2.5,
    },
    pointer: {
        width: 8,
        height: 8,
        backgroundColor: '#ffffff',
        transform: [{ rotate: '45deg' }],
        marginTop: -4,
        zIndex: -1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
});