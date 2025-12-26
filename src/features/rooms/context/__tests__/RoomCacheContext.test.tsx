/**
 * Unit tests for RoomCacheContext
 *
 * Tests cover:
 * - Basic cache operations (get, set, update, remove)
 * - TTL/staleness detection
 * - Automatic cleanup of expired entries
 * - Batch operations
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { RoomCacheProvider, useRoomCache } from '../RoomCacheContext';
import { Room } from '../../../../types';

// Mock logger
jest.mock('../../../../shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock timers for TTL testing
jest.useFakeTimers();

const createMockRoom = (id: string): Room => ({
  id,
  title: `Room ${id}`,
  description: 'Test room',
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
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RoomCacheProvider ttlMs={1000}>{children}</RoomCacheProvider>
);

describe('RoomCacheContext', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('basic operations', () => {
    it('should set and get a room', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      expect(result.current.getRoom('room-1')).toEqual(room);
      expect(result.current.hasRoom('room-1')).toBe(true);
      expect(result.current.cacheSize).toBe(1);
    });

    it('should return null for non-existent room', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      expect(result.current.getRoom('non-existent')).toBe(null);
      expect(result.current.hasRoom('non-existent')).toBe(false);
    });

    it('should update room fields', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      act(() => {
        result.current.updateRoom('room-1', { participantCount: 10 });
      });

      const updated = result.current.getRoom('room-1');
      expect(updated?.participantCount).toBe(10);
      expect(updated?.title).toBe('Room room-1'); // Other fields unchanged
    });

    it('should remove a room', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      expect(result.current.hasRoom('room-1')).toBe(true);

      act(() => {
        result.current.removeRoom('room-1');
      });

      expect(result.current.hasRoom('room-1')).toBe(false);
      expect(result.current.getRoom('room-1')).toBe(null);
    });

    it('should clear all rooms', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      act(() => {
        result.current.setRoom(createMockRoom('room-1'));
        result.current.setRoom(createMockRoom('room-2'));
        result.current.setRoom(createMockRoom('room-3'));
      });

      expect(result.current.cacheSize).toBe(3);

      act(() => {
        result.current.clearCache();
      });

      expect(result.current.cacheSize).toBe(0);
    });
  });

  describe('batch operations', () => {
    it('should set multiple rooms at once', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const rooms = [
        createMockRoom('room-1'),
        createMockRoom('room-2'),
        createMockRoom('room-3'),
      ];

      act(() => {
        result.current.setRooms(rooms);
      });

      expect(result.current.cacheSize).toBe(3);
      expect(result.current.getRoom('room-1')).toBeTruthy();
      expect(result.current.getRoom('room-2')).toBeTruthy();
      expect(result.current.getRoom('room-3')).toBeTruthy();
    });

    it('should get all rooms as array', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      act(() => {
        result.current.setRoom(createMockRoom('room-1'));
        result.current.setRoom(createMockRoom('room-2'));
      });

      const allRooms = result.current.getAllRooms();
      expect(allRooms).toHaveLength(2);
      expect(allRooms.map((r) => r.id).sort()).toEqual(['room-1', 'room-2']);
    });
  });

  describe('TTL and staleness', () => {
    it('should report room as not stale immediately after caching', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      expect(result.current.isStale('room-1')).toBe(false);
    });

    it('should report room as stale after TTL expires', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      // Advance time past TTL (1000ms)
      act(() => {
        jest.advanceTimersByTime(1001);
      });

      expect(result.current.isStale('room-1')).toBe(true);
    });

    it('should return correct cache age', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      expect(result.current.getCacheAge('room-1')).toBe(0);

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.getCacheAge('room-1')).toBe(500);
    });

    it('should return -1 for cache age of non-existent room', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      expect(result.current.getCacheAge('non-existent')).toBe(-1);
    });

    it('should report non-existent room as stale', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      expect(result.current.isStale('non-existent')).toBe(true);
    });

    it('should refresh timestamp on update', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });
      const room = createMockRoom('room-1');

      act(() => {
        result.current.setRoom(room);
      });

      // Advance time close to TTL
      act(() => {
        jest.advanceTimersByTime(900);
      });

      expect(result.current.isStale('room-1')).toBe(false);

      // Update the room - should reset timestamp
      act(() => {
        result.current.updateRoom('room-1', { participantCount: 10 });
      });

      // Advance another 500ms - would be stale if not refreshed
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current.isStale('room-1')).toBe(false);
    });
  });

  describe('TTL value', () => {
    it('should expose TTL value', () => {
      const { result } = renderHook(() => useRoomCache(), { wrapper });

      expect(result.current.ttlMs).toBe(1000);
    });
  });
});
