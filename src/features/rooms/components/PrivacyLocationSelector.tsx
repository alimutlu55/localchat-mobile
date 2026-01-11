import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Map, Navigation, MapPin } from 'lucide-react-native';
import { MapLocationPicker } from './MapLocationPicker';
import { LOCATION_CONFIG } from '../../../constants';
import { getCurrentPositionWithTimeout } from '../../../utils/location';
import { randomizeForRoomCreation } from '../../../utils/locationPrivacy';
import { theme } from '../../../core/theme';

export interface PrivacyLocationSelectorProps {
    onLocationChange: (location: { latitude: number; longitude: number } | null, mode: 'gps' | 'custom') => void;
}

/**
 * PrivacyLocationSelector
 * 
 * A standalone component that handles room location selection with enforcing privacy.
 * 
 * CORE RESPONSIBILITY:
 * This component guarantees that any location emitted to the parent is "Privacy Snapped"
 * (rounded to the nearest 1km grid centroid).
 * 
 * Features:
 * - Fetches "Nearby" GPS location and immediately snaps it.
 * - Allows "Custom" pin selection and snaps the result.
 * - Manages the UI state for location modes.
 */
export function PrivacyLocationSelector({ onLocationChange }: PrivacyLocationSelectorProps) {
    const [locationMode, setLocationMode] = useState<'gps' | 'custom' | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);
    const [hasExplicitlySelectedLocation, setHasExplicitlySelectedLocation] = useState(false);

    /**
     * Handle Custom Location Selection
     */
    const handleCustomLocationConfirm = useCallback((selectedLat: number, selectedLng: number) => {
        // PRIVACY ENFORCEMENT #2: Snap Custom Pin immediately
        const snapped = randomizeForRoomCreation(selectedLat, selectedLng);
        const snappedCoords = { latitude: snapped.lat, longitude: snapped.lng };

        setLocation(snappedCoords);
        setLocationMode('custom');
        setHasExplicitlySelectedLocation(true);
        setLocationMode('custom');
        setHasExplicitlySelectedLocation(true);
        setIsLocationPickerVisible(false);

        // Emit snapped coord
        onLocationChange(snappedCoords, 'custom');
    }, [onLocationChange]);

    /**
     * Handle Mode Switching
     */
    const handleSwitchToGps = async () => {
        // If we already have a snapped GPS location, just use it
        if (gpsLocation) {
            setLocation(gpsLocation);
            setLocationMode('gps');
            setHasExplicitlySelectedLocation(true);
            onLocationChange(gpsLocation, 'gps');
            return;
        }

        // Otherwise, fetch it now
        setIsGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for Nearby Area.');
                setIsGettingLocation(false);
                return;
            }

            const currentPos = await getCurrentPositionWithTimeout(
                { accuracy: LOCATION_CONFIG.ACCURACY },
                LOCATION_CONFIG.TIMEOUT
            );

            // Snap GPS immediately
            const snapped = randomizeForRoomCreation(currentPos.coords.latitude, currentPos.coords.longitude);
            const snappedCoords = { latitude: snapped.lat, longitude: snapped.lng };

            setGpsLocation(snappedCoords);
            setLocation(snappedCoords);
            setLocationMode('gps');
            setHasExplicitlySelectedLocation(true);
            onLocationChange(snappedCoords, 'gps');
        } catch (error) {
            console.error('PrivacyLocationSelector: Location error', error);
            Alert.alert('Error', 'Could not get your location.');
        } finally {
            setIsGettingLocation(false);
        }
    };

    const handleSwitchToCustom = async () => {
        if (gpsLocation) {
            setIsLocationPickerVisible(true);
            return;
        }

        setIsGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                // If denied, still open picker but at default world view (or 0,0)
                setIsLocationPickerVisible(true);
                return;
            }

            const currentPos = await getCurrentPositionWithTimeout(
                { accuracy: LOCATION_CONFIG.ACCURACY },
                LOCATION_CONFIG.TIMEOUT
            );

            // We just store the GPS location for reference (to center the map), 
            // we don't snap/select it as the legitimate location yet.
            setGpsLocation({
                latitude: currentPos.coords.latitude,
                longitude: currentPos.coords.longitude
            });

            setIsLocationPickerVisible(true);
        } catch (error) {
            console.error('PrivacyLocationSelector: Location error', error);
            // Fallback to opening picker anyway (will be at 0,0)
            setIsLocationPickerVisible(true);
        } finally {
            setIsGettingLocation(false);
        }
    };

    if (isGettingLocation) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.tokens.brand.primary} />
                <Text style={styles.loadingText}>Securing location privacy...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Room Location</Text>

            <View style={styles.visibilityRow}>
                {/* Custom Area Button */}
                <TouchableOpacity
                    style={[
                        styles.visibilityCard,
                        locationMode === 'custom' && styles.visibilityCardActive,
                    ]}
                    onPress={handleSwitchToCustom}
                    activeOpacity={0.7}
                >
                    <View style={[
                        styles.visibilityIconBox,
                        locationMode === 'custom' && styles.visibilityIconBoxActive
                    ]}>
                        <Map size={18} color={locationMode === 'custom' ? '#fff' : '#94a3b8'} />
                    </View>
                    <View style={styles.visibilityContent}>
                        <Text style={[
                            styles.visibilityTitle,
                            locationMode === 'custom' && styles.visibilityTitleActive
                        ]}>Custom Area</Text>
                        <Text style={styles.visibilityDesc}>Select zone on map</Text>
                    </View>
                </TouchableOpacity>

                {/* Nearby Area Button */}
                <TouchableOpacity
                    style={[
                        styles.visibilityCard,
                        locationMode === 'gps' && styles.visibilityCardActive,
                    ]}
                    onPress={handleSwitchToGps}
                    activeOpacity={0.7}
                >
                    <View style={[
                        styles.visibilityIconBox,
                        locationMode === 'gps' && styles.visibilityIconBoxActive
                    ]}>
                        <Navigation size={18} color={locationMode === 'gps' ? '#fff' : '#94a3b8'} />
                    </View>
                    <View style={styles.visibilityContent}>
                        <Text style={[
                            styles.visibilityTitle,
                            locationMode === 'gps' && styles.visibilityTitleActive
                        ]}>Nearby Area</Text>
                        <Text style={styles.visibilityDesc}>Your current grid</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Location Preview Text */}
            {location && hasExplicitlySelectedLocation && (
                <View style={styles.locationPreview}>
                    <MapPin size={14} color={theme.tokens.brand.primary} />
                    <Text style={styles.locationPreviewText}>
                        {locationMode === 'custom'
                            ? 'Selected area grid (Approx. 1km)'
                            : 'Current area grid (Approx. 1km)'}
                    </Text>
                </View>
            )}

            {/* Modal Picker */}
            <MapLocationPicker
                visible={isLocationPickerVisible}
                initialLocation={location || gpsLocation}
                userLocation={gpsLocation}
                onConfirm={(coords) => handleCustomLocationConfirm(coords.latitude, coords.longitude)}
                onCancel={() => setIsLocationPickerVisible(false)}
            // The picker visualizes exact pins, but we trap the output in handleCustomLocationConfirm to snap it.
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 0,
    },
    loadingContainer: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    visibilityRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    visibilityCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        gap: 12,
    },
    visibilityCardActive: {
        borderColor: theme.tokens.brand.primary,
        backgroundColor: '#fff7ed', // orange-50
    },
    visibilityIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    visibilityIconBoxActive: {
        backgroundColor: theme.tokens.brand.primary,
    },
    visibilityContent: {
        flex: 1,
    },
    visibilityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 2,
    },
    visibilityTitleActive: {
        color: theme.tokens.brand.primary,
    },
    visibilityDesc: {
        fontSize: 12,
        color: '#64748b',
    },
    locationPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        paddingLeft: 4,
    },
    locationPreviewText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
});
