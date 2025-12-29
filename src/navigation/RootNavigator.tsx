/**
 * Root Stack Navigator
 *
 * The main navigator for the application.
 * Handles authentication branching (Auth vs Main) and global modal screens.
 *
 * CRITICAL: Navigation switching is controlled by auth status state machine.
 * We show loading screen during ALL transition states to prevent:
 * - Crashes from stale closures accessing null user
 * - Race conditions during logout cleanup
 * - Screen unmounting while effects are still running
 *
 * State Machine → Navigation:
 * - unknown, loading, loggingOut → LoadingScreen (stable, prevents unmounting)
 * - guest, authenticating → AuthNavigator
 * - authenticated → App screens
 *
 * Smooth Transitions:
 * - Uses fade animation when switching between auth and app stacks
 * - Minimum logout duration prevents flickering
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';

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
    LoadingScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Uses auth status state machine for safe navigation transitions.
 */
export function RootNavigator() {
    const { status, isTransitioning } = useAuth();

    // CRITICAL: Show loading during ALL transition states
    // This prevents screens from unmounting while cleanup is in progress
    // States: 'unknown' | 'loading' | 'loggingOut'
    //
    // Note: We explicitly check for 'loggingOut' to keep screens mounted
    // until cleanup is complete. This prevents crashes from:
    // - EventBus handlers running with null userId
    // - useEffect cleanups accessing cleared stores
    // - Navigation happening during async operations
    if (status === 'unknown' || status === 'loading' || status === 'loggingOut') {
        return <LoadingScreen />;
    }

    // Determine if we should show auth screens
    // 'guest' = not logged in
    // 'authenticating' = login/register in progress (keep auth screens visible)
    const showAuthScreens = status === 'guest' || status === 'authenticating';

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                // Use fade for smoother transitions between stacks
                animation: 'fade',
                animationDuration: 200,
                contentStyle: { backgroundColor: '#ffffff' },
            }}
        >
            {showAuthScreens ? (
                // Auth Flow
                <Stack.Screen
                    name="Auth"
                    component={AuthNavigator}
                    options={{
                        animation: 'fade',
                    }}
                />
            ) : (
                // App Flow - only when status === 'authenticated'
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
                            animation: 'slide_from_bottom'
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
                        options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}

export default RootNavigator;
