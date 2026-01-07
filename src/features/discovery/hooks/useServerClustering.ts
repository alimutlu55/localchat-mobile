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
    return filterExcludedRooms(merged);
  }, [rawFeatures, joinedRoomIds, createdRoomIds, hiddenRoomIds, pendingRoomIds, storeRooms]);

  const lastFetchBoundsRef = useRef<[number, number, number, number] | null>(null);
  const lastFetchZoomRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const forceNextFetchRef = useRef(false);
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPrefetchingRef = useRef(false);

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
      const lngSpan = maxLng - minLng;
      const latSpan = maxLat - minLat;
      const expandedBounds: [number, number, number, number] = [
        Math.max(-180, minLng - lngSpan * 0.5),
        Math.max(-85, minLat - latSpan * 0.5),
        Math.min(180, maxLng + lngSpan * 0.5),
        Math.min(85, maxLat + latSpan * 0.5),
      ];

      isFetchingRef.current = true;
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        const perfStart = Date.now();
        const response: ClusterResponse = await roomService.getClusters(
          expandedBounds[0], expandedBounds[1], expandedBounds[2], expandedBounds[3],
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
          networkMs,
          backendMs: response.metadata.processingTimeMs,
          zoom: fetchZoom
        });

        reconcilePendingRooms(response.features);
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
      isPrefetchingRef.current = true;

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
        const networkMs = Date.now() - perfStart;

        if (!mountedRef.current) return;

        // APPEARANCE OFFSET CALCULATION:
        // We want markers to appear slightly before the fly-to animation ends (100ms before)
        // for a smooth transition. If network is slower than animation, they appear immediately.
        const markerAppearOffset = Math.max(0, animationDuration - networkMs - 100);
        log.debug('Prefetch received', { count: response.features.length, networkMs, markerAppearOffset });

        prefetchTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          log.debug('Applying prefetched markers');
          setRawFeatures(response.features);
          setMetadata(response.metadata);
          reconcilePendingRooms(response.features);
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
      isPrefetchingRef.current = true;
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

        if (!mountedRef.current) return;
        setRawFeatures(response.features);
        setMetadata(response.metadata);
        reconcilePendingRooms(response.features);

        setTimeout(() => { isPrefetchingRef.current = false; }, animationDuration + 100);
      } catch (err) {
        log.error('World prefetch failed', err);
        isPrefetchingRef.current = false;
      }
    },
    [category, userLocation, reconcilePendingRooms]
  );

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!enabled || !isMapReady) return;

    const lastZoom = lastFetchZoomRef.current;
    const lastBounds = lastFetchBoundsRef.current;
    const isFirstLoad = lastBounds === null;
    const zoomChanged = lastZoom === null || Math.abs(zoom - lastZoom) >= 0.3;

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

    const shouldFetch = isFirstLoad || zoomChanged || panChanged || forceRefetch;
    const prefetchInProgress = isPrefetchingRef.current || prefetchTimerRef.current !== null;

    if (!shouldFetch || prefetchInProgress) return;

    const delay = forceRefetch ? 0 : getDebounceDelay(zoom);
    debounceTimerRef.current = setTimeout(() => {
      fetchClusters(bounds, zoom);
    }, delay);

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [bounds, zoom, enabled, isMapReady, fetchClusters]);

  useEffect(() => {
    if (!enabled || !isMapReady) return;
    const unsubCreated = eventBus.on('room.created', () => setTimeout(() => refetch(), 500));
    const unsubClosed = eventBus.on('room.closed', () => setTimeout(() => refetch(), 500));
    return () => { unsubCreated(); unsubClosed(); };
  }, [enabled, isMapReady, refetch]);

  return useMemo(() => ({
    features, setFeatures: setRawFeatures, isLoading, error, metadata, refetch, prefetchForLocation, prefetchForWorldView,
  }), [features, isLoading, error, metadata, refetch, prefetchForLocation, prefetchForWorldView]);
}

export default useServerClustering;
