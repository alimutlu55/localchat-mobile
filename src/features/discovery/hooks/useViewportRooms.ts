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
import { eventBus } from '../../../core/events';

const log = createLogger('ViewportRooms');

// =============================================================================
// Types
// =============================================================================

export interface UseViewportRoomsOptions {
    /** Current map bounds [minLng, minLat, maxLng, maxLat] */
    bounds?: [number, number, number, number];
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

    // Internal state for map coordinates, decoupled from props to avoid re-render lag
    const [currentBounds, setCurrentBounds] = useState<[number, number, number, number] | null>(bounds || null);
    const [currentZoom, setCurrentZoom] = useState<number | undefined>(zoom);

    // Refs for tracking state
    const lastBoundsRef = useRef<[number, number, number, number] | null>(null);
    const lastZoomRef = useRef<number | null>(null);
    const lastCategoryRef = useRef<string | undefined>(undefined);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingRef = useRef(false);
    const mountedRef = useRef(true);

    // Store integration
    const storeSetRooms = useRoomStore((s) => s.setRooms);
    const joinedRoomIds = useRoomStore((s) => s.joinedRoomIds);
    const createdRoomIds = useRoomStore((s) => s.createdRoomIds);
    const hiddenRoomIds = useRoomStore((s) => s.hiddenRoomIds);

    useEffect(() => {
        mountedRef.current = true;

        // Listen for map clustering updates
        const unsubClustering = eventBus.on('discovery.clusteringCompleted', (payload) => {
            if (payload.bounds) {
                log.debug('Received clustering update via EventBus', {
                    zoom: payload.zoom,
                    bounds: payload.bounds.map(b => b.toFixed(4))
                });
                setCurrentBounds(payload.bounds);
                setCurrentZoom(payload.zoom);
            }
        });

        return () => {
            mountedRef.current = false;
            unsubClustering();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    /**
     * Check if bounds or zoom have changed significantly
     */
    const haveBoundsChanged = useCallback((newBounds: [number, number, number, number], newZoom?: number): boolean => {
        const zoomChanged = lastZoomRef.current !== null && newZoom !== undefined &&
            Math.abs(newZoom - lastZoomRef.current) > 0.1;

        const boundsMoved = !lastBoundsRef.current ||
            Math.abs(newBounds[0] - lastBoundsRef.current[0]) > 0.0001 ||
            Math.abs(newBounds[1] - lastBoundsRef.current[1]) > 0.0001 ||
            Math.abs(newBounds[2] - lastBoundsRef.current[2]) > 0.0001 ||
            Math.abs(newBounds[3] - lastBoundsRef.current[3]) > 0.0001;

        return zoomChanged || boundsMoved;
    }, []);

    /**
     * Fetch rooms for the current viewport.
     * Parallelizes fetching of the first 3 pages if more are available.
     */
    const fetchRooms = useCallback(async (resetPagination: boolean = false) => {
        if (isFetchingRef.current) return;
        if (!currentBounds || currentBounds.length !== 4) return;

        const [minLng, minLat, maxLng, maxLat] = currentBounds;
        const page = resetPagination ? 0 : currentPage;

        isFetchingRef.current = true;
        if (resetPagination) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        setError(null);

        try {
            // Fetch single page
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

            if (resetPagination) {
                setRooms(result.rooms);
                setCurrentPage(1);
            } else {
                setRooms(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
                    const filtered = result.rooms.filter(r => !existingIds.has(r.id));
                    return [...prev, ...filtered];
                });
                setCurrentPage(prev => prev + 1);
            }

            setHasMore(result.hasNext);
            setTotalCount(result.totalElements);
            lastBoundsRef.current = currentBounds;
            lastZoomRef.current = currentZoom ?? null;
            lastCategoryRef.current = category as string | undefined;

            log.debug('Viewport rooms fetched', {
                count: result.rooms.length,
                total: result.totalElements,
                hasMore: result.hasNext,
                page: resetPagination ? 1 : currentPage + 1,
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
    }, [currentBounds, userLocation, category, currentPage, pageSize, storeSetRooms, currentZoom]);


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

    // Auto-fetch when internal bounds or prop category change
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

        // Internal bounds changed (via EventBus)
        if (currentBounds && haveBoundsChanged(currentBounds, currentZoom)) {
            log.debug('Coordinate change detected, triggering fetchRooms', {
                zoom: currentZoom,
                hasLastBounds: !!lastBoundsRef.current
            });
            fetchRooms(true);
        }

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [enabled, currentBounds, currentZoom, category, haveBoundsChanged, fetchRooms]);

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
    };
}

export default useViewportRooms;
