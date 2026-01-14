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
import { eventBus } from '../../../core/events';
import { Room, RoomCategory } from '../../../types';
import { roomService } from '../../../services';
import { useRoomStore } from '../store';
import { ROOM_CONFIG } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';
import { calculateDistance } from '../../../utils/geo';

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
  refresh: (throwOnError?: boolean) => Promise<void>;

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
  const storeHiddenIds = useRoomStore((s) => s.hiddenRoomIds); // Subscribe to hidden rooms (banned users)
  const setDiscoveredRoomIds = useRoomStore((s) => s.setDiscoveredRoomIds);
  const addDiscoveredRoomIds = useRoomStore((s) => s.addDiscoveredRoomIds);
  const storeDiscoveredIds = useRoomStore((s) => s.discoveredRoomIds);
  const storePendingIds = useRoomStore((s) => s.pendingRoomIds);

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
  // Also filters out hidden rooms (e.g., rooms the user is banned from)
  const rooms = useMemo(() => {

    const roomList: Room[] = [];
    const seenIds = new Set<string>();

    // Combine discovered rooms and pending rooms (e.g., user's newly created rooms)
    // This ensures local rooms don't disappear if buried on page 2 of refresh
    const allRoomIds = new Set([...storeDiscoveredIds, ...storePendingIds]);

    allRoomIds.forEach((id) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);

      // Skip hidden rooms (banned users shouldn't see these rooms)
      if (storeHiddenIds.has(id)) {
        return;
      }
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
  }, [storeDiscoveredIds, storePendingIds, storeRooms, storeJoinedIds, storeHiddenIds]);

  /**
   * Fetch rooms (initial or refresh)
   */
  const fetchRooms = useCallback(async (throwOnError = false) => {
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


      // Update store with all rooms
      storeSetRooms(result.rooms);

      // Track discovered room IDs
      setDiscoveredRoomIds(new Set(result.rooms.map((r) => r.id)));

      setHasMore(result.hasNext);
      setTotalCount(result.totalElements);
      setCurrentPage(1);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
      if (throwOnError) {
        throw err;
      }
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, radius, category, pageSize, storeSetRooms, setDiscoveredRoomIds]);

  /**
   * Load more rooms (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

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


      // Update store
      storeSetRooms(result.rooms);

      // Append to discovered IDs
      addDiscoveredRoomIds(result.rooms.map((r) => r.id));

      setHasMore(result.hasNext);
      setCurrentPage((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more rooms');
    } finally {
      setIsLoadingMore(false);
    }
  }, [latitude, longitude, radius, category, pageSize, currentPage, hasMore, isLoadingMore, storeSetRooms, addDiscoveredRoomIds]);

  /**
   * Refresh rooms (reset pagination)
   */
  const refresh = useCallback(async (throwOnError = false) => {
    setCurrentPage(0);
    setHasMore(true);
    await fetchRooms(throwOnError);
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

  // Auto-fetch on mount or when filters change
  useEffect(() => {
    // Enable auto-fetch even if location is (0,0) IF we are explicitly told to auto-fetch
    // and it's not the initial state. 
    // In many cases (0,0) is used as a fallback center when location is denied.
    if (autoFetch) {
      fetchRooms(false);
    }
  }, [autoFetch, latitude, longitude, radius, category, fetchRooms]);

  // Real-time updates for discovery list
  useEffect(() => {

    // Handle new rooms created anywhere
    const unsubCreated = eventBus.on('room.created', (payload) => {

      if (payload.room) {
        // Correctly handle nested location in real-time payload
        const roomRadius = payload.room.radiusMeters || payload.room.radius || 0;
        const roomLat = payload.room.location?.latitude ?? payload.room.latitude;
        const roomLng = payload.room.location?.longitude ?? payload.room.longitude;


        // Check visibility: Global rooms (radius = 0) are always visible
        // Nearby rooms require user to be within the room's radius
        if (roomRadius > 0 && roomLat !== undefined && roomLng !== undefined) {
          const distanceToRoom = calculateDistance(latitude, longitude, roomLat, roomLng);

          if (distanceToRoom > roomRadius) {
            return;
          }
        }


        const room = {
          ...payload.room,
          expiresAt: payload.room.expiresAt ? new Date(payload.room.expiresAt) : new Date(),
          createdAt: payload.room.createdAt ? new Date(payload.room.createdAt) : new Date(),
          radius: roomRadius, // Ensure radius is correctly set
        };
        storeSetRooms([room]);
        // 2. Add to discovery list (will be sorted by useMemo)
        addDiscoveredRoomIds([payload.roomId]);
      }
    });

    // Handle rooms closed/removed
    const unsubClosed = eventBus.on('room.closed', (payload) => {
      log.debug('Real-time: Removing closed room from discovery', { roomId: payload.roomId });
      const currentIds = new Set(useRoomStore.getState().discoveredRoomIds);
      if (currentIds.has(payload.roomId)) {
        currentIds.delete(payload.roomId);
        setDiscoveredRoomIds(currentIds);
      }
    });

    return () => {
      unsubCreated();
      unsubClosed();
    };
  }, [latitude, longitude, storeSetRooms, addDiscoveredRoomIds, setDiscoveredRoomIds, storeUpdateRoom]);

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
