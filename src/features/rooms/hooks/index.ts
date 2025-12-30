/**
 * Room Feature Hooks
 *
 * Custom hooks for room-related functionality.
 *
 * Exports:
 * - useRoom: Fetch and cache individual room data
 * - useRoomState: Central coordinator for room state (recommended for new code)
 * - useRoomActions: Join/leave/close room operations (legacy)
 * - useJoinRoom: Join/leave with typed errors and optimistic updates
 * - useRoomDiscovery: Fetch nearby rooms with pagination
 * - useMyRooms: User's joined/created rooms
 * - useRoomWebSocket: EventBus event handler for room updates
 */

export { useRoom } from './useRoom';
export type { UseRoomOptions, UseRoomReturn } from './useRoom';

export { useRoomState } from './useRoomState';
export type { UseRoomStateReturn } from './useRoomState';

export { useRoomOperations } from './useRoomOperations';
export type { UseRoomOperationsReturn } from './useRoomOperations';

export { useRoomMembership } from './useRoomMembership';
export type {
    UseRoomMembershipReturn,
    UserRoomRole,
} from './useRoomMembership';

export { useRoomDiscovery } from './useRoomDiscovery';
export type {
    UseRoomDiscoveryOptions,
    UseRoomDiscoveryReturn,
} from './useRoomDiscovery';

export { useMyRooms } from './useMyRooms';
export type { UseMyRoomsOptions, UseMyRoomsReturn } from './useMyRooms';

// EventBus event handlers
export { useRoomEvents } from './useRoomEvents';
