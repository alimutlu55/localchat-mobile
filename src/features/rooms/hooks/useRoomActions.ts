/**
 * useRoomActions Hook
 *
 * Encapsulates room join/leave/close operations with optimistic updates.
 * This hook handles the "how" of room operations, while RoomContext handles the "what" (storage).
 *
 * Design Decisions:
 * - Returns stable function references (useCallback)
 * - Handles optimistic UI updates internally
 * - Provides operation status for UI feedback
 * - Uses centralized error classification
 *
 * @example
 * ```typescript
 * const { joinRoom, leaveRoom, closeRoom, isJoining, isLeaving } = useRoomActions();
 *
 * const handleJoin = async () => {
 *   const result = await joinRoom(room);
 *   if (result.success) {
 *     navigation.navigate('ChatRoom', { roomId: room.id });
 *   } else if (result.error?.code === 'BANNED') {
 *     showBannedAlert();
 *   }
 * };
 * ```
 */

import { useCallback, useState, useRef } from 'react';
import { roomService } from '../../../services';
import { Room } from '../../../types';
import { useRoomStore } from '../store';
import { useMyRooms } from './useMyRooms';
import { useJoinRoom } from './useJoinRoom';
import {
  isUserBanned,
  AppError,
} from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomActions');

// =============================================================================
// Types
// =============================================================================

interface ActionResult {
  success: boolean;
  error?: AppError;
}

interface RoomActionsState {
  joiningRoomIds: Set<string>;
  leavingRoomIds: Set<string>;
  closingRoomIds: Set<string>;
}

interface RoomActionsReturn {
  /** Join a room with optimistic update */
  joinRoom: (room: Room) => Promise<ActionResult>;
  /** Leave a room */
  leaveRoom: (roomId: string) => Promise<ActionResult>;
  /** Close a room (creator only) */
  closeRoom: (roomId: string) => Promise<ActionResult>;
  /** Check if a specific room is being joined */
  isJoining: (roomId: string) => boolean;
  /** Check if a specific room is being left */
  isLeaving: (roomId: string) => boolean;
  /** Check if a specific room is being closed */
  isClosing: (roomId: string) => boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRoomActions(): RoomActionsReturn {
  // Get store methods for state updates
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const { isJoined: isRoomJoined } = useMyRooms();
  const { join: joinRoomHook, leave: leaveRoomHook } = useJoinRoom();

  // Track ongoing operations
  const [state, setState] = useState<RoomActionsState>({
    joiningRoomIds: new Set(),
    leavingRoomIds: new Set(),
    closingRoomIds: new Set(),
  });

  // Use ref to avoid stale closure issues in async operations
  const stateRef = useRef(state);
  stateRef.current = state;

  // ==========================================================================
  // Helper: Update operation status
  // ==========================================================================

  const setOperationStatus = useCallback(
    (
      operation: keyof RoomActionsState,
      roomId: string,
      isActive: boolean
    ) => {
      setState((prev) => {
        const newSet = new Set(prev[operation]);
        if (isActive) {
          newSet.add(roomId);
        } else {
          newSet.delete(roomId);
        }
        return { ...prev, [operation]: newSet };
      });
    },
    []
  );

  // ==========================================================================
  // Join Room
  // ==========================================================================

  const joinRoom = useCallback(
    async (room: Room): Promise<ActionResult> => {
      const roomId = room.id;

      // Guards
      if (stateRef.current.joiningRoomIds.has(roomId)) {
        log.warn('Already joining room', { roomId });
        return { success: false, error: AppError.from(new Error('Already joining')) };
      }

      if (isRoomJoined(roomId)) {
        log.debug('Already a member', { roomId });
        return { success: true };
      }

      if (stateRef.current.leavingRoomIds.has(roomId)) {
        log.warn('Currently leaving room', { roomId });
        return { success: false, error: AppError.from(new Error('Currently leaving')) };
      }

      log.debug('Joining room', { roomId, title: room.title });
      setOperationStatus('joiningRoomIds', roomId, true);

      try {
        // Use useJoinRoom hook which properly updates store
        const result = await joinRoomHook(room);
        
        if (result.success) {
          log.info('Successfully joined room', { roomId });
          return { success: true };
        } else {
          log.error('Join room returned false', { roomId, error: result.error });
          return {
            success: false,
            error: result.error?.code === 'BANNED' 
              ? AppError.banned(roomId)
              : AppError.from(new Error(result.error?.message || 'Failed to join room')),
          };
        }
      } catch (error) {
        // Handle banned user
        if (isUserBanned(error)) {
          log.info('User is banned from room', { roomId });
          return {
            success: false,
            error: AppError.banned(roomId),
          };
        }

        // Other errors
        log.error('Failed to join room', error);
        return {
          success: false,
          error: AppError.from(error),
        };
      } finally {
        setOperationStatus('joiningRoomIds', roomId, false);
      }
    },
    [isRoomJoined, joinRoomHook, setOperationStatus]
  );

  // ==========================================================================
  // Leave Room
  // ==========================================================================

  const leaveRoom = useCallback(
    async (roomId: string): Promise<ActionResult> => {
      // Guards
      if (stateRef.current.leavingRoomIds.has(roomId)) {
        log.warn('Already leaving room', { roomId });
        return { success: false, error: AppError.from(new Error('Already leaving')) };
      }

      if (!isRoomJoined(roomId)) {
        log.debug('Not a member of room', { roomId });
        return { success: true };
      }

      log.debug('Leaving room', { roomId });
      setOperationStatus('leavingRoomIds', roomId, true);

      try {
        // Use useJoinRoom hook which properly updates store
        // and handles WebSocket unsubscription
        const result = await leaveRoomHook(roomId);

        if (result.success) {
          log.info('Successfully left room', { roomId });
          return { success: true };
        } else {
          log.error('Leave room returned false', { roomId });
          return {
            success: false,
            error: AppError.from(new Error(result.error?.message || 'Failed to leave room')),
          };
        }
      } catch (error) {
        log.error('Failed to leave room', error);
        return {
          success: false,
          error: AppError.from(error),
        };
      } finally {
        setOperationStatus('leavingRoomIds', roomId, false);
      }
    },
    [isRoomJoined, leaveRoomHook, setOperationStatus]
  );

  // ==========================================================================
  // Close Room (Creator Only)
  // ==========================================================================

  const closeRoom = useCallback(
    async (roomId: string): Promise<ActionResult> => {
      if (stateRef.current.closingRoomIds.has(roomId)) {
        log.warn('Already closing room', { roomId });
        return { success: false, error: AppError.from(new Error('Already closing')) };
      }

      log.debug('Closing room', { roomId });
      setOperationStatus('closingRoomIds', roomId, true);

      try {
        await roomService.closeRoom(roomId);

        log.info('Successfully closed room', { roomId });

        // Update room status
        updateRoom(roomId, { status: 'closed' });

        return { success: true };
      } catch (error) {
        log.error('Failed to close room', error);
        return {
          success: false,
          error: AppError.from(error),
        };
      } finally {
        setOperationStatus('closingRoomIds', roomId, false);
      }
    },
    [updateRoom, setOperationStatus]
  );

  // ==========================================================================
  // Status Checks
  // ==========================================================================

  const isJoining = useCallback(
    (roomId: string) => state.joiningRoomIds.has(roomId),
    [state.joiningRoomIds]
  );

  const isLeaving = useCallback(
    (roomId: string) => state.leavingRoomIds.has(roomId),
    [state.leavingRoomIds]
  );

  const isClosing = useCallback(
    (roomId: string) => state.closingRoomIds.has(roomId),
    [state.closingRoomIds]
  );

  return {
    joinRoom,
    leaveRoom,
    closeRoom,
    isJoining,
    isLeaving,
    isClosing,
  };
}

export default useRoomActions;
