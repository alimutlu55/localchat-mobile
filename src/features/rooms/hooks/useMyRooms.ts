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
import { roomService, wsService, WS_EVENTS } from '../../../services';
import { useRoomStore } from '../store';
import { useUserId } from '../../user/store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('MyRooms');

// =============================================================================
// Types
// =============================================================================

export interface UseMyRoomsOptions {
  /** Auto-fetch on mount (default: true) */
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
  const { autoFetch = true, includeClosed = false } = options;

  // Use RoomStore
  const setRooms = useRoomStore((s) => s.setRooms);
  const storeRooms = useRoomStore((s) => s.rooms); // Subscribe to rooms Map for reactivity
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const storeJoinedIds = useRoomStore((s) => s.joinedRoomIds);
  const setJoinedRoomIds = useRoomStore((s) => s.setJoinedRoomIds);
  const addJoinedRoom = useRoomStore((s) => s.addJoinedRoom);
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
   * Compute rooms list from joined IDs
   * Note: We subscribe to storeRooms (the Map) so this recomputes when rooms are added/removed
   */
  const computeRooms = useCallback(() => {
    const roomList: Room[] = [];
    joinedIds.forEach((id) => {
      const room = storeRooms.get(id);
      if (room) {
        // Filter closed if needed
        if (!includeClosed && room.status === 'closed') {
          return;
        }
        roomList.push({ ...room, hasJoined: true });
      }
    });

    // Sort by most recent first
    roomList.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });

    return roomList;
  }, [joinedIds, storeRooms, includeClosed]);

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
      const newIds = new Set<string>();
      fetchedRooms.forEach((room) => {
        if (room.status !== 'closed' || includeClosed) {
          newIds.add(room.id);
        }
      });

      setJoinedRoomIds(newIds);
      hasFetchedRef.current = true;
    } catch (err) {
      log.error('Failed to fetch my rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setRooms, setJoinedRoomIds, includeClosed]);

  /**
   * Add a room to user's list (optimistic update)
   */
  const addRoom = useCallback(
    (room: Room) => {
      log.debug('Adding room to my rooms', { roomId: room.id });
      // Update store
      updateRoom(room.id, room);
      // Add to joined IDs
      addJoinedRoom(room.id);
    },
    [updateRoom, addJoinedRoom]
  );

  /**
   * Remove a room from user's list (optimistic update)
   */
  const removeRoom = useCallback((roomId: string) => {
    log.debug('Removing room from my rooms', { roomId });
    removeJoinedRoom(roomId);
  }, [removeJoinedRoom]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && isAuthenticated && !hasFetchedRef.current) {
      refresh();
    }
  }, [autoFetch, isAuthenticated, refresh]);

  // WebSocket event handlers for membership changes
  useEffect(() => {
    if (!userId) return;

    // Handle user joining (from another device)
    const handleUserJoined = (payload: any) => {
      const joinedUserId = payload.userId || payload.user?.id;
      if (joinedUserId === userId) {
        log.debug('Current user joined room via WS', { roomId: payload.roomId });
        addJoinedRoom(payload.roomId);
      }
    };

    // Handle user leaving
    const handleUserLeft = (payload: any) => {
      if (payload.userId === userId) {
        log.debug('Current user left room via WS', { roomId: payload.roomId });
        removeJoinedRoom(payload.roomId);
      }
    };

    // Handle user kicked
    const handleUserKicked = (payload: any) => {
      if (payload.kickedUserId === userId) {
        log.warn('Current user was kicked', { roomId: payload.roomId });
        removeJoinedRoom(payload.roomId);
      }
    };

    // Handle user banned
    const handleUserBanned = (payload: any) => {
      if (payload.bannedUserId === userId) {
        log.warn('Current user was banned', { roomId: payload.roomId });
        removeJoinedRoom(payload.roomId);
      }
    };

    const unsubJoined = wsService.on(WS_EVENTS.USER_JOINED, handleUserJoined);
    const unsubLeft = wsService.on(WS_EVENTS.USER_LEFT, handleUserLeft);
    const unsubKicked = wsService.on(WS_EVENTS.USER_KICKED, handleUserKicked);
    const unsubBanned = wsService.on(WS_EVENTS.USER_BANNED, handleUserBanned);

    return () => {
      unsubJoined();
      unsubLeft();
      unsubKicked();
      unsubBanned();
    };
  }, [userId, addJoinedRoom, removeJoinedRoom]);

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
