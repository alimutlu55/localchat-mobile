/**
 * useDiscoveryEvents Hook
 *
 * Subscribes to room lifecycle events (created, closed, userBanned, userUnbanned) and
 * triggers map data refresh for real-time discovery updates.
 *
 * Strategy:
 * - Optimistic updates: Immediately update the features array for instant UI feedback
 * - Exclusion tracking: Maintain a list of rooms to hide (banned/closed) that persists across refetches
 * - Background refetch: Fetch fresh data from server, then apply exclusion filter
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

import { useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../../../core/events';
import { ClusterFeature } from '../../../types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('DiscoveryEvents');

// =============================================================================
// Module-level state for excluded rooms
// Persists across hook re-renders and refetches
// =============================================================================

const excludedRoomIds = new Set<string>();
const pendingRoomFeatures = new Map<string, ClusterFeature>();

// Clear room state after TTL (they'll be properly indexed server-side by then)
const EXCLUSION_TTL_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 30 * 1000; // 30s is enough for background indexing

function addExcludedRoom(roomId: string): void {
    excludedRoomIds.add(roomId);
    log.info('Added room to exclusion list', { roomId, totalExcluded: excludedRoomIds.size });

    // Auto-remove after TTL
    setTimeout(() => {
        excludedRoomIds.delete(roomId);
        log.debug('Removed room from exclusion list after TTL', { roomId });
    }, EXCLUSION_TTL_MS);
}

function addPendingRoom(feature: ClusterFeature): void {
    const roomId = feature.properties.roomId;
    if (!roomId) return;

    pendingRoomFeatures.set(roomId, feature);
    log.info('Added room to pending list', { roomId, totalPending: pendingRoomFeatures.size });

    // Auto-remove after TTL
    setTimeout(() => {
        if (pendingRoomFeatures.has(roomId)) {
            pendingRoomFeatures.delete(roomId);
            log.debug('Removed room from pending list after TTL', { roomId });
        }
    }, PENDING_TTL_MS);
}

/**
 * Merge pending rooms into features array
 * Exported for use by useServerClustering
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
            // Room has appeared on server, remove from pending
            pendingRoomFeatures.delete(roomId);
            log.debug('Room appeared on server, removed from pending', { roomId });
        } else {
            // Room is still missing from server results, merge it in
            result.push(feature);
        }
    });

    return result;
}

/**
 * Filter out excluded rooms from features array
 * Exported for use by useServerClustering
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
            excluded: excludedRoomIds.size,
        });
    }

    return filtered;
}

// =============================================================================
// Types
// =============================================================================

export interface UseDiscoveryEventsOptions {
    /** Current features displayed on the map */
    features: ClusterFeature[];

    /** Setter to update features optimistically */
    setFeatures: React.Dispatch<React.SetStateAction<ClusterFeature[]>>;

    /** Function to trigger a background refetch */
    refetch: () => Promise<void>;

    /** Current user ID for filtering ban events */
    currentUserId?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert room data from WebSocket event to a ClusterFeature for map display
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
            hasJoined: isCreator, // Assume joined if creator for optimistic UI
        },
    };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDiscoveryEvents(options: UseDiscoveryEventsOptions): void {
    const { setFeatures, refetch, currentUserId } = options;

    // Use refs to access latest values without re-subscribing
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Wrapped setFeatures that always applies exclusion filter
    const setFeaturesFiltered = useCallback(
        (updater: React.SetStateAction<ClusterFeature[]>) => {
            setFeatures((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                return filterExcludedRooms(next);
            });
        },
        [setFeatures]
    );

    // Override setFeatures in options to always filter
    useEffect(() => {
        // Wrap the original setFeatures to filter excluded rooms
        const originalSetFeatures = optionsRef.current.setFeatures;
        optionsRef.current.setFeatures = (updater: React.SetStateAction<ClusterFeature[]>) => {
            originalSetFeatures((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                const merged = mergePendingRooms(next);
                return filterExcludedRooms(merged);
            });
        };
    }, []);

    useEffect(() => {
        log.debug('Subscribing to discovery events');

        // =========================================================================
        // Event: Room Created
        // =========================================================================
        const handleRoomCreated = (payload: { roomId: string; room: any }) => {
            const roomData = payload.room;
            log.info('Room created event received', { roomId: roomData.id });

            // Skip non-global rooms created by other users (they won't be in viewport anyway)
            const isGlobalRoom = roomData.radiusMeters === 0;
            const isCreator = roomData.creatorId === optionsRef.current.currentUserId;

            if (!isGlobalRoom && !isCreator) {
                log.debug('Skipping nearby room created by another user');
                return;
            }

            // Optimistic update: Add to features immediately
            const newFeature = roomToFeature(roomData, optionsRef.current.currentUserId);

            // Add to pending list to survive background refetches
            addPendingRoom(newFeature);

            optionsRef.current.setFeatures((prev) => {
                // Avoid duplicates
                if (prev.some((f) => f.properties.roomId === roomData.id)) {
                    return prev;
                }
                return [...prev, newFeature];
            });

            // Background refetch for data consistency
            setTimeout(() => {
                optionsRef.current.refetch().catch((err) => {
                    log.error('Refetch after room.created failed', err);
                });
            }, 500);
        };

        // =========================================================================
        // Event: Room Closed
        // =========================================================================
        const handleRoomClosed = (payload: { roomId: string; closedBy: string }) => {
            log.info('Room closed event received', { roomId: payload.roomId });

            // Add to exclusion list BEFORE updating features
            addExcludedRoom(payload.roomId);

            // Optimistic update: Remove from features immediately
            optionsRef.current.setFeatures((prev) =>
                prev.filter((f) => f.properties.roomId !== payload.roomId)
            );

            // Background refetch - exclusion filter will keep it hidden
            setTimeout(() => {
                optionsRef.current.refetch().catch((err) => {
                    log.error('Refetch after room.closed failed', err);
                });
            }, 500);
        };

        // =========================================================================
        // Event: User Banned
        // =========================================================================
        const handleUserBanned = (payload: {
            roomId: string;
            bannedUserId: string;
            bannedBy: string;
            reason?: string;
        }) => {
            log.info('User banned event received', {
                roomId: payload.roomId,
                bannedUserId: payload.bannedUserId,
            });

            // Only react if the current user was banned
            if (payload.bannedUserId !== optionsRef.current.currentUserId) {
                log.debug('Banned user is not current user, ignoring');
                return;
            }

            log.warn('Current user was banned, removing room from discovery');

            // Add to exclusion list BEFORE updating features
            // This ensures refetch won't bring it back
            addExcludedRoom(payload.roomId);

            // Optimistic update: Remove room from features
            optionsRef.current.setFeatures((prev) =>
                prev.filter((f) => f.properties.roomId !== payload.roomId)
            );

            // Background refetch - exclusion filter will keep it hidden
            setTimeout(() => {
                optionsRef.current.refetch().catch((err) => {
                    log.error('Refetch after room.userBanned failed', err);
                });
            }, 500);
        };

        // =========================================================================
        // Event: User Unbanned
        // =========================================================================
        const handleUserUnbanned = (payload: {
            roomId: string;
            unbannedUserId: string;
            unbannedBy: string;
        }) => {
            console.log('[DiscoveryEvents] User unbanned event received', {
                roomId: payload.roomId,
                unbannedUserId: payload.unbannedUserId,
                currentUserId: optionsRef.current.currentUserId,
                isCurrentUser: payload.unbannedUserId === optionsRef.current.currentUserId,
            });

            log.info('User unbanned event received', {
                roomId: payload.roomId,
                unbannedUserId: payload.unbannedUserId,
            });

            // Only react if the current user was unbanned
            if (payload.unbannedUserId !== optionsRef.current.currentUserId) {
                log.debug('Unbanned user is not current user, ignoring');
                return;
            }

            log.info('Current user was unbanned, restoring room to discovery');
            console.log('[DiscoveryEvents] Current user was unbanned, restoring room. Exclusion list before:', Array.from(excludedRoomIds));

            // Remove from exclusion list FIRST so it can appear again
            excludedRoomIds.delete(payload.roomId);
            console.log('[DiscoveryEvents] Exclusion list after delete:', Array.from(excludedRoomIds));

            // Immediately refetch to get the room back on the map
            // Use the same timing pattern as room.created for instant visibility
            console.log('[DiscoveryEvents] Triggering refetch...');
            optionsRef.current.refetch().then(() => {
                console.log('[DiscoveryEvents] Refetch completed successfully');
            }).catch((err) => {
                console.error('[DiscoveryEvents] Refetch failed', err);
                log.error('Refetch after room.userUnbanned failed', err);
            });
        };

        // =========================================================================
        // Subscribe to EventBus
        // =========================================================================
        const unsubCreated = eventBus.on('room.created', handleRoomCreated);
        const unsubClosed = eventBus.on('room.closed', handleRoomClosed);
        const unsubBanned = eventBus.on('room.userBanned', handleUserBanned);
        const unsubUnbanned = eventBus.on('room.userUnbanned', handleUserUnbanned);

        return () => {
            log.debug('Unsubscribing from discovery events');
            unsubCreated();
            unsubClosed();
            unsubBanned();
            unsubUnbanned();
        };
    }, []); // Empty deps - handlers access values via ref
}

export default useDiscoveryEvents;
