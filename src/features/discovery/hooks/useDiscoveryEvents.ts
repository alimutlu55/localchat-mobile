/**
 * useDiscoveryEvents Hook
 *
 * Subscribes to room lifecycle events and triggers map data refresh for real-time discovery updates.
 *
 * ## Architecture
 *
 * This hook uses a declarative event handling pattern:
 *
 * 1. **Actions**: Reusable functions that modify map state (addRoom, removeRoom, refetchRooms)
 * 2. **Event Handlers**: Pure functions that decide which actions to take based on event payload
 * 3. **Event Registry**: Simple array of {event, handler} pairs for easy extension
 *
 * ## Adding New Events
 *
 * To add a new event handler:
 *
 * 1. Add the event type to the `DiscoveryEventHandlers` object
 * 2. Implement the handler using the available actions (add, remove, exclude, include, refetch)
 *
 * @example
 * ```typescript
 * // In EVENT_HANDLERS object:
 * 'room.expired': (payload, actions, ctx) => {
 *   actions.exclude(payload.roomId);
 *   actions.remove(payload.roomId);
 *   actions.refetch();
 * },
 * ```
 *
 * @example
 * ```typescript
 * useDiscoveryEvents({
 *   features: serverFeatures,
 *   setFeatures: setServerFeatures,
 *   refetch: refetchClusters,
 *   currentUserId: userId,
 * });
 * ```
 */

import { useEffect, useRef } from 'react';
import { eventBus, EventName, AllEvents } from '../../../core/events';
import { ClusterFeature } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('DiscoveryEvents');

// =============================================================================
// Configuration
// =============================================================================

const EXCLUSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PENDING_TTL_MS = 30 * 1000; // 30 seconds
const REFETCH_DELAY_MS = 500; // Delay before background refetch

// =============================================================================
// Module-level State
// Persists across hook re-renders and refetches
// =============================================================================

const excludedRoomIds = new Set<string>();
const pendingRoomFeatures = new Map<string, ClusterFeature>();

// =============================================================================
// State Management Functions (exported for use by useServerClustering)
// =============================================================================

/**
 * Merge pending rooms (optimistically added) into features array
 */
export function mergePendingRooms(features: ClusterFeature[]): ClusterFeature[] {
    if (pendingRoomFeatures.size === 0) return features;

    const result = [...features];
    const existingRoomIds = new Set(
        features
            .filter((f) => !f.properties.cluster && f.properties.roomId)
            .map((f) => f.properties.roomId)
    );

    pendingRoomFeatures.forEach((feature, roomId) => {
        if (existingRoomIds.has(roomId)) {
            pendingRoomFeatures.delete(roomId);
            log.debug('Room appeared on server, removed from pending', { roomId });
        } else {
            result.push(feature);
        }
    });

    return result;
}

/**
 * Filter out excluded rooms (banned/closed) from features array
 */
export function filterExcludedRooms(features: ClusterFeature[]): ClusterFeature[] {
    if (excludedRoomIds.size === 0) return features;

    const filtered = features.filter((f) => {
        const roomId = f.properties.roomId;
        if (!roomId) return true; // Keep clusters
        return !excludedRoomIds.has(roomId);
    });

    if (filtered.length !== features.length) {
        log.debug('Filtered excluded rooms', {
            before: features.length,
            after: filtered.length,
        });
    }

    return filtered;
}

// =============================================================================
// Types
// =============================================================================

export interface UseDiscoveryEventsOptions {
    features: ClusterFeature[];
    setFeatures: React.Dispatch<React.SetStateAction<ClusterFeature[]>>;
    refetch: () => Promise<void>;
    currentUserId?: string;
}

/**
 * Context passed to event handlers
 */
interface EventContext {
    currentUserId?: string;
    features: ClusterFeature[];
}

/**
 * Actions available to event handlers
 */
interface EventActions {
    /** Add a room to the map (optimistic) */
    addRoom: (feature: ClusterFeature) => void;

    /** Remove a room from the map (optimistic) */
    removeRoom: (roomId: string) => void;

    /** Add room to exclusion list (persists across refetches) */
    excludeRoom: (roomId: string) => void;

    /** Remove room from exclusion list */
    includeRoom: (roomId: string) => void;

    /** Trigger a background refetch */
    refetch: (immediate?: boolean) => void;
}

/**
 * Event handler signature
 */
type DiscoveryEventHandler<T> = (
    payload: T,
    actions: EventActions,
    ctx: EventContext
) => void;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert room data from WebSocket event to a ClusterFeature
 */
function roomToFeature(room: any, currentUserId?: string): ClusterFeature {
    const isCreator = room.creatorId === currentUserId;
    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [
                room.location?.longitude ?? room.longitude,
                room.location?.latitude ?? room.latitude,
            ],
        },
        properties: {
            cluster: false,
            roomId: room.id,
            title: room.title,
            category: room.category?.toLowerCase() || 'general',
            categoryIcon: '💬',
            participantCount: room.participantCount || 1,
            status: 'active',
            expiresAt: room.expiresAt,
            isCreator,
            hasJoined: isCreator,
        },
    };
}

/**
 * Add room to pending list with TTL
 */
function addToPending(feature: ClusterFeature): void {
    const roomId = feature.properties.roomId;
    if (!roomId) return;

    pendingRoomFeatures.set(roomId, feature);
    log.debug('Added to pending', { roomId });

    setTimeout(() => {
        if (pendingRoomFeatures.has(roomId)) {
            pendingRoomFeatures.delete(roomId);
            log.debug('Removed from pending after TTL', { roomId });
        }
    }, PENDING_TTL_MS);
}

/**
 * Add room to exclusion list with TTL
 */
function addToExcluded(roomId: string): void {
    excludedRoomIds.add(roomId);
    log.debug('Added to exclusion list', { roomId });

    setTimeout(() => {
        excludedRoomIds.delete(roomId);
        log.debug('Removed from exclusion list after TTL', { roomId });
    }, EXCLUSION_TTL_MS);
}

// =============================================================================
// Event Handlers
// Define all event handlers here. Each handler receives:
// - payload: The event data from EventBus
// - actions: Functions to modify map state
// - ctx: Current context (userId, features)
// =============================================================================

const EVENT_HANDLERS = {
    /**
     * Room Created - Add new room to map
     */
    'room.created': ((payload, actions, ctx) => {
        const roomData = payload.room;
        log.info('Room created', { roomId: roomData.id });

        // Skip rooms created by other users (unless global)
        const isGlobalRoom = roomData.radiusMeters === 0;
        const isCreator = roomData.creatorId === ctx.currentUserId;

        if (!isGlobalRoom && !isCreator) {
            log.debug('Skipping - not creator of nearby room');
            return;
        }

        // Optimistic add
        const feature = roomToFeature(roomData, ctx.currentUserId);
        addToPending(feature);
        actions.addRoom(feature);

        // Background refetch for consistency
        actions.refetch(false);
    }) as DiscoveryEventHandler<AllEvents['room.created']>,

    /**
     * Room Closed - Remove room from map
     */
    'room.closed': ((payload, actions) => {
        log.info('Room closed', { roomId: payload.roomId });

        // Exclude and remove
        actions.excludeRoom(payload.roomId);
        actions.removeRoom(payload.roomId);

        // Background refetch
        actions.refetch(false);
    }) as DiscoveryEventHandler<AllEvents['room.closed']>,

    /**
     * User Banned - Remove room if current user was banned
     */
    'room.userBanned': ((payload, actions, ctx) => {
        log.info('User banned', { roomId: payload.roomId, bannedUserId: payload.bannedUserId });

        // Only react if current user was banned
        if (payload.bannedUserId !== ctx.currentUserId) {
            log.debug('Not current user, ignoring');
            return;
        }

        log.warn('Current user banned, removing room');

        // Exclude and remove
        actions.excludeRoom(payload.roomId);
        actions.removeRoom(payload.roomId);

        // Background refetch
        actions.refetch(false);
    }) as DiscoveryEventHandler<AllEvents['room.userBanned']>,

    /**
     * User Unbanned - Restore room if current user was unbanned
     */
    'room.userUnbanned': ((payload, actions, ctx) => {
        log.info('User unbanned', { roomId: payload.roomId, unbannedUserId: payload.unbannedUserId });

        // Only react if current user was unbanned
        if (payload.unbannedUserId !== ctx.currentUserId) {
            log.debug('Not current user, ignoring');
            return;
        }

        log.info('Current user unbanned, restoring room');

        // Remove from exclusion and refetch immediately
        actions.includeRoom(payload.roomId);
        actions.refetch(true); // Immediate refetch
    }) as DiscoveryEventHandler<AllEvents['room.userUnbanned']>,

    // =========================================================================
    // ADD NEW EVENT HANDLERS HERE
    // =========================================================================
    //
    // Example: Handle room expired
    // 'room.expired': ((payload, actions) => {
    //     log.info('Room expired', { roomId: payload.roomId });
    //     actions.excludeRoom(payload.roomId);
    //     actions.removeRoom(payload.roomId);
    //     actions.refetch(false);
    // }) as DiscoveryEventHandler<AllEvents['room.expired']>,
    //
} as const;

// Type for the event handler keys
type SupportedEventName = keyof typeof EVENT_HANDLERS;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDiscoveryEvents(options: UseDiscoveryEventsOptions): void {
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Wrap setFeatures to always apply filters
    useEffect(() => {
        const originalSetFeatures = optionsRef.current.setFeatures;
        optionsRef.current.setFeatures = (updater) => {
            originalSetFeatures((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                return filterExcludedRooms(mergePendingRooms(next));
            });
        };
    }, []);

    useEffect(() => {
        log.debug('Subscribing to discovery events');

        // Create actions object that handlers can use
        const createActions = (): EventActions => ({
            addRoom: (feature: ClusterFeature) => {
                optionsRef.current.setFeatures((prev) => {
                    if (prev.some((f) => f.properties.roomId === feature.properties.roomId)) {
                        return prev;
                    }
                    return [...prev, feature];
                });
            },

            removeRoom: (roomId: string) => {
                optionsRef.current.setFeatures((prev) =>
                    prev.filter((f) => f.properties.roomId !== roomId)
                );
            },

            excludeRoom: (roomId: string) => {
                addToExcluded(roomId);
            },

            includeRoom: (roomId: string) => {
                excludedRoomIds.delete(roomId);
                log.debug('Removed from exclusion list', { roomId });
            },

            refetch: (immediate = false) => {
                if (immediate) {
                    optionsRef.current.refetch().catch((err) => {
                        log.error('Refetch failed', err);
                    });
                } else {
                    setTimeout(() => {
                        optionsRef.current.refetch().catch((err) => {
                            log.error('Refetch failed', err);
                        });
                    }, REFETCH_DELAY_MS);
                }
            },
        });

        // Subscribe to all registered events
        const unsubscribers: Array<() => void> = [];

        (Object.entries(EVENT_HANDLERS) as Array<[SupportedEventName, DiscoveryEventHandler<any>]>).forEach(
            ([eventName, handler]) => {
                const unsubscribe = eventBus.on(eventName as EventName, (payload) => {
                    const ctx: EventContext = {
                        currentUserId: optionsRef.current.currentUserId,
                        features: optionsRef.current.features,
                    };
                    const actions = createActions();

                    try {
                        handler(payload, actions, ctx);
                    } catch (err) {
                        log.error(`Handler for ${eventName} failed`, err);
                    }
                });

                unsubscribers.push(unsubscribe);
            }
        );

        return () => {
            log.debug('Unsubscribing from discovery events');
            unsubscribers.forEach((unsub) => unsub());
        };
    }, []);
}

export default useDiscoveryEvents;
