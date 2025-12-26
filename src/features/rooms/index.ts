/**
 * Rooms Feature
 *
 * Everything related to room management: discovery, creation, joining/leaving.
 *
 * Architecture:
 * - context/: State management (RoomCacheContext)
 * - hooks/: Business logic (useRoom, useRoomActions)
 * - screens/: UI components (future)
 */

// Context
export * from './context';

// Hooks
export * from './hooks';
