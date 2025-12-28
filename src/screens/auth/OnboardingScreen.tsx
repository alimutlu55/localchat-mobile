/**
 * Onboarding Screen
 *
 * Permission onboarding flow matching web AnonymousLoginFlow:
 * 1. Location permission (required)
 * 2. Notifications permission (optional)
 * 3. Complete - "You're all set!"
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { MapPin, Bell, Check, X, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { onboardingService } from '../../services/onboarding';
import { useAuth } from '../../features/auth';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type OnboardingStep = 'checking' | 'location' | 'notifications' | 'complete';

export default function OnboardingScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { loginAnonymous } = useAuth();

    const [currentStep, setCurrentStep] = useState<OnboardingStep>('checking');
    const [locationGranted, setLocationGranted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const checkScaleAnim = useRef(new Animated.Value(0)).current;

    // Progress calculation
    const totalSteps = 2;
    const currentStepNumber = currentStep === 'location' ? 1 : currentStep === 'notifications' ? 2 : 0;

    useEffect(() => {
        checkInitialStatus();
    }, []);

    useEffect(() => {
        // Animate step transitions
        fadeAnim.setValue(0);
        slideAnim.setValue(20);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Animate progress bar
        Animated.timing(progressAnim, {
            toValue: currentStepNumber / totalSteps,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentStep]);

    const checkInitialStatus = async () => {
        try {
            // Check if onboarding already completed
            const needsOnboarding = await onboardingService.needsOnboarding();
            if (!needsOnboarding) {
                // Skip onboarding, authenticate directly
                await authenticateUser(false);
                return;
            }

            // Check current permission status
            const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
            if (locationStatus === 'granted') {
                setLocationGranted(true);
                // Check notifications
                const { status: notifStatus } = await Notifications.getPermissionsAsync();
                if (notifStatus === 'granted') {
                    await authenticateUser(true);
                } else {
                    setCurrentStep('notifications');
                }
            } else {
                setCurrentStep('location');
            }
        } catch (err) {
            console.error('[Onboarding] Error checking status:', err);
            setCurrentStep('location');
        }
    };

    const authenticateUser = async (showCompleteScreen: boolean) => {
        if (showCompleteScreen) {
            setCurrentStep('complete');
            // Animate checkmark
            Animated.spring(checkScaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 100,
                useNativeDriver: true,
            }).start();
        }

        setIsLoading(true);
        setError(null);

        try {
            // Generate a random display name
            const randomName = `User${Math.floor(Math.random() * 10000)}`;
            await loginAnonymous(randomName);

            // Mark onboarding complete
            if (showCompleteScreen) {
                await onboardingService.markComplete();
            }

            // Navigate after delay
            const delay = showCompleteScreen ? 1500 : 0;
            setTimeout(() => {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Discovery' }],
                });
            }, delay);
        } catch (err) {
            console.error('[Onboarding] Auth failed:', err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
            setIsLoading(false);
            setCurrentStep('location');
        }
    };

    const handleAllowLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationGranted(status === 'granted');

            // Continue regardless of result
            setTimeout(async () => {
                const res = await Notifications.getPermissionsAsync();
                if (res.status === 'granted') {
                    authenticateUser(true);
                } else {
                    setCurrentStep('notifications');
                }
            }, 500);
        } catch (err) {
            console.warn('[Onboarding] Location error:', err);
            setCurrentStep('notifications');
        }
    };

    const handleAllowNotifications = async () => {
        try {
            await Notifications.requestPermissionsAsync();
        } catch (err) {
            console.warn('[Onboarding] Notification error:', err);
        }
        authenticateUser(true);
    };

    const handleSkipNotifications = () => {
        authenticateUser(true);
    };

    const handleBack = () => {
        navigation.goBack();
    };

    // Loading state
    if (currentStep === 'checking') {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1f2937" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <X size={24} color="#1f2937" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        {currentStep !== 'complete' && (
                            <Text style={styles.stepIndicator}>
                                {currentStepNumber} of {totalSteps}
                            </Text>
                        )}
                    </View>
                    <View style={styles.backButtonPlaceholder} />
                </View>

                {/* Error Banner */}
                {error && (
                    <View style={styles.errorBanner}>
                        <AlertCircle size={20} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Progress Bar */}
                {currentStep !== 'complete' && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressTrack}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['10%', '100%'],
                                        }),
                                    },
                                ]}
                            />
                        </View>
                    </View>
                )}

                {/* Content */}
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {currentStep === 'location' && (
                        <View style={styles.stepContainer}>
                            <View style={styles.iconContainer}>
                                <MapPin size={40} color="#1f2937" strokeWidth={1.5} />
                            </View>

                            <Text style={styles.mainTitle}>Enable location</Text>
                            <Text style={styles.cardDescription}>
                                We need your location to show you nearby conversations and events happening around you.
                            </Text>

                            <TouchableOpacity
                                style={[styles.primaryButton, locationGranted && styles.buttonSuccess]}
                                onPress={handleAllowLocation}
                                disabled={locationGranted}
                                activeOpacity={0.8}
                            >
                                {locationGranted ? (
                                    <View style={styles.buttonContent}>
                                        <Check size={20} color="#1f2937" />
                                        <Text style={styles.primaryButtonText}>Enabled</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.privacyNote}>
                                Your exact location is never shared with others.
                            </Text>
                        </View>
                    )}

                    {currentStep === 'notifications' && (
                        <View style={styles.stepContainer}>
                            <View style={styles.iconContainer}>
                                <Bell size={40} color="#1f2937" strokeWidth={1.5} />
                            </View>

                            <Text style={styles.mainTitle}>Stay updated</Text>
                            <Text style={styles.cardDescription}>
                                Get notified when someone replies to your messages or when new events appear nearby.
                            </Text>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleAllowNotifications}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.primaryButtonText}>Enable notifications</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSkipNotifications}
                                style={styles.skipButton}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.skipButtonText}>Maybe later</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {currentStep === 'complete' && (
                        <View style={styles.completeContainer}>
                            <Animated.View
                                style={[
                                    styles.successIcon,
                                    { transform: [{ scale: checkScaleAnim }] },
                                ]}
                            >
                                <Check size={48} color="#1f2937" strokeWidth={3} />
                            </Animated.View>

                            <Text style={styles.completeTitle}>You're all set!</Text>
                            <Text style={styles.completeDescription}>
                                Creating your private profile...
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* Footer */}
                {currentStep !== 'complete' && (
                    <View style={styles.footer}>
                        <View style={styles.privacyBadge}>
                            <Text style={styles.footerText}>
                                🔒 Your data remains private and local
                            </Text>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    safeArea: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    backButtonPlaceholder: {
        width: 44,
    },
    stepIndicator: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
    },
    progressContainer: {
        paddingHorizontal: 24,
        marginTop: 8,
        marginBottom: 40,
    },
    progressTrack: {
        height: 4,
        backgroundColor: '#f3f4f6',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#1f2937',
        borderRadius: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: 'center',
    },
    stepContainer: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f9fafb',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 16,
        textAlign: 'center',
    },
    cardDescription: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 48,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: '#f3f4f6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonSuccess: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    skipButton: {
        marginTop: 20,
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6b7280',
    },
    privacyNote: {
        fontSize: 13,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 24,
    },
    completeContainer: {
        alignItems: 'center',
    },
    successIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#f9fafb',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    completeTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 12,
    },
    completeDescription: {
        fontSize: 16,
        color: '#6b7280',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        alignItems: 'center',
    },
    privacyBadge: {
        backgroundColor: '#f9fafb',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    footerText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '500',
    },
});
