/**
 * useMapDiscovery Hook
 *
 * Specialized hook for the MapScreen that combines:
 * - Room discovery with pagination
 * - Map clustering integration
 * - Location tracking
 * - Viewport management
 *
 * This hook extracts map-specific discovery logic from MapScreen
 * while reusing the core useRoomDiscovery hook internally.
 *
 * Usage:
 * ```typescript
 * const {
 *   rooms,
 *   clusters,
 *   isLoading,
 *   userLocation,
 *   setUserLocation,
 *   refresh,
 * } = useMapDiscovery();
 * ```
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Room } from '../../../types';
import { roomService } from '../../../services';
import { useRoomStore } from '../../rooms/store';
import { ROOM_CONFIG } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';
import {
  createClusterIndex,
  getClustersForBounds,
  MapFeature,
} from '../../../utils/mapClustering';

const log = createLogger('MapDiscovery');

// =============================================================================
// Types
// =============================================================================

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  zoom: number;
}

export interface UseMapDiscoveryOptions {
  /** Initial search radius in meters */
  radius?: number;
  /** Page size for pagination */
  pageSize?: number;
}

export interface UseMapDiscoveryReturn {
  /** All discovered rooms */
  rooms: Room[];

  /** Active rooms only (non-expired, non-closed) */
  activeRooms: Room[];

  /** Clustered features for current viewport */
  features: MapFeature[];

  /** Whether initial fetch is loading */
  isLoading: boolean;

  /** Whether refresh is in progress */
  isRefreshing: boolean;

  /** Whether more rooms are loading */
  isLoadingMore: boolean;

  /** Error message if any */
  error: string | null;

  /** User's current location */
  userLocation: UserLocation | null;

  /** Set user location and trigger room fetch */
  setUserLocation: (location: UserLocation) => void;

  /** Current map viewport bounds */
  viewport: MapBounds;

  /** Update viewport (for clustering) */
  setViewport: (bounds: MapBounds) => void;

  /** Refresh rooms from API */
  refresh: () => Promise<void>;

  /** Load more rooms */
  loadMore: () => Promise<void>;

  /** Whether more rooms are available */
  hasMore: boolean;

  /** Total events in current view */
  totalInView: number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapDiscovery(
  options: UseMapDiscoveryOptions = {}
): UseMapDiscoveryReturn {
  const { radius = ROOM_CONFIG.DEFAULT_RADIUS, pageSize = 20 } = options;

  // Use RoomStore
  const storeSetRooms = useRoomStore((s) => s.setRooms);
  const storeGetRoom = useRoomStore((s) => s.getRoom);
  const storeJoinedIds = useRoomStore((s) => s.joinedRoomIds);
  const storeDiscoveredIds = useRoomStore((s) => s.discoveredRoomIds);
  const setDiscoveredRoomIds = useRoomStore((s) => s.setDiscoveredRoomIds);
  const addDiscoveredRoomIds = useRoomStore((s) => s.addDiscoveredRoomIds);

  // State
  const [userLocation, setUserLocationState] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewport, setViewport] = useState<MapBounds>({
    bounds: [-180, -85, 180, 85],
    zoom: 13,
  });

  // Refs
  const hasFetchedRef = useRef(false);

  // Derive rooms from discovered IDs in store
  const rooms = useMemo(() => {
    const roomList: Room[] = [];
    storeDiscoveredIds.forEach((id) => {
      const room = storeGetRoom(id);
      if (room) {
        roomList.push({
          ...room,
          hasJoined: storeJoinedIds.has(id),
        });
      }
    });
    return roomList;
  }, [storeDiscoveredIds, storeGetRoom, storeJoinedIds]);

  // Derived: active rooms (non-expired, non-closed)
  const activeRooms = useMemo(() => {
    const now = Date.now();
    return rooms.filter((room) => {
      const isExpired = room.expiresAt && room.expiresAt.getTime() < now;
      return !isExpired && room.status !== 'closed' && room.status !== 'expired';
    });
  }, [rooms]);

  // Create cluster index from active rooms
  const clusterIndex = useMemo(
    () => createClusterIndex(activeRooms),
    [activeRooms]
  );

  // Get features for current viewport
  const features = useMemo(() => {
    return getClustersForBounds(clusterIndex, viewport.bounds, viewport.zoom);
  }, [clusterIndex, viewport]);

  // Calculate total events in view
  const totalInView = useMemo(() => {
    return features.reduce((sum, feature) => {
      if ('cluster' in feature.properties && feature.properties.cluster) {
        return sum + (feature.properties.point_count || 0);
      }
      return sum + 1;
    }, 0);
  }, [features]);

  /**
   * Fetch rooms from API
   */
  const fetchRooms = useCallback(
    async (location: UserLocation, isRefresh = false) => {
      log.debug('Fetching rooms', { location, isRefresh });

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await roomService.getNearbyRooms(
          location.latitude,
          location.longitude,
          0,
          pageSize,
          radius
        );

        log.info('Fetched rooms', { count: result.rooms.length, hasNext: result.hasNext });

        // Update store
        storeSetRooms(result.rooms);

        // Update discovered IDs
        setDiscoveredRoomIds(new Set(result.rooms.map((r) => r.id)));

        setHasMore(result.hasNext);
        setCurrentPage(1);
        hasFetchedRef.current = true;
      } catch (err) {
        log.error('Failed to fetch rooms', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [radius, pageSize, storeSetRooms, setDiscoveredRoomIds]
  );

  /**
   * Load more rooms
   */
  const loadMore = useCallback(async () => {
    if (!userLocation || isLoadingMore || !hasMore) {
      return;
    }

    log.debug('Loading more rooms', { page: currentPage });
    setIsLoadingMore(true);

    try {
      const result = await roomService.getNearbyRooms(
        userLocation.latitude,
        userLocation.longitude,
        currentPage,
        pageSize,
        radius
      );

      log.info('Loaded more rooms', { count: result.rooms.length });

      // Update store
      storeSetRooms(result.rooms);

      // Append to discovered IDs
      addDiscoveredRoomIds(result.rooms.map((r) => r.id));

      setHasMore(result.hasNext);
      setCurrentPage((p) => p + 1);
    } catch (err) {
      log.error('Failed to load more rooms', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [userLocation, currentPage, hasMore, isLoadingMore, radius, pageSize, storeSetRooms, addDiscoveredRoomIds]);

  /**
   * Set user location and trigger fetch
   */
  const setUserLocation = useCallback(
    (location: UserLocation) => {
      setUserLocationState(location);

      // Fetch rooms if this is the first location update
      if (!hasFetchedRef.current) {
        fetchRooms(location);
      }
    },
    [fetchRooms]
  );

  /**
   * Refresh rooms
   */
  const refresh = useCallback(async () => {
    if (!userLocation) {
      log.warn('Cannot refresh - no user location');
      return;
    }

    setCurrentPage(0);
    setHasMore(true);
    await fetchRooms(userLocation, true);
  }, [userLocation, fetchRooms]);

  return {
    rooms,
    activeRooms,
    features,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    userLocation,
    setUserLocation,
    viewport,
    setViewport,
    refresh,
    loadMore,
    hasMore,
    totalInView,
  };
}

export default useMapDiscovery;
