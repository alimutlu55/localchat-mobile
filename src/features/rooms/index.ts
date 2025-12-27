/**
 * Rooms Feature
 *
 * Everything related to room management: discovery, creation, joining/leaving.
 *
 * Architecture:
 * - context/: State management (RoomCacheContext)
 * - hooks/: Business logic (useRoom, useRoomActions)
 * - screens/: UI screens (CreateRoom, RoomDetails, RoomInfo)
 * - components/: Reusable room-specific components
 */

// Context
export * from './context';

// Hooks
export * from './hooks';

// Screens
export * from './screens';

// Components
export * from './components';
