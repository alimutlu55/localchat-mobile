/**
 * RoomStore - Zustand-based Room State Management
 *
 * This store replaces the legacy RoomContext with a simpler, more performant approach.
 *
 * Design Principles:
 * - Single source of truth for room data
 * - Minimal API surface - only what's needed
 * - No WebSocket logic in the store (handled by hooks)
 * - Immutable updates for predictable re-renders
 * - Shallow equality for efficient selectors
 *
 * Architecture:
 * - RoomStore: Pure data store (rooms, membership)
 * - useRoomStore: Zustand hook with selectors
 * - Feature hooks (useRoom, useJoinRoom): Business logic + API calls
 *
 * Migration Path:
 * 1. New code uses RoomStore directly
 * 2. Legacy code uses compatibility layer
 * 3. Gradually migrate screens
 * 4. Remove legacy RoomContext
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Room } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { storage } from '../../../services/storage';

const log = createLogger('RoomStore');

// Storage key for persisted muted rooms
const MUTED_ROOMS_STORAGE_KEY = '@localchat/muted_rooms';

// =============================================================================
// Types
// =============================================================================

export interface RoomStoreState {
  /**
   * All rooms indexed by ID
   * This is the single source of truth for room data
   */
  rooms: Map<string, Room>;

  /**
   * Set of room IDs the current user has joined
   * Separating this from room data allows efficient membership checks
   */
  joinedRoomIds: Set<string>;

  /**
   * Set of room IDs discovered via nearby search
   * Used for map/list views
   */
  discoveredRoomIds: Set<string>;

  /**
   * Set of room IDs created by the current user
   * Separating this from room data allows efficient creator checks
   * even after user leaves a room they created
   */
  createdRoomIds: Set<string>;

  /**
   * Set of room IDs that have notifications muted
   * Persisted to AsyncStorage for persistence across sessions
   */
  mutedRoomIds: Set<string>;

  /**
   * Loading states for async operations
   */
  isLoading: boolean;
  isLoadingMore: boolean;

  /**
   * Pagination state for discovery
   */
  currentPage: number;
  hasMoreRooms: boolean;

  /**
   * Currently selected room (for UI state)
   */
  selectedRoomId: string | null;

  /**
   * Tracking in-flight operations for UI feedback
   */
  joiningRoomIds: Set<string>;
  leavingRoomIds: Set<string>;
  closingRoomIds: Set<string>;

  /**
   * Set of room IDs to hide from discovery/map (e.g., banned, closed)
   * Replacing module-level state in useDiscoveryEvents
   */
  hiddenRoomIds: Set<string>;

  /**
   * Set of room IDs that are pending (optimistically added)
   * Replacing module-level state in useDiscoveryEvents
   */
  pendingRoomIds: Set<string>;
}

export interface RoomStoreActions {
  // =========================================================================
  // Room Data Operations
  // =========================================================================

  /**
   * Add or update a single room
   */
  setRoom: (room: Room) => void;

  /**
   * Add or update multiple rooms (batch operation)
   */
  setRooms: (rooms: Room[]) => void;

  /**
   * Update specific fields of a room
   */
  updateRoom: (roomId: string, updates: Partial<Room>) => void;

  /**
   * Remove a room from the store
   */
  removeRoom: (roomId: string) => void;

  /**
   * Get a room by ID (synchronous)
   */
  getRoom: (roomId: string) => Room | undefined;

  // =========================================================================
  // Membership Operations
  // =========================================================================

  /**
   * Mark a room as joined by current user
   */
  addJoinedRoom: (roomId: string) => void;

  /**
   * Remove room from joined list
   */
  removeJoinedRoom: (roomId: string) => void;

  /**
   * Check if user has joined a room
   */
  isJoined: (roomId: string) => boolean;

  /**
   * Replace all joined room IDs (for sync from server)
   */
  setJoinedRoomIds: (ids: Set<string>) => void;

  // =========================================================================
  // Creator Operations
  // =========================================================================

  /**
   * Add a room ID to created set
   */
  addCreatedRoom: (roomId: string) => void;

  /**
   * Check if user created a room
   */
  isCreator: (roomId: string) => boolean;

  /**
   * Replace all created room IDs (for sync from server)
   */
  setCreatedRoomIds: (ids: Set<string>) => void;

  // =========================================================================
  // Operation Status
  // =========================================================================

  /**
   * Start tracking an operation on a room
   */
  startOperation: (type: 'join' | 'leave' | 'close', roomId: string) => void;

  /**
   * Stop tracking an operation on a room
   */
  stopOperation: (type: 'join' | 'leave' | 'close', roomId: string) => void;

  // =========================================================================
  // Discovery Operations
  // =========================================================================

  /**
   * Set discovered room IDs (replaces existing)
   */
  setDiscoveredRoomIds: (ids: Set<string>) => void;

  /**
   * Add room IDs to discovered set
   */
  addDiscoveredRoomIds: (ids: string[]) => void;

  // =========================================================================
  // Mute Operations
  // =========================================================================

  /**
   * Mute notifications for a room
   */
  muteRoom: (roomId: string) => void;

  /**
   * Unmute notifications for a room
   */
  unmuteRoom: (roomId: string) => void;

  /**
   * Toggle mute state for a room
   */
  toggleMuteRoom: (roomId: string) => void;

  /**
   * Check if a room is muted
   */
  isRoomMuted: (roomId: string) => boolean;

  /**
   * Load muted rooms from storage (called on app init)
   */
  loadMutedRooms: () => Promise<void>;

  // =========================================================================
  // UI State Operations
  // =========================================================================

  /**
   * Set the currently selected room
   */
  setSelectedRoom: (roomId: string | null) => void;

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => void;

  /**
   * Set loading more state (pagination)
   */
  setLoadingMore: (isLoadingMore: boolean) => void;

  /**
   * Update pagination state
   */
  setPagination: (page: number, hasMore: boolean) => void;

  // =========================================================================
  // Reset
  // =========================================================================

  /**
   * Reset store to initial state (e.g., on logout)
   */
  reset: () => void;

  // =========================================================================
  // Discovery Transient State Operations
  // =========================================================================

  /**
   * Hide a room from discovery
   */
  hideRoom: (roomId: string, ttlMs?: number) => void;

  /**
   * Unhide a room from discovery
   */
  showRoom: (roomId: string) => void;

  /**
   * Check if a room is hidden
   */
  isHidden: (roomId: string) => boolean;

  /**
   * Add a room to pending set
   */
  addPendingRoom: (roomId: string, ttlMs?: number) => void;

  /**
   * Remove a room from pending set
   */
  removePendingRoom: (roomId: string) => void;

  /**
   * Check if a room is pending
   */
  isPending: (roomId: string) => boolean;
}

export type RoomStore = RoomStoreState & RoomStoreActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: RoomStoreState = {
  rooms: new Map(),
  joinedRoomIds: new Set(),
  createdRoomIds: new Set(),
  discoveredRoomIds: new Set(),
  mutedRoomIds: new Set(),
  isLoading: false,
  isLoadingMore: false,
  currentPage: 0,
  hasMoreRooms: true,
  selectedRoomId: null,
  joiningRoomIds: new Set(),
  leavingRoomIds: new Set(),
  closingRoomIds: new Set(),
  hiddenRoomIds: new Set(),
  pendingRoomIds: new Set(),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Merge two room objects, preserving defined values from existing when new value is undefined.
 * This prevents API responses that don't include certain fields (like isCreator)
 * from overwriting those fields with undefined.
 */
function mergeRoomPreservingDefined(existing: Room, incoming: Room): Room {
  const result: Room = { ...existing };

  // Only overwrite with incoming values that are not undefined
  for (const key of Object.keys(incoming) as (keyof Room)[]) {
    if (incoming[key] !== undefined) {
      (result as any)[key] = incoming[key];
    }
  }

  return result;
}

// =============================================================================
// Store Implementation
// =============================================================================

/**
 * Main room store
 * Uses subscribeWithSelector for efficient subscriptions
 */
export const useRoomStore = create<RoomStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialState,

    // =========================================================================
    // Room Data Operations
    // =========================================================================

    setRoom: (room: Room) => {
      set((state) => {
        const newRooms = new Map(state.rooms);
        const existing = newRooms.get(room.id);
        // Merge with existing, but don't overwrite defined values with undefined
        // This preserves fields like isCreator that may not be in every API response
        const merged = existing ? mergeRoomPreservingDefined(existing, room) : room;
        newRooms.set(room.id, merged);
        return { rooms: newRooms };
      });
    },

    setRooms: (rooms: Room[]) => {
      if (rooms.length === 0) return;

      set((state) => {
        const newRooms = new Map(state.rooms);
        rooms.forEach((room) => {
          const existing = newRooms.get(room.id);
          // Merge with existing, but don't overwrite defined values with undefined
          const merged = existing ? mergeRoomPreservingDefined(existing, room) : room;
          newRooms.set(room.id, merged);
        });
        log.debug('Rooms set', { count: rooms.length });
        return { rooms: newRooms };
      });
    },

    updateRoom: (roomId: string, updates: Partial<Room>) => {
      set((state) => {
        const existing = state.rooms.get(roomId);
        if (!existing) {
          log.debug('Update skipped - room not found', { roomId });
          return state;
        }

        const newRooms = new Map(state.rooms);
        newRooms.set(roomId, { ...existing, ...updates });
        return { rooms: newRooms };
      });
    },

    removeRoom: (roomId: string) => {
      set((state) => {
        if (!state.rooms.has(roomId)) return state;

        const newRooms = new Map(state.rooms);
        newRooms.delete(roomId);

        const newJoined = new Set(state.joinedRoomIds);
        newJoined.delete(roomId);

        const newDiscovered = new Set(state.discoveredRoomIds);
        newDiscovered.delete(roomId);

        log.debug('Room removed', { roomId });
        return {
          rooms: newRooms,
          joinedRoomIds: newJoined,
          discoveredRoomIds: newDiscovered,
        };
      });
    },

    getRoom: (roomId: string) => {
      return get().rooms.get(roomId);
    },

    // =========================================================================
    // Membership Operations
    // =========================================================================

    addJoinedRoom: (roomId: string) => {
      set((state) => {
        if (state.joinedRoomIds.has(roomId)) return state;
        const newJoined = new Set(state.joinedRoomIds);
        newJoined.add(roomId);
        log.debug('Joined room added', { roomId });
        return { joinedRoomIds: newJoined };
      });
    },

    removeJoinedRoom: (roomId: string) => {
      set((state) => {
        if (!state.joinedRoomIds.has(roomId)) return state;
        const newJoined = new Set(state.joinedRoomIds);
        newJoined.delete(roomId);
        log.debug('Joined room removed', { roomId });
        return { joinedRoomIds: newJoined };
      });
    },

    isJoined: (roomId: string) => {
      return get().joinedRoomIds.has(roomId);
    },

    setJoinedRoomIds: (ids: Set<string>) => {
      set({ joinedRoomIds: ids });
      log.debug('Joined room IDs set', { count: ids.size });
    },

    // =========================================================================
    // Creator Operations
    // =========================================================================

    addCreatedRoom: (roomId: string) => {
      set((state) => {
        if (state.createdRoomIds.has(roomId)) return state;
        const newCreated = new Set(state.createdRoomIds);
        newCreated.add(roomId);
        log.debug('Created room added', { roomId });
        return { createdRoomIds: newCreated };
      });
    },

    isCreator: (roomId: string) => {
      return get().createdRoomIds.has(roomId);
    },

    setCreatedRoomIds: (ids: Set<string>) => {
      set({ createdRoomIds: ids });
      log.debug('Created room IDs set', { count: ids.size });
    },

    // =========================================================================
    // Operation Status
    // =========================================================================

    startOperation: (type, roomId) => {
      set((state) => {
        const prefix = type === 'join' ? 'joining' : type === 'leave' ? 'leaving' : 'closing';
        const key = `${prefix}RoomIds` as keyof RoomStoreState;
        const currentSet = state[key] as Set<string>;
        if (currentSet.has(roomId)) return state;

        const nextSet = new Set(currentSet);
        nextSet.add(roomId);
        return { [key]: nextSet };
      });
    },

    stopOperation: (type, roomId) => {
      set((state) => {
        const prefix = type === 'join' ? 'joining' : type === 'leave' ? 'leaving' : 'closing';
        const key = `${prefix}RoomIds` as keyof RoomStoreState;
        const currentSet = state[key] as Set<string>;
        if (!currentSet.has(roomId)) return state;

        const nextSet = new Set(currentSet);
        nextSet.delete(roomId);
        return { [key]: nextSet };
      });
    },

    // =========================================================================
    // Discovery Operations
    // =========================================================================

    setDiscoveredRoomIds: (ids: Set<string>) => {
      set({ discoveredRoomIds: ids });
    },

    addDiscoveredRoomIds: (ids: string[]) => {
      set((state) => {
        const newDiscovered = new Set(state.discoveredRoomIds);
        ids.forEach((id) => newDiscovered.add(id));
        return { discoveredRoomIds: newDiscovered };
      });
    },

    // =========================================================================
    // Mute Operations
    // =========================================================================

    muteRoom: (roomId: string) => {
      set((state) => {
        if (state.mutedRoomIds.has(roomId)) return state;
        const newMuted = new Set(state.mutedRoomIds);
        newMuted.add(roomId);
        // Persist to storage
        storage.set(MUTED_ROOMS_STORAGE_KEY, Array.from(newMuted));
        log.debug('Room muted', { roomId });
        return { mutedRoomIds: newMuted };
      });
    },

    unmuteRoom: (roomId: string) => {
      set((state) => {
        if (!state.mutedRoomIds.has(roomId)) return state;
        const newMuted = new Set(state.mutedRoomIds);
        newMuted.delete(roomId);
        // Persist to storage
        storage.set(MUTED_ROOMS_STORAGE_KEY, Array.from(newMuted));
        log.debug('Room unmuted', { roomId });
        return { mutedRoomIds: newMuted };
      });
    },

    toggleMuteRoom: (roomId: string) => {
      const isMuted = get().mutedRoomIds.has(roomId);
      if (isMuted) {
        get().unmuteRoom(roomId);
      } else {
        get().muteRoom(roomId);
      }
    },

    isRoomMuted: (roomId: string) => {
      return get().mutedRoomIds.has(roomId);
    },

    loadMutedRooms: async () => {
      try {
        const saved = await storage.get<string[]>(MUTED_ROOMS_STORAGE_KEY);
        if (saved && Array.isArray(saved)) {
          set({ mutedRoomIds: new Set(saved) });
          log.debug('Loaded muted rooms', { count: saved.length });
        }
      } catch (error) {
        log.error('Failed to load muted rooms', { error });
      }
    },

    // =========================================================================
    // UI State Operations
    // =========================================================================

    setSelectedRoom: (roomId: string | null) => {
      set({ selectedRoomId: roomId });
    },

    setLoading: (isLoading: boolean) => {
      set({ isLoading });
    },

    setLoadingMore: (isLoadingMore: boolean) => {
      set({ isLoadingMore });
    },

    setPagination: (page: number, hasMore: boolean) => {
      set({ currentPage: page, hasMoreRooms: hasMore });
    },

    // =========================================================================
    // Reset
    // =========================================================================

    reset: () => {
      set(initialState);
      log.debug('Store reset');
    },

    // =========================================================================
    // Discovery Transient State Operations
    // =========================================================================

    hideRoom: (roomId, ttlMs = 300000) => { // Default 5 mins
      set((state) => {
        if (state.hiddenRoomIds.has(roomId)) return state;
        const next = new Set(state.hiddenRoomIds);
        next.add(roomId);

        // Auto-cleanup after TTL
        setTimeout(() => {
          get().showRoom(roomId);
        }, ttlMs);

        return { hiddenRoomIds: next };
      });
    },

    showRoom: (roomId) => {
      set((state) => {
        if (!state.hiddenRoomIds.has(roomId)) return state;
        const next = new Set(state.hiddenRoomIds);
        next.delete(roomId);
        return { hiddenRoomIds: next };
      });
    },

    isHidden: (roomId) => {
      return get().hiddenRoomIds.has(roomId);
    },

    addPendingRoom: (roomId, ttlMs = 30000) => { // Default 30s
      set((state) => {
        if (state.pendingRoomIds.has(roomId)) return state;
        const next = new Set(state.pendingRoomIds);
        next.add(roomId);

        // Auto-cleanup after TTL
        setTimeout(() => {
          get().removePendingRoom(roomId);
        }, ttlMs);

        return { pendingRoomIds: next };
      });
    },

    removePendingRoom: (roomId) => {
      set((state) => {
        if (!state.pendingRoomIds.has(roomId)) return state;
        const next = new Set(state.pendingRoomIds);
        next.delete(roomId);
        return { pendingRoomIds: next };
      });
    },

    isPending: (roomId) => {
      return get().pendingRoomIds.has(roomId);
    },
  }))
);

// =============================================================================
// Selectors (for optimized subscriptions)
// =============================================================================

/**
 * Select a single room by ID
 * Memoized via Zustand's shallow comparison
 */
export const selectRoom = (roomId: string) => (state: RoomStore) =>
  state.rooms.get(roomId);

/**
 * Select all discovered rooms as array
 */
export const selectDiscoveredRooms = (state: RoomStore): Room[] => {
  const rooms: Room[] = [];
  state.discoveredRoomIds.forEach((id) => {
    const room = state.rooms.get(id);
    if (room) {
      rooms.push({
        ...room,
        hasJoined: state.joinedRoomIds.has(id),
      });
    }
  });
  return rooms;
};

/**
 * Select active (non-expired, non-closed) rooms
 */
export const selectActiveRooms = (state: RoomStore): Room[] => {
  const now = new Date();
  return selectDiscoveredRooms(state).filter(
    (room) => room.status !== 'closed' && room.expiresAt > now
  );
};

/**
 * Select user's joined rooms
 */
export const selectMyRooms = (state: RoomStore): Room[] => {
  const rooms: Room[] = [];
  state.joinedRoomIds.forEach((id) => {
    const room = state.rooms.get(id);
    if (room) {
      rooms.push({ ...room, hasJoined: true });
    }
  });
  // Sort by most recent first
  return rooms.sort(
    (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
  );
};

/**
 * Check if a room is joined
 */
export const selectIsJoined = (roomId: string) => (state: RoomStore) =>
  state.joinedRoomIds.has(roomId);

/**
 * Check if a room is muted
 */
export const selectIsRoomMuted = (roomId: string) => (state: RoomStore) =>
  state.mutedRoomIds.has(roomId);

/**
 * Select loading state
 */
export const selectIsLoading = (state: RoomStore) => state.isLoading;

/**
 * Select pagination state
 */
export const selectPagination = (state: RoomStore) => ({
  currentPage: state.currentPage,
  hasMoreRooms: state.hasMoreRooms,
  isLoadingMore: state.isLoadingMore,
});

// =============================================================================
// Derived Hooks (for common use cases)
// =============================================================================

/**
 * Hook to get a single room with membership status
 */
export function useStoreRoom(roomId: string): Room | undefined {
  return useRoomStore((state) => {
    const room = state.rooms.get(roomId);
    if (!room) return undefined;
    return {
      ...room,
      hasJoined: state.joinedRoomIds.has(roomId),
    };
  });
}

/**
 * Hook to check if user has joined a room
 */
export function useIsRoomJoinedStore(roomId: string): boolean {
  return useRoomStore((state) => state.joinedRoomIds.has(roomId));
}

/**
 * Hook to check if a room is muted
 */
export function useIsRoomMutedStore(roomId: string): boolean {
  return useRoomStore((state) => state.mutedRoomIds.has(roomId));
}

/**
 * Hook to get all joined rooms
 */
export function useMyRoomsStore(): Room[] {
  return useRoomStore(selectMyRooms);
}

/**
 * Hook to get discovered rooms
 */
export function useDiscoveredRoomsStore(): Room[] {
  return useRoomStore(selectDiscoveredRooms);
}

/**
 * Hook to get active rooms
 */
export function useActiveRoomsStore(): Room[] {
  return useRoomStore(selectActiveRooms);
}

export default useRoomStore;
