/**
 * Discovery Screen (Server-Side Clustering)
 *
 * Unified discovery screen using server-side clustering for optimal performance.
 * All clustering is done on the server using PostGIS ST_ClusterDBSCAN.
 *
 * Architecture:
 * - useMapState: Map camera, bounds, zoom controls
 * - useUserLocation: User geolocation with permissions
 * - useServerClustering: Server-side clustering via API
 * - UI is purely presentational
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    MapView,
    Camera,
} from '@maplibre/maplibre-react-native';
import { Plus, Minus, Navigation, Menu, Map as MapIcon, List, Globe } from 'lucide-react-native';

// Navigation
import { RootStackParamList } from '../../../navigation/types';

// Types
import { Room, ClusterFeature } from '../../../types';

// Context
import { useUIActions } from '../../../context';

// Features
import { useJoinRoom, useMyRooms, useRoomDiscovery } from '../../rooms/hooks';

// Components
import { RoomListView, ServerRoomMarker, ServerClusterMarker } from '../components';

// Hooks
import { useMapState, useUserLocation, useServerClustering } from '../hooks';

// Styles
import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';

// Utils
import { createLogger } from '../../../shared/utils/logger';

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

    // ==========================================================================
    // Map Initialization & Smooth Transitions
    // ==========================================================================

    // Map stabilization state - prevents marker rendering until map is fully ready
    // This fixes a native crash where MapLibre tries to insert nil subviews
    const [isMapStable, setIsMapStable] = useState(false);

    // Track if initial data has loaded - prevent marker rendering during first fetch
    const [hasInitialData, setHasInitialData] = useState(false);

    // Combined flag: only render markers when BOTH map is stable AND we have data
    const canRenderMarkers = isMapStable && hasInitialData;

    // Map overlay opacity - fades out to reveal map smoothly
    const mapOverlayOpacity = useRef(new Animated.Value(1)).current;

    // Markers opacity - fade in markers after map is stable
    const markersOpacity = useRef(new Animated.Value(0)).current;

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
        hasBoundsInitialized,
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

    // Smooth map initialization sequence
    // CRITICAL: Increased delays to prevent MapLibre native crashes
    // The native layer needs time to stabilize before React adds markers
    useEffect(() => {
        if (isMapReady) {
            // Phase 1: Wait for map to stabilize internally (300ms - increased from 100ms)
            // This gives MapLibre time to finish internal setup
            const stabilizeTimer = setTimeout(() => {
                setIsMapStable(true);
                log.debug('Map stabilized, starting fade-in sequence');

                // Phase 2: Fade out the overlay to reveal the map (300ms)
                Animated.timing(mapOverlayOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start();

                // Phase 3: Fade in markers after rooms have loaded (500ms delay, 400ms fade)
                // Increased delay to ensure room fetch has completed
                setTimeout(() => {
                    Animated.timing(markersOpacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }).start();
                }, 500);
            }, 300);

            return () => clearTimeout(stabilizeTimer);
        } else {
            // Reset animations when map is not ready
            setIsMapStable(false);
            mapOverlayOpacity.setValue(1);
            markersOpacity.setValue(0);
        }
    }, [isMapReady, mapOverlayOpacity, markersOpacity]);

    // Server-side clustering - fetches pre-clustered data from backend
    // Only enable when both map is ready AND bounds have been initialized from actual viewport
    const {
        features: serverFeatures,
        isLoading: isLoadingClusters,
        metadata: clusterMetadata,
        refetch: refetchClusters,
    } = useServerClustering({
        bounds,
        zoom,
        enabled: isMapReady && hasBoundsInitialized,
        isMapReady: isMapReady && hasBoundsInitialized,
    });

    // Track when we have initial data to prevent marker rendering during first fetch
    useEffect(() => {
        if (!hasInitialData && serverFeatures.length > 0 && !isLoadingClusters) {
            // Small delay to let MapLibre stabilize after data arrives
            const timer = setTimeout(() => {
                setHasInitialData(true);
                log.debug('Initial data loaded, markers can now render', { featureCount: serverFeatures.length });
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [serverFeatures.length, isLoadingClusters, hasInitialData]);

    const { join: joinRoomHook } = useJoinRoom();
    const { activeRooms: myActiveRooms } = useMyRooms();

    // ==========================================================================
    // List View: Proximity-based room discovery with pagination
    // ==========================================================================
    const {
        rooms: discoveredRooms,
        isLoading: isDiscoveryLoading,
        isLoadingMore: isDiscoveryLoadingMore,
        hasMore: hasMoreRooms,
        loadMore: loadMoreRooms,
        refresh: refreshDiscovery,
    } = useRoomDiscovery({
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0,
        autoFetch: viewMode === 'list' && !!userLocation,
    });

    // Refresh discovery when switching to list view
    useEffect(() => {
        if (viewMode === 'list' && userLocation) {
            refreshDiscovery();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, userLocation?.latitude, userLocation?.longitude]);

    // Local state for selected room
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedFeature, setSelectedFeature] = useState<ClusterFeature | null>(null);

    // Wrapper for joinRoom to match expected signature
    const joinRoom = async (room: Room): Promise<boolean> => {
        const result = await joinRoomHook(room);
        return result.success;
    };

    // Extract rooms from server features for list view
    const activeRooms = useMemo(() => {
        return serverFeatures
            .filter(f => !f.properties.cluster && f.properties.roomId)
            .map(f => ({
                id: f.properties.roomId!,
                title: f.properties.title || '',
                category: f.properties.category as Room['category'],
                emoji: f.properties.categoryIcon || '💬',
                participantCount: f.properties.participantCount || 0,
                status: f.properties.status as Room['status'],
                latitude: f.geometry.coordinates[1],
                longitude: f.geometry.coordinates[0],
                expiresAt: f.properties.expiresAt ? new Date(f.properties.expiresAt) : new Date(),
                createdAt: new Date(),
                maxParticipants: 500,
                distance: 0,
                timeRemaining: '',
            } as Room));
    }, [serverFeatures]);

    // Total events count from server metadata
    const totalEventsInView = clusterMetadata?.totalRooms || serverFeatures.length;

    const { openSidebar } = useUIActions();

    // ==========================================================================
    // Handlers
    // ==========================================================================

    // Handle room feature press (from server clustering)
    const handleServerRoomPress = useCallback(
        (feature: ClusterFeature) => {
            const roomId = feature.properties.roomId;
            if (!roomId) return;

            log.debug('Server room pressed', { roomId });

            const [lng, lat] = feature.geometry.coordinates;

            // Create minimal room for navigation
            const room: Partial<Room> = {
                id: roomId,
                title: feature.properties.title,
                latitude: lat,
                longitude: lng,
                category: feature.properties.category as Room['category'],
            };

            setSelectedFeature(feature);
            navigation.navigate('RoomDetails', { roomId, initialRoom: room as Room });
        },
        [navigation]
    );

    // Handle cluster feature press (from server clustering)
    const handleServerClusterPress = useCallback(
        (feature: ClusterFeature) => {
            const pointCount = feature.properties.pointCount || 0;
            const expansionBounds = feature.properties.expansionBounds;

            log.debug('Server cluster pressed', {
                clusterId: feature.properties.clusterId,
                pointCount,
                currentZoom: zoom,
                hasExpansionBounds: !!expansionBounds
            });

            if (!isMapReady || !cameraRef.current) return;

            const [lng, lat] = feature.geometry.coordinates;

            /**
             * Server eps values by zoom (must match backend R2dbcRoomClusteringRepository):
             * This determines at what zoom level clusters will split.
             */
            const EPS_BY_ZOOM: Record<number, number> = {
                0: 15.0, 1: 8.0, 2: 4.0, 3: 2.0, 4: 1.0, 5: 0.5,
                6: 0.25, 7: 0.1, 8: 0.05, 9: 0.02, 10: 0.01,
                11: 0.005, 12: 0.002, 13: 0.001, 14: 0.0005,
                15: 0.0002, 16: 0.0001, 17: 0.00005, 18: 0.00002
            };

            /**
             * Calculate the optimal zoom level to split a cluster.
             * Find the lowest zoom where eps is smaller than the cluster's internal spread.
             * We want eps to be about 1/3 of bounds span to get meaningful splits.
             */
            const calcOptimalZoom = (boundsSpan: number, currentZoom: number): number => {
                if (boundsSpan <= 0) return Math.min(currentZoom + 3, 18);

                const targetEps = boundsSpan / 3;

                for (let z = currentZoom + 1; z <= 18; z++) {
                    const eps = EPS_BY_ZOOM[z] ?? 0.00001;
                    if (eps <= targetEps) {
                        return z;
                    }
                }
                return Math.min(currentZoom + 3, 18);
            };

            if (expansionBounds && expansionBounds.length === 4) {
                const [minLng, minLat, maxLng, maxLat] = expansionBounds;
                const lngSpan = maxLng - minLng;
                const latSpan = maxLat - minLat;
                const boundsSpan = Math.max(lngSpan, latSpan);

                // Calculate optimal zoom that will cause meaningful splitting
                const optimalZoom = calcOptimalZoom(boundsSpan, zoom);

                // ALWAYS progress enough to split the cluster
                // Use at least optimalZoom + 1 to guarantee eps is small enough
                // And always at least 2 zoom levels for visual feedback
                const targetZoom = Math.max(zoom + 2, optimalZoom + 1);

                // Calculate center of expansion bounds
                const centerLng = (minLng + maxLng) / 2;
                const centerLat = (minLat + maxLat) / 2;

                log.debug('Cluster expansion calculated', {
                    boundsSpan: boundsSpan.toFixed(4),
                    expansionBounds: [minLng.toFixed(4), minLat.toFixed(4), maxLng.toFixed(4), maxLat.toFixed(4)],
                    optimalZoom,
                    currentZoom: zoom,
                    targetZoom,
                    pointCount,
                });

                // Use setCamera with calculated targetZoom
                // The zoom level is chosen to ensure server eps will split the cluster
                cameraRef.current.setCamera({
                    centerCoordinate: [centerLng, centerLat],
                    zoomLevel: Math.min(targetZoom, 18),
                    animationDuration: 600,
                    animationMode: 'flyTo',
                });

                // Mark for refetch - actual fetch happens when handleRegionDidChange updates bounds
                refetchClusters();
            } else {
                // No expansion bounds - zoom in by fixed amount (more aggressive)
                const zoomIncrement = pointCount > 100 ? 4 : pointCount > 20 ? 5 : 6;
                const targetZoom = Math.min(zoom + zoomIncrement, 18);

                log.debug('No expansion bounds, zooming by increment', {
                    from: zoom,
                    to: targetZoom,
                    pointCount,
                    zoomIncrement
                });

                cameraRef.current.setCamera({
                    centerCoordinate: [lng, lat],
                    zoomLevel: targetZoom,
                    animationDuration: 600,
                    animationMode: 'flyTo',
                });

                // Mark for refetch - actual fetch happens when handleRegionDidChange updates bounds
                refetchClusters();
            }
        },
        [isMapReady, zoom, cameraRef, refetchClusters]
    );

    const handleRoomPress = useCallback(
        (room: Room) => {
            log.debug('Room pressed', { roomId: room.id });
            setSelectedRoom(room);
            navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
        },
        [navigation]
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

                    {/* User Location Marker */}
                    {canRenderMarkers && userLocation && (
                        <View style={styles.userLocationMarkerContainer}>
                            <View style={styles.userLocationPulse} />
                            <View style={styles.userLocationDot} />
                        </View>
                    )}

                    {/* Server-Side Clustered Markers - Hidden when too close for privacy (zoom > 12 ≈ < 2km altitude) */}
                    {canRenderMarkers && zoom <= 12 &&
                        serverFeatures.map((feature) => {
                            if (feature.properties.cluster) {
                                // Cluster marker
                                if (feature.properties.clusterId == null) {
                                    return null;
                                }
                                return (
                                    <ServerClusterMarker
                                        key={`server-cluster-${feature.properties.clusterId}`}
                                        feature={feature}
                                        onPress={handleServerClusterPress}
                                    />
                                );
                            }

                            // Individual room marker
                            if (!feature.properties.roomId) {
                                return null;
                            }
                            return (
                                <ServerRoomMarker
                                    key={`server-room-${feature.properties.roomId}`}
                                    feature={feature}
                                    isSelected={selectedFeature?.properties.roomId === feature.properties.roomId}
                                    onPress={handleServerRoomPress}
                                />
                            );
                        })}
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
                        <ActivityIndicator size="large" color="#f97316" />
                        <Text style={styles.mapLoadingText}>Loading map...</Text>
                    </View>
                </Animated.View>

                {/* Map Controls - Only show when map is stable */}
                <Animated.View
                    style={[
                        styles.mapControls,
                        { opacity: markersOpacity }
                    ]}
                    pointerEvents={isMapStable ? 'auto' : 'none'}
                >
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

                    {zoom > 1 && (
                        <TouchableOpacity style={styles.controlButton} onPress={resetToWorldView} activeOpacity={0.7}>
                            <Globe size={20} color="#f97316" />
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* Events Counter - Fade in with markers */}
                <Animated.View style={[styles.eventsCounter, { opacity: markersOpacity }]}>
                    <Text style={styles.eventsCounterText}>
                        {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
                    </Text>
                </Animated.View>

                {/* Empty State */}
                {serverFeatures.length === 0 && !isLoadingClusters && isMapStable && (
                    <Animated.View style={[styles.emptyState, { opacity: markersOpacity }]}>
                        <Text style={styles.emptyTitle}>No rooms nearby</Text>
                        <Text style={styles.emptyText}>Be the first to start a conversation!</Text>
                        <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
                            <Text style={styles.createButtonText}>Create Room</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>

            {/* List View */}
            <Animated.View
                style={[styles.listContainer, { opacity: listOpacity }]}
                pointerEvents={viewMode === 'map' ? 'none' : 'auto'}
            >
                <RoomListView
                    rooms={discoveredRooms}
                    isLoading={isDiscoveryLoading}
                    isLoadingMore={isDiscoveryLoadingMore}
                    hasMore={hasMoreRooms}
                    onLoadMore={loadMoreRooms}
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
    mapLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#f9fafb',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    mapLoadingContent: {
        alignItems: 'center',
        gap: 16,
    },
    mapLoadingText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
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
