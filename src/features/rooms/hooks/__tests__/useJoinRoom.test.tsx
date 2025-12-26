/**
 * Unit tests for useJoinRoom hook
 *
 * Tests cover:
 * - Successful join/leave operations
 * - Error handling (banned, room full, network)
 * - State tracking (isJoining, isLeaving)
 * - Guard conditions (already joining/leaving)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useJoinRoom } from '../useJoinRoom';
import { RoomCacheProvider } from '../../context/RoomCacheContext';
import { roomService, wsService } from '../../../../services';
import { Room } from '../../../../types';

// Mock services
jest.mock('../../../../services', () => ({
  roomService: {
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    getRoom: jest.fn(),
  },
  wsService: {
    unsubscribe: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../../shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockRoom: Room = {
  id: 'test-room-1',
  title: 'Test Room',
  description: 'A test room',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 500,
  category: 'GENERAL',
  emoji: '💬',
  participantCount: 5,
  maxParticipants: 50,
  distance: 100,
  expiresAt: new Date(Date.now() + 3600000),
  createdAt: new Date(),
  timeRemaining: '1h',
  status: 'active',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RoomCacheProvider>{children}</RoomCacheProvider>
);

describe('useJoinRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('join', () => {
    it('should return success on successful join', async () => {
      (roomService.joinRoom as jest.Mock).mockResolvedValue({});
      (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let joinResult: any;
      await act(async () => {
        joinResult = await result.current.join(mockRoom);
      });

      expect(joinResult.success).toBe(true);
      expect(joinResult.error).toBeUndefined();
      expect(roomService.joinRoom).toHaveBeenCalledWith(
        mockRoom.id,
        mockRoom.latitude,
        mockRoom.longitude,
        mockRoom.radius
      );
    });

    it('should track isJoining state during join', async () => {
      let resolveJoin: () => void;
      const joinPromise = new Promise<void>((resolve) => {
        resolveJoin = resolve;
      });
      (roomService.joinRoom as jest.Mock).mockImplementation(() => joinPromise);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      expect(result.current.isJoining(mockRoom.id)).toBe(false);

      act(() => {
        result.current.join(mockRoom);
      });

      expect(result.current.isJoining(mockRoom.id)).toBe(true);

      await act(async () => {
        resolveJoin!();
      });

      expect(result.current.isJoining(mockRoom.id)).toBe(false);
    });

    it('should return BANNED error when user is banned', async () => {
      const bannedError = new Error('User is banned from this room');
      (roomService.joinRoom as jest.Mock).mockRejectedValue(bannedError);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let joinResult: any;
      await act(async () => {
        joinResult = await result.current.join(mockRoom);
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error?.code).toBe('BANNED');
    });

    it('should return ROOM_FULL error when room is full', async () => {
      const fullError = new Error('Room is at maximum capacity');
      (roomService.joinRoom as jest.Mock).mockRejectedValue(fullError);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let joinResult: any;
      await act(async () => {
        joinResult = await result.current.join(mockRoom);
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error?.code).toBe('ROOM_FULL');
    });

    it('should treat already-joined as success', async () => {
      const alreadyJoinedError = { status: 409, message: 'Already a member' };
      (roomService.joinRoom as jest.Mock).mockRejectedValue(alreadyJoinedError);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let joinResult: any;
      await act(async () => {
        joinResult = await result.current.join(mockRoom);
      });

      expect(joinResult.success).toBe(true);
    });

    it('should prevent duplicate join attempts', async () => {
      let resolveJoin: () => void;
      const joinPromise = new Promise<void>((resolve) => {
        resolveJoin = resolve;
      });
      (roomService.joinRoom as jest.Mock).mockImplementation(() => joinPromise);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      // Start first join
      act(() => {
        result.current.join(mockRoom);
      });

      // Try second join while first is in progress
      let secondResult: any;
      await act(async () => {
        secondResult = await result.current.join(mockRoom);
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.message).toContain('Already joining');

      // Complete first join
      await act(async () => {
        resolveJoin!();
      });
    });
  });

  describe('leave', () => {
    it('should return success on successful leave', async () => {
      (roomService.leaveRoom as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let leaveResult: any;
      await act(async () => {
        leaveResult = await result.current.leave(mockRoom.id);
      });

      expect(leaveResult.success).toBe(true);
      expect(wsService.unsubscribe).toHaveBeenCalledWith(mockRoom.id);
    });

    it('should track isLeaving state during leave', async () => {
      let resolveLeave: () => void;
      const leavePromise = new Promise<void>((resolve) => {
        resolveLeave = resolve;
      });
      (roomService.leaveRoom as jest.Mock).mockImplementation(() => leavePromise);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      expect(result.current.isLeaving(mockRoom.id)).toBe(false);

      act(() => {
        result.current.leave(mockRoom.id);
      });

      expect(result.current.isLeaving(mockRoom.id)).toBe(true);

      await act(async () => {
        resolveLeave!();
      });

      expect(result.current.isLeaving(mockRoom.id)).toBe(false);
    });

    it('should handle leave failure', async () => {
      const error = new Error('Network error');
      (roomService.leaveRoom as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useJoinRoom(), { wrapper });

      let leaveResult: any;
      await act(async () => {
        leaveResult = await result.current.leave(mockRoom.id);
      });

      expect(leaveResult.success).toBe(false);
      expect(leaveResult.error?.message).toContain('Network error');
    });
  });
});
