/**
 * Component Exports
 * 
 * NOTE: Map/Discovery components (Bubble, MapCluster, RoomListView, OptimizedMarkers)
 * have been moved to features/discovery/components and should be imported from there.
 * 
 * Room-specific components (BannedUsersModal, CategoryChips, etc.)
 * have been moved to features/rooms/components and should be imported from there.
 */

// UI Components
export * from './ui';

// Chat Components
export * from './chat';

// Profile Components
export * from './profile';

// Room Components - Re-export from new location for backward compatibility
export * from './room';

// Sidebar & Drawers - These remain as shared components used across features
export { Sidebar } from './Sidebar';
export { ProfileDrawer } from './ProfileDrawer';

// Legacy exports - Import from features/discovery/components instead
export { Bubble, MapCluster, RoomListView } from '../features/discovery/components';
