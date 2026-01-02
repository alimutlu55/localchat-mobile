/**
 * useRoomState Hook
 *
 * Central coordinator for room state management.
 * Combines multiple specialized hooks into a unified API.
 *
 * This hook is designed to eventually replace RoomContext by:
 * - Composing smaller, focused hooks
 * - Providing a single import for common room operations
 * - Maintaining backward compatibility with existing screens
 *
 * Usage:
 * ```typescript
 * const {
 *   // Room data
 *   getRoom,
 *   myRooms,
 *   isJoined,
 *
 *   // Operations
 *   join,
 *   leave,
 *   close,
 *
 *   // Loading states
 *   isJoining,
 *   isLeaving,
 * } = useRoomState();
 * ```
 */

import { useCallback, useMemo } from 'react';
import { Room } from '../../../types';
import { useRoomStore } from '../store';
import { useMyRooms } from './useMyRooms';
import { useRoomOperations } from './useRoomOperations';
import {
  Result,
  AppError,
} from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomState');

// =============================================================================
// Types
// =============================================================================

export interface UseRoomStateReturn {
  // -------------------------------------------------------------------------
  // Room Data
  // -------------------------------------------------------------------------

  /** Get a room from cache by ID */
  getRoom: (roomId: string) => Room | null;

  /** Check if room is in cache */
  hasRoom: (roomId: string) => boolean;

  /** Update a room in cache */
  updateRoom: (roomId: string, updates: Partial<Room>) => void;

  /** User's joined/created rooms */
  myRooms: Room[];

  /** Active rooms only (non-expired) */
  activeRooms: Room[];

  /** Expired rooms */
  expiredRooms: Room[];

  /** Set of joined room IDs */
  joinedIds: Set<string>;

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  /** Check if user has joined a room */
  isJoined: (roomId: string) => boolean;

  /** Check if currently joining a room */
  isJoining: (roomId: string) => boolean;

  /** Check if currently leaving a room */
  isLeaving: (roomId: string) => boolean;

  // -------------------------------------------------------------------------
  // Operations
  // -------------------------------------------------------------------------

  /** Join a room - requires user's current location for proximity validation */
  join: (room: Room, userLocation: { latitude: number; longitude: number }) => Promise<Result<Room>>;

  /** Leave a room */
  leave: (roomId: string) => Promise<Result>;

  /** Close a room (creator only) */
  close: (roomId: string) => Promise<Result>;

  // -------------------------------------------------------------------------
  // Loading States
  // -------------------------------------------------------------------------

  /** Whether my rooms are loading */
  isLoadingMyRooms: boolean;

  /** Refresh my rooms from API */
  refreshMyRooms: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRoomState(): UseRoomStateReturn {
  // Use RoomStore
  const storeGetRoom = useRoomStore((s) => s.getRoom);
  const storeUpdateRoom = useRoomStore((s) => s.updateRoom);
  const storeRooms = useRoomStore((s) => s.rooms);

  // Compose hooks
  const {
    rooms: myRooms,
    activeRooms,
    expiredRooms,
    joinedIds,
    isJoined,
    isLoading: isLoadingMyRooms,
    refresh: refreshMyRooms,
  } = useMyRooms();

  const {
    join,
    leave,
    close,
    isJoining,
    isLeaving,
  } = useRoomOperations();

  // -------------------------------------------------------------------------
  // Room Data Operations
  // -------------------------------------------------------------------------

  const getRoom = useCallback(
    (roomId: string): Room | null => {
      return storeGetRoom(roomId) || null;
    },
    [storeGetRoom]
  );

  const hasRoom = useCallback(
    (roomId: string): boolean => {
      return storeRooms.has(roomId);
    },
    [storeRooms]
  );

  const updateRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      storeUpdateRoom(roomId, updates);
    },
    [storeUpdateRoom]
  );

  // -------------------------------------------------------------------------
  // Room Operations
  // -------------------------------------------------------------------------

  return {
    // Room data
    getRoom,
    hasRoom,
    updateRoom,
    myRooms,
    activeRooms,
    expiredRooms,
    joinedIds,

    // Membership
    isJoined,
    isJoining,
    isLeaving,

    // Operations
    join,
    leave,
    close,

    // Loading states
    isLoadingMyRooms,
    refreshMyRooms,
  };
}

export default useRoomState;
