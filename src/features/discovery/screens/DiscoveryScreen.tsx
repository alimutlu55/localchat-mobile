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
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Alert,
    Linking,
    InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    MapView,
    Camera,
} from '@maplibre/maplibre-react-native';
import { MAP_CONFIG, CATEGORIES } from '../../../constants';
import { Plus, Minus, Navigation, Menu, Map as MapIcon, List, Globe } from 'lucide-react-native';

// Navigation
import { RootStackParamList } from '../../../navigation/types';

// Types
import { Room, ClusterFeature, RoomCategory, serializeRoom, SerializedRoom } from '../../../types';

// Context
import { useUIActions } from '../../../context';

// Features
import { useAuth } from '../../auth/hooks/useAuth';
import { useRoomOperations, useMyRooms, useRoomStore, selectSelectedCategory } from '../../rooms';

// Components
import { ConnectionBanner } from '../../../components/chat/ConnectionBanner';
import { ServerRoomMarker, ServerClusterMarker } from '../components';
import { MapViewLocation } from '../map/MapViewLocation';
import RoomListView from '../components/RoomListView';

// Hooks
import { useMapState, useUserLocation, useServerClustering, useViewportRooms } from '../hooks';
import { useDiscoveryViewState } from '../hooks/state/useDiscoveryViewState';
import { useDiscoveryFilters } from '../hooks/state/useDiscoveryFilters';
import { useMapTransitions } from '../hooks/animations/useMapTransitions';
import { useLocationPermission, getLocationPermissionStore } from '../../../shared/stores/LocationConsentStore';

// Network - ConnectionBanner is self-contained, no imports needed here

// Styles
import { theme } from '../../../core/theme';
import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';
import { styles } from './DiscoveryScreen.styles';

// Ads
import { AdBanner, useInterstitialAd, useAds } from '../../ads';

// Utils
import { createLogger } from '../../../shared/utils/logger';
import { calcOptimalZoomForCluster, calcAnimationDuration as calcClusterAnimationDuration } from '../../../utils/clustering';

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

    // View mode state (decomposed hook)
    const {
        mode: viewMode,
        setMode: setViewMode,
        isTransitioning: isViewTransitioning,
        shouldRenderMap,
        listOpacity,
    } = useDiscoveryViewState({ initialMode: 'map' });

    const insets = useSafeAreaInsets();

    // ==========================================================================
    // Auth Status & Logout Protection
    // ==========================================================================

    const { status: authStatus } = useAuth();

    // Trigger early preloading of interstitial ads
    useInterstitialAd();

    // Preload interstitial ad so it's ready when user joins a room
    // This ensures the ad is loaded before they navigate to RoomDetails
    const { showAd: showInterstitialAd } = useInterstitialAd();

    // Global Filter State
    const selectedCategory = useRoomStore(selectSelectedCategory);

    // Convert 'All' to undefined for the API
    // AND convert Label to ID because API expects ID (e.g. "LOST_FOUND") not Label ("Lost & Found")
    const categoryConfig = CATEGORIES.find(c => c.label === selectedCategory);
    const categoryFilter = selectedCategory === 'All' ? undefined : (categoryConfig?.id || selectedCategory);

    // Track logout state synchronously to hide markers before unmounting
    // Prevents Fabric view recycling crash during navigation transitions
    const isLoggingOutRef = useRef(false);
    if (authStatus === 'loggingOut' && !isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
    } else if (authStatus !== 'loggingOut' && isLoggingOutRef.current) {
        isLoggingOutRef.current = false;
    }

    // ==========================================================================
    // Ad Consent Flow (Sequential)
    // ==========================================================================
    const { showConsentFormIfRequired } = useAds();

    useEffect(() => {
        // Defer ad consent form until map is shown to the user
        // This is part of the "Low Friction" onboarding experience
        log.info('Discovery Screen focused, checking if ad consent form is required');
        showConsentFormIfRequired();
    }, [showConsentFormIfRequired]);

    // ==========================================================================
    // Map Initialization & Smooth Transitions (decomposed hook)
    // ==========================================================================

    // NOTE: Using useMapTransitions hook for stabilization and animations
    // We receive isMapReady from useMapState below, so we initialize transitions
    // after useMapState is called. This is done by passing isMapReady as a param.


    // ==========================================================================
    // Hooks
    // ==========================================================================

    // User Location
    const { location: userLocation, isLoading: isLocationLoading, permissionDenied, refresh: refreshLocation } = useUserLocation();

    // Location permission from OS (reactive via store)
    const { isGranted: hasLocationPermission, checkPermission } = useLocationPermission();


    // Map State
    const {
        mapRef,
        cameraRef,
        zoom,
        bounds,
        centerCoord,
        isMapReady,
        hasBoundsInitialized,
        isMapMoving,
        handleMapReady,
        handleRegionWillChange,
        handleRegionDidChange,
        zoomIn,
        zoomOut,
        centerOn,
        resetToWorldView,
        animateCamera,
        calculateFlyDuration,
    } = useMapState({
        defaultCenter: userLocation || undefined,
        defaultZoom: userLocation ? 12 : 1,
        minZoom: 1,
        maxZoom: 12,
    });

    // Refresh location when screen comes into focus (e.g. back from permission screen)
    useFocusEffect(
        useCallback(() => {
            refreshLocation();
        }, [refreshLocation])
    );

    // Auto-center on user when location becomes available
    // This handles the "enable location -> auto zoom to user" flow
    const prevLocationRef = useRef(userLocation);
    useEffect(() => {
        if (!prevLocationRef.current && userLocation) {
            log.debug('Location became available, auto-centering');
            centerOn(userLocation);
        }
        prevLocationRef.current = userLocation;
    }, [userLocation, centerOn]);

    // NOTE: User location pulse animation is now handled internally by MapViewLocation component

    // Zoom ref to avoid stale closures in press handlers
    const zoomRef = useRef(zoom);
    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);


    // Map transitions (decomposed hook) - provides stabilization and animation values
    const {
        isMapStable,
        hasInitialData,
        canRenderMarkers: baseCanRenderMarkers,
        overlayOpacity: mapOverlayOpacity,
        markersOpacity,
        setDataLoaded,
    } = useMapTransitions({ isMapReady });

    // CRITICAL: Add auth logout guard to marker rendering
    // Prevents Fabric view recycling crash during navigation transitions
    const canRenderMarkers = baseCanRenderMarkers && authStatus !== 'loggingOut' && !isLoggingOutRef.current;


    const {
        features: serverFeatures,
        isLoading: isLoadingClusters,
        metadata: clusterMetadata,
        prefetchForLocation,
        prefetchForWorldView,
    } = useServerClustering({
        bounds,
        zoom,
        enabled: isMapReady && hasBoundsInitialized,
        isMapReady: isMapReady && hasBoundsInitialized,
        category: undefined, // Filter only applies to List view (not map)
        userLocation, // For visibility filtering - nearby rooms only visible within radius
    });
    // ConnectionBanner is now self-contained - no manual state needed here

    // Track when we have initial data (even if empty) to reveal markers
    useEffect(() => {
        if (!hasInitialData && !isLoadingClusters && isMapStable) {
            // We have initial data if loading finished, regardless of feature count
            const timer = setTimeout(() => {
                setDataLoaded();
                log.debug('Initial data sync complete', { featureCount: serverFeatures.length });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isLoadingClusters, hasInitialData, isMapStable, serverFeatures.length, setDataLoaded]);

    const { join } = useRoomOperations();

    // ==========================================================================
    // List View: Viewport-synchronized room discovery with pagination
    // Uses the same viewport as the map for consistent view synchronization
    // ==========================================================================
    const {
        rooms: discoveredRooms,
        isLoading: isDiscoveryLoading,
        isLoadingMore: isDiscoveryLoadingMore,
        hasMore: hasMoreRooms,
        loadMore: loadMoreRooms,
        refetch: refreshDiscovery,
        prefetch: prefetchListRooms,
    } = useViewportRooms({
        bounds: bounds as [number, number, number, number],
        userLocation: userLocation ?? undefined,
        zoom, // Pass current zoom to detect cluster merges/splits
        category: categoryFilter as RoomCategory | undefined,
        enabled: isMapReady && hasBoundsInitialized, // Sync active regardless of view mode
        pageSize: 20,
    });


    // Check if user's location is currently within map bounds
    const isUserInView = useMemo(() => {
        if (!userLocation || !bounds || bounds.length !== 4) return false;
        const [minLng, minLat, maxLng, maxLat] = bounds;
        return (
            userLocation.longitude >= minLng &&
            userLocation.longitude <= maxLng &&
            userLocation.latitude >= minLat &&
            userLocation.latitude <= maxLat
        );
    }, [userLocation, bounds]);

    const [selectedFeature, setSelectedFeature] = useState<ClusterFeature | null>(null);

    // Handle marker deselection (user tapped elsewhere on map)
    const handleMarkerDeselect = useCallback(() => {
        setSelectedFeature(null);
    }, []);

    // Wrapper for joinRoom to match expected signature
    // NOTE: Interstitial ads are NOT shown here because this path is called from
    // RoomListView which has a confirmation Modal. iOS cannot present two modals
    // at once. Interstitials are only shown from RoomDetailsScreen path.
    const joinRoom = async (room: Room): Promise<boolean> => {
        // Use user location if available, otherwise fallback to map center
        const effectiveLocation = userLocation || {
            latitude: centerCoord[1],
            longitude: centerCoord[0]
        };

        if (userLocation) {
            log.info('Joining room using precise user location', { roomId: room.id });
        } else {
            log.info('Joining room using map center fallback', { roomId: room.id, lat: effectiveLocation.latitude, lng: effectiveLocation.longitude });
        }

        const result = await join(room, effectiveLocation);
        return result.success;
    };


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

            // Navigate to room details (pass partial room with expiresAt as string)
            const partialSerializedRoom: Partial<SerializedRoom> = {
                id: roomId,
                title: feature.properties.title,
                latitude: lat,
                longitude: lng,
                category: feature.properties.category as Room['category'],
                isCreator: feature.properties.isCreator,
                hasJoined: feature.properties.hasJoined,
                expiresAt: feature.properties.expiresAt || new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            // IMPORTANT: Set selection first so MapLibre receives selected=true
            setSelectedFeature(feature);

            // Navigate to room details
            navigation.navigate('RoomDetails', { roomId, initialRoom: partialSerializedRoom as SerializedRoom });

            // Clear selection after a short delay while screen is transitioning away
            // This resets MapLibre's internal PointAnnotation state (selected=false)
            // so the marker can be clicked again when returning.
            // 100ms delay ensures MapLibre has processed the selected=true first.
            setTimeout(() => {
                setSelectedFeature(null);
            }, 100);
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
             * Calculate smooth animation duration based on zoom delta.
             * Larger zoom changes get longer durations for a smooth "fly in" effect.
             */
            const calcAnimationDuration = (fromZoom: number, toZoom: number): number => {
                const zoomDelta = Math.abs(toZoom - fromZoom);
                return calcClusterAnimationDuration(zoomDelta);
            };

            if (expansionBounds && expansionBounds.length === 4) {
                const [minLng, minLat, maxLng, maxLat] = expansionBounds;
                const lngSpan = maxLng - minLng;
                const latSpan = maxLat - minLat;
                const boundsSpan = Math.max(lngSpan, latSpan);

                // Use the latest zoom from ref to avoid stale closure issues
                const currentActualZoom = zoomRef.current;

                // Calculate optimal zoom that will cause meaningful splitting
                const optimalZoom = calcOptimalZoomForCluster(boundsSpan, currentActualZoom);

                // ALWAYS progress enough to split the cluster
                // Use at least optimalZoom + 1 to guarantee eps is small enough
                // And always at least 2 zoom levels for visual feedback
                const targetZoom = Math.min(Math.max(currentActualZoom + 2, optimalZoom + 1), 12);

                // Calculate center of expansion bounds
                const centerLng = (minLng + maxLng) / 2;
                const centerLat = (minLat + maxLat) / 2;

                log.debug('Cluster expansion calculated', {
                    boundsSpan: boundsSpan.toFixed(4),
                    expansionBounds: [minLng.toFixed(4), minLat.toFixed(4), maxLng.toFixed(4), maxLat.toFixed(4)],
                    optimalZoom,
                    currentZoom: currentActualZoom,
                    targetZoom,
                    pointCount,
                });

                // Use setCamera with calculated targetZoom
                // The zoom level is chosen to ensure server eps will split the cluster
                const finalTargetZoom = Math.min(targetZoom, 12);
                const animDuration = calcAnimationDuration(currentActualZoom, finalTargetZoom);

                // Prefetch data - will show markers 300ms before animation ends
                prefetchForLocation(centerLng, centerLat, finalTargetZoom, animDuration);
                prefetchListRooms(centerLng, centerLat, finalTargetZoom, animDuration);

                animateCamera({
                    centerCoordinate: [centerLng, centerLat],
                    zoomLevel: finalTargetZoom,
                    animationDuration: animDuration,
                    animationMode: 'flyTo',
                });
            } else {
                // No expansion bounds - zoom in by fixed amount (more aggressive)
                const currentActualZoom = zoomRef.current;
                const zoomIncrement = pointCount > 100 ? 4 : pointCount > 20 ? 5 : 6;
                const targetZoom = Math.min(currentActualZoom + zoomIncrement, 12);

                log.debug('No expansion bounds, zooming by increment', {
                    from: currentActualZoom,
                    to: targetZoom,
                    pointCount,
                    zoomIncrement
                });

                const animDuration = calcAnimationDuration(currentActualZoom, targetZoom);

                // Prefetch data - will show markers 300ms before animation ends
                prefetchForLocation(lng, lat, targetZoom, animDuration);
                prefetchListRooms(lng, lat, targetZoom, animDuration);

                animateCamera({
                    centerCoordinate: [lng, lat],
                    zoomLevel: targetZoom,
                    animationDuration: animDuration,
                    animationMode: 'flyTo',
                });
            }
        },
        [isMapReady, animateCamera, prefetchForLocation]
    );


    const handleCreateRoom = useCallback(async () => {
        // Check if we already have permission
        let hasPermission = await checkPermission();

        if (!hasPermission) {
            // Request OS permission directly (shows system dialog)
            hasPermission = await getLocationPermissionStore().requestPermission();
        }

        if (!hasPermission) {
            // Permission denied - show alert with settings option
            Alert.alert(
                'Location Required',
                'BubbleUp needs location access to create rooms near you. Please enable it in Settings.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open Settings',
                        onPress: () => Linking.openSettings()
                    }
                ]
            );
            return;
        }

        // Permission granted - proceed to create room
        navigation.navigate('CreateRoom', {
            initialLocation: userLocation || {
                latitude: centerCoord[1],
                longitude: centerCoord[0]
            }
        });
    }, [navigation, userLocation, centerCoord, checkPermission]);

    const handleJoinRoom = useCallback(
        async (room: Room): Promise<boolean> => {
            return joinRoom(room);
        },
        [joinRoom]
    );

    const handleEnterRoom = useCallback(
        (room: Room) => {
            const serializedRoom = serializeRoom(room);
            if (!room.hasJoined && !room.isCreator) {
                navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: serializedRoom });
            } else {
                navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: serializedRoom });
            }
        },
        [navigation]
    );

    const handleCenterOnUser = useCallback(() => {
        if (userLocation) {
            const targetZoom = MAP_CONFIG.DEFAULT_ZOOM;
            const animDuration = calculateFlyDuration(targetZoom);

            // Prefetch data - will show markers 300ms before animation ends
            prefetchForLocation(userLocation.longitude, userLocation.latitude, targetZoom, animDuration);
            prefetchListRooms(userLocation.longitude, userLocation.latitude, targetZoom, animDuration);

            centerOn(userLocation, targetZoom);
        }
    }, [userLocation, centerOn, calculateFlyDuration, prefetchForLocation]);

    // ==========================================================================
    // Loading State
    // ==========================================================================

    const isLoading = isLocationLoading && !userLocation;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6410" />
                <Text style={styles.loadingText}>Finding nearby rooms...</Text>
            </View>
        );
    }

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <View style={styles.container}>
            {/* Content Area (Map/List) */}
            <View style={{ flex: 1 }}>
                {/* Map View - Hidden during logout to prevent Fabric crashes */}
                <Animated.View
                    style={[
                        styles.mapContainer,
                        {
                            opacity: listOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                            ...(authStatus === 'loggingOut' && { opacity: 0 })
                        },
                    ]}
                    pointerEvents={viewMode === 'list' || authStatus === 'loggingOut' ? 'none' : 'auto'}
                >
                    {shouldRenderMap && (
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
                            {canRenderMarkers && serverFeatures
                                .filter(f => f.properties.cluster ? f.properties.clusterId != null : !!f.properties.roomId)
                                .map((feature) => {
                                    if (feature.properties.cluster) {
                                        return (
                                            <ServerClusterMarker
                                                key={`server-cluster-${feature.properties.clusterId}`}
                                                feature={feature}
                                                onPress={handleServerClusterPress}
                                                onDeselect={handleMarkerDeselect}
                                            />
                                        );
                                    }
                                    return (
                                        <ServerRoomMarker
                                            key={`server-room-${feature.properties.roomId}`}
                                            feature={feature}
                                            isSelected={selectedFeature?.properties.roomId === feature.properties.roomId}
                                            onPress={handleServerRoomPress}
                                            onDeselect={handleMarkerDeselect}
                                        />
                                    );
                                })}
                        </MapView>
                    )}

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

                        {hasLocationPermission && (
                            <TouchableOpacity
                                style={[styles.controlButton, userLocation && styles.controlButtonActive]}
                                onPress={handleCenterOnUser}
                                activeOpacity={0.7}
                            >
                                <Navigation size={20} color={userLocation ? '#2563eb' : '#6b7280'} />
                            </TouchableOpacity>
                        )}

                        {zoom > 1 && (
                            <TouchableOpacity
                                style={styles.controlButton}
                                onPress={() => {
                                    const animDuration = calculateFlyDuration(1);
                                    prefetchForWorldView(animDuration);
                                    prefetchListRooms(0, 0, 1, animDuration); // Global prefetch for list
                                    resetToWorldView();
                                }}
                                activeOpacity={0.7}
                            >
                                <Globe size={20} color="#FF6410" />
                            </TouchableOpacity>
                        )}
                    </Animated.View>

                    {/* Events Counter - Fade in with markers */}
                    <Animated.View style={[styles.eventsCounter, { opacity: markersOpacity }]}>
                        <Text style={styles.eventsCounterText}>
                            {totalEventsInView} {totalEventsInView === 1 ? 'event' : 'events'} in view
                        </Text>
                    </Animated.View>

                    {/* Empty State - Only show if looking at user's area, it's empty, and map is NOT moving */}
                    {serverFeatures.length === 0 && !isLoadingClusters && isMapStable && isUserInView && !isMapMoving && (
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
            </View>

            {/* Ad Banner - Footer placement respects Safe Area and has dedicated space */}
            <View style={[
                styles.adBannerContainer,
                { paddingBottom: insets.bottom }
            ]}>
                <AdBanner transparent={false} />
            </View>

            {/* Header with Connection Banner on top */}
            <SafeAreaView style={styles.header} edges={['top']}>
                {/* Self-contained banner - reads from NetworkStore, handles retries internally */}
                <ConnectionBanner />
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={openSidebar}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Menu size={24} color="#374151" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>BubbleUp</Text>

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
            <View style={styles.viewToggleContainer} pointerEvents="box-none">
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'map' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('map')}
                    >
                        <MapIcon size={18} color={viewMode === 'map' ? '#ffffff' : '#6b7280'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <List size={18} color={viewMode === 'list' ? '#ffffff' : '#6b7280'} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

