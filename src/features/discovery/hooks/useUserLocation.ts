/**
 * useUserLocation Hook
 *
 * Manages user location tracking with permissions.
 * Extracted from DiscoveryScreen for reusability.
 *
 * @example
 * ```typescript
 * const { location, isLoading, error, refresh } = useUserLocation();
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { createLogger } from '../../../shared/utils/logger';
import { consentService } from '../../../services/consent';

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

  // Fetch location
  const fetchLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setPermissionDenied(false); // Reset denied state on new fetch attempt

      // Check internal app consent first
      const statusObj = await consentService.getStatus();
      if (statusObj.hasConsent && statusObj.options?.locationConsent === false) {
        setPermissionDenied(true);
        setError('Location access disabled in app settings');
        log.warn('Location consent explicitly denied in app');
        setIsLoading(false);
        return;
      }

      // Request OS permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setError('Location permission denied');
        log.warn('Location permission denied');
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
  }, []);

  // Start watching location
  const startWatching = useCallback(async () => {
    if (!watch) return;

    try {
      // Check internal app consent first
      const statusObj = await consentService.getStatus();
      if (statusObj.hasConsent && statusObj.options?.locationConsent === false) {
        setPermissionDenied(true);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

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
  }, [watch, timeInterval, distanceInterval]);

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
