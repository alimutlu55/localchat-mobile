/**
 * useClusteringAPI Hook
 *
 * Pure API fetching hook for room clustering.
 * Handles HTTP requests to the server clustering endpoint.
 *
 * Responsibilities:
 * - Make HTTP requests to /rooms/clusters
 * - Expand bounds for pre-fetching
 * - Track loading/error states
 * - Debounce requests based on zoom level
 *
 * Does NOT handle:
 * - State hydration (use useClusterState)
 * - Prefetching (use usePrefetch)
 * - Event subscriptions
 */

import { useCallback, useRef } from 'react';
import { roomService } from '../../../services';
import { ClusterResponse, ClusterFeature, ClusterMetadata } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ClusteringAPI');

// =============================================================================
// Types
// =============================================================================

export interface FetchClusterOptions {
    /** Bounds to fetch [west, south, east, north] */
    bounds: [number, number, number, number];
    /** Zoom level */
    zoom: number;
    /** Optional category filter */
    category?: string;
    /** User location for visibility filtering */
    userLocation?: { latitude: number; longitude: number } | null;
    /** Whether to expand bounds by 50% for pre-fetching */
    expandBounds?: boolean;
}

export interface UseClusteringAPIReturn {
    /**
     * Fetch clusters from server
     * @returns Promise with cluster response
     */
    fetchClusters: (options: FetchClusterOptions) => Promise<ClusterResponse>;

    /** Whether a fetch is currently in progress */
    isFetchingRef: React.MutableRefObject<boolean>;
}

// =============================================================================
// Hook
// =============================================================================

export function useClusteringAPI(): UseClusteringAPIReturn {
    const isFetchingRef = useRef(false);
    const mountedRef = useRef(true);

    /**
     * Fetch clusters from server.
     * Optionally expands bounds by 50% to pre-fetch surrounding area.
     */
    const fetchClusters = useCallback(
        async (options: FetchClusterOptions): Promise<ClusterResponse> => {
            const { bounds, zoom, category, userLocation, expandBounds = true } = options;

            // Calculate fetch bounds (optionally expanded)
            let fetchBounds = bounds;
            if (expandBounds) {
                const [minLng, minLat, maxLng, maxLat] = bounds;
                const lngSpan = maxLng - minLng;
                const latSpan = maxLat - minLat;
                fetchBounds = [
                    Math.max(-180, minLng - lngSpan * 0.5),
                    Math.max(-85, minLat - latSpan * 0.5),
                    Math.min(180, maxLng + lngSpan * 0.5),
                    Math.min(85, maxLat + latSpan * 0.5),
                ];
            }

            log.debug('Fetching clusters', {
                bounds,
                fetchBounds,
                zoom: Math.floor(zoom),
                category,
                expandBounds,
            });

            isFetchingRef.current = true;

            try {
                const response = await roomService.getClusters(
                    fetchBounds[0],
                    fetchBounds[1],
                    fetchBounds[2],
                    fetchBounds[3],
                    Math.floor(zoom),
                    category,
                    userLocation?.latitude,
                    userLocation?.longitude
                );

                log.debug('Clusters fetched', {
                    featureCount: response.features.length,
                    clusterCount: response.metadata.clusterCount,
                    individualCount: response.metadata.individualCount,
                });

                return response;
            } finally {
                isFetchingRef.current = false;
            }
        },
        []
    );

    return {
        fetchClusters,
        isFetchingRef,
    };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Calculate dynamic debounce delay based on zoom level.
 * Higher zoom = faster response for better interactivity.
 */
export function getDebounceDelay(zoom: number): number {
    if (zoom <= 5) return 200;
    if (zoom <= 12) return 150;
    return 100;
}

/**
 * Calculate viewport bounds for a given center and zoom.
 * Used for prefetching.
 *
 * @param centerLng Center longitude
 * @param centerLat Center latitude
 * @param zoom Zoom level
 * @param padding Multiplier for viewport size (default 1.5)
 * @returns Bounds [west, south, east, north]
 */
export function calculateViewportBounds(
    centerLng: number,
    centerLat: number,
    zoom: number,
    padding: number = 1.5
): [number, number, number, number] {
    const lngSpan = (360 / Math.pow(2, zoom)) * padding;
    const latSpan = (180 / Math.pow(2, zoom)) * padding;

    return [
        Math.max(-180, centerLng - lngSpan / 2),
        Math.max(-85, centerLat - latSpan / 2),
        Math.min(180, centerLng + lngSpan / 2),
        Math.min(85, centerLat + latSpan / 2),
    ];
}

/**
 * World view bounds for prefetching.
 */
export const WORLD_VIEW_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85];
export const WORLD_VIEW_ZOOM = 1;

export default useClusteringAPI;
