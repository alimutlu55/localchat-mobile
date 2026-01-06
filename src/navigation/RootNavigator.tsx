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
                    // App Flow
                    <>
                        <Stack.Screen
                            name="Discovery"
                            component={DiscoveryScreen}
                            options={{ animation: 'fade' }}
                        />
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
