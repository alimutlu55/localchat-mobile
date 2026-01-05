/**
 * MapScreen Component
 *
 * Dedicated map view screen for room discovery.
 * Thin wrapper that composes the MapContainer with concrete marker implementations.
 *
 * This is an ADDITIVE component - the existing DiscoveryScreen continues to work.
 * Use this for new navigation flows or as a replacement when ready.
 */

import React, { useCallback, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Minus, Navigation, Globe, Map as MapIcon, List } from 'lucide-react-native';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';

import { Room, ClusterFeature, RoomCategory } from '../../../types';
import { RootStackParamList } from '../../../navigation/types';
import { theme } from '../../../core/theme';
import { useUIActions } from '../../../context';
import { useAuth } from '../../auth/hooks/useAuth';
import { useUserStore } from '../../user';
import { ServerRoomMarker, ServerClusterMarker, MapHeader } from '../components';
import { useServerClustering } from '../hooks';
import { useLocationPermission } from '../../../shared/stores/LocationConsentStore';
import { MapContainer, MapContainerRef, MapControlsProps } from '../containers';
import { ConnectionBanner } from '../../../components/chat/ConnectionBanner';

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface MapScreenProps {
    /** Callback when view should switch to list */
    onSwitchToList?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function MapScreen({ onSwitchToList }: MapScreenProps) {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { openSidebar } = useUIActions();
    const { status: authStatus } = useAuth();
    const mapContainerRef = useRef<MapContainerRef>(null);
    const { isGranted: hasPermission } = useLocationPermission();

    // User info for header
    const currentUser = useUserStore((state) => state.currentUser);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Track selected room
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    // Prevent marker rendering during logout to avoid native crashes
    const canRenderMarkers = authStatus !== 'loggingOut';

    // ==========================================================================
    // Handlers
    // ==========================================================================

    const handleRoomPress = useCallback((room: Room) => {
        navigation.navigate('RoomDetails', {
            roomId: room.id,
            initialRoom: serializeRoom(room),
        });
    }, [navigation]);

    const handleClusterPress = useCallback((feature: ClusterFeature, expansionZoom: number) => {
        const [lng, lat] = feature.geometry.coordinates;
        mapContainerRef.current?.flyTo(lng, lat, expansionZoom, 800);
    }, []);

    const handleCreateRoom = useCallback(() => {
        navigation.navigate('CreateRoom', {});
    }, [navigation]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await mapContainerRef.current?.refetch();
        setIsRefreshing(false);
    }, []);

    const handleProfilePress = useCallback(() => {
        navigation.navigate('Profile');
    }, [navigation]);

    // ==========================================================================
    // Render Props
    // ==========================================================================

    const renderRoomMarker = useCallback((feature: ClusterFeature, onPress: () => void) => (
        <ServerRoomMarker
            key={`room-${feature.properties.roomId}`}
            feature={feature}
            isSelected={feature.properties.roomId === selectedRoomId}
            onPress={() => {
                setSelectedRoomId(feature.properties.roomId || null);
                onPress();
            }}
        />
    ), [selectedRoomId]);

    const renderClusterMarker = useCallback((feature: ClusterFeature, onPress: () => void) => (
        <ServerClusterMarker
            key={`cluster-${feature.properties.clusterId}`}
            feature={feature}
            onPress={onPress}
        />
    ), []);

    const renderUserLocation = useCallback((location: { latitude: number; longitude: number }) => (
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
            <CircleLayer
                id="user-location-outer"
                style={{
                    circleRadius: 12,
                    circleColor: 'rgba(66, 133, 244, 0.2)',
                }}
            />
            <CircleLayer
                id="user-location-inner"
                style={{
                    circleRadius: 6,
                    circleColor: '#4285F4',
                    circleStrokeWidth: 2,
                    circleStrokeColor: '#FFFFFF',
                }}
            />
        </ShapeSource>
    ), []);

    const renderControls = useCallback((props: MapControlsProps) => (
        <View style={styles.controlsContainer}>
            {/* Zoom Controls */}
            <View style={styles.zoomControls}>
                <TouchableOpacity style={styles.controlButton} onPress={props.onZoomIn}>
                    <Plus size={20} color={theme.tokens.text.secondary} />
                </TouchableOpacity>
                <View style={styles.controlDivider} />
                <TouchableOpacity style={styles.controlButton} onPress={props.onZoomOut}>
                    <Minus size={20} color={theme.tokens.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* Location Control */}
            {hasPermission && (
                <TouchableOpacity
                    style={[styles.controlButton, styles.locationButton]}
                    onPress={props.onCenterOnUser}
                >
                    <Navigation
                        size={20}
                        color={props.hasUserLocation ? theme.tokens.brand.primary : theme.tokens.text.tertiary}
                    />
                </TouchableOpacity>
            )}

            {/* World View */}
            <TouchableOpacity
                style={[styles.controlButton, styles.worldButton]}
                onPress={props.onWorldView}
            >
                <Globe size={20} color={theme.tokens.text.secondary} />
            </TouchableOpacity>

            {/* View Toggle (if onSwitchToList provided) */}
            {onSwitchToList && (
                <TouchableOpacity
                    style={[styles.controlButton, styles.toggleButton]}
                    onPress={onSwitchToList}
                >
                    <List size={20} color={theme.tokens.text.secondary} />
                </TouchableOpacity>
            )}
        </View>
    ), [onSwitchToList]);

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <MapHeader
                avatarUrl={currentUser?.profilePhotoUrl}
                displayName={currentUser?.displayName || 'User'}
                roomCount={0} // Will be updated by parent when integrated
                isRefreshing={isRefreshing}
                myRoomsCount={0} // Will be updated by parent when integrated
                onProfilePress={handleProfilePress}
                onRefreshPress={handleRefresh}
                onMyRoomsPress={openSidebar}
                topInset={insets.top}
            />

            {/* Connection Banner */}
            <ConnectionBanner />

            {/* Map */}
            <MapContainer
                ref={mapContainerRef}
                onRoomPress={handleRoomPress}
                onClusterPress={handleClusterPress}
                renderRoomMarker={renderRoomMarker}
                renderClusterMarker={renderClusterMarker}
                renderUserLocation={renderUserLocation}
                renderControls={renderControls}
                canRenderMarkers={canRenderMarkers}
            />
        </SafeAreaView>
    );
}

// =============================================================================
// Helpers
// =============================================================================

const serializeRoom = (room: Room): any => ({
    ...room,
    expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    controlsContainer: {
        position: 'absolute',
        right: 16,
        bottom: 100,
        gap: 8,
    },
    zoomControls: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
    },
    controlButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlDivider: {
        height: 1,
        backgroundColor: theme.tokens.border.subtle,
    },
    locationButton: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    worldButton: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    toggleButton: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
});

export default MapScreen;
