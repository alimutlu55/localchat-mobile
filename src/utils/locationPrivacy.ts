/**
 * Location Privacy Utilities
 * 
 * Ported from web to match identical privacy logic.
 * Ensures exact user coordinates never leave the device.
 */

export interface LocationCoordinates {
    lat: number;
    lng: number;
}

/**
 * Resolution for grid snapping (in degrees).
 * 0.01 degrees is approximately 1.1km at the equator.
 */
export const GRID_RESOLUTION_DEGREES = 0.01;

/**
 * Snap a coordinate to a deterministic grid centroid.
 * This ensures that any point within a 500m x 500m area maps to the same central point.
 */
export function snapToGrid(lat: number, lng: number): LocationCoordinates {
    const snap = (val: number, res: number) => {
        return Math.floor(val / res) * res + (res / 2);
    };

    return {
        lat: snap(lat, GRID_RESOLUTION_DEGREES),
        lng: snap(lng, GRID_RESOLUTION_DEGREES),
    };
}

/**
 * Randomize a location within a specified radius (Stochastic - Deprecated for creation).
 * Still useful for non-deterministic display if needed.
 */
export function randomizeLocation(lat: number, lng: number, radiusMeters: number): LocationCoordinates {
    // Random angle in radians (0 to 2π)
    const angle = Math.random() * 2 * Math.PI;

    // Random distance with sqrt for uniform distribution within circle
    const distance = Math.sqrt(Math.random()) * radiusMeters;

    // Convert to lat/lng offset
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(lat * Math.PI / 180);

    const latOffset = (distance * Math.cos(angle)) / metersPerDegreeLat;
    const lngOffset = (distance * Math.sin(angle)) / metersPerDegreeLng;

    return {
        lat: lat + latOffset,
        lng: lng + lngOffset,
    };
}

/**
 * Applies determinative location snapping for room creation.
 * Ensures the exact user location never leaves the device by mapping it
 * to a 500m area centroid.
 */
export function randomizeForRoomCreation(lat: number, lng: number): LocationCoordinates {
    return snapToGrid(lat, lng);
}
