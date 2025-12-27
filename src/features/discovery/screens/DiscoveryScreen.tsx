/**
 * Discovery Screen (Refactored)
 *
 * Unified discovery screen using extracted hooks for separation of concerns.
 *
 * Architecture:
 * - useMapState: Map camera, bounds, zoom controls
 * - useUserLocation: User geolocation with permissions
 * - useMapClustering: Room clustering logic
 * - UI is purely presentational
 *
 * ~400 LOC (down from 975 LOC)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    MapView,
    Camera,
    ShapeSource,
    CircleLayer,
} from '@maplibre/maplibre-react-native';
import { Plus, Minus, Navigation, Menu, Map as MapIcon, List, Globe } from 'lucide-react-native';

// Navigation
import { RootStackParamList } from '../../../navigation/types';

// Types
import { Room } from '../../../types';

// Constants
import { ROOM_CONFIG } from '../../../constants';

// Context
import { useUIActions } from '../../../context';

// Features
import { useRoomDiscovery, useJoinRoom, useMyRooms } from '../../rooms/hooks';

// Components - now from feature module
import { RoomListView, RoomMarker, ClusterMarker } from '../components';

// Hooks
import { useMapState, useUserLocation, useMapClustering } from '../hooks';

// Styles
import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';

// Utils
import { createLogger } from '../../../shared/utils/logger';
import { ClusterFeature, isCluster as checkIsCluster } from '../../../utils/mapClustering';

const log = createLogger('Discovery');

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ViewMode = 'map' | 'list';

// =============================================================================
// Main Component
// =============================================================================

export default function DiscoveryScreen() {
    const navigation = useNavigation<NavigationProp>();

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>('map');

    // Animation for view switching
    const listOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(listOpacity, {
            toValue: viewMode === 'list' ? 1 : 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [viewMode, listOpacity]);

    // ==========================================================================
    // Hooks
    // ==========================================================================

    // User Location
    const { location: userLocation, isLoading: isLocationLoading, permissionDenied } = useUserLocation();

    // Map State
    const {
        mapRef,
        cameraRef,
        zoom,
        bounds,
        centerCoord,
        isMapReady,
        handleMapReady,
        handleRegionWillChange,
        handleRegionDidChange,
        zoomIn,
        zoomOut,
        centerOn,
        resetToWorldView,
        calculateFlyDuration,
    } = useMapState({
        defaultCenter: userLocation || undefined,
        defaultZoom: 13,
    });

    // Room discovery - using hooks instead of context
    const {
        rooms: discoveredRooms,
        isLoading: isLoadingRooms,
        refresh: fetchDiscoveredRoomsHook,
    } = useRoomDiscovery({
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0,
        autoFetch: false, // We'll fetch manually after location is ready
    });
    
    const { join: joinRoomHook } = useJoinRoom();
    const { activeRooms: myActiveRooms } = useMyRooms();
    
    // Local state for selected room
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    
    // Wrapper for joinRoom to match expected signature
    const joinRoom = async (room: Room): Promise<boolean> => {
        const result = await joinRoomHook(room);
        return result.success;
    };
    
    // Wrapper for fetchDiscoveredRooms to match expected signature
    const fetchDiscoveredRooms = async (lat: number, lng: number, radius?: number) => {
        await fetchDiscoveredRoomsHook();
    };
    
    // Use discovered rooms for activeRooms (filtered in useRoomDiscovery)
    // Note: discoveredRooms is now reactive to room removals (e.g., when banned)
    const activeRooms = useMemo(() => {
        const now = Date.now();
        return discoveredRooms.filter(room => {
            const isExpired = room.expiresAt && room.expiresAt.getTime() < now;
            return !isExpired && room.status !== 'closed' && room.status !== 'expired';
        });
    }, [discoveredRooms]);

    const { openSidebar } = useUIActions();

    // Map Clustering
    const {
        features,
        totalEventsInView,
        circlesGeoJSON,
        getClusterLeaves,
        getClusterExpansionZoom,
    } = useMapClustering({
        rooms: activeRooms,
        bounds,
        zoom,
        isMapReady,
    });

    // ==========================================================================
    // Room Fetching
    // ==========================================================================

    // Track if initial fetch has been done (prevents re-fetch on callback changes)
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // Only fetch once when we first get user location
        if (userLocation && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchDiscoveredRooms(
                userLocation.latitude,
                userLocation.longitude,
                ROOM_CONFIG.DEFAULT_RADIUS
            ).catch((error) => {
                log.error('Failed to fetch rooms', error);
            });
        }
    }, [userLocation, fetchDiscoveredRooms]);

    // ==========================================================================
    // Handlers
    // ==========================================================================

    const handleRoomPress = useCallback(
        (room: Room) => {
            log.debug('Room pressed', { roomId: room.id });

            if (isMapReady && cameraRef.current && room.latitude != null && room.longitude != null) {
                const targetZoom = Math.min(Math.max(zoom + 2, 14), 16);
                const zoomDiff = Math.abs(targetZoom - zoom);

                // If already zoomed in enough, navigate directly
                if (zoomDiff <= 1.5) {
                    setSelectedRoom(room);
                    navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
                    return;
                }

                // Fly to room then navigate
                const duration = calculateFlyDuration(targetZoom);
                cameraRef.current.setCamera({
                    centerCoordinate: [room.longitude, room.latitude],
                    zoomLevel: targetZoom,
                    animationDuration: duration,
                    animationMode: 'flyTo',
                });

                setTimeout(() => {
                    setSelectedRoom(room);
                    navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
                }, duration + 150);
            } else {
                setSelectedRoom(room);
                navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
            }
        },
        [navigation, setSelectedRoom, isMapReady, zoom, calculateFlyDuration, cameraRef]
    );

    const handleClusterPress = useCallback(
        (cluster: ClusterFeature) => {
            log.debug('Cluster pressed', { clusterId: cluster.properties.cluster_id });
            if (!isMapReady || !cameraRef.current) return;

            const [lng, lat] = cluster.geometry.coordinates;
            const leaves = getClusterLeaves(cluster.properties.cluster_id);
            const expansionZoom = getClusterExpansionZoom(cluster.properties.cluster_id);

            // At max zoom, show first room
            if (zoom >= 17 && expansionZoom > 18) {
                const firstRoom = leaves[0].properties.room;
                setSelectedRoom(firstRoom);
                navigation.navigate('RoomDetails', { roomId: firstRoom.id, initialRoom: firstRoom });
                return;
            }

            // Calculate target zoom
            let targetZoom: number;
            if (leaves.length <= 3) {
                targetZoom = Math.min(expansionZoom + 1, 18);
            } else if (leaves.length <= 10) {
                targetZoom = Math.min(expansionZoom, 17);
            } else {
                targetZoom = Math.min(Math.max(expansionZoom - 1, zoom + 2), 16);
            }
            targetZoom = Math.max(targetZoom, zoom + 2);

            const duration = calculateFlyDuration(targetZoom);
            cameraRef.current.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: targetZoom,
                animationDuration: Math.min(duration, 1000),
                animationMode: 'easeTo',
            });
        },
        [isMapReady, zoom, getClusterLeaves, getClusterExpansionZoom, setSelectedRoom, navigation, calculateFlyDuration, cameraRef]
    );

    const handleCreateRoom = useCallback(() => {
        navigation.navigate('CreateRoom');
    }, [navigation]);

    const handleJoinRoom = useCallback(
        async (room: Room): Promise<boolean> => {
            return joinRoom(room);
        },
        [joinRoom]
    );

    const handleEnterRoom = useCallback(
        (room: Room) => {
            if (!room.hasJoined && !room.isCreator) {
                navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
            } else {
                navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
            }
        },
        [navigation]
    );

    const handleCenterOnUser = useCallback(() => {
        if (userLocation) {
            centerOn(userLocation, 14);
        }
    }, [userLocation, centerOn]);

    // ==========================================================================
    // Loading State
    // ==========================================================================

    const isLoading = isLocationLoading && !userLocation;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Finding nearby rooms...</Text>
            </View>
        );
    }

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <View style={styles.container}>
            {/* Map View */}
            <Animated.View
                style={[
                    styles.mapContainer,
                    { opacity: listOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
                ]}
                pointerEvents={viewMode === 'list' ? 'none' : 'auto'}
            >
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    mapStyle={HUDDLE_MAP_STYLE}
                    logoEnabled={false}
                    attributionEnabled={true}
                    attributionPosition={{ bottom: 8, right: 8 }}
                    onDidFinishLoadingMap={handleMapReady}
                    onRegionWillChange={handleRegionWillChange}
                    onRegionDidChange={handleRegionDidChange}
                >
                    <Camera
                        ref={cameraRef}
                        defaultSettings={{
                            centerCoordinate: centerCoord,
                            zoomLevel: zoom,
                        }}
                        minZoomLevel={1}
                        maxZoomLevel={18}
                    />

                    {/* Room Circles */}
                    {isMapReady && circlesGeoJSON.features.length > 0 && (
                        <ShapeSource id="room-circles-source" shape={circlesGeoJSON}>
                            <CircleLayer
                                id="room-circles-layer"
                                style={{
                                    circleRadius: ['get', 'radius'],
                                    circleColor: [
                                        'case',
                                        ['get', 'isExpiringSoon'],
                                        'rgba(254, 215, 170, 0.2)',
                                        'rgba(254, 205, 211, 0.2)',
                                    ],
                                    circleStrokeColor: [
                                        'case',
                                        ['get', 'isExpiringSoon'],
                                        'rgba(249, 115, 22, 0.6)',
                                        'rgba(244, 63, 94, 0.6)',
                                    ],
                                    circleStrokeWidth: 2,
                                }}
                            />
                        </ShapeSource>
                    )}

                    {/* User Location Marker */}
                    {isMapReady && userLocation && (
                        <View style={styles.userLocationMarkerContainer}>
                            <View style={styles.userLocationPulse} />
                            <View style={styles.userLocationDot} />
                        </View>
                    )}

                    {/* Room Markers and Clusters */}
                    {isMapReady &&
                        features.map((feature) => {
                            if (checkIsCluster(feature)) {
                                return (
                                    <ClusterMarker
                                        key={`cluster-${feature.properties.cluster_id}`}
                                        cluster={feature as ClusterFeature}
                                        onPress={handleClusterPress}
                                    />
                                );
                            }

                            const room = feature.properties.room;
                            return (
                                <RoomMarker
                                    key={`room-${room.id}`}
                                    room={room}
                                    isSelected={selectedRoom?.id === room.id}
                                    onPress={handleRoomPress}
                                />
                            );
                        })}
                </MapView>

                {/* Map Controls */}
                <View style={styles.mapControls}>
                    <View style={styles.zoomCard}>
                        <TouchableOpacity style={styles.zoomButton} onPress={zoomIn} activeOpacity={0.7}>
                            <Plus size={20} color="#374151" />
                        </TouchableOpacity>
                        <View style={styles.zoomDivider} />
                        <TouchableOpacity style={styles.zoomButton} onPress={zoomOut} activeOpacity={0.7}>
                            <Minus size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.controlButton, userLocation && styles.controlButtonActive]}
                        onPress={handleCenterOnUser}
                        activeOpacity={0.7}
                    >
                        <Navigation size={20} color={userLocation ? '#2563eb' : '#6b7280'} />
                    </TouchableOpacity>

                    {zoom > 3 && (
                        <TouchableOpacity style={styles.controlButton} onPress={resetToWorldView} activeOpacity={0.7}>
                            <Globe size={20} color="#f97316" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Events Counter */}
                <View style={styles.eventsCounter}>
                    <Text style={styles.eventsCounterText}>
                        {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
                    </Text>
                </View>

                {/* Empty State */}
                {activeRooms.length === 0 && !isLoadingRooms && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No rooms nearby</Text>
                        <Text style={styles.emptyText}>Be the first to start a conversation!</Text>
                        <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
                            <Text style={styles.createButtonText}>Create Room</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>

            {/* List View */}
            <Animated.View
                style={[styles.listContainer, { opacity: listOpacity }]}
                pointerEvents={viewMode === 'map' ? 'none' : 'auto'}
            >
                <RoomListView
                    rooms={activeRooms}
                    isLoading={isLoadingRooms}
                    onJoinRoom={handleJoinRoom}
                    onEnterRoom={handleEnterRoom}
                    onCreateRoom={handleCreateRoom}
                    userLocation={userLocation}
                />
            </Animated.View>

            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={openSidebar}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Menu size={24} color="#374151" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Huddle</Text>

                    <TouchableOpacity
                        style={styles.headerCreateButton}
                        onPress={handleCreateRoom}
                        activeOpacity={0.8}
                    >
                        <Plus size={20} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* View Toggle */}
            <View style={styles.viewToggleContainer}>
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('map')}
                    >
                        <MapIcon size={18} color={viewMode === 'map' ? '#ffffff' : '#6b7280'} />
                        <Text style={viewMode === 'map' ? styles.viewToggleTextActive : styles.viewToggleText}>
                            Map
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <List size={18} color={viewMode === 'list' ? '#ffffff' : '#6b7280'} />
                        <Text style={viewMode === 'list' ? styles.viewToggleTextActive : styles.viewToggleText}>
                            List
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    mapContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    map: {
        flex: 1,
    },
    listContainer: {
        ...StyleSheet.absoluteFillObject,
        paddingTop: 100,
        backgroundColor: '#f9fafb',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    hamburgerButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '600',
        color: '#1f2937',
        textAlign: 'center',
        flex: 1,
    },
    headerCreateButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f97316',
    },
    mapControls: {
        position: 'absolute',
        top: 150,
        right: 10,
        gap: 12,
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    controlButtonActive: {
        backgroundColor: '#eff6ff',
    },
    zoomCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    zoomButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomDivider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 2,
    },
    eventsCounter: {
        position: 'absolute',
        bottom: 115,
        left: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(229, 231, 235, 0.5)',
    },
    eventsCounterText: {
        fontSize: 13,
        color: '#4b5563',
        fontWeight: '500',
    },
    userLocationMarkerContainer: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userLocationDot: {
        width: 16,
        height: 16,
        backgroundColor: '#2563eb',
        borderRadius: 8,
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    userLocationPulse: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    viewToggleContainer: {
        position: 'absolute',
        bottom: 32,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    viewToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 6,
    },
    viewToggleButtonActive: {
        backgroundColor: '#f97316',
    },
    viewToggleText: {
        fontSize: 14,
        color: '#6b7280',
    },
    viewToggleTextActive: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },
    emptyState: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    createButton: {
        backgroundColor: '#f97316',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    createButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
});
