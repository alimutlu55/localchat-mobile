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
    /** Whether a view transition is in progress */
    isTransitioning: boolean;
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

    // View mode state
    const [mode, setModeInternal] = useState<DiscoveryViewMode>(initialMode);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Map rendering state - unmount for performance when in list mode
    const [shouldRenderMap, setShouldRenderMap] = useState(initialMode === 'map');

    // Animation for view switching
    const listOpacity = useRef(new Animated.Value(initialMode === 'list' ? 1 : 0)).current;

    // Handle view mode changes with animation
    useEffect(() => {
        setIsTransitioning(true);

        Animated.timing(listOpacity, {
            toValue: mode === 'list' ? 1 : 0,
            duration: transitionDuration,
            useNativeDriver: true,
        }).start(() => {
            setIsTransitioning(false);
        });

        if (mode === 'map') {
            // Immediately render map when switching to map mode
            setShouldRenderMap(true);
        } else {
            // Keep map for transition duration, then unmount to save resources
            const timer = setTimeout(() => {
                setShouldRenderMap(false);
            }, mapUnmountDelay);
            return () => clearTimeout(timer);
        }
    }, [mode, transitionDuration, mapUnmountDelay, listOpacity]);

    // Set mode with validation
    const setMode = useCallback((newMode: DiscoveryViewMode) => {
        if (newMode !== mode) {
            setModeInternal(newMode);
        }
    }, [mode]);

    // Toggle between map and list
    const toggleMode = useCallback(() => {
        setModeInternal(current => current === 'map' ? 'list' : 'map');
    }, []);

    return {
        mode,
        setMode,
        toggleMode,
        isTransitioning,
        shouldRenderMap,
        listOpacity,
    };
}

export default useDiscoveryViewState;
