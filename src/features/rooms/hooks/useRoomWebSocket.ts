/**
 * useRoomWebSocket Hook
 *
 * Subscribes to WebSocket events and updates the RoomStore.
 * This hook centralizes all room-related WebSocket event handling,
 * eliminating the duplicate handlers scattered across contexts and hooks.
 *
 * Design:
 * - Single subscription point for room WebSocket events
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
import { wsService, WS_EVENTS, roomService } from '../../../services';
import { useRoomStore } from '../store';
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

  // Get store actions
  const setRoom = useRoomStore((s) => s.setRoom);
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const removeRoom = useRoomStore((s) => s.removeRoom);
  const addJoinedRoom = useRoomStore((s) => s.addJoinedRoom);
  const removeJoinedRoom = useRoomStore((s) => s.removeJoinedRoom);
  const addDiscoveredRoomIds = useRoomStore((s) => s.addDiscoveredRoomIds);

  useEffect(() => {
    log.debug('Subscribing to room WebSocket events');

    // =========================================================================
    // Room Lifecycle Events
    // =========================================================================

    const handleRoomCreated = (payload: any) => {
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

    const handleRoomUpdated = (payload: { roomId: string; [key: string]: any }) => {
      const { roomId, ...updates } = payload;
      log.debug('Room updated', { roomId });
      updateRoom(roomId, updates as Partial<Room>);
    };

    const handleRoomClosed = (payload: { roomId: string }) => {
      log.debug('Room closed', { roomId: payload.roomId });
      removeRoom(payload.roomId);
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
      user?: { id: string; displayName: string };
      participantCount?: number;
    }) => {
      log.debug('User joined room', { roomId: payload.roomId });

      // Update participant count
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      }

      // If current user joined (from another device)
      const currentUserId = userIdRef.current;
      if (payload.userId === currentUserId || payload.user?.id === currentUserId) {
        addJoinedRoom(payload.roomId);
        wsService.subscribe(payload.roomId);
      }
    };

    const handleUserLeft = (payload: {
      roomId: string;
      userId: string;
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
      participantCount?: number;
    }) => {
      // Deduplication
      const eventKey = `${payload.roomId}-${payload.kickedUserId}`;
      if (processedKickEvents.has(eventKey)) {
        log.debug('Ignoring duplicate kick event');
        return;
      }
      processedKickEvents.add(eventKey);
      setTimeout(() => processedKickEvents.delete(eventKey), EVENT_DEDUP_TTL);

      log.debug('User kicked', { userId: payload.kickedUserId, roomId: payload.roomId });

      const currentUserId = userIdRef.current;

      // If current user was kicked
      if (payload.kickedUserId === currentUserId) {
        log.warn('Current user was kicked');
        removeJoinedRoom(payload.roomId);
        wsService.unsubscribe(payload.roomId);
        return;
      }

      // Update participant count
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      } else {
        // Fallback: fetch fresh data
        try {
          const freshRoom = await roomService.getRoom(payload.roomId);
          updateRoom(payload.roomId, { participantCount: freshRoom.participantCount });
        } catch (error) {
          log.error('Failed to refresh room after kick', error);
        }
      }
    };

    const handleUserBanned = async (payload: {
      roomId: string;
      bannedUserId: string;
      bannedBy: string;
      reason?: string;
      participantCount?: number;
    }) => {
      // Deduplication
      const eventKey = `${payload.roomId}-${payload.bannedUserId}`;
      if (processedBanEvents.has(eventKey)) {
        log.debug('Ignoring duplicate ban event');
        return;
      }
      processedBanEvents.add(eventKey);
      setTimeout(() => processedBanEvents.delete(eventKey), EVENT_DEDUP_TTL);

      log.debug('User banned', { userId: payload.bannedUserId, roomId: payload.roomId });

      const currentUserId = userIdRef.current;

      // If current user was banned
      if (payload.bannedUserId === currentUserId) {
        log.warn('Current user was banned');
        removeJoinedRoom(payload.roomId);
        removeRoom(payload.roomId); // Remove from discovery too
        wsService.unsubscribe(payload.roomId);
        return;
      }

      // Update participant count
      if (payload.participantCount !== undefined) {
        updateRoom(payload.roomId, { participantCount: payload.participantCount });
      } else {
        // Fallback: fetch fresh data
        try {
          const freshRoom = await roomService.getRoom(payload.roomId);
          updateRoom(payload.roomId, { participantCount: freshRoom.participantCount });
        } catch (error) {
          log.error('Failed to refresh room after ban', error);
        }
      }
    };

    // =========================================================================
    // Subscribe to Events
    // =========================================================================

    const unsubCreated = wsService.on(WS_EVENTS.ROOM_CREATED, handleRoomCreated);
    const unsubUpdated = wsService.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdated);
    const unsubClosed = wsService.on(WS_EVENTS.ROOM_CLOSED, handleRoomClosed);
    const unsubParticipantCount = wsService.on(WS_EVENTS.PARTICIPANT_COUNT, handleParticipantCount);
    const unsubJoined = wsService.on(WS_EVENTS.USER_JOINED, handleUserJoined);
    const unsubLeft = wsService.on(WS_EVENTS.USER_LEFT, handleUserLeft);
    const unsubKicked = wsService.on(WS_EVENTS.USER_KICKED, handleUserKicked);
    const unsubBanned = wsService.on(WS_EVENTS.USER_BANNED, handleUserBanned);

    return () => {
      log.debug('Unsubscribing from room WebSocket events');
      unsubCreated();
      unsubUpdated();
      unsubClosed();
      unsubParticipantCount();
      unsubJoined();
      unsubLeft();
      unsubKicked();
      unsubBanned();
    };
  }, [setRoom, updateRoom, removeRoom, addJoinedRoom, removeJoinedRoom, addDiscoveredRoomIds]);
}

export default useRoomWebSocket;
