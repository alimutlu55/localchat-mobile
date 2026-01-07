import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Room, RoomCategory } from '../../../types';

const CATEGORY_TO_FAMILY: Record<string, string> = {
    TRAFFIC_TRANSIT: 'PULSE',
    SAFETY_HAZARDS: 'PULSE',
    LOST_FOUND: 'PULSE',
    EVENTS_FESTIVALS: 'SPIRIT',
    SOCIAL_MEETUPS: 'SPIRIT',
    ATMOSPHERE_MUSIC: 'SPIRIT',
    SIGHTSEEING_GEMS: 'FLOW',
    NEWS_INTEL: 'FLOW',
    RETAIL_WAIT: 'FLOW',
    SPORTS_FITNESS: 'PLAY',
    DEALS_POPUPS: 'PLAY',
    MARKETS_FINDS: 'PLAY',
    FOOD_DINING: 'FOOD',
    GENERAL: 'GENERAL',
    TRAFFIC: 'PULSE',
    EMERGENCY: 'PULSE',
    SOCIAL: 'SPIRIT',
    ATMOSPHERE: 'SPIRIT',
    EVENTS: 'SPIRIT',
    SIGHTSEEING: 'FLOW',
    NEWS: 'FLOW',
    RETAIL: 'FLOW',
    SPORTS: 'PLAY',
    DEALS: 'PLAY',
    MARKETS: 'PLAY',
    FOOD: 'FOOD',
    NEIGHBORHOOD: 'GENERAL',
};

interface MiniRoomCardProps {
    room: Room;
    isSelected: boolean;
}

export const MiniRoomCard = memo(({ room, isSelected }: MiniRoomCardProps) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1.05 : 1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.05 : 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, [isSelected, scaleAnim]);

    const categoryKey = (room.category?.toUpperCase() || 'GENERAL') as RoomCategory;
    const familyKey = CATEGORY_TO_FAMILY[categoryKey] || 'GENERAL';

    const familyColors: Record<string, string> = {
        PULSE: '#3b82f6',
        SPIRIT: '#ec4899',
        FLOW: '#10b981',
        PLAY: '#f59e0b',
        FOOD: '#ef4444',
        GENERAL: '#6366f1',
    };
    const accentColor = familyColors[familyKey];

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[
                styles.card,
                isSelected && styles.cardSelected,
                { borderLeftColor: accentColor }
            ]}>
                <View style={styles.cardContent}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                            {room.title}
                        </Text>
                        {room.isNew && <View style={styles.newIndicator} />}
                    </View>

                    <View style={styles.metaRow}>
                        <Text
                            style={styles.metaText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {room.emoji} 👤 {room.participantCount}
                        </Text>
                    </View>
                </View>

                {room.isFull ? (
                    <View style={styles.sideBadge}>
                        <Lock size={12} color="#94a3b8" />
                    </View>
                ) : room.isHighActivity && (
                    <View style={[styles.sideBadge, { backgroundColor: accentColor + '20' }]}>
                        <View style={[styles.activityDot, { backgroundColor: accentColor }]} />
                    </View>
                )}
            </View>
            <View style={styles.pointer} />
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 10,
        paddingLeft: 8,
        paddingRight: 6,
        paddingVertical: 5,
        borderLeftWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
        elevation: 4,
        minWidth: 70,
        maxWidth: 150,
        zIndex: 1,
        overflow: 'hidden',
    },
    cardSelected: {
        backgroundColor: '#ffffff',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        transform: [{ scale: 1.05 }],
    },
    cardContent: {
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 1,
    },
    title: {
        fontSize: 10,
        fontWeight: '700',
        color: '#334155',
        flex: 1,
    },
    newIndicator: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#10b981',
        marginLeft: 3,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },

    metaText: {
        fontSize: 8.5,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: -0.1,
    },
    sideBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
    },
    activityDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    pointer: {
        width: 12,
        height: 12,
        backgroundColor: '#ffffff',
        borderRadius: 3,
        transform: [{ rotate: '45deg' }],
        marginTop: -6,
        zIndex: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
});