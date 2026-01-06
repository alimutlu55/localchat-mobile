/**
 * Cluster Facade
 *
 * Abstracts cluster transformation logic for the Discovery module.
 * This facade provides utilities for transforming server GeoJSON features
 * to Room objects and filtering/merging features.
 *
 * Design Principles:
 * - Wraps existing helper functions (NO MODIFICATIONS to original code)
 * - Provides type-safe transformations
 * - Enables unit testing with mocks
 * - All existing functionality remains unchanged
 */

import { Room, ClusterFeature } from '../../../types';
import { useRoomStore } from '../../rooms/store';
import { isPointInBounds } from '../../../utils/geo';
import type { IClusterFacade } from '../types/discovery.contracts';
import { getCategoryEmoji } from '../../../constants';

// =============================================================================
// Constants
// =============================================================================



// =============================================================================
// Singleton Facade Implementation
// =============================================================================

/**
 * ClusterFacade - Singleton implementation
 *
 * Provides utilities for transforming and filtering cluster features.
 *
 * Usage:
 * ```typescript
 * const facade = ClusterFacade.getInstance();
 * const room = facade.toRoom(feature);
 * const filtered = facade.filterExcluded(features, hiddenIds);
 * ```
 */
class ClusterFacadeImpl implements IClusterFacade {
    private static instance: ClusterFacadeImpl;

    private constructor() {
        // Private constructor for singleton
    }

    public static getInstance(): ClusterFacadeImpl {
        if (!ClusterFacadeImpl.instance) {
            ClusterFacadeImpl.instance = new ClusterFacadeImpl();
        }
        return ClusterFacadeImpl.instance;
    }

    // ===========================================================================
    // Transformations
    // ===========================================================================

    /**
     * Convert a GeoJSON ClusterFeature to a Room object
     *
     * Used by both Map and List views to create Room objects from server features.
     */
    toRoom(feature: ClusterFeature): Room {
        if (feature.properties.cluster) {
            throw new Error('Cannot convert cluster feature to Room - use individual room features only');
        }

        const [lng, lat] = feature.geometry.coordinates;

        return {
            id: feature.properties.roomId!,
            title: feature.properties.title || '',
            category: feature.properties.category as Room['category'],
            emoji: feature.properties.categoryIcon || getCategoryEmoji(feature.properties.category),
            participantCount: feature.properties.participantCount || 0,
            status: feature.properties.status as Room['status'],
            latitude: lat,
            longitude: lng,
            expiresAt: feature.properties.expiresAt ? new Date(feature.properties.expiresAt) : new Date(),
            createdAt: new Date(),
            maxParticipants: 500,
            distance: 0,
            timeRemaining: '',
            isCreator: feature.properties.isCreator,
            hasJoined: feature.properties.hasJoined,
            isNew: feature.properties.isNew,
            isHighActivity: feature.properties.isHighActivity,
            isExpiringSoon: feature.properties.isExpiringSoon,
        };
    }

    /**
     * Convert multiple features to rooms (filters out clusters)
     */
    toRooms(features: ClusterFeature[]): Room[] {
        return features
            .filter(f => !f.properties.cluster && f.properties.roomId)
            .map(f => this.toRoom(f));
    }

    // ===========================================================================
    // Filtering
    // ===========================================================================

    /**
     * Filter out rooms that should be hidden (e.g., banned)
     *
     * This is a pure function version of the existing filterExcludedRooms helper.
     * Clusters are always kept; only individual rooms are filtered.
     */
    filterExcluded(features: ClusterFeature[], hiddenIds: Set<string>): ClusterFeature[] {
        if (hiddenIds.size === 0) return features;

        return features.filter(f => {
            if (f.properties.cluster) return true;
            return !hiddenIds.has(f.properties.roomId!);
        });
    }

    /**
     * Filter out hidden rooms using current store state
     *
     * Convenience method that reads hiddenRoomIds from RoomStore.
     */
    filterExcludedFromStore(features: ClusterFeature[]): ClusterFeature[] {
        const hiddenRoomIds = useRoomStore.getState().hiddenRoomIds;
        return this.filterExcluded(features, hiddenRoomIds);
    }

    // ===========================================================================
    // Merging
    // ===========================================================================

    /**
     * Merge in pending (optimistic) rooms that aren't in the server response yet
     *
     * This is a pure function version of the existing mergePendingRooms helper.
     * Rooms are only added if:
     * 1. Not already present as individual room
     * 2. Not inside a cluster's expansion bounds
     */
    mergePending(
        features: ClusterFeature[],
        pendingRoomIds: Set<string>,
        rooms?: Map<string, Room>
    ): ClusterFeature[] {
        // If no rooms map provided, get from store
        const roomsMap = rooms ?? useRoomStore.getState().rooms;

        if (pendingRoomIds.size === 0) return features;

        const existingRoomIds = new Set(
            features.filter(f => !f.properties.cluster).map(f => f.properties.roomId)
        );

        const clusters = features.filter(f => f.properties.cluster);

        const pendingFeatures: ClusterFeature[] = [];

        pendingRoomIds.forEach(roomId => {
            // 1. Skip if already exists as an individual room (server source of truth)
            if (existingRoomIds.has(roomId)) return;

            const room = roomsMap.get(roomId);
            if (!room) return;

            // 2. Skip if inside a cluster's expansion bounds
            const isInsideAnyCluster = clusters.some(c => {
                const bounds = c.properties.expansionBounds;
                if (!bounds) return false;
                return isPointInBounds(room.latitude!, room.longitude!, bounds);
            });

            if (isInsideAnyCluster) {
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
                    expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : String(room.expiresAt),
                },
            });
        });

        return [...features, ...pendingFeatures];
    }

    /**
     * Merge pending rooms using current store state
     *
     * Convenience method that reads pendingRoomIds and rooms from RoomStore.
     */
    mergePendingFromStore(features: ClusterFeature[]): ClusterFeature[] {
        const state = useRoomStore.getState();
        return this.mergePending(features, state.pendingRoomIds, state.rooms);
    }

    // ===========================================================================
    // Utilities
    // ===========================================================================

    /**
     * Check if a feature is a cluster
     */
    isCluster(feature: ClusterFeature): boolean {
        return feature.properties.cluster === true;
    }

    /**
     * Check if a feature is an individual room
     */
    isRoom(feature: ClusterFeature): boolean {
        return !feature.properties.cluster && !!feature.properties.roomId;
    }

    /**
     * Get category emoji
     */
    getCategoryEmoji(category?: string): string {
        return getCategoryEmoji(category);
    }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const ClusterFacade = ClusterFacadeImpl.getInstance();

export default ClusterFacade;
