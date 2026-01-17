/**
 * Root Stack Navigator
 *
 * The main navigator for the application.
 * Handles consent → authentication → main app flow.
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth';
import { useSession } from '../core/session/useSession';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';

import {
    SplashScreen,
    OnboardingScreen,
    RoomDetailsScreen,
    CreateRoomScreen,
    EditProfileScreen,
    ConsentScreen,
    ConsentPreferencesScreen,
    CustomPaywallScreen,
} from '../screens';

import {
    LocationSettingsScreen,
    LanguageSettingsScreen,
    DataControlsScreen,
    BlockedUsersScreen,
    ReportProblemScreen,
} from '../screens/settings';

import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Uses session status (auth + consent) for safe navigation transitions.
 */
export function RootNavigator() {
    const { status: authStatus } = useAuth();
    const { status: sessionStatus, isInitializing } = useSession();

    // CRITICAL: During initialization, splash screen is visible
    if (isInitializing) {
        return null;
    }

    // Determine stack based on session status (integrates auth + consent)
    const showConsentFlow = sessionStatus === 'needsConsent';
    const showAuthScreens = sessionStatus === 'needsAuth' || authStatus === 'authenticating';
    const showLoadingOverlay = authStatus === 'loggingOut';

    return (
        <View style={styles.container}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'fade',
                    animationDuration: 200,
                    contentStyle: { backgroundColor: '#ffffff' },
                }}
            >
                {showConsentFlow ? (
                    // Consent Flow
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
                        <Stack.Screen
                            name="Auth"
                            component={AuthNavigator}
                            options={{ animation: 'fade' }}
                        />
                    </>
                ) : showAuthScreens ? (
                    // Auth Flow
                    <Stack.Screen
                        name="Auth"
                        component={AuthNavigator}
                        options={{ animation: 'fade' }}
                    />
                ) : (
                    // App Flow (MainFlow contains Drawers)
                    <>
                        {/* MainFlow hosts Discovery, ChatRoom, RoomInfo AND GlobalDrawers */}
                        <Stack.Screen
                            name="MainFlow"
                            component={MainNavigator}
                            options={{ animation: 'fade' }}
                        />

                        {/* Standard screens pushed on top of MainFlow stack (and thus on top of its drawers) */}
                        <Stack.Screen
                            name="EditProfile"
                            component={EditProfileScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                        <Stack.Screen
                            name="ConsentPreferences"
                            component={ConsentPreferencesScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />

                        {/* Profile Drawer Sub-screens - regular card presentation slides OVER drawers */}
                        <Stack.Screen
                            name="BlockedUsers"
                            component={BlockedUsersScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />
                        <Stack.Screen
                            name="LocationSettings"
                            component={LocationSettingsScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />
                        <Stack.Screen
                            name="LanguageSettings"
                            component={LanguageSettingsScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />
                        <Stack.Screen
                            name="DataControls"
                            component={DataControlsScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />
                        <Stack.Screen
                            name="ReportProblem"
                            component={ReportProblemScreen}
                            options={{
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        />

                        <Stack.Screen
                            name="CustomPaywall"
                            component={CustomPaywallScreen}
                            options={{
                                presentation: 'modal',
                                animation: 'slide_from_bottom',
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>

            {/* Overlay during logout */}
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
