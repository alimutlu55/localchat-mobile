/**
 * useRoomEvents Hook
 *
 * Unified event handler for all room-related WebSocket events.
 * This hook replaces useRoomWebSocket and useDiscoveryEvents, providing a
 * single source of truth for how events update the global RoomStore.
 *
 * Design:
 * - Subscribes to EventBus events once at the app level
 * - Updates RoomStore directly (data, membership, and discovery status)
 * - Decouples event handling from UI component lifecycles
 */

import { useEffect, useRef } from 'react';
import { eventBus } from '../../../core/events';
import { wsService, roomService } from '../../../services';
import { useRoomStore } from '../store/RoomStore';
import { Room } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';
import { getCategoryEmoji } from '../../../constants';

const log = createLogger('RoomEvents');

// Deduplication sets for events that may fire multiple times (React StrictMode)
const processedKickEvents = new Set<string>();
const processedBanEvents = new Set<string>();
const EVENT_DEDUP_TTL = 5000;



/**
 * Global hook to handle room events
 * @param userId - Current user's ID
 */
export function useRoomEvents(userId?: string): void {
    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    useEffect(() => {
        log.debug('Subscribing to unified room events');
        const store = useRoomStore.getState();

        // =========================================================================
        // Room Lifecycle Events
        // =========================================================================

        const handleRoomCreated = (payload: { roomId: string; room: any }) => {
            const roomData = payload.room;
            log.info('Room created event received', {
                roomId: roomData.id,
                category: roomData.category,
                categoryIcon: roomData.categoryIcon,
                resolvedEmoji: roomData.categoryIcon || getCategoryEmoji(roomData.category)
            });

            const currentUserId = userIdRef.current;
            const isCreator = roomData.creatorId === currentUserId;
            const isGlobalRoom = roomData.radiusMeters === 0;

            // Only process if it's our room or a global room
            // Nearby rooms by others will be fetched via discovery/map bounds
            if (!isCreator && !isGlobalRoom) {
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
                emoji: roomData.categoryIcon || getCategoryEmoji(roomData.category),
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

            // Update store state
            store.setRoom(newRoom);

            if (isCreator) {
                store.addJoinedRoom(newRoom.id);
                store.addCreatedRoom(newRoom.id);
            }

            // Mark as pending for discovery/map view to pick it up immediately
            store.addPendingRoom(newRoom.id);
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
            store.updateRoom(payload.roomId, payload.updates as Partial<Room>);
        };

        const handleRoomClosed = (payload: { roomId: string; closedBy: string }) => {
            log.info('Room closed event received', { roomId: payload.roomId });

            // Remove from active membership
            store.removeJoinedRoom(payload.roomId);

            // Hide from discovery immediately
            store.hideRoom(payload.roomId);

            // Update room status in store (don't remove yet to allow observers to see closed state)
            store.updateRoom(payload.roomId, { status: 'closed' });

            // Unsubscribe since it's dead
            wsService.unsubscribe(payload.roomId);
        };

        const handleRoomExpiring = (payload: { roomId: string; expiresAt: string; minutesRemaining: number }) => {
            log.info('Room expiring', { roomId: payload.roomId, minutesRemaining: payload.minutesRemaining });
            store.updateRoom(payload.roomId, {
                status: 'expiring',
                expiresAt: new Date(payload.expiresAt),
            } as Partial<Room>);
        };

        const handleParticipantCount = (payload: { roomId: string; participantCount: number }) => {
            log.debug('Participant count updated', payload);
            store.updateRoom(payload.roomId, { participantCount: payload.participantCount });
        };

        // =========================================================================
        // User Membership & Moderation
        // =========================================================================

        const handleUserJoined = (payload: {
            roomId: string;
            userId: string;
            userName: string;
            participantCount?: number;
        }) => {
            log.debug('User joined room event', { roomId: payload.roomId, userId: payload.userId });

            // Update participant count
            if (payload.participantCount !== undefined) {
                store.updateRoom(payload.roomId, { participantCount: payload.participantCount });
            }

            // If current user joined (external trigger like another device or auto-join)
            const currentUserId = userIdRef.current;
            if (payload.userId === currentUserId) {
                store.addJoinedRoom(payload.roomId);
                wsService.subscribe(payload.roomId);
            }
        };

        const handleUserLeft = (payload: {
            roomId: string;
            userId: string;
            userName?: string;
            participantCount?: number;
        }) => {
            log.debug('User left room event', { roomId: payload.roomId, userId: payload.userId });

            // Update participant count
            if (payload.participantCount !== undefined) {
                store.updateRoom(payload.roomId, { participantCount: payload.participantCount });
            }

            // If current user left
            const currentUserId = userIdRef.current;
            if (payload.userId === currentUserId) {
                store.removeJoinedRoom(payload.roomId);
                wsService.unsubscribe(payload.roomId);
            }
        };

        const handleUserKicked = async (payload: {
            roomId: string;
            kickedUserId: string;
            kickedBy: string;
            userName?: string;
            participantCount?: number;
        }) => {
            const eventKey = `${payload.roomId}-${payload.kickedUserId}`;
            if (processedKickEvents.has(eventKey)) return;
            processedKickEvents.add(eventKey);
            setTimeout(() => processedKickEvents.delete(eventKey), EVENT_DEDUP_TTL);

            const currentUserId = userIdRef.current;
            if (payload.kickedUserId === currentUserId) {
                log.warn('Current user was kicked');
                store.removeJoinedRoom(payload.roomId);
                wsService.unsubscribe(payload.roomId);
            } else if (payload.participantCount !== undefined) {
                // Update participant count directly from real-time payload
                store.updateRoom(payload.roomId, { participantCount: payload.participantCount });
            }
        };

        const handleUserBanned = async (payload: {
            roomId: string;
            bannedUserId: string;
            bannedBy: string;
            participantCount?: number;
        }) => {
            const eventKey = `${payload.roomId}-${payload.bannedUserId}`;
            if (processedBanEvents.has(eventKey)) return;
            processedBanEvents.add(eventKey);
            setTimeout(() => processedBanEvents.delete(eventKey), EVENT_DEDUP_TTL);

            const currentUserId = userIdRef.current;
            if (payload.bannedUserId === currentUserId) {
                log.warn('Current user was banned');
                store.removeJoinedRoom(payload.roomId);
                store.hideRoom(payload.roomId); // Banned users shouldn't see the room
                wsService.unsubscribe(payload.roomId);
            } else if (payload.participantCount !== undefined) {
                // Update participant count directly from real-time payload
                store.updateRoom(payload.roomId, { participantCount: payload.participantCount });
            }
        };

        const handleUserUnbanned = async (payload: {
            roomId: string;
            unbannedUserId: string;
        }) => {
            const currentUserId = userIdRef.current;
            if (payload.unbannedUserId === currentUserId) {
                log.info('Current user was unbanned');
                store.showRoom(payload.roomId);
                try {
                    const room = await roomService.getRoom(payload.roomId);
                    store.setRoom(room);
                } catch (err) { }
            }
        };

        // =========================================================================
        // Discovery/Map Sync
        // =========================================================================
        // The discovery views now depend reactively on the store's rooms, hiddenRoomIds, 
        // and pendingRoomIds. These are updated by the handlers above.

        const subscribers = [
            eventBus.on('room.created', handleRoomCreated),
            eventBus.on('room.updated', handleRoomUpdated),
            eventBus.on('room.closed', handleRoomClosed),
            eventBus.on('room.expiring', handleRoomExpiring),
            eventBus.on('room.participantCountUpdated', handleParticipantCount),
            eventBus.on('room.userJoined', handleUserJoined),
            eventBus.on('room.userLeft', handleUserLeft),
            eventBus.on('room.userKicked', handleUserKicked),
            eventBus.on('room.userBanned', handleUserBanned),
            eventBus.on('room.userUnbanned', handleUserUnbanned),
        ];

        return () => {
            log.debug('Cleaning up unified room event subscriptions');
            subscribers.forEach(unsub => unsub());
        };
    }, []); // Only subscribe once
}

export default useRoomEvents;
