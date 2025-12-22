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
        .filter(room => room.latitude !== undefined && room.longitude !== undefined)
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
 * Radius 60 is a good default for mobile screens as well.
 */
export function createClusterIndex(rooms: Room[]): Supercluster<EventFeature['properties'], ClusterFeature['properties']> {
    const index = new Supercluster<EventFeature['properties'], ClusterFeature['properties']>({
        radius: 60, // Larger radius = more aggressive clustering
        maxZoom: 20,
        minZoom: 0,
        minPoints: 2,
        extent: 256,
        nodeSize: 64,
    });

    const features = roomsToGeoJSON(rooms);
    index.load(features);

    return index;
}

// Get clusters for current viewport
export function getClustersForBounds(
    index: Supercluster<EventFeature['properties'], ClusterFeature['properties']>,
    bounds: [number, number, number, number], // [westLng, southLat, eastLng, northLat]
    zoom: number
): MapFeature[] {
    try {
        return index.getClusters(bounds, Math.floor(zoom)) as MapFeature[];
    } catch (e) {
        console.warn('Supercluster error:', e);
        return [];
    }
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
