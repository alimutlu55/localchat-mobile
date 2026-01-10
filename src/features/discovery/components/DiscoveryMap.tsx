import React from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { MapView, Camera, MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';
import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';
import { ServerRoomMarker, ServerClusterMarker } from './ServerClusterMarkers';
import { MapViewLocation } from '../map/MapViewLocation';
import { ClusterFeature } from '../../../types';
import { styles } from '../screens/DiscoveryScreen.styles';

interface DiscoveryMapProps {
    mapRef: React.RefObject<MapViewRef | null>;
    cameraRef: React.RefObject<CameraRef | null>;
    centerCoord: [number, number];
    zoom: number;
    onMapReady: () => void;
    onRegionWillChange: (event: any) => void;
    onRegionDidChange: (event: any) => void;
    userLocation: { latitude: number; longitude: number } | null;
    isMapStable: boolean;
    canRenderMarkers: boolean;
    serverFeatures: ClusterFeature[];
    selectedFeature: ClusterFeature | null;
    onServerClusterPress: (feature: ClusterFeature) => void;
    onServerRoomPress: (feature: ClusterFeature) => void;
    onMarkerDeselect: () => void;
    mapOverlayOpacity: Animated.Value;
    markersOpacity: Animated.Value;
}

export const DiscoveryMap: React.FC<DiscoveryMapProps> = ({
    mapRef,
    cameraRef,
    centerCoord,
    zoom,
    onMapReady,
    onRegionWillChange,
    onRegionDidChange,
    userLocation,
    isMapStable,
    canRenderMarkers,
    serverFeatures,
    selectedFeature,
    onServerClusterPress,
    onServerRoomPress,
    onMarkerDeselect,
    mapOverlayOpacity,
    markersOpacity,
}) => {
    return (
        <>
            <MapView
                ref={mapRef}
                style={styles.map}
                mapStyle={HUDDLE_MAP_STYLE}
                logoEnabled={false}
                attributionEnabled={true}
                attributionPosition={{ bottom: 8, right: 8 }}
                onDidFinishLoadingMap={onMapReady}
                onRegionWillChange={onRegionWillChange}
                onRegionDidChange={onRegionDidChange}
            >
                <Camera
                    ref={cameraRef}
                    defaultSettings={{
                        centerCoordinate: centerCoord,
                        zoomLevel: zoom,
                    }}
                    minZoomLevel={1}
                    maxZoomLevel={12}
                />

                {/* User Location Indicator - Guard with location check */}
                {userLocation && (
                    <MapViewLocation
                        location={userLocation}
                        isMapStable={isMapStable}
                    />
                )}

                {/* Server-Side Markers - Flattened rendering to prevent Fragment-related native crashes */}
                {(() => {
                    if (!canRenderMarkers) {
                        return null;
                    }
                    if (!serverFeatures || serverFeatures.length === 0) {
                        return null;
                    }

                    return serverFeatures
                        .filter((f: ClusterFeature) => f.properties.cluster ? f.properties.clusterId != null : !!f.properties.roomId)
                        .map((feature: ClusterFeature) => {
                            const [lng, lat] = feature.geometry.coordinates;
                            if (feature.properties.cluster) {
                                return (
                                    <ServerClusterMarker
                                        key={`server-cluster-${feature.properties.clusterId}-${lng.toFixed(4)}-${lat.toFixed(4)}`} // Force remount on move
                                        feature={feature}
                                        onPress={onServerClusterPress}
                                    />
                                );
                            }
                            return (
                                <ServerRoomMarker
                                    key={`server-room-${feature.properties.roomId}-${lng.toFixed(4)}-${lat.toFixed(4)}`} // Force remount on move
                                    feature={feature}
                                    isSelected={selectedFeature?.properties.roomId === feature.properties.roomId}
                                    onPress={onServerRoomPress}
                                    onDeselect={onMarkerDeselect}
                                />
                            );
                        });
                })()}
            </MapView>

            {/* Map Loading Overlay - Fades out when map is ready */}
            <Animated.View
                style={[
                    styles.mapLoadingOverlay,
                    { opacity: mapOverlayOpacity },
                ]}
                pointerEvents={isMapStable ? 'none' : 'auto'}
            >
                <View style={styles.mapLoadingContent}>
                    <ActivityIndicator size="large" color="#FF6410" />
                    <Text style={styles.mapLoadingText}>Loading map...</Text>
                </View>
            </Animated.View>
        </>
    );
};

export default DiscoveryMap;
