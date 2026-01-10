/**
 * useLocationPicker Hook
 *
 * Manages state for the map-based location picker.
 * Provides location selection, geocoding (optional), and confirmation logic.
 *
 * @example
 * ```typescript
 * const {
 *   selectedLocation,
 *   setSelectedLocation,
 *   isPickerVisible,
 *   openPicker,
 *   closePicker,
 *   confirmLocation,
 *   resetToGPS,
 * } = useLocationPicker({ initialLocation: userLocation });
 * ```
 */

import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

export interface LocationCoordinate {
    latitude: number;
    longitude: number;
}

export interface UseLocationPickerOptions {
    /** Initial location (usually user's GPS location) */
    initialLocation?: LocationCoordinate | null;
    /** Callback when location is confirmed */
    onConfirm?: (location: LocationCoordinate) => void;
}

export interface UseLocationPickerReturn {
    /** Currently selected location on map */
    selectedLocation: LocationCoordinate | null;
    /** Update selected location (called during map interaction) */
    setSelectedLocation: (location: LocationCoordinate) => void;
    /** Whether the picker modal is visible */
    isPickerVisible: boolean;
    /** Open the location picker modal */
    openPicker: () => void;
    /** Close the picker without confirming */
    closePicker: () => void;
    /** Confirm the selected location and close picker */
    confirmLocation: () => void;
    /** Reset selection to initial GPS location */
    resetToGPS: () => void;
    /** The confirmed location (what will be used for room creation) */
    confirmedLocation: LocationCoordinate | null;
    /** Whether user has manually selected a custom location */
    isCustomLocation: boolean;
    /** Location mode: 'gps' or 'custom' */
    locationMode: 'gps' | 'custom';
    /** Set location mode */
    setLocationMode: (mode: 'gps' | 'custom') => void;
}

export function useLocationPicker(
    options: UseLocationPickerOptions = {}
): UseLocationPickerReturn {
    const { initialLocation, onConfirm } = options;

    // State
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [selectedLocation, setSelectedLocationState] = useState<LocationCoordinate | null>(
        initialLocation || null
    );
    const [confirmedLocation, setConfirmedLocation] = useState<LocationCoordinate | null>(
        initialLocation || null
    );
    const [isCustomLocation, setIsCustomLocation] = useState(false);
    const [locationMode, setLocationModeState] = useState<'gps' | 'custom'>('gps');

    // Update selected location with haptic feedback
    const setSelectedLocation = useCallback((location: LocationCoordinate) => {
        setSelectedLocationState(location);
        // Light haptic on location change
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Open picker modal
    const openPicker = useCallback(() => {
        // Initialize picker with confirmed location or initial GPS
        setSelectedLocationState(confirmedLocation || initialLocation || null);
        setIsPickerVisible(true);
    }, [confirmedLocation, initialLocation]);

    // Close picker without confirming
    const closePicker = useCallback(() => {
        setIsPickerVisible(false);
        // Reset selected location to confirmed location
        setSelectedLocationState(confirmedLocation || initialLocation || null);
    }, [confirmedLocation, initialLocation]);

    // Confirm selected location
    const confirmLocation = useCallback(() => {
        if (selectedLocation) {
            setConfirmedLocation(selectedLocation);
            setIsCustomLocation(true);
            setLocationModeState('custom');

            // Medium haptic on confirmation
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            onConfirm?.(selectedLocation);
        }
        setIsPickerVisible(false);
    }, [selectedLocation, onConfirm]);

    // Reset to GPS location
    const resetToGPS = useCallback(() => {
        if (initialLocation) {
            setConfirmedLocation(initialLocation);
            setSelectedLocationState(initialLocation);
            setIsCustomLocation(false);
            setLocationModeState('gps');

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [initialLocation]);

    // Set location mode
    const setLocationMode = useCallback((mode: 'gps' | 'custom') => {
        setLocationModeState(mode);
        if (mode === 'gps' && initialLocation) {
            setConfirmedLocation(initialLocation);
            setSelectedLocationState(initialLocation);
            setIsCustomLocation(false);
        } else if (mode === 'custom') {
            openPicker();
        }
    }, [initialLocation, openPicker]);

    return {
        selectedLocation,
        setSelectedLocation,
        isPickerVisible,
        openPicker,
        closePicker,
        confirmLocation,
        resetToGPS,
        confirmedLocation,
        isCustomLocation,
        locationMode,
        setLocationMode,
    };
}

export default useLocationPicker;
