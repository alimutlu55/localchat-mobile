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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import {
    CameraRef,
    MapViewRef,
} from '@maplibre/maplibre-react-native';
import { MAP_CONFIG, CATEGORIES } from '../../../constants';

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
import {
    DiscoveryHeader,
    DiscoveryMap,
    DiscoveryMapControls,
    DiscoveryViewToggle,
    DiscoveryOverlay,
    ServerRoomMarker,
    ServerClusterMarker,
    CategoryFilter
} from '../components';
import RoomListView from '../components/RoomListView';

// Hooks
import { useMapState, useUserLocation, useUnifiedDiscovery } from '../hooks';
import { useDiscoveryViewState } from '../hooks/state/useDiscoveryViewState';
import { useDiscoveryFilters } from '../hooks/state/useDiscoveryFilters';
import { useMapTransitions } from '../hooks/animations/useMapTransitions';
import { useLocationPermission, getLocationPermissionStore } from '../../../shared/stores/LocationConsentStore';

// Network - ConnectionBanner is self-contained, no imports needed here

// Styles
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
    const [showMapFilters, setShowMapFilters] = useState(false);
    const [topContainerHeight, setTopContainerHeight] = useState(100);

    const handleTopLayout = useCallback((e: any) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) {
            setTopContainerHeight(height);
        }
    }, []);

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
        // Defer hardware permission requests until map is shown to the user
        // This is part of the "Low Friction" onboarding experience and Privacy-by-Design compliance
        log.info('Discovery Screen focused, checking hardware permissions');

        const requestPermissions = async () => {
            try {
                // 1. Ad Consent
                await showConsentFormIfRequired();

                // 2. Notifications (Post-login trigger)
                const { notificationService } = await import('../../../services/notifications');
                await notificationService.requestPermissions();

                // 3. Small delay between native prompts to prevent UI overlaps
                await new Promise(resolve => setTimeout(resolve, 500));

                // 4. Location (Post-login trigger - only if not already granted)
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted') {
                    await getLocationPermissionStore().requestPermission();
                }
            } catch (err) {
                log.warn('Failed to handle hardware permissions in DiscoveryScreen', err);
            }
        };

        requestPermissions();
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
        handleRegionWillChange: baseHandleRegionWillChange,
        handleRegionDidChange,
        zoomIn,
        zoomOut,
        centerOn,
        resetToWorldView,
        animateCamera,
        calculateFlyDuration,
    } = useMapState({
        defaultCenter: userLocation || undefined,
        defaultZoom: userLocation ? MAP_CONFIG.ZOOM.INITIAL : MAP_CONFIG.ZOOM.BROWSE_MIN,
        minZoom: MAP_CONFIG.ZOOM.LIMIT_MIN,
        maxZoom: MAP_CONFIG.ZOOM.LIMIT_MAX,
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


    // =============================================================================
    // Unified Discovery Hook (Phase 2 Refactor)
    // Synchronizes Map (clusters) and List (viewport rooms) via a single provider
    // =============================================================================
    const {
        features: serverFeatures,
        viewportRooms: discoveredRooms,
        isMapLoading: isLoadingClusters,
        isListLoading: isDiscoveryLoading,
        isLoadingMore: isDiscoveryLoadingMore,
        hasMore: hasMoreRooms,
        clusterMetadata,
        totalRoomsInView,
        loadMore: loadMoreRooms,
        refetchClusters,
        refetchList: refreshDiscovery,
        prefetchForLocation,
        prefetchForWorldView,
    } = useUnifiedDiscovery({
        bounds,
        zoom,
        userLocation,
        category: categoryFilter || undefined,
        isMapReady: isMapReady && hasBoundsInitialized,
    });

    const { join } = useRoomOperations();

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

    const handleRegionWillChange = useCallback((payload: any) => {
        baseHandleRegionWillChange(payload);

        // Add prefetch if zoom changed by >1
        if (payload?.properties?.zoom != null) {
            const newZoom = payload.properties.zoom;
            const zoomDelta = Math.abs(newZoom - zoom);
            if (zoomDelta > 1) {
                const newCenter = payload.geometry?.coordinates;
                if (newCenter && Array.isArray(newCenter) && newCenter.length >= 2) {
                    const animDuration = calculateFlyDuration(newZoom);
                    prefetchForLocation(newCenter[0], newCenter[1], newZoom, animDuration);
                    log.debug('Manual zoom prefetch initiated', { newZoom, delta: zoomDelta.toFixed(2) });
                }
            }
        }
    }, [baseHandleRegionWillChange, zoom, calculateFlyDuration, prefetchForLocation]);

    const handleResetToWorldView = useCallback(() => {
        const targetZoom = MAP_CONFIG.ZOOM.WORLD_VIEW;
        const animDuration = calculateFlyDuration(targetZoom);

        prefetchForWorldView(animDuration);

        animateCamera({
            centerCoordinate: [0, 0],
            zoomLevel: targetZoom,
            animationDuration: animDuration,
            animationMode: 'flyTo',
        });
    }, [prefetchForWorldView, animateCamera]);

    const handleCenterOnUser = useCallback(() => {
        if (!userLocation) return;

        const targetZoom = MAP_CONFIG.ZOOM.INITIAL;
        const animDuration = calculateFlyDuration(targetZoom);

        prefetchForLocation(
            userLocation.longitude,
            userLocation.latitude,
            targetZoom,
            animDuration
        );

        animateCamera({
            centerCoordinate: [userLocation.longitude, userLocation.latitude],
            zoomLevel: targetZoom,
            animationDuration: animDuration,
            animationMode: 'flyTo',
        });
    }, [userLocation, calculateFlyDuration, prefetchForLocation, animateCamera]);

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
                // When at very low zoom levels (world view), allow larger jumps to ensure
                // clusters actually expand to individual rooms.
                // - At zoom 1-4: use optimalZoom directly for aggressive expansion
                // - At zoom 5+: use at least currentZoom + 2 for visual feedback
                const minProgressZoom = currentActualZoom < 5
                    ? optimalZoom  // From world view: jump directly to optimal
                    : Math.max(currentActualZoom + 2, optimalZoom);
                const targetZoom = Math.min(minProgressZoom, MAP_CONFIG.ZOOM.LIMIT_MAX);

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
                const finalTargetZoom = Math.min(targetZoom, MAP_CONFIG.ZOOM.LIMIT_MAX);
                const animDuration = calcAnimationDuration(currentActualZoom, finalTargetZoom);

                // Prefetch data - will show markers 300ms before animation ends
                prefetchForLocation(centerLng, centerLat, finalTargetZoom, animDuration);

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
                const targetZoom = Math.min(currentActualZoom + zoomIncrement, MAP_CONFIG.ZOOM.LIMIT_MAX);

                log.debug('No expansion bounds, zooming by increment', {
                    from: currentActualZoom,
                    to: targetZoom,
                    pointCount,
                    zoomIncrement
                });

                const animDuration = calcAnimationDuration(currentActualZoom, targetZoom);

                // Prefetch data - will show markers 300ms before animation ends
                prefetchForLocation(lng, lat, targetZoom, animDuration);

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
                        <DiscoveryMap
                            mapRef={mapRef}
                            cameraRef={cameraRef}
                            centerCoord={centerCoord}
                            zoom={zoom}
                            onMapReady={handleMapReady}
                            onRegionWillChange={handleRegionWillChange}
                            onRegionDidChange={handleRegionDidChange}
                            userLocation={userLocation}
                            isMapStable={isMapStable}
                            canRenderMarkers={canRenderMarkers}
                            serverFeatures={serverFeatures}
                            selectedFeature={selectedFeature}
                            onServerClusterPress={handleServerClusterPress}
                            onServerRoomPress={handleServerRoomPress}
                            onMarkerDeselect={handleMarkerDeselect}
                            mapOverlayOpacity={mapOverlayOpacity}
                            markersOpacity={markersOpacity}
                        />
                    )}

                    {/* Map Controls - Only show when map is stable */}
                    <DiscoveryMapControls
                        zoom={zoom}
                        markersOpacity={markersOpacity}
                        isMapStable={isMapStable}
                        hasLocationPermission={hasLocationPermission}
                        userLocation={userLocation}
                        zoomIn={zoomIn}
                        zoomOut={zoomOut}
                        onCenterOnUser={handleCenterOnUser}
                        onResetToWorldView={handleResetToWorldView}
                        topOffset={topContainerHeight}
                    />

                    {/* Overlay (Counter & Empty State) */}
                    <DiscoveryOverlay
                        markersOpacity={markersOpacity}
                        totalEventsInView={totalRoomsInView}
                        serverFeaturesCount={serverFeatures.length}
                        isLoadingClusters={isLoadingClusters}
                        isMapStable={isMapStable}
                        isUserInView={isUserInView}
                        isMapMoving={isMapMoving}
                        onCreateRoom={handleCreateRoom}
                        zoom={zoom}
                        topOffset={topContainerHeight}
                    />
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
                        mode={viewMode}
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

            {/* Top UI Area (Header + Conditional Filters) */}
            <View style={styles.topContainer} onLayout={handleTopLayout}>
                <DiscoveryHeader
                    onOpenSidebar={openSidebar}
                    onCreateRoom={handleCreateRoom}
                    onToggleFilters={() => setShowMapFilters(!showMapFilters)}
                    isFilterActive={showMapFilters}
                    viewMode={viewMode}
                />

                {/* Map-Specific Category Filter Bar */}
                {viewMode === 'map' && showMapFilters && (
                    <Animated.View
                        style={[
                            styles.filterBar,
                            { opacity: listOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
                        ]}
                    >
                        <CategoryFilter />
                    </Animated.View>
                )}
            </View>

            {/* View Toggle */}
            <DiscoveryViewToggle
                viewMode={viewMode}
                onSetViewMode={setViewMode}
            />
        </View>
    );
}

