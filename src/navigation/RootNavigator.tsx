/**
 * Root Stack Navigator
 *
 * The main navigator for the application.
 * Handles consent → authentication → main app flow.
 *
 * CRITICAL: Navigation switching is controlled by auth status state machine.
 * We show loading screen during ALL transition states to prevent:
 * - Crashes from stale closures accessing null user
 * - Race conditions during logout cleanup
 * - Screen unmounting while effects are still running
 *
 * Flow:
 * 1. Check consent status → If not given, show ConsentScreen
 * 2. After consent → Show Auth flow (guest/authenticating) or App (authenticated)
 *
 * State Machine → Navigation:
 * - unknown, loading → LoadingScreen (stable, prevents unmounting)
 * - loggingOut → Keep app screens mounted, show LoadingScreen overlay (prevents map marker crashes)
 * - guest, authenticating → AuthNavigator
 * - authenticated → App screens
 *
 * Smooth Transitions:
 * - Uses fade animation when switching between auth and app stacks
 * - Minimum logout duration prevents flickering
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { consentService } from '../services/consent';

import {
    SplashScreen,
    OnboardingScreen,
    ChatRoomScreen,
    RoomDetailsScreen,
    RoomInfoScreen,
    CreateRoomScreen,
    SettingsScreen,
    EditProfileScreen,
    DiscoveryScreen,
    ConsentScreen,
    ConsentPreferencesScreen,
} from '../screens';

import {
    AboutScreen,
    PrivacyPolicyScreen,
    TermsOfServiceScreen,
    PrivacySettingsScreen,
} from '../screens/settings';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Uses auth status state machine for safe navigation transitions.
 */
export function RootNavigator() {
    const { status, isTransitioning } = useAuth();
    const [consentChecked, setConsentChecked] = useState(false);
    const [hasConsent, setHasConsent] = useState(false);
    const [needsReconsent, setNeedsReconsent] = useState(false);

    // Check consent status on mount (with version check for re-consent)
    useEffect(() => {
        const checkConsent = async () => {
            try {
                // Use checkConsentStatus for version-based re-consent detection
                const status = await consentService.checkConsentStatus();
                setHasConsent(status.hasConsent && !status.needsReconsent);
                setNeedsReconsent(status.needsReconsent);
            } catch (error) {
                // Fallback to simple check if status check fails
                const consent = await consentService.hasConsent();
                setHasConsent(consent);
            }
            setConsentChecked(true);
        };
        checkConsent();
    }, []);

    // CRITICAL: During initial states, splash screen is visible
    // No need to render a separate loading screen
    // The app will simply not mount the navigator until ready
    if (status === 'unknown' || status === 'loading' || !consentChecked) {
        return null; // Splash screen remains visible
    }

    // Determine if we should show auth screens
    // 'guest' = not logged in
    // 'authenticating' = login/register in progress (keep auth screens visible)
    const showAuthScreens = status === 'guest' || status === 'authenticating';

    // If no consent yet, show consent flow first
    const showConsentFlow = !hasConsent && showAuthScreens;

    // CRITICAL: During loggingOut, keep app screens mounted but show loading overlay
    // This prevents map markers from unmounting while Fabric is recycling views
    const showLoadingOverlay = status === 'loggingOut';

    return (
        <View style={styles.container}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    // Use fade for smoother transitions between stacks
                    animation: 'fade',
                    animationDuration: 200,
                    contentStyle: { backgroundColor: '#ffffff' },
                }}
            >
                {showConsentFlow ? (
                    // Consent Flow - shown before auth on first launch
                    <>
                        <Stack.Screen
                            name="Consent"
                            component={ConsentScreen}
                            options={{ animation: 'fade' }}
                        />
                        <Stack.Screen
                            name="ConsentPreferences"
                            component={ConsentPreferencesScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        {/* Auth screen available after consent */}
                        <Stack.Screen
                            name="Auth"
                            component={AuthNavigator}
                            options={{ animation: 'fade' }}
                        />
                    </>
                ) : showAuthScreens ? (
                    // Auth Flow - consent already given
                    <Stack.Screen
                        name="Auth"
                        component={AuthNavigator}
                        options={{
                            animation: 'fade',
                        }}
                    />
                ) : (
                    // App Flow - only when status === 'authenticated' or 'loggingOut'
                    <>
                        <Stack.Screen
                            name="Discovery"
                            component={DiscoveryScreen}
                            options={{
                                animation: 'fade',
                            }}
                        />

                        {/* Standalone Screens - use slide animation within app */}
                        <Stack.Screen
                            name="ChatRoom"
                            component={ChatRoomScreen}
                            options={{
                                headerShown: false,
                                gestureEnabled: true,
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="RoomDetails"
                            component={RoomDetailsScreen}
                            options={{
                                presentation: 'transparentModal',
                                animation: 'slide_from_bottom',
                                contentStyle: { backgroundColor: 'transparent' },
                            }}
                        />
                        <Stack.Screen
                            name="RoomInfo"
                            component={RoomInfoScreen}
                            options={{
                                headerShown: false,
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="CreateRoom"
                            component={CreateRoomScreen}
                            options={{ presentation: 'fullScreenModal' }}
                        />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                        <Stack.Screen name="About" component={AboutScreen} />
                        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
                        <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
                        <Stack.Screen
                            name="ConsentPreferences"
                            component={ConsentPreferencesScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                    </>
                )}
            </Stack.Navigator>

            {/* Overlay during logout - keeps screens mounted */}
            {showLoadingOverlay && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.logoutIndicator}>
                        <ActivityIndicator size="large" color="#FF6410" />
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutIndicator: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});

export default RootNavigator;

