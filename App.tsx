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
 * 4. UserStoreProvider - User state (Zustand store + WebSocket handlers)
 * 5. UIProvider - UI state (sidebar, drawers)
 * 6. RoomStoreProvider - Zustand store + WebSocket handlers
 *
 * Architecture:
 * - AuthStore (Zustand) handles authentication flows
 * - UserStore (Zustand) is the single source of truth for user data
 * - RoomStore (Zustand) is the single source of truth for room data
 * - All room operations use hooks from features/rooms
 * - All user data access uses hooks from features/user
 * - All auth operations use hooks from features/auth
 */

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { UIProvider } from './src/context';
import { RoomStoreProvider } from './src/features/rooms';
import { UserStoreProvider } from './src/features/user';
import { initializeAuthStore } from './src/features/auth';
import { RootNavigator } from './src/navigation';
import { GlobalDrawers } from './src/components/GlobalDrawers';
import { LoadingScreen } from './src/screens';
import { api } from './src/services';
import { wsService } from './src/services';
import { notificationService } from './src/services';
import { RootStackParamList } from './src/navigation/types';

// Initialize i18n
import './src/i18n';

/**
 * Main App Component
 */
export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Initialize auth store and setup API error callback
    const initialize = async () => {
      try {
        // Setup API auth error callback - called when token refresh fails
        api.setAuthErrorCallback(async () => {
          console.log('[App] Session expired, logging out');
          // Import and call logout from AuthStore
          const { useAuthStore } = await import('./src/features/auth');
          await useAuthStore.getState().logout();
        });

        // Initialize AuthStore (loads user from storage, connects WebSocket)
        await initializeAuthStore();
      } catch (error) {
        console.error('[App] Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();

    // Initialize notification service
    const cleanupNotifications = notificationService.initialize();
    
    // Request notification permissions
    notificationService.requestPermissions().then((granted) => {
      console.log('[App] Notification permissions:', granted ? 'granted' : 'denied');
    });

    // Handle notification taps - navigate to the room
    const notificationSubscription = notificationService.addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'message' && data?.roomId) {
          // Navigate to chat room when notification is tapped
          navigationRef.current?.navigate('ChatRoom', {
            roomId: data.roomId as string,
            roomName: (data.roomName as string) || 'Chat Room',
          });
        }
      }
    );

    // Cleanup
    return () => {
      wsService.cleanup();
      cleanupNotifications();
      notificationSubscription.remove();
    };
  }, []);

  // Show loading screen during initialization
  if (isInitializing) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          {/* UserStoreProvider handles WebSocket subscriptions for user data */}
          <UserStoreProvider>
            <UIProvider>
              {/* RoomStoreProvider initializes Zustand store and WebSocket handlers */}
              <RoomStoreProvider>
                <StatusBar style="dark" />
                <RootNavigator />
                <GlobalDrawers />
              </RoomStoreProvider>
            </UIProvider>
          </UserStoreProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
