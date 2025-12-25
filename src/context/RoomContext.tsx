/**
 * RoomContext - Centralized Room State Management
 *
 * Provides a single source of truth for all room-related state:
 * - Discovered rooms (for map/list views)
 * - User's rooms (created + joined, for sidebar)
 * - Selected room state
 * - WebSocket event handling for real-time updates
 *
 * This context matches the web app (localchat-ui) implementation for consistency.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { Room } from '../types';
import { roomService, wsService, WS_EVENTS } from '../services';
import { useAuth } from './AuthContext';
import { CATEGORIES } from '../constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Room Created WebSocket Payload
 */
interface RoomCreatedPayload {
  room: {
    id: string;
    title: string;
    description?: string;
    location: {
      latitude: number;
      longitude: number;
    };
    radiusMeters: number;
    category: string;
    categoryIcon?: string; // Optional: backend may add this in future
    participantCount: number;
    expiresAt?: string;
    creatorId: string;
  };
}

/**
 * Room Closed WebSocket Payload
 */
interface RoomClosedPayload {
  roomId: string;
}

/**
 * Room Updated WebSocket Payload
 */
interface RoomUpdatedPayload {
  roomId: string;
  [key: string]: any;
}

/**
 * Room Context Value
 */
interface RoomContextValue {
  // Discovered rooms (for map/list)
  rooms: Room[];
  activeRooms: Room[]; // Filtered: non-closed, non-expired
  isLoadingRooms: boolean;
  roomsError: string | null;

  // User's rooms (for sidebar)
  myRooms: Room[];
  isLoadingMyRooms: boolean;

  // Selection state
  selectedRoom: Room | null;
  setSelectedRoom: (room: Room | null) => void;

  // Actions
  fetchRooms: (lat: number, lng: number, radius?: number) => Promise<void>;
  fetchMyRooms: () => Promise<void>;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  joinRoom: (room: Room) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  addToMyRooms: (room: Room) => void;
  removeFromMyRooms: (roomId: string) => void;
  syncMyRooms: (rooms: Room[]) => void;
  
  // Helpers
  isRoomJoined: (roomId: string) => boolean;
  getRoomById: (roomId: string) => Room | null;
  
  // Optimistic UI state
  isJoiningRoom: (roomId: string) => boolean;
  isLeavingRoom: (roomId: string) => boolean;
}

const RoomContext = createContext<RoomContextValue | null>(null);

/**
 * Room Provider Props
 */
interface RoomProviderProps {
  children: ReactNode;
}

/**
 * Get category emoji from category ID
 * Matches backend RoomCategory enum icons exactly
 */
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    TRAFFIC: '🚗',
    EVENTS: '🎉',
    EMERGENCY: '🚨',
    LOST_FOUND: '🔍',
    SPORTS: '⚽',
    FOOD: '🍕',
    NEIGHBORHOOD: '🏘️',
    GENERAL: '💬',
  };
  
  const normalizedCategory = category.toUpperCase();
  return emojiMap[normalizedCategory] || '💬';
}

/**
 * Room Provider Component
 */
export function RoomProvider({ children }: RoomProviderProps) {
  const { user } = useAuth();
  const userRef = useRef(user);

  // Keep userRef in sync
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Discovered rooms state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // User's rooms state
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [isLoadingMyRooms, setIsLoadingMyRooms] = useState(false);

  // Selected room state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Tombstones for recently closed rooms (prevent resurrection by polling)
  const closedRoomTombstonesRef = useRef<Set<string>>(new Set());
  
  // Optimistic UI: Track rooms currently being joined/left
  const [joiningRooms, setJoiningRooms] = useState<Set<string>>(new Set());
  const [leavingRooms, setLeavingRooms] = useState<Set<string>>(new Set());
  
  // Track rooms that were just left to prevent immediate re-fetch
  const justLeftRoomsRef = useRef<Set<string>>(new Set());

  // Refs for stable access in callbacks
  const selectedRoomRef = useRef<Room | null>(selectedRoom);
  const myRoomsRef = useRef<Room[]>(myRooms);

  // Keep refs in sync
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    myRoomsRef.current = myRooms;
  }, [myRooms]);

  // ============================================================================
  // Computed: Active Rooms (for map/list display)
  // ============================================================================

  const activeRooms = useMemo(() => {
    const now = new Date();
    return rooms.filter(room =>
      room.status !== 'closed' &&
      room.expiresAt > now &&
      !closedRoomTombstonesRef.current.has(room.id)
    );
  }, [rooms]);

  // ============================================================================
  // Fetch Actions
  // ============================================================================

  /**
   * Fetch nearby rooms
   */
  const fetchRooms = useCallback(async (lat: number, lng: number, radius?: number) => {
    console.log('[RoomContext] Fetching discovered rooms');
    setIsLoadingRooms(true);
    setRoomsError(null);

    try {
      const fetchedRooms = await roomService.getNearbyRooms(lat, lng, radius);
      console.log('[RoomContext] Fetched rooms:', fetchedRooms.length);

      setRooms(prevRooms => {
        const fetchedRoomIds = new Set(fetchedRooms.map(r => r.id));
        const now = new Date();

        // Keep locally added rooms that aren't in the fetched results AND are not expired/closed
        const localRoomsToKeep = prevRooms.filter(r =>
          !fetchedRoomIds.has(r.id) &&
          r.status !== 'closed' &&
          r.expiresAt > now &&
          !closedRoomTombstonesRef.current.has(r.id)
        );

        // Preserve selected room if not in fetched results AND not expired/closed
        const roomsToPreserve = new Map<string, Room>();
        localRoomsToKeep.forEach(r => roomsToPreserve.set(r.id, r));

        const currentSelectedRoom = selectedRoomRef.current;
        if (currentSelectedRoom && !fetchedRoomIds.has(currentSelectedRoom.id) &&
          currentSelectedRoom.status !== 'closed' &&
          currentSelectedRoom.expiresAt > now &&
          !closedRoomTombstonesRef.current.has(currentSelectedRoom.id)) {
          roomsToPreserve.set(currentSelectedRoom.id, currentSelectedRoom);
        }

        // Preserve active joined rooms
        const currentMyRooms = myRoomsRef.current;
        currentMyRooms.forEach((room: Room) => {
          if (!fetchedRoomIds.has(room.id) &&
            room.status !== 'closed' &&
            room.expiresAt > now &&
            !closedRoomTombstonesRef.current.has(room.id)) {
            roomsToPreserve.set(room.id, room);
          }
        });

        // Filter out tombstoned rooms from fetched results
        const filteredFetchedRooms = fetchedRooms.filter(
          r => !closedRoomTombstonesRef.current.has(r.id)
        );

        return [...filteredFetchedRooms, ...Array.from(roomsToPreserve.values())];
      });

      // Sync myRooms with fresh data from discover
      const backendJoinedRooms = fetchedRooms.filter(r => r.hasJoined);
      if (backendJoinedRooms.length > 0) {
        setMyRooms(prev => {
          const roomMap = new Map(prev.map(r => [r.id, r]));
          backendJoinedRooms.forEach(room => {
            roomMap.set(room.id, room);
          });
          return Array.from(roomMap.values());
        });
      }
    } catch (error) {
      console.error('[RoomContext] Failed to fetch rooms:', error);
      setRoomsError(error instanceof Error ? error.message : 'Failed to fetch rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  /**
   * Fetch user's rooms
   */
  const fetchMyRooms = useCallback(async () => {
    if (!user) return;

    console.log('[RoomContext] Fetching my rooms');
    setIsLoadingMyRooms(true);

    try {
      const rooms = await roomService.getMyRooms();
      console.log('[RoomContext] Fetched my rooms:', rooms.length);
      // Filter out closed rooms
      const validRooms = rooms.filter(room => room.status !== 'closed');
      setMyRooms(validRooms);
    } catch (error) {
      console.error('[RoomContext] Failed to fetch my rooms:', error);
    } finally {
      setIsLoadingMyRooms(false);
    }
  }, [user]);

  // ============================================================================
  // Mutation Actions
  // ============================================================================

  /**
   * Add a room to the list
   */
  const addRoom = useCallback((room: Room) => {
    // Don't add if tombstoned
    if (closedRoomTombstonesRef.current.has(room.id)) {
      console.log('[RoomContext] Ignoring add for tombstoned room:', room.id);
      return;
    }

    setRooms(prev => {
      if (prev.some(r => r.id === room.id)) return prev;
      return [room, ...prev];
    });
  }, []);

  /**
   * Remove a room from the list
   */
  const removeRoom = useCallback((roomId: string) => {
    console.log('[RoomContext] Removing room:', roomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setMyRooms(prev => prev.filter(r => r.id !== roomId));

    if (selectedRoomRef.current?.id === roomId) {
      setSelectedRoom(null);
    }
  }, []);

  /**
   * Update a room
   */
  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    const updateList = (rooms: Room[]) =>
      rooms.map(r => (r.id === roomId ? { ...r, ...updates } : r));

    setRooms(updateList);
    setMyRooms(updateList);

    if (selectedRoomRef.current?.id === roomId) {
      setSelectedRoom(prev => (prev ? { ...prev, ...updates } : null));
    }
  }, []);

  /**
   * Add a room to my rooms
   */
  const addToMyRooms = useCallback((room: Room) => {
    // Only add non-closed rooms
    if (room.status === 'closed') {
      console.warn('[RoomContext] Cannot add closed room to myRooms:', room.id);
      return;
    }

    setMyRooms(prev => {
      const existingIndex = prev.findIndex(r => r.id === room.id);
      if (existingIndex !== -1) {
        // Update existing room if found (upsert pattern)
        const updated = [...prev];
        updated[existingIndex] = room;
        return updated;
      }
      // Add to beginning for recent rooms
      return [room, ...prev];
    });
  }, []);

  /**
   * Remove a room from my rooms
   */
  const removeFromMyRooms = useCallback((roomId: string) => {
    setMyRooms(prev => prev.filter(r => r.id !== roomId));
  }, []);

  /**
   * syncMyRooms - Reconcile myRooms with provided list
   * This replaces the entire list, filtering out closed rooms
   * Used for initial load and full refresh scenarios
   */
  const syncMyRooms = useCallback((rooms: Room[]) => {
    const validRooms = rooms.filter(room => room.status !== 'closed');
    console.log('[RoomContext] syncMyRooms called with', rooms.length, 'rooms,', validRooms.length, 'valid');
    setMyRooms(validRooms);
  }, []);

  /**
   * Helper: Get room by ID from either discovered rooms or myRooms
   * Prioritizes myRooms as they have most up-to-date state
   */
  const getRoomById = useCallback((roomId: string): Room | null => {
    // Check myRooms first (most up-to-date), then discovered rooms
    const myRoom = myRoomsRef.current.find(r => r.id === roomId);
    if (myRoom) return myRoom;
    
    return rooms.find(r => r.id === roomId) || null;
  }, [rooms]);

  /**
   * Helper: Check if user has already joined a room
   */
  const isRoomJoined = useCallback((roomId: string): boolean => {
    return myRoomsRef.current.some(r => r.id === roomId);
  }, []);

  /**
   * Helper: Check if room is currently being joined (optimistic UI)
   */
  const isJoiningRoom = useCallback((roomId: string): boolean => {
    return joiningRooms.has(roomId);
  }, [joiningRooms]);

  /**
   * Helper: Check if room is currently being left (optimistic UI)
   */
  const isLeavingRoom = useCallback((roomId: string): boolean => {
    return leavingRooms.has(roomId);
  }, [leavingRooms]);
  
  /**
   * Helper: Check if a room was just left (to prevent race conditions)
   */
  const wasJustLeft = useCallback((roomId: string): boolean => {
    return justLeftRoomsRef.current.has(roomId);
  }, []);

  /**
   * Join a room with optimistic UI updates
   */
  const joinRoom = useCallback(async (room: Room): Promise<boolean> => {
    console.log('[RoomContext] joinRoom called for:', room.id);
    
    // Prevent joining if currently leaving
    if (leavingRooms.has(room.id)) {
      console.warn('[RoomContext] Cannot join - leave operation in progress:', room.id);
      return false;
    }
    
    // Prevent duplicate joins
    if (isRoomJoined(room.id)) {
      console.warn('[RoomContext] Already joined room:', room.id);
      return true; // Return success since already joined
    }

    // Prevent joining if already in progress
    if (joiningRooms.has(room.id)) {
      console.warn('[RoomContext] Join already in progress for room:', room.id);
      return false;
    }

    console.log('[RoomContext] Starting join operation for:', room.id);

    // Mark as joining (optimistic state)
    setJoiningRooms(prev => new Set(prev).add(room.id));

    // Optimistically update UI immediately
    const optimisticRoom = { ...room, hasJoined: true };
    updateRoom(room.id, { hasJoined: true });
    addToMyRooms(optimisticRoom);

    try {
      // Backend requires user location when joining
      await roomService.joinRoom(room.id, room.latitude ?? 0, room.longitude ?? 0);

      // Subscribe to WebSocket
      wsService.subscribe(room.id);

      console.log('[RoomContext] Successfully joined room:', room.id);
      return true;
    } catch (error: any) {
      // Handle "already joined" error gracefully (backend may already have user as participant)
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code || '';
      
      if (errorCode === 'CONFLICT' ||
          errorMessage.includes('Resource already exists') ||
          errorMessage.includes('already joined') || 
          errorMessage.includes('already a participant') ||
          errorMessage.includes('duplicate')) {
        console.log('[RoomContext] Backend says already joined (conflict), keeping optimistic state:', room.id);
        
        // Keep optimistic updates, subscribe to WebSocket
        wsService.subscribe(room.id);
        return true; // Treat as success
      }
      
      // Rollback optimistic updates on real failure
      console.error('[RoomContext] Failed to join room, rolling back:', error);
      updateRoom(room.id, { hasJoined: false });
      removeFromMyRooms(room.id);
      return false;
    } finally {
      // Clear joining state
      setJoiningRooms(prev => {
        const next = new Set(prev);
        next.delete(room.id);
        return next;
      });
    }
  }, [isRoomJoined, joiningRooms, leavingRooms, updateRoom, addToMyRooms, removeFromMyRooms]);

  /**
   * Leave a room with optimistic UI updates
   */
  const leaveRoom = useCallback(async (roomId: string): Promise<boolean> => {
    console.log('[RoomContext] leaveRoom called for:', roomId);
    
    // Prevent duplicate leave operations
    if (leavingRooms.has(roomId)) {
      console.warn('[RoomContext] Leave already in progress for room:', roomId);
      return false;
    }
    
    // Check if user is actually in the room
    const isInRoom = myRoomsRef.current.some(r => r.id === roomId);
    if (!isInRoom) {
      console.warn('[RoomContext] User not in room, nothing to leave:', roomId);
      return true; // Already left, return success
    }

    console.log('[RoomContext] Starting leave operation for:', roomId);
    
    // Mark as leaving BEFORE any state changes
    setLeavingRooms(prev => {
      const next = new Set(prev);
      next.add(roomId);
      return next;
    });
    
    // Add to "just left" tracking to prevent race conditions with API calls
    justLeftRoomsRef.current.add(roomId);

    try {
      // First, unsubscribe from WebSocket to stop receiving events
      wsService.unsubscribe(roomId);
      console.log('[RoomContext] Unsubscribed from WebSocket:', roomId);
      
      // Then, call backend to leave room
      await roomService.leaveRoom(roomId);
      console.log('[RoomContext] Backend leave successful:', roomId);

      // Only update UI state after successful backend response
      updateRoom(roomId, { hasJoined: false });
      removeFromMyRooms(roomId);
      
      // Clear from "just left" after a delay to prevent race conditions
      setTimeout(() => {
        justLeftRoomsRef.current.delete(roomId);
      }, 2000);

      console.log('[RoomContext] Successfully left room:', roomId);
      return true;
    } catch (error: any) {
      console.error('[RoomContext] Failed to leave room:', error);
      
      // Remove from "just left" on error
      justLeftRoomsRef.current.delete(roomId);
      
      // Rollback: Re-subscribe to WebSocket
      wsService.subscribe(roomId);
      
      // Don't rollback UI state since we haven't changed it yet
      // (we moved the UI update to after successful backend call)
      
      return false;
    } finally {
      // Always clear leaving state
      setLeavingRooms(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
      console.log('[RoomContext] Cleared leaving state for:', roomId);
    }
  }, [leavingRooms, updateRoom, removeFromMyRooms]);

  // ============================================================================
  // WebSocket Event Handlers
  // ============================================================================

  useEffect(() => {
    // Handle room_closed events - remove room immediately from all state
    const handleRoomClosed = (payload: RoomClosedPayload) => {
      const { roomId } = payload;
      console.log('[RoomContext] Room closed event received:', roomId);

      // Add to tombstones (prevent resurrection by polling)
      closedRoomTombstonesRef.current.add(roomId);

      // Remove tombstone after 2 minutes
      setTimeout(() => {
        closedRoomTombstonesRef.current.delete(roomId);
      }, 120000);

      // Remove from both rooms and myRooms immediately
      removeRoom(roomId);
    };

    // Handle room_updated events
    const handleRoomUpdated = (payload: RoomUpdatedPayload) => {
      const { roomId, ...updates } = payload;
      console.log('[RoomContext] Room updated event received:', roomId);
      updateRoom(roomId, updates as Partial<Room>);
    };

    // Handle room_created events - add new room to discovered rooms
    const handleRoomCreated = (payload: RoomCreatedPayload) => {
      const { room: newRoomData } = payload;
      console.log('[RoomContext] Room created event received:', newRoomData.id, newRoomData.title);

      // If room was previously closed, remove from tombstones
      closedRoomTombstonesRef.current.delete(newRoomData.id);

      const isCreator = newRoomData.creatorId === userRef.current?.id;

      // Convert WebSocket payload to Room type
      const newRoom: Room = {
        id: newRoomData.id,
        title: newRoomData.title,
        description: newRoomData.description || '',
        latitude: newRoomData.location.latitude,
        longitude: newRoomData.location.longitude,
        radius: newRoomData.radiusMeters,
        category: newRoomData.category as any,
        emoji: newRoomData.categoryIcon || getCategoryEmoji(newRoomData.category), // Use backend icon if available
        participantCount: newRoomData.participantCount,
        maxParticipants: 500, // Default
        expiresAt: newRoomData.expiresAt ? new Date(newRoomData.expiresAt) : new Date(Date.now() + 3600000 * 24),
        createdAt: new Date(),
        timeRemaining: 'Calculating...',
        distance: 0, // Will be calculated by Map
        isCreator,
        hasJoined: isCreator, // Creator is auto-joined
        status: 'active'
      };

      // Add to discovered rooms (avoid duplicates)
      addRoom(newRoom);

      // If this user created the room, also add to myRooms
      if (isCreator) {
        console.log('[RoomContext] Adding own created room to myRooms:', newRoom.id);
        addToMyRooms(newRoom);
      }
    };

    const unsubscribeClosed = wsService.on(WS_EVENTS.ROOM_CLOSED, handleRoomClosed);
    const unsubscribeUpdated = wsService.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    const unsubscribeCreated = wsService.on(WS_EVENTS.ROOM_CREATED, handleRoomCreated);

    return () => {
      unsubscribeClosed();
      unsubscribeUpdated();
      unsubscribeCreated();
    };
  }, [removeRoom, updateRoom, addRoom, addToMyRooms]);

  /**
   * Fetch my rooms on user change
   */
  useEffect(() => {
    if (user) {
      fetchMyRooms();
    } else {
      setMyRooms([]);
    }
  }, [user, fetchMyRooms]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<RoomContextValue>(() => ({
    rooms,
    activeRooms,
    isLoadingRooms,
    roomsError,
    myRooms,
    isLoadingMyRooms,
    selectedRoom,
    setSelectedRoom,
    fetchRooms,
    fetchMyRooms,
    addRoom,
    removeRoom,
    updateRoom,
    joinRoom,
    leaveRoom,
    addToMyRooms,
    removeFromMyRooms,
    syncMyRooms,
    isRoomJoined,
    getRoomById,
    isJoiningRoom,
    isLeavingRoom,
  }), [
    rooms,
    activeRooms,
    isLoadingRooms,
    roomsError,
    myRooms,
    isLoadingMyRooms,
    selectedRoom,
    fetchRooms,
    fetchMyRooms,
    addRoom,
    removeRoom,
    updateRoom,
    joinRoom,
    leaveRoom,
    addToMyRooms,
    removeFromMyRooms,
    syncMyRooms,
    isRoomJoined,
    getRoomById,
    isJoiningRoom,
    isLeavingRoom,
  ]);

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * useRooms - Access the room context
 */
export function useRooms(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRooms must be used within a RoomProvider');
  }
  return context;
}

/**
 * useActiveRooms - Get only active (non-expired, non-closed) rooms for map/list display
 */
export function useActiveRooms(): Room[] {
  const { activeRooms } = useRooms();
  return activeRooms;
}

/**
 * useSidebarRooms - Get rooms for sidebar, split into active and expired
 */
export function useSidebarRooms(): { activeRooms: Room[]; expiredRooms: Room[] } {
  const { myRooms } = useRooms();

  return useMemo(() => {
    const now = new Date();
    // Filter out closed rooms
    const nonClosed = myRooms.filter(room => room.status !== 'closed');
    const sorted = [...nonClosed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      activeRooms: sorted.filter(room => room.expiresAt > now),
      expiredRooms: sorted.filter(room => room.expiresAt <= now),
    };
  }, [myRooms]);
}

/**
 * useJoinedRooms - Get only joined rooms (excludes rooms user only discovered but didn't join)
 */
export function useJoinedRooms(): Room[] {
  const { myRooms } = useRooms();
  return useMemo(
    () => myRooms.filter(r => r.hasJoined || r.isCreator),
    [myRooms]
  );
}

/**
 * useIsRoomJoined - Check if user has joined a specific room
 */
export function useIsRoomJoined(roomId: string): boolean {
  const { isRoomJoined } = useRooms();
  return isRoomJoined(roomId);
}

/**
 * useRoomById - Get a specific room by ID (prioritizes myRooms for latest state)
 */
export function useRoomById(roomId: string): Room | null {
  const { getRoomById } = useRooms();
  return useMemo(() => getRoomById(roomId), [getRoomById, roomId]);
}

/**
 * useIsJoiningRoom - Check if a room is currently being joined (optimistic UI)
 */
export function useIsJoiningRoom(roomId: string): boolean {
  const { isJoiningRoom } = useRooms();
  return isJoiningRoom(roomId);
}

/**
 * useIsLeavingRoom - Check if a room is currently being left (optimistic UI)
 */
export function useIsLeavingRoom(roomId: string): boolean {
  const { isLeavingRoom } = useRooms();
  return isLeavingRoom(roomId);
}

export default RoomContext;
