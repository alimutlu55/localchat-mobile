import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MessageCircle, Lock, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../../../types';
import { theme } from '../../../core/theme';

interface RoomPinProps {
    room: Room;
    isSelected: boolean;
}

export const RoomPin = memo(({ room, isSelected }: RoomPinProps) => {
    const scaleAnim = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const clockPulseAnim = useRef(new Animated.Value(1)).current;
    const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);
    const clockLoopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isSelected ? 1.1 : 1,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
        }).start();
    }, [isSelected]);

    useEffect(() => {
        if (room.isHighActivity) {
            loopAnimRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.25,
                        duration: 750,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 750,
                        useNativeDriver: true,
                    }),
                ])
            );
            loopAnimRef.current.start();
        } else {
            if (loopAnimRef.current) {
                loopAnimRef.current.stop();
                loopAnimRef.current = null;
            }
            pulseAnim.setValue(1);
        }

        return () => {
            if (loopAnimRef.current) {
                loopAnimRef.current.stop();
            }
        };
    }, [room.isHighActivity]);

    useEffect(() => {
        if (room.isExpiringSoon) {
            clockLoopAnimRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(clockPulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(clockPulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            clockLoopAnimRef.current.start();
        } else {
            if (clockLoopAnimRef.current) {
                clockLoopAnimRef.current.stop();
                clockLoopAnimRef.current = null;
            }
            clockPulseAnim.setValue(1);
        }

        return () => {
            if (clockLoopAnimRef.current) {
                clockLoopAnimRef.current.stop();
            }
        };
    }, [room.isExpiringSoon]);

    const getPinSize = () => {
        if (room.participantCount > 30) return 56;
        if (room.participantCount > 10) return 48;
        return 40;
    };

    const pinSize = getPinSize();

    const getPinColors = () => {
        if (room.isFull) return [theme.tokens.text.tertiary, theme.tokens.text.secondary];
        if (room.isExpiringSoon) return [theme.palette.orange[400], theme.palette.orange[600]];
        return [theme.tokens.brand.primary, theme.palette.rose[500]];
    };

    const getTailColor = () => {
        if (room.isFull) return theme.tokens.text.secondary;
        if (room.isExpiringSoon) return theme.palette.orange[600];
        return theme.palette.rose[500];
    };

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            {/* Pin head - matching web: rounded-t-full rounded-b-sm */}
            <View style={[styles.pinWrapper, { width: pinSize, height: pinSize }]}>
                <LinearGradient
                    colors={getPinColors() as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.pinHead,
                        {
                            borderTopLeftRadius: pinSize / 2,
                            borderTopRightRadius: pinSize / 2,
                            borderBottomLeftRadius: pinSize / 2,
                            borderBottomRightRadius: 6, // Slightly rounded point at the bottom right transition
                        },
                        isSelected && styles.pinSelected,
                    ]}
                >
                    {room.isFull ? (
                        <Lock size={pinSize * 0.45} color={theme.tokens.text.onPrimary} />
                    ) : room.emoji ? (
                        <Text style={{ fontSize: pinSize * 0.45 }}>{room.emoji}</Text>
                    ) : (
                        <MessageCircle size={pinSize * 0.45} color={theme.tokens.text.onPrimary} />
                    )}

                    {/* Participant count badge - top right */}
                    {!room.isFull && room.participantCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {room.participantCount > 99 ? '99+' : room.participantCount}
                            </Text>
                        </View>
                    )}

                    {/* New badge - centered above */}
                    {room.isNew && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>New</Text>
                        </View>
                    )}

                    {/* High activity indicator (Ping dot) - top left */}
                    {room.isHighActivity && (
                        <Animated.View
                            style={[
                                styles.pulseDot,
                                { transform: [{ scale: pulseAnim }] },
                            ]}
                        />
                    )}
                </LinearGradient>

                {/* Expiring soon indicator (Clock) - bottom right */}
                {room.isExpiringSoon && (
                    <Animated.View style={[styles.clockIconContainer, { transform: [{ scale: clockPulseAnim }] }]}>
                        <Clock size={12} color={theme.tokens.brand.primary} strokeWidth={3} />
                    </Animated.View>
                )}
            </View>

            {/* Tail - triangle below to complete the pin look */}
            <View
                style={[
                    styles.tail,
                    { borderTopColor: getTailColor() },
                ]}
            />
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinWrapper: {
        position: 'relative',
        zIndex: 2,
    },
    pinHead: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
    },
    pinSelected: {
        borderWidth: 3,
        borderColor: theme.tokens.text.onPrimary,
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 4,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: theme.tokens.text.primary,
    },
    newBadge: {
        position: 'absolute',
        top: -16,
        left: '50%',
        marginLeft: -20, // (40 width / 2)
        width: 40,
        backgroundColor: theme.tokens.text.success,
        paddingVertical: 2,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 4,
    },
    newBadgeText: {
        color: theme.tokens.text.onPrimary,
        fontSize: 10,
        fontWeight: '500',
    },
    clockIconContainer: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 10,
        padding: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 4,
    },
    pulseDot: {
        position: 'absolute',
        top: -4,
        left: -4,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: theme.tokens.text.error,
        borderWidth: 2,
        borderColor: theme.tokens.text.onPrimary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 4,
    },
    tail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -2, // Match web overlap
        zIndex: 1,
    },
});


