/**
 * Discovery Feature
 *
 * Everything related to room discovery: map view, list view, location.
 *
 * Architecture:
 * - components/: Reusable UI components (MapControls, MapHeader)
 * - hooks/: Business logic (useMapDiscovery, useMapControls)
 * - screens/: Screen components
 *
 * Decomposed Architecture (Available for gradual adoption):
 * - types/: Explicit contracts and interfaces
 * - facades/: Store abstractions (RoomFacade, ClusterFacade)
 * - hooks/state/: State management hooks
 * - hooks/animations/: Animation hooks
 * - map/: Map view components (MapViewMarkers, MapViewLocation)
 * - list/: List view components (ListViewSearch, ListViewFilters, ListViewItem)
 */

// =============================================================================
// MAIN EXPORTS (Active)
// =============================================================================

// Components
export * from './components';

// Hooks - includes original + decomposed state/animation hooks
export * from './hooks';

// Screens (DiscoveryScreen is the main entry point)
export * from './screens';

// =============================================================================
// DECOMPOSED COMPONENTS (Available for gradual adoption)
// =============================================================================

// Types & Contracts - selective exports to avoid collisions with hooks types
export {
    DiscoveryViewState,
    DiscoveryFilters,
    DiscoveryViewMode,
    DiscoverySortOption,
    MapViewport,
    MapTransitionState,
    IRoomFacade,
    IClusterFacade,
    DEFAULT_DISCOVERY_FILTERS,
} from './types';
export type { UserLocation as DiscoveryUserLocation } from './types';

// Facades
export * from './facades';

// Map View Components
export * from './map';

// List View Components
export * from './list';
