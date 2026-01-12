/**
 * useServerClustering Hook
 *
 * Fetches pre-clustered room data from the server.
 * All clustering is done server-side using PostGIS ST_ClusterDBSCAN.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { roomService } from '../../../services';
import { ClusterResponse, ClusterFeature, ClusterMetadata } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { eventBus } from '../../../core/events';
import { useRoomStore } from '../../rooms/store';
import { isPointInBounds } from '../../../utils/geo';

const log = createLogger('ServerClustering');

// =============================================================================
// Types
// =============================================================================

export interface UseServerClusteringOptions {
  bounds: [number, number, number, number];
  zoom: number;
  enabled: boolean;
  isMapReady: boolean;
  category?: string;
  userLocation?: { latitude: number; longitude: number } | null;
}

export interface UseServerClusteringReturn {
  features: ClusterFeature[];
  setFeatures: React.Dispatch<React.SetStateAction<ClusterFeature[]>>;
  isLoading: boolean;
  error: string | null;
  metadata: ClusterMetadata | null;
  refetch: (throwOnError?: boolean) => Promise<void>;
  prefetchForLocation: (centerLng: number, centerLat: number, targetZoom: number, animationDuration: number) => void;
  prefetchForWorldView: (animationDuration: number) => void;
  cancelPrefetch: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getDebounceDelay(zoom: number): number {
  if (zoom <= 5) return 200;
  if (zoom <= 12) return 150;
  return 100;
}

function filterExcludedRooms(features: ClusterFeature[]): ClusterFeature[] {
  const state = useRoomStore.getState();
  const hiddenRoomIds = state.hiddenRoomIds;
  if (hiddenRoomIds.size === 0) return features;

  return features.filter(f => {
    if (f.properties.cluster) return true;
    return !hiddenRoomIds.has(f.properties.roomId!);
  });
}

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
    if (existingRoomIds.has(roomId)) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const isInsideAnyCluster = clusters.some(c => {
      const bounds = c.properties.expansionBounds;
      if (!bounds) return false;
      return isPointInBounds(room.latitude!, room.longitude!, bounds);
    });

    if (isInsideAnyCluster) return;

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

// =============================================================================
// Hook Implementation
// =============================================================================

export function useServerClustering(options: UseServerClusteringOptions): UseServerClusteringReturn {
  const { bounds, zoom, enabled, isMapReady, category, userLocation } = options;

  const [rawFeatures, setRawFeatures] = useState<ClusterFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ClusterMetadata | null>(null);

  const store = useRoomStore();
  const { joinedRoomIds, createdRoomIds, hiddenRoomIds, pendingRoomIds, rooms: storeRooms } = store;

  const features = useMemo(() => {
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

    const merged = mergePendingRooms(hydrated);
    const filtered = filterExcludedRooms(merged);

    // Stable sort is CRITICAL for native Mapbox stability.
    // Without it, frequent re-orderings cause NSRangeException during rapid panning
    // because React and Native view hierarchies get out of sync.
    return [...filtered].sort((a, b) => {
      const idA = a.properties.cluster ? `c-${a.properties.clusterId}` : `r-${a.properties.roomId}`;
      const idB = b.properties.cluster ? `c-${b.properties.clusterId}` : `r-${b.properties.roomId}`;
      return idA.localeCompare(idB);
    });
  }, [rawFeatures, joinedRoomIds, createdRoomIds, hiddenRoomIds, pendingRoomIds, storeRooms]);

  const lastFetchBoundsRef = useRef<[number, number, number, number] | null>(null);
  const lastFetchZoomRef = useRef<number | null>(null);
  const lastCategoryRef = useRef<string | undefined>(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const forceNextFetchRef = useRef(false);
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPrefetchingRef = useRef(false);
  const activePrefetchIdRef = useRef<number | null>(null);

  const cancelPrefetch = useCallback(() => {
    if (activePrefetchIdRef.current || prefetchTimerRef.current) {
      log.info('Cancelling map data prefetch due to interruption', {
        activeId: activePrefetchIdRef.current,
        hasTimer: !!prefetchTimerRef.current
      });
    }
    activePrefetchIdRef.current = null;
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    if (isPrefetchingRef.current) {
      isPrefetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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

      if (individualRoomIds.has(roomId)) {
        log.debug('Removing pending room confirmed as individual', { roomId });
        state.removePendingRoom(roomId);
        return;
      }

      const isInsideAnyCluster = clusters.some(c => {
        const b = c.properties.expansionBounds;
        return b && isPointInBounds(room.latitude!, room.longitude!, b);
      });

      if (isInsideAnyCluster) {
        log.debug('Removing pending room confirmed as clustered', { roomId });
        state.removePendingRoom(roomId);
      }
    });
  }, []);

  const fetchClusters = useCallback(
    async (fetchBounds: [number, number, number, number] | null, fetchZoom: number, showLoading = false, throwOnError = false) => {
      if (isFetchingRef.current || !fetchBounds) return;

      const [minLng, minLat, maxLng, maxLat] = fetchBounds;
      isFetchingRef.current = true;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        const perfStart = Date.now();
        const response: ClusterResponse = await roomService.getClusters(
          minLng, minLat, maxLng, maxLat,
          Math.floor(fetchZoom), category, userLocation?.latitude, userLocation?.longitude
        );
        const networkMs = Date.now() - perfStart;

        if (!mountedRef.current) return;

        setRawFeatures(response.features);
        setMetadata(response.metadata);
        lastFetchBoundsRef.current = fetchBounds;
        lastFetchZoomRef.current = fetchZoom;

        // Network telemetry moved to debug to keep console clean for production.
        log.debug('Clusters fetched', {
          count: response.features.length,
          totalRooms: response.metadata.totalRooms, // Total rooms across all clusters
          networkMs,
          backendMs: response.metadata.processingTimeMs,
          zoom: fetchZoom
        });

        reconcilePendingRooms(response.features);

        // Emit event to notify other components (like RoomListView) that map data has changed
        log.debug('Emitting discovery.clusteringCompleted', {
          zoom: fetchZoom,
          totalRooms: response.metadata.totalRooms,
          bounds: fetchBounds.map(b => b.toFixed(4))
        });
        eventBus.emit('discovery.clusteringCompleted', {
          bounds: fetchBounds,
          zoom: fetchZoom,
          category,
          totalRooms: response.metadata.totalRooms // Pass total rooms for metadata sync
        });
      } catch (err) {
        log.error('Fetch failed', err);
        if (mountedRef.current) setError(err instanceof Error ? err.message : 'Fetch failed');
        if (throwOnError) throw err;
      } finally {
        if (mountedRef.current) setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [category, userLocation, reconcilePendingRooms]
  );

  const refetch = useCallback(async (throwOnError = false) => {
    lastFetchBoundsRef.current = null;
    lastFetchZoomRef.current = null;
    forceNextFetchRef.current = true;
    await fetchClusters(bounds, zoom, true, throwOnError);
  }, [bounds, zoom, fetchClusters]);

  const prefetchForLocation = useCallback(
    async (centerLng: number, centerLat: number, targetZoom: number, animationDuration: number) => {
      const prefetchId = Date.now();
      activePrefetchIdRef.current = prefetchId;
      isPrefetchingRef.current = true;
      log.debug('Starting location prefetch', { centerLng, centerLat, targetZoom, animationDuration, prefetchId });

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);

      const lngSpan = (360 / Math.pow(2, targetZoom)) * 1.5;
      const latSpan = (180 / Math.pow(2, targetZoom)) * 1.5;

      const targetBounds: [number, number, number, number] = [
        Math.max(-180, centerLng - lngSpan / 2),
        Math.max(-85, centerLat - latSpan / 2),
        Math.min(180, centerLng + lngSpan / 2),
        Math.min(85, centerLat + latSpan / 2),
      ];

      lastFetchBoundsRef.current = targetBounds;
      lastFetchZoomRef.current = targetZoom;

      try {
        const perfStart = Date.now();
        const response: ClusterResponse = await roomService.getClusters(
          targetBounds[0], targetBounds[1], targetBounds[2], targetBounds[3],
          Math.floor(targetZoom), category, userLocation?.latitude, userLocation?.longitude
        );

        if (activePrefetchIdRef.current !== prefetchId) {
          log.info('Discarding stale prefetch data (user interrupted or newer request)', {
            prefetchId,
            activeId: activePrefetchIdRef.current
          });
          return;
        }

        const networkMs = Date.now() - perfStart;

        if (!mountedRef.current) return;

        // APPEARANCE OFFSET CALCULATION:
        // We want markers to appear slightly before the fly-to animation ends (100ms before)
        // for a smooth transition. If network is slower than animation, they appear immediately.
        const markerAppearOffset = Math.max(0, animationDuration - networkMs - 100);
        log.debug('Prefetch received', { count: response.features.length, networkMs, markerAppearOffset });

        prefetchTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) {
            log.warn('Prefetch timer fired but component unmounted');
            return;
          }
          log.debug('Applying prefetched markers (prefetchForLocation)');

          // Update tracking refs ONLY when data is actually applied
          lastFetchBoundsRef.current = targetBounds;
          lastFetchZoomRef.current = targetZoom;

          setRawFeatures(response.features);
          setMetadata(response.metadata);
          reconcilePendingRooms(response.features);

          // Emit event to notify other components (like RoomListView) that map data has changed
          eventBus.emit('discovery.clusteringCompleted', {
            bounds: targetBounds,
            zoom: targetZoom,
            category
          });
          isPrefetchingRef.current = false;
          prefetchTimerRef.current = null;
        }, markerAppearOffset);

      } catch (err) {
        log.error('Prefetch failed', err);
        isPrefetchingRef.current = false;
      }
    },
    [category, userLocation, reconcilePendingRooms]
  );

  const prefetchForWorldView = useCallback(
    async (animationDuration: number) => {
      const prefetchId = Date.now();
      activePrefetchIdRef.current = prefetchId;
      isPrefetchingRef.current = true;
      log.debug('Starting world view prefetch', { animationDuration, prefetchId });
      const targetZoom = 1;
      const targetBounds: [number, number, number, number] = [-180, -85, 180, 85];

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);

      lastFetchBoundsRef.current = targetBounds;
      lastFetchZoomRef.current = targetZoom;

      try {
        const response: ClusterResponse = await roomService.getClusters(
          targetBounds[0], targetBounds[1], targetBounds[2], targetBounds[3],
          targetZoom, category, userLocation?.latitude, userLocation?.longitude
        );

        if (activePrefetchIdRef.current !== prefetchId) {
          log.info('Discarding stale world prefetch data (user interrupted)', {
            prefetchId,
            activeId: activePrefetchIdRef.current
          });
          return;
        }

        if (!mountedRef.current) return;

        // Apply data after a delay to sync with map animation.
        // World animation is usually longer (1100ms), so we appear 400ms before end.
        const markerAppearOffset = Math.max(animationDuration - 400, 100);

        prefetchTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          log.debug('Applying world prefetched markers', { count: response.features.length });

          setRawFeatures(response.features);
          setMetadata(response.metadata);
          reconcilePendingRooms(response.features);

          // Update tracking refs ONLY when data is actually applied
          lastFetchBoundsRef.current = targetBounds;
          lastFetchZoomRef.current = targetZoom;

          // Emit event to notify other components (like RoomListView) that map data has changed
          eventBus.emit('discovery.clusteringCompleted', {
            bounds: targetBounds,
            zoom: targetZoom,
            category
          });

          prefetchTimerRef.current = null;
        }, markerAppearOffset);

        // Clear prefetch state after the map has settled
        setTimeout(() => {
          isPrefetchingRef.current = false;
        }, animationDuration + 150);
      } catch (err) {
        log.error('World prefetch failed', err);
        isPrefetchingRef.current = false;
        prefetchTimerRef.current = null;
      }
    },
    [category, userLocation, reconcilePendingRooms]
  );

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!enabled || !isMapReady) return;

    const lastZoom = lastFetchZoomRef.current;
    const lastBounds = lastFetchBoundsRef.current;
    const lastCategory = lastCategoryRef.current;
    const isFirstLoad = lastBounds === null;
    const zoomChanged = lastZoom === null || Math.abs(zoom - lastZoom) >= 0.3;
    const categoryChanged = category !== lastCategory;

    let panChanged = false;
    if (lastBounds) {
      const [cWest, cSouth, cEast, cNorth] = bounds;
      const [lWest, lSouth, lEast, lNorth] = lastBounds;
      const viewportSize = Math.max(Math.abs(cEast - cWest), Math.abs(cNorth - cSouth));
      const threshold = viewportSize * 0.35;
      panChanged = Math.abs((cNorth + cSouth) / 2 - (lNorth + lSouth) / 2) > threshold ||
        Math.abs((cEast + cWest) / 2 - (lEast + lWest) / 2) > threshold;
    }

    const forceRefetch = forceNextFetchRef.current;
    if (forceRefetch) forceNextFetchRef.current = false;

    // Detect if user location just became available (critical for visibility radius rooms)
    const locationBecameAvailable = !lastFetchBoundsRef.current && userLocation !== null;

    const shouldFetch = isFirstLoad || zoomChanged || panChanged || forceRefetch || locationBecameAvailable || categoryChanged;
    const prefetchInProgress = isPrefetchingRef.current || prefetchTimerRef.current !== null;

    if (!shouldFetch || prefetchInProgress) {
      if (!shouldFetch && !prefetchInProgress) {
        log.debug('Fetch skipped: no change detected');
      } else if (prefetchInProgress) {
        log.debug('Fetch skipped: prefetch in progress');
      }
      return;
    }

    log.info('Triggering regional fetch', { zoom, bounds: bounds.map(b => b.toFixed(2)) });
    // Use shorter delay for category changes and forced refetches for better UX
    const delay = (forceRefetch || categoryChanged) ? 0 : getDebounceDelay(zoom);

    // Update category ref before starting fetch
    if (categoryChanged) {
      lastCategoryRef.current = category;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchClusters(bounds, zoom);
    }, delay);

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [bounds, zoom, category, enabled, isMapReady, userLocation, fetchClusters]);

  useEffect(() => {
    if (!enabled || !isMapReady) return;
    const unsubCreated = eventBus.on('room.created', () => setTimeout(() => refetch(), 500));
    const unsubClosed = eventBus.on('room.closed', () => setTimeout(() => refetch(), 500));
    return () => { unsubCreated(); unsubClosed(); };
  }, [enabled, isMapReady, refetch]);

  return useMemo(() => ({
    features, setFeatures: setRawFeatures, isLoading, error, metadata, refetch, prefetchForLocation, prefetchForWorldView, cancelPrefetch,
  }), [features, isLoading, error, metadata, refetch, prefetchForLocation, prefetchForWorldView, cancelPrefetch]);
}

export default useServerClustering;
