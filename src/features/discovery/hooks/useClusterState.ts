/**
 * useClusterState Hook
 *
 * Manages cluster state hydration and transformation.
 * Connects server response to local RoomStore state.
 *
 * Responsibilities:
 * - Hydrate server features with local state (hasJoined, isCreator)
 * - Merge pending (optimistic) rooms into features
 * - Filter hidden/banned rooms
 * - Reconcile pending rooms with server responses
 *
 * This is a reactive hook - it recomputes when store state changes.
 */

import { useState, useMemo, useCallback } from 'react';
import { ClusterFeature, ClusterMetadata } from '../../../types';
import { useRoomStore } from '../../rooms/store';
import { isPointInBounds } from '../../../utils/geo';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ClusterState');

// =============================================================================
// Types
// =============================================================================

export interface UseClusterStateReturn {
    /** Raw features from server (unhydrated) */
    rawFeatures: ClusterFeature[];

    /** Hydrated features with local state merged in */
    features: ClusterFeature[];

    /** Metadata from last response */
    metadata: ClusterMetadata | null;

    /** Update raw features (from API response) */
    setRawFeatures: React.Dispatch<React.SetStateAction<ClusterFeature[]>>;

    /** Update metadata */
    setMetadata: React.Dispatch<React.SetStateAction<ClusterMetadata | null>>;

    /** Reconcile pending rooms with server response */
    reconcilePendingRooms: (features: ClusterFeature[]) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filter out rooms that should be hidden (e.g. banned or manually hidden).
 */
function filterExcludedRooms(
    features: ClusterFeature[],
    hiddenRoomIds: Set<string>
): ClusterFeature[] {
    if (hiddenRoomIds.size === 0) return features;

    return features.filter(f => {
        if (f.properties.cluster) return true;
        return !hiddenRoomIds.has(f.properties.roomId!);
    });
}

/**
 * Merge in pending (optimistic) rooms that aren't in the server response yet.
 */
function mergePendingRooms(
    features: ClusterFeature[],
    pendingRoomIds: Set<string>,
    rooms: Map<string, any>
): ClusterFeature[] {
    if (pendingRoomIds.size === 0) return features;

    const existingRoomIds = new Set(
        features.filter(f => !f.properties.cluster).map(f => f.properties.roomId)
    );

    const clusters = features.filter(f => f.properties.cluster);
    const pendingFeatures: ClusterFeature[] = [];

    pendingRoomIds.forEach(roomId => {
        // Skip if already exists as individual room
        if (existingRoomIds.has(roomId)) return;

        const room = rooms.get(roomId);
        if (!room) return;

        // Skip if inside a cluster's expansion bounds
        const isInsideAnyCluster = clusters.some(c => {
            const bounds = c.properties.expansionBounds;
            if (!bounds) return false;
            return isPointInBounds(room.latitude!, room.longitude!, bounds);
        });

        if (isInsideAnyCluster) {
            log.debug('Pending room hidden by cluster', { roomId });
            return;
        }

        pendingFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [room.longitude ?? 0, room.latitude ?? 0],
            },
            properties: {
                cluster: false,
                roomId: room.id,
                title: room.title,
                category: room.category,
                participantCount: room.participantCount,
                status: room.status,
                isCreator: room.isCreator,
                hasJoined: room.hasJoined,
                expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
            },
        });
    });

    return [...features, ...pendingFeatures];
}

// =============================================================================
// Hook
// =============================================================================

export function useClusterState(): UseClusterStateReturn {
    // Raw features from server
    const [rawFeatures, setRawFeatures] = useState<ClusterFeature[]>([]);
    const [metadata, setMetadata] = useState<ClusterMetadata | null>(null);

    // Subscribe to store state for reactivity
    const joinedRoomIds = useRoomStore((state) => state.joinedRoomIds);
    const createdRoomIds = useRoomStore((state) => state.createdRoomIds);
    const hiddenRoomIds = useRoomStore((state) => state.hiddenRoomIds);
    const pendingRoomIds = useRoomStore((state) => state.pendingRoomIds);
    const storeRooms = useRoomStore((state) => state.rooms);

    /**
     * Compute display features by hydrating raw server data with local state.
     * This is reactive - recomputes when store state changes.
     */
    const features = useMemo(() => {
        // 1. Hydrate raw features with latest local state
        const hydrated = rawFeatures.map(f => {
            if (f.properties.cluster || !f.properties.roomId) return f;

            const roomId = f.properties.roomId;
            const storeRoom = storeRooms.get(roomId);

            return {
                ...f,
                properties: {
                    ...f.properties,
                    hasJoined: joinedRoomIds.has(roomId),
                    isCreator: createdRoomIds.has(roomId) || storeRoom?.isCreator || false,
                    participantCount: storeRoom?.participantCount ?? f.properties.participantCount ?? 0,
                    status: storeRoom?.status ?? f.properties.status,
                }
            };
        });

        // 2. Merge pending (optimistic) rooms
        const merged = mergePendingRooms(hydrated, pendingRoomIds, storeRooms);

        // 3. Filter hidden rooms
        return filterExcludedRooms(merged, hiddenRoomIds);
    }, [rawFeatures, joinedRoomIds, createdRoomIds, hiddenRoomIds, pendingRoomIds, storeRooms]);

    /**
     * Reconcile pending rooms with server response.
     * Removes rooms from pending set if server confirms them.
     */
    const reconcilePendingRooms = useCallback((serverFeatures: ClusterFeature[]) => {
        const state = useRoomStore.getState();
        if (state.pendingRoomIds.size === 0) return;

        const individualRoomIds = new Set(
            serverFeatures.filter(f => !f.properties.cluster).map(f => f.properties.roomId)
        );
        const clusters = serverFeatures.filter(f => f.properties.cluster);

        state.pendingRoomIds.forEach(roomId => {
            const room = state.rooms.get(roomId);
            if (!room) return;

            // Remove if confirmed as individual room
            if (individualRoomIds.has(roomId)) {
                log.debug('Pending room confirmed as individual', { roomId });
                state.removePendingRoom(roomId);
                return;
            }

            // Remove if inside a cluster
            const isInsideCluster = clusters.some(c => {
                const b = c.properties.expansionBounds;
                return b && isPointInBounds(room.latitude!, room.longitude!, b);
            });

            if (isInsideCluster) {
                log.debug('Pending room confirmed as clustered', { roomId });
                state.removePendingRoom(roomId);
            }
        });
    }, []);

    return {
        rawFeatures,
        features,
        metadata,
        setRawFeatures,
        setMetadata,
        reconcilePendingRooms,
    };
}

export default useClusterState;
