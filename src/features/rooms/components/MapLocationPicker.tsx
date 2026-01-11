/**
 * MapLocationPicker Component
 *
 * Full-screen modal for selecting a custom room location by placing a pin on the map.
 * Features:
 * - Draggable pin indicator (Uber-style)
 * - Crosshairs for precise placement
 * - Current location button
 * - Address preview (geocoded)
 * - Confirm/Cancel actions
 */

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, Camera, MapViewRef, CameraRef, ShapeSource, CircleLayer, FillLayer, LineLayer } from '@maplibre/maplibre-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, Plus, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat } from 'react-native-reanimated';

import { theme, useTheme } from '../../../core/theme';

import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';
import { createLogger } from '../../../shared/utils/logger';
import { MapViewLocation } from '../../discovery/map/MapViewLocation';
import { MAP_CONFIG } from '../../../constants';

const log = createLogger('MapLocationPicker');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Max distance in meters user can select from their GPS location
const MAX_SELECTION_DISTANCE_METERS = 5000;
const ROOM_COVERAGE_RADIUS_METERS = 1000;

// =============================================================================
// Geodetic Constants - Using spherical Earth model for consistency
// =============================================================================
const EARTH_RADIUS_METERS = 6371008.8; // Mean Earth radius (IUGG)

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
function calculateDistanceMeters(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate destination point given start point, bearing, and distance
 * Uses spherical Earth model - inverse of Haversine
 * @param lat Starting latitude in degrees
 * @param lon Starting longitude in degrees  
 * @param bearing Bearing in degrees (0 = North, 90 = East)


/**
 * Calculate destination point from start point, bearing, and distance
 * @param lat Starting latitude in degrees
 * @param lon Starting longitude in degrees  
 * @param bearing Bearing in degrees (0 = North, 90 = East)
 * @param distance Distance in meters
 * @returns Destination {lat, lon} in degrees
 */
function destinationPoint(
    lat: number,
    lon: number,
    bearing: number,
    distance: number
): { lat: number; lon: number } {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const phi1 = toRad(lat);
    const lambda1 = toRad(lon);
    const theta = toRad(bearing);
    const delta = distance / EARTH_RADIUS_METERS; // Angular distance

    const sinPhi1 = Math.sin(phi1);
    const cosPhi1 = Math.cos(phi1);
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);

    const sinPhi2 = sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta);
    const phi2 = Math.asin(sinPhi2);
    const lambda2 = lambda1 + Math.atan2(
        Math.sin(theta) * sinDelta * cosPhi1,
        cosDelta - sinPhi1 * sinPhi2
    );

    return {
        lat: toDeg(phi2),
        lon: toDeg(lambda2)
    };
}

/**
 * Generate a GeoJSON Polygon representing a grid cell for a given coordinate.
 * Matches the 0.01 degree grid used for privacy snapping.
 */
function generateGridCellPolygon(longitude: number, latitude: number): any {
    const resolution = 0.01;
    const minLng = Math.floor(longitude / resolution) * resolution;
    const maxLng = minLng + resolution;
    const minLat = Math.floor(latitude / resolution) * resolution;
    const maxLat = minLat + resolution;

    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat]
            ]],
        },
        properties: {},
    };
}

/**
 * Generate a GeoJSON Polygon representing a circle at a specific location
 */
function generateCirclePolygon(center: [number, number], radiusInMeters: number, pointsCount: number = 128): any {
    const coords = [];
    const lng = center[0];
    const lat = center[1];

    for (let i = 0; i <= pointsCount; i++) {
        const bearing = (i / pointsCount) * 360;
        const point = destinationPoint(lat, lng, bearing, radiusInMeters);
        coords.push([point.lon, point.lat]);
    }

    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [coords],
        },
        properties: {},
    };
}

// =============================================================================
// Types
// =============================================================================

export interface LocationCoordinate {
    latitude: number;
    longitude: number;
}

export interface MapLocationPickerProps {
    /** Whether the picker modal is visible */
    visible: boolean;
    /** Initial center location */
    initialLocation: LocationCoordinate | null;
    /** User's GPS location (for "My Location" button) */
    userLocation: LocationCoordinate | null;
    /** Callback when location is confirmed */
    onConfirm: (location: LocationCoordinate) => void;
    /** Callback when picker is cancelled */
    onCancel: () => void;
    /** Optional radius in meters to display */
    radiusMeters?: number;
}

// =============================================================================
// Component
// =============================================================================

export function MapLocationPicker({
    visible,
    initialLocation,
    userLocation,
    onConfirm,
    onCancel,
    radiusMeters,
}: MapLocationPickerProps) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapViewRef>(null);
    const cameraRef = useRef<CameraRef>(null);

    // State
    const [isMapReady, setIsMapReady] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationCoordinate | null>(
        initialLocation
    );
    const [centerCoord, setCenterCoord] = useState<[number, number]>(() => {
        if (initialLocation) {
            return [initialLocation.longitude, initialLocation.latitude];
        }
        return [0, 20]; // World view fallback
    });
    const [distanceFromGps, setDistanceFromGps] = useState<number>(0);
    const [currentZoom, setCurrentZoom] = useState(MAP_CONFIG.ZOOM.LIMIT_MAX);
    const [headerHeight, setHeaderHeight] = useState(100);

    const handleHeaderLayout = useCallback((e: any) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) {
            setHeaderHeight(height);
        }
    }, []);

    // Computed: is selected location within allowed range
    // Add 5m tolerance for floating point precision at the boundary
    const PRECISION_TOLERANCE_METERS = 5;
    const isWithinRange = distanceFromGps <= MAX_SELECTION_DISTANCE_METERS + PRECISION_TOLERANCE_METERS;
    const canConfirm = selectedLocation && isWithinRange;

    // Memoized boundary polygon to avoid re-generating on every frame
    const boundaryPolygon = useMemo(() => {
        if (!userLocation) return null;
        return generateCirclePolygon(
            [userLocation.longitude, userLocation.latitude],
            MAX_SELECTION_DISTANCE_METERS
        );
    }, [userLocation]);

    const bottomSheetTranslateY = useSharedValue(200);
    const rangeValue = useSharedValue(1); // 1 = in range, 0 = out of range
    const breathingValue = useSharedValue(1); // For idle pulse animation

    // Update range animation when state changes
    useEffect(() => {
        rangeValue.value = withTiming(isWithinRange ? 1 : 0, { duration: 300 });
    }, [isWithinRange, rangeValue]);

    const bottomSheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bottomSheetTranslateY.value }]
    }));

    // Dynamic scaling for the Hero Aura (RN View on top of map)
    const heroAuraAnimatedStyle = useAnimatedStyle(() => {
        // Meters to pixels conversion at zoom 12 is approx 38.2m/px at equator.
        // We use a base size of 80px at zoom 12 (approx 3km diameter) 
        // and scale exponentially with zoom.
        const baseSizeAtZoom12 = 80;
        const scale = Math.pow(2, currentZoom - 12);
        const size = baseSizeAtZoom12 * scale;

        return {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [
                { translateX: -size / 2 },
                { translateY: -size / 2 },
            ],
            opacity: visible ? 1 : 0,
        };
    }, [currentZoom, visible]);

    // Breathing Animation Loop (Now targets the Pulse Ring only)
    useEffect(() => {
        if (!isMoving && visible) {
            breathingValue.value = withRepeat(
                withTiming(1.4, { duration: 2000 }), // Increased to 1.4x for "visible" breathing
                -1,
                true // reverse
            );
        } else {
            breathingValue.value = withTiming(1, { duration: 300 });
        }
    }, [isMoving, visible]);

    // Dedicated style for Pulse Ring to avoid transform conflicts
    const pulseRingAnimatedStyle = useAnimatedStyle(() => {
        // Calculate size based on zoom (same logic as heroAura)
        const metersPerPixel = (156543.03392 * Math.cos(centerCoord[1] * Math.PI / 180)) / Math.pow(2, currentZoom);
        const radiusPixels = ROOM_COVERAGE_RADIUS_METERS / metersPerPixel;
        const size = radiusPixels * 2;

        return {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [
                { translateX: -size / 2 },
                { translateY: -size / 2 },
                { scale: breathingValue.value } // Include scale here combined with centering
            ],
            opacity: visible ? 1 : 0,
        };
    }, [currentZoom, visible, breathingValue, centerCoord]);


    // Reset state when modal opens
    useEffect(() => {
        if (visible && initialLocation) {
            // Initial snap for consistency
            const resolution = 0.01;
            const snappedLng = Math.floor(initialLocation.longitude / resolution) * resolution + (resolution / 2);
            const snappedLat = Math.floor(initialLocation.latitude / resolution) * resolution + (resolution / 2);

            const snappedLocation = { latitude: snappedLat, longitude: snappedLng };
            setSelectedLocation(snappedLocation);
            setCenterCoord([snappedLng, snappedLat]);
            setDistanceFromGps(0);

            // Animate bottom sheet in
            bottomSheetTranslateY.value = withTiming(0, { duration: 400 });

            // Animate to location after a brief delay for map to be ready
            setTimeout(() => {
                if (cameraRef.current && initialLocation) {
                    cameraRef.current.setCamera({
                        centerCoordinate: [initialLocation.longitude, initialLocation.latitude],
                        zoomLevel: MAP_CONFIG.ZOOM.LIMIT_MAX,
                        animationDuration: 0,
                    });
                }
            }, 100);
        } else if (!visible) {
            bottomSheetTranslateY.value = 200;
        }
    }, [visible, initialLocation, bottomSheetTranslateY]);

    // ==========================================================================
    // Handlers
    // ==========================================================================

    const handleMapReady = useCallback(() => {
        log.debug('Map picker ready');
        setIsMapReady(true);
    }, []);

    const handleRegionWillChange = useCallback(() => {
        setIsMoving(true);
    }, []);

    const lastUpdateRef = useRef(0);
    const handleRegionIsChanging = useCallback((feature: any) => {
        if (!feature?.geometry?.coordinates) return;

        const now = Date.now();
        if (now - lastUpdateRef.current < 16) return; // Limit to ~60fps
        lastUpdateRef.current = now;

        const [lng, lat] = feature.geometry.coordinates;
        setSelectedLocation({ latitude: lat, longitude: lng });
        setCenterCoord([lng, lat]);

        if (userLocation) {
            const distance = calculateDistanceMeters(
                userLocation.latitude, userLocation.longitude,
                lat, lng
            );
            setDistanceFromGps(distance);

            // Magnetic Haptics: Subtle tick when crossing 80% and 95% of range
            const rangeRatio = distance / MAX_SELECTION_DISTANCE_METERS;
            if (rangeRatio > 0.8 && rangeRatio < 0.85) {
                // Haptics.selectionAsync(); // Prevent spamming, need state tracker
            }
        }

        // Update zoom if provided in feature properties
        if (feature.properties?.zoomLevel !== undefined) {
            setCurrentZoom(feature.properties.zoomLevel);
        }
    }, [userLocation]);

    const handleRegionDidChange = useCallback(async (feature: any) => {
        if (!mapRef.current || !cameraRef.current) return;

        try {
            const zoom = await mapRef.current.getZoom();
            setCurrentZoom(zoom);

            if (feature?.geometry?.coordinates) {
                const [lng, lat] = feature.geometry.coordinates;

                setSelectedLocation({ latitude: lat, longitude: lng });
                setCenterCoord([lng, lat]);

                // Haptic feedback if landing out of range
                if (userLocation && distanceFromGps > MAX_SELECTION_DISTANCE_METERS) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            }
        } catch (error) {
            log.error('Error in region did change', error);
        } finally {
            setIsMoving(false);
        }
    }, [userLocation, distanceFromGps]);

    const handleZoomIn = useCallback(() => {
        if (!cameraRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        cameraRef.current.setCamera({
            zoomLevel: Math.min(currentZoom + 1, MAP_CONFIG.ZOOM.LIMIT_MAX),
            animationDuration: 300,
        });
    }, [currentZoom]);

    const handleZoomOut = useCallback(() => {
        if (!cameraRef.current) return;
        const nextZoom = Math.max(currentZoom - 1, MAP_CONFIG.ZOOM.BROWSE_MIN);
        cameraRef.current.setCamera({
            zoomLevel: nextZoom,
            animationDuration: 200,
        });
        setCurrentZoom(nextZoom);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [currentZoom]);

    const handleConfirm = useCallback(() => {
        if (selectedLocation && isWithinRange) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm(selectedLocation);
        }
    }, [selectedLocation, isWithinRange, onConfirm]);

    const handleCancel = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCancel();
    }, [onCancel]);

    // Format distance for display
    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }
        return `${(meters / 1000).toFixed(1)}km`;
    };

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={true}
            onRequestClose={handleCancel}
        >
            <View style={styles.container}>
                {/* Map */}
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    mapStyle={HUDDLE_MAP_STYLE}
                    logoEnabled={false}
                    attributionEnabled={true}
                    attributionPosition={{ bottom: 120, right: 8 }}
                    onDidFinishLoadingMap={handleMapReady}
                    onRegionWillChange={handleRegionWillChange}
                    onRegionIsChanging={handleRegionIsChanging}
                    onRegionDidChange={handleRegionDidChange}
                >
                    <Camera
                        ref={cameraRef}
                        defaultSettings={{
                            centerCoordinate: centerCoord,
                            zoomLevel: MAP_CONFIG.ZOOM.LIMIT_MAX,
                        }}
                        minZoomLevel={MAP_CONFIG.ZOOM.BROWSE_MIN}
                        maxZoomLevel={MAP_CONFIG.ZOOM.LIMIT_MAX}
                    />

                    {/* 5km Radius Boundary Circle Overlay */}
                    {userLocation && boundaryPolygon && (
                        <ShapeSource
                            id="radius-source"
                            shape={boundaryPolygon}
                        >
                            <FillLayer
                                id="radius-fill"
                                style={{
                                    fillColor: 'rgba(255, 100, 16, 0.03)',
                                    fillOpacity: Math.max(0, (distanceFromGps - 3500) / 1500) * 0.8,
                                    fillOutlineColor: 'rgba(255, 100, 16, 0.1)',
                                }}
                            />
                            <LineLayer
                                id="radius-line"
                                style={{
                                    lineColor: 'rgba(255, 100, 16, 0.15)',
                                    lineOpacity: Math.max(0, (distanceFromGps - 3500) / 1500),
                                    lineWidth: 1.5,
                                    lineDasharray: [4, 4],
                                }}
                            />
                        </ShapeSource>
                    )}


                    {/* User Location Indicator (Blue dot + Pulse) */}
                    {userLocation && isMapReady && (
                        <MapViewLocation
                            location={userLocation}
                            isMapStable={isMapReady}
                        />
                    )}
                </MapView>

                {/* Header */}
                <View
                    style={[styles.header, { paddingTop: insets.top }]}
                    onLayout={handleHeaderLayout}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.headerCancelButton}
                            onPress={handleCancel}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <X size={24} color="#374151" />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Place your room in the city</Text>

                        {/* Empty spacer for visual balance - matches cancel button width */}
                        <View style={styles.headerSpacer} />
                    </View>
                </View>

                {/* Map Controls - Matched with Discovery Layout */}
                <View style={[styles.mapControls, { top: headerHeight + 10 }]}>
                    {/* Zoom Card */}
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

                </View>

                {/* 
                  Hero Coverage Visuals
                  1. Pulse Ring (Behind, Animated)
                  2. Hero Aura (Front, Static Precision)
                */}

                {/* 1. Pulse Ring (Breath Annotation) */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.heroAura,
                        {
                            borderColor: isWithinRange ? theme.palette.emerald[500] : theme.tokens.status.error.main,
                            backgroundColor: isWithinRange ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            zIndex: 4, // Below main aura
                            elevation: 0, // No shadow for pulse
                            shadowOpacity: 0,
                            borderWidth: 0, // No border to avoid "double circle" look
                        },
                        pulseRingAnimatedStyle // Use dedicated style
                    ]}
                />

                {/* 2. Hero Aura (Main Precision Circle) */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.heroAura,
                        {
                            borderColor: isWithinRange ? theme.palette.emerald[500] : theme.tokens.status.error.main,
                            backgroundColor: isWithinRange ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        },
                        heroAuraAnimatedStyle
                    ]}
                />

                {/* Bottom Sheet */}
                <Animated.View style={[
                    styles.bottomSheet,
                    { paddingBottom: Math.max(insets.bottom, 24) },
                    bottomSheetAnimatedStyle
                ]}>
                    <View style={styles.dragIndicator} />

                    {/* Location Info */}
                    <View style={styles.locationInfo}>
                        <View style={[
                            styles.locationIconContainer,
                            !isWithinRange && styles.locationIconContainerError
                        ]}>
                            <MapPin size={22} color={isWithinRange ? theme.palette.emerald[500] : theme.palette.red[500]} />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={[
                                styles.locationLabel,
                                !isWithinRange && { color: theme.tokens.text.error }
                            ]}>
                                {isWithinRange ? 'Covers nearby area' : 'Too far to deploy'}
                            </Text>
                            {selectedLocation ? (
                                <Text style={[
                                    styles.locationCoords,
                                    !isWithinRange && styles.locationCoordsError
                                ]}>
                                    {formatDistance(distanceFromGps)} from here
                                    {!isWithinRange && ' (too far)'}
                                </Text>
                            ) : (
                                <Text style={styles.locationCoordsPlaceholder}>Move map to place</Text>
                            )}
                        </View>
                    </View>

                    {/* Distance hint */}
                    <View style={styles.hintContainer}>
                        <Text style={[styles.radiusHint, !isWithinRange && styles.radiusHintError]}>
                            {isWithinRange
                                ? 'People nearby will be able to join'
                                : 'Move closer to your location to deploy'}
                        </Text>
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={!canConfirm}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={canConfirm ? [theme.tokens.brand.primary, theme.palette.orange[600]] : [theme.tokens.action.disabled.bg, theme.tokens.action.disabled.bg]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
                        >
                            <Text style={[
                                styles.confirmButtonText,
                                !canConfirm && { color: '#94a3b8' }
                            ]}>
                                {canConfirm ? 'Select Area' : 'Out of Bounds'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                {/* Loading overlay */}
                {!isMapReady && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FF6410" />
                        <Text style={styles.loadingText}>Loading map...</Text>
                    </View>
                )}
            </View>
        </Modal >
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.surface,
    },
    map: {
        flex: 1,
    },

    // Header
    // Header (Matched with DiscoveryHeader)
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerCancelButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '500',
        color: theme.tokens.text.primary,
        textAlign: 'center',
        flex: 1,
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },

    // Center Pin
    pinContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        // No offset - pin is exactly centered to match getCenter()
    },
    pinWrapper: {
        alignItems: 'center',
    },
    pinWrapperMoving: {
        transform: [{ translateY: -10 }],
    },
    pinIcon: {
        // Slight shadow effect
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    pinShadow: {
        position: 'absolute',
        bottom: -4,
        width: 12,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
    },
    crosshairDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.tokens.brand.primary,
        marginTop: 4,
    },

    // My Location Button
    myLocationButton: {
        position: 'absolute',
        right: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.tokens.bg.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.tokens.bg.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 20,
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    // Hero Aura (Static View centered on screen)
    heroAura: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        borderWidth: 0.5, // Hairline edge
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        // Shadow for elevation
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    // Removed heroAuraGlow
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    locationIconContainer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: theme.palette.orange[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.tokens.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 6,
    },
    locationCoords: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        letterSpacing: -0.5,
    },
    locationCoordsPlaceholder: {
        fontSize: 17,
        color: theme.tokens.text.tertiary,
        fontWeight: '500',
    },
    hintContainer: {
        marginBottom: 28,
        paddingHorizontal: 4,
    },
    radiusHint: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        lineHeight: 22,
        fontWeight: '400',
    },
    radiusHintError: {
        color: theme.tokens.text.error,
        fontWeight: '500',
    },
    confirmButton: {
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.tokens.brand.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    confirmButtonDisabled: {
        shadowColor: 'transparent',
        elevation: 0,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.tokens.text.onPrimary,
        letterSpacing: 0.3,
    },
    // Error states
    crosshairDotError: {
        backgroundColor: theme.tokens.status.error.main,
    },
    locationIconContainerError: {
        backgroundColor: theme.tokens.status.error.bg,
    },
    locationCoordsError: {
        color: theme.tokens.text.error,
    },

    // Zoom & Location Controls (Matched with Discovery styles)
    mapControls: {
        position: 'absolute',
        right: 10,
        gap: 12,
        zIndex: 50,
    },
    zoomCard: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
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
        backgroundColor: theme.tokens.border.subtle,
        marginVertical: 2,
        marginHorizontal: 4,
    },

    // Loading
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: theme.tokens.text.tertiary,
    },
});

export default MapLocationPicker;
