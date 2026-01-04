/**
 * useUserLocation Hook
 *
 * Main interface for getting user's location with permission handling.
 * Relies solely on OS-level location permission (no app-level consent).
 *
 * Features:
 * - Checks OS permission before fetching location
 * - Watches for position updates
 * - Reactive to permission changes via EventBus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { createLogger } from '../../../shared/utils/logger';
import { useLocationPermission } from '../../../shared/stores/LocationConsentStore';
import { eventBus } from '../../../core/events/EventBus';

const log = createLogger('UserLocation');

// =============================================================================
// Types
// =============================================================================

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface UseUserLocationOptions {
  /** Whether to watch for location changes (vs one-time fetch) */
  watch?: boolean;
  /** Minimum distance (meters) before triggering update */
  distanceInterval?: number;
  /** Minimum time (ms) between updates */
  timeInterval?: number;
}

export interface UseUserLocationReturn {
  /** Current user location (null if not available) */
  location: UserLocation | null;
  /** Whether location is being fetched */
  isLoading: boolean;
  /** Error message if location fetch failed */
  error: string | null;
  /** Whether location permission was denied */
  permissionDenied: boolean;
  /** Manually refresh location */
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useUserLocation(
  options: UseUserLocationOptions = {}
): UseUserLocationReturn {
  const {
    watch = true,
    distanceInterval = 50,
    timeInterval = 10000,
  } = options;

  const [location, setLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  // Get permission status from store
  const { isGranted, isChecked, checkPermission } = useLocationPermission();

  // Fetch location
  const fetchLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setPermissionDenied(false);

      // Check OS permission
      const hasPermission = await checkPermission();

      if (!hasPermission) {
        setPermissionDenied(true);
        setError('Location permission not granted');
        log.warn('Location permission denied by OS');
        setIsLoading(false);
        return;
      }

      // Get current position
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: UserLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(coords);
      console.log(`[UserLocation] Fetched: lat=${coords.latitude}, lng=${coords.longitude}`);
      log.debug('Location fetched', coords);
    } catch (err) {
      log.error('Failed to get location', err);
      setError('Failed to get location');
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission]);

  // Start watching location
  const startWatching = useCallback(async () => {
    if (!watch) return;

    try {
      // Check permission first
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        setPermissionDenied(true);
        return;
      }

      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval,
          distanceInterval,
        },
        (newLocation) => {
          const coords: UserLocation = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setLocation(coords);
          console.log(`[UserLocation] Updated: lat=${coords.latitude}, lng=${coords.longitude}`);
          log.debug('Location updated', coords);
        }
      );
    } catch (err) {
      log.error('Failed to start location watch', err);
    }
  }, [watch, timeInterval, distanceInterval, checkPermission]);

  // Initial fetch and watch setup
  useEffect(() => {
    const init = async () => {
      await fetchLocation();
      if (watch) {
        await startWatching();
      }
    };

    init();

    // Cleanup
    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
        watchSubscription.current = null;
      }
    };
  }, [fetchLocation, startWatching, watch]);

  // Subscribe to permission changes for reactive updates
  useEffect(() => {
    const unsub = eventBus.on('consent.updated', (payload) => {
      if (payload.locationConsent !== undefined) {
        log.debug('Permission changed, re-evaluating location', { locationConsent: payload.locationConsent });

        if (!payload.locationConsent) {
          // Permission revoked - stop watching and clear location
          if (watchSubscription.current) {
            watchSubscription.current.remove();
            watchSubscription.current = null;
          }
          setLocation(null);
          setPermissionDenied(true);
          setError('Location permission denied');
        } else {
          // Permission granted - fetch location
          fetchLocation();
        }
      }
    });
    return unsub;
  }, [fetchLocation]);

  const refresh = useCallback(async () => {
    await fetchLocation();
  }, [fetchLocation]);

  return {
    location,
    isLoading,
    error,
    permissionDenied,
    refresh,
  };
}

export default useUserLocation;
