/**
 * useRoomWebSocket Hook
 *
 * Subscribes to EventBus events and updates the RoomStore.
 * This hook centralizes all room-related WebSocket event handling,
 * eliminating the duplicate handlers scattered across contexts and hooks.
 *
 * Design:
 * - Uses EventBus for decoupled event handling (WebSocket → EventBus → Store)
 * - Single subscription point for room events
 * - Updates RoomStore directly (no context dependencies)
 * - Handles deduplication for kick/ban events
 * - Cleans up subscriptions on unmount
 *
 * Usage:
 * Mount this hook once at the app level (e.g., in App.tsx or a provider)
 * ```typescript
 * function AppProviders({ children }) {
 *   useRoomWebSocket();
 *   return children;
 * }
 * ```
 */

import { useEffect, useRef } from 'react';
import { eventBus } from '../../../core/events';
import { wsService, roomService } from '../../../services';
import { useRoomStore } from '../store/RoomStore';
import { Room } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('RoomWebSocket');

// Deduplication sets for events that may fire multiple times (React StrictMode)
const processedKickEvents = new Set<string>();
const processedBanEvents = new Set<string>();
const EVENT_DEDUP_TTL = 5000; // 5 seconds

/**
 * Hook to subscribe to room-related WebSocket events
 * @param userId - Current user's ID (for handling kick/ban of current user)
 */
export function useRoomWebSocket(userId?: string): void {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Use refs for store actions to avoid re-subscription on every render
  // Zustand actions are stable, but we use refs to guarantee the effect only runs once
  const storeActionsRef = useRef({
    setRoom: useRoomStore.getState().setRoom,
    updateRoom: useRoomStore.getState().updateRoom,
    removeRoom: useRoomStore.getState().removeRoom,
    addJoinedRoom: useRoomStore.getState().addJoinedRoom,
    removeJoinedRoom: useRoomStore.getState().removeJoinedRoom,
    addDiscoveredRoomIds: useRoomStore.getState().addDiscoveredRoomIds,
  });

  useEffect(() => {
    // Get actions from ref (stable reference)
    const { setRoom, updateRoom, removeRoom, addJoinedRoom, removeJoinedRoom, addDiscoveredRoomIds } = storeActionsRef.current;
    log.debug('Subscribing to room WebSocket events');

    // =========================================================================
    // Room Lifecycle Events
    // =========================================================================

    const handleRoomCreated = (payload: { roomId: string; room: any }) => {
      const roomData = payload.room;
      log.debug('Room created', { roomId: roomData.id });

      const currentUserId = userIdRef.current;
      const isCreator = roomData.creatorId === currentUserId;
      const isGlobalRoom = roomData.radiusMeters === 0;

      // Only add rooms that the user should see
      if (!isCreator && !isGlobalRoom) {
        log.debug('Ignoring nearby room created by another user');
        return;
      }

      const newRoom: Room = {
        id: roomData.id,
        title: roomData.title,
        description: roomData.description || '',
        latitude: roomData.location?.latitude ?? roomData.latitude,
        longitude: roomData.location?.longitude ?? roomData.longitude,
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
        isCreator,
        hasJoined: isCreator,
      };

      setRoom(newRoom);
      addDiscoveredRoomIds([newRoom.id]);

      if (isCreator) {
        addJoinedRoom(newRoom.id);
      }
    };

    const handleRoomUpdated = (payload: {
      roomId: string;
      updates: Partial<{
        title: string;
        description: string;
        participantCount: number;
        status: string;
      }>;
    }) => {
      log.debug('Room updated', { roomId: payload.roomId });
      updateRoom(payload.roomId, payload.updates as Partial<Room>);
    };

    const handleRoomClosed = (payload: { roomId: string; closedBy: string }) => {
      log.info('Room closed', { roomId: payload.roomId, closedBy: payload.closedBy });
      
      // Remove from joined rooms first
      removeJoinedRoom(payload.roomId);
      
      // Then remove from store
      removeRoom(payload.roomId);
    };

    const handleRoomExpiring = (payload: { roomId: string; expiresAt: string; minutesRemaining: number }) => {
      log.info('Room expiring', { roomId: payload.roomId, minutesRemaining: payload.minutesRemaining });
      
      // Update room status to 'expiring'
      updateRoom(payload.roomId, { 
        status: 'expiring',
        expiresAt: new Date(payload.expiresAt),
      } as Partial<Room>);
    };

    const handleParticipantCount = (payload: { roomId: string; participantCount: number }) => {
      log.debug('Participant count updated', payload);
      updateRoom(payload.roomId, { participantCount: payload.participantCount });
    };

    // =========================================================================
    // User Membership Events
    // =========================================================================

    const handleUserJoined = (payload: {
      roomId: string;
      userId: string;
      userName: string;
      participantCount?: number;
    }) => {
      log.debug('User joined room', { roomId: payload.roomId });

      // Update participant count
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      }

      // If current user joined (from another device)
      const currentUserId = userIdRef.current;
      if (payload.userId === currentUserId) {
        addJoinedRoom(payload.roomId);
        wsService.subscribe(payload.roomId);
      }
    };

    const handleUserLeft = (payload: {
      roomId: string;
      userId: string;
      userName?: string;
      participantCount?: number;
    }) => {
      log.debug('User left room', { roomId: payload.roomId });

      // Update participant count
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      }

      // If current user left
      const currentUserId = userIdRef.current;
      if (payload.userId === currentUserId) {
        removeJoinedRoom(payload.roomId);
        wsService.unsubscribe(payload.roomId);
      }
    };

    const handleUserKicked = async (payload: {
      roomId: string;
      kickedUserId: string;
      kickedBy: string;
      userName?: string;
    }) => {
      // Deduplication
      const eventKey = `${payload.roomId}-${payload.kickedUserId}`;
      if (processedKickEvents.has(eventKey)) {
        log.debug('Ignoring duplicate kick event');
        return;
      }
      processedKickEvents.add(eventKey);
      setTimeout(() => processedKickEvents.delete(eventKey), EVENT_DEDUP_TTL);

      const currentUserId = userIdRef.current;
      log.info('User kicked event received', { 
        kickedUserId: payload.kickedUserId, 
        currentUserId, 
        roomId: payload.roomId,
        isCurrentUser: payload.kickedUserId === currentUserId 
      });

      // If current user was kicked
      if (payload.kickedUserId === currentUserId) {
        log.warn('Current user was kicked - removing from room');
        removeJoinedRoom(payload.roomId);
        wsService.unsubscribe(payload.roomId);
        return;
      }

      // Fetch fresh data to get updated participant count
      try {
        const freshRoom = await roomService.getRoom(payload.roomId);
        updateRoom(payload.roomId, { participantCount: freshRoom.participantCount });
      } catch (error) {
        log.error('Failed to refresh room after kick', error);
      }
    };

    const handleUserBanned = async (payload: {
      roomId: string;
      bannedUserId: string;
      bannedBy: string;
      reason?: string;
      userName?: string;
    }) => {
      // Deduplication
      const eventKey = `${payload.roomId}-${payload.bannedUserId}`;
      if (processedBanEvents.has(eventKey)) {
        log.debug('Ignoring duplicate ban event');
        return;
      }
      processedBanEvents.add(eventKey);
      setTimeout(() => processedBanEvents.delete(eventKey), EVENT_DEDUP_TTL);

      log.info('User banned event received', { 
        bannedUserId: payload.bannedUserId, 
        roomId: payload.roomId 
      });

      const currentUserId = userIdRef.current;
      log.info('Checking if current user was banned', {
        bannedUserId: payload.bannedUserId,
        currentUserId,
        isCurrentUser: payload.bannedUserId === currentUserId
      });

      // If current user was banned
      if (payload.bannedUserId === currentUserId) {
        log.warn('Current user was banned - removing from room');
        removeJoinedRoom(payload.roomId);
        removeRoom(payload.roomId); // Remove from discovery too
        wsService.unsubscribe(payload.roomId);
        return;
      }

      // Fetch fresh data to get updated participant count
      try {
        const freshRoom = await roomService.getRoom(payload.roomId);
        updateRoom(payload.roomId, { participantCount: freshRoom.participantCount });
      } catch (error) {
        log.error('Failed to refresh room after ban', error);
      }
    };

    // Handle user unbanned - if current user was unbanned, fetch and add room to discovery
    const handleUserUnbanned = async (payload: {
      roomId: string;
      unbannedUserId: string;
      unbannedBy: string;
    }) => {
      log.info('User unbanned event received', { userId: payload.unbannedUserId, roomId: payload.roomId });

      const currentUserId = userIdRef.current;

      // If current user was unbanned, fetch the room and add it to discovery
      if (payload.unbannedUserId === currentUserId) {
        log.info('Current user was unbanned, fetching room');
        try {
          const room = await roomService.getRoom(payload.roomId);
          setRoom(room);
          addDiscoveredRoomIds([room.id]);
          log.info('Room added to discovery after unban', { roomId: room.id, title: room.title });
        } catch (error) {
          log.error('Failed to fetch room after unban', error);
        }
      }
    };

    // =========================================================================
    // Subscribe to EventBus Events
    // =========================================================================

    const unsubCreated = eventBus.on('room.created', handleRoomCreated);
    const unsubUpdated = eventBus.on('room.updated', handleRoomUpdated);
    const unsubClosed = eventBus.on('room.closed', handleRoomClosed);
    const unsubExpiring = eventBus.on('room.expiring', handleRoomExpiring);
    const unsubParticipantCount = eventBus.on('room.participantCountUpdated', handleParticipantCount);
    const unsubJoined = eventBus.on('room.userJoined', handleUserJoined);
    const unsubLeft = eventBus.on('room.userLeft', handleUserLeft);
    const unsubKicked = eventBus.on('room.userKicked', handleUserKicked);
    const unsubBanned = eventBus.on('room.userBanned', handleUserBanned);
    const unsubUnbanned = eventBus.on('room.userUnbanned', handleUserUnbanned);

    return () => {
      log.debug('Unsubscribing from room EventBus events');
      unsubCreated();
      unsubUpdated();
      unsubClosed();
      unsubExpiring();
      unsubParticipantCount();
      unsubJoined();
      unsubLeft();
      unsubKicked();
      unsubBanned();
      unsubUnbanned();
    };
  }, []); // Empty deps - only subscribe once, actions accessed via ref/getState()
}

export default useRoomWebSocket;
