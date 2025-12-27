/**
 * LocalChat Mobile App
 *
 * Main application entry point.
 * Sets up providers, navigation, and global configuration.
 *
 * Provider hierarchy:
 * 1. GestureHandler - Required for gesture handling
 * 2. SafeAreaProvider - Safe area insets
 * 3. NavigationContainer - Navigation state
 * 4. AuthProvider - Authentication state
 * 5. UIProvider - UI state (sidebar, drawers)
 * 6. SettingsProvider - User settings
 * 7. RoomStoreProvider - Zustand store + WebSocket handlers
 *
 * Architecture:
 * - RoomStore (Zustand) is the single source of truth for room data
 * - All room operations use hooks from features/rooms
 * - No legacy RoomContext/RoomProvider needed
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, SettingsProvider, UIProvider } from './src/context';
import { RoomStoreProvider } from './src/features/rooms';
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
                {/* RoomStoreProvider initializes Zustand store and WebSocket handlers */}
                <RoomStoreProvider>
                  <StatusBar style="dark" />
                  <RootNavigator />
                  <GlobalDrawers />
                </RoomStoreProvider>
              </SettingsProvider>
            </UIProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
