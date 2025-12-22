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
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { MapPin, Bell, Check, X, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { onboardingService } from '../../services/onboarding';
import { useAuth } from '../../context/AuthContext';

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
                    routes: [{ name: 'Main' }],
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
            <LinearGradient
                colors={['#fff7ed', '#ffffff', '#fff1f2']}
                style={styles.container}
            >
                <View style={styles.loadingContainer}>
                    <View style={styles.spinner} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#fff7ed', '#ffffff', '#fff1f2']}
            style={styles.container}
        >
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <X size={24} color="#374151" />
                    </TouchableOpacity>
                    {currentStep !== 'complete' && (
                        <Text style={styles.stepIndicator}>
                            Step {currentStepNumber} of {totalSteps}
                        </Text>
                    )}
                    <View style={styles.backButton} />
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
                                            outputRange: ['0%', '100%'],
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
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                >
                    {currentStep === 'location' && (
                        <View style={styles.stepContainer}>
                            <Text style={styles.mainTitle}>Let's get started</Text>

                            <View style={styles.card}>
                                <View style={[styles.iconContainer, { backgroundColor: '#fed7aa' }]}>
                                    <MapPin size={32} color="#ea580c" />
                                </View>

                                <Text style={styles.cardTitle}>Enable Location</Text>
                                <Text style={styles.cardDescription}>
                                    We need your location to show you nearby conversations and events happening around you.
                                </Text>

                                <TouchableOpacity
                                    onPress={handleAllowLocation}
                                    disabled={locationGranted}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#f97316', '#e11d48']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.primaryButton, locationGranted && styles.buttonDisabled]}
                                    >
                                        {locationGranted ? (
                                            <View style={styles.buttonContent}>
                                                <Check size={20} color="#ffffff" />
                                                <Text style={styles.primaryButtonText}>Location Allowed</Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.primaryButtonText}>Allow Location</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <Text style={styles.privacyNote}>
                                    <Text style={styles.privacyHighlight}>Privacy: </Text>
                                    Your exact location is never shared with others
                                </Text>
                            </View>
                        </View>
                    )}

                    {currentStep === 'notifications' && (
                        <View style={styles.stepContainer}>
                            <Text style={styles.mainTitle}>Stay updated</Text>

                            <View style={styles.card}>
                                <View style={[styles.iconContainer, { backgroundColor: '#fecdd3' }]}>
                                    <Bell size={32} color="#e11d48" />
                                </View>

                                <View style={styles.cardTitleRow}>
                                    <Text style={styles.cardTitle}>Notifications</Text>
                                    <Text style={styles.optionalBadge}>(Optional)</Text>
                                </View>
                                <Text style={styles.cardDescription}>
                                    Get notified when someone replies to your messages or when new events appear nearby.
                                </Text>

                                <TouchableOpacity onPress={handleAllowNotifications} activeOpacity={0.8}>
                                    <LinearGradient
                                        colors={['#f97316', '#e11d48']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.primaryButton}
                                    >
                                        <Text style={styles.primaryButtonText}>Allow Notifications</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleSkipNotifications} style={styles.skipButton}>
                                    <Text style={styles.skipButtonText}>Skip for now</Text>
                                </TouchableOpacity>

                                <Text style={styles.privacyNote}>
                                    You can change this anytime in Settings
                                </Text>
                            </View>
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
                                <Check size={48} color="#ffffff" strokeWidth={3} />
                            </Animated.View>

                            <Text style={styles.completeTitle}>You're all set!</Text>
                            <Text style={styles.completeDescription}>
                                Creating your anonymous profile...
                            </Text>

                            <View style={styles.completeBadge}>
                                <View style={styles.pulseDot} />
                                <Text style={styles.completeBadgeText}>Anonymous & Private</Text>
                            </View>
                        </View>
                    )}
                </Animated.View>

                {/* Privacy Footer */}
                {currentStep !== 'complete' && (
                    <View style={styles.footer}>
                        <View style={styles.footerCard}>
                            <Text style={styles.footerText}>
                                <Text style={styles.footerHighlight}>🔒 Stay anonymous </Text>
                                No email required. You'll get a random fun name.
                            </Text>
                        </View>
                    </View>
                )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 4,
        borderColor: '#fed7aa',
        borderTopColor: '#f97316',
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
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepIndicator: {
        fontSize: 14,
        color: '#6b7280',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fef2f2',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#dc2626',
    },
    progressContainer: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    progressTrack: {
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#f97316',
        borderRadius: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    stepContainer: {
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: '400',
        color: '#111827',
        marginBottom: 32,
        textAlign: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 8,
    },
    optionalBadge: {
        fontSize: 14,
        color: '#6b7280',
    },
    cardDescription: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    primaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    skipButton: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 15,
        color: '#6b7280',
    },
    privacyNote: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 16,
    },
    privacyHighlight: {
        color: '#f97316',
    },
    completeContainer: {
        alignItems: 'center',
    },
    successIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#22c55e',
    },
    completeTitle: {
        fontSize: 28,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 8,
    },
    completeDescription: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 32,
    },
    completeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e',
    },
    completeBadgeText: {
        fontSize: 14,
        color: '#374151',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    footerCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    footerText: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
    },
    footerHighlight: {
        color: '#f97316',
    },
});
