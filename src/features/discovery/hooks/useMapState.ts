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
  /** Call when region finishes changing (debounced internally) */
  handleRegionDidChange: () => void;
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
  /** Animate camera to a new state with full tracking */
  animateCamera: (config: {
    centerCoordinate?: [number, number];
    zoomLevel?: number;
    animationDuration?: number;
    animationMode?: 'flyTo' | 'easeTo' | 'moveTo';
  }) => void;
  /** Calculate fly animation duration based on zoom difference */
  calculateFlyDuration: (targetZoom: number) => number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapState(options: UseMapStateOptions = {}): UseMapStateReturn {
  const {
    defaultCenter,
    defaultZoom = defaultCenter ? 13 : 1, // Default to world view (1) if no center, else street view (13)
    minZoom = 1,
    maxZoom = 12,
  } = options;

  // Refs
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  // Track if hook is mounted to prevent native calls during unmount
  const isMountedRef = useRef(true);
  // Track the target zoom during animations to prevent unexpected behavior
  // when user interacts during an ongoing animation
  const targetZoomRef = useRef<number | null>(null);
  // Track if a programmatic animation is in progress
  const isAnimatingRef = useRef(false);
  // Synchronous zoom tracking - always reflects intended zoom level
  const zoomRef = useRef(defaultZoom);
  // Cooldown to prevent rapid successive zoom calls that cause UI freeze
  const isZoomCooldownRef = useRef(false);
  // Debounce timer for handleRegionDidChange to prevent excessive native calls
  const regionChangeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasBoundsInitialized, setHasBoundsInitialized] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [zoom, setZoom] = useState(defaultZoom);
  const hasPerformedInitialJump = useRef(false);

  // Cleanup: mark as unmounted to prevent native calls during unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear any pending timers
      if (regionChangeTimerRef.current) {
        clearTimeout(regionChangeTimerRef.current);
      }
    };
  }, []);

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
    // World view bounds
    return [-180, -85, 180, 85];
  });

  const [centerCoord, setCenterCoord] = useState<[number, number]>(() => {
    if (defaultCenter) {
      return [defaultCenter.longitude, defaultCenter.latitude];
    }
    // World view center (slightly north to show more land mass)
    return [0, 20];
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

  const handleRegionDidChange = useCallback(() => {
    // Clear any pending timer to debounce rapid calls
    if (regionChangeTimerRef.current) {
      clearTimeout(regionChangeTimerRef.current);
    }

    // Debounce: wait 100ms before processing to avoid excessive native calls during animation
    regionChangeTimerRef.current = setTimeout(async () => {
      // Safety check: ensure ref exists AND hook is still mounted
      // This prevents "Invalid react tag" crash when map is unmounting
      if (!mapRef.current || !isMountedRef.current) return;

      try {
        const perfStart = Date.now();
        const [newZoom, visibleBounds, center] = await Promise.all([
          mapRef.current.getZoom(),
          mapRef.current.getVisibleBounds(),
          mapRef.current.getCenter(),
        ]);
        const nativeCallTime = Date.now() - perfStart;

        if (visibleBounds && visibleBounds.length === 2 && center) {
          // MapLibre inconsistency: getCenter returns [lng, lat] but getVisibleBounds 
          // sometimes returns [lat, lng] on certain platforms/versions.
          // We detect this by checking which component matches the center.
          const [[v1_0, v1_1], [v2_0, v2_1]] = visibleBounds;
          const [cLng, cLat] = center as [number, number];

          // DEFENSIVE: Deep validation of center coordinates.
          // Native bridge can sometimes return malformed arrays or NaN during rapid movements.
          const isValidCenter = center &&
            Array.isArray(center) &&
            center.length === 2 &&
            typeof cLng === 'number' && !isNaN(cLng) && isFinite(cLng) &&
            typeof cLat === 'number' && !isNaN(cLat) && isFinite(cLat);

          if (!isValidCenter) {
            log.warn('Ignored invalid map center from native bridge', { center });
            setIsMapMoving(false);
            return;
          }

          // Normalization: Determine which index is Lng vs Lat
          // The native bridge can sometimes return [[lat, lng], [lat, lng]] or [[lng, lat], [lng, lat]].
          // We use the center coordinate (which is reliably [lng, lat]) to determine the order.

          // Interpretation 1: Index 0 is Longitude, Index 1 is Latitude (Standard)
          const interpret1ContainsLat = Math.min(v1_1, v2_1) <= cLat && cLat <= Math.max(v1_1, v2_1);
          const interpret1ContainsLng = Math.min(v1_0, v2_0) <= cLng && cLng <= Math.max(v1_0, v2_0);

          // Interpretation 2: Index 0 is Latitude, Index 1 is Longitude (Swapped)
          const interpret2ContainsLat = Math.min(v1_0, v2_0) <= cLat && cLat <= Math.max(v1_0, v2_0);
          const interpret2ContainsLng = Math.min(v1_1, v2_1) <= cLng && cLng <= Math.max(v1_1, v2_1);

          // If standard is correct, or if both are somehow ambiguous, prefer standard
          let minLng, maxLng, minLat, maxLat;
          const isSwapped = interpret2ContainsLat && interpret2ContainsLng && !interpret1ContainsLat;

          if (isSwapped) {
            // Swapped order detected: v1_0 is Lat, v1_1 is Lng
            log.debug('Coordinate swap detected from native bridge, normalizing');
            minLng = Math.min(v1_1, v2_1);
            maxLng = Math.max(v1_1, v2_1);
            minLat = Math.min(v1_0, v2_0);
            maxLat = Math.max(v1_0, v2_0);
          } else {
            // Assume standard order: v1_0 is Lng, v1_1 is Lat
            minLng = Math.min(v1_0, v2_0);
            maxLng = Math.max(v1_0, v2_0);
            minLat = Math.min(v1_1, v2_1);
            maxLat = Math.max(v1_1, v2_1);
          }

          setBounds([minLng, minLat, maxLng, maxLat]);
          setCenterCoord([cLng, cLat]);

          // State synchronization logic
          const actualZoom = newZoom ?? zoomRef.current;
          const currentTargetZoom = targetZoomRef.current;

          // CRITICAL: Rounding protection and hysteresis.
          // MapLibre generates frequent native region change events with sub-pixel differences.
          // We only update React state if the zoom change is significant (> 0.1) or if we are not animating.
          // This prevents "jitter" and heavy bridge congestion during/after animations.
          const diff = Math.abs(actualZoom - zoomRef.current);
          const isSignificantChange = diff > 0.1;

          if (isSignificantChange && !isAnimatingRef.current) {
            const roundedZoom = Math.round(actualZoom);
            setZoom(roundedZoom);
            zoomRef.current = roundedZoom;
            if (nativeCallTime > 100) {
              log.warn('High map bridge latency detected', { nativeCallTime });
            }
            log.debug('Zoom state updated (significant change)', {
              delta: diff.toFixed(3),
              newZoom: roundedZoom,
              nativeCallMs: nativeCallTime
            });
          } else if (currentTargetZoom !== null) {
            // If we are animating, ensure UI reflects the target zoom
            setZoom(Math.round(currentTargetZoom));
            zoomRef.current = Math.round(currentTargetZoom);
            log.debug('Zoom state synced to target during animation', { target: currentTargetZoom });
          } else if (!isSignificantChange && !isAnimatingRef.current) {
            log.debug('Zoom update rejected (jitter)', {
              delta: diff.toFixed(4),
              nativeCallMs: nativeCallTime
            });
          }

          setIsMapMoving(false);

          // Mark bounds as initialized after first real update from map
          if (!hasBoundsInitialized) {
            setHasBoundsInitialized(true);
            log.debug('Bounds initialized from map', { bounds: [minLng, minLat, maxLng, maxLat].map(b => b.toFixed(4)), isSwapped });
          }

          log.debug('Region changed', {
            isAnimating: isAnimatingRef.current,
            zoom: actualZoom.toFixed(2),
            nativeCallMs: nativeCallTime
          });
        }
      } catch (error) {
        log.error('Error getting map state', error);
        setIsMapMoving(false);
      }
    }, 100); // 100ms debounce
  }, [hasBoundsInitialized]);

  // ==========================================================================
  // Animation Helpers
  // ==========================================================================

  const calculateFlyDuration = useCallback(
    (targetZoom: number): number => {
      const zoomDiff = Math.abs(targetZoom - zoomRef.current);
      // Faster, snappier animation for zoom transitions
      const duration = 0.8 + zoomDiff * 0.15;
      return Math.min(duration, 3.0) * 1000; // 3 second max for faster world view transition
    },
    [] // No dependencies - uses ref
  );

  // ==========================================================================
  // Camera Controls
  // ==========================================================================

  const zoomIn = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    // Cooldown guard: prevent rapid successive calls that cause UI freeze
    if (isZoomCooldownRef.current) {
      log.debug('ZoomIn blocked by cooldown');
      return;
    }

    // Use synchronous ref-based zoom tracking instead of async native calls
    // This prevents blocking the UI thread during rapid clicks
    const baseZoom = targetZoomRef.current ?? zoomRef.current;
    const newZoom = Math.min(Math.round(baseZoom) + 1, maxZoom);

    if (newZoom === Math.round(baseZoom)) {
      log.debug('ZoomIn at max zoom, ignoring');
      return;
    }

    log.debug('ZoomIn', { baseZoom: Math.round(baseZoom), newZoom });

    // Update refs synchronously for immediate feedback
    targetZoomRef.current = newZoom;
    zoomRef.current = newZoom;
    isZoomCooldownRef.current = true;

    // Cancel any in-progress animation tracking
    isAnimatingRef.current = false;

    // Update state for UI
    setZoom(newZoom);

    // Animate camera
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 200,
      animationMode: 'easeTo',
    });

    // PROTECTION: Enforce 500ms cooldown between zoom actions to prevent
    // UI thread congestion and native MapLibre crashes from rapid successive calls.
    setTimeout(() => {
      isZoomCooldownRef.current = false;
      targetZoomRef.current = null;
    }, 500);
  }, [isMapReady, maxZoom]);

  const zoomOut = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    // Cooldown guard: prevent rapid successive calls that cause UI freeze
    if (isZoomCooldownRef.current) {
      log.debug('ZoomOut blocked by cooldown');
      return;
    }

    // Use synchronous ref-based zoom tracking instead of async native calls
    const baseZoom = targetZoomRef.current ?? zoomRef.current;
    const newZoom = Math.max(Math.round(baseZoom) - 1, minZoom);

    if (newZoom === Math.round(baseZoom)) {
      log.debug('ZoomOut at min zoom, ignoring');
      return;
    }

    log.debug('ZoomOut', { baseZoom: Math.round(baseZoom), newZoom });

    // Update refs synchronously for immediate feedback
    targetZoomRef.current = newZoom;
    zoomRef.current = newZoom;
    isZoomCooldownRef.current = true;

    // Cancel any in-progress animation tracking
    isAnimatingRef.current = false;

    // Update state for UI
    setZoom(newZoom);

    // Animate camera
    cameraRef.current.setCamera({
      zoomLevel: newZoom,
      animationDuration: 150,
      animationMode: 'easeTo',
    });

    // PROTECTION: Enforce 500ms cooldown between zoom actions to prevent
    // UI thread congestion and native MapLibre crashes from rapid successive calls.
    setTimeout(() => {
      isZoomCooldownRef.current = false;
      targetZoomRef.current = null;
    }, 500);
  }, [isMapReady, minZoom]);

  const flyTo = useCallback(
    (coordinate: MapCoordinate, targetZoom?: number) => {
      if (!isMapReady || !cameraRef.current) return;

      const finalZoom = targetZoom ?? zoom;
      const duration = calculateFlyDuration(finalZoom);

      // Track animation state so user interactions can interrupt appropriately
      isAnimatingRef.current = true;
      targetZoomRef.current = finalZoom;

      setZoom(finalZoom);
      cameraRef.current.setCamera({
        centerCoordinate: [coordinate.longitude, coordinate.latitude],
        zoomLevel: finalZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });

      // Clear animation tracking after animation completes
      setTimeout(() => {
        isAnimatingRef.current = false;
        targetZoomRef.current = null;
      }, duration);
    },
    [isMapReady, zoom, calculateFlyDuration]
  );

  const centerOn = useCallback(
    (coordinate: MapCoordinate, targetZoom?: number) => {
      if (!isMapReady || !cameraRef.current) return;

      const finalZoom = targetZoom ?? 14;
      const duration = calculateFlyDuration(finalZoom);

      // Track animation state so user interactions can interrupt appropriately
      isAnimatingRef.current = true;
      targetZoomRef.current = finalZoom;

      setZoom(finalZoom);
      cameraRef.current.setCamera({
        centerCoordinate: [coordinate.longitude, coordinate.latitude],
        zoomLevel: finalZoom,
        animationDuration: duration,
        animationMode: 'flyTo',
      });

      // Clear animation tracking after animation completes
      setTimeout(() => {
        isAnimatingRef.current = false;
        targetZoomRef.current = null;
      }, duration);
    },
    [isMapReady, calculateFlyDuration]
  );

  const resetToWorldView = useCallback(() => {
    if (!isMapReady || !cameraRef.current) return;

    const targetZoom = 1;
    const duration = calculateFlyDuration(targetZoom);

    // Track animation state so user interactions can interrupt appropriately
    isAnimatingRef.current = true;
    targetZoomRef.current = targetZoom;

    setZoom(targetZoom);
    cameraRef.current.setCamera({
      centerCoordinate: [0, 20],
      zoomLevel: targetZoom,
      animationDuration: duration,
      animationMode: 'flyTo',
    });

    // Clear animation tracking after animation completes
    setTimeout(() => {
      isAnimatingRef.current = false;
      targetZoomRef.current = null;
    }, duration + 100);
  }, [isMapReady, calculateFlyDuration]);

  const animateCamera = useCallback(
    (config: {
      centerCoordinate?: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
      animationMode?: 'flyTo' | 'easeTo' | 'moveTo';
    }) => {
      if (!isMapReady || !cameraRef.current) return;

      const { centerCoordinate, zoomLevel, animationDuration = 0, animationMode = 'easeTo' } = config;

      log.debug('animateCamera', { centerCoordinate, zoomLevel, animationDuration, animationMode });

      if (zoomLevel !== undefined) {
        targetZoomRef.current = zoomLevel;
        zoomRef.current = zoomLevel;
        setZoom(zoomLevel);
      }

      // CRITICAL: Update centerCoord state immediately so if map unmounts during animation,
      // it will remount at the TARGET position, not the interrupted mid-animation position
      if (centerCoordinate) {
        setCenterCoord(centerCoordinate);
      }

      if (animationDuration > 0) {
        isAnimatingRef.current = true;
      }

      cameraRef.current.setCamera({
        centerCoordinate,
        zoomLevel,
        animationDuration,
        animationMode,
      });

      if (animationDuration > 0) {
        setTimeout(() => {
          isAnimatingRef.current = false;
          targetZoomRef.current = null;
        }, animationDuration + 150); // Small buffer for native completion
      }
    },
    [isMapReady]
  );

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
    animateCamera,
    calculateFlyDuration,
  };
}

export default useMapState;
