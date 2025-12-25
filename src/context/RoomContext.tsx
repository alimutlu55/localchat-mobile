/**
 * RoomContext - Single Source of Truth for Room State
 *
 * Architecture:
 * - ONE Map<roomId, Room> stores all room data
 * - ONE Set<roomId> tracks which rooms user has joined
 * - All views (map, list, sidebar) derive from these two sources
 * - No duplicate room objects with different states
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { Room } from '../types';
import { roomService, wsService, WS_EVENTS } from '../services';
import { useAuth } from './AuthContext';

// ============================================================================
// Types
// ============================================================================

interface RoomContextValue {
  // All rooms (single source of truth)
  allRooms: Map<string, Room>;
  
  // Derived views
  discoveredRooms: Room[];      // All discovered rooms (for map)
  activeRooms: Room[];          // Non-expired, non-closed (for list)
  myRooms: Room[];              // Rooms user has joined (for sidebar)
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Selection
  selectedRoom: Room | null;
  setSelectedRoom: (room: Room | null) => void;
  
  // Actions
  fetchDiscoveredRooms: (lat: number, lng: number, radius?: number) => Promise<void>;
  fetchMyRooms: () => Promise<void>;
  joinRoom: (room: Room) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;
  
  // Helpers
  getRoomById: (roomId: string) => Room | null;
  isRoomJoined: (roomId: string) => boolean;
  isJoiningRoom: (roomId: string) => boolean;
  isLeavingRoom: (roomId: string) => boolean;
}

const RoomContext = createContext<RoomContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function RoomProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // ============================================================================
  // SINGLE SOURCE OF TRUTH
  // ============================================================================
  
  // All room data in one place - keyed by room ID
  const [roomsById, setRoomsById] = useState<Map<string, Room>>(new Map());
  
  // Set of room IDs the user has joined (membership state)
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  
  // Set of room IDs that were discovered (vs only in myRooms)
  const [discoveredRoomIds, setDiscoveredRoomIds] = useState<Set<string>>(new Set());
  
  // ============================================================================
  // UI State
  // ============================================================================
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  // Optimistic UI tracking
  const [joiningRoomIds, setJoiningRoomIds] = useState<Set<string>>(new Set());
  const [leavingRoomIds, setLeavingRoomIds] = useState<Set<string>>(new Set());
  
  // ============================================================================
  // DERIVED VIEWS (computed from single source)
  // ============================================================================
  
  // All discovered rooms (for map view)
  const discoveredRooms = useMemo(() => {
    const rooms: Room[] = [];
    discoveredRoomIds.forEach(id => {
      const room = roomsById.get(id);
      if (room) {
        // Enrich with joined state
        rooms.push({
          ...room,
          hasJoined: joinedRoomIds.has(id),
        });
      }
    });
    return rooms;
  }, [roomsById, discoveredRoomIds, joinedRoomIds]);
  
  // Active rooms (non-expired, non-closed) for list view
  const activeRooms = useMemo(() => {
    const now = new Date();
    return discoveredRooms.filter(room =>
      room.status !== 'closed' &&
      room.expiresAt > now
    );
  }, [discoveredRooms]);
  
  // User's rooms (for sidebar)
  const myRooms = useMemo(() => {
    console.log('[RoomContext] Computing myRooms, joinedRoomIds:', Array.from(joinedRoomIds));
    const rooms: Room[] = [];
    joinedRoomIds.forEach(id => {
      const room = roomsById.get(id);
      if (room) {
        rooms.push({
          ...room,
          hasJoined: true,
        });
      }
    });
    // Sort by most recent first
    const sorted = rooms.sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
    console.log('[RoomContext] myRooms computed:', sorted.length, 'rooms');
    return sorted;
  }, [roomsById, joinedRoomIds]);
  
  // ============================================================================
  // Room Data Operations
  // ============================================================================
  
  // Update or add a room to the store
  const upsertRoom = useCallback((room: Room) => {
    setRoomsById(prev => {
      const next = new Map(prev);
      const existing = next.get(room.id);
      // Merge with existing data to preserve fields
      next.set(room.id, existing ? { ...existing, ...room } : room);
      return next;
    });
  }, []);
  
  // Update room fields
  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    setRoomsById(prev => {
      const room = prev.get(roomId);
      if (!room) return prev;
      const next = new Map(prev);
      next.set(roomId, { ...room, ...updates });
      return next;
    });
  }, []);
  
  // Remove a room
  const removeRoom = useCallback((roomId: string) => {
    setRoomsById(prev => {
      const next = new Map(prev);
      next.delete(roomId);
      return next;
    });
    setDiscoveredRoomIds(prev => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
    setJoinedRoomIds(prev => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);
  
  // ============================================================================
  // Fetch Operations
  // ============================================================================
  
  const fetchDiscoveredRooms = useCallback(async (
    lat: number,
    lng: number,
    radius?: number
  ) => {
    console.log('[RoomContext] Fetching discovered rooms');
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedRooms = await roomService.getNearbyRooms(lat, lng, radius);
      console.log('[RoomContext] Fetched', fetchedRooms.length, 'rooms');
      
      // Update the room store
      const newDiscoveredIds = new Set<string>();
      fetchedRooms.forEach((room: Room) => {
        upsertRoom(room);
        newDiscoveredIds.add(room.id);
        
        // If room has hasJoined flag from API, update membership
        if (room.hasJoined || room.isCreator) {
          setJoinedRoomIds(prev => new Set(prev).add(room.id));
        }
      });
      
      setDiscoveredRoomIds(newDiscoveredIds);
    } catch (err) {
      console.error('[RoomContext] Failed to fetch rooms:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [upsertRoom]);
  
  const fetchMyRooms = useCallback(async () => {
    console.log('[RoomContext] Fetching my rooms');
    
    try {
      const fetchedRooms = await roomService.getMyRooms();
      console.log('[RoomContext] Fetched', fetchedRooms.length, 'my rooms');
      
      // Update the room store and membership
      const newJoinedIds = new Set<string>();
      fetchedRooms.forEach(room => {
        if (room.status !== 'closed') {
          upsertRoom(room);
          newJoinedIds.add(room.id);
        }
      });
      
      setJoinedRoomIds(newJoinedIds);
    } catch (err) {
      console.error('[RoomContext] Failed to fetch my rooms:', err);
    }
  }, [upsertRoom]);
  
  // ============================================================================
  // Join/Leave Operations
  // ============================================================================
  
  const joinRoom = useCallback(async (room: Room): Promise<boolean> => {
    const roomId = room.id;
    console.log('[RoomContext] joinRoom called:', roomId);
    console.log('[RoomContext] joinRoom - joinedRoomIds:', Array.from(joinedRoomIds));
    console.log('[RoomContext] joinRoom - joiningRoomIds:', Array.from(joiningRoomIds));
    console.log('[RoomContext] joinRoom - leavingRoomIds:', Array.from(leavingRoomIds));
    
    // Guards
    if (joiningRoomIds.has(roomId)) {
      console.warn('[RoomContext] Already joining:', roomId);
      return false;
    }
    if (joinedRoomIds.has(roomId)) {
      console.log('[RoomContext] Already joined:', roomId);
      return true;
    }
    if (leavingRoomIds.has(roomId)) {
      console.warn('[RoomContext] Currently leaving:', roomId);
      return false;
    }
    
    // Mark as joining
    setJoiningRoomIds(prev => new Set(prev).add(roomId));
    
    // Optimistic update
    upsertRoom(room);
    setJoinedRoomIds(prev => new Set(prev).add(roomId));
    
    try {
      await roomService.joinRoom(roomId, room.latitude ?? 0, room.longitude ?? 0);
      wsService.subscribe(roomId);
      console.log('[RoomContext] Join successful:', roomId);
      return true;
    } catch (err: any) {
      // Handle "already joined" as success
      if (err?.code === 'CONFLICT' || err?.message?.includes('already')) {
        console.log('[RoomContext] Already joined (from backend):', roomId);
        wsService.subscribe(roomId);
        return true;
      }
      
      // Rollback
      console.error('[RoomContext] Join failed:', err);
      setJoinedRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
      return false;
    } finally {
      setJoiningRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
    }
  }, [joiningRoomIds, joinedRoomIds, leavingRoomIds, upsertRoom]);
  
  const leaveRoom = useCallback(async (roomId: string): Promise<boolean> => {
    console.log('[RoomContext] leaveRoom called:', roomId);
    console.log('[RoomContext] Current joinedRoomIds:', Array.from(joinedRoomIds));
    
    // Guards
    if (leavingRoomIds.has(roomId)) {
      console.warn('[RoomContext] Already leaving:', roomId);
      return false;
    }
    if (!joinedRoomIds.has(roomId)) {
      console.log('[RoomContext] Not joined:', roomId);
      return true;
    }
    
    // Mark as leaving
    setLeavingRoomIds(prev => new Set(prev).add(roomId));
    
    try {
      // Call backend first
      await roomService.leaveRoom(roomId);
      console.log('[RoomContext] Leave backend successful:', roomId);
      
      // Update state after success
      setJoinedRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        console.log('[RoomContext] Updated joinedRoomIds:', Array.from(next));
        return next;
      });
      
      // Unsubscribe from WebSocket
      wsService.unsubscribe(roomId);
      
      return true;
    } catch (err) {
      console.error('[RoomContext] Leave failed:', err);
      return false;
    } finally {
      setLeavingRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
    }
  }, [leavingRoomIds, joinedRoomIds]);
  
  // ============================================================================
  // Helpers
  // ============================================================================
  
  const getRoomById = useCallback((roomId: string): Room | null => {
    const room = roomsById.get(roomId);
    if (!room) return null;
    return {
      ...room,
      hasJoined: joinedRoomIds.has(roomId),
    };
  }, [roomsById, joinedRoomIds]);
  
  const isRoomJoined = useCallback((roomId: string): boolean => {
    return joinedRoomIds.has(roomId);
  }, [joinedRoomIds]);
  
  const isJoiningRoom = useCallback((roomId: string): boolean => {
    return joiningRoomIds.has(roomId);
  }, [joiningRoomIds]);
  
  const isLeavingRoom = useCallback((roomId: string): boolean => {
    return leavingRoomIds.has(roomId);
  }, [leavingRoomIds]);
  
  // ============================================================================
  // WebSocket Event Handlers
  // ============================================================================
  
  useEffect(() => {
    const handleRoomClosed = (payload: { roomId: string }) => {
      console.log('[RoomContext] Room closed:', payload.roomId);
      removeRoom(payload.roomId);
    };
    
    const handleRoomUpdated = (payload: { roomId: string; [key: string]: any }) => {
      const { roomId, ...updates } = payload;
      console.log('[RoomContext] Room updated:', roomId);
      updateRoom(roomId, updates as Partial<Room>);
    };
    
    const handleUserLeft = (payload: { roomId: string; userId: string }) => {
      // If current user left (from another device/screen)
      if (payload.userId === user?.id) {
        console.log('[RoomContext] Current user left room:', payload.roomId);
        setJoinedRoomIds(prev => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
        // Also clear from leavingRoomIds to allow immediate rejoin
        setLeavingRoomIds(prev => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
        wsService.unsubscribe(payload.roomId);
      }
    };
    
    const handleUserJoined = (payload: { roomId: string; userId: string }) => {
      // If current user joined (from another device)
      if (payload.userId === user?.id) {
        console.log('[RoomContext] Current user joined room:', payload.roomId);
        setJoinedRoomIds(prev => new Set(prev).add(payload.roomId));
        wsService.subscribe(payload.roomId);
      }
    };
    
    const handleRoomCreated = (payload: any) => {
      const roomData = payload.room;
      console.log('[RoomContext] Room created:', roomData.id);
      
      // Convert to Room type
      const newRoom: Room = {
        id: roomData.id,
        title: roomData.title,
        description: roomData.description || '',
        latitude: roomData.location.latitude,
        longitude: roomData.location.longitude,
        radius: roomData.radiusMeters,
        category: roomData.category?.toUpperCase() || 'GENERAL',
        emoji: '💬',
        participantCount: roomData.participantCount || 1,
        maxParticipants: 50,
        distance: 0,
        expiresAt: roomData.expiresAt ? new Date(roomData.expiresAt) : new Date(Date.now() + 3600000),
        createdAt: new Date(),
        timeRemaining: '1h',
        status: 'active',
        isNew: true,
      };
      
      upsertRoom(newRoom);
      setDiscoveredRoomIds(prev => new Set(prev).add(newRoom.id));
      
      // If user created this room
      if (roomData.creatorId === user?.id) {
        setJoinedRoomIds(prev => new Set(prev).add(newRoom.id));
      }
    };
    
    const unsubClosed = wsService.on(WS_EVENTS.ROOM_CLOSED, handleRoomClosed);
    const unsubUpdated = wsService.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    const unsubLeft = wsService.on(WS_EVENTS.USER_LEFT, handleUserLeft);
    const unsubJoined = wsService.on(WS_EVENTS.USER_JOINED, handleUserJoined);
    const unsubCreated = wsService.on(WS_EVENTS.ROOM_CREATED, handleRoomCreated);
    
    return () => {
      unsubClosed();
      unsubUpdated();
      unsubLeft();
      unsubJoined();
      unsubCreated();
    };
  }, [user?.id, removeRoom, updateRoom, upsertRoom]);
  
  // Fetch my rooms on user change
  useEffect(() => {
    if (user) {
      fetchMyRooms();
    } else {
      setJoinedRoomIds(new Set());
    }
  }, [user, fetchMyRooms]);
  
  // ============================================================================
  // Context Value
  // ============================================================================
  
  const value = useMemo<RoomContextValue>(() => ({
    allRooms: roomsById,
    discoveredRooms,
    activeRooms,
    myRooms,
    isLoading,
    error,
    selectedRoom,
    setSelectedRoom,
    fetchDiscoveredRooms,
    fetchMyRooms,
    joinRoom,
    leaveRoom,
    getRoomById,
    isRoomJoined,
    isJoiningRoom,
    isLeavingRoom,
  }), [
    roomsById,
    discoveredRooms,
    activeRooms,
    myRooms,
    isLoading,
    error,
    selectedRoom,
    fetchDiscoveredRooms,
    fetchMyRooms,
    joinRoom,
    leaveRoom,
    getRoomById,
    isRoomJoined,
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

export function useRooms() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRooms must be used within a RoomProvider');
  }
  return context;
}

// For backward compatibility - returns activeRooms
export function useActiveRooms(): Room[] {
  const { activeRooms } = useRooms();
  return activeRooms;
}

// For sidebar
export function useSidebarRooms(): { activeRooms: Room[]; expiredRooms: Room[] } {
  const { myRooms } = useRooms();
  return useMemo(() => {
    const now = new Date();
    const active = myRooms.filter(room => 
      room.status !== 'closed' && room.expiresAt > now
    );
    const expired = myRooms.filter(room => 
      room.status === 'closed' || room.expiresAt <= now
    );
    return { activeRooms: active, expiredRooms: expired };
  }, [myRooms]);
}

// Check if room is joined - reactive hook
export function useIsRoomJoined(roomId: string): boolean {
  const { myRooms } = useRooms();
  return useMemo(() => myRooms.some(r => r.id === roomId), [myRooms, roomId]);
}

// Get room by ID - reactive hook
export function useRoomById(roomId: string): Room | null {
  const { getRoomById, myRooms, discoveredRooms } = useRooms();
  // Include myRooms and discoveredRooms in deps to trigger re-render when they change
  return useMemo(() => getRoomById(roomId), [getRoomById, roomId, myRooms, discoveredRooms]);
}

// Check if joining
export function useIsJoiningRoom(roomId: string): boolean {
  const { isJoiningRoom } = useRooms();
  return isJoiningRoom(roomId);
}

// Check if leaving
export function useIsLeavingRoom(roomId: string): boolean {
  const { isLeavingRoom } = useRooms();
  return isLeavingRoom(roomId);
}

export default RoomContext;
