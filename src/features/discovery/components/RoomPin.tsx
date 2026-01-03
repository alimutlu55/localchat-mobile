import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MessageCircle, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../../../types';
import { theme } from '../../../core/theme';

interface RoomPinProps {
    room: Room;
    isSelected: boolean;
}

export const RoomPin = memo(({ room, isSelected }: RoomPinProps) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1.15 : 1)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    // Selection animation
    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.15 : 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
        }).start();
    }, [isSelected, scaleAnim]);

    // Live pulse animation for high activity
    useEffect(() => {
        if (room.isHighActivity) {
            const animation = Animated.loop(
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2500,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                })
            );
            animation.start();
            return () => animation.stop();
        }
    }, [room.isHighActivity, pulseAnim]);

    const getPinSize = () => {
        if (room.participantCount > 30) return 56;
        if (room.participantCount > 10) return 48;
        return 42;
    };

    const pinSize = getPinSize();

    const getGradients = (): [string, string] => {
        if (room.isFull) return ['#94a3b8', '#64748b']; // slate-400 to slate-500
        if (room.isExpiringSoon) return ['#f59e0b', '#d97706']; // amber-500 to amber-600
        return ['#FF6410', '#f43f5e']; // orange-500 to rose-500
    };

    const gradientColors = getGradients();

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            {/* Live Radar Pulse */}
            {room.isHighActivity && (
                <Animated.View
                    style={[
                        styles.pulseRing,
                        {
                            width: pinSize * 1.8,
                            height: pinSize * 1.8,
                            borderRadius: pinSize,
                            borderColor: gradientColors[1],
                            opacity: pulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.6, 0],
                            }),
                            transform: [{
                                scale: pulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.8, 1.4],
                                })
                            }],
                        },
                    ]}
                />
            )}

            <View style={styles.bubbleContainer}>
                {/* Bubble Body */}
                <View style={[styles.bubbleBody, { width: pinSize, height: pinSize * 0.85 }]}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.gradient, { borderRadius: pinSize * 0.35 }]}
                    >
                        <View style={styles.content}>
                            {room.isFull ? (
                                <Lock size={pinSize * 0.35} color="#fff" />
                            ) : room.emoji ? (
                                <Text style={{ fontSize: pinSize * 0.42 }}>{room.emoji}</Text>
                            ) : (
                                <MessageCircle size={pinSize * 0.35} color="#fff" />
                            )}
                        </View>
                    </LinearGradient >

                    {/* Bubble Tail */}
                    < View style={styles.tailContainer} >
                        <View style={[styles.tail, { backgroundColor: gradientColors[1] }]} />
                    </View >
                </View >

                {/* Participant Count Pill */}
                {
                    !room.isFull && room.participantCount > 0 && (
                        <View style={styles.participantPill}>
                            <Text style={styles.participantText}>
                                {room.participantCount > 99 ? '99+' : room.participantCount}
                            </Text>
                        </View>
                    )
                }
            </View >

            {/* New Status Badge */}
            {
                room.isNew && (
                    <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                )
            }
        </Animated.View >
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    pulseRing: {
        position: 'absolute',
        borderWidth: 2,
        zIndex: -1,
    },
    bubbleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleBody: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    gradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    tailContainer: {
        position: 'absolute',
        bottom: -4,
        alignItems: 'center',
        width: '100%',
        zIndex: -1,
    },
    tail: {
        width: 14,
        height: 14,
        transform: [{ rotate: '45deg' }],
        borderRadius: 3,
    },
    participantPill: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
    },
    participantText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#1e293b', // slate-800
    },
    newBadge: {
        position: 'absolute',
        bottom: -6,
        backgroundColor: '#10b981', // emerald-500
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




