/**
 * useMapTransitions Hook
 *
 * Manages map initialization animations and transition states.
 * Extracted from DiscoveryScreen to enable standalone testing
 * and separation of animation concerns.
 *
 * Responsibilities:
 * - Map stabilization state (prevents crashes)
 * - Overlay fade-out animation
 * - Markers fade-in animation
 * - Initial data tracking
 *
 * Design:
 * - Does NOT modify any existing code
 * - Can be used alongside existing DiscoveryScreen animations
 * - All existing functionality preserved
 * - Critical timing values maintained to prevent MapLibre crashes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';

// =============================================================================
// Types
// =============================================================================

export interface UseMapTransitionsOptions {
    /** Whether the map has finished loading */
    isMapReady: boolean;
    /** Whether initial data has been fetched */
    hasData?: boolean;
    /** Delay before map is considered stable (default: 300ms) */
    stabilizeDelay?: number;
    /** Duration of overlay fade-out (default: 300ms) */
    overlayFadeDuration?: number;
    /** Delay before markers fade-in (default: 500ms) */
    markersFadeDelay?: number;
    /** Duration of markers fade-in (default: 400ms) */
    markersFadeDuration?: number;
}

export interface UseMapTransitionsReturn {
    /** Whether map is stable and ready for markers */
    isMapStable: boolean;
    /** Whether initial data has been set */
    hasInitialData: boolean;
    /** Whether markers can be rendered (stable + data + not logging out) */
    canRenderMarkers: boolean;
    /** Animated value for map overlay opacity (1 = loading, 0 = hidden) */
    overlayOpacity: Animated.Value;
    /** Animated value for markers opacity (0 = hidden, 1 = visible) */
    markersOpacity: Animated.Value;
    /** Mark that data has loaded (call when features arrive) */
    setDataLoaded: () => void;
    /** Reset animations (call when map becomes not ready) */
    resetAnimations: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMapTransitions(
    options: UseMapTransitionsOptions
): UseMapTransitionsReturn {
    const {
        isMapReady,
        hasData = false,
        stabilizeDelay = 300,
        overlayFadeDuration = 300,
        markersFadeDelay = 500,
        markersFadeDuration = 400,
    } = options;

    // Map stabilization state - prevents marker rendering until map is fully ready
    // This fixes a native crash where MapLibre tries to insert nil subviews
    const [isMapStable, setIsMapStable] = useState(false);

    // Track if initial data has loaded
    const [hasInitialData, setHasInitialData] = useState(false);

    // Animation values
    const overlayOpacity = useRef(new Animated.Value(1)).current;
    const markersOpacity = useRef(new Animated.Value(0)).current;

    // Mark data as loaded
    const setDataLoaded = useCallback(() => {
        if (!hasInitialData) {
            setHasInitialData(true);
        }
    }, [hasInitialData]);

    // Reset animations
    const resetAnimations = useCallback(() => {
        setIsMapStable(false);
        setHasInitialData(false);
        overlayOpacity.setValue(1);
        markersOpacity.setValue(0);
    }, [overlayOpacity, markersOpacity]);

    // Track external hasData prop
    useEffect(() => {
        if (hasData && !hasInitialData && isMapStable) {
            const timer = setTimeout(() => {
                setHasInitialData(true);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [hasData, hasInitialData, isMapStable]);

    // Smooth map initialization sequence
    // CRITICAL: Timing values prevent MapLibre native crashes
    useEffect(() => {
        if (isMapReady) {
            // Phase 1: Wait for map to stabilize internally
            const stabilizeTimer = setTimeout(() => {
                setIsMapStable(true);

                // Phase 2: Fade out the overlay to reveal the map
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: overlayFadeDuration,
                    useNativeDriver: true,
                }).start();

                // Phase 3: Fade in markers after delay
                setTimeout(() => {
                    Animated.timing(markersOpacity, {
                        toValue: 1,
                        duration: markersFadeDuration,
                        useNativeDriver: true,
                    }).start();
                }, markersFadeDelay);
            }, stabilizeDelay);

            return () => clearTimeout(stabilizeTimer);
        } else {
            // Reset animations when map is not ready
            resetAnimations();
        }
    }, [
        isMapReady,
        stabilizeDelay,
        overlayFadeDuration,
        markersFadeDelay,
        markersFadeDuration,
        overlayOpacity,
        markersOpacity,
        resetAnimations,
    ]);

    const canRenderMarkers = isMapStable && hasInitialData;

    return {
        isMapStable,
        hasInitialData,
        canRenderMarkers,
        overlayOpacity,
        markersOpacity,
        setDataLoaded,
        resetAnimations,
    };
}

export default useMapTransitions;
