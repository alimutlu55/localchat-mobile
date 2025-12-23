/**
 * Discovery Screen
 *
 * Unified discovery screen that combines Map and List views.
 * Uses state-based view toggle for seamless switching (matching web experience).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    MapView,
    Camera,
    MarkerView,
    ShapeSource,
    CircleLayer,
    type MapViewRef,
    type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Plus, Minus, Navigation, Menu, Map as MapIcon, List, Globe } from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { Room } from '../../types';
import { ROOM_CONFIG, MAP_CONFIG } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useRooms, useSidebarRooms, useActiveRooms } from '../../context/RoomContext';
import { Sidebar } from '../../components/Sidebar';
import { ProfileDrawer } from '../../components/ProfileDrawer';
import { RoomPin } from '../../components/RoomPin';
import { MapCluster } from '../../components/MapCluster';
import { RoomListView } from '../../components/RoomListView';
import {
    createClusterIndex,
    getClustersForBounds,
    isCluster,
    getClusterExpansionZoom,
    getClusterLeaves,
    MapFeature,
    ClusterFeature,
    EventFeature
} from '../../utils/mapClustering';

// OpenFreeMap Positron style
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ViewMode = 'map' | 'list';

const { width, height } = Dimensions.get('window');

export default function DiscoveryScreen() {
    const navigation = useNavigation<NavigationProp>();
    const mapRef = useRef<MapViewRef>(null);
    const cameraRef = useRef<CameraRef>(null);

    const { user, logout } = useAuth();

    // View mode state - key to seamless switching
    const [viewMode, setViewMode] = useState<ViewMode>('map');

    // Native animated value for GPU-accelerated transitions
    const listOpacity = useRef(new Animated.Value(0)).current;

    // Animate opacity when viewMode changes
    useEffect(() => {
        Animated.timing(listOpacity, {
            toValue: viewMode === 'list' ? 1 : 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [viewMode, listOpacity]);

    // Use RoomContext for room state management
    const {
        myRooms,
        isLoadingRooms,
        fetchRooms: contextFetchRooms,
        selectedRoom,
        setSelectedRoom,
        joinRoom,
    } = useRooms();

    // Get active rooms (non-expired, non-closed)
    const activeRooms = useActiveRooms();

    // Get sidebar-specific room lists
    const sidebarRooms = useSidebarRooms();

    // Memoize joined rooms to prevent unnecessary recalculations
    const joinedRooms = useMemo(() => myRooms.filter(r => r.hasJoined || r.isCreator), [myRooms]);

    // Local UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [currentZoom, setCurrentZoom] = useState(13);
    const [bounds, setBounds] = useState<[number, number, number, number]>([-180, -85, 180, 85]);
    const [centerCoord, setCenterCoord] = useState<[number, number]>([
        MAP_CONFIG.DEFAULT_CENTER.longitude,
        MAP_CONFIG.DEFAULT_CENTER.latitude,
    ]);

    // Map movement tracking
    const [isMapMoving, setIsMapMoving] = useState(false);

    // Sidebar and profile drawer state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

    // Use activeRooms from context for clustering
    const clusterIndex = useMemo(() => createClusterIndex(activeRooms), [activeRooms]);

    // Get clusters/features for current viewport
    const features = useMemo(() => {
        return getClustersForBounds(clusterIndex, bounds, currentZoom);
    }, [clusterIndex, bounds, currentZoom]);

    // Create a single GeoJSON FeatureCollection for all room circles
    const circlesGeoJSON = useMemo(() => {
        if (!mapReady || isMapMoving || currentZoom < 10) {
            return {
                type: 'FeatureCollection' as const,
                features: [],
            };
        }

        const circleFeatures = features
            .filter((f): f is EventFeature => !isCluster(f))
            .filter(f => f.properties.room.latitude != null && f.properties.room.longitude != null)
            .map(f => {
                const room = f.properties.room;
                const [lng, lat] = f.geometry.coordinates;
                const radiusMeters = room.radius || 500;
                const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, currentZoom);
                const circleRadiusPixels = Math.max(radiusMeters / metersPerPixel, 20);

                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [lng, lat],
                    },
                    properties: {
                        id: room.id,
                        radius: circleRadiusPixels,
                        isExpiringSoon: room.isExpiringSoon || false,
                    },
                };
            });

        return {
            type: 'FeatureCollection' as const,
            features: circleFeatures,
        };
    }, [features, currentZoom, isMapMoving, mapReady]);

    /**
     * Fetch nearby rooms using context
     */
    const fetchRooms = useCallback(async (lat: number, lng: number) => {
        try {
            await contextFetchRooms(lat, lng, ROOM_CONFIG.DEFAULT_RADIUS);
        } catch (error) {
            console.error('Failed to fetch rooms:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [contextFetchRooms]);

    /**
     * Request location permissions and get current location
     */
    useEffect(() => {
        let locationSubscription: any;

        const startWatchingLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Location Permission', 'Permission needed to show nearby rooms.');
                    setIsLoading(false);
                    return;
                }

                // Get initial position
                const initialLocation = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                const coords = {
                    latitude: initialLocation.coords.latitude,
                    longitude: initialLocation.coords.longitude,
                };

                setUserLocation(coords);
                setCenterCoord([coords.longitude, coords.latitude]);

                await fetchRooms(coords.latitude, coords.longitude);

                // Start watching for changes
                locationSubscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        timeInterval: 10000,
                        distanceInterval: 50,
                    },
                    (location) => {
                        const newCoords = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        };
                        setUserLocation(newCoords);
                    }
                );
            } catch (error) {
                console.error('Location error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        startWatchingLocation();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [fetchRooms]);

    /**
     * Handle map ready
     */
    const handleMapReady = useCallback(() => {
        setMapReady(true);
    }, []);

    /**
     * Handle region change
     */
    const handleRegionDidChange = useCallback(async () => {
        if (!mapRef.current) return;

        try {
            const zoom = await mapRef.current.getZoom();
            const visibleBounds = await mapRef.current.getVisibleBounds();
            const center = await mapRef.current.getCenter();

            if (visibleBounds && visibleBounds.length === 2) {
                const [ne, sw] = visibleBounds;
                setBounds([sw[0], sw[1], ne[0], ne[1]]);
            }

            if (center) {
                setCenterCoord(center as [number, number]);
            }

            setCurrentZoom(Math.round(zoom));
            setIsMapMoving(false);
        } catch (error) {
            console.error('Error getting map state:', error);
        }
    }, []);

    /**
     * Calculate adaptive map fly animation duration
     */
    const calculateMapFlyDuration = useCallback((targetZoom: number) => {
        const zoomDiff = Math.abs(targetZoom - currentZoom);
        const duration = 0.8 + zoomDiff * 0.2;
        return Math.min(duration, 2.5) * 1000;
    }, [currentZoom]);

    /**
     * Center map on user location
     */
    const centerOnUser = useCallback(() => {
        if (!mapReady || !userLocation || !cameraRef.current) return;

        const targetZoom = 14;
        const duration = calculateMapFlyDuration(targetZoom);

        cameraRef.current.setCamera({
            centerCoordinate: [userLocation.longitude, userLocation.latitude],
            zoomLevel: targetZoom,
            animationDuration: duration,
            animationMode: 'flyTo',
        });
    }, [userLocation, mapReady, calculateMapFlyDuration]);

    /**
     * Zoom in
     */
    const handleZoomIn = useCallback(() => {
        if (!mapReady || !cameraRef.current) return;

        const newZoom = Math.min(currentZoom + 1, 18);
        cameraRef.current.setCamera({
            zoomLevel: newZoom,
            animationDuration: 200,
            animationMode: 'easeTo',
        });
    }, [currentZoom, mapReady]);

    /**
     * Zoom out
     */
    const handleZoomOut = useCallback(() => {
        if (!mapReady || !cameraRef.current) return;

        const newZoom = Math.max(currentZoom - 1, 1);
        cameraRef.current.setCamera({
            zoomLevel: newZoom,
            animationDuration: 200,
            animationMode: 'easeTo',
        });
    }, [currentZoom, mapReady]);

    /**
     * Reset to world view
     */
    const handleResetView = useCallback(() => {
        if (!mapReady || !cameraRef.current) return;
        const targetZoom = 1;
        const duration = calculateMapFlyDuration(targetZoom);

        cameraRef.current.setCamera({
            centerCoordinate: [0, 20],
            zoomLevel: targetZoom,
            animationDuration: duration,
            animationMode: 'flyTo',
        });
    }, [mapReady, calculateMapFlyDuration]);

    /**
     * Handle room marker press
     */
    const handleRoomPress = useCallback((room: Room) => {
        console.log('Huddle: [handleRoomPress] room id:', room.id);

        if (mapReady && cameraRef.current && room.latitude != null && room.longitude != null) {
            const targetZoom = Math.min(Math.max(currentZoom + 2, 14), 16);
            const zoomDiff = Math.abs(targetZoom - currentZoom);

            if (zoomDiff <= 1.5) {
                setSelectedRoom(room);
                navigation.navigate('RoomDetails', { room });
                return;
            }

            const duration = calculateMapFlyDuration(targetZoom);

            cameraRef.current.setCamera({
                centerCoordinate: [room.longitude, room.latitude],
                zoomLevel: targetZoom,
                animationDuration: duration,
                animationMode: 'flyTo',
            });

            setTimeout(() => {
                setSelectedRoom(room);
                navigation.navigate('RoomDetails', { room });
            }, duration + 150);
        } else {
            setSelectedRoom(room);
            navigation.navigate('RoomDetails', { room });
        }
    }, [navigation, setSelectedRoom, mapReady, currentZoom, calculateMapFlyDuration]);

    /**
     * Handle cluster press
     */
    const handleClusterPress = useCallback((cluster: ClusterFeature) => {
        console.log('Huddle: [handleClusterPress] cluster id:', cluster.properties.cluster_id);
        if (!mapReady || !cameraRef.current) return;

        const [lng, lat] = cluster.geometry.coordinates;
        const leaves = getClusterLeaves(clusterIndex, cluster.properties.cluster_id, Infinity);

        if (currentZoom >= 17 && leaves.length > 0) {
            const expansionZoom = getClusterExpansionZoom(clusterIndex, cluster.properties.cluster_id);
            if (expansionZoom > 18) {
                const firstRoom = leaves[0].properties.room;
                setSelectedRoom(firstRoom);
                navigation.navigate('RoomDetails', { room: firstRoom });
                return;
            }
        }

        if (leaves.length > 0) {
            let minLng = leaves[0].geometry.coordinates[0];
            let maxLng = leaves[0].geometry.coordinates[0];
            let minLat = leaves[0].geometry.coordinates[1];
            let maxLat = leaves[0].geometry.coordinates[1];

            leaves.forEach(leaf => {
                const [lLng, lLat] = leaf.geometry.coordinates;
                minLng = Math.min(minLng, lLng);
                maxLng = Math.max(maxLng, lLng);
                minLat = Math.min(minLat, lLat);
                maxLat = Math.max(maxLat, lLat);
            });

            const latPadding = Math.max((maxLat - minLat) * 0.15, 0.001);
            const lngPadding = Math.max((maxLng - minLng) * 0.15, 0.001);

            cameraRef.current.fitBounds(
                [maxLng + lngPadding, maxLat + latPadding],
                [minLng - lngPadding, minLat - latPadding],
                50,
                600  // Fast but stable
            );
        } else {
            const expansionZoom = getClusterExpansionZoom(clusterIndex, cluster.properties.cluster_id);
            const targetZoom = Math.min(Math.max(expansionZoom, currentZoom + 2), 16);

            cameraRef.current.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: targetZoom,
                animationDuration: 500,  // Fast but stable
                animationMode: 'easeTo',
            });
        }
    }, [clusterIndex, currentZoom, navigation, setSelectedRoom, mapReady]);

    /**
     * Navigate to create room
     */
    const handleCreateRoom = () => {
        navigation.navigate('CreateRoom');
    };

    /**
     * Handle join room (for list view)
     */
    const handleJoinRoom = async (room: Room): Promise<boolean> => {
        return joinRoom(room);
    };

    /**
     * Handle enter room (for list view)
     */
    const handleEnterRoom = (room: Room) => {
        navigation.navigate('ChatRoom', { room });
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Finding nearby rooms...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Map View - Always mounted to preserve camera state */}
            <Animated.View style={[
                styles.mapContainer,
                { opacity: listOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
            ]} pointerEvents={viewMode === 'list' ? 'none' : 'auto'}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    mapStyle={MAP_STYLE_URL}
                    logoEnabled={false}
                    attributionEnabled={true}
                    attributionPosition={{ bottom: 8, right: 8 }}
                    onDidFinishLoadingMap={handleMapReady}
                    onRegionWillChange={() => setIsMapMoving(true)}
                    onRegionDidChange={handleRegionDidChange}
                >
                    <Camera
                        ref={cameraRef}
                        defaultSettings={{
                            centerCoordinate: centerCoord,
                            zoomLevel: currentZoom,
                        }}
                        minZoomLevel={1}
                        maxZoomLevel={18}
                    />

                    {/* Room circles */}
                    {mapReady && circlesGeoJSON.features.length > 0 && (
                        <ShapeSource
                            id="room-circles-source"
                            shape={circlesGeoJSON}
                        >
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
                    {mapReady && userLocation && (
                        <MarkerView
                            id="user-location"
                            coordinate={[userLocation.longitude, userLocation.latitude]}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={styles.userLocationMarkerContainer}>
                                <View style={styles.userLocationPulse} />
                                <View style={styles.userLocationDot} />
                            </View>
                        </MarkerView>
                    )}

                    {/* Room Markers and Clusters */}
                    {mapReady && features.map((feature: MapFeature) => {
                        const [lng, lat] = feature.geometry.coordinates;
                        const id = isCluster(feature)
                            ? `cluster-${feature.properties.cluster_id}`
                            : `room-${feature.properties.eventId}`;

                        if (isCluster(feature)) {
                            return (
                                <MarkerView
                                    key={id}
                                    id={id}
                                    coordinate={[lng, lat]}
                                    anchor={{ x: 0.5, y: 0.5 }}
                                >
                                    <TouchableOpacity
                                        onPress={() => handleClusterPress(feature as ClusterFeature)}
                                        activeOpacity={0.8}
                                    >
                                        <MapCluster count={feature.properties.point_count} />
                                    </TouchableOpacity>
                                </MarkerView>
                            );
                        }

                        const room = feature.properties.room;
                        if (room.latitude == null || room.longitude == null) {
                            return null;
                        }

                        return (
                            <MarkerView
                                key={id}
                                id={id}
                                coordinate={[lng, lat]}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <TouchableOpacity
                                    onPress={() => handleRoomPress(room)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.pinMarkerContainer}>
                                        <RoomPin room={room} isSelected={selectedRoom?.id === room.id} />
                                    </View>
                                </TouchableOpacity>
                            </MarkerView>
                        );
                    })}
                </MapView>

                {/* Map Controls */}
                <View style={styles.mapControls}>
                    <View style={styles.zoomCard}>
                        <TouchableOpacity
                            style={styles.zoomButton}
                            onPress={handleZoomIn}
                            activeOpacity={0.7}
                        >
                            <Plus size={20} color="#374151" />
                        </TouchableOpacity>
                        <View style={styles.zoomDivider} />
                        <TouchableOpacity
                            style={styles.zoomButton}
                            onPress={handleZoomOut}
                            activeOpacity={0.7}
                        >
                            <Minus size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.controlButton,
                            userLocation && styles.controlButtonActive,
                        ]}
                        onPress={centerOnUser}
                        activeOpacity={0.7}
                    >
                        <Navigation
                            size={20}
                            color={userLocation ? '#2563eb' : '#6b7280'}
                        />
                    </TouchableOpacity>

                    {currentZoom > 5 && (
                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={handleResetView}
                            activeOpacity={0.7}
                        >
                            <Globe size={20} color="#f97316" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Events Counter */}
                <View style={styles.eventsCounter}>
                    <Text style={styles.eventsCounterText}>
                        {activeRooms.length} {activeRooms.length === 1 ? 'event' : 'events'} in view
                    </Text>
                </View>

                {/* Empty State */}
                {activeRooms.length === 0 && !isLoading && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No rooms nearby</Text>
                        <Text style={styles.emptyText}>
                            Be the first to start a conversation!
                        </Text>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={handleCreateRoom}
                        >
                            <Text style={styles.createButtonText}>Create Room</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Animated.View>

            {/* List View - Always mounted for instant switching */}
            <Animated.View style={[
                styles.listContainer,
                { opacity: listOpacity }
            ]} pointerEvents={viewMode === 'map' ? 'none' : 'auto'}>
                <RoomListView
                    rooms={activeRooms}
                    joinedRooms={joinedRooms}
                    isLoading={isLoading || isLoadingRooms}
                    onJoinRoom={handleJoinRoom}
                    onEnterRoom={handleEnterRoom}
                    onCreateRoom={handleCreateRoom}
                />
            </Animated.View>

            {/* Header - Always visible */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={() => setIsSidebarOpen(true)}
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

            {/* View Toggle - Always visible */}
            <View style={styles.viewToggleContainer}>
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('map')}
                    >
                        <MapIcon size={18} color={viewMode === 'map' ? '#ffffff' : '#6b7280'} />
                        <Text style={viewMode === 'map' ? styles.viewToggleTextActive : styles.viewToggleText}>Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <List size={18} color={viewMode === 'list' ? '#ffffff' : '#6b7280'} />
                        <Text style={viewMode === 'list' ? styles.viewToggleTextActive : styles.viewToggleText}>List</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                rooms={myRooms}
                onRoomSelect={(room) => {
                    navigation.navigate('ChatRoom', { room });
                }}
                onProfilePress={() => {
                    setIsSidebarOpen(false);
                    setIsProfileDrawerOpen(true);
                }}
            />

            {/* Profile Drawer */}
            <ProfileDrawer
                isOpen={isProfileDrawerOpen}
                onClose={() => setIsProfileDrawerOpen(false)}
                onSignOut={logout}
            />
        </View>
    );
}

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
    hidden: {
        opacity: 0,
        pointerEvents: 'none',
    },
    listContainer: {
        ...StyleSheet.absoluteFillObject,
        paddingTop: 100, // Account for header
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
    pinMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 2,
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
