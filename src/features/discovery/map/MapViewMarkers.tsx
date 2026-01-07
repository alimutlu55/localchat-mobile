/**
 * MapViewMarkers Component
 *
 * Renders cluster and room markers on the map.
 * Extracted from DiscoveryScreen for standalone reusability.
 *
 * Responsibilities:
 * - Render cluster markers (ServerClusterMarker)
 * - Render room markers (ServerRoomMarker)
 * - Handle marker press events
 * - Gate rendering based on canRenderMarkers flag
 *
 * Design:
 * - Does NOT modify any existing code
 * - Purely presentational component
 * - All existing functionality preserved
 */

import React, { memo, useCallback } from 'react';
import { ClusterFeature, Room } from '../../../types';
import { ServerRoomMarker, ServerClusterMarker } from '../components';

// =============================================================================
// Types
// =============================================================================

export interface MapViewMarkersProps {
    /** Array of cluster/room features from server */
    features: ClusterFeature[];
    /** Whether markers can be rendered (map stable + data loaded) */
    canRenderMarkers: boolean;
    /** Currently selected feature (for highlighting) */
    selectedFeature?: ClusterFeature | null;
    /** Called when a room marker is pressed */
    onRoomPress: (feature: ClusterFeature) => void;
    /** Called when a cluster marker is pressed */
    onClusterPress: (feature: ClusterFeature) => void;
    /** Called when a marker is deselected */
    onDeselect?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * MapViewMarkers - Renders all markers on the map
 *
 * Memoized to prevent unnecessary re-renders during map interactions.
 */
export const MapViewMarkers = memo(function MapViewMarkers({
    features,
    canRenderMarkers,
    selectedFeature,
    onRoomPress,
    onClusterPress,
    onDeselect,
}: MapViewMarkersProps) {
    // Don't render anything if not ready
    if (!canRenderMarkers) {
        return null;
    }

    // DEFENSIVE PATTERN: Contiguous Child Rendering
    // We filter the features BEFORE mapping to ensure the native bridge receives
    // a clean, contiguous array of view components. Returning 'null' from within 
    // a .map() can sometimes lead to 'nil' insertion crashes in MLRNMapView.
    const validFeatures = features.filter(f => {
        if (f.properties.cluster) {
            return f.properties.clusterId != null;
        }
        return !!f.properties.roomId;
    });

    return (
        <>
            {validFeatures.map((feature) => {
                if (feature.properties.cluster) {
                    return (
                        <ServerClusterMarker
                            key={`server-cluster-${feature.properties.clusterId}`}
                            feature={feature}
                            onPress={onClusterPress}
                            onDeselect={onDeselect}
                        />
                    );
                }

                return (
                    <ServerRoomMarker
                        key={`server-room-${feature.properties.roomId}`}
                        feature={feature}
                        isSelected={selectedFeature?.properties.roomId === feature.properties.roomId}
                        onPress={onRoomPress}
                        onDeselect={onDeselect}
                    />
                );
            })}
        </>
    );
});

export default MapViewMarkers;
