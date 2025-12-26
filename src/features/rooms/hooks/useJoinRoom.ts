/**
 * useJoinRoom Hook
 *
 * Handles room join/leave operations with:
 * - Optimistic updates
 * - Loading state tracking
 * - Error handling with specific error types
 * - Rollback on failure
 *
 * This is a more focused alternative to useRoomActions for join-specific operations.
 *
 * Usage:
 * ```typescript
 * const { join, leave, isJoining, isLeaving, error } = useJoinRoom();
 *
 * const result = await join(room);
 * if (result.success) {
 *   // Navigate to chat
 * } else if (result.error?.code === 'BANNED') {
 *   // Show banned message
 * }
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { Room } from '../../../types';
import { roomService, wsService } from '../../../services';
import { useRoomCache } from '../context/RoomCacheContext';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('JoinRoom');

// =============================================================================
// Types
// =============================================================================

export interface JoinError {
  code: 'BANNED' | 'ROOM_FULL' | 'ROOM_CLOSED' | 'NETWORK' | 'UNKNOWN';
  message: string;
}

export interface JoinResult {
  success: boolean;
  error?: JoinError;
}

export interface UseJoinRoomReturn {
  /**
   * Join a room
   * @param room - Room to join
   * @returns Result with success flag and optional error
   */
  join: (room: Room) => Promise<JoinResult>;

  /**
   * Leave a room
   * @param roomId - ID of room to leave
   * @returns Result with success flag
   */
  leave: (roomId: string) => Promise<JoinResult>;

  /**
   * Check if currently joining a specific room
   */
  isJoining: (roomId: string) => boolean;

  /**
   * Check if currently leaving a specific room
   */
  isLeaving: (roomId: string) => boolean;

  /**
   * Set of room IDs currently being joined
   */
  joiningIds: Set<string>;

  /**
   * Set of room IDs currently being left
   */
  leavingIds: Set<string>;
}

// =============================================================================
// Error Detection Helpers
// =============================================================================

function isBannedError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toLowerCase() || '';
  return (
    message.includes('banned') ||
    code === 'banned' ||
    code === 'user_banned'
  );
}

function isRoomFullError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('full') || message.includes('maximum');
}

function isRoomClosedError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toLowerCase() || '';
  return message.includes('closed') || code === 'room_closed';
}

function isAlreadyJoinedError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toLowerCase() || '';
  return (
    message.includes('already') ||
    code === 'conflict' ||
    error?.status === 409
  );
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useJoinRoom(): UseJoinRoomReturn {
  const { setRoom, updateRoom, getRoom } = useRoomCache();

  // Track in-flight operations
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  // Refs to access latest state in async operations
  const joiningIdsRef = useRef(joiningIds);
  joiningIdsRef.current = joiningIds;
  const leavingIdsRef = useRef(leavingIds);
  leavingIdsRef.current = leavingIds;

  /**
   * Check if currently joining a room
   */
  const isJoining = useCallback(
    (roomId: string): boolean => joiningIds.has(roomId),
    [joiningIds]
  );

  /**
   * Check if currently leaving a room
   */
  const isLeaving = useCallback(
    (roomId: string): boolean => leavingIds.has(roomId),
    [leavingIds]
  );

  /**
   * Join a room
   */
  const join = useCallback(
    async (room: Room): Promise<JoinResult> => {
      const roomId = room.id;

      // Guard: already joining
      if (joiningIdsRef.current.has(roomId)) {
        log.warn('Already joining room', { roomId });
        return { success: false, error: { code: 'UNKNOWN', message: 'Already joining' } };
      }

      // Guard: currently leaving (wait for leave to complete)
      if (leavingIdsRef.current.has(roomId)) {
        log.warn('Currently leaving room', { roomId });
        return { success: false, error: { code: 'UNKNOWN', message: 'Currently leaving' } };
      }

      log.debug('Joining room', { roomId });

      // Mark as joining
      setJoiningIds((prev) => new Set(prev).add(roomId));

      // Optimistic update - cache the room with hasJoined flag
      setRoom({ ...room, hasJoined: true });

      try {
        await roomService.joinRoom(
          roomId,
          room.latitude ?? 0,
          room.longitude ?? 0,
          room.radius
        );

        // Fetch fresh room data for accurate participant count
        try {
          const freshRoom = await roomService.getRoom(roomId);
          setRoom({ ...freshRoom, hasJoined: true });
        } catch (fetchError) {
          log.warn('Failed to fetch fresh room data after join', fetchError);
        }

        log.info('Join successful', { roomId });
        return { success: true };
      } catch (error: any) {
        log.error('Join failed', { roomId, error });

        // Check for "already joined" - treat as success
        if (isAlreadyJoinedError(error)) {
          log.debug('Already joined (from backend)', { roomId });
          return { success: true };
        }

        // Rollback optimistic update
        updateRoom(roomId, { hasJoined: false });

        // Determine error type
        if (isBannedError(error)) {
          return {
            success: false,
            error: { code: 'BANNED', message: 'You are banned from this room' },
          };
        }
        if (isRoomFullError(error)) {
          return {
            success: false,
            error: { code: 'ROOM_FULL', message: 'This room is full' },
          };
        }
        if (isRoomClosedError(error)) {
          return {
            success: false,
            error: { code: 'ROOM_CLOSED', message: 'This room is closed' },
          };
        }

        return {
          success: false,
          error: {
            code: 'UNKNOWN',
            message: error?.message || 'Failed to join room',
          },
        };
      } finally {
        setJoiningIds((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [setRoom, updateRoom]
  );

  /**
   * Leave a room
   */
  const leave = useCallback(
    async (roomId: string): Promise<JoinResult> => {
      // Guard: already leaving
      if (leavingIdsRef.current.has(roomId)) {
        log.warn('Already leaving room', { roomId });
        return { success: false, error: { code: 'UNKNOWN', message: 'Already leaving' } };
      }

      log.debug('Leaving room', { roomId });

      // Mark as leaving
      setLeavingIds((prev) => new Set(prev).add(roomId));

      // Optimistic update
      updateRoom(roomId, { hasJoined: false });

      try {
        await roomService.leaveRoom(roomId);

        // Unsubscribe from WebSocket
        wsService.unsubscribe(roomId);

        log.info('Leave successful', { roomId });
        return { success: true };
      } catch (error: any) {
        log.error('Leave failed', { roomId, error });

        // Rollback optimistic update
        updateRoom(roomId, { hasJoined: true });

        return {
          success: false,
          error: {
            code: 'UNKNOWN',
            message: error?.message || 'Failed to leave room',
          },
        };
      } finally {
        setLeavingIds((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [updateRoom]
  );

  return {
    join,
    leave,
    isJoining,
    isLeaving,
    joiningIds,
    leavingIds,
  };
}

export default useJoinRoom;
