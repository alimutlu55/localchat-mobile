/**
 * useRoom Hook
 *
 * Provides access to a single room's data with automatic caching and refresh.
 * This is the primary way screens should access room data.
 *
 * Design decisions:
 * - Fetches from cache first, then API if needed
 * - Automatically updates cache with fresh data
 * - Provides loading/error states
 * - Supports manual refresh
 * - Subscribes to WebSocket updates for the room
 *
 * Usage:
 * ```typescript
 * function RoomDetailsScreen() {
 *   const { roomId } = useRoute().params;
 *   const { room, isLoading, error, refresh } = useRoom(roomId);
 *
 *   if (isLoading) return <Loading />;
 *   if (!room) return <NotFound />;
 *
 *   return <RoomDetails room={room} />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Room } from '../../../types';
import { roomService } from '../../../services';
import { wsService, WS_EVENTS } from '../../../services';
import { useRoomCache } from '../context/RoomCacheContext';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useRoom');

// =============================================================================
// Types
// =============================================================================

export interface UseRoomOptions {
  /**
   * Skip initial fetch if room is already in cache
   * Default: false (always fetch fresh data)
   */
  skipFetchIfCached?: boolean;

  /**
   * Subscribe to WebSocket updates for this room
   * Default: true
   */
  subscribeToUpdates?: boolean;
}

export interface UseRoomReturn {
  /** The room data (null if not found/loading) */
  room: Room | null;

  /** Whether the initial fetch is in progress */
  isLoading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Manually refresh room data from API */
  refresh: () => Promise<void>;

  /** Whether a refresh is in progress */
  isRefreshing: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRoom(
  roomId: string | undefined,
  options: UseRoomOptions = {}
): UseRoomReturn {
  const { skipFetchIfCached = false, subscribeToUpdates = true } = options;

  const { getRoom, setRoom, updateRoom, isStale } = useRoomCache();

  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setLocalRoom] = useState<Room | null>(() =>
    roomId ? getRoom(roomId) : null
  );

  // Track if component is mounted for async safety
  const isMountedRef = useRef(true);

  // Fetch room data from API
  const fetchRoom = useCallback(
    async (showRefreshState = false) => {
      if (!roomId) {
        setLocalRoom(null);
        setIsLoading(false);
        return;
      }

      if (showRefreshState) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        log.debug('Fetching room', { roomId });
        const freshRoom = await roomService.getRoom(roomId);

        if (!isMountedRef.current) return;

        // Update cache
        setRoom(freshRoom);

        // Update local state
        setLocalRoom(freshRoom);
        log.debug('Room fetched', { roomId, title: freshRoom.title });
      } catch (err) {
        if (!isMountedRef.current) return;

        log.error('Failed to fetch room', { roomId, error: err });
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [roomId, setRoom]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;

    if (!roomId) {
      setLocalRoom(null);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = getRoom(roomId);
    const stale = isStale(roomId);

    if (cached && skipFetchIfCached && !stale) {
      // Use cached data, don't fetch
      setLocalRoom(cached);
      setIsLoading(false);
      log.debug('Using cached room', { roomId, stale: false });
    } else if (cached) {
      // Show cached data immediately, but fetch fresh if stale
      setLocalRoom(cached);
      setIsLoading(false);
      if (stale || !skipFetchIfCached) {
        log.debug('Cached room is stale, fetching fresh', { roomId });
        fetchRoom(false);
      }
    } else {
      // No cache, must fetch
      fetchRoom(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [roomId, getRoom, skipFetchIfCached, fetchRoom]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!roomId || !subscribeToUpdates) return;

    // Handle room updates
    const unsubRoomUpdated = wsService.on(
      WS_EVENTS.ROOM_UPDATED,
      (payload: any) => {
        if (payload.roomId !== roomId) return;

        log.debug('Room updated via WebSocket', { roomId });
        const { roomId: _, ...updates } = payload;
        updateRoom(roomId, updates);
        setLocalRoom((prev) => (prev ? { ...prev, ...updates } : prev));
      }
    );

    // Handle participant count changes
    const unsubParticipant = wsService.on(
      WS_EVENTS.PARTICIPANT_COUNT,
      (payload: any) => {
        if (payload.roomId !== roomId) return;

        updateRoom(roomId, { participantCount: payload.participantCount });
        setLocalRoom((prev) =>
          prev ? { ...prev, participantCount: payload.participantCount } : prev
        );
      }
    );

    // Handle user joined
    const unsubUserJoined = wsService.on(
      WS_EVENTS.USER_JOINED,
      (payload: any) => {
        if (payload.roomId !== roomId) return;

        if (payload.participantCount !== undefined) {
          updateRoom(roomId, { participantCount: payload.participantCount });
          setLocalRoom((prev) =>
            prev
              ? { ...prev, participantCount: payload.participantCount }
              : prev
          );
        }
      }
    );

    // Handle user left
    const unsubUserLeft = wsService.on(WS_EVENTS.USER_LEFT, (payload: any) => {
      if (payload.roomId !== roomId) return;

      if (payload.participantCount !== undefined) {
        updateRoom(roomId, { participantCount: payload.participantCount });
        setLocalRoom((prev) =>
          prev ? { ...prev, participantCount: payload.participantCount } : prev
        );
      }
    });

    // Handle user kicked - update participant count
    const unsubUserKicked = wsService.on(
      WS_EVENTS.USER_KICKED,
      async (payload: any) => {
        if (payload.roomId !== roomId) return;

        log.debug('User kicked via WebSocket', { roomId });
        // If participantCount is provided in payload, use it directly
        if (payload.participantCount !== undefined) {
          updateRoom(roomId, { participantCount: payload.participantCount });
          setLocalRoom((prev) =>
            prev ? { ...prev, participantCount: payload.participantCount } : prev
          );
        } else {
          // Fallback: fetch fresh room data to get updated count
          try {
            const freshRoom = await roomService.getRoom(roomId);
            updateRoom(roomId, { participantCount: freshRoom.participantCount });
            setLocalRoom((prev) =>
              prev
                ? { ...prev, participantCount: freshRoom.participantCount }
                : prev
            );
          } catch (err) {
            log.error('Failed to refresh room after kick', err);
          }
        }
      }
    );

    // Handle user banned - update participant count
    const unsubUserBanned = wsService.on(
      WS_EVENTS.USER_BANNED,
      async (payload: any) => {
        if (payload.roomId !== roomId) return;

        log.debug('User banned via WebSocket', { roomId });
        // If participantCount is provided in payload, use it directly
        if (payload.participantCount !== undefined) {
          updateRoom(roomId, { participantCount: payload.participantCount });
          setLocalRoom((prev) =>
            prev ? { ...prev, participantCount: payload.participantCount } : prev
          );
        } else {
          // Fallback: fetch fresh room data to get updated count
          try {
            const freshRoom = await roomService.getRoom(roomId);
            updateRoom(roomId, { participantCount: freshRoom.participantCount });
            setLocalRoom((prev) =>
              prev
                ? { ...prev, participantCount: freshRoom.participantCount }
                : prev
            );
          } catch (err) {
            log.error('Failed to refresh room after ban', err);
          }
        }
      }
    );

    return () => {
      unsubRoomUpdated();
      unsubParticipant();
      unsubUserJoined();
      unsubUserLeft();
      unsubUserKicked();
      unsubUserBanned();
    };
  }, [roomId, subscribeToUpdates, updateRoom]);

  // Sync with cache changes (e.g., from other components)
  useEffect(() => {
    if (!roomId) return;

    const cached = getRoom(roomId);
    if (cached && cached !== room) {
      setLocalRoom(cached);
    }
  }, [roomId, getRoom, room]);

  // Manual refresh function
  const refresh = useCallback(() => fetchRoom(true), [fetchRoom]);

  return {
    room,
    isLoading,
    error,
    refresh,
    isRefreshing,
  };
}

export default useRoom;
