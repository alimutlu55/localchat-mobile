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
import { useRoomStore } from '../store';
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

  // Use RoomStore
  const storeSetRooms = useRoomStore((s) => s.setRooms);
  const storeRooms = useRoomStore((s) => s.rooms); // Subscribe to rooms Map for reactivity
  const storeJoinedIds = useRoomStore((s) => s.joinedRoomIds);
  const setDiscoveredRoomIds = useRoomStore((s) => s.setDiscoveredRoomIds);
  const addDiscoveredRoomIds = useRoomStore((s) => s.addDiscoveredRoomIds);
  const storeDiscoveredIds = useRoomStore((s) => s.discoveredRoomIds);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Track if initial fetch has been done
  const hasFetchedRef = useRef(false);

  // Compute rooms from store
  // Note: We subscribe to storeRooms (the Map) so this recomputes when rooms are added/removed
  const rooms = useMemo(() => {
    const roomList: Room[] = [];
    storeDiscoveredIds.forEach((id) => {
      const room = storeRooms.get(id);
      if (room) {
        roomList.push({
          ...room,
          hasJoined: storeJoinedIds.has(id),
        });
      }
    });
    // Sort by distance (closest first)
    roomList.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return roomList;
  }, [storeDiscoveredIds, storeRooms, storeJoinedIds]);

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

      // Update store with all rooms
      storeSetRooms(result.rooms);

      // Track discovered room IDs
      setDiscoveredRoomIds(new Set(result.rooms.map((r) => r.id)));

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
  }, [latitude, longitude, radius, category, pageSize, storeSetRooms, setDiscoveredRoomIds]);

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

      // Update store
      storeSetRooms(result.rooms);

      // Append to discovered IDs
      addDiscoveredRoomIds(result.rooms.map((r) => r.id));

      setHasMore(result.hasNext);
      setCurrentPage((prev) => prev + 1);
    } catch (err) {
      log.error('Failed to load more rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to load more rooms');
    } finally {
      setIsLoadingMore(false);
    }
  }, [latitude, longitude, radius, category, pageSize, currentPage, hasMore, isLoadingMore, storeSetRooms, addDiscoveredRoomIds]);

  /**
   * Refresh rooms (reset pagination)
   */
  const refresh = useCallback(async () => {
    setCurrentPage(0);
    setHasMore(true);
    await fetchRooms();
  }, [fetchRooms]);

  // Get store updateRoom for updateDiscoveredRoom
  const storeUpdateRoom = useRoomStore((s) => s.updateRoom);

  /**
   * Update a specific room in the discovered list
   */
  const updateDiscoveredRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      storeUpdateRoom(roomId, updates);
    },
    [storeUpdateRoom]
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
