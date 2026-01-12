import { useState, useCallback, useEffect, useMemo } from 'react';
import { Room, ClusterResponse, ClusterFeature, RoomCategory } from '../../../types';
import { roomService } from '../../../services';
import { createLogger } from '../../../shared/utils/logger';
import useServerClustering from './useServerClustering';
import useViewportRooms from './useViewportRooms';

const log = createLogger('UnifiedDiscovery');

interface UnifiedDiscoveryOptions {
    bounds: [number, number, number, number] | null;
    zoom: number;
    userLocation: { latitude: number; longitude: number } | null;
    category?: RoomCategory | string;
    isMapReady?: boolean;
}

export function useUnifiedDiscovery(options: UnifiedDiscoveryOptions) {
    const { bounds, zoom, userLocation, category, isMapReady } = options;

    // 1. Map Clustering State (The Source of Truth for Viewport)
    const {
        features,
        isLoading: isMapLoading,
        metadata: clusterMetadata,
        refetch: refetchClusters,
        prefetchForLocation,
        prefetchForWorldView,
        cancelPrefetch
    } = useServerClustering({
        bounds: bounds || [0, 0, 0, 0], // Fallback for type safety
        zoom,
        enabled: true,
        userLocation,
        isMapReady: !!isMapReady,
        category: category as string | undefined
    });

    // 2. Viewport Rooms State (List View Data)
    const {
        rooms: viewportRooms,
        isLoading: isListLoading,
        isLoadingMore,
        hasMore,
        totalCount: listTotalCount,
        loadMore,
        refetch: refetchList
    } = useViewportRooms({
        bounds: bounds || undefined,
        zoom: zoom,
        userLocation,
        category,
        enabled: !!bounds && !!isMapReady,
    });

    // 3. Unified Metadata
    const totalRoomsInView = useMemo(() => {
        // Prioritize cluster metadata count for the map view counter to ensure 
        // visual consistency with markers. Falling back to list count if needed.
        if (clusterMetadata?.totalRooms != null) {
            return clusterMetadata.totalRooms;
        }
        return listTotalCount;
    }, [listTotalCount, clusterMetadata?.totalRooms]);

    return {
        // Map data
        features,
        isMapLoading,
        clusterMetadata,
        refetchClusters,
        prefetchForLocation,
        prefetchForWorldView,
        cancelPrefetch,

        // List data
        viewportRooms,
        isListLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        refetchList,

        // Global metadata
        totalRoomsInView,

        // Global loading state
        isLoading: isMapLoading || (isListLoading && viewportRooms.length === 0)
    };
}

export default useUnifiedDiscovery;
