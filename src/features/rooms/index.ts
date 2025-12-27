/**
 * Rooms Feature
 *
 * Everything related to room management: discovery, creation, joining/leaving.
 *
 * Architecture:
 * - store/: Zustand-based state management (RoomStore) - SINGLE SOURCE OF TRUTH
 * - hooks/: Business logic (useRoom, useRoomActions, useRoomWebSocket)
 * - screens/: UI screens (CreateRoom, RoomDetails, RoomInfo)
 * - components/: Reusable room-specific components
 * - context/: Legacy exports (deprecated, kept for compatibility)
 *
 * Usage:
 * ```typescript
 * import { useRoom, useJoinRoom, useMyRooms, useRoomStore } from '@/features/rooms';
 * ```
 */

// Store (Zustand - single source of truth)
export * from './store';

// Hooks (use these for new code)
export * from './hooks';

// Screens
export * from './screens';

// Components
export * from './components';

// Context (deprecated - kept for backward compatibility)
// New code should not use these
export * from './context';
