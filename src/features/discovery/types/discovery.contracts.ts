/**
 * Discovery Feature Contracts
 *
 * Explicit type definitions and schemas for the Discovery module.
 * These types define the boundaries between components and ensure
 * consistent data flow throughout the discovery feature.
 *
 * Design Principles:
 * - Explicit over implicit: All interfaces are fully documented
 * - Minimal dependencies: No imports from store or service layers
 * - Strict typing: Prefer literal types over broad primitives
 */

import { Room, ClusterFeature, RoomCategory } from '../../../types';

// =============================================================================
// View State Contracts
// =============================================================================

/**
 * Discovery view mode - determines which view slice is active
 */
export type DiscoveryViewMode = 'map' | 'list';

/**
 * State for the discovery view mode
 */
export interface DiscoveryViewState {
    /** Current active view */
    mode: DiscoveryViewMode;
}

// =============================================================================
// Filter Contracts
// =============================================================================

/**
 * Sort options for room list
 */
export type DiscoverySortOption = 'distance' | 'newest' | 'popular' | 'expiring';

/**
 * Filter state for discovery
 */
export interface DiscoveryFilters {
    /** Selected category filter (undefined = 'All') */
    category?: RoomCategory;
    /** Search query string */
    searchQuery: string;
    /** Current sort option */
    sortBy: DiscoverySortOption;
}

/**
 * Default filter values
 */
export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
    category: undefined,
    searchQuery: '',
    sortBy: 'distance',
};

// =============================================================================
// Location Contracts
// =============================================================================

/**
 * User location coordinates
 */
export interface UserLocation {
    latitude: number;
    longitude: number;
}

/**
 * User location state with loading/permission status
 */
export interface UserLocationState {
    location: UserLocation | null;
    isLoading: boolean;
    permissionDenied: boolean;
    error: string | null;
}

// =============================================================================
// Map Contracts
// =============================================================================

/**
 * Map bounding box - [minLng, minLat, maxLng, maxLat]
 */
export type MapBounds = [number, number, number, number];

/**
 * Map viewport state
 */
export interface MapViewport {
    bounds: MapBounds;
    zoom: number;
    center: [number, number]; // [lng, lat]
}

/**
 * Map camera animation options
 */
export interface MapCameraOptions {
    centerCoordinate: [number, number]; // [lng, lat]
    zoomLevel: number;
    animationDuration: number;
    animationMode: 'flyTo' | 'easeTo' | 'moveTo';
}

/**
 * World view constants
 */
export const WORLD_VIEW_BOUNDS: MapBounds = [-180, -85, 180, 85];
export const WORLD_VIEW_ZOOM = 1;
export const DEFAULT_ZOOM = 12;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

// =============================================================================
// Cluster Data Contracts
// =============================================================================

/**
 * Input for cluster data hook
 */
export interface ClusterDataInput {
    bounds: MapBounds;
    zoom: number;
    enabled: boolean;
    isMapReady: boolean;
    category?: RoomCategory;
    userLocation?: UserLocation | null;
}

/**
 * Output from cluster data hook
 */
export interface ClusterDataOutput {
    features: ClusterFeature[];
    isLoading: boolean;
    error: string | null;
    totalRooms: number;
    refetch: () => Promise<void>;
}

// =============================================================================
// List Data Contracts
// =============================================================================

/**
 * Input for list room data hook
 */
export interface ListDataInput {
    latitude: number;
    longitude: number;
    radius?: number;
    category?: RoomCategory;
    pageSize?: number;
    autoFetch?: boolean;
}

/**
 * Output from list room data hook
 */
export interface ListDataOutput {
    rooms: Room[];
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    totalCount: number;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
}

// =============================================================================
// Component Props Contracts
// =============================================================================

/**
 * Props for map marker components
 */
export interface MapMarkerProps {
    feature: ClusterFeature;
    isSelected?: boolean;
    onPress: (feature: ClusterFeature) => void;
    onDeselect?: () => void;
}

/**
 * Props for room item in list view
 */
export interface ListItemProps {
    room: Room;
    hasJoined: boolean;
    distance: number;
    onJoin?: (room: Room) => void;
    onEnter?: (room: Room) => void;
}

/**
 * Props for filter chips
 */
export interface FilterChipProps {
    label: string;
    isSelected: boolean;
    onPress: () => void;
}

// =============================================================================
// Animation Contracts
// =============================================================================

/**
 * Map transition state
 */
export interface MapTransitionState {
    overlayOpacity: number;
    markersOpacity: number;
    isMapStable: boolean;
    hasInitialData: boolean;
}

// =============================================================================
// Facade Contracts
// =============================================================================

/**
 * Room facade interface - abstracts RoomStore access
 */
export interface IRoomFacade {
    getRoomById(roomId: string): Room | undefined;
    getJoinedRoomIds(): Set<string>;
    getHiddenRoomIds(): Set<string>;
    getDiscoveredRoomIds(): Set<string>;
    getPendingRoomIds(): Set<string>;
    setDiscoveredRooms(rooms: Room[]): void;
    addDiscoveredRoomIds(ids: string[]): void;
    isJoined(roomId: string): boolean;
    isHidden(roomId: string): boolean;
}

/**
 * Cluster facade interface - abstracts cluster transformations
 */
export interface IClusterFacade {
    toRoom(feature: ClusterFeature): Room;
    filterExcluded(features: ClusterFeature[], hiddenIds: Set<string>): ClusterFeature[];
    mergePending(features: ClusterFeature[], pendingRoomIds: Set<string>): ClusterFeature[];
}
