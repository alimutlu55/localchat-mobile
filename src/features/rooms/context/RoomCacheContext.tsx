/**
 * RoomCacheContext - Minimal Room Data Cache
 *
 * This context provides a simple in-memory cache for room data.
 * It follows the single-responsibility principle: only cache, no business logic.
 *
 * Design decisions:
 * - Uses Map<id, Room> for O(1) lookups
 * - No API calls or WebSocket handling (done in hooks)
 * - No derived state computation (done by consuming hooks)
 * - Immutable update patterns for React re-render detection
 *
 * Usage:
 * ```typescript
 * const { getRoom, setRoom, updateRoom } = useRoomCache();
 *
 * // Get cached room (may be null)
 * const room = getRoom(roomId);
 *
 * // Cache a room
 * setRoom(room);
 *
 * // Update room fields
 * updateRoom(roomId, { participantCount: 5 });
 * ```
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Room } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomCache');

// =============================================================================
// Types
// =============================================================================

interface RoomCacheContextValue {
  /**
   * Get a room from cache by ID
   * Returns null if not cached
   */
  getRoom: (roomId: string) => Room | null;

  /**
   * Add or replace a room in cache
   */
  setRoom: (room: Room) => void;

  /**
   * Update specific fields of a cached room
   * No-op if room not in cache
   */
  updateRoom: (roomId: string, updates: Partial<Room>) => void;

  /**
   * Add or update multiple rooms at once
   * More efficient than multiple setRoom calls
   */
  setRooms: (rooms: Room[]) => void;

  /**
   * Remove a room from cache
   */
  removeRoom: (roomId: string) => void;

  /**
   * Clear all cached rooms
   */
  clearCache: () => void;

  /**
   * Get all cached rooms as array (for debugging/migration)
   */
  getAllRooms: () => Room[];

  /**
   * Check if a room exists in cache
   */
  hasRoom: (roomId: string) => boolean;

  /**
   * Get cache size (for debugging)
   */
  cacheSize: number;
}

// =============================================================================
// Context
// =============================================================================

const RoomCacheContext = createContext<RoomCacheContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface RoomCacheProviderProps {
  children: ReactNode;
}

export function RoomCacheProvider({ children }: RoomCacheProviderProps) {
  // Core cache state - Map for O(1) lookups
  const [cache, setCache] = useState<Map<string, Room>>(() => new Map());

  // Get room by ID
  const getRoom = useCallback(
    (roomId: string): Room | null => {
      return cache.get(roomId) || null;
    },
    [cache]
  );

  // Check if room exists
  const hasRoom = useCallback(
    (roomId: string): boolean => {
      return cache.has(roomId);
    },
    [cache]
  );

  // Set single room
  const setRoom = useCallback((room: Room) => {
    setCache((prev) => {
      const next = new Map(prev);
      next.set(room.id, room);
      return next;
    });
    log.debug('Room cached', { roomId: room.id });
  }, []);

  // Set multiple rooms (batch operation)
  const setRooms = useCallback((rooms: Room[]) => {
    if (rooms.length === 0) return;

    setCache((prev) => {
      const next = new Map(prev);
      rooms.forEach((room) => {
        next.set(room.id, room);
      });
      return next;
    });
    log.debug('Rooms cached', { count: rooms.length });
  }, []);

  // Update room fields
  const updateRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      setCache((prev) => {
        const existing = prev.get(roomId);
        if (!existing) {
          log.debug('Update skipped - room not in cache', { roomId });
          return prev;
        }

        const next = new Map(prev);
        next.set(roomId, { ...existing, ...updates });
        return next;
      });
    },
    []
  );

  // Remove room
  const removeRoom = useCallback((roomId: string) => {
    setCache((prev) => {
      if (!prev.has(roomId)) return prev;

      const next = new Map(prev);
      next.delete(roomId);
      log.debug('Room removed from cache', { roomId });
      return next;
    });
  }, []);

  // Clear all
  const clearCache = useCallback(() => {
    setCache(new Map());
    log.debug('Cache cleared');
  }, []);

  // Get all rooms as array
  const getAllRooms = useCallback((): Room[] => {
    return Array.from(cache.values());
  }, [cache]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<RoomCacheContextValue>(
    () => ({
      getRoom,
      setRoom,
      updateRoom,
      setRooms,
      removeRoom,
      clearCache,
      getAllRooms,
      hasRoom,
      cacheSize: cache.size,
    }),
    [
      getRoom,
      setRoom,
      updateRoom,
      setRooms,
      removeRoom,
      clearCache,
      getAllRooms,
      hasRoom,
      cache.size,
    ]
  );

  return (
    <RoomCacheContext.Provider value={value}>
      {children}
    </RoomCacheContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the room cache
 * Must be used within RoomCacheProvider
 */
export function useRoomCache(): RoomCacheContextValue {
  const context = useContext(RoomCacheContext);

  if (!context) {
    throw new Error('useRoomCache must be used within a RoomCacheProvider');
  }

  return context;
}

export default RoomCacheContext;
