/**
 * useViewportRoomDiscovery Hook
 *
 * Handles viewport-based room discovery for the map.
 * Fetches rooms based on visible map bounds, not just user location.
 *
 * Key Features:
 * - Fetches rooms within current map viewport
 * - Re-fetches when map moves significantly (debounced)
 * - Loads ALL rooms in viewport (up to configurable limit)
 * - Caches rooms to avoid duplicate fetches
 * - Provides accurate "events in view" count
 *
 * Design Decisions:
 * - Uses bounding box query instead of radius-based
 * - Debounces fetches to avoid API spam during pan/zoom
 * - Accumulates rooms from different viewports in cache
 * - Only fetches when map has moved significantly (threshold-based)
 *
 * @example
 * ```typescript
 * const {
 *   rooms,
 *   isLoading,
 *   totalInViewport,
 *   refetch,
 * } = useViewportRoomDiscovery({
 *   bounds,
 *   zoom,
 *   isMapReady,
 *   isMapMoving,
 * });
 * ```
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Room, RoomCategory } from '../../../types';
import { roomService } from '../../../services';
import { useRoomStore } from '../../rooms/store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ViewportDiscovery');

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for viewport-based discovery
 */
const VIEWPORT_CONFIG = {
  /** Maximum rooms to load per viewport (prevents memory issues) */
  MAX_ROOMS_PER_FETCH: 500,

  /** Page size for API requests */
  PAGE_SIZE: 100,

  /** Minimum movement threshold to trigger re-fetch (in degrees, ~5km) */
  MOVE_THRESHOLD: 0.05,

  /** Debounce delay for fetch after map movement (ms) - increased to allow MapLibre to stabilize */
  DEBOUNCE_DELAY: 500,

  /** Minimum zoom level to fetch rooms (prevent world-view fetch) */
  MIN_FETCH_ZOOM: 3,
};

// =============================================================================
// Types
// =============================================================================

export interface UseViewportRoomDiscoveryOptions {
  /** Current map bounds [west, south, east, north] */
  bounds: [number, number, number, number];

  /** Current zoom level */
  zoom: number;

  /** Whether map has finished loading */
  isMapReady: boolean;

  /** Whether map is currently moving */
  isMapMoving: boolean;

  /** Optional category filter */
  category?: RoomCategory;

  /** Whether to enable auto-fetch on bounds change (default: true) */
  autoFetch?: boolean;
}

export interface UseViewportRoomDiscoveryReturn {
  /** All rooms loaded for current and previous viewports */
  rooms: Room[];

  /** Whether fetch is in progress */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Total rooms available in current viewport */
  totalInViewport: number;

  /** Whether all rooms in viewport have been loaded */
  isComplete: boolean;

  /** Manually trigger a refresh */
  refetch: () => Promise<void>;

  /** Clear all cached rooms */
  clearCache: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate center of bounds
 */
function getBoundsCenter(bounds: [number, number, number, number]): { lat: number; lng: number } {
  const [west, south, east, north] = bounds;
  return {
    lat: (north + south) / 2,
    lng: (east + west) / 2,
  };
}

/**
 * Check if map has moved significantly from last fetch
 */
function hasMovedSignificantly(
  currentBounds: [number, number, number, number],
  lastBounds: [number, number, number, number] | null,
  threshold: number
): boolean {
  if (!lastBounds) return true;

  const current = getBoundsCenter(currentBounds);
  const last = getBoundsCenter(lastBounds);

  const latDiff = Math.abs(current.lat - last.lat);
  const lngDiff = Math.abs(current.lng - last.lng);

  return latDiff > threshold || lngDiff > threshold;
}

/**
 * Check if a room is within bounds
 */
function isRoomInBounds(room: Room, bounds: [number, number, number, number]): boolean {
  if (room.latitude == null || room.longitude == null) {
    return false;
  }
  const [west, south, east, north] = bounds;
  return (
    room.latitude >= south &&
    room.latitude <= north &&
    room.longitude >= west &&
    room.longitude <= east
  );
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useViewportRoomDiscovery(
  options: UseViewportRoomDiscoveryOptions
): UseViewportRoomDiscoveryReturn {
  const {
    bounds,
    zoom,
    isMapReady,
    isMapMoving,
    category,
    autoFetch = true,
  } = options;

  // Room store integration
  const storeSetRooms = useRoomStore((s) => s.setRooms);
  const storeRooms = useRoomStore((s) => s.rooms);
  const storeJoinedIds = useRoomStore((s) => s.joinedRoomIds);

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalInViewport, setTotalInViewport] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Refs for debouncing and tracking
  const lastFetchBoundsRef = useRef<[number, number, number, number] | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  /**
   * Fetch all rooms within bounds (with pagination)
   */
  const fetchRoomsInBounds = useCallback(async (
    fetchBounds: [number, number, number, number]
  ) => {
    if (isFetchingRef.current) {
      log.debug('Fetch already in progress, skipping');
      return;
    }

    const [west, south, east, north] = fetchBounds;
    const center = getBoundsCenter(fetchBounds);

    // Calculate radius to cover the viewport (approximate)
    const latSpan = north - south;
    const lngSpan = east - west;
    const radiusKm = Math.max(latSpan, lngSpan) * 111 / 2; // 111km per degree
    const radiusMeters = Math.min(radiusKm * 1000, 50000); // Cap at 50km

    log.debug('Fetching rooms in viewport', {
      center,
      radiusMeters,
      bounds: fetchBounds,
    });

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const allRooms: Room[] = [];
      let page = 0;
      let hasMore = true;

      // Fetch all pages up to MAX_ROOMS_PER_FETCH
      while (hasMore && allRooms.length < VIEWPORT_CONFIG.MAX_ROOMS_PER_FETCH) {
        const result = await roomService.getNearbyRooms(
          center.lat,
          center.lng,
          page,
          VIEWPORT_CONFIG.PAGE_SIZE,
          radiusMeters,
          category
        );

        allRooms.push(...result.rooms);
        hasMore = result.hasNext;
        page++;

        log.debug('Fetched page', {
          page: page - 1,
          roomsInPage: result.rooms.length,
          totalSoFar: allRooms.length,
          hasMore,
        });

        // Safety limit
        if (page > 10) {
          log.warn('Hit page limit, stopping pagination');
          break;
        }
      }

      // Update store with all fetched rooms
      storeSetRooms(allRooms);

      // Update state
      setTotalInViewport(allRooms.length);
      setIsComplete(!hasMore || allRooms.length >= VIEWPORT_CONFIG.MAX_ROOMS_PER_FETCH);
      lastFetchBoundsRef.current = fetchBounds;

      log.info('Viewport fetch complete', {
        totalRooms: allRooms.length,
        isComplete: !hasMore,
      });

    } catch (err) {
      log.error('Failed to fetch rooms in viewport', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [category, storeSetRooms]);

  /**
   * Check if bounds are valid (not the initial world view)
   */
  const isValidBounds = useCallback((b: [number, number, number, number]): boolean => {
    const [west, south, east, north] = b;
    // World view bounds are approximately [-180, -85, 180, 85]
    // Consider bounds invalid if they span more than 90 degrees
    const latSpan = north - south;
    const lngSpan = east - west;
    return latSpan < 90 && lngSpan < 180;
  }, []);

  /**
   * Debounced fetch triggered by bounds change
   */
  const debouncedFetch = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch if map is not ready or still moving
    if (!isMapReady || isMapMoving) {
      return;
    }

    // Don't fetch if bounds are invalid (world view)
    if (!isValidBounds(bounds)) {
      log.debug('Invalid bounds (world view), skipping fetch', { bounds });
      return;
    }

    // Don't fetch if zoomed out too far
    if (zoom < VIEWPORT_CONFIG.MIN_FETCH_ZOOM) {
      log.debug('Zoom too low, skipping fetch', { zoom });
      return;
    }

    // Check if map has moved significantly
    if (!hasMovedSignificantly(bounds, lastFetchBoundsRef.current, VIEWPORT_CONFIG.MOVE_THRESHOLD)) {
      log.debug('Map hasnt moved significantly, skipping fetch');
      return;
    }

    // Schedule fetch with longer delay to allow map to stabilize
    debounceTimerRef.current = setTimeout(() => {
      fetchRoomsInBounds(bounds);
    }, VIEWPORT_CONFIG.DEBOUNCE_DELAY);

  }, [bounds, zoom, isMapReady, isMapMoving, isValidBounds, fetchRoomsInBounds]);

  /**
   * Manual refresh
   */
  const refetch = useCallback(async () => {
    lastFetchBoundsRef.current = null; // Force re-fetch
    await fetchRoomsInBounds(bounds);
  }, [bounds, fetchRoomsInBounds]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    lastFetchBoundsRef.current = null;
    setTotalInViewport(0);
    setIsComplete(false);
  }, []);

  // Auto-fetch on bounds/zoom change
  useEffect(() => {
    if (autoFetch) {
      debouncedFetch();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoFetch, debouncedFetch]);

  // Compute rooms from store, filtered to current viewport
  const rooms = useMemo(() => {
    const now = Date.now();
    const roomList: Room[] = [];

    storeRooms.forEach((room) => {
      // Filter: active, not expired, in bounds
      const isExpired = room.expiresAt && room.expiresAt.getTime() < now;
      if (isExpired || room.status === 'closed' || room.status === 'expired') {
        return;
      }

      // Check if in current viewport (with some padding)
      if (isRoomInBounds(room, bounds)) {
        roomList.push({
          ...room,
          hasJoined: storeJoinedIds.has(room.id),
        });
      }
    });

    // Sort by distance from center
    const center = getBoundsCenter(bounds);
    roomList.sort((a, b) => {
      const distA = Math.hypot((a.latitude ?? 0) - center.lat, (a.longitude ?? 0) - center.lng);
      const distB = Math.hypot((b.latitude ?? 0) - center.lat, (b.longitude ?? 0) - center.lng);
      return distA - distB;
    });

    return roomList;
  }, [storeRooms, storeJoinedIds, bounds]);

  return {
    rooms,
    isLoading,
    error,
    totalInViewport: rooms.length, // Use actual filtered count
    isComplete,
    refetch,
    clearCache,
  };
}

export default useViewportRoomDiscovery;
