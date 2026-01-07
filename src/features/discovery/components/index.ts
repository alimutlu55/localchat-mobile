/**
 * Discovery Feature Components
 *
 * Reusable components for map and discovery screens.
 *
 * Exports:
 * - MapControls: Floating zoom/navigation controls
 * - MapHeader: Header bar with profile, room count, my rooms
 * - RoomListView: List view of rooms with filtering
 * - RoomCard: Presentational room card for lists
 * - CategoryFilter: Horizontal category chip filter
 * - OptimizedMarkers: Memoized map markers (client-side clustering)
 * - ServerClusterMarkers: Markers for server-side clustering
 * - MapCluster: Cluster visualization component
 * - Bubble: Individual room marker
 */

export { MapControls } from './MapControls';
export { MapHeader } from './MapHeader';
export { RoomListView } from './RoomListView';
export { RoomCard } from './RoomCard';
export { CategoryFilter } from './CategoryFilter';
export { RoomMarker, ClusterMarker } from './OptimizedMarkers';
export { ServerRoomMarker, ServerClusterMarker } from './ServerClusterMarkers';
export { MapCluster } from './MapCluster';
export { Bubble } from './Bubble';
export { MiniRoomCard } from './MiniRoomCard';

