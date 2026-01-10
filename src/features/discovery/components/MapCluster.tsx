import React, { useEffect, useRef, memo } from 'react';
import {
    Text,
    StyleSheet,
    Animated,
    View,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { getClusterSizeCategory, formatClusterCount } from '../../../utils/mapClustering';

interface MapClusterProps {
    count: number;
}

interface MapClusterInternalProps {
    count: number;
    colors: [string, string];
    size: { width: number; height: number; borderRadius: number };
    fontSize: number;
}

/**
 * Android Implementation: Optimized for PointAnnotation's static bitmap rendering.
 * Uses SVG for mathematically perfect circles and a large "Safe Zone" buffer
 * to prevent clipping during overshoot animations or sub-pixel rounding.
 */
const AndroidMapCluster = memo(({ count, colors, size, fontSize }: MapClusterInternalProps) => {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            // Android timing eliminates overshoot entirely, which is the primary cause of clipping
            Animated.timing(scale, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const BUFFER = 32;
    const width = size.width + BUFFER;
    const height = size.height + BUFFER;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = size.width / 2;

    return (
        <Animated.View style={{
            width,
            height,
            opacity,
            transform: [{ scale }],
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <Defs>
                    <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={colors[0]} />
                        <Stop offset="100%" stopColor={colors[1]} />
                    </SvgGradient>
                </Defs>
                <Circle cx={centerX} cy={centerY} r={radius} fill="url(#grad)" />
            </Svg>
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text
                    style={[
                        styles.text,
                        {
                            fontSize,
                            fontWeight: '400',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                            width: size.width,
                            letterSpacing: 0,
                        },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                >
                    {formatClusterCount(count)}
                </Text>
            </View>
        </Animated.View>
    );
});

/**
 * iOS Implementation: Full premium effects (glow, ripple, spring animations).
 * PointAnnotation on iOS supports full interactive React Native components,
 * so we don't need the bitmap-specific optimizations required for Android.
 */
const IosMapCluster = memo(({ count, colors, size, fontSize }: MapClusterInternalProps) => {
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const rippleScale = useRef(new Animated.Value(1)).current;
    const rippleOpacity = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
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

        const rippleAnim = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(rippleScale, { toValue: 1.2, duration: 1250, useNativeDriver: true }),
                    Animated.timing(rippleScale, { toValue: 1, duration: 1250, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(rippleOpacity, { toValue: 0, duration: 1250, useNativeDriver: true }),
                    Animated.timing(rippleOpacity, { toValue: 0.2, duration: 1250, useNativeDriver: true }),
                ]),
            ])
        );

        entryAnim.start();
        rippleAnim.start();

        return () => {
            entryAnim.stop();
            rippleAnim.stop();
        };
    }, []);

    const sizeCategory = getClusterSizeCategory(count);
    const hasGlow = sizeCategory === 'large' || sizeCategory === 'xlarge';

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.inner, size, { opacity, transform: [{ scale }] }]}>
                {hasGlow && <View style={[styles.glow, size, { backgroundColor: colors[0] }]} />}
                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradient, size]}
                >
                    <Animated.View
                        style={[
                            styles.ripple,
                            { transform: [{ scale: rippleScale }], opacity: rippleOpacity }
                        ]}
                    />
                    <Text style={[styles.text, { fontSize }]}>
                        {formatClusterCount(count)}
                    </Text>
                </LinearGradient>
            </Animated.View>
        </View>
    );
});

export const MapCluster = memo(({ count }: MapClusterProps) => {
    const sizeCategory = getClusterSizeCategory(count);

    // Colors matching web exactly (more vivid, saturated)
    const getColors = (): [string, string] => {
        switch (sizeCategory) {
            case 'small': return ['#FF6410', '#f43f5e'];
            case 'medium': return ['#FF6410', '#e11d48'];
            case 'large': return ['#f43f5e', '#9333ea'];
            case 'xlarge': return ['#a855f7', '#4f46e5'];
            default: return ['#FF6410', '#f43f5e'];
        }
    };

    const getSizeStyle = () => {
        switch (sizeCategory) {
            case 'small': return { width: 40, height: 40, borderRadius: 20 };
            case 'medium': return { width: 48, height: 48, borderRadius: 24 };
            case 'large': return { width: 56, height: 56, borderRadius: 28 };
            case 'xlarge': return { width: 64, height: 64, borderRadius: 32 };
            default: return { width: 40, height: 40, borderRadius: 20 };
        }
    };

    const getFontSize = () => {
        switch (sizeCategory) {
            case 'small': return 14;
            case 'medium': return 16;
            case 'large': return 18;
            case 'xlarge': return 20;
            default: return 14;
        }
    };

    const sharedProps = {
        count,
        colors: getColors(),
        size: getSizeStyle(),
        fontSize: getFontSize(),
    };

    if (Platform.OS === 'android') {
        return <AndroidMapCluster {...sharedProps} />;
    }

    return <IosMapCluster {...sharedProps} />;
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
        fontWeight: '400', // Reverted to original Regular for iOS
        // Lighter text shadow for cleaner look
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
        zIndex: 10,
        letterSpacing: 0.5, // Restored original iOS spacing
        textAlign: 'center',
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

