import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MessageCircle, Lock, Clock } from 'lucide-react-native';
import { Room } from '../../../types';
import { theme } from '../../../core/theme';

interface RoomPinProps {
    room: Room;
    isSelected: boolean;
}

export const RoomPin = memo(({ room, isSelected }: RoomPinProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animate on selection changes with a press bounce effect
    useEffect(() => {
        if (isSelected) {
            // Press effect: quick scale down, then bounce up
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 0.85,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1.15,
                    useNativeDriver: true,
                    friction: 4,
                    tension: 200,
                }),
            ]).start();
        } else {
            // Return to normal size
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                friction: 8,
                tension: 100,
            }).start();
        }
    }, [isSelected, scaleAnim]);

    const getPinSize = () => {
        if (room.participantCount > 30) return 56;
        if (room.participantCount > 10) return 48;
        return 40;
    };

    const pinSize = getPinSize();

    const getPinColor = () => {
        if (room.isFull) return theme.tokens.text.tertiary;
        if (room.isExpiringSoon) return theme.palette.orange[500];
        return theme.tokens.brand.primary;
    };

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.pinWrapper, { width: pinSize, height: pinSize }]}>
                <View
                    style={[
                        styles.pinHead,
                        {
                            width: pinSize,
                            height: pinSize,
                            borderTopLeftRadius: pinSize / 2,
                            borderTopRightRadius: pinSize / 2,
                            borderBottomLeftRadius: pinSize / 2,
                            borderBottomRightRadius: 6,
                            backgroundColor: getPinColor(),
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

                    {/* New badge - centered above */}
                    {room.isNew && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>New</Text>
                        </View>
                    )}

                    {/* High activity indicator (static dot) - top left */}
                    {room.isHighActivity && (
                        <View style={styles.activityDot} />
                    )}

                    {/* Expiring soon indicator (static clock) - bottom right */}
                    {room.isExpiringSoon && (
                        <View style={styles.clockIconContainer}>
                            <Clock size={12} color={theme.tokens.brand.primary} strokeWidth={3} />
                        </View>
                    )}

                    {/* Participant count badge - top right */}
                    {!room.isFull && room.participantCount > 0 && (
                        <View style={styles.participantBadge}>
                            <Text style={styles.participantBadgeText}>
                                {room.participantCount > 999 ? '999+' : room.participantCount}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
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
    },
    pinHead: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    pinSelected: {
        borderWidth: 3,
        borderColor: theme.tokens.text.onPrimary,
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    participantBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    participantBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.tokens.text.primary,
    },
    newBadge: {
        position: 'absolute',
        top: -16,
        left: '50%',
        marginLeft: -20,
        width: 40,
        backgroundColor: theme.tokens.text.success,
        paddingVertical: 2,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
        elevation: 2,
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
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
        elevation: 2,
    },
    activityDot: {
        position: 'absolute',
        top: -4,
        left: -4,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: theme.tokens.text.error,
        borderWidth: 2,
        borderColor: theme.tokens.text.onPrimary,
    },
});


