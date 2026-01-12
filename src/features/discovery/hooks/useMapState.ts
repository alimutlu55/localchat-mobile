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
import { Dimensions } from 'react-native';
import { MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';
import { MAP_CONFIG } from '../../../constants';
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
  /** Map bounds expanded by 10% (for fetching) */
  bounds: [number, number, number, number];
  /** Current center coordinate [lng, lat] */
  centerCoord: [number, number];
  /** Whether map has finished loading */
  isMapReady: boolean;
  /** Whether bounds have been initialized from actual map viewport */
  hasBoundsInitialized: boolean;
  /** Whether map is currently moving */
  isMapMoving: boolean;
  /** Whether a programmatic animation is in progress */
  isAnimating: boolean;
  /** Call when map finishes loading */
  handleMapReady: () => void;
  /** Call when region will change (pan/zoom start) */
  handleRegionWillChange: (payload: any) => void;
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
  /** Handle direct map interaction (touch/press) as animation interruption */
  handleMapInteraction: () => void;
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
    defaultZoom = defaultCenter ? MAP_CONFIG.ZOOM.INITIAL : MAP_CONFIG.ZOOM.BROWSE_MIN,
    minZoom = MAP_CONFIG.ZOOM.LIMIT_MIN,
    maxZoom = MAP_CONFIG.ZOOM.LIMIT_MAX,
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

  const handleRegionWillChange = useCallback((payload: any) => {
    setIsMapMoving(true);

    // Detect user interaction (panning, pinching, etc.)
    const isUserInteraction = payload?.properties?.isUserInteraction;

    if (isUserInteraction && isAnimatingRef.current) {
      log.info('Map animation interrupted by user gesture', {
        currentZoom: zoomRef.current,
        targetZoom: targetZoomRef.current,
      });
      isAnimatingRef.current = false;
      targetZoomRef.current = null;
    }
  }, []);

  const handleMapInteraction = useCallback(async () => {
    if (isAnimatingRef.current) {
      log.info('Map interaction detected (touch/press), anchoring camera and snapping state');

      const prevTarget = targetZoomRef.current;
      isAnimatingRef.current = false;
      targetZoomRef.current = null;

      // Anchor native camera immediately to stop SDK-side movement
      if (cameraRef.current && mapRef.current) {
        try {
          const [currZoom, currCenter] = await Promise.all([
            mapRef.current.getZoom(),
            mapRef.current.getCenter(),
          ]);

          cameraRef.current.setCamera({
            centerCoordinate: currCenter,
            zoomLevel: currZoom,
            animationDuration: 0
          });

          // Snapshot state to React so UI elements (like buttons) update instantly
          const roundedZoom = Math.round(currZoom);
          setZoom(roundedZoom);
          zoomRef.current = roundedZoom;
          setCenterCoord(currCenter as [number, number]);

          log.debug('Camera anchored specifically', { actualZoom: currZoom, prevTarget });
        } catch (e) {
          log.warn('Failed to anchor camera', e);
        }
      }
    }
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

        // Ensure we have valid data from native bridge
        const isValidVisibleBounds = visibleBounds && Array.isArray(visibleBounds) && visibleBounds.length >= 2;
        const [cLng, cLat] = center as [number, number];
        const isValidCenter = center &&
          Array.isArray(center) &&
          center.length === 2 &&
          typeof cLng === 'number' && !isNaN(cLng) && isFinite(cLng) &&
          typeof cLat === 'number' && !isNaN(cLat) && isFinite(cLat);

        if (isValidVisibleBounds && isValidCenter) {
          // Flatten points to find absolutes, but we still need to know swap status
          // Interpretation 1: Index 0 is Longitude, Index 1 is Latitude (Standard)
          const allV0 = visibleBounds.map(p => p[0]);
          const allV1 = visibleBounds.map(p => p[1]);

          const minV0 = Math.min(...allV0);
          const maxV0 = Math.max(...allV0);
          const minV1 = Math.min(...allV1);
          const maxV1 = Math.max(...allV1);

          // Detection: Check which dimension contains the center latitude
          const interpret1ContainsLat = minV1 <= cLat && cLat <= maxV1;
          const interpret2ContainsLat = minV0 <= cLat && cLat <= maxV0;

          let minLng, maxLng, minLat, maxLat;

          // Determine coordinate order (MapLibre sometimes returns [lat, lng] on iOS)
          if (interpret2ContainsLat && !interpret1ContainsLat) {
            // Swapped order: V0 is Latitude, V1 is Longitude
            minLng = minV1;
            maxLng = maxV1;
            minLat = minV0;
            maxLat = maxV0;
          } else {
            // Standard order: V0 is Longitude, V1 is Latitude
            minLng = minV0;
            maxLng = maxV0;
            minLat = minV1;
            maxLat = maxV1;
          }

          // Buffer expansion: 10% padding per side to ensure markers aren't missed 
          // at the edges of the screen, even during fast panning or on tall displays.
          // This ensures "whole screen size" coverage as requested by the user.

          const latPadding = (maxLat - minLat) * 0.10;
          const lngPadding = (maxLng - minLng) * 0.10;

          const finalBounds: [number, number, number, number] = [
            minLng - lngPadding,
            minLat - latPadding,
            maxLng + lngPadding,
            maxLat + latPadding
          ];

          setBounds(finalBounds);
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
            log.debug('Bounds initialized from map', {
              bounds: finalBounds.map(b => b.toFixed(4)),
              pointsReceived: visibleBounds.length
            });
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
    }, 300); // 300ms debounce for stability during pinch-zoom
  }, [hasBoundsInitialized]);

  // ==========================================================================
  // Animation Helpers
  // ==========================================================================

  const calculateFlyDuration = useCallback(
    (targetZoom: number): number => {
      const zoomDiff = Math.abs(targetZoom - zoomRef.current);
      // Relaxed animation: base 800ms + 250ms per zoom level change
      // Capped at 2500ms for large deltas (e.g. world view transitions)
      const duration = 800 + zoomDiff * 250;
      return Math.min(duration, 2500);
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
      zoomRef.current = finalZoom;

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

      const finalZoom = targetZoom ?? MAP_CONFIG.ZOOM.LIMIT_MAX;
      const duration = calculateFlyDuration(finalZoom);

      // Track animation state so user interactions can interrupt appropriately
      isAnimatingRef.current = true;
      targetZoomRef.current = finalZoom;
      zoomRef.current = finalZoom;

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

    const targetZoom = MAP_CONFIG.ZOOM.WORLD_VIEW;
    const duration = calculateFlyDuration(targetZoom);

    // Track animation state so user interactions can interrupt appropriately
    isAnimatingRef.current = true;
    targetZoomRef.current = targetZoom;
    zoomRef.current = targetZoom; // Critical for jitter-check to work after interruption

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
    isAnimating: isAnimatingRef.current,
    handleMapReady,
    handleRegionWillChange,
    handleRegionDidChange,
    zoomIn,
    zoomOut,
    flyTo,
    centerOn,
    resetToWorldView,
    handleMapInteraction,
    animateCamera,
    calculateFlyDuration,
  };
}

export default useMapState;
