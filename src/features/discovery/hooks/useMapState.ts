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

import { useState, useCallback, useRef } from 'react';
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
    defaultCenter = { latitude: 41.0082, longitude: 28.9784 }, // Istanbul
    defaultZoom = 13,
    minZoom = 1,
    maxZoom = 18,
  } = options;

  // Refs
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  // State
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [zoom, setZoom] = useState(defaultZoom);
  const [bounds, setBounds] = useState<[number, number, number, number]>([-180, -85, 180, 85]);
  const [centerCoord, setCenterCoord] = useState<[number, number]>([
    defaultCenter.longitude,
    defaultCenter.latitude,
  ]);

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

      if (visibleBounds && visibleBounds.length === 2) {
        const [ne, sw] = visibleBounds;
        setBounds([sw[0], sw[1], ne[0], ne[1]]);
      }

      if (center) {
        setCenterCoord(center as [number, number]);
      }

      setZoom(Math.round(newZoom));
      setIsMapMoving(false);

      log.debug('Region changed', { zoom: Math.round(newZoom) });
    } catch (error) {
      log.error('Error getting map state', error);
      setIsMapMoving(false);
    }
  }, []);

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
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 200,
      animationMode: 'easeTo',
    });
  }, [zoom, isMapReady, maxZoom]);

  const zoomOut = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    const newZoom = Math.max(zoom - 1, minZoom);
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
