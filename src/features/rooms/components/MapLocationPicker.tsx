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

import React, { useCallback, useRef, useState, useEffect } from 'react';
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
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, interpolateColor } from 'react-native-reanimated';

import { theme, useTheme } from '../../../core/theme';
const AnimatedMapPin = Animated.createAnimatedComponent(MapPin);

import { HUDDLE_MAP_STYLE } from '../../../styles/mapStyle';
import { createLogger } from '../../../shared/utils/logger';
import { MapViewLocation } from '../../discovery/map/MapViewLocation';

const log = createLogger('MapLocationPicker');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Max distance in meters user can select from their GPS location
const MAX_SELECTION_DISTANCE_METERS = 1000;

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

    const y = Math.sin(theta) * sinDelta * cosPhi1;
    const x = cosDelta - sinPhi1 * sinPhi2;
    const lambda2 = lambda1 + Math.atan2(y, x);

    return {
        lat: toDeg(phi2),
        lon: toDeg(lambda2),
    };
}

/**
 * Generate a GeoJSON Polygon representing a circle at a specific location
 * Uses spherical projection matching the Haversine distance formula exactly.
 */
function generateCirclePolygon(center: [number, number], radiusInMeters: number, pointsCount: number = 128): any {
    const coords = [];
    const lng = center[0];
    const lat = center[1];

    // Generate points around the circle using destination point formula
    for (let i = 0; i <= pointsCount; i++) {
        const bearing = (i / pointsCount) * 360; // Degrees from 0 to 360
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
    const [currentZoom, setCurrentZoom] = useState(15);
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

    // Animation values
    const pinTranslateY = useSharedValue(0);
    const bottomSheetTranslateY = useSharedValue(200);
    const rangeValue = useSharedValue(1); // 1 = in range, 0 = out of range

    // Update range animation when state changes
    useEffect(() => {
        rangeValue.value = withTiming(isWithinRange ? 1 : 0, { duration: 300 });
    }, [isWithinRange, rangeValue]);

    // Animated Styles
    const pinAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: pinTranslateY.value }]
    }));

    const pinIconAnimatedStyle = useAnimatedStyle(() => ({
        color: interpolateColor(rangeValue.value, [0, 1], [theme.tokens.status.error.main, theme.tokens.brand.primary])
    }));

    const crosshairAnimatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(rangeValue.value, [0, 1], [theme.tokens.status.error.main, theme.tokens.brand.primary])
    }));

    const pinShadowAnimatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(pinTranslateY.value, [0, -20], [1, 0.4], 'clamp');
        const opacity = interpolate(pinTranslateY.value, [0, -20], [1, 0.2], 'clamp');
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    const bottomSheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bottomSheetTranslateY.value }]
    }));

    // Reset state when modal opens
    useEffect(() => {
        if (visible && initialLocation) {
            setSelectedLocation(initialLocation);
            setCenterCoord([initialLocation.longitude, initialLocation.latitude]);
            setDistanceFromGps(0);

            // Animate bottom sheet in
            bottomSheetTranslateY.value = withTiming(0, { duration: 400 });

            // Animate to location after a brief delay for map to be ready
            setTimeout(() => {
                if (cameraRef.current && initialLocation) {
                    cameraRef.current.setCamera({
                        centerCoordinate: [initialLocation.longitude, initialLocation.latitude],
                        zoomLevel: 15,
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
        pinTranslateY.value = withSpring(-20, { damping: 12 });
    }, [pinTranslateY]);

    const handleRegionDidChange = useCallback(async () => {
        if (!mapRef.current) return;

        try {
            const zoom = await mapRef.current.getZoom();
            setCurrentZoom(zoom);

            // Calculate coordinate at crosshair position (25px below screen center)
            // Accounts for pin icon (42px) + crosshair marginTop (4px)
            const crosshairOffsetFromCenter = 25;
            const pinScreenX = SCREEN_WIDTH / 2;
            const pinScreenY = (SCREEN_HEIGHT / 2) + crosshairOffsetFromCenter;

            const coordinate = await mapRef.current.getCoordinateFromView([pinScreenX, pinScreenY]);

            if (coordinate && Array.isArray(coordinate) && coordinate.length === 2) {
                const [lng, lat] = coordinate as [number, number];

                if (typeof lng === 'number' && typeof lat === 'number' &&
                    isFinite(lng) && isFinite(lat)) {
                    setSelectedLocation({ latitude: lat, longitude: lng });
                    setCenterCoord([lng, lat]);

                    if (userLocation) {
                        const distance = calculateDistanceMeters(
                            userLocation.latitude, userLocation.longitude,
                            lat, lng
                        );
                        setDistanceFromGps(distance);
                    }
                }
            }
        } catch (error) {
            log.error('Error getting coordinate at crosshair', error);
        } finally {
            setIsMoving(false);
            pinTranslateY.value = withSpring(0, { damping: 15 });
        }
    }, [userLocation, pinTranslateY]);

    const handleZoomIn = useCallback(() => {
        if (!cameraRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        cameraRef.current.setCamera({
            zoomLevel: Math.min(currentZoom + 1, 18),
            animationDuration: 300,
        });
    }, [currentZoom]);

    const handleZoomOut = useCallback(() => {
        if (!cameraRef.current) return;
        const nextZoom = Math.max(currentZoom - 1, 3);
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
                    onRegionDidChange={handleRegionDidChange}
                >
                    <Camera
                        ref={cameraRef}
                        defaultSettings={{
                            centerCoordinate: centerCoord,
                            zoomLevel: 15,
                        }}
                        minZoomLevel={13}
                        maxZoomLevel={18}
                    />

                    {/* 1km Radius Circle Overlay */}
                    {userLocation && (
                        <ShapeSource
                            id="radius-source"
                            shape={generateCirclePolygon(
                                [userLocation.longitude, userLocation.latitude],
                                MAX_SELECTION_DISTANCE_METERS
                            )}
                        >
                            <FillLayer
                                id="radius-fill"
                                style={{
                                    fillColor: 'rgba(255, 100, 16, 0.05)',
                                    fillOutlineColor: 'rgba(255, 100, 16, 0.2)',
                                }}
                            />
                            <LineLayer
                                id="radius-line"
                                style={{
                                    lineColor: 'rgba(255, 100, 16, 0.3)',
                                    lineWidth: 2,
                                    lineDasharray: [2, 2],
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

                        <Text style={styles.headerTitle}>Select Location</Text>

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

                {/* Center Pin Indicator (Fixed in screen center) */}
                <View style={styles.pinContainer} pointerEvents="none">
                    <Animated.View style={[styles.pinWrapper, pinAnimatedStyle]}>
                        {/* Pin Shadow - Dynamic based on lift */}
                        <Animated.View style={[styles.pinShadow, pinShadowAnimatedStyle]} />
                        {/* Pin Icon - changes color when out of range */}
                        <Animated.View style={styles.pinIcon}>
                            <AnimatedMapPin
                                size={42}
                                animatedProps={useAnimatedStyle(() => ({
                                    color: interpolateColor(rangeValue.value, [0, 1], [theme.tokens.status.error.main, theme.tokens.brand.primary]),
                                    fill: interpolateColor(rangeValue.value, [0, 1], [theme.tokens.status.error.main, theme.tokens.brand.primary]),
                                }))}
                                strokeWidth={1}
                            />
                        </Animated.View>
                    </Animated.View>
                    {/* Crosshair dot */}
                    <Animated.View style={[styles.crosshairDot, crosshairAnimatedStyle]} />
                </View>

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
                            <MapPin size={22} color={isWithinRange ? '#FF6410' : '#ef4444'} />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={[
                                styles.locationLabel,
                                !isWithinRange && { color: theme.tokens.text.error }
                            ]}>
                                {isWithinRange ? 'Room Location' : 'Room Out of Range'}
                            </Text>
                            {selectedLocation ? (
                                <Text style={[
                                    styles.locationCoords,
                                    !isWithinRange && styles.locationCoordsError
                                ]}>
                                    {formatDistance(distanceFromGps)} from you
                                    {!isWithinRange && ' (max 1km limit)'}
                                </Text>
                            ) : (
                                <Text style={styles.locationCoordsPlaceholder}>Move map to select</Text>
                            )}
                        </View>
                    </View>

                    {/* Distance hint */}
                    <View style={styles.hintContainer}>
                        <Text style={[styles.radiusHint, !isWithinRange && styles.radiusHintError]}>
                            {isWithinRange
                                ? 'Place your room anywhere within a 1km radius of your current position'
                                : 'Move the pin closer to your current position to place your room'}
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
                                {canConfirm ? 'Confirm Room Location' : 'Out of Range'}
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
        </Modal>
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
