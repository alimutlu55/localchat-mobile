/**
 * useMapControls Hook
 *
 * Manages map viewport state and control actions.
 * Extracts map interaction logic from MapScreen.
 *
 * Responsibilities:
 * - Track zoom level and bounds
 * - Handle zoom in/out
 * - Handle center on user
 * - Handle reset to world view
 * - Calculate fly animation durations
 *
 * Usage:
 * ```typescript
 * const {
 *   currentZoom,
 *   bounds,
 *   centerCoord,
 *   handleZoomIn,
 *   handleZoomOut,
 *   centerOnUser,
 *   resetToWorldView,
 *   updateViewport,
 * } = useMapControls({ cameraRef, mapRef, userLocation });
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { MAP_CONFIG } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('MapControls');

// =============================================================================
// Types
// =============================================================================

export interface MapViewportState {
  zoom: number;
  bounds: [number, number, number, number];
  center: [number, number];
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface UseMapControlsOptions {
  /** Reference to MapLibre camera */
  cameraRef: React.RefObject<any>;
  /** Reference to MapLibre map view */
  mapRef: React.RefObject<any>;
  /** User's current location */
  userLocation: UserLocation | null;
  /** Initial zoom level */
  initialZoom?: number;
  /** Initial center coordinates [lng, lat] */
  initialCenter?: [number, number];
}

export interface UseMapControlsReturn {
  /** Current zoom level */
  currentZoom: number;
  /** Current map bounds [west, south, east, north] */
  bounds: [number, number, number, number];
  /** Current center coordinate [lng, lat] */
  centerCoord: [number, number];
  /** Whether map is ready */
  mapReady: boolean;
  /** Set map ready state */
  setMapReady: (ready: boolean) => void;
  /** Zoom in one level */
  handleZoomIn: () => void;
  /** Zoom out one level */
  handleZoomOut: () => void;
  /** Center map on user location */
  centerOnUser: () => void;
  /** Reset to world view */
  resetToWorldView: () => void;
  /** Update viewport from map state */
  updateViewport: (zoom: number, bounds: [number, number, number, number], center: [number, number]) => void;
  /** Calculate fly animation duration based on zoom difference */
  calculateFlyDuration: (targetZoom: number) => number;
  /** Fly to a specific location */
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  /** Fit bounds with padding */
  fitBounds: (
    ne: [number, number],
    sw: [number, number],
    padding?: number,
    duration?: number
  ) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapControls(options: UseMapControlsOptions): UseMapControlsReturn {
  const {
    cameraRef,
    mapRef,
    userLocation,
    initialZoom = MAP_CONFIG.DEFAULT_ZOOM,
    initialCenter = [MAP_CONFIG.DEFAULT_CENTER.longitude, MAP_CONFIG.DEFAULT_CENTER.latitude],
  } = options;

  // State
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [bounds, setBounds] = useState<[number, number, number, number]>([-180, -85, 180, 85]);
  const [centerCoord, setCenterCoord] = useState<[number, number]>(initialCenter);
  const [mapReady, setMapReady] = useState(false);

  /**
   * Calculate adaptive fly animation duration based on zoom difference
   */
  const calculateFlyDuration = useCallback(
    (targetZoom: number): number => {
      const zoomDiff = Math.abs(targetZoom - currentZoom);
      // Smoother base (0.8s) and more gradual per-level (0.2s)
      const duration = 0.8 + zoomDiff * 0.2;
      // Capped at 2.5s for long distances
      return Math.min(duration, 2.5) * 1000;
    },
    [currentZoom]
  );

  /**
   * Update viewport state from map
   */
  const updateViewport = useCallback(
    (zoom: number, newBounds: [number, number, number, number], center: [number, number]) => {
      setCurrentZoom(Math.round(zoom));
      setBounds(newBounds);
      setCenterCoord(center);
    },
    []
  );

  /**
   * Zoom in one level
   */
  const handleZoomIn = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;

    const newZoom = Math.min(currentZoom + 1, 18);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [currentZoom, mapReady, cameraRef]);

  /**
   * Zoom out one level
   */
  const handleZoomOut = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;

    const newZoom = Math.max(currentZoom - 1, 1);
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [currentZoom, mapReady, cameraRef]);

  /**
   * Center map on user location
   */
  const centerOnUser = useCallback(() => {
    if (!mapReady || !userLocation || !cameraRef.current) return;

    const targetZoom = 14;
    const duration = calculateFlyDuration(targetZoom);

    cameraRef.current.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }, [userLocation, mapReady, cameraRef, calculateFlyDuration]);

  /**
   * Reset to world view
   */
  const resetToWorldView = useCallback(() => {
    if (!mapReady || !cameraRef.current) return;

    const targetZoom = 1;
    const duration = calculateFlyDuration(targetZoom);

    cameraRef.current.setCamera({
      centerCoordinate: [0, 20],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }, [mapReady, cameraRef, calculateFlyDuration]);

  /**
   * Fly to a specific location
   */
  const flyTo = useCallback(
    (lng: number, lat: number, zoom?: number) => {
      if (!mapReady || !cameraRef.current) return;

      const targetZoom = zoom ?? Math.min(Math.max(currentZoom + 2, 14), 16);
      const duration = calculateFlyDuration(targetZoom);

      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: targetZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });
    },
    [mapReady, cameraRef, currentZoom, calculateFlyDuration]
  );

  /**
   * Fit bounds with padding
   */
  const fitBounds = useCallback(
    (
      ne: [number, number],
      sw: [number, number],
      padding = 80,
      duration = 1200
    ) => {
      if (!mapReady || !cameraRef.current) return;

      cameraRef.current.fitBounds(ne, sw, padding, duration);
    },
    [mapReady, cameraRef]
  );

  return {
    currentZoom,
    bounds,
    centerCoord,
    mapReady,
    setMapReady,
    handleZoomIn,
    handleZoomOut,
    centerOnUser,
    resetToWorldView,
    updateViewport,
    calculateFlyDuration,
    flyTo,
    fitBounds,
  };
}

export default useMapControls;
