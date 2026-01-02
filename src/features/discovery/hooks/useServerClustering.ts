/**
 * useServerClustering Hook
 *
 * Fetches pre-clustered room data from the server.
 * All clustering is done server-side using PostGIS ST_ClusterDBSCAN.
 *
 * Behavior:
 * - Fetches clusters on every significant viewport change
 * - Dynamic debounce: faster at high zoom, slower at low zoom
 * - Always enabled - no client-side clustering fallback
 * - Backend handles eps calculation based on zoom level
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { roomService } from '../../../services';
import { ClusterResponse, ClusterFeature, ClusterMetadata } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { eventBus } from '../../../core/events';
import { useRoomStore } from '../../rooms/store';

const log = createLogger('ServerClustering');

// =============================================================================
// Types
// =============================================================================

export interface UseServerClusteringOptions {
  /** Current map bounds [west, south, east, north] */
  bounds: [number, number, number, number];

  /** Current zoom level */
  zoom: number;

  /** Whether to enable server clustering */
  enabled: boolean;

  /** Whether map is ready */
  isMapReady: boolean;

  /** Optional category filter */
  category?: string;

  /** User's current location for visibility filtering (nearby rooms only visible within radius) */
  userLocation?: { latitude: number; longitude: number } | null;
}

export interface UseServerClusteringReturn {
  /** GeoJSON features from server (clusters + individual rooms) */
  features: ClusterFeature[];

  /** Setter for optimistic updates */
  setFeatures: React.Dispatch<React.SetStateAction<ClusterFeature[]>>;

  /** Whether fetch is in progress */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Metadata about the clustering response */
  metadata: ClusterMetadata | null;

  /** Manually trigger a refresh */
  refetch: (throwOnError?: boolean) => Promise<void>;

  /** Prefetch data for a target location - shows markers 300ms before animation ends */
  prefetchForLocation: (centerLng: number, centerLat: number, targetZoom: number, animationDuration: number) => void;

  /** Prefetch world-level data for zoom-out to world view */
  prefetchForWorldView: (animationDuration: number) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate dynamic debounce delay based on zoom level.
 * Faster response at all levels for better interactivity.
 */
function getDebounceDelay(zoom: number): number {
  if (zoom <= 5) return 200;  // Reduced from 400
  if (zoom <= 12) return 150; // Reduced from 250
  return 100;                 // Reduced from 150
}

/**
 * Filter out rooms that should be hidden (e.g. banned)
 */
function filterExcludedRooms(features: ClusterFeature[]): ClusterFeature[] {
  const state = useRoomStore.getState();
  const hiddenRoomIds = state.hiddenRoomIds;
  if (hiddenRoomIds.size === 0) return features;

  return features.filter(f => {
    if (f.properties.cluster) return true;
    return !hiddenRoomIds.has(f.properties.roomId!);
  });
}

/**
 * Merge in pending (optimistic) rooms that aren't in the server response yet
 */
function mergePendingRooms(features: ClusterFeature[]): ClusterFeature[] {
  const state = useRoomStore.getState();
  const { pendingRoomIds, rooms } = state;
  if (pendingRoomIds.size === 0) return features;

  const existingRoomIds = new Set(
    features.filter(f => !f.properties.cluster).map(f => f.properties.roomId)
  );

  const clusters = features.filter(f => f.properties.cluster);

  const pendingFeatures: ClusterFeature[] = [];

  pendingRoomIds.forEach(roomId => {
    // 1. Skip if already exists as an individual room (server source of truth)
    if (existingRoomIds.has(roomId)) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // 2. Skip if inside a cluster's expansion bounds
    // This prevents "double markers" where an individual pin shows on top of a cluster
    const isInsideAnyCluster = clusters.some(c => {
      const bounds = c.properties.expansionBounds;
      if (!bounds) return false;
      return isPointInBounds(room.latitude!, room.longitude!, bounds);
    });

    if (isInsideAnyCluster) {
      log.debug('Pending room hidden by cluster coverage', { roomId });
      return;
    }

    pendingFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [room.longitude ?? 0, room.latitude ?? 0],
      },
      properties: {
        cluster: false,
        roomId: room.id,
        title: room.title,
        category: room.category,
        participantCount: room.participantCount,
        status: room.status,
        isCreator: room.isCreator,
        hasJoined: room.hasJoined,
        expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
      },
    });
  });

  return [...features, ...pendingFeatures];
}

/**
 * Check if a point is within given bounds
 */
function isPointInBounds(lat: number, lng: number, bounds: [number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useServerClustering(options: UseServerClusteringOptions): UseServerClusteringReturn {
  const { bounds, zoom, enabled, isMapReady, category, userLocation } = options;

  // State
  const [rawFeatures, setRawFeatures] = useState<ClusterFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ClusterMetadata | null>(null);

  // Reactive store state
  const joinedRoomIds = useRoomStore((state) => state.joinedRoomIds);
  const createdRoomIds = useRoomStore((state) => state.createdRoomIds);
  const hiddenRoomIds = useRoomStore((state) => state.hiddenRoomIds);
  const pendingRoomIds = useRoomStore((state) => state.pendingRoomIds);
  const storeRooms = useRoomStore((state) => state.rooms);

  /**
   * Reactively compute display features based on raw server data and global store state.
   * This ensures the map is always in sync with joining/leaving/creating/hiding actions.
   */
  const features = useMemo(() => {
    // 1. Hydrate raw features with latest local state
    const hydrated = rawFeatures.map(f => {
      if (f.properties.cluster || !f.properties.roomId) return f;
      const roomId = f.properties.roomId;
      const storeRoom = storeRooms.get(roomId);

      return {
        ...f,
        properties: {
          ...f.properties,
          hasJoined: joinedRoomIds.has(roomId),
          isCreator: createdRoomIds.has(roomId) || storeRoom?.isCreator || false,
          participantCount: storeRoom?.participantCount ?? f.properties.participantCount ?? 0,
          status: storeRoom?.status ?? f.properties.status,
        }
      };
    });

    // 2. Merge in pending (optimistic) rooms
    const merged = mergePendingRooms(hydrated);

    // 3. Filter out hidden/banned rooms
    return filterExcludedRooms(merged);
  }, [rawFeatures, joinedRoomIds, createdRoomIds, hiddenRoomIds, pendingRoomIds, storeRooms]);

  // Refs for debouncing and tracking
  const lastFetchBoundsRef = useRef<[number, number, number, number] | null>(null);
  const lastFetchZoomRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const forceNextFetchRef = useRef(false);

  // Prefetch timing refs - for showing markers 300ms before animation ends
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPrefetchRef = useRef<ClusterResponse | null>(null);
  // Flag set IMMEDIATELY when prefetch starts (before async), to block competing fetches
  const isPrefetchingRef = useRef(false);

  /**
   * Reconciles optimistic (pending) rooms with a fresh server response.
   * Removes rooms from the pending set if they are now CANONICALLY represented 
   * by the server (either as an individual marker or part of a cluster).
   */
  const reconcilePendingRooms = useCallback((features: ClusterFeature[]) => {
    const state = useRoomStore.getState();
    if (state.pendingRoomIds.size === 0) return;

    const individualRoomIds = new Set(
      features.filter(f => !f.properties.cluster).map(f => f.properties.roomId)
    );
    const clusters = features.filter(f => f.properties.cluster);

    state.pendingRoomIds.forEach(roomId => {
      const room = state.rooms.get(roomId);
      if (!room) return;

      // 1. Remove if confirmed as individual room
      if (individualRoomIds.has(roomId)) {
        log.debug('Removing pending room confirmed as individual by server', { roomId });
        state.removePendingRoom(roomId);
        return;
      }

      // 2. Remove if inside a cluster (server acknowledges it's part of a cluster)
      const isInsideAnyCluster = clusters.some(c => {
        const b = c.properties.expansionBounds;
        return b && isPointInBounds(room.latitude!, room.longitude!, b);
      });

      if (isInsideAnyCluster) {
        log.debug('Removing pending room confirmed as clustered by server', { roomId });
        state.removePendingRoom(roomId);
      }
    });
  }, []);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Fetch clusters from server
   * Expands bounds by 50% to pre-fetch data outside visible area
   */
  const fetchClusters = useCallback(
    async (fetchBounds: [number, number, number, number] | null, fetchZoom: number, showLoading = false, throwOnError = false) => {
      if (isFetchingRef.current) {
        log.info('Fetch already in progress, skipping');
        console.log('[useServerClustering] Fetch already in progress, skipping');
        return;
      }

      if (!fetchBounds) {
        log.warn('Fetch called with null bounds, skipping');
        console.log('[useServerClustering] Fetch called with null bounds, skipping');
        return;
      }

      // Expand bounds by 50% on each side to pre-fetch surrounding area
      // This prevents flickering when panning as data is already loaded
      const [minLng, minLat, maxLng, maxLat] = fetchBounds;
      const lngSpan = maxLng - minLng;
      const latSpan = maxLat - minLat;
      const expandedBounds: [number, number, number, number] = [
        Math.max(-180, minLng - lngSpan * 0.5),
        Math.max(-85, minLat - latSpan * 0.5),
        Math.min(180, maxLng + lngSpan * 0.5),
        Math.min(85, maxLat + latSpan * 0.5),
      ];

      log.debug('Fetching server clusters', {
        bounds: fetchBounds,
        expandedBounds,
        zoom: fetchZoom,
        category,
        showLoading,
      });

      console.log(`[useServerClustering] fetchClusters start: showLoading=${showLoading}, bounds=${JSON.stringify(fetchBounds)}`);
      isFetchingRef.current = true;
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response: ClusterResponse = await roomService.getClusters(
          expandedBounds[0],
          expandedBounds[1],
          expandedBounds[2],
          expandedBounds[3],
          Math.floor(fetchZoom), // Send integer zoom to server
          category,
          userLocation?.latitude,
          userLocation?.longitude
        );

        if (!mountedRef.current) return;

        if (!mountedRef.current) return;

        setRawFeatures(response.features);
        setMetadata(response.metadata);
        lastFetchBoundsRef.current = fetchBounds;
        lastFetchZoomRef.current = fetchZoom;

        log.info('Server clusters fetched', {
          featureCount: response.features.length,
          clusterCount: response.metadata.clusterCount,
          individualCount: response.metadata.individualCount,
          processingTimeMs: response.metadata.processingTimeMs,
        });

        // Clear pending rooms that are now EXPLICITLY accounted for by the server
        reconcilePendingRooms(response.features);
      } catch (err) {
        log.error('Failed to fetch server clusters', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch clusters');
        }
        if (throwOnError) {
          throw err;
        }
      } finally {
        console.log('[useServerClustering] fetchClusters finally block');
        if (mountedRef.current) {
          setIsLoading(false);
        }
        isFetchingRef.current = false;
      }
    },
    [category, userLocation]
  );

  /**
   * Manual refresh
   */
  const refetch = useCallback(async (throwOnError = false) => {
    log.debug('Manual refetch triggered');
    // Clear cached state to force next useEffect to fetch
    lastFetchBoundsRef.current = null;
    lastFetchZoomRef.current = null;
    forceNextFetchRef.current = true;
    // Immediately fetch with current bounds/zoom, showing loading state for user feedback
    await fetchClusters(bounds, zoom, true, throwOnError);
  }, [bounds, zoom, fetchClusters]);

  /**
   * Prefetch data for a target location during zoom animation.
   * Uses proper viewport calculation based on target zoom level.
   * 
   * This fetches data and schedules it to appear 300ms before animation ends,
   * creating a seamless transition where markers appear while camera is still moving.
   */
  const prefetchForLocation = useCallback(
    async (centerLng: number, centerLat: number, targetZoom: number, animationDuration: number) => {
      // Set flag IMMEDIATELY to block competing fetches (before async)
      isPrefetchingRef.current = true;

      // Clear any pending prefetch timer
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }

      // Calculate viewport size at target zoom using map projection
      // At zoom 0, world is ~360 degrees. Each zoom level halves the span.
      // Add some padding (1.5x) to ensure we cover the visible area
      const lngSpan = (360 / Math.pow(2, targetZoom)) * 1.5;
      const latSpan = (180 / Math.pow(2, targetZoom)) * 1.5;

      const targetBounds: [number, number, number, number] = [
        Math.max(-180, centerLng - lngSpan / 2),
        Math.max(-85, centerLat - latSpan / 2),
        Math.min(180, centerLng + lngSpan / 2),
        Math.min(85, centerLat + latSpan / 2),
      ];

      // Calculate when to show markers: 1 second before animation ends
      const showMarkersDelay = Math.max(0, animationDuration - 1000);

      log.info('Prefetching for target location', {
        center: [centerLng, centerLat],
        targetZoom,
        targetBounds,
        animationDuration,
        showMarkersDelay
      });

      // Expand bounds for pre-fetching like normal fetch does
      const [minLng, minLat, maxLng, maxLat] = targetBounds;
      const lngSpanExpand = maxLng - minLng;
      const latSpanExpand = maxLat - minLat;
      const expandedBounds: [number, number, number, number] = [
        Math.max(-180, minLng - lngSpanExpand * 0.5),
        Math.max(-85, minLat - latSpanExpand * 0.5),
        Math.min(180, maxLng + lngSpanExpand * 0.5),
        Math.min(85, maxLat + latSpanExpand * 0.5),
      ];

      try {
        // Start fetch immediately
        const response: ClusterResponse = await roomService.getClusters(
          expandedBounds[0],
          expandedBounds[1],
          expandedBounds[2],
          expandedBounds[3],
          Math.floor(targetZoom),
          category,
          userLocation?.latitude,
          userLocation?.longitude
        );

        if (!mountedRef.current) return;

        log.info('Prefetch completed', {
          featureCount: response.features.length,
          willShowIn: showMarkersDelay - (Date.now() % 10000) // rough timing
        });

        // Optimistically set last fetch info to avoid redundant fetches from proactive zoom updates
        lastFetchBoundsRef.current = targetBounds;
        lastFetchZoomRef.current = targetZoom;

        // Calculate remaining delay (request took some time)
        const requestDuration = 0; // We don't track exact timing, but request is fast
        const remainingDelay = Math.max(0, showMarkersDelay - requestDuration);

        if (remainingDelay > 50) {
          // Schedule the feature update for later
          pendingPrefetchRef.current = response;
          prefetchTimerRef.current = setTimeout(() => {
            if (mountedRef.current && pendingPrefetchRef.current) {
              log.info('Showing prefetched markers (300ms before animation ends)');
              setRawFeatures(pendingPrefetchRef.current.features);
              setMetadata(pendingPrefetchRef.current.metadata);
              lastFetchBoundsRef.current = targetBounds;
              lastFetchZoomRef.current = targetZoom;

              // Clear pending rooms that are now EXPLICITLY accounted for by the prefetch
              reconcilePendingRooms(pendingPrefetchRef.current.features);

              pendingPrefetchRef.current = null;
            }
            // Clear refs after timer fires
            prefetchTimerRef.current = null;
            isPrefetchingRef.current = false;
          }, remainingDelay);
        } else {
          // Animation is almost done, show immediately
          setRawFeatures(response.features);
          setMetadata(response.metadata);
          lastFetchBoundsRef.current = targetBounds;
          lastFetchZoomRef.current = targetZoom;

          // Clear pending rooms that are now EXPLICITLY accounted for by the prefetch
          reconcilePendingRooms(response.features);
        }
      } catch (err) {
        log.error('Prefetch failed', err);
        // Silently fail - normal fetch will happen when camera settles
      } finally {
        // Clear the prefetching flag after timer fires or immediately if no timer
        // Note: if timer is set, flag clearing is handled after timer callback
        if (!prefetchTimerRef.current) {
          isPrefetchingRef.current = false;
        }
      }
    },
    [category]
  );

  /**
   * Prefetch world-level data for zoom-out to world view.
   * Always targets zoom 1 at center (0, 20).
   */
  const prefetchForWorldView = useCallback(
    async (animationDuration: number) => {
      // Set flag IMMEDIATELY to block competing fetches (before async)
      isPrefetchingRef.current = true;

      const targetZoom = 1;
      const targetBounds: [number, number, number, number] = [-180, -85, 180, 85];
      const showMarkersDelay = Math.max(0, animationDuration - 1000);

      // Clear any pending prefetch timer
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }

      log.info('Prefetching for world view', { animationDuration, showMarkersDelay });

      try {
        const response: ClusterResponse = await roomService.getClusters(
          targetBounds[0], targetBounds[1], targetBounds[2], targetBounds[3],
          targetZoom, category,
          userLocation?.latitude,
          userLocation?.longitude
        );

        if (!mountedRef.current) return;

        log.info('World view prefetch completed', { featureCount: response.features.length });

        // Optimistically set last fetch info to avoid redundant fetches from proactive zoom updates
        lastFetchBoundsRef.current = targetBounds;
        lastFetchZoomRef.current = targetZoom;

        if (showMarkersDelay > 50) {
          pendingPrefetchRef.current = response;
          prefetchTimerRef.current = setTimeout(() => {
            if (mountedRef.current && pendingPrefetchRef.current) {
              log.info('Showing prefetched world markers');
              setRawFeatures(pendingPrefetchRef.current.features);
              setMetadata(pendingPrefetchRef.current.metadata);
              lastFetchBoundsRef.current = targetBounds;
              lastFetchZoomRef.current = targetZoom;

              // Clear pending rooms (world view covers everything)
              reconcilePendingRooms(pendingPrefetchRef.current.features);

              pendingPrefetchRef.current = null;
            }
            // Clear refs after timer fires
            prefetchTimerRef.current = null;
            isPrefetchingRef.current = false;
          }, showMarkersDelay);
        } else {
          setRawFeatures(response.features);
          setMetadata(response.metadata);
          lastFetchBoundsRef.current = targetBounds;
          lastFetchZoomRef.current = targetZoom;

          // Clear pending rooms (world view covers everything)
          reconcilePendingRooms(response.features);
        }
      } catch (err) {
        log.error('World view prefetch failed', err);
      } finally {
        if (!prefetchTimerRef.current) {
          isPrefetchingRef.current = false;
        }
      }
    },
    [category]
  );

  // Trigger fetch on viewport change with dynamic debounce
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!enabled || !isMapReady) {
      log.debug('Not fetching: enabled=' + enabled + ', isMapReady=' + isMapReady);
      return;
    }

    // Calculate if we need to fetch
    const lastZoom = lastFetchZoomRef.current;
    const lastBounds = lastFetchBoundsRef.current;

    // Always fetch on first load
    const isFirstLoad = lastBounds === null;

    // Fetch on zoom change - very sensitive
    const zoomChanged = lastZoom === null || Math.abs(zoom - lastZoom) >= 0.3;

    // Fetch on pan - check center moved (use larger threshold to reduce fetches)
    let panChanged = false;
    if (lastBounds) {
      const [cWest, cSouth, cEast, cNorth] = bounds;
      const [lWest, lSouth, lEast, lNorth] = lastBounds;
      const centerLatDiff = Math.abs((cNorth + cSouth) / 2 - (lNorth + lSouth) / 2);
      const centerLngDiff = Math.abs((cEast + cWest) / 2 - (lEast + lWest) / 2);
      const viewportSize = Math.max(Math.abs(cEast - cWest), Math.abs(cNorth - cSouth));
      // Use 35% threshold - since we pre-fetch 50% extra, we have buffer before edge is reached
      const threshold = viewportSize * 0.35;
      panChanged = centerLatDiff > threshold || centerLngDiff > threshold;
    }

    // Check for forced fetch (e.g., from cluster click)
    const forceRefetch = forceNextFetchRef.current;
    if (forceRefetch) {
      forceNextFetchRef.current = false;
    }

    const shouldFetchNow = isFirstLoad || zoomChanged || panChanged || forceRefetch;

    // Skip fetch if prefetch is in progress - prefetch already set lastFetch* refs
    // to the target values, so this would be a redundant/stale fetch
    // Check isPrefetchingRef FIRST as it's set immediately when prefetch starts
    const prefetchInProgress = isPrefetchingRef.current || prefetchTimerRef.current !== null || pendingPrefetchRef.current !== null;

    log.debug('Fetch check', {
      isFirstLoad,
      zoomChanged,
      panChanged,
      forceRefetch,
      prefetchInProgress,
      currentZoom: zoom,
      lastZoom,
      shouldFetch: shouldFetchNow && !prefetchInProgress
    });

    if (!shouldFetchNow || prefetchInProgress) {
      return;
    }

    const debounceDelay = getDebounceDelay(zoom);

    // For forced fetches (e.g., cluster clicks), skip debounce for instant response
    if (forceRefetch) {
      log.info('Immediate fetch (forced)', { zoom, bounds });
      fetchClusters(bounds, zoom);
      return;
    }

    log.debug('Scheduling fetch', { zoom, debounceDelay });

    debounceTimerRef.current = setTimeout(() => {
      log.info('Executing fetch', { zoom, bounds });
      fetchClusters(bounds, zoom);
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [bounds, zoom, enabled, isMapReady, fetchClusters]);

  // Handle background refetches on significant events
  useEffect(() => {
    if (!enabled || !isMapReady) return;

    log.debug('Subscribing to discovery refetch events');

    // Always trigger refetch on room.created - server handles visibility filtering
    // based on userLocation (passed in getClusters call)
    const unsubCreated = eventBus.on('room.created', () => {
      log.debug('Room created event - triggering refetch');
      // Small delay to allow store update to propagate first
      setTimeout(() => refetch(), 500);
    });

    const unsubClosed = eventBus.on('room.closed', () => {
      setTimeout(() => refetch(), 500);
    });

    return () => {
      unsubCreated();
      unsubClosed();
    };
  }, [enabled, isMapReady, refetch]);

  return useMemo(() => ({
    features,
    setFeatures: setRawFeatures,
    isLoading,
    error,
    metadata,
    refetch,
    prefetchForLocation,
    prefetchForWorldView,
  }), [
    features,
    isLoading,
    error,
    metadata,
    refetch,
    prefetchForLocation,
    prefetchForWorldView,
  ]);
}

export default useServerClustering;
