/**
 * useMapClustering Hook
 *
 * Manages room clustering for map display using Supercluster.
 * Extracted from DiscoveryScreen for single responsibility.
 *
 * @example
 * ```typescript
 * const { features, getClusterLeaves, handleClusterPress } = useMapClustering({
 *   rooms,
 *   bounds,
 *   zoom,
 *   onRoomSelect,
 * });
 * ```
 */

import { useMemo, useCallback } from 'react';
import { Room } from '../../../types';
import {
  createClusterIndex,
  getClustersForBounds,
  isCluster,
  getClusterExpansionZoom,
  getClusterLeaves,
  MapFeature,
  ClusterFeature,
  EventFeature,
} from '../../../utils/mapClustering';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('MapClustering');

// =============================================================================
// Types
// =============================================================================

export interface UseMapClusteringOptions {
  /** Rooms to cluster */
  rooms: Room[];
  /** Current visible bounds [west, south, east, north] */
  bounds: [number, number, number, number];
  /** Current zoom level */
  zoom: number;
  /** Whether map is ready */
  isMapReady: boolean;
}

export interface UseMapClusteringReturn {
  /** Clustered features (rooms + clusters) */
  features: MapFeature[];
  /** Total events in current view */
  totalEventsInView: number;
  /** Check if a feature is a cluster */
  isCluster: (feature: MapFeature) => feature is ClusterFeature;
  /** Get all rooms in a cluster */
  getClusterLeaves: (clusterId: number) => EventFeature[];
  /** Get the zoom level needed to expand a cluster */
  getClusterExpansionZoom: (clusterId: number) => number;
  /** GeoJSON for room radius circles */
  circlesGeoJSON: GeoJSON.FeatureCollection;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapClustering({
  rooms,
  bounds,
  zoom,
  isMapReady,
}: UseMapClusteringOptions): UseMapClusteringReturn {
  // Create cluster index when rooms change
  const clusterIndex = useMemo(() => {
    log.debug('Creating cluster index', { roomCount: rooms.length });
    return createClusterIndex(rooms);
  }, [rooms]);

  // Get features for current viewport
  const features = useMemo(() => {
    if (!isMapReady) return [];
    const newFeatures = getClustersForBounds(clusterIndex, bounds, zoom);
    log.debug('Features calculated', { count: newFeatures.length, zoom });
    return newFeatures;
  }, [clusterIndex, bounds, zoom, isMapReady]);

  // Calculate total events in view
  const totalEventsInView = useMemo(() => {
    return features.reduce((sum, feature) => {
      if (isCluster(feature)) {
        return sum + (feature.properties.point_count || 0);
      }
      return sum + 1;
    }, 0);
  }, [features]);

  // Create GeoJSON for room radius circles
  const circlesGeoJSON = useMemo(() => {
    if (!isMapReady || zoom < 10) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    const circleFeatures = features
      .filter((f): f is EventFeature => !isCluster(f))
      .filter((f) => f.properties.room.latitude != null && f.properties.room.longitude != null)
      .map((f) => {
        const room = f.properties.room;
        const [lng, lat] = f.geometry.coordinates;
        const radiusMeters = room.radius || 500;
        const metersPerPixel =
          (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const circleRadiusPixels = Math.max(radiusMeters / metersPerPixel, 20);

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat],
          },
          properties: {
            id: room.id,
            radius: circleRadiusPixels,
            isExpiringSoon: room.isExpiringSoon || false,
          },
        };
      });

    return {
      type: 'FeatureCollection' as const,
      features: circleFeatures,
    };
  }, [features, zoom, isMapReady]);

  // Wrapper for getClusterLeaves
  const getClusterLeavesWrapper = useCallback(
    (clusterId: number): EventFeature[] => {
      return getClusterLeaves(clusterIndex, clusterId, Infinity);
    },
    [clusterIndex]
  );

  // Wrapper for getClusterExpansionZoom
  const getClusterExpansionZoomWrapper = useCallback(
    (clusterId: number): number => {
      return getClusterExpansionZoom(clusterIndex, clusterId);
    },
    [clusterIndex]
  );

  return {
    features,
    totalEventsInView,
    isCluster,
    getClusterLeaves: getClusterLeavesWrapper,
    getClusterExpansionZoom: getClusterExpansionZoomWrapper,
    circlesGeoJSON,
  };
}

export default useMapClustering;
