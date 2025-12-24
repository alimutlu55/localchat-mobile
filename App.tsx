/**
 * LocalChat Mobile App
 *
 * Main application entry point.
 * Sets up providers, navigation, and global configuration.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, RoomProvider, SettingsProvider, UIProvider } from './src/context';
import { RootNavigator } from './src/navigation';
import { GlobalDrawers } from './src/components/GlobalDrawers';

// Initialize i18n
import './src/i18n';

/**
 * Main App Component
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AuthProvider>
            <UIProvider>
              <SettingsProvider>
                <RoomProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                  <GlobalDrawers />
                </RoomProvider>
              </SettingsProvider>
            </UIProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
