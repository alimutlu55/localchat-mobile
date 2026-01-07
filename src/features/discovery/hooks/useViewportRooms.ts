/**
 * useViewportRooms Hook
 *
 * Fetches rooms within the current map viewport for synchronized List View display.
 * This hook is the bridge between the Map View (which uses useServerClustering for markers)
 * and the List View (which shows paginated rooms within the same viewport).
 *
 * Key Design Decisions:
 * - Uses the `/rooms/viewport` API for paginated, distance-ordered rooms
 * - Debounces fetches to avoid excessive API calls during map panning
 * - Maintains pagination state for infinite scroll in List View
 * - Orders rooms by distance from user location (not map center)
 *
 * @example
 * ```typescript
 * const {
 *   rooms,
 *   isLoading,
 *   isLoadingMore,
 *   hasMore,
 *   loadMore,
 *   refetch,
 * } = useViewportRooms({
 *   bounds,
 *   userLocation,
 *   category,
 *   enabled: viewMode === 'list',
 * });
 * ```
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Room, RoomCategory } from '../../../types';
import { roomService } from '../../../services';
import { useRoomStore } from '../../rooms/store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ViewportRooms');

// =============================================================================
// Types
// =============================================================================

export interface UseViewportRoomsOptions {
    /** Current map bounds [minLng, minLat, maxLng, maxLat] */
    bounds: [number, number, number, number];
    /** User's location for distance ordering and visibility filtering */
    userLocation?: { latitude: number; longitude: number } | null;
    /** Current zoom level to detect scale changes */
    zoom?: number;
    /** Optional category filter */
    category?: RoomCategory | string;
    /** Whether to enable fetching (e.g., only when List View is active) */
    enabled?: boolean;
    /** Page size for pagination (default: 20) */
    pageSize?: number;
}

export interface UseViewportRoomsReturn {
    /** Rooms within the current viewport */
    rooms: Room[];
    /** Whether initial fetch is in progress */
    isLoading: boolean;
    /** Whether loading more rooms (pagination) */
    isLoadingMore: boolean;
    /** Whether more rooms are available */
    hasMore: boolean;
    /** Total number of rooms in viewport */
    totalCount: number;
    /** Current page number */
    currentPage: number;
    /** Error message if any */
    error: string | null;
    /** Load next page of rooms */
    loadMore: () => Promise<void>;
    /** Refresh rooms (resets pagination) */
    refetch: () => Promise<void>;
    /** Prefetch rooms for a target location */
    prefetch: (centerLng: number, centerLat: number, targetZoom: number, animationDuration: number) => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useViewportRooms(options: UseViewportRoomsOptions): UseViewportRoomsReturn {
    const {
        bounds,
        userLocation,
        zoom,
        category,
        enabled = true,
        pageSize = 20,
    } = options;

    // State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Refs for tracking state
    const lastBoundsRef = useRef<[number, number, number, number] | null>(null);
    const lastZoomRef = useRef<number | null>(null);
    const lastCategoryRef = useRef<string | undefined>(undefined);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingRef = useRef(false);
    const isPrefetchingRef = useRef(false);
    const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Store integration
    const storeSetRooms = useRoomStore((s) => s.setRooms);
    const joinedRoomIds = useRoomStore((s) => s.joinedRoomIds);
    const createdRoomIds = useRoomStore((s) => s.createdRoomIds);
    const hiddenRoomIds = useRoomStore((s) => s.hiddenRoomIds);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);
        };
    }, []);

    /**
     * Check if bounds or zoom have changed significantly
     */
    const haveBoundsChanged = useCallback((newBounds: [number, number, number, number], newZoom?: number): boolean => {
        // If we are currently prefetching/animating, ignore all intermediate movements
        if (isPrefetchingRef.current) return false;

        // Detect zoom/scale changes (significant if > 0.1)
        const zoomChanged = lastZoomRef.current !== null && newZoom !== undefined &&
            Math.abs(newZoom - lastZoomRef.current) > 0.1;

        if (zoomChanged) return true;

        if (!lastBoundsRef.current) return true;

        const [minLng, minLat, maxLng, maxLat] = newBounds;
        const [lastMinLng, lastMinLat, lastMaxLng, lastMaxLat] = lastBoundsRef.current;

        // Calculate viewport size for threshold
        const viewportSize = Math.max(Math.abs(maxLng - minLng), Math.abs(maxLat - minLat));

        // At world view (size > 180), use a much smaller relative threshold 
        // to detect any significant pan around the globe.
        const thresholdPercentage = viewportSize > 180 ? 0.05 : 0.15;
        const threshold = viewportSize * thresholdPercentage;

        // Check if center has moved significantly
        const centerDiffLng = Math.abs((minLng + maxLng) / 2 - (lastMinLng + lastMaxLng) / 2);
        const centerDiffLat = Math.abs((minLat + maxLat) / 2 - (lastMinLat + lastMaxLat) / 2);

        return centerDiffLng > threshold || centerDiffLat > threshold;
    }, []);

    /**
     * Fetch rooms for the current viewport.
     * Parallelizes fetching of the first 3 pages if more are available.
     */
    const fetchRooms = useCallback(async (resetPagination: boolean = false) => {
        if (isFetchingRef.current) return;
        if (!bounds || bounds.length !== 4) return;

        const [minLng, minLat, maxLng, maxLat] = bounds;
        const page = resetPagination ? 0 : currentPage;

        isFetchingRef.current = true;
        if (resetPagination) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        setError(null);

        try {
            // First page fetch
            const result = await roomService.getViewportRooms(
                minLng,
                minLat,
                maxLng,
                maxLat,
                userLocation?.latitude,
                userLocation?.longitude,
                category as string | undefined,
                page,
                pageSize
            );

            if (!mountedRef.current) return;

            // Update store with fetched rooms
            storeSetRooms(result.rooms);

            let allNewRooms = result.rooms;
            let finalHasNext = result.hasNext;
            let finalPage = page + 1;

            // If we are at the first page and there's more, fetch next 2 pages in parallel
            if (resetPagination && result.hasNext) {
                log.debug('Parallelizing fetch for pages 1 and 2');
                const [page1, page2] = await Promise.all([
                    roomService.getViewportRooms(
                        minLng, minLat, maxLng, maxLat,
                        userLocation?.latitude, userLocation?.longitude,
                        category as string | undefined, 1, pageSize
                    ),
                    roomService.getViewportRooms(
                        minLng, minLat, maxLng, maxLat,
                        userLocation?.latitude, userLocation?.longitude,
                        category as string | undefined, 2, pageSize
                    ).catch(() => ({ rooms: [], hasNext: false })) // Soft fail for page 2
                ]);

                const p1Rooms = page1.rooms;
                const p2Rooms = page2.rooms;

                // Deduplicate and merge
                const seenIds = new Set(allNewRooms.map(r => r.id));
                [...p1Rooms, ...p2Rooms].forEach(r => {
                    if (!seenIds.has(r.id)) {
                        allNewRooms.push(r);
                        seenIds.add(r.id);
                    }
                });

                finalHasNext = page2.hasNext;
                finalPage = 3;

                // Sync extra rooms to store
                storeSetRooms([...p1Rooms, ...p2Rooms]);
            }

            if (resetPagination) {
                setRooms(allNewRooms);
                setCurrentPage(finalPage);
            } else {
                setRooms(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
                    const filtered = allNewRooms.filter(r => !existingIds.has(r.id));
                    return [...prev, ...filtered];
                });
                setCurrentPage(prev => prev + 1);
            }

            setHasMore(finalHasNext);
            setTotalCount(result.totalElements);
            lastBoundsRef.current = bounds;
            lastZoomRef.current = zoom ?? null;
            lastCategoryRef.current = category as string | undefined;

            log.debug('Viewport rooms fetched', {
                count: allNewRooms.length,
                total: result.totalElements,
                hasMore: finalHasNext,
                page: finalPage,
            });
        } catch (err) {
            log.error('Failed to fetch viewport rooms', err);
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
            isFetchingRef.current = false;
        }
    }, [bounds, userLocation, category, currentPage, pageSize, storeSetRooms]);

    /**
     * Prefetch rooms for a specific target location and zoom (e.g. during animations)
     */
    const prefetch = useCallback(async (
        centerLng: number,
        centerLat: number,
        targetZoom: number,
        animationDuration: number
    ) => {
        isPrefetchingRef.current = true;
        if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current);

        // Special case for World View (Zoom 1)
        let targetBounds: [number, number, number, number];
        if (targetZoom <= 1.5) {
            targetBounds = [-180, -85, 180, 85];
        } else {
            // Calculate target bounds for prefetching (using a larger padding to cover margins)
            const lngSpan = (360 / Math.pow(2, targetZoom)) * 1.5;
            const latSpan = (180 / Math.pow(2, targetZoom)) * 1.5;

            targetBounds = [
                Math.max(-180, centerLng - lngSpan / 2),
                Math.max(-85, centerLat - latSpan / 2),
                Math.min(180, centerLng + lngSpan / 2),
                Math.min(85, centerLat + latSpan / 2),
            ];
        }

        log.debug('Prefetching viewport rooms', { centerLng, centerLat, targetZoom, isWorldView: targetZoom <= 1.5 });

        // Force a fetch with these new bounds immediately
        // We reuse fetchRooms but we need to override the bounds temporarily
        const originalBounds = lastBoundsRef.current;
        lastBoundsRef.current = null; // Force fetch to proceed

        try {
            const page = 0;
            const result = await roomService.getViewportRooms(
                targetBounds[0],
                targetBounds[1],
                targetBounds[2],
                targetBounds[3],
                userLocation?.latitude,
                userLocation?.longitude,
                category as string | undefined,
                page,
                pageSize
            );

            if (!mountedRef.current) return;

            // Update store
            storeSetRooms(result.rooms);

            // Update local state so List view is ready
            setRooms(result.rooms);
            setHasMore(result.hasNext);
            setTotalCount(result.totalElements);
            setCurrentPage(1);

            // Mark these bounds as current so auto-fetch doesn't immediately re-trigger
            lastBoundsRef.current = targetBounds;

            log.debug('Prefetch complete', { count: result.rooms.length });

            // Hold the guard for the duration of the animation + small buffer
            prefetchTimeoutRef.current = setTimeout(() => {
                isPrefetchingRef.current = false;
                prefetchTimeoutRef.current = null;
                log.debug('Prefetch guard released');
            }, animationDuration + 200);
        } catch (err) {
            log.error('Prefetch failed', err);
            lastBoundsRef.current = originalBounds; // Restore
            isPrefetchingRef.current = false;
        }
    }, [userLocation, category, pageSize, storeSetRooms]);

    /**
     * Load more rooms (pagination)
     */
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore || isLoading) return;
        await fetchRooms(false);
    }, [isLoadingMore, hasMore, isLoading, fetchRooms]);

    /**
     * Refetch rooms (reset pagination)
     */
    const refetch = useCallback(async () => {
        lastBoundsRef.current = null;
        setCurrentPage(0);
        await fetchRooms(true);
    }, [fetchRooms]);

    // Auto-fetch when bounds or category change
    useEffect(() => {
        if (!enabled) return;

        // Category changed - always refetch
        if (lastCategoryRef.current !== (category as string | undefined)) {
            log.debug('Category changed, refetching');
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            fetchRooms(true);
            return;
        }

        // Bounds or Zoom changed significantly - debounce and refetch
        if (haveBoundsChanged(bounds, zoom)) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // DYNAMIC DEBOUNCE: Align with useServerClustering (100-200ms)
            const delay = bounds[2] - bounds[0] > 90 ? 200 : 150;

            debounceTimerRef.current = setTimeout(() => {
                log.debug('Bounds changed, refetching');
                fetchRooms(true);
            }, delay);
        }

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [enabled, bounds, category, haveBoundsChanged, fetchRooms]);

    // Hydrate rooms with store state (joined, created, hidden)
    const hydratedRooms = useMemo(() => {
        return rooms
            .filter(room => !hiddenRoomIds.has(room.id))
            .map(room => ({
                ...room,
                hasJoined: joinedRoomIds.has(room.id),
                isCreator: createdRoomIds.has(room.id),
            }));
    }, [rooms, joinedRoomIds, createdRoomIds, hiddenRoomIds]);

    return {
        rooms: hydratedRooms,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        currentPage,
        error,
        loadMore,
        refetch,
        prefetch,
    };
}

export default useViewportRooms;
