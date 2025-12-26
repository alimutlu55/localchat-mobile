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
import { useRoomCache } from '../context/RoomCacheContext';
import { useMyRooms } from './useMyRooms';
import { useJoinRoom, JoinResult } from './useJoinRoom';
import { roomService, wsService } from '../../../services';
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

  /** Join a room */
  join: (room: Room) => Promise<JoinResult>;

  /** Leave a room */
  leave: (roomId: string) => Promise<JoinResult>;

  /** Close a room (creator only) */
  close: (roomId: string) => Promise<{ success: boolean; error?: string }>;

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
  // Compose hooks
  const roomCache = useRoomCache();
  const {
    rooms: myRooms,
    activeRooms,
    expiredRooms,
    joinedIds,
    isJoined,
    isLoading: isLoadingMyRooms,
    refresh: refreshMyRooms,
    addRoom: addToMyRooms,
    removeRoom: removeFromMyRooms,
  } = useMyRooms();

  const {
    join: joinInternal,
    leave: leaveInternal,
    isJoining,
    isLeaving,
  } = useJoinRoom();

  // -------------------------------------------------------------------------
  // Room Data Operations
  // -------------------------------------------------------------------------

  const getRoom = useCallback(
    (roomId: string): Room | null => {
      return roomCache.getRoom(roomId);
    },
    [roomCache]
  );

  const hasRoom = useCallback(
    (roomId: string): boolean => {
      return roomCache.hasRoom(roomId);
    },
    [roomCache]
  );

  const updateRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      roomCache.updateRoom(roomId, updates);
    },
    [roomCache]
  );

  // -------------------------------------------------------------------------
  // Room Operations
  // -------------------------------------------------------------------------

  /**
   * Join a room with membership tracking
   */
  const join = useCallback(
    async (room: Room): Promise<JoinResult> => {
      const result = await joinInternal(room);

      if (result.success) {
        // Add to my rooms list
        addToMyRooms(room);
      }

      return result;
    },
    [joinInternal, addToMyRooms]
  );

  /**
   * Leave a room with membership tracking
   */
  const leave = useCallback(
    async (roomId: string): Promise<JoinResult> => {
      const result = await leaveInternal(roomId);

      if (result.success) {
        // Remove from my rooms list
        removeFromMyRooms(roomId);
      }

      return result;
    },
    [leaveInternal, removeFromMyRooms]
  );

  /**
   * Close a room (creator only)
   */
  const close = useCallback(
    async (roomId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await roomService.closeRoom(roomId);
        
        // Update room status in cache
        updateRoom(roomId, { status: 'closed' });
        
        log.info('Room closed', { roomId });
        return { success: true };
      } catch (error: any) {
        log.error('Failed to close room', { roomId, error });
        return {
          success: false,
          error: error?.message || 'Failed to close room',
        };
      }
    },
    [updateRoom]
  );

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
