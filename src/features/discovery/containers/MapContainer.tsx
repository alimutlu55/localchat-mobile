/**
 * MapContainer Component
 *
 * Container component that orchestrates map-related hooks and presentational components.
 * Separates business logic from presentation following the container/presenter pattern.
 *
 * Responsibilities:
 * - Coordinate map state, user location, and clustering hooks
 * - Handle map events (region changes, marker presses)
 * - Provide data and callbacks to presentational map components
 *
 * Does NOT:
 * - Render specific marker implementations (uses render props)
 * - Handle navigation (receives callbacks)
 * - Manage view mode switching (handled by parent)
 */

import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapView as MapViewComponent, Camera as CameraComponent } from '@maplibre/maplibre-react-native';
import { ClusterFeature, Room, RoomCategory } from '../../../types';
import { useMapState, useUserLocation, useServerClustering } from '../hooks';
import { useRoomStore, selectSelectedCategory } from '../../rooms';
import { createLogger } from '../../../shared/utils/logger';
import { CATEGORIES, MAP_CONFIG } from '../../../constants';
import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';

const log = createLogger('MapContainer');

// =============================================================================
// Types
// =============================================================================

export interface MapContainerProps {
    /** Callback when a room marker is pressed */
    onRoomPress?: (room: Room) => void;
    /** Callback when a cluster is pressed */
    onClusterPress?: (feature: ClusterFeature, expansionZoom: number) => void;
    /** Render prop for room markers */
    renderRoomMarker?: (feature: ClusterFeature, onPress: () => void) => React.ReactNode;
    /** Render prop for cluster markers */
    renderClusterMarker?: (feature: ClusterFeature, onPress: () => void) => React.ReactNode;
    /** Render prop for user location indicator */
    renderUserLocation?: (location: { latitude: number; longitude: number }) => React.ReactNode;
    /** Render prop for map controls */
    renderControls?: (props: MapControlsProps) => React.ReactNode;
    /** Whether markers can be rendered (e.g., auth stable, map ready) */
    canRenderMarkers?: boolean;
    /** Map style URL */
    mapStyle?: string;
}

export interface MapControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onCenterOnUser: () => void;
    onWorldView: () => void;
    zoom: number;
    isLoading: boolean;
    hasUserLocation: boolean;
}

export interface MapContainerRef {
    /** Refetch clusters */
    refetch: () => Promise<void>;
    /** Set camera to specific position */
    flyTo: (lng: number, lat: number, zoom: number, duration?: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export const MapContainer = React.forwardRef<MapContainerRef, MapContainerProps>(
    function MapContainer(props, ref) {
        const {
            onRoomPress,
            onClusterPress,
            renderRoomMarker,
            renderClusterMarker,
            renderUserLocation,
            renderControls,
            canRenderMarkers = true,
            mapStyle = HUDDLE_MAP_STYLE,
        } = props;

        // Track zoom in a ref for immediate access
        const zoomRef = useRef<number>(MAP_CONFIG.ZOOM.INITIAL);

        // Global filter state
        const selectedCategory = useRoomStore(selectSelectedCategory);
        const categoryConfig = CATEGORIES.find(c => c.label === selectedCategory);
        const categoryFilter = selectedCategory === 'All' ? undefined : (categoryConfig?.id || selectedCategory);

        // ==========================================================================
        // Hooks
        // ==========================================================================

        const {
            mapRef,
            cameraRef,
            zoom,
            bounds,
            isMapReady,
            handleRegionDidChange,
            zoomIn,
            zoomOut,
            flyTo,
            centerOn,
            resetToWorldView,
        } = useMapState({
            defaultCenter: MAP_CONFIG.DEFAULT_CENTER,
            defaultZoom: MAP_CONFIG.ZOOM.INITIAL,
        });

        const {
            location: userLocation,
            isLoading: isLocationLoading,
            permissionDenied: hasLocationPermission,
            refresh: requestLocation,
        } = useUserLocation();

        const {
            features,
            isLoading: isClustersLoading,
            error: clusterError,
            refetch,
            prefetchForLocation,
            prefetchForWorldView,
        } = useServerClustering({
            bounds,
            zoom,
            enabled: isMapReady,
            isMapReady,
            category: categoryFilter,
            userLocation,
        });

        // Update zoom ref
        useEffect(() => {
            zoomRef.current = zoom;
        }, [zoom]);

        // ==========================================================================
        // Event Handlers
        // ==========================================================================

        const handleRegionChange = useCallback((event: any) => {
            // Delegate to the hook's handler (debounced internally)
            handleRegionDidChange();
        }, [handleRegionDidChange]);

        const handleCenterOnUser = useCallback(() => {
            if (!userLocation) {
                requestLocation();
                return;
            }

            const targetZoom = 14;
            const duration = 800;

            // Prefetch for smooth transition
            prefetchForLocation(userLocation.longitude, userLocation.latitude, targetZoom, duration);

            // Animate camera
            centerOn({ latitude: userLocation.latitude, longitude: userLocation.longitude }, targetZoom);
        }, [userLocation, requestLocation, prefetchForLocation, centerOn]);

        const handleWorldView = useCallback(() => {
            const duration = 1200;

            // Prefetch world view data
            prefetchForWorldView(duration);

            // Animate to world view
            resetToWorldView();
        }, [prefetchForWorldView, resetToWorldView]);

        const handleRoomMarkerPress = useCallback((feature: ClusterFeature) => {
            if (feature.properties.cluster) return;

            // Convert feature to Room object
            const room: Room = {
                id: feature.properties.roomId!,
                title: feature.properties.title || 'Room',
                category: feature.properties.category as RoomCategory,
                participantCount: feature.properties.participantCount || 0,
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
                expiresAt: new Date(feature.properties.expiresAt || Date.now() + 3600000),
                hasJoined: feature.properties.hasJoined,
                isCreator: feature.properties.isCreator,
                status: feature.properties.status,
            } as Room;

            onRoomPress?.(room);
        }, [onRoomPress]);

        const handleClusterMarkerPress = useCallback((feature: ClusterFeature) => {
            if (!feature.properties.cluster) return;

            // Calculate expansion zoom
            const currentZoom = zoomRef.current;
            const expansionBounds = feature.properties.expansionBounds;
            let targetZoom = currentZoom + 2;

            if (expansionBounds) {
                const [minLng, minLat, maxLng, maxLat] = expansionBounds;
                const boundsSpan = Math.max(maxLng - minLng, maxLat - minLat);
                // Simple heuristic: more span = lower zoom needed
                if (boundsSpan > 1) targetZoom = currentZoom + 1;
                else if (boundsSpan > 0.1) targetZoom = currentZoom + 2;
                else targetZoom = currentZoom + 3;
            }

            targetZoom = Math.min(targetZoom, 15);

            onClusterPress?.(feature, targetZoom);
        }, [onClusterPress]);

        // ==========================================================================
        // Imperative Handle
        // ==========================================================================

        React.useImperativeHandle(ref, () => ({
            refetch,
            flyTo: (lng: number, lat: number, targetZoom: number, _duration = 800) => {
                flyTo({ latitude: lat, longitude: lng }, targetZoom);
            },
        }), [refetch, flyTo]);

        // ==========================================================================
        // Room/Cluster Features
        // ==========================================================================

        const roomFeatures = useMemo(() =>
            features.filter(f => !f.properties.cluster),
            [features]
        );

        const clusterFeatures = useMemo(() =>
            features.filter(f => f.properties.cluster),
            [features]
        );

        // ==========================================================================
        // Controls Props
        // ==========================================================================

        const controlsProps: MapControlsProps = useMemo(() => ({
            onZoomIn: zoomIn,
            onZoomOut: zoomOut,
            onCenterOnUser: handleCenterOnUser,
            onWorldView: handleWorldView,
            zoom,
            isLoading: isClustersLoading,
            hasUserLocation: !!userLocation,
        }), [zoomIn, zoomOut, handleCenterOnUser, handleWorldView, zoom, isClustersLoading, userLocation]);

        // ==========================================================================
        // Render
        // ==========================================================================

        return (
            <View style={styles.container}>
                <MapViewComponent
                    ref={mapRef as any}
                    style={styles.map}
                    mapStyle={mapStyle}
                    onRegionDidChange={handleRegionChange}
                    attributionEnabled={false}
                    logoEnabled={false}
                    compassEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                >
                    <CameraComponent
                        ref={cameraRef as any}
                        defaultSettings={{
                            centerCoordinate: [MAP_CONFIG.DEFAULT_CENTER.longitude, MAP_CONFIG.DEFAULT_CENTER.latitude],
                            zoomLevel: MAP_CONFIG.ZOOM.INITIAL,
                        }}
                    />

                    {/* User Location */}
                    {userLocation && renderUserLocation?.(userLocation)}

                    {/* Room Markers */}
                    {canRenderMarkers && roomFeatures.map(feature => (
                        <React.Fragment key={`room-${feature.properties.roomId}`}>
                            {renderRoomMarker?.(feature, () => handleRoomMarkerPress(feature))}
                        </React.Fragment>
                    ))}

                    {/* Cluster Markers */}
                    {canRenderMarkers && clusterFeatures.map(feature => (
                        <React.Fragment key={`cluster-${feature.properties.clusterId}`}>
                            {renderClusterMarker?.(feature, () => handleClusterMarkerPress(feature))}
                        </React.Fragment>
                    ))}
                </MapViewComponent>

                {/* Controls */}
                {renderControls?.(controlsProps)}
            </View>
        );
    }
);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
});

export default MapContainer;
