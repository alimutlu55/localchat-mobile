/**
 * useMapState Hook
 *
 * Manages map camera state, bounds, and zoom level.
 * Extracted from DiscoveryScreen for single responsibility.
 *
 * @example
 * ```typescript
 * const {
 *   mapRef,
 *   cameraRef,
 *   zoom,
 *   bounds,
 *   centerCoord,
 *   isMapReady,
 *   handleRegionChange,
 *   zoomIn,
 *   zoomOut,
 *   flyTo,
 * } = useMapState({ defaultCenter, defaultZoom });
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('MapState');

// =============================================================================
// Types
// =============================================================================

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface UseMapStateOptions {
  defaultCenter?: MapCoordinate;
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface UseMapStateReturn {
  /** Ref for MapView component */
  mapRef: React.RefObject<MapViewRef | null>;
  /** Ref for Camera component */
  cameraRef: React.RefObject<CameraRef | null>;
  /** Current zoom level */
  zoom: number;
  /** Current visible bounds [west, south, east, north] */
  bounds: [number, number, number, number];
  /** Current center coordinate [lng, lat] */
  centerCoord: [number, number];
  /** Whether map has finished loading */
  isMapReady: boolean;
  /** Whether bounds have been initialized from actual map viewport */
  hasBoundsInitialized: boolean;
  /** Whether map is currently moving */
  isMapMoving: boolean;
  /** Call when map finishes loading */
  handleMapReady: () => void;
  /** Call when region will change (pan/zoom start) */
  handleRegionWillChange: () => void;
  /** Call when region finishes changing */
  handleRegionDidChange: () => Promise<void>;
  /** Zoom in by one level */
  zoomIn: () => void;
  /** Zoom out by one level */
  zoomOut: () => void;
  /** Fly to a specific location */
  flyTo: (coordinate: MapCoordinate, targetZoom?: number) => void;
  /** Center on a specific location with optional zoom */
  centerOn: (coordinate: MapCoordinate, targetZoom?: number) => void;
  /** Reset to world view */
  resetToWorldView: () => void;
  /** Calculate fly animation duration based on zoom difference */
  calculateFlyDuration: (targetZoom: number) => number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapState(options: UseMapStateOptions = {}): UseMapStateReturn {
  const {
    defaultCenter,
    defaultZoom = 13,
    minZoom = 1,
    maxZoom = 12,
  } = options;

  // Refs
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  // State
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasBoundsInitialized, setHasBoundsInitialized] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [zoom, setZoom] = useState(defaultZoom);
  const hasPerformedInitialJump = useRef(false);

  // Helper to calculate bounds from a coordinate
  const calculateInitialBounds = (coord: MapCoordinate): [number, number, number, number] => {
    // Calculate ~50km viewport around center for zoom 13
    const latOffset = 0.03; // ~3km
    const lngOffset = 0.04; // ~4km
    return [
      coord.longitude - lngOffset,
      coord.latitude - latOffset,
      coord.longitude + lngOffset,
      coord.latitude + latOffset,
    ];
  };

  // Start with world view or provided default
  const [bounds, setBounds] = useState<[number, number, number, number]>(() => {
    if (defaultCenter) {
      return calculateInitialBounds(defaultCenter);
    }
    return [-180, -85, 180, 85];
  });

  const [centerCoord, setCenterCoord] = useState<[number, number]>(() => {
    if (defaultCenter) {
      return [defaultCenter.longitude, defaultCenter.latitude];
    }
    return [0, 0];
  });

  // Update state when defaultCenter changes (initialization only)
  // This allows the map to jump to the user's location as soon as it's fetched
  useEffect(() => {
    if (defaultCenter && !hasBoundsInitialized && !isMapMoving && !hasPerformedInitialJump.current) {
      log.debug('Updating map state from new defaultCenter (initialization)', defaultCenter);
      setCenterCoord([defaultCenter.longitude, defaultCenter.latitude]);
      setBounds(calculateInitialBounds(defaultCenter));

      // If camera is already available, sync it immediately
      if (cameraRef.current) {
        log.debug('Performing initial camera jump to user location');
        hasPerformedInitialJump.current = true;
        cameraRef.current.setCamera({
          centerCoordinate: [defaultCenter.longitude, defaultCenter.latitude],
          zoomLevel: defaultZoom,
          animationDuration: 0,
        });
      }
    }
  }, [defaultCenter, hasBoundsInitialized, isMapMoving, defaultZoom]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleMapReady = useCallback(() => {
    log.debug('Map ready');
    setIsMapReady(true);
  }, []);

  const handleRegionWillChange = useCallback(() => {
    setIsMapMoving(true);
  }, []);

  const handleRegionDidChange = useCallback(async () => {
    if (!mapRef.current) return;

    try {
      const [newZoom, visibleBounds, center] = await Promise.all([
        mapRef.current.getZoom(),
        mapRef.current.getVisibleBounds(),
        mapRef.current.getCenter(),
      ]);

      if (visibleBounds && visibleBounds.length === 2 && center) {
        // MapLibre inconsistency: getCenter returns [lng, lat] but getVisibleBounds 
        // sometimes returns [lat, lng] on certain platforms/versions.
        // We detect this by checking which component matches the center.
        const [[v1_0, v1_1], [v2_0, v2_1]] = visibleBounds;
        const [cLng, cLat] = center as [number, number];

        // Normalization: Determine which index is Lng vs Lat
        // We know centerLng is between minLng and maxLng
        const isFirstArgLat = Math.abs(v1_0 - cLat) < Math.abs(v1_0 - cLng);

        let minLng, maxLng, minLat, maxLat;
        if (isFirstArgLat) {
          // visibleBounds is [[lat, lng], [lat, lng]]
          minLng = Math.min(v1_1, v2_1);
          maxLng = Math.max(v1_1, v2_1);
          minLat = Math.min(v1_0, v2_0);
          maxLat = Math.max(v1_0, v2_0);
        } else {
          // visibleBounds is [[lng, lat], [lng, lat]]
          minLng = Math.min(v1_0, v2_0);
          maxLng = Math.max(v1_0, v2_0);
          minLat = Math.min(v1_1, v2_1);
          maxLat = Math.max(v1_1, v2_1);
        }

        setBounds([minLng, minLat, maxLng, maxLat]);

        if (center) {
          setCenterCoord(center as [number, number]);
        }

        setZoom(Math.round(newZoom));
        setIsMapMoving(false);

        // Mark bounds as initialized after first real update from map
        if (!hasBoundsInitialized) {
          setHasBoundsInitialized(true);
          log.debug('Bounds initialized from map', { bounds: [minLng, minLat, maxLng, maxLat], isFirstArgLat });
        }
      } else if (center) {
        setCenterCoord(center as [number, number]);
        setZoom(Math.round(newZoom));
        setIsMapMoving(false);
      }

      log.debug('Region changed', { zoom: Math.round(newZoom) });
    } catch (error) {
      log.error('Error getting map state', error);
      setIsMapMoving(false);
    }
  }, [hasBoundsInitialized]);

  // ==========================================================================
  // Animation Helpers
  // ==========================================================================

  const calculateFlyDuration = useCallback(
    (targetZoom: number): number => {
      const zoomDiff = Math.abs(targetZoom - zoom);
      const duration = 0.8 + zoomDiff * 0.2;
      return Math.min(duration, 2.5) * 1000;
    },
    [zoom]
  );

  // ==========================================================================
  // Camera Controls
  // ==========================================================================

  const zoomIn = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    const newZoom = Math.min(zoom + 1, maxZoom);
    setZoom(newZoom);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 200,
      animationMode: 'easeTo',
    });
  }, [zoom, isMapReady, maxZoom]);

  const zoomOut = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    const newZoom = Math.max(zoom - 1, minZoom);
    setZoom(newZoom);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 200,
      animationMode: 'easeTo',
    });
  }, [zoom, isMapReady, minZoom]);

  const flyTo = useCallback(
    (coordinate: MapCoordinate, targetZoom?: number) => {
      if (!isMapReady || !cameraRef.current) return;

      const finalZoom = targetZoom ?? zoom;
      const duration = calculateFlyDuration(finalZoom);

      setZoom(finalZoom);
      cameraRef.current.setCamera({
        centerCoordinate: [coordinate.longitude, coordinate.latitude],
        zoomLevel: finalZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });
    },
    [isMapReady, zoom, calculateFlyDuration]
  );

  const centerOn = useCallback(
    (coordinate: MapCoordinate, targetZoom?: number) => {
      if (!isMapReady || !cameraRef.current) return;

      const finalZoom = targetZoom ?? 14;
      const duration = calculateFlyDuration(finalZoom);

      setZoom(finalZoom);
      cameraRef.current.setCamera({
        centerCoordinate: [coordinate.longitude, coordinate.latitude],
        zoomLevel: finalZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });
    },
    [isMapReady, calculateFlyDuration]
  );

  const resetToWorldView = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    const targetZoom = 1;
    const duration = calculateFlyDuration(targetZoom);

    setZoom(targetZoom);
    cameraRef.current.setCamera({
      centerCoordinate: [0, 20],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }, [isMapReady, calculateFlyDuration]);

  return {
    mapRef,
    cameraRef,
    zoom,
    bounds,
    centerCoord,
    isMapReady,
    hasBoundsInitialized,
    isMapMoving,
    handleMapReady,
    handleRegionWillChange,
    handleRegionDidChange,
    zoomIn,
    zoomOut,
    flyTo,
    centerOn,
    resetToWorldView,
    calculateFlyDuration,
  };
}

export default useMapState;
