/**
 * RoomStoreProvider
 *
 * A provider component that initializes the RoomStore with WebSocket subscriptions.
 * This component should be mounted at the app level, after AuthProvider.
 *
 * It handles:
 * - Subscribing to WebSocket events and updating RoomStore
 * - Fetching initial "my rooms" data when user is authenticated
 * - Resetting store on logout
 *
 * This replaces the WebSocket handling previously done in RoomContext.
 */

import React, { useEffect } from 'react';
import { useCurrentUser } from '../../user/store';
import { useRoomStore } from '../store';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';
import { roomService } from '../../../services';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomStoreProvider');

interface RoomStoreProviderProps {
  children: React.ReactNode;
}

/**
 * Internal component that handles store initialization
 * Separated to allow conditional rendering based on auth state
 */
function RoomStoreInitializer() {
  const user = useCurrentUser();

  // Subscribe to WebSocket events
  useRoomWebSocket(user?.id);

  // Get store actions
  const setRooms = useRoomStore((s) => s.setRooms);
  const setJoinedRoomIds = useRoomStore((s) => s.setJoinedRoomIds);
  const reset = useRoomStore((s) => s.reset);

  // Fetch user's joined rooms on mount and when user changes
  useEffect(() => {
    if (!user) {
      // User logged out - reset store
      log.debug('User logged out, resetting store');
      reset();
      return;
    }

    const fetchMyRooms = async () => {
      try {
        log.debug('Fetching my rooms');
        const rooms = await roomService.getMyRooms();

        // Filter active rooms
        const activeRooms = rooms.filter((room) => room.status !== 'closed');

        // Update store
        setRooms(activeRooms);
        setJoinedRoomIds(new Set(activeRooms.map((r) => r.id)));

        log.info('My rooms loaded', { count: activeRooms.length });
      } catch (error) {
        log.error('Failed to fetch my rooms', error);
      }
    };

    fetchMyRooms();
  }, [user, setRooms, setJoinedRoomIds, reset]);

  return null;
}

/**
 * RoomStoreProvider Component
 *
 * Wraps children and initializes the RoomStore.
 * Note: Zustand stores don't need a React context provider,
 * but we use this component to handle initialization logic.
 */
export function RoomStoreProvider({ children }: RoomStoreProviderProps) {
  return (
    <>
      <RoomStoreInitializer />
      {children}
    </>
  );
}

export default RoomStoreProvider;
