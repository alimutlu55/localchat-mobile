/**
 * usePrefetch Hook
 *
 * Coordinates prefetching for smooth map animations.
 * Fetches data ahead of time and schedules it to appear during animations.
 *
 * Responsibilities:
 * - Prefetch for location zoom-in
 * - Prefetch for world view zoom-out
 * - Schedule data appearance before animation ends
 * - Block competing fetches during prefetch
 */

import { useCallback, useRef } from 'react';
import { ClusterResponse, ClusterFeature, ClusterMetadata } from '../../../types';
import { useClusteringAPI, calculateViewportBounds, WORLD_VIEW_BOUNDS, WORLD_VIEW_ZOOM } from './useClusteringAPI';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('Prefetch');

// =============================================================================
// Types
// =============================================================================

export interface UsePrefetchOptions {
    /** Category filter to use for prefetch */
    category?: string;
    /** User location for visibility filtering */
    userLocation?: { latitude: number; longitude: number } | null;
    /** Callback to apply prefetched data */
    onPrefetchComplete: (features: ClusterFeature[], metadata: ClusterMetadata) => void;
}

export interface UsePrefetchReturn {
    /** Prefetch for a specific location */
    prefetchForLocation: (
        centerLng: number,
        centerLat: number,
        targetZoom: number,
        animationDuration: number
    ) => void;

    /** Prefetch world view data */
    prefetchForWorldView: (animationDuration: number) => void;

    /** Whether prefetch is in progress */
    isPrefetchingRef: React.MutableRefObject<boolean>;

    /** Clear any pending prefetch timer */
    clearPendingPrefetch: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function usePrefetch(options: UsePrefetchOptions): UsePrefetchReturn {
    const { category, userLocation, onPrefetchComplete } = options;

    const { fetchClusters, isFetchingRef } = useClusteringAPI();

    // Prefetch timing refs
    const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingPrefetchRef = useRef<ClusterResponse | null>(null);
    const isPrefetchingRef = useRef(false);

    /**
     * Clear pending prefetch timer.
     */
    const clearPendingPrefetch = useCallback(() => {
        if (prefetchTimerRef.current) {
            clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }
        pendingPrefetchRef.current = null;
        isPrefetchingRef.current = false;
    }, []);

    /**
     * Prefetch data for a target location during zoom animation.
     * Schedules data to appear 300ms before animation ends.
     */
    const prefetchForLocation = useCallback(
        async (
            centerLng: number,
            centerLat: number,
            targetZoom: number,
            animationDuration: number
        ) => {
            // Set flag immediately to block competing fetches
            isPrefetchingRef.current = true;

            // Clear any pending timer
            clearPendingPrefetch();
            isPrefetchingRef.current = true; // Re-set after clear

            // Calculate bounds for target viewport
            const bounds = calculateViewportBounds(centerLng, centerLat, targetZoom);

            log.debug('Prefetching for location', {
                center: [centerLng, centerLat],
                targetZoom,
                bounds,
                animationDuration,
            });

            try {
                const response = await fetchClusters({
                    bounds,
                    zoom: targetZoom,
                    category,
                    userLocation,
                    expandBounds: true,
                });

                pendingPrefetchRef.current = response;

                // Schedule data to appear 300ms before animation ends
                const showDelay = Math.max(0, animationDuration - 300);

                prefetchTimerRef.current = setTimeout(() => {
                    const pending = pendingPrefetchRef.current;
                    if (pending) {
                        log.debug('Applying prefetched data', {
                            featureCount: pending.features.length,
                        });
                        onPrefetchComplete(pending.features, pending.metadata);
                        pendingPrefetchRef.current = null;
                    }
                    isPrefetchingRef.current = false;
                }, showDelay);

                log.debug('Prefetch scheduled', { showDelay });
            } catch (error) {
                log.error('Prefetch failed', error);
                isPrefetchingRef.current = false;
            }
        },
        [category, userLocation, fetchClusters, clearPendingPrefetch, onPrefetchComplete]
    );

    /**
     * Prefetch world view data for zoom-out animation.
     */
    const prefetchForWorldView = useCallback(
        async (animationDuration: number) => {
            // Set flag immediately
            isPrefetchingRef.current = true;

            // Clear any pending timer
            clearPendingPrefetch();
            isPrefetchingRef.current = true;

            log.debug('Prefetching world view', { animationDuration });

            try {
                const response = await fetchClusters({
                    bounds: WORLD_VIEW_BOUNDS,
                    zoom: WORLD_VIEW_ZOOM,
                    category,
                    userLocation,
                    expandBounds: false, // Already full world
                });

                pendingPrefetchRef.current = response;

                // Schedule data to appear 300ms before animation ends
                const showDelay = Math.max(0, animationDuration - 300);

                prefetchTimerRef.current = setTimeout(() => {
                    const pending = pendingPrefetchRef.current;
                    if (pending) {
                        log.debug('Applying world view data', {
                            featureCount: pending.features.length,
                        });
                        onPrefetchComplete(pending.features, pending.metadata);
                        pendingPrefetchRef.current = null;
                    }
                    isPrefetchingRef.current = false;
                }, showDelay);
            } catch (error) {
                log.error('World view prefetch failed', error);
                isPrefetchingRef.current = false;
            }
        },
        [category, userLocation, fetchClusters, clearPendingPrefetch, onPrefetchComplete]
    );

    return {
        prefetchForLocation,
        prefetchForWorldView,
        isPrefetchingRef,
        clearPendingPrefetch,
    };
}

export default usePrefetch;
