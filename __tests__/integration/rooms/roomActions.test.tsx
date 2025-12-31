/**
 * Room Actions Integration Tests
 *
 * Tests the join/leave/close room operations including:
 * - Optimistic updates
 * - Rollback on failure
 * - WebSocket subscriptions
 * - Error handling (banned, full, closed)
 * - Guard conditions (already joining, already joined)
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRoomStore } from '../../../src/features/rooms/store/RoomStore';
import { useRoomOperations } from '../../../src/features/rooms/hooks/useRoomOperations';
import {
  mockRoom,
  mockJoinedRoom,
  createMockRoom,
  mockRoomService,
  resetRoomServiceMock,
} from '../../mocks/roomMocks';
import { mockWsService, resetWsServiceMock } from '../../mocks/authMocks';

// Mock services
jest.mock('../../../src/services', () => ({
  roomService: require('../../mocks/roomMocks').mockRoomService,
  wsService: require('../../mocks/authMocks').mockWsService,
}));

describe('Room Actions Integration', () => {
  beforeEach(() => {
    // Reset store
    act(() => {
      useRoomStore.getState().reset();
    });

    // Reset mocks
    resetRoomServiceMock();
    resetWsServiceMock();
    jest.clearAllMocks();
  });

  // ===========================================================================
  // useRoomOperations Hook Tests
  // ===========================================================================

  describe('useRoomOperations', () => {
    describe('join', () => {
      it('successfully joins a room', async () => {
        const { result } = renderHook(() => useRoomOperations());

        const joinResult = await act(async () => {
          return result.current.join(mockRoom);
        });

        expect(joinResult.success).toBe(true);
        expect(mockRoomService.joinRoom).toHaveBeenCalledWith(
          mockRoom.id,
          mockRoom.latitude || 0,
          mockRoom.longitude || 0,
          mockRoom.radius
        );

        // Room should be in store and marked as joined
        expect(useRoomStore.getState().rooms.has(mockRoom.id)).toBe(true);
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(true);
      });

      it('applies optimistic update immediately', async () => {
        mockRoomService.joinRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        const { result } = renderHook(() => useRoomOperations());

        // Start join (don't await)
        act(() => {
          result.current.join(mockRoom);
        });

        // Optimistic update should be applied immediately
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(true);

        // Wait for completion
        await act(async () => {
          await new Promise((r) => setTimeout(r, 150));
        });
      });

      it('shows joining state during operation', async () => {
        mockRoomService.joinRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        const { result } = renderHook(() => useRoomOperations());

        expect(result.current.isJoining(mockRoom.id)).toBe(false);

        // Start join
        let joinPromise: Promise<any>;
        act(() => {
          joinPromise = result.current.join(mockRoom);
        });

        expect(result.current.isJoining(mockRoom.id)).toBe(true);

        await act(async () => {
          await joinPromise;
        });

        expect(result.current.isJoining(mockRoom.id)).toBe(false);
      });

      it('rolls back on failure', async () => {
        mockRoomService.joinRoom.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useRoomOperations());

        const joinResult = await act(async () => {
          return result.current.join(mockRoom);
        });

        expect(joinResult.success).toBe(false);

        // Optimistic update should be rolled back
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(false);
      });

      it('returns BANNED error for banned user', async () => {
        mockRoomService.joinRoom.mockRejectedValue({ message: 'User is banned' });

        const { result } = renderHook(() => useRoomOperations());

        const joinResult = await act(async () => {
          return result.current.join(mockRoom);
        });

        expect(joinResult.success).toBe(false);
        expect(joinResult.error?.message).toContain('banned');
      });

      it('treats already-joined as success', async () => {
        mockRoomService.joinRoom.mockRejectedValue({ message: 'User already in room', status: 409 });

        const { result } = renderHook(() => useRoomOperations());

        const joinResult = await act(async () => {
          return result.current.join(mockRoom);
        });

        expect(joinResult.success).toBe(true);
      });

      it('prevents duplicate join attempts', async () => {
        mockRoomService.joinRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        const { result } = renderHook(() => useRoomOperations());

        // First join
        act(() => {
          result.current.join(mockRoom);
        });

        // Try second join immediately
        const secondResult = await act(async () => {
          return result.current.join(mockRoom);
        });

        expect(secondResult.success).toBe(false);
        expect(secondResult.error?.message).toContain('already in progress');
        expect(mockRoomService.joinRoom).toHaveBeenCalledTimes(1);
      });

      it('fetches fresh room data after successful join', async () => {
        const freshRoom = { ...mockRoom, participantCount: 10 };
        mockRoomService.getRoom.mockResolvedValue(freshRoom);

        const { result } = renderHook(() => useRoomOperations());

        await act(async () => {
          await result.current.join(mockRoom);
        });

        expect(mockRoomService.getRoom).toHaveBeenCalledWith(mockRoom.id);

        const storedRoom = useRoomStore.getState().rooms.get(mockRoom.id);
        expect(storedRoom?.participantCount).toBe(10);
      });
    });

    describe('leave', () => {
      it('successfully leaves a room', async () => {
        // Setup: join room first
        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
          useRoomStore.getState().addJoinedRoom(mockRoom.id);
        });

        const { result } = renderHook(() => useRoomOperations());

        const leaveResult = await act(async () => {
          return result.current.leave(mockRoom.id);
        });

        expect(leaveResult.success).toBe(true);
        expect(mockRoomService.leaveRoom).toHaveBeenCalledWith(mockRoom.id);
        expect(mockWsService.unsubscribe).toHaveBeenCalledWith(mockRoom.id);

        // Should be removed from joined rooms
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(false);
      });

      it('applies optimistic update immediately', async () => {
        mockRoomService.leaveRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
          useRoomStore.getState().addJoinedRoom(mockRoom.id);
        });

        const { result } = renderHook(() => useRoomOperations());

        // Start leave
        act(() => {
          result.current.leave(mockRoom.id);
        });

        // Optimistic update should be applied immediately
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(false);
      });

      it('shows leaving state during operation', async () => {
        mockRoomService.leaveRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
          useRoomStore.getState().addJoinedRoom(mockRoom.id);
        });

        const { result } = renderHook(() => useRoomOperations());

        expect(result.current.isLeaving(mockRoom.id)).toBe(false);

        let leavePromise: Promise<any>;
        act(() => {
          leavePromise = result.current.leave(mockRoom.id);
        });

        expect(result.current.isLeaving(mockRoom.id)).toBe(true);

        await act(async () => {
          await leavePromise;
        });

        expect(result.current.isLeaving(mockRoom.id)).toBe(false);
      });

      it('rolls back on failure', async () => {
        mockRoomService.leaveRoom.mockRejectedValue(new Error('Network error'));

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
          useRoomStore.getState().addJoinedRoom(mockRoom.id);
        });

        const { result } = renderHook(() => useRoomOperations());

        const leaveResult = await act(async () => {
          return result.current.leave(mockRoom.id);
        });

        expect(leaveResult.success).toBe(false);

        // Optimistic update should be rolled back
        expect(useRoomStore.getState().joinedRoomIds.has(mockRoom.id)).toBe(true);
      });

      it('prevents duplicate leave attempts', async () => {
        mockRoomService.leaveRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
          useRoomStore.getState().addJoinedRoom(mockRoom.id);
        });

        const { result } = renderHook(() => useRoomOperations());

        // First leave
        act(() => {
          result.current.leave(mockRoom.id);
        });

        // Try second leave immediately
        const secondResult = await act(async () => {
          return result.current.leave(mockRoom.id);
        });

        expect(secondResult.success).toBe(false);
        expect(secondResult.error?.message).toContain('already in progress');
        expect(mockRoomService.leaveRoom).toHaveBeenCalledTimes(1);
      });
    });

    describe('close', () => {
      it('closes room and updates status', async () => {
        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
        });

        const { result } = renderHook(() => useRoomOperations());

        const closeResult = await act(async () => {
          return result.current.close(mockRoom.id);
        });

        expect(closeResult.success).toBe(true);
        expect(mockRoomService.closeRoom).toHaveBeenCalledWith(mockRoom.id);

        const room = useRoomStore.getState().rooms.get(mockRoom.id);
        expect(room?.status).toBe('closed');
      });

      it('shows closing state during operation', async () => {
        mockRoomService.closeRoom.mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
        });

        const { result } = renderHook(() => useRoomOperations());

        expect(result.current.isClosing(mockRoom.id)).toBe(false);

        let closePromise: Promise<any>;
        act(() => {
          closePromise = result.current.close(mockRoom.id);
        });

        expect(result.current.isClosing(mockRoom.id)).toBe(true);

        await act(async () => {
          await closePromise;
        });

        expect(result.current.isClosing(mockRoom.id)).toBe(false);
      });

      it('handles close failure', async () => {
        mockRoomService.closeRoom.mockRejectedValue(new Error('Not authorized'));

        act(() => {
          useRoomStore.getState().setRoom(mockRoom);
        });

        const { result } = renderHook(() => useRoomOperations());

        const closeResult = await act(async () => {
          return result.current.close(mockRoom.id);
        });

        expect(closeResult.success).toBe(false);
        expect(closeResult.error).toBeDefined();

        // Room status should not be changed on failure
        const room = useRoomStore.getState().rooms.get(mockRoom.id);
        expect(room?.status).toBe(mockRoom.status);
      });
    });
  });

  // ===========================================================================
  // Concurrent Operations Tests
  // ===========================================================================

  describe('Concurrent Operations', () => {
    it('prevents join while leaving', async () => {
      mockRoomService.leaveRoom.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      act(() => {
        useRoomStore.getState().setRoom(mockRoom);
        useRoomStore.getState().addJoinedRoom(mockRoom.id);
      });

      const { result } = renderHook(() => useRoomOperations());

      // Start leave
      act(() => {
        result.current.leave(mockRoom.id);
      });

      // Try to join while leaving
      const joinResult = await act(async () => {
        return result.current.join(mockRoom);
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error?.message).toContain('already in progress');
    });

    it('handles multiple rooms independently', async () => {
      const room1 = createMockRoom({ id: 'room-1' });
      const room2 = createMockRoom({ id: 'room-2' });

      const { result } = renderHook(() => useRoomOperations());

      // Join both rooms simultaneously
      const [result1, result2] = await act(async () => {
        return Promise.all([
          result.current.join(room1),
          result.current.join(room2),
        ]);
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      expect(useRoomStore.getState().joinedRoomIds.has('room-1')).toBe(true);
      expect(useRoomStore.getState().joinedRoomIds.has('room-2')).toBe(true);
    });
  });
});
