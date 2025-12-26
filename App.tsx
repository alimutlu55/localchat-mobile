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
 * 7. RoomCacheProvider - Room data cache (new)
 * 8. RoomProvider - Room business logic (uses cache)
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, RoomProvider, SettingsProvider, UIProvider } from './src/context';
import { RoomCacheProvider } from './src/features/rooms';
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
                <RoomCacheProvider>
                  <RoomProvider>
                    <StatusBar style="dark" />
                    <RootNavigator />
                    <GlobalDrawers />
                  </RoomProvider>
                </RoomCacheProvider>
              </SettingsProvider>
            </UIProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
