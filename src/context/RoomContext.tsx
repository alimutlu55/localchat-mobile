/**
 * RoomContext - Legacy Room State Management
 *
 * ⚠️ MIGRATION IN PROGRESS
 *
 * This context is being replaced by smaller, focused hooks:
 *
 * | Old (RoomContext)      | New (features/rooms)           |
 * |------------------------|--------------------------------|
 * | getRoomById()          | useRoom(roomId)                |
 * | joinRoom()             | useJoinRoom().join()           |
 * | leaveRoom()            | useJoinRoom().leave()          |
 * | myRooms                | useMyRooms().rooms             |
 * | isRoomJoined()         | useMyRooms().isJoined()        |
 * | fetchDiscoveredRooms() | useRoomDiscovery().refresh()   |
 *
 * For new screens, use:
 * ```typescript
 * import { useRoom, useJoinRoom, useMyRooms } from '@/features/rooms';
 * ```
 *
 * This context remains for backward compatibility with existing screens.
 * It syncs data to RoomCacheContext so both systems stay consistent.
 *
 * Architecture:
 * - ONE Map<roomId, Room> stores all room data
 * - ONE Set<roomId> tracks which rooms user has joined
 * - All views (map, list, sidebar) derive from these two sources
 * - Syncs to RoomCacheContext for new hooks
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
import { useRoomCache } from '../features/rooms/context/RoomCacheContext';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('RoomContext');

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
  isLoadingMore: boolean;       // NEW: Loading more rooms (pagination)
  error: string | null;

  // Pagination state
  hasMoreRooms: boolean;        // NEW: Whether more rooms are available
  currentPage: number;          // NEW: Current page number

  // Selection
  selectedRoom: Room | null;
  setSelectedRoom: (room: Room | null) => void;

  // Actions
  fetchDiscoveredRooms: (lat: number, lng: number, radius?: number) => Promise<void>;
  loadMoreRooms: (lat: number, lng: number, radius?: number) => Promise<void>; // NEW
  fetchMyRooms: () => Promise<void>;
  joinRoom: (room: Room) => Promise<boolean>;
  leaveRoom: (roomId: string) => Promise<boolean>;

  // Helpers
  getRoomById: (roomId: string) => Room | null;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  isRoomJoined: (roomId: string) => boolean;
  isJoiningRoom: (roomId: string) => boolean;
  isLeavingRoom: (roomId: string) => boolean;

  // Helper to add a created room to context
  addCreatedRoom: (room: Room) => void;
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
  const [isLoadingMore, setIsLoadingMore] = useState(false); // NEW: For pagination
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreRooms, setHasMoreRooms] = useState(true);

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
    log.debug('Computing myRooms', { joinedCount: joinedRoomIds.size });
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
    log.debug('myRooms computed', { count: sorted.length });
    return sorted;
  }, [roomsById, joinedRoomIds]);

  // ============================================================================
  // Room Data Operations
  // ============================================================================

  // Get room cache for syncing
  const roomCache = useRoomCache();

  // Update or add a room to the store
  const upsertRoom = useCallback((room: Room) => {
    setRoomsById(prev => {
      const next = new Map(prev);
      const existing = next.get(room.id);
      // Merge with existing data to preserve fields
      next.set(room.id, existing ? { ...existing, ...room } : room);
      return next;
    });
    // Sync to new cache for hooks using it
    roomCache.setRoom(room);
  }, [roomCache]);

  // Update room fields
  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    setRoomsById(prev => {
      const room = prev.get(roomId);
      if (!room) return prev;
      const next = new Map(prev);
      next.set(roomId, { ...room, ...updates });
      return next;
    });
    // Sync to new cache
    roomCache.updateRoom(roomId, updates);
  }, [roomCache]);

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
    // Sync to new cache
    roomCache.removeRoom(roomId);
  }, [roomCache]);

  // Add a created room to context (called when user creates a room)
  const addCreatedRoom = useCallback((room: Room) => {
    log.debug('Adding created room', { roomId: room.id });
    upsertRoom(room);
    setDiscoveredRoomIds(prev => new Set(prev).add(room.id));
    setJoinedRoomIds(prev => new Set(prev).add(room.id));
  }, [upsertRoom]);

  // ============================================================================
  // Fetch Operations
  // ============================================================================

  const fetchDiscoveredRooms = useCallback(async (
    lat: number,
    lng: number,
    radius?: number
  ) => {
    log.debug('Fetching discovered rooms', { page: 0 });
    setIsLoading(true);
    setError(null);
    setCurrentPage(0); // Reset to first page

    try {
      const { rooms: fetchedRooms, hasNext } = await roomService.getNearbyRooms(
        lat, lng,
        0,  // page 0
        20, // pageSize
        radius
      );
      log.info('Fetched rooms', { count: fetchedRooms.length, hasNext });

      // Replace discovered rooms (not append)
      const newDiscoveredIds = new Set<string>();
      
      // Batch update local state
      setRoomsById(prev => {
        const next = new Map(prev);
        fetchedRooms.forEach((room: Room) => {
          const existing = next.get(room.id);
          next.set(room.id, existing ? { ...existing, ...room } : room);
          newDiscoveredIds.add(room.id);
        });
        return next;
      });

      // Batch sync to cache (single operation instead of 20)
      roomCache.setRooms(fetchedRooms);

      // Update joined IDs for rooms user has joined
      fetchedRooms.forEach((room: Room) => {
        if (room.hasJoined || room.isCreator) {
          setJoinedRoomIds(prev => new Set(prev).add(room.id));
        }
      });

      setDiscoveredRoomIds(newDiscoveredIds);
      setHasMoreRooms(hasNext);
      setCurrentPage(1); // Next page will be 1
    } catch (err) {
      log.error('Failed to fetch rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
    } finally {
      setIsLoading(false);
    }
  }, [roomCache]);

  const loadMoreRooms = useCallback(async (
    lat: number,
    lng: number,
    radius?: number
  ) => {
    // Prevent multiple simultaneous loads
    if (isLoadingMore || !hasMoreRooms) {
      log.debug('Skip loadMore', { isLoadingMore, hasMoreRooms });
      return;
    }

    log.debug('Loading more rooms', { page: currentPage });
    setIsLoadingMore(true);

    try {
      const { rooms: fetchedRooms, hasNext } = await roomService.getNearbyRooms(
        lat, lng,
        currentPage,
        20,
        radius
      );
      log.info('Loaded more rooms', { count: fetchedRooms.length, hasNext });

      // Batch update local state
      setRoomsById(prev => {
        const next = new Map(prev);
        fetchedRooms.forEach((room: Room) => {
          const existing = next.get(room.id);
          next.set(room.id, existing ? { ...existing, ...room } : room);
        });
        return next;
      });

      // Batch sync to cache
      roomCache.setRooms(fetchedRooms);

      // Update discovered and joined IDs
      setDiscoveredRoomIds(prev => {
        const next = new Set(prev);
        fetchedRooms.forEach((room: Room) => next.add(room.id));
        return next;
      });

      fetchedRooms.forEach((room: Room) => {
        if (room.hasJoined || room.isCreator) {
          setJoinedRoomIds(prev => new Set(prev).add(room.id));
        }
      });

      setHasMoreRooms(hasNext);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      log.error('Failed to load more rooms', err);
      setError(err instanceof Error ? err.message : 'Failed to load more rooms');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMoreRooms, isLoadingMore, roomCache]);

  const fetchMyRooms = useCallback(async () => {
    log.debug('Fetching my rooms');

    try {
      const fetchedRooms = await roomService.getMyRooms();
      log.info('Fetched my rooms', { count: fetchedRooms.length });

      // Filter active rooms
      const activeRooms = fetchedRooms.filter(room => room.status !== 'closed');

      // Batch update local state
      setRoomsById(prev => {
        const next = new Map(prev);
        activeRooms.forEach(room => {
          const existing = next.get(room.id);
          next.set(room.id, existing ? { ...existing, ...room } : room);
        });
        return next;
      });

      // Batch sync to cache
      if (activeRooms.length > 0) {
        roomCache.setRooms(activeRooms);
      }

      // Update joined IDs
      const newJoinedIds = new Set(activeRooms.map(room => room.id));
      setJoinedRoomIds(newJoinedIds);
    } catch (err) {
      log.error('Failed to fetch my rooms', err);
    }
  }, [roomCache]);

  // ============================================================================
  // Join/Leave Operations
  // ============================================================================

  const joinRoom = useCallback(async (room: Room): Promise<boolean> => {
    const roomId = room.id;
    log.debug('joinRoom called', { roomId });

    // Guards
    if (joiningRoomIds.has(roomId)) {
      log.warn('Already joining', { roomId });
      return false;
    }
    if (joinedRoomIds.has(roomId)) {
      log.debug('Already joined', { roomId });
      return true;
    }
    if (leavingRoomIds.has(roomId)) {
      log.warn('Currently leaving', { roomId });
      return false;
    }

    // Mark as joining
    setJoiningRoomIds(prev => new Set(prev).add(roomId));

    // Optimistic update
    upsertRoom(room);
    setJoinedRoomIds(prev => new Set(prev).add(roomId));

    try {
      await roomService.joinRoom(roomId, room.latitude ?? 0, room.longitude ?? 0);

      // Fetch fresh room data to get updated participantCount and other fields
      try {
        const freshRoom = await roomService.getRoom(roomId);
        upsertRoom(freshRoom);
        log.debug('Updated room after join', { roomId, participantCount: freshRoom.participantCount });
      } catch (fetchError) {
        log.warn('Failed to fetch fresh room data', fetchError);
        // Keep the optimistic update from before
      }

      // Note: ChatRoomScreen will handle wsService.subscribe() when it mounts
      // This separation is cleaner: RoomContext manages membership state, 
      // ChatRoomScreen manages WebSocket connection
      log.info('Join successful', { roomId });
      return true;
    } catch (err: any) {
      // Handle "already joined" as success
      if (err?.code === 'CONFLICT' || err?.message?.includes('already')) {
        log.debug('Already joined (from backend)', { roomId });
        // Note: No need to subscribe here - screen will handle it
        return true;
      }

      // Check if user is banned from this room - throw a special error
      const errorMessage = err?.message || err?.data?.message || err?.error?.message || '';
      const isBanned = errorMessage.toLowerCase().includes('banned');

      if (isBanned) {
        log.warn('User is banned from room', { roomId });
        // Rollback optimistic update
        setJoinedRoomIds(prev => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
        // Throw a specific error that callers can detect
        const bannedError = new Error('You are banned from this room.');
        (bannedError as any).code = 'BANNED';
        throw bannedError;
      }

      // Rollback for other errors
      log.error('Join failed', err);
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
    log.debug('leaveRoom called', { roomId });

    // Guards
    if (leavingRoomIds.has(roomId)) {
      log.warn('Already leaving', { roomId });
      return false;
    }
    if (!joinedRoomIds.has(roomId)) {
      log.debug('Not joined', { roomId });
      return true;
    }

    // Mark as leaving
    setLeavingRoomIds(prev => new Set(prev).add(roomId));

    try {
      // Call backend first
      await roomService.leaveRoom(roomId);
      log.info('Leave successful', { roomId });

      // Update state after success
      setJoinedRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });

      // Unsubscribe from WebSocket
      wsService.unsubscribe(roomId);

      return true;
    } catch (err) {
      log.error('Leave failed', err);
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
      log.debug('Room closed', { roomId: payload.roomId });
      removeRoom(payload.roomId);
    };

    const handleRoomUpdated = (payload: { roomId: string;[key: string]: any }) => {
      const { roomId, ...updates } = payload;
      log.debug('Room updated', { roomId });
      updateRoom(roomId, updates as Partial<Room>);
    };

    const handleUserLeft = (payload: {
      roomId: string;
      userId: string;
      participantCount?: number;
    }) => {
      log.debug('User left room', { roomId: payload.roomId, participantCount: payload.participantCount });

      // Update participant count if provided (for all users, not just current user)
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      }

      // If current user left (from another device/screen)
      if (payload.userId === user?.id) {
        log.debug('Current user left room', { roomId: payload.roomId });
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

        // Only unsubscribe if not currently joining this room
        // (prevents race when user rapidly rejoins)
        if (!joiningRoomIds.has(payload.roomId)) {
          wsService.unsubscribe(payload.roomId);
        } else {
          log.debug('Skipping unsubscribe - user is rejoining', { roomId: payload.roomId });
        }
      }
    };

    const handleUserJoined = (payload: {
      roomId: string;
      userId: string;
      user?: { id: string; displayName: string };
      participantCount?: number;
    }) => {
      log.debug('User joined room', { roomId: payload.roomId, participantCount: payload.participantCount });

      // Update participant count if provided (for all users, not just current user)
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      }

      // If current user joined (from another device)
      if (payload.userId === user?.id || payload.user?.id === user?.id) {
        log.debug('Current user joined room', { roomId: payload.roomId });
        setJoinedRoomIds(prev => new Set(prev).add(payload.roomId));
        wsService.subscribe(payload.roomId);
      }
    };

    const handleRoomCreated = (payload: any) => {
      const roomData = payload.room;
      log.debug('Room created', { roomId: roomData.id, radius: roomData.radiusMeters });

      // Rule 1: If current user created this room, always add it
      const isCreator = roomData.creatorId === user?.id;

      // Rule 2: If room is global (radius = 0), add it for everyone
      const isGlobalRoom = roomData.radiusMeters === 0;

      // Rule 3: If room is nearby (radius > 0) and user is not creator, 
      // let them discover it via /discover API which has proper distance filtering
      if (!isCreator && !isGlobalRoom) {
        log.debug('Ignoring nearby room created by another user');
        return;
      }

      log.debug('Adding room', { roomId: roomData.id, isCreator, isGlobal: isGlobalRoom });

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
        distance: 0, // Distance unknown - will be calculated by UI when user location is available
        expiresAt: roomData.expiresAt ? new Date(roomData.expiresAt) : new Date(Date.now() + 3600000),
        createdAt: new Date(),
        timeRemaining: '1h',
        status: 'active',
        isNew: true,
        isCreator,
        hasJoined: isCreator,
      };

      upsertRoom(newRoom);
      setDiscoveredRoomIds(prev => new Set(prev).add(newRoom.id));

      // Only add to joined rooms if user is the creator
      if (isCreator) {
        setJoinedRoomIds(prev => new Set(prev).add(newRoom.id));
      }
    };

    const handleParticipantCountUpdated = (payload: {
      roomId: string;
      participantCount: number;
    }) => {
      log.debug('Participant count updated', { roomId: payload.roomId, count: payload.participantCount });
      updateRoom(payload.roomId, { participantCount: payload.participantCount });
    };

    // Track processed events to prevent duplicate handling (React StrictMode workaround)
    const processedKickEvents = new Set<string>();
    const processedBanEvents = new Set<string>();

    // Handle user kicked - update participant count and membership
    const handleUserKicked = async (payload: {
      roomId: string;
      kickedUserId: string;
      kickedBy: string;
    }) => {
      // Deduplicate events
      const eventKey = `${payload.roomId}-${payload.kickedUserId}`;
      if (processedKickEvents.has(eventKey)) {
        log.debug('Ignoring duplicate kick event', { eventKey });
        return;
      }
      processedKickEvents.add(eventKey);
      setTimeout(() => processedKickEvents.delete(eventKey), 5000); // Clear after 5s

      log.debug('User kicked', { userId: payload.kickedUserId, roomId: payload.roomId });

      // If current user was kicked, remove from joined rooms
      if (payload.kickedUserId === user?.id) {
        log.warn('Current user was kicked', { roomId: payload.roomId });
        setJoinedRoomIds(prev => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
        wsService.unsubscribe(payload.roomId);
      }

      // Fetch fresh room data to get updated participant count
      try {
        const freshRoom = await roomService.getRoom(payload.roomId);
        updateRoom(payload.roomId, {
          participantCount: freshRoom.participantCount,
          hasJoined: payload.kickedUserId === user?.id ? false : undefined,
        });
      } catch (error) {
        log.error('Failed to refresh room after kick', error);
      }
    };

    // Handle user banned - update participant count and membership
    const handleUserBanned = async (payload: {
      roomId: string;
      bannedUserId: string;
      bannedBy: string;
      reason?: string;
    }) => {
      // Deduplicate events
      const eventKey = `${payload.roomId}-${payload.bannedUserId}`;
      if (processedBanEvents.has(eventKey)) {
        log.debug('Ignoring duplicate ban event', { eventKey });
        return;
      }
      processedBanEvents.add(eventKey);
      setTimeout(() => processedBanEvents.delete(eventKey), 5000); // Clear after 5s

      log.debug('User banned', { userId: payload.bannedUserId, roomId: payload.roomId });

      // If current user was banned, remove from joined rooms AND discovered rooms
      if (payload.bannedUserId === user?.id) {
        log.warn('Current user was banned', { roomId: payload.roomId });
        setJoinedRoomIds(prev => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
        // Also remove from discovered rooms so it disappears from list/map
        setDiscoveredRoomIds(prev => {
          const next = new Set(prev);
          next.delete(payload.roomId);
          return next;
        });
        wsService.unsubscribe(payload.roomId);
        // No need to fetch fresh room data since we're removing the room entirely
        return;
      }

      // For other users being banned, fetch fresh room data to get updated participant count
      try {
        const freshRoom = await roomService.getRoom(payload.roomId);
        updateRoom(payload.roomId, {
          participantCount: freshRoom.participantCount,
        });
      } catch (error) {
        log.error('Failed to refresh room after ban', error);
      }
    };

    const unsubClosed = wsService.on(WS_EVENTS.ROOM_CLOSED, handleRoomClosed);
    const unsubUpdated = wsService.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    const unsubLeft = wsService.on(WS_EVENTS.USER_LEFT, handleUserLeft);
    const unsubJoined = wsService.on(WS_EVENTS.USER_JOINED, handleUserJoined);
    const unsubCreated = wsService.on(WS_EVENTS.ROOM_CREATED, handleRoomCreated);
    const unsubParticipantCount = wsService.on(WS_EVENTS.PARTICIPANT_COUNT, handleParticipantCountUpdated);
    const unsubKicked = wsService.on(WS_EVENTS.USER_KICKED, handleUserKicked);
    const unsubBanned = wsService.on(WS_EVENTS.USER_BANNED, handleUserBanned);

    return () => {
      unsubClosed();
      unsubUpdated();
      unsubLeft();
      unsubJoined();
      unsubCreated();
      unsubParticipantCount();
      unsubKicked();
      unsubBanned();
    };
  }, [user?.id, removeRoom, updateRoom, upsertRoom, joiningRoomIds]);

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
    isLoadingMore,      // NEW
    error,
    hasMoreRooms,       // NEW
    currentPage,        // NEW
    selectedRoom,
    setSelectedRoom,
    fetchDiscoveredRooms,
    loadMoreRooms,      // NEW
    fetchMyRooms,
    joinRoom,
    leaveRoom,
    getRoomById,
    updateRoom,
    isRoomJoined,
    isJoiningRoom,
    isLeavingRoom,
    addCreatedRoom,      // NEW
  }), [
    roomsById,
    discoveredRooms,
    activeRooms,
    myRooms,
    isLoading,
    isLoadingMore,      // NEW
    error,
    hasMoreRooms,       // NEW
    currentPage,        // NEW
    selectedRoom,
    fetchDiscoveredRooms,
    loadMoreRooms,      // NEW
    fetchMyRooms,
    joinRoom,
    leaveRoom,
    getRoomById,
    updateRoom,
    isRoomJoined,
    isJoiningRoom,
    isLeavingRoom,
    addCreatedRoom,      // NEW
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

/**
 * Subscribe to a room with automatic refresh on WebSocket events.
 * This hook ensures you always have fresh room data.
 * 
 * USE THIS in ChatRoomScreen and RoomDetailsScreen instead of route params!
 * 
 * @param roomId - The room ID to subscribe to
 * @returns The latest room data or null if not found
 */
export function useRoomSubscription(roomId: string): {
  room: Room | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { getRoomById, updateRoom, isRoomJoined } = useRooms();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);

  // Fetch fresh data function
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const freshRoom = await roomService.getRoom(roomId);

      // Update context cache
      updateRoom(roomId, freshRoom);
      setRoom(freshRoom);
    } catch (error) {
      log.error('Failed to fetch room in subscription', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, updateRoom]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to context updates
  useEffect(() => {
    const latestRoom = getRoomById(roomId);
    if (latestRoom) {
      setRoom(latestRoom);
    }
  }, [getRoomById, roomId]);

  // Auto-refresh on WebSocket events for this room
  useEffect(() => {
    const handleRoomUpdate = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        log.debug('Room updated via WebSocket, refreshing', { roomId });
        refresh();
      }
    };

    const handleParticipantChange = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        log.debug('Participant change, refreshing', { roomId });
        refresh();
      }
    };

    const unsubUpdated = wsService.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdate);
    const unsubJoined = wsService.on(WS_EVENTS.USER_JOINED, handleParticipantChange);
    const unsubLeft = wsService.on(WS_EVENTS.USER_LEFT, handleParticipantChange);
    const unsubKicked = wsService.on(WS_EVENTS.USER_KICKED, handleParticipantChange);
    const unsubBanned = wsService.on(WS_EVENTS.USER_BANNED, handleParticipantChange);
    const unsubParticipantCount = wsService.on(WS_EVENTS.PARTICIPANT_COUNT, handleParticipantChange);

    return () => {
      unsubUpdated();
      unsubJoined();
      unsubLeft();
      unsubKicked();
      unsubBanned();
      unsubParticipantCount();
    };
  }, [roomId, refresh]);

  return { room, isLoading, refresh };
}

export default RoomContext;
