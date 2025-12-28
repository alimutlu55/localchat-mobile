import Supercluster from 'supercluster';
import { Room } from '../types';

// GeoJSON Feature for events
export interface EventFeature {
    type: 'Feature';
    properties: {
        cluster: false;
        eventId: string;
        room: Room;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
    };
}

// Cluster feature returned by Supercluster
export interface ClusterFeature {
    type: 'Feature';
    properties: {
        cluster: true;
        cluster_id: number;
        point_count: number;
        point_count_abbreviated: string;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

export type MapFeature = EventFeature | ClusterFeature;

// Convert rooms to GeoJSON features
export function roomsToGeoJSON(rooms: Room[]): EventFeature[] {
    return rooms
        .filter(room => 
            room.latitude != null && 
            room.longitude != null && 
            isFinite(room.latitude) && 
            isFinite(room.longitude) &&
            room.id != null
        )
        .map(room => ({
            type: 'Feature' as const,
            properties: {
                cluster: false as const,
                eventId: room.id,
                room,
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [room.longitude!, room.latitude!],
            },
        }));
}

/**
 * Create and configure Supercluster instance
 * Optimized for better expansion behavior on mobile
 */
export function createClusterIndex(rooms: Room[]): Supercluster<EventFeature['properties'], ClusterFeature['properties']> {
    const index = new Supercluster<EventFeature['properties'], ClusterFeature['properties']>({
        radius: 50, // Reduced from 60 for less aggressive clustering
        maxZoom: 16, // Stop clustering at zoom 16 (was 20) - rooms visible at 17+
        minZoom: 0,
        minPoints: 2, // Minimum 2 rooms to form a cluster
        extent: 256,
        nodeSize: 64,
    });

    const features = roomsToGeoJSON(rooms);
    index.load(features);

    return index;
}

/**
 * Expanded bounds calculation for stable clustering.
 * Returns bounds expanded by a factor to prevent edge flickering.
 */
export function getExpandedBounds(
    bounds: [number, number, number, number],
    expansionFactor: number = 0.5
): [number, number, number, number] {
    const [west, south, east, north] = bounds;
    const lngDelta = (east - west) * expansionFactor;
    const latDelta = (north - south) * expansionFactor;
    
    return [
        Math.max(-180, west - lngDelta),
        Math.max(-85, south - latDelta),
        Math.min(180, east + lngDelta),
        Math.min(85, north + latDelta),
    ];
}

/**
 * Get clusters for current viewport with stability optimizations.
 * - Uses expanded bounds to prevent edge flickering
 * - Rounds zoom to prevent micro-changes from causing re-clustering
 */
export function getClustersForBounds(
    index: Supercluster<EventFeature['properties'], ClusterFeature['properties']>,
    bounds: [number, number, number, number], // [westLng, southLat, eastLng, northLat]
    zoom: number
): MapFeature[] {
    try {
        // Expand bounds by 50% to prevent edge flickering when panning
        const expandedBounds = getExpandedBounds(bounds, 0.5);
        // Use floor for consistent zoom levels
        const features = index.getClusters(expandedBounds, Math.floor(zoom)) as MapFeature[];
        
        // Filter out any invalid features to prevent native crashes
        return features.filter(feature => {
            if (!feature?.geometry?.coordinates) return false;
            const [lng, lat] = feature.geometry.coordinates;
            if (lng == null || lat == null || !isFinite(lng) || !isFinite(lat)) return false;
            
            if (isCluster(feature)) {
                return feature.properties?.cluster_id != null;
            } else {
                return feature.properties?.room?.id != null;
            }
        });
    } catch (e) {
        console.warn('Supercluster error:', e);
        return [];
    }
}

/**
 * Stable feature key generator for React reconciliation.
 * Creates consistent keys that survive re-clustering.
 */
export function getStableFeatureKey(feature: MapFeature): string {
    if (isCluster(feature)) {
        // For clusters, use zoom-level-independent key based on approximate position
        // This prevents flicker when cluster membership changes slightly
        const [lng, lat] = feature.geometry.coordinates;
        const gridLng = Math.round(lng * 100) / 100;
        const gridLat = Math.round(lat * 100) / 100;
        return `cluster-${gridLng}-${gridLat}-${feature.properties.point_count}`;
    }
    return `room-${feature.properties.eventId}`;
}

// Get expansion zoom level for a cluster
export function getClusterExpansionZoom(
    index: Supercluster<EventFeature['properties'], ClusterFeature['properties']>,
    clusterId: number
): number {
    return index.getClusterExpansionZoom(clusterId);
}

// Get leaves (individual points) of a cluster
export function getClusterLeaves(
    index: Supercluster<EventFeature['properties'], ClusterFeature['properties']>,
    clusterId: number,
    limit: number = 100,
    offset: number = 0
): EventFeature[] {
    return index.getLeaves(clusterId, limit, offset) as EventFeature[];
}

// Helper to check if a feature is a cluster
export function isCluster(feature: MapFeature): feature is ClusterFeature {
    return feature.properties.cluster === true;
}

// Helper to get cluster size category
export function getClusterSizeCategory(pointCount: number): 'small' | 'medium' | 'large' | 'xlarge' {
    if (pointCount < 10) return 'small';
    if (pointCount < 50) return 'medium';
    if (pointCount < 100) return 'large';
    return 'xlarge';
}

// Format cluster count
export function formatClusterCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    return `${Math.floor(count / 1000)}k`;
}

/**
 * Debounced viewport state for stable clustering.
 * Prevents rapid re-clustering during continuous map interactions.
 */
export interface StableViewport {
    bounds: [number, number, number, number];
    zoom: number;
    lastUpdate: number;
}

/**
 * Check if viewport change is significant enough to warrant re-clustering.
 * Minor pan/zoom movements are ignored to prevent flicker.
 */
export function isSignificantViewportChange(
    prev: StableViewport | null,
    next: { bounds: [number, number, number, number]; zoom: number },
    minZoomDelta: number = 0.5,
    minBoundsDelta: number = 0.1
): boolean {
    if (!prev) return true;
    
    // Zoom change threshold
    if (Math.abs(prev.zoom - next.zoom) >= minZoomDelta) return true;
    
    // Bounds change threshold (as percentage of viewport)
    const [prevW, prevS, prevE, prevN] = prev.bounds;
    const [nextW, nextS, nextE, nextN] = next.bounds;
    
    const prevLngSpan = prevE - prevW;
    const prevLatSpan = prevN - prevS;
    
    const lngShift = Math.abs((nextW - prevW) / prevLngSpan);
    const latShift = Math.abs((nextS - prevS) / prevLatSpan);
    
    return lngShift >= minBoundsDelta || latShift >= minBoundsDelta;
}
