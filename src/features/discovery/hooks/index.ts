/**
 * Discovery Feature Hooks
 *
 * Custom hooks for map and discovery functionality.
 *
 * Exports:
 * - useMapState: Map viewport and interaction state
 * - useMapClustering: Room clustering for map
 * - useUserLocation: User geolocation tracking
 * - useMapDiscovery: Combined discovery with clustering
 * - useMapControls: Map viewport controls (zoom, pan, fly)
 * - useViewportRoomDiscovery: Viewport-based room loading
 */

export { useMapState } from './useMapState';
export type { UseMapStateReturn, UseMapStateOptions, MapCoordinate } from './useMapState';

export { useMapClustering } from './useMapClustering';
export type { UseMapClusteringReturn, UseMapClusteringOptions } from './useMapClustering';

export { useUserLocation } from './useUserLocation';
export type { UseUserLocationReturn, UseUserLocationOptions, UserLocation } from './useUserLocation';

export { useMapDiscovery } from './useMapDiscovery';
export type { UseMapDiscoveryOptions, UseMapDiscoveryReturn, MapBounds } from './useMapDiscovery';

export { useMapControls } from './useMapControls';
export type { UseMapControlsOptions, UseMapControlsReturn, MapViewportState } from './useMapControls';

export { useViewportRoomDiscovery } from './useViewportRoomDiscovery';
export type { UseViewportRoomDiscoveryOptions, UseViewportRoomDiscoveryReturn } from './useViewportRoomDiscovery';
