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
import { useRoomCache } from '../context/RoomCacheContext';
import { useAuth } from '../../../context/AuthContext';
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

  const { setRooms: cacheRooms, getRoom, updateRoom: updateCacheRoom } = useRoomCache();
  const { user, isAuthenticated } = useAuth();

  // State
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  /**
   * Check if user has joined a room
   */
  const isJoined = useCallback(
    (roomId: string): boolean => joinedIds.has(roomId),
    [joinedIds]
  );

  /**
   * Compute rooms list from joined IDs
   */
  const computeRooms = useCallback(() => {
    const roomList: Room[] = [];
    joinedIds.forEach((id) => {
      const room = getRoom(id);
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
  }, [joinedIds, getRoom, includeClosed]);

  // Update rooms when joined IDs change
  useEffect(() => {
    setRooms(computeRooms());
  }, [computeRooms]);

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

      // Update cache
      cacheRooms(fetchedRooms);

      // Update joined IDs
      const newIds = new Set<string>();
      fetchedRooms.forEach((room) => {
        if (room.status !== 'closed' || includeClosed) {
          newIds.add(room.id);
        }
      });

      setJoinedIds(newIds);
      hasFetchedRef.current = true;
    } catch (err) {
      log.error('Failed to fetch my rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, cacheRooms, includeClosed]);

  /**
   * Add a room to user's list (optimistic update)
   */
  const addRoom = useCallback(
    (room: Room) => {
      log.debug('Adding room to my rooms', { roomId: room.id });
      // Update cache
      updateCacheRoom(room.id, room);
      // Add to joined IDs
      setJoinedIds((prev) => new Set(prev).add(room.id));
    },
    [updateCacheRoom]
  );

  /**
   * Remove a room from user's list (optimistic update)
   */
  const removeRoom = useCallback((roomId: string) => {
    log.debug('Removing room from my rooms', { roomId });
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && isAuthenticated && !hasFetchedRef.current) {
      refresh();
    }
  }, [autoFetch, isAuthenticated, refresh]);

  // WebSocket event handlers for membership changes
  useEffect(() => {
    if (!user?.id) return;

    // Handle user joining (from another device)
    const handleUserJoined = (payload: any) => {
      const joinedUserId = payload.userId || payload.user?.id;
      if (joinedUserId === user.id) {
        log.debug('Current user joined room via WS', { roomId: payload.roomId });
        setJoinedIds((prev) => new Set(prev).add(payload.roomId));
      }
    };

    // Handle user leaving
    const handleUserLeft = (payload: any) => {
      if (payload.userId === user.id) {
        log.debug('Current user left room via WS', { roomId: payload.roomId });
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
      }
    };

    // Handle user kicked
    const handleUserKicked = (payload: any) => {
      if (payload.kickedUserId === user.id) {
        log.warn('Current user was kicked', { roomId: payload.roomId });
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
      }
    };

    // Handle user banned
    const handleUserBanned = (payload: any) => {
      if (payload.bannedUserId === user.id) {
        log.warn('Current user was banned', { roomId: payload.roomId });
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
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
  }, [user?.id]);

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
