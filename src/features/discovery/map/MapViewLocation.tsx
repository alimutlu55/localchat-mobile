/**
 * MapViewLocation Component
 *
 * Renders the user's location indicator on the map with pulse animation.
 * Extracted from DiscoveryScreen for standalone reusability.
 *
 * Responsibilities:
 * - Render user location dot
 * - Render pulse animation effect
 * - Handle visibility based on map stability
 *
 * Design:
 * - Does NOT modify any existing code
 * - Uses MapLibre ShapeSource/CircleLayer for native performance
 * - All existing functionality preserved
 */

import React, { memo, useState, useEffect } from 'react';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { UserLocation } from '../types/discovery.contracts';

// =============================================================================
// Types
// =============================================================================

export interface MapViewLocationProps {
    /** User's current location */
    location: UserLocation | null;
    /** Whether the map is stable (ready for rendering) */
    isMapStable: boolean;
    /** Pulse interval in ms (default: 2000) */
    pulseInterval?: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * MapViewLocation - Renders user location with pulse effect
 *
 * Uses native MapLibre layers for optimal performance and layering.
 * The pulse effect is handled via circleRadiusTransition for smooth animation.
 */
export const MapViewLocation = memo(function MapViewLocation({
    location,
    isMapStable,
    pulseInterval = 2000,
}: MapViewLocationProps) {
    // Pulse animation state
    const [isPulsing, setIsPulsing] = useState(false);

    // Toggle pulse state on interval
    useEffect(() => {
        const interval = setInterval(() => {
            setIsPulsing(p => !p);
        }, pulseInterval);
        return () => clearInterval(interval);
    }, [pulseInterval]);

    // Don't render if no location or invalid coordinates
    if (!location || isNaN(location.latitude) || isNaN(location.longitude) || !isFinite(location.latitude) || !isFinite(location.longitude)) {
        return null;
    }

    return (
        <ShapeSource
            id="user-location-source"
            shape={{
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [location.longitude, location.latitude],
                },
                properties: {},
            }}
        >
            {/* Pulse - Animated via native transitions for smooth effect */}
            <CircleLayer
                id="user-location-pulse"
                style={{
                    circleColor: 'rgba(37, 99, 235, 0.1)',
                    circleRadius: isPulsing ? 35 : 25,
                    circleRadiusTransition: { duration: 2000, delay: 0 },
                    circleStrokeColor: 'rgba(37, 99, 235, 0.2)',
                    circleStrokeWidth: 1,
                    circleOpacity: isMapStable ? 1 : 0,
                    circleOpacityTransition: { duration: 1000, delay: 0 },
                }}
            />
            {/* The Dot: Blue with white border for premium look */}
            <CircleLayer
                id="user-location-dot"
                style={{
                    circleColor: '#2563eb',
                    circleRadius: 6,
                    circleStrokeColor: '#ffffff',
                    circleStrokeWidth: 2.5,
                    circleOpacity: isMapStable ? 1 : 0,
                    circlePitchAlignment: 'map',
                }}
            />
        </ShapeSource>
    );
});

export default MapViewLocation;
