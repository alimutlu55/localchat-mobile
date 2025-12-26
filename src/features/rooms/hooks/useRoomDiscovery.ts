/**
 * useRoomDiscovery Hook
 *
 * Handles discovery of nearby rooms with pagination support.
 * Extracted from RoomContext to separate concerns.
 *
 * Responsibilities:
 * - Fetch nearby rooms based on location
 * - Handle pagination (load more)
 * - Track loading states
 * - Update room cache
 *
 * Design decisions:
 * - Uses RoomCacheContext for data storage
 * - Maintains its own pagination state
 * - Returns derived "discovered rooms" list
 * - Supports category/radius filtering
 *
 * Usage:
 * ```typescript
 * const {
 *   rooms,
 *   isLoading,
 *   hasMore,
 *   refresh,
 *   loadMore,
 * } = useRoomDiscovery({ latitude, longitude });
 * ```
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Room, RoomCategory } from '../../../types';
import { roomService } from '../../../services';
import { useRoomCache } from '../context/RoomCacheContext';
import { ROOM_CONFIG } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomDiscovery');

// =============================================================================
// Types
// =============================================================================

export interface UseRoomDiscoveryOptions {
  /** User's current latitude */
  latitude: number;
  /** User's current longitude */
  longitude: number;
  /** Search radius in meters (default: from ROOM_CONFIG) */
  radius?: number;
  /** Filter by category */
  category?: RoomCategory;
  /** Page size (default: 20) */
  pageSize?: number;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

export interface UseRoomDiscoveryReturn {
  /** Discovered rooms */
  rooms: Room[];

  /** Whether initial fetch is in progress */
  isLoading: boolean;

  /** Whether more rooms are being loaded */
  isLoadingMore: boolean;

  /** Error message if any */
  error: string | null;

  /** Whether more rooms are available */
  hasMore: boolean;

  /** Current page number */
  currentPage: number;

  /** Total number of rooms available */
  totalCount: number;

  /** Refresh rooms (resets pagination) */
  refresh: () => Promise<void>;

  /** Load next page of rooms */
  loadMore: () => Promise<void>;

  /** Update a single room in the list */
  updateDiscoveredRoom: (roomId: string, updates: Partial<Room>) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRoomDiscovery(
  options: UseRoomDiscoveryOptions
): UseRoomDiscoveryReturn {
  const {
    latitude,
    longitude,
    radius = ROOM_CONFIG.DEFAULT_RADIUS,
    category,
    pageSize = 20,
    autoFetch = true,
  } = options;

  const { setRooms, updateRoom: updateCacheRoom, getRoom } = useRoomCache();

  // State
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Derived rooms list from cache
  const [rooms, setRooms_local] = useState<Room[]>([]);

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Update local rooms when discovered IDs change
  useEffect(() => {
    const roomList: Room[] = [];
    discoveredIds.forEach((id) => {
      const room = getRoom(id);
      if (room) {
        roomList.push(room);
      }
    });
    // Sort by distance (closest first)
    roomList.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    setRooms_local(roomList);
  }, [discoveredIds, getRoom]);

  /**
   * Fetch rooms (initial or refresh)
   */
  const fetchRooms = useCallback(async () => {
    log.debug('Fetching rooms', { latitude, longitude, radius, page: 0 });
    setIsLoading(true);
    setError(null);

    try {
      const result = await roomService.getNearbyRooms(
        latitude,
        longitude,
        0, // First page
        pageSize,
        radius,
        category
      );

      log.info('Fetched rooms', { count: result.rooms.length, hasNext: result.hasNext });

      // Update cache with all rooms
      setRooms(result.rooms);

      // Track discovered room IDs
      const newIds = new Set(result.rooms.map((r) => r.id));
      setDiscoveredIds(newIds);

      setHasMore(result.hasNext);
      setTotalCount(result.totalElements);
      setCurrentPage(1);
      hasFetchedRef.current = true;
    } catch (err) {
      log.error('Failed to fetch rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, radius, category, pageSize, setRooms]);

  /**
   * Load more rooms (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      log.debug('Skip loadMore', { isLoadingMore, hasMore });
      return;
    }

    log.debug('Loading more rooms', { page: currentPage });
    setIsLoadingMore(true);

    try {
      const result = await roomService.getNearbyRooms(
        latitude,
        longitude,
        currentPage,
        pageSize,
        radius,
        category
      );

      log.info('Loaded more rooms', { count: result.rooms.length, hasNext: result.hasNext });

      // Update cache
      setRooms(result.rooms);

      // Append to discovered IDs
      setDiscoveredIds((prev) => {
        const next = new Set(prev);
        result.rooms.forEach((r) => next.add(r.id));
        return next;
      });

      setHasMore(result.hasNext);
      setCurrentPage((prev) => prev + 1);
    } catch (err) {
      log.error('Failed to load more rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to load more rooms');
    } finally {
      setIsLoadingMore(false);
    }
  }, [latitude, longitude, radius, category, pageSize, currentPage, hasMore, isLoadingMore, setRooms]);

  /**
   * Refresh rooms (reset pagination)
   */
  const refresh = useCallback(async () => {
    setCurrentPage(0);
    setHasMore(true);
    await fetchRooms();
  }, [fetchRooms]);

  /**
   * Update a specific room in the discovered list
   */
  const updateDiscoveredRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      updateCacheRoom(roomId, updates);
      // Trigger re-render of local rooms
      setDiscoveredIds((prev) => new Set(prev));
    },
    [updateCacheRoom]
  );

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !hasFetchedRef.current && latitude !== 0 && longitude !== 0) {
      fetchRooms();
    }
  }, [autoFetch, latitude, longitude, fetchRooms]);

  return {
    rooms,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    currentPage,
    totalCount,
    refresh,
    loadMore,
    updateDiscoveredRoom,
  };
}

export default useRoomDiscovery;
