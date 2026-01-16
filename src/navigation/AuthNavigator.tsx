/**
 * Auth Stack Navigator
 *
 * Handles authentication flow screens.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';

// Screens
import {
  WelcomeScreen,
  EmailEntryScreen,
  LoginScreen,
  RegisterScreen,
  AnonymousLoginScreen,
  ForgotPasswordScreen,
} from '../screens';



const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Auth Stack Navigator Component
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="EmailEntry" component={EmailEntryScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="AnonymousLogin" component={AnonymousLoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

export default AuthNavigator;

