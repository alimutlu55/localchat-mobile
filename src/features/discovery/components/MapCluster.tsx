import React, { useEffect, useRef, memo } from 'react';
import {
    Text,
    StyleSheet,
    Animated,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getClusterSizeCategory, formatClusterCount } from '../../../utils/mapClustering';

interface MapClusterProps {
    count: number;
}

export const MapCluster = memo(({ count }: MapClusterProps) => {
    const sizeCategory = getClusterSizeCategory(count);

    // Animations
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const rippleScale = useRef(new Animated.Value(1)).current;
    const rippleOpacity = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
        // Initial entry animation - matching web spring
        const entryAnim = Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                tension: 300,
                friction: 20,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]);

        entryAnim.start();

        // Subtle ripple animation - matching web (2.5s duration)
        const rippleAnim = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(rippleScale, {
                        toValue: 1.2,
                        duration: 1250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rippleScale, {
                        toValue: 1,
                        duration: 1250,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(rippleOpacity, {
                        toValue: 0,
                        duration: 1250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rippleOpacity, {
                        toValue: 0.2,
                        duration: 1250,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        rippleAnim.start();

        return () => {
            entryAnim.stop();
            rippleAnim.stop();
        };
    }, []);

    // Colors matching web exactly (more vivid, saturated)
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

    // Sizes matching web (w-10=40, w-12=48, w-14=56, w-16=64)
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

    // Font sizes matching web (text-sm=14, text-base=16, text-lg=18, text-xl=20)
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
        <View style={styles.container}>
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
                {/* Glow effect for large clusters - matching web */}
                {(sizeCategory === 'large' || sizeCategory === 'xlarge') && (
                    <View
                        style={[
                            styles.glow,
                            size,
                            { backgroundColor: colors[0] },
                        ]}
                    />
                )}

                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradient, size]}
                >
                    {/* Subtle ripple effect - matching web bg-white/15 */}
                    <Animated.View
                        style={[
                            styles.ripple,
                            {
                                transform: [{ scale: rippleScale }],
                                opacity: rippleOpacity,
                            }
                        ]}
                    />

                    {/* Count text with shadow - matching web drop-shadow-sm */}
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
        shadowOffset: { width: 0, height: 4 }, // Stronger shadow for more vivid look
        shadowOpacity: 0.25, // Increased from 0.15
        shadowRadius: 6, // Increased from 4
        elevation: 6, // Increased from 4
    },
    gradient: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0, // No white border (matching web)
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    text: {
        color: '#ffffff',
        fontWeight: '400', // Thinner font weight (regular)
        // Lighter text shadow for cleaner look
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
        zIndex: 10,
        letterSpacing: 0.5, // Add spacing for cleaner look
    },
    glow: {
        position: 'absolute',
        opacity: 0.4, // Match web opacity-40
    },
    ripple: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.15)', // Match web bg-white/15
    }
});

