/**
 * Room Facade
 *
 * Abstracts RoomStore access for the Discovery module.
 * This facade provides a clean interface for discovery components
 * without directly coupling to the store implementation.
 *
 * Design Principles:
 * - Wraps existing RoomStore methods (NO MODIFICATIONS to RoomStore)
 * - Provides discovery-specific queries
 * - Enables unit testing with mocks
 * - All existing functionality remains unchanged
 */

import { Room } from '../../../types';
import { useRoomStore } from '../../rooms/store';
import type { IRoomFacade } from '../types/discovery.contracts';

// =============================================================================
// Singleton Facade Implementation
// =============================================================================

/**
 * RoomFacade - Singleton implementation
 *
 * Provides a clean interface for discovery features to access room data
 * without directly coupling to RoomStore internals.
 *
 * Usage:
 * ```typescript
 * const facade = RoomFacade.getInstance();
 * const room = facade.getRoomById('room-123');
 * const isJoined = facade.isJoined('room-123');
 * ```
 */
class RoomFacadeImpl implements IRoomFacade {
    private static instance: RoomFacadeImpl;

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): RoomFacadeImpl {
        if (!RoomFacadeImpl.instance) {
            RoomFacadeImpl.instance = new RoomFacadeImpl();
        }
        return RoomFacadeImpl.instance;
    }

    // ===========================================================================
    // Room Queries
    // ===========================================================================

    /**
     * Get a room by ID from the store
     */
    getRoomById(roomId: string): Room | undefined {
        return useRoomStore.getState().getRoom(roomId);
    }

    /**
     * Get all rooms as an array
     */
    getAllRooms(): Room[] {
        const state = useRoomStore.getState();
        return Array.from(state.rooms.values());
    }

    // ===========================================================================
    // Membership Queries
    // ===========================================================================

    /**
     * Get set of joined room IDs
     */
    getJoinedRoomIds(): Set<string> {
        return useRoomStore.getState().joinedRoomIds;
    }

    /**
     * Check if user has joined a specific room
     */
    isJoined(roomId: string): boolean {
        return useRoomStore.getState().isJoined(roomId);
    }

    // ===========================================================================
    // Visibility Queries
    // ===========================================================================

    /**
     * Get set of hidden room IDs (e.g., rooms where user is banned)
     */
    getHiddenRoomIds(): Set<string> {
        return useRoomStore.getState().hiddenRoomIds;
    }

    /**
     * Check if a room is hidden
     */
    isHidden(roomId: string): boolean {
        return useRoomStore.getState().isHidden(roomId);
    }

    // ===========================================================================
    // Discovery State
    // ===========================================================================

    /**
     * Get set of discovered room IDs
     */
    getDiscoveredRoomIds(): Set<string> {
        return useRoomStore.getState().discoveredRoomIds;
    }

    /**
     * Get set of pending room IDs (optimistic updates)
     */
    getPendingRoomIds(): Set<string> {
        return useRoomStore.getState().pendingRoomIds;
    }

    // ===========================================================================
    // Mutations (delegates to store)
    // ===========================================================================

    /**
     * Set discovered rooms in the store
     */
    setDiscoveredRooms(rooms: Room[]): void {
        const state = useRoomStore.getState();
        state.setRooms(rooms);
        state.setDiscoveredRoomIds(new Set(rooms.map(r => r.id)));
    }

    /**
     * Add room IDs to discovered set
     */
    addDiscoveredRoomIds(ids: string[]): void {
        useRoomStore.getState().addDiscoveredRoomIds(ids);
    }

    /**
     * Set rooms in the store (for bulk updates)
     */
    setRooms(rooms: Room[]): void {
        useRoomStore.getState().setRooms(rooms);
    }

    /**
     * Update a specific room
     */
    updateRoom(roomId: string, updates: Partial<Room>): void {
        useRoomStore.getState().updateRoom(roomId, updates);
    }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const RoomFacade = RoomFacadeImpl.getInstance();

// =============================================================================
// React Hook for Store Subscription
// =============================================================================

/**
 * Hook to subscribe to specific room facade state
 *
 * This hook provides reactive access to room data while
 * maintaining the facade abstraction.
 *
 * Usage:
 * ```typescript
 * const { rooms, joinedIds, hiddenIds } = useRoomFacade();
 * ```
 */
export function useRoomFacade() {
    // Subscribe to relevant store slices
    const rooms = useRoomStore((s) => s.rooms);
    const joinedRoomIds = useRoomStore((s) => s.joinedRoomIds);
    const hiddenRoomIds = useRoomStore((s) => s.hiddenRoomIds);
    const discoveredRoomIds = useRoomStore((s) => s.discoveredRoomIds);
    const pendingRoomIds = useRoomStore((s) => s.pendingRoomIds);

    return {
        /** Get room by ID */
        getRoomById: (roomId: string) => rooms.get(roomId),

        /** All rooms as array */
        rooms: Array.from(rooms.values()),

        /** Joined room IDs set */
        joinedRoomIds,

        /** Hidden room IDs set */
        hiddenRoomIds,

        /** Discovered room IDs set */
        discoveredRoomIds,

        /** Pending room IDs set */
        pendingRoomIds,

        /** Check if joined */
        isJoined: (roomId: string) => joinedRoomIds.has(roomId),

        /** Check if hidden */
        isHidden: (roomId: string) => hiddenRoomIds.has(roomId),
    };
}

export default RoomFacade;
