/**
 * Root Navigator
 *
 * The main navigation container that handles auth state
 * and switches between auth and main app flows.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';

// Navigators
import AuthNavigator from './AuthNavigator';

// Screens
import {
  SplashScreen,
  MapScreen,
  ListScreen,
  ChatRoomScreen,
  RoomDetailsScreen,
  CreateRoomScreen,
  SettingsScreen,
  EditProfileScreen,
  OnboardingScreen,
  LoginScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 */
export function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  // Show splash screen while loading auth state
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {isAuthenticated ? (
        // Authenticated user flow - no bottom tabs, just MapScreen
        <>
          <Stack.Screen name="Main" component={MapScreen} />
          <Stack.Screen name="List" component={ListScreen} />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={{
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="RoomDetails"
            component={RoomDetailsScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="CreateRoom"
            component={CreateRoomScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        </>
      ) : (
        // Unauthenticated user flow - SplashScreen -> Onboarding -> Main
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
