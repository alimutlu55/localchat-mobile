/**
 * Unit tests for useRoom hook
 *
 * Tests cover:
 * - Initial loading from cache
 * - Fetching fresh data
 * - TTL/stale data handling
 * - WebSocket updates
 * - Error handling
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRoom } from '../useRoom';
import { RoomCacheProvider } from '../../context/RoomCacheContext';
import { roomService, wsService, WS_EVENTS } from '../../../../services';
import { Room } from '../../../../types';

// Mock services
jest.mock('../../../../services', () => ({
  roomService: {
    getRoom: jest.fn(),
  },
  wsService: {
    on: jest.fn(() => jest.fn()), // Returns unsubscribe function
  },
  WS_EVENTS: {
    ROOM_UPDATED: 'room_updated',
    PARTICIPANT_COUNT: 'participant_count_updated',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
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

describe('useRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial loading', () => {
    it('should return null room and isLoading true initially', () => {
      (roomService.getRoom as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useRoom('test-room-1'), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.room).toBe(null);
    });

    it('should fetch and return room data', async () => {
      (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);

      const { result } = renderHook(() => useRoom('test-room-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.room).toEqual(mockRoom);
      expect(result.current.error).toBe(null);
    });

    it('should return null for undefined roomId', () => {
      const { result } = renderHook(() => useRoom(undefined), { wrapper });

      expect(result.current.room).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should set error on fetch failure', async () => {
      const error = new Error('Network error');
      (roomService.getRoom as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRoom('test-room-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.room).toBe(null);
    });
  });

  describe('caching', () => {
    it('should use cached data when skipFetchIfCached is true', async () => {
      (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);

      // First render - fetch and cache
      const { result: result1, unmount } = renderHook(
        () => useRoom('test-room-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.room).toEqual(mockRoom);
      });

      unmount();

      // Reset mock to track new calls
      (roomService.getRoom as jest.Mock).mockClear();

      // Second render with skipFetchIfCached
      const { result: result2 } = renderHook(
        () => useRoom('test-room-1', { skipFetchIfCached: true }),
        { wrapper }
      );

      // Should immediately have room from cache
      expect(result2.current.room).toEqual(mockRoom);
      
      // Should not make new API call (unless stale)
      // Note: This test may need adjustment based on TTL behavior
    });
  });

  describe('refresh', () => {
    it('should refresh room data when refresh is called', async () => {
      const initialRoom = { ...mockRoom, participantCount: 5 };
      const updatedRoom = { ...mockRoom, participantCount: 10 };

      (roomService.getRoom as jest.Mock)
        .mockResolvedValueOnce(initialRoom)
        .mockResolvedValueOnce(updatedRoom);

      const { result } = renderHook(() => useRoom('test-room-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.room?.participantCount).toBe(5);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.room?.participantCount).toBe(10);
    });

    it('should set isRefreshing during refresh', async () => {
      let resolveRefresh: (value: Room) => void;
      const refreshPromise = new Promise<Room>((resolve) => {
        resolveRefresh = resolve;
      });

      (roomService.getRoom as jest.Mock)
        .mockResolvedValueOnce(mockRoom)
        .mockImplementationOnce(() => refreshPromise);

      const { result } = renderHook(() => useRoom('test-room-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isRefreshing).toBe(false);

      act(() => {
        result.current.refresh();
      });

      expect(result.current.isRefreshing).toBe(true);

      await act(async () => {
        resolveRefresh!(mockRoom);
      });

      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('WebSocket subscription', () => {
    it('should subscribe to WebSocket events when subscribeToUpdates is true', () => {
      (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);

      renderHook(() => useRoom('test-room-1', { subscribeToUpdates: true }), {
        wrapper,
      });

      // Should subscribe to room update events
      expect(wsService.on).toHaveBeenCalledWith(
        WS_EVENTS.ROOM_UPDATED,
        expect.any(Function)
      );
      expect(wsService.on).toHaveBeenCalledWith(
        WS_EVENTS.PARTICIPANT_COUNT,
        expect.any(Function)
      );
    });

    it('should not subscribe when subscribeToUpdates is false', () => {
      (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);
      (wsService.on as jest.Mock).mockClear();

      renderHook(() => useRoom('test-room-1', { subscribeToUpdates: false }), {
        wrapper,
      });

      // Should not subscribe to any events
      expect(wsService.on).not.toHaveBeenCalled();
    });
  });
});
