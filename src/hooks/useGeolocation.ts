/**
 * useGeolocation Hook
 *
 * Provides access to device location using expo-location.
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  timestamp: number | null;
  permissionStatus: Location.PermissionStatus | null;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  watch?: boolean;
}

const DEFAULT_FALLBACK = {
  latitude: 20,
  longitude: 0,
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
    timestamp: null,
    permissionStatus: null,
  });

  const { enableHighAccuracy = true, timeout = 10000, watch = false } = options;

  /**
   * Request permission and get current position
   */
  const getCurrentPosition = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      setState(prev => ({ ...prev, permissionStatus: status }));

      if (status !== 'granted') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Location permission denied',
        }));
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: enableHighAccuracy
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
      });

      setState({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        error: null,
        loading: false,
        timestamp: location.timestamp,
        permissionStatus: status,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      }));
    }
  }, [enableHighAccuracy]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  /**
   * Watch position (optional)
   */
  useEffect(() => {
    if (!watch || state.permissionStatus !== 'granted') return;

    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: enableHighAccuracy
            ? Location.Accuracy.High
            : Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (location) => {
          setState(prev => ({
            ...prev,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          }));
        }
      );
    };

    startWatching();

    return () => {
      subscription?.remove();
    };
  }, [watch, enableHighAccuracy, state.permissionStatus]);

  /**
   * Get coordinates with fallback
   */
  const getCoordinates = useCallback(() => {
    if (state.latitude !== null && state.longitude !== null) {
      return {
        latitude: state.latitude,
        longitude: state.longitude,
      };
    }
    return DEFAULT_FALLBACK;
  }, [state.latitude, state.longitude]);

  return {
    ...state,
    refresh: getCurrentPosition,
    getCoordinates,
    hasLocation: state.latitude !== null && state.longitude !== null,
    isPermissionGranted: state.permissionStatus === 'granted',
  };
}

export default useGeolocation;

