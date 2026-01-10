import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('LocationUtils');

/**
 * Get current position with a strict timeout and fallback.
 * expo-location's getCurrentPositionAsync doesn't always respect timeouts
 * or may not have the option depending on the version/platform.
 */
export async function getCurrentPositionWithTimeout(
    options: Location.LocationOptions,
    timeoutMs: number
): Promise<Location.LocationObject> {
    // 1. Check if location services are enabled on Android
    // This often prevents the "30s infinite hang" when GPS is disabled
    if (Platform.OS === 'android') {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
            log.warn('Location services are disabled on Android. Attempting fallback immediately.');
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) return lastKnown;
            throw new Error('Location services are disabled and no last known position available');
        }
    }

    try {
        // 2. Prepare options with Android-specific setting prompts
        const fetchOptions: Location.LocationOptions = {
            ...options,
            // On Android, this shows the "Google Location Accuracy" dialog if disabled
            // which often clears up hangs in emulators/devices.
            mayShowUserSettingsDialog: true,
        };

        // 3. Attempt fresh high-accuracy location
        return await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Location request timed out'));
            }, timeoutMs);

            Location.getCurrentPositionAsync(fetchOptions)
                .then((location) => {
                    clearTimeout(timeoutId);
                    resolve(location);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    } catch (error) {
        // Fallback: If fresh location fails or times out, try last known position
        log.warn('Location fresh fix failed or timed out, attempting fallback', { error: error instanceof Error ? error.message : error });

        const lastKnown = await Location.getLastKnownPositionAsync();

        if (lastKnown) {
            log.info('Successfully recovered position from last known fallback');
            return lastKnown;
        }

        // Final failure if even last known is unavailable
        throw error;
    }
}
