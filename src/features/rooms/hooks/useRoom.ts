/**
 * useRoom Hook
 *
 * Provides access to a single room's data with automatic caching and refresh.
 * This is the primary way screens should access room data.
 *
 * Architecture:
 * - Uses RoomStore (Zustand) as the single source of truth
 * - Fetches from store first, then API if needed
 * - WebSocket updates are handled by useRoomWebSocket (mounted in App)
 * - Provides loading/error states
 * - Supports manual refresh
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
import { useRoomStore } from '../store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useRoom');

// =============================================================================
// Types
// =============================================================================

export interface UseRoomOptions {
  /**
   * Skip initial fetch if room is already in store
   * Default: false (always fetch fresh data)
   */
  skipFetchIfCached?: boolean;
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
  const { skipFetchIfCached = false } = options;

  // Get room from store
  const storeRoom = useRoomStore((s) => (roomId ? s.rooms.get(roomId) : undefined));
  const setRoom = useRoomStore((s) => s.setRoom);
  const isJoined = useRoomStore((s) => (roomId ? s.joinedRoomIds.has(roomId) : false));

  // Local state
  const [isLoading, setIsLoading] = useState(!storeRoom);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted for async safety
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Fetch room data from API
  const fetchRoom = useCallback(
    async (showRefreshState = false) => {
      if (!roomId) {
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

        // Update store - this is now the single source of truth
        setRoom({
          ...freshRoom,
          hasJoined: isJoined,
        });

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
    [roomId, setRoom, isJoined]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    hasFetchedRef.current = false;

    if (!roomId) {
      setIsLoading(false);
      return;
    }

    // Check store first
    if (storeRoom && skipFetchIfCached) {
      // Use stored data, don't fetch
      setIsLoading(false);
      log.debug('Using stored room', { roomId });
    } else if (storeRoom) {
      // Show stored data immediately, but fetch fresh
      setIsLoading(false);
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        log.debug('Have stored room, fetching fresh', { roomId });
        fetchRoom(false);
      }
    } else {
      // No stored data, must fetch
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchRoom(false);
      }
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [roomId, storeRoom, skipFetchIfCached, fetchRoom]);

  // Build room with hasJoined flag
  const room = storeRoom
    ? { ...storeRoom, hasJoined: isJoined }
    : null;

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
