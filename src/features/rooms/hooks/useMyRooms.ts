/**
 * useMyRooms Hook
 *
 * Provides access to rooms the current user has joined or created.
 * Extracted from RoomContext to separate concerns.
 *
 * Responsibilities:
 * - Fetch user's rooms from API
 * - Track joined room IDs
 * - Provide derived list of user's rooms
 * - Listen for WebSocket events to update membership
 *
 * Design decisions:
 * - Uses RoomCacheContext for data storage
 * - Maintains Set<roomId> for fast membership lookup
 * - Sorted by most recent first
 *
 * Usage:
 * ```typescript
 * const {
 *   rooms,
 *   isLoading,
 *   refresh,
 *   isJoined,
 *   addRoom,
 *   removeRoom,
 * } = useMyRooms();
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Room } from '../../../types';
import { roomService } from '../../../services';
import { useRoomStore } from '../store';
import { useUserId } from '../../user/store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('MyRooms');

// =============================================================================
// Types
// =============================================================================

export interface UseMyRoomsOptions {
  /** Auto-fetch on mount (default: false - RoomStoreProvider handles initial fetch) */
  autoFetch?: boolean;
  /** Include closed rooms (default: false) */
  includeClosed?: boolean;
}

export interface UseMyRoomsReturn {
  /** User's rooms (joined or created) */
  rooms: Room[];

  /** Set of joined room IDs for quick lookup */
  joinedIds: Set<string>;

  /** Whether fetch is in progress */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Refresh rooms from API */
  refresh: () => Promise<void>;

  /** Check if user has joined a specific room */
  isJoined: (roomId: string) => boolean;

  /** Add a room to user's list (optimistic) */
  addRoom: (room: Room) => void;

  /** Remove a room from user's list (optimistic) */
  removeRoom: (roomId: string) => void;

  /** Active rooms only (non-expired, non-closed) */
  activeRooms: Room[];

  /** Expired rooms */
  expiredRooms: Room[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMyRooms(options: UseMyRoomsOptions = {}): UseMyRoomsReturn {
  // autoFetch defaults to false since RoomStoreProvider handles initial fetch
  const { autoFetch = false, includeClosed = false } = options;

  // Use RoomStore
  const setRooms = useRoomStore((s) => s.setRooms);
  const storeRooms = useRoomStore((s) => s.rooms); // Subscribe to rooms Map for reactivity
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const storeJoinedIds = useRoomStore((s) => s.joinedRoomIds);
  const storeCreatedIds = useRoomStore((s) => s.createdRoomIds);
  const setJoinedRoomIds = useRoomStore((s) => s.setJoinedRoomIds);
  const setCreatedRoomIds = useRoomStore((s) => s.setCreatedRoomIds);
  const addJoinedRoom = useRoomStore((s) => s.addJoinedRoom);
  const addCreatedRoom = useRoomStore((s) => s.addCreatedRoom);
  const removeJoinedRoom = useRoomStore((s) => s.removeJoinedRoom);

  const userId = useUserId();
  const isAuthenticated = !!userId;

  // Local state for loading/error
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Use store's joinedIds
  const joinedIds = storeJoinedIds;

  /**
   * Check if user has joined a room
   */
  const isJoined = useCallback(
    (roomId: string): boolean => joinedIds.has(roomId),
    [joinedIds]
  );

  /**
   * Compute rooms list from joined IDs and created rooms
   * Note: We subscribe to storeRooms (the Map) so this recomputes when rooms are added/removed
   * 
   * Includes:
   * - All rooms in joinedIds (user is actively in room) → hasJoined: true
   * - All rooms in createdRoomIds but not in joinedIds (owner left) → hasJoined: false
   */
  const computeRooms = useCallback(() => {
    const roomList: Room[] = [];
    const addedIds = new Set<string>();

    // First add rooms from joinedIds (user is actively in room)
    joinedIds.forEach((id) => {
      const room = storeRooms.get(id);
      if (room) {
        // Filter closed if needed
        if (!includeClosed && room.status === 'closed') {
          return;
        }
        // Include isCreator from createdRoomIds for consistency
        const isCreator = storeCreatedIds.has(id);
        roomList.push({ ...room, hasJoined: true, isCreator });
        addedIds.add(id);
      }
    });

    // Then add any created rooms not already added (owner left but room still exists)
    storeCreatedIds.forEach((id) => {
      if (!addedIds.has(id)) {
        const room = storeRooms.get(id);
        if (room) {
          // Filter closed if needed
          if (!includeClosed && room.status === 'closed') {
            return;
          }
          roomList.push({ ...room, hasJoined: false, isCreator: true });
        }
      }
    });

    // Sort by most recent first
    roomList.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });

    return roomList;
  }, [joinedIds, storeCreatedIds, storeRooms, includeClosed]);


  // Compute rooms from store
  const rooms = computeRooms();

  /**
   * Fetch user's rooms from API
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      log.debug('Skip fetch - not authenticated');
      return;
    }

    log.debug('Fetching my rooms');
    setIsLoading(true);
    setError(null);

    try {
      const fetchedRooms = await roomService.getMyRooms();
      log.info('Fetched my rooms', { count: fetchedRooms.length });

      // Update store
      setRooms(fetchedRooms);

      // Update joined IDs
      const newJoinedIds = new Set<string>();
      const newCreatedIds = new Set<string>();

      fetchedRooms.forEach((room) => {
        if (room.status !== 'closed' || includeClosed) {
          newJoinedIds.add(room.id);
        }
        if (room.isCreator) {
          newCreatedIds.add(room.id);
        }
      });

      setJoinedRoomIds(newJoinedIds);
      setCreatedRoomIds(newCreatedIds);
      hasFetchedRef.current = true;
    } catch (err) {
      log.error('Failed to fetch my rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setRooms, setJoinedRoomIds, setCreatedRoomIds, includeClosed]);

  /**
   * Add a room to user's list (optimistic update)
   */
  const addRoom = useCallback(
    (room: Room) => {
      log.debug('Adding room to my rooms', { roomId: room.id, isCreator: room.isCreator });
      // Update store
      updateRoom(room.id, room);
      // Add to joined IDs
      addJoinedRoom(room.id);
      // Add to created IDs if user is creator
      if (room.isCreator) {
        addCreatedRoom(room.id);
      }
    },
    [updateRoom, addJoinedRoom, addCreatedRoom]
  );

  /**
   * Remove a room from user's list (optimistic update)
   */
  const removeRoom = useCallback((roomId: string) => {
    log.debug('Removing room from my rooms', { roomId });
    removeJoinedRoom(roomId);
  }, [removeJoinedRoom]);

  // Auto-fetch on mount (only once)
  useEffect(() => {
    if (autoFetch && isAuthenticated && !hasFetchedRef.current) {
      hasFetchedRef.current = true; // Mark as fetched BEFORE calling to prevent re-entry
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, isAuthenticated]); // Intentionally exclude 'refresh' - we only want to fetch once on mount

  // NOTE: Event subscriptions for user joined/left/kicked/banned are now
  // handled centrally by useRoomWebSocket in RoomStoreProvider.
  // This avoids duplicate handlers when multiple components use useMyRooms.

  // Derived: active vs expired rooms
  const activeRooms = rooms.filter((r) => {
    const now = new Date();
    const isExpired = r.expiresAt && r.expiresAt < now;
    return !isExpired && r.status !== 'closed' && r.status !== 'expired';
  });

  const expiredRooms = rooms.filter((r) => {
    const now = new Date();
    const isExpired = r.expiresAt && r.expiresAt < now;
    return isExpired || r.status === 'closed' || r.status === 'expired';
  });

  return {
    rooms,
    joinedIds,
    isLoading,
    error,
    refresh,
    isJoined,
    addRoom,
    removeRoom,
    activeRooms,
    expiredRooms,
  };
}

export default useMyRooms;
