/**
 * Root Stack Navigator
 *
 * The main navigator for the application.
 * Handles authentication branching (Auth vs Main) and global modal screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context';
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
    BlockedUsersScreen,
    DiscoveryScreen,
    LoadingScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 */
export function RootNavigator() {
    const { isLoading, isAuthenticated } = useAuth();

    // Show loading screen while auth is initializing
    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: '#ffffff' },
            }}
        >
            {!isAuthenticated ? (
                // Auth Flow
                <Stack.Screen
                    name="Auth"
                    component={AuthNavigator}
                    options={{
                        animation: 'fade',
                    }}
                />
            ) : (
                // App Flow
                <>
                    <Stack.Screen name="Discovery" component={DiscoveryScreen} />

                    {/* Standalone Screens */}
                    <Stack.Screen
                        name="ChatRoom"
                        component={ChatRoomScreen}
                        options={{
                            headerShown: false,
                            gestureEnabled: true,
                            animation: 'slide_from_right', // Standard push animation
                        }}
                    />
                    <Stack.Screen
                        name="RoomDetails"
                        component={RoomDetailsScreen}
                        options={{ presentation: 'modal' }}
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
