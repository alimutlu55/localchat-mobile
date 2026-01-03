/**
 * Discovery Feature Hooks
 *
 * Custom hooks for map and discovery functionality.
 *
 * Exports:
 * - useMapState: Map viewport and interaction state
 * - useMapClustering: Room clustering for map (client-side)
 * - useServerClustering: Server-side clustering for low zoom levels
 * - useClusteringAPI: Pure API fetching for clusters
 * - useClusterState: State hydration and management
 * - usePrefetch: Prefetch coordination for animations
 * - useUserLocation: User geolocation tracking
 * - useMapDiscovery: Combined discovery with clustering
 * - useMapControls: Map viewport controls (zoom, pan, fly)
 * - useViewportRoomDiscovery: Viewport-based room loading
 *
 * Decomposed (Phase 2):
 * - hooks/state/: State management hooks (useDiscoveryViewState, useDiscoveryFilters)
 * - hooks/animations/: Animation hooks (useMapTransitions)
 */

// =============================================================================
// ORIGINAL HOOKS
// =============================================================================

export { useMapState } from './useMapState';
export type { UseMapStateReturn, UseMapStateOptions, MapCoordinate } from './useMapState';

export { useMapClustering } from './useMapClustering';
export type { UseMapClusteringReturn, UseMapClusteringOptions } from './useMapClustering';

export { useServerClustering } from './useServerClustering';
export type { UseServerClusteringReturn, UseServerClusteringOptions } from './useServerClustering';

// Decomposed hooks from useServerClustering
export { useClusteringAPI, getDebounceDelay, calculateViewportBounds, WORLD_VIEW_BOUNDS, WORLD_VIEW_ZOOM } from './useClusteringAPI';
export type { FetchClusterOptions, UseClusteringAPIReturn } from './useClusteringAPI';

export { useClusterState } from './useClusterState';
export type { UseClusterStateReturn } from './useClusterState';

export { usePrefetch } from './usePrefetch';
export type { UsePrefetchOptions, UsePrefetchReturn } from './usePrefetch';

export { useUserLocation } from './useUserLocation';
export type { UseUserLocationReturn, UseUserLocationOptions, UserLocation } from './useUserLocation';

export { useMapDiscovery } from './useMapDiscovery';
export type { UseMapDiscoveryOptions, UseMapDiscoveryReturn, MapBounds } from './useMapDiscovery';

export { useMapControls } from './useMapControls';
export type { UseMapControlsOptions, UseMapControlsReturn, MapViewportState } from './useMapControls';

export { useViewportRoomDiscovery } from './useViewportRoomDiscovery';
export type { UseViewportRoomDiscoveryOptions, UseViewportRoomDiscoveryReturn } from './useViewportRoomDiscovery';

// =============================================================================
// DECOMPOSED HOOKS (Phase 2)
// =============================================================================

// State Hooks
export * from './state';

// Animation Hooks
export * from './animations';
