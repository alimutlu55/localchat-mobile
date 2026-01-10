/**
 * useDiscoveryViewState Hook
 *
 * Manages the view mode (map vs list) state and transitions for Discovery.
 * Extracted from DiscoveryScreen to enable standalone testing and reuse.
 *
 * Responsibilities:
 * - View mode state (map | list)
 * - View transition animations
 * - Map rendering lifecycle (unmount when in list mode for performance)
 *
 * Design:
 * - Does NOT modify any existing code
 * - Can be used alongside existing DiscoveryScreen state
 * - All existing functionality preserved
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import type { DiscoveryViewMode, DiscoveryViewState } from '../../types/discovery.contracts';

// =============================================================================
// Types
// =============================================================================

export interface UseDiscoveryViewStateOptions {
    /** Initial view mode (default: 'map') */
    initialMode?: DiscoveryViewMode;
    /** Duration of view switch animation in ms (default: 150) */
    transitionDuration?: number;
    /** Delay before unmounting map when switching to list (default: 300) */
    mapUnmountDelay?: number;
}

export interface UseDiscoveryViewStateReturn extends DiscoveryViewState {
    /** Current view mode */
    mode: DiscoveryViewMode;
    /** Set view mode */
    setMode: (mode: DiscoveryViewMode) => void;
    /** Toggle between map and list */
    toggleMode: () => void;
    /** Whether map should be rendered (false = unmounted for performance) */
    shouldRenderMap: boolean;
    /** Animated value for list opacity (0 = hidden, 1 = visible) */
    listOpacity: Animated.Value;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDiscoveryViewState(
    options: UseDiscoveryViewStateOptions = {}
): UseDiscoveryViewStateReturn {
    const {
        initialMode = 'map',
        transitionDuration = 150,
        mapUnmountDelay = 300,
    } = options;

    // View mode state - consolidated to minimize re-renders
    const [state, setState] = useState<{
        mode: DiscoveryViewMode;
    }>({
        mode: initialMode,
    });

    const mode = state.mode;

    // Map rendering state - unmount for performance when in list mode
    const [shouldRenderMap, setShouldRenderMap] = useState(initialMode === 'map');

    // Animation for view switching
    const listOpacity = useRef(new Animated.Value(initialMode === 'list' ? 1 : 0)).current;

    // Handle view mode changes with animation
    useEffect(() => {
        Animated.timing(listOpacity, {
            toValue: mode === 'list' ? 1 : 0,
            duration: transitionDuration,
            useNativeDriver: true,
        }).start();

        if (mode === 'list') {
            // Keep map for transition duration, then unmount to save resources
            const timer = setTimeout(() => {
                setShouldRenderMap(false);
            }, mapUnmountDelay);
            return () => clearTimeout(timer);
        }
    }, [mode, transitionDuration, mapUnmountDelay, listOpacity]);

    // Set mode with validation
    const setMode = useCallback((newMode: DiscoveryViewMode) => {
        setState(current => {
            if (newMode === current.mode) return current;

            // Side effect: update map mounting state
            if (newMode === 'map') {
                setShouldRenderMap(true);
            }

            return {
                mode: newMode,
            };
        });
    }, []);

    // Toggle between map and list
    const toggleMode = useCallback(() => {
        setState(current => ({
            ...current,
            mode: current.mode === 'map' ? 'list' : 'map',
        }));
    }, []);

    return {
        mode: state.mode,
        setMode,
        toggleMode,
        shouldRenderMap,
        listOpacity,
    };
}

export default useDiscoveryViewState;
