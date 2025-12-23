import React, { useEffect, useRef, memo } from 'react';
import {
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getClusterSizeCategory, formatClusterCount } from '../utils/mapClustering';

interface MapClusterProps {
    count: number;
}

export const MapCluster = memo(({ count }: MapClusterProps) => {
    const sizeCategory = getClusterSizeCategory(count);

    // Animations
    const scale = useRef(new Animated.Value(0.9)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Initial entry animation
        const entryAnim = Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]);

        entryAnim.start();

        // Subtle ripple/pulse animation
        const loopAnim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );

        loopAnim.start();

        return () => {
            entryAnim.stop();
            loopAnim.stop();
        };
    }, []);

    const getColors = (): [string, string] => {
        switch (sizeCategory) {
            case 'small':
                return ['#fb923c', '#f43f5e']; // orange-400 -> rose-500
            case 'medium':
                return ['#f97316', '#e11d48']; // orange-500 -> rose-600
            case 'large':
                return ['#f43f5e', '#9333ea']; // rose-500 -> purple-600
            case 'xlarge':
                return ['#a855f7', '#4f46e5']; // purple-500 -> indigo-600
        }
    };

    const getSizeStyle = () => {
        switch (sizeCategory) {
            case 'small':
                return { width: 40, height: 40, borderRadius: 20 };
            case 'medium':
                return { width: 48, height: 48, borderRadius: 24 };
            case 'large':
                return { width: 56, height: 56, borderRadius: 28 };
            case 'xlarge':
                return { width: 64, height: 64, borderRadius: 32 };
        }
    };

    const getFontSize = () => {
        switch (sizeCategory) {
            case 'small': return 14;
            case 'medium': return 16;
            case 'large': return 18;
            case 'xlarge': return 20;
        }
    };

    const colors = getColors();
    const size = getSizeStyle();

    return (
        <View
            pointerEvents="none"
            style={styles.container}
        >
            <Animated.View
                style={[
                    styles.inner,
                    size,
                    {
                        opacity,
                        transform: [{ scale }],
                    },
                ]}
            >
                {/* Glow effect for large clusters */}
                {(sizeCategory === 'large' || sizeCategory === 'xlarge') && (
                    <Animated.View
                        style={[
                            styles.glow,
                            size,
                            {
                                backgroundColor: colors[0],
                                transform: [{ scale: pulseAnim }],
                            },
                        ]}
                    />
                )}

                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradient, size]}
                >
                    {/* Subtle ripple layer */}
                    <Animated.View
                        style={[
                            styles.ripple,
                            {
                                transform: [{ scale: pulseAnim }],
                                opacity: pulseAnim.interpolate({
                                    inputRange: [1, 1.15],
                                    outputRange: [0.2, 0]
                                })
                            }
                        ]}
                    />

                    <Text style={[styles.text, { fontSize: getFontSize() }]}>
                        {formatClusterCount(count)}
                    </Text>
                </LinearGradient>
            </Animated.View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
    inner: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 6,
    },
    gradient: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#ffffff',
        overflow: 'hidden',
    },
    text: {
        color: '#ffffff',
        fontWeight: '700',
    },
    glow: {
        position: 'absolute',
        opacity: 0.3,
    },
    ripple: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: '#ffffff',
    }
});
