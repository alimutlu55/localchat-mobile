/**
 * useRoomOperations Hook
 *
 * Consolidates all room-related actions into a single, robust interface.
 * Handles join, leave, close, kick, and ban operations.
 *
 * Design Decisions:
 * - Uses RoomStore for global operation status (joiningRoomIds, etc.)
 * - Returns standardized Result type for all actions
 * - Standardizes loading/busy states
 * - Provides consistent error handling via AppError
 */

import { useCallback } from 'react';
import { Room } from '../../../types';
import { roomService, wsService } from '../../../services';
import { useRoomStore } from '../store';
import {
    Result,
    AppError,
    isConflictError,
} from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomOperations');

export interface UseRoomOperationsReturn {
    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------

    /** Join a room - requires user's current location for proximity validation */
    join: (room: Room, userLocation: { latitude: number; longitude: number }) => Promise<Result<Room>>;

    /** Leave a room */
    leave: (roomId: string) => Promise<Result>;

    /** Close a room (creator only) */
    close: (roomId: string) => Promise<Result>;

    /** Kick a user from the room (creator/moderator only) */
    kick: (roomId: string, userId: string) => Promise<Result>;

    /** Ban a user from the room (creator/moderator only) */
    ban: (roomId: string, userId: string, reason?: string) => Promise<Result>;

    /** Unban a user from the room (creator/moderator only) */
    unban: (roomId: string, userId: string) => Promise<Result>;

    // -------------------------------------------------------------------------
    // Status Checks
    // -------------------------------------------------------------------------

    /** Whether a room is currently being joined */
    isJoining: (roomId: string) => boolean;

    /** Whether a room is currently being left */
    isLeaving: (roomId: string) => boolean;

    /** Whether a room is currently being closed */
    isClosing: (roomId: string) => boolean;

    /** Whether any operation is in progress for a room */
    isBusy: (roomId: string) => boolean;
}

export function useRoomOperations(): UseRoomOperationsReturn {
    // Store actions
    const setRoom = useRoomStore((s) => s.setRoom);
    const updateRoom = useRoomStore((s) => s.updateRoom);
    const addJoinedRoom = useRoomStore((s) => s.addJoinedRoom);
    const removeJoinedRoom = useRoomStore((s) => s.removeJoinedRoom);
    const startOp = useRoomStore((s) => s.startOperation);
    const stopOp = useRoomStore((s) => s.stopOperation);

    // Store state for status checks
    const joiningIds = useRoomStore((s) => s.joiningRoomIds);
    const leavingIds = useRoomStore((s) => s.leavingRoomIds);
    const closingIds = useRoomStore((s) => s.closingRoomIds);

    const isJoining = useCallback((roomId: string) => joiningIds.has(roomId), [joiningIds]);
    const isLeaving = useCallback((roomId: string) => leavingIds.has(roomId), [leavingIds]);
    const isClosing = useCallback((roomId: string) => closingIds.has(roomId), [closingIds]);

    const isBusy = useCallback(
        (roomId: string) => joiningIds.has(roomId) || leavingIds.has(roomId) || closingIds.has(roomId),
        [joiningIds, leavingIds, closingIds]
    );

    /**
     * Join a room
     */
    const join = useCallback(
        async (room: Room, userLocation: { latitude: number; longitude: number }): Promise<Result<Room>> => {
            const roomId = room.id;

            // Use getState() for synchronous check to avoid race conditions on rapid clicks
            const state = useRoomStore.getState();
            const busy = state.joiningRoomIds.has(roomId) ||
                state.leavingRoomIds.has(roomId) ||
                state.closingRoomIds.has(roomId);

            if (busy) {
                log.warn('Join skipped - operation already in progress', { roomId });
                return { success: false, error: AppError.from('Operation already in progress') };
            }

            log.info('Joining room - start', { roomId });
            startOp('join', roomId);

            // Optimistic update
            setRoom({ ...room, hasJoined: true });
            addJoinedRoom(roomId);

            log.info('RoomOperations.join - calling service', { roomId, userLocation });
            try {
                // Use user's actual location, not the room's location
                // This is critical for nearBy rooms where the backend validates
                // that the user is within the room's visibility radius
                await roomService.joinRoom(
                    roomId,
                    userLocation.latitude,
                    userLocation.longitude,
                    room.radius ?? 500
                );

                let finalRoom = room;
                try {
                    finalRoom = await roomService.getRoom(roomId);
                    setRoom({ ...finalRoom, hasJoined: true });
                } catch (fetchError) {
                    log.warn('Failed to fetch fresh room data after join', fetchError);
                }

                log.info('Join successful - finished', { roomId });
                return { success: true, data: finalRoom };
            } catch (error: any) {
                log.error('Join failed', { roomId, error });

                if (isConflictError(error)) {
                    log.debug('Already joined (from backend)', { roomId });
                    return { success: true, data: room };
                }

                updateRoom(roomId, { hasJoined: false });
                removeJoinedRoom(roomId);
                return { success: false, error: AppError.from(error) };
            } finally {
                stopOp('join', roomId);
            }
        },
        [startOp, stopOp, setRoom, addJoinedRoom, updateRoom, removeJoinedRoom]
    );

    /**
     * Leave a room
     */
    const leave = useCallback(
        async (roomId: string): Promise<Result> => {
            // Use getState() for synchronous check
            const state = useRoomStore.getState();
            const busy = state.joiningRoomIds.has(roomId) ||
                state.leavingRoomIds.has(roomId) ||
                state.closingRoomIds.has(roomId);

            if (busy) {
                log.warn('Leave skipped - operation already in progress', { roomId });
                return { success: false, error: AppError.from('Operation already in progress') };
            }

            log.info('Leaving room - start', { roomId });
            startOp('leave', roomId);

            // Optimistic update
            updateRoom(roomId, { hasJoined: false });
            removeJoinedRoom(roomId);

            try {
                await roomService.leaveRoom(roomId);
                wsService.unsubscribe(roomId);
                log.info('Leave successful', { roomId });
                return { success: true, data: undefined };
            } catch (error: any) {
                log.error('Leave failed', { roomId, error });
                updateRoom(roomId, { hasJoined: true });
                addJoinedRoom(roomId);
                return { success: false, error: AppError.from(error) };
            } finally {
                stopOp('leave', roomId);
            }
        },
        [startOp, stopOp, updateRoom, removeJoinedRoom, addJoinedRoom]
    );

    /**
     * Close a room
     */
    const close = useCallback(
        async (roomId: string): Promise<Result> => {
            // Use getState() for synchronous check
            const state = useRoomStore.getState();
            const busy = state.joiningRoomIds.has(roomId) ||
                state.leavingRoomIds.has(roomId) ||
                state.closingRoomIds.has(roomId);

            if (busy) {
                log.warn('Close skipped - operation already in progress', { roomId });
                return { success: false, error: AppError.from('Operation already in progress') };
            }

            log.info('Closing room - start', { roomId });
            startOp('close', roomId);

            try {
                await roomService.closeRoom(roomId);
                updateRoom(roomId, { status: 'closed' });
                log.info('Room closed', { roomId });
                return { success: true, data: undefined };
            } catch (error: any) {
                log.error('Close failed', { roomId, error });
                return { success: false, error: AppError.from(error) };
            } finally {
                stopOp('close', roomId);
            }
        },
        [startOp, stopOp, updateRoom]
    );

    /**
     * Kick a user
     */
    const kick = useCallback(
        async (roomId: string, userId: string): Promise<Result> => {
            log.debug('Kicking user', { roomId, userId });
            try {
                await roomService.kickUser(roomId, userId);
                log.info('User kicked', { roomId, userId });
                return { success: true, data: undefined };
            } catch (error: any) {
                log.error('Kick failed', { roomId, userId, error });
                return { success: false, error: AppError.from(error) };
            }
        },
        []
    );

    /**
     * Ban a user
     */
    const ban = useCallback(
        async (roomId: string, userId: string, reason?: string): Promise<Result> => {
            log.debug('Banning user', { roomId, userId });
            try {
                await roomService.banUser(roomId, userId, reason);
                log.info('User banned', { roomId, userId });
                return { success: true, data: undefined };
            } catch (error: any) {
                log.error('Ban failed', { roomId, userId, error });
                return { success: false, error: AppError.from(error) };
            }
        },
        []
    );

    /**
     * Unban a user
     */
    const unban = useCallback(
        async (roomId: string, userId: string): Promise<Result> => {
            log.debug('Unbanning user', { roomId, userId });
            try {
                await roomService.unbanUser(roomId, userId);
                log.info('User unbanned', { roomId, userId });
                return { success: true, data: undefined };
            } catch (error: any) {
                log.error('Unban failed', { roomId, userId, error });
                return { success: false, error: AppError.from(error) };
            }
        },
        []
    );

    return {
        join,
        leave,
        close,
        kick,
        ban,
        unban,
        isJoining,
        isLeaving,
        isClosing,
        isBusy,
    };
}

export default useRoomOperations;
