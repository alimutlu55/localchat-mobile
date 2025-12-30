/**
 * RoomStoreProvider
 *
 * A provider component that initializes the RoomStore with WebSocket subscriptions.
 * This component should be mounted at the app level, after AuthProvider.
 *
 * CRITICAL: This component now uses auth status state machine to handle transitions.
 * It checks for 'loggingOut' status to prevent fetching during logout.
 *
 * It handles:
 * - Subscribing to EventBus events and updating RoomStore
 * - Fetching initial "my rooms" data when user is authenticated
 * - Loading persisted muted rooms from storage
 * - Syncing muted rooms to NotificationService
 * - Resetting store on logout
 *
 * Room expiration is handled server-side via ROOM_EXPIRING WebSocket events.
 */

import React, { useEffect, useRef } from 'react';
import { useCurrentUser } from '../../user/store';
import { useAuthStore } from '../../auth/store/AuthStore';
import { useRoomStore } from './RoomStore';
import { useRoomEvents } from '../hooks/useRoomEvents';
import { roomService, notificationService, wsService } from '../../../services';
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
  const authStatus = useAuthStore((s) => s.status);

  // Subscribe to WebSocket events via EventBus
  // Pass null userId if logging out to prevent event handling
  const effectiveUserId = authStatus === 'loggingOut' ? undefined : user?.id;
  useRoomEvents(effectiveUserId);

  // Get store actions
  const setRooms = useRoomStore((s) => s.setRooms);
  const setJoinedRoomIds = useRoomStore((s) => s.setJoinedRoomIds);
  const setCreatedRoomIds = useRoomStore((s) => s.setCreatedRoomIds);
  const loadMutedRooms = useRoomStore((s) => s.loadMutedRooms);
  const reset = useRoomStore((s) => s.reset);
  const getRoom = useRoomStore((s) => s.getRoom);

  // Set up room name lookup for notifications
  useEffect(() => {
    notificationService.setRoomNameLookup((roomId: string) => {
      const room = getRoom(roomId);
      return room?.title;
    });

    return () => {
      notificationService.setRoomNameLookup(() => undefined);
    };
  }, [getRoom]);

  // Subscribe to muted rooms changes and sync to NotificationService
  useEffect(() => {
    const unsubscribe = useRoomStore.subscribe(
      (state) => state.mutedRoomIds,
      (mutedRoomIds) => {
        notificationService.setMutedRooms(mutedRoomIds);
      }
    );

    return () => unsubscribe();
  }, []);

  // Load muted rooms from storage on mount
  useEffect(() => {
    loadMutedRooms();
  }, [loadMutedRooms]);

  // Track subscribed room IDs for cleanup
  const subscribedRoomsRef = useRef<Set<string>>(new Set());

  // Fetch user's joined rooms on mount and when user changes
  // CRITICAL: Also check authStatus to prevent fetching during logout
  useEffect(() => {
    // Don't do anything during logout transition - AuthStore handles cleanup
    if (authStatus === 'loggingOut') {
      log.debug('Skipping room fetch - auth status is loggingOut');
      return;
    }

    if (!user) {
      // User logged out - unsubscribe from all rooms and reset store
      log.debug('User logged out, unsubscribing from rooms and resetting store');
      subscribedRoomsRef.current.forEach((roomId) => {
        wsService.unsubscribe(roomId);
      });
      subscribedRoomsRef.current.clear();
      reset();
      return;
    }

    // Only fetch if actually authenticated
    if (authStatus !== 'authenticated') {
      log.debug('Skipping room fetch - auth status is not authenticated', { authStatus });
      return;
    }

    const fetchMyRooms = async () => {
      try {
        log.debug('Fetching my rooms');
        const rooms = await roomService.getMyRooms();

        // Filter active rooms (not closed or expired)
        const now = Date.now();
        const activeRooms = rooms.filter((room) => {
          const isExpired = room.expiresAt && room.expiresAt.getTime() < now;
          return room.status !== 'closed' && room.status !== 'expired' && !isExpired;
        });

        // Update store
        setRooms(activeRooms);

        // Set joined room IDs (rooms user is actively in)
        const joinedIds = new Set(activeRooms.map((r) => r.id));
        setJoinedRoomIds(joinedIds);

        // Set created room IDs (rooms user created, may or may not be joined)
        const createdIds = new Set(
          activeRooms.filter((r) => r.isCreator).map((r) => r.id)
        );
        setCreatedRoomIds(createdIds);

        // Subscribe to WebSocket for all joined rooms (for notifications)
        // Unsubscribe from rooms we're no longer in
        subscribedRoomsRef.current.forEach((roomId) => {
          if (!joinedIds.has(roomId)) {
            wsService.unsubscribe(roomId);
            subscribedRoomsRef.current.delete(roomId);
            log.debug('Unsubscribed from room (no longer joined)', { roomId });
          }
        });

        // Subscribe to new rooms
        joinedIds.forEach((roomId) => {
          if (!subscribedRoomsRef.current.has(roomId)) {
            wsService.subscribe(roomId);
            subscribedRoomsRef.current.add(roomId);
            log.debug('Subscribed to room for notifications', { roomId });
          }
        });

        log.info('My rooms loaded and subscribed', { count: activeRooms.length });
      } catch (error) {
        // Check if we're still authenticated before logging error
        // (could have logged out during the fetch)
        if (useAuthStore.getState().status === 'authenticated') {
          log.error('Failed to fetch my rooms', error);
        } else {
          log.debug('Room fetch failed, but user is no longer authenticated');
        }
      }
    };

    fetchMyRooms();

    // Cleanup on unmount
    return () => {
      subscribedRoomsRef.current.forEach((roomId) => {
        wsService.unsubscribe(roomId);
      });
      subscribedRoomsRef.current.clear();
    };
  }, [user, authStatus, setRooms, setJoinedRoomIds, setCreatedRoomIds, reset]);

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
