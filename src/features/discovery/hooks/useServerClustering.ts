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

import { useState, useCallback, useEffect, useRef } from 'react';
import { roomService } from '../../../services';
import { ClusterResponse, ClusterFeature, ClusterMetadata } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { filterExcludedRooms, mergePendingRooms } from './useDiscoveryEvents';
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
  refetch: () => Promise<void>;
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

// =============================================================================
// Hook Implementation
// =============================================================================

export function useServerClustering(options: UseServerClusteringOptions): UseServerClusteringReturn {
  const { bounds, zoom, enabled, isMapReady, category } = options;

  // State
  const [features, setFeatures] = useState<ClusterFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ClusterMetadata | null>(null);

  // Refs for debouncing and tracking
  const lastFetchBoundsRef = useRef<[number, number, number, number] | null>(null);
  const lastFetchZoomRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const forceNextFetchRef = useRef(false);

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
    async (fetchBounds: [number, number, number, number], fetchZoom: number) => {
      if (isFetchingRef.current) {
        log.debug('Fetch already in progress, skipping');
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
      });

      isFetchingRef.current = true;
      // Don't set isLoading to true - keep old features visible during fetch
      setError(null);

      try {
        const response: ClusterResponse = await roomService.getClusters(
          expandedBounds[0],
          expandedBounds[1],
          expandedBounds[2],
          expandedBounds[3],
          Math.floor(fetchZoom), // Send integer zoom to server
          category
        );

        if (!mountedRef.current) return;

        // Hydrate features with local user state (isCreator, hasJoined) from RoomStore
        const { joinedRoomIds, rooms: storeRooms } = useRoomStore.getState();
        const hydratedFeatures = response.features.map(f => {
          if (f.properties.cluster || !f.properties.roomId) return f;

          const roomId = f.properties.roomId;
          const storeRoom = storeRooms.get(roomId);

          return {
            ...f,
            properties: {
              ...f.properties,
              hasJoined: joinedRoomIds.has(roomId),
              isCreator: storeRoom?.isCreator || false,
            }
          };
        });

        // Merge in pending rooms that haven't reached the server yet
        const mergedFeatures = mergePendingRooms(hydratedFeatures);

        // Filter out excluded rooms (banned/closed) before setting state
        const filteredFeatures = filterExcludedRooms(mergedFeatures);
        setFeatures(filteredFeatures);
        setMetadata(response.metadata);
        lastFetchBoundsRef.current = fetchBounds;
        lastFetchZoomRef.current = fetchZoom;

        log.info('Server clusters fetched', {
          featureCount: response.features.length,
          clusterCount: response.metadata.clusterCount,
          individualCount: response.metadata.individualCount,
          processingTimeMs: response.metadata.processingTimeMs,
        });
      } catch (err) {
        log.error('Failed to fetch server clusters', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch clusters');
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
        isFetchingRef.current = false;
      }
    },
    [category]
  );

  /**
   * Manual refresh
   */
  const refetch = useCallback(async () => {
    log.debug('Manual refetch triggered');
    // Clear cached state to force next useEffect to fetch
    lastFetchBoundsRef.current = null;
    lastFetchZoomRef.current = null;
    forceNextFetchRef.current = true;
    // Immediately fetch with current bounds/zoom
    await fetchClusters(bounds, zoom);
  }, [bounds, zoom, fetchClusters]);

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

    log.debug('Fetch check', {
      isFirstLoad,
      zoomChanged,
      panChanged,
      forceRefetch,
      currentZoom: zoom,
      lastZoom,
      shouldFetch: shouldFetchNow
    });

    if (!shouldFetchNow) {
      return;
    }

    const debounceDelay = getDebounceDelay(zoom);
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

  return {
    features,
    setFeatures,
    isLoading,
    error,
    metadata,
    refetch,
  };
}

export default useServerClustering;
