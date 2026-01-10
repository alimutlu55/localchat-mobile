import * as Location from 'expo-location';

/**
 * Get current position with a strict timeout.
 * expo-location's getCurrentPositionAsync doesn't always respect timeouts
 * or may not have the option depending on the version/platform.
 */
export async function getCurrentPositionWithTimeout(
    options: Location.LocationOptions,
    timeoutMs: number
): Promise<Location.LocationObject> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Location request timed out'));
        }, timeoutMs);

        Location.getCurrentPositionAsync(options)
            .then((location) => {
                clearTimeout(timeoutId);
                resolve(location);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}
