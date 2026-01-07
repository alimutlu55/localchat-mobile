import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Room, RoomCategory } from '../../../types';
import { ASSETS } from '../../../constants/assets';

/**
 * Grouping categories into Families to use shared pin design per family.
 */
const FAMILY_PINS = ASSETS.ROOM_PINS;

const CATEGORY_TO_FAMILY: Record<string, keyof typeof FAMILY_PINS> = {
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

const DEFAULT_PIN = ASSETS.ROOM_PINS.GENERAL;

interface BubbleProps {
    room: Room;
    isSelected: boolean;
}

export const Bubble = memo(({ room, isSelected }: BubbleProps) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1.15 : 1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.15 : 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, [isSelected, scaleAnim]);

    const pinSize = 80;

    const categoryKey = (room.category?.toUpperCase() || 'FOOD_DINING') as RoomCategory;
    const familyKey = CATEGORY_TO_FAMILY[categoryKey] || 'FOOD';
    const pinImageSource = FAMILY_PINS[familyKey] || DEFAULT_PIN;

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.bubbleContainer}>
                {/* Custom Pin Image Background mapping to Category */}
                <Image
                    source={pinImageSource}
                    style={[
                        styles.pinImage,
                        { width: pinSize, height: pinSize, opacity: 0.9 },
                    ]}
                    resizeMode="contain"
                />

                {/* Content Layer (Centered in the bulbous part of the teardrop) */}
                <View style={[styles.contentOverlay, {
                    width: pinSize,
                    height: pinSize * 0.5,
                    top: pinSize * 0.2
                }]}>
                    {room.isFull ? (
                        <Lock size={pinSize * 0.24} color="#fff" />
                    ) : (
                        <View style={[styles.defaultCircle, { width: pinSize * 0.24, height: pinSize * 0.24 }]} />
                    )}
                </View>

                {/* Participant Count Pill */}
                {!room.isFull && room.participantCount > 0 && (
                    <View style={[styles.participantPill, { top: pinSize * 0.06, right: pinSize * 0.06 }]}>
                        <Text style={styles.participantText}>
                            👤 {room.participantCount > 99 ? '99+' : room.participantCount}
                        </Text>
                    </View>
                )}
            </View >

            {/* New Status Badge */}
            {room.isNew && (
                <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                </View>
            )}
        </Animated.View >
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
    },
    bubbleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinImage: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    contentOverlay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    defaultCircle: {
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    participantPill: {
        position: 'absolute',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 4,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    participantText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#475569',
    },
    newBadge: {
        position: 'absolute',
        bottom: 0,
        backgroundColor: '#10b981',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    newBadgeText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
});
