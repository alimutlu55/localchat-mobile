/**
 * Loading Screen
 *
 * Simple loading screen shown while auth is initializing.
 * Does NOT use useNavigation() - safe to render outside navigator.
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';

export default function LoadingScreen() {
    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Logo animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animation for loading indicator
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <LinearGradient
            colors={['#fff7ed', '#ffffff', '#fff1f2']}
            style={styles.container}
        >
            <SafeAreaView style={styles.safeArea}>
                {/* Main content */}
                <View style={styles.content}>
                    {/* Logo */}
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <Image
                                source={require('../../assets/icon.png')}
                                style={{ width: 96, height: 96, borderRadius: 24 }}
                            />
                        </Animated.View>
                        <View style={styles.pinBadge}>
                            <MapPin size={16} color="#ffffff" />
                        </View>
                    </Animated.View>

                    {/* App Name */}
                    <Animated.View
                        style={[
                            styles.titleContainer,
                            { opacity: fadeAnim },
                        ]}
                    >
                        <Text style={styles.title}>BubbleUp</Text>
                        <Text style={styles.subtitle}>Loading...</Text>
                    </Animated.View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoContainer: {
        position: 'relative',
        marginBottom: 24,
    },
    logoGradient: {
        width: 96,
        height: 96,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF6410',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
    },
    pinBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FF6410',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 44,
        fontWeight: '300',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#6b7280',
    },
});
