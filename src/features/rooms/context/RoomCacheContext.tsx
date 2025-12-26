/**
 * RoomCacheContext - Minimal Room Data Cache with TTL
 *
 * This context provides a simple in-memory cache for room data.
 * It follows the single-responsibility principle: only cache, no business logic.
 *
 * Design decisions:
 * - Uses Map<id, Room> for O(1) lookups
 * - Tracks cache timestamps for TTL expiration
 * - No API calls or WebSocket handling (done in hooks)
 * - No derived state computation (done by consuming hooks)
 * - Immutable update patterns for React re-render detection
 *
 * Usage:
 * ```typescript
 * const { getRoom, setRoom, updateRoom, isStale } = useRoomCache();
 *
 * // Get cached room (may be null)
 * const room = getRoom(roomId);
 *
 * // Check if room data is stale
 * if (isStale(roomId)) {
 *   // Refresh from API
 * }
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
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Room } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomCache');

// =============================================================================
// Constants
// =============================================================================

/** Default TTL for cached rooms (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Interval for cleaning expired entries (1 minute) */
const CLEANUP_INTERVAL_MS = 60 * 1000;

// =============================================================================
// Types
// =============================================================================

interface CacheEntry {
  room: Room;
  cachedAt: number;
}

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
   * Check if a room's cache entry is stale (older than TTL)
   */
  isStale: (roomId: string) => boolean;

  /**
   * Get the age of a cached room in milliseconds
   * Returns -1 if not in cache
   */
  getCacheAge: (roomId: string) => number;

  /**
   * Get cache size (for debugging)
   */
  cacheSize: number;

  /**
   * TTL value in milliseconds
   */
  ttlMs: number;
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
  /** Custom TTL in milliseconds (default: 5 minutes) */
  ttlMs?: number;
}

export function RoomCacheProvider({ 
  children, 
  ttlMs = DEFAULT_TTL_MS 
}: RoomCacheProviderProps) {
  // Core cache state - Map with CacheEntry for TTL tracking
  const [cache, setCache] = useState<Map<string, CacheEntry>>(() => new Map());
  
  // Use a ref to read cache without causing callback recreation
  // This is crucial to prevent infinite loops when callbacks are used in effects
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  
  // Track cleanup interval
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup expired entries periodically
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setCache((prev) => {
        let hasExpired = false;
        prev.forEach((entry, id) => {
          if (now - entry.cachedAt > ttlMs) {
            hasExpired = true;
          }
        });
        
        if (!hasExpired) return prev;
        
        const next = new Map<string, CacheEntry>();
        prev.forEach((entry, id) => {
          if (now - entry.cachedAt <= ttlMs) {
            next.set(id, entry);
          }
        });
        
        if (next.size < prev.size) {
          log.debug('Cleaned expired entries', { removed: prev.size - next.size });
        }
        return next;
      });
    }, CLEANUP_INTERVAL_MS);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [ttlMs]);

  // STABLE CALLBACKS - use cacheRef.current to avoid dependency on cache
  // This prevents infinite loops when these are used in useEffect dependencies

  // Get room by ID
  const getRoom = useCallback(
    (roomId: string): Room | null => {
      const entry = cacheRef.current.get(roomId);
      return entry?.room || null;
    },
    [] // No dependencies - uses ref
  );

  // Check if room exists
  const hasRoom = useCallback(
    (roomId: string): boolean => {
      return cacheRef.current.has(roomId);
    },
    [] // No dependencies - uses ref
  );

  // Check if cache entry is stale
  const isStale = useCallback(
    (roomId: string): boolean => {
      const entry = cacheRef.current.get(roomId);
      if (!entry) return true;
      return Date.now() - entry.cachedAt > ttlMs;
    },
    [ttlMs]
  );

  // Get cache age in milliseconds
  const getCacheAge = useCallback(
    (roomId: string): number => {
      const entry = cacheRef.current.get(roomId);
      if (!entry) return -1;
      return Date.now() - entry.cachedAt;
    },
    [] // No dependencies - uses ref
  );

  // Set single room
  const setRoom = useCallback((room: Room) => {
    setCache((prev) => {
      const next = new Map(prev);
      next.set(room.id, { room, cachedAt: Date.now() });
      return next;
    });
    // Reduced logging - individual room caching is common, only log at trace level
  }, []);

  // Set multiple rooms (batch operation)
  const setRooms = useCallback((rooms: Room[]) => {
    if (rooms.length === 0) return;
    
    const now = Date.now();
    setCache((prev) => {
      const next = new Map(prev);
      rooms.forEach((room) => {
        next.set(room.id, { room, cachedAt: now });
      });
      return next;
    });
    log.debug('Rooms cached', { count: rooms.length });
  }, []);

  // Update room fields (refreshes timestamp)
  const updateRoom = useCallback(
    (roomId: string, updates: Partial<Room>) => {
      setCache((prev) => {
        const entry = prev.get(roomId);
        if (!entry) {
          log.debug('Update skipped - room not in cache', { roomId });
          return prev;
        }

        const next = new Map(prev);
        next.set(roomId, { 
          room: { ...entry.room, ...updates }, 
          cachedAt: Date.now() 
        });
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
    return Array.from(cacheRef.current.values()).map((entry) => entry.room);
  }, []); // No dependencies - uses ref

  // Memoize context value - all callbacks are now stable
  // This prevents infinite loops when these are used in useEffect dependencies
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
      isStale,
      getCacheAge,
      // Use getter pattern for volatile values
      get cacheSize() { return cacheRef.current.size; },
      ttlMs,
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
      isStale,
      getCacheAge,
      ttlMs,
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
