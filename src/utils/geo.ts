/**
 * Geo Utilities
 *
 * Geographic calculation functions for location-based features.
 * Centralized to avoid duplication across components and hooks.
 */

/**
 * Calculate distance between two geographic points using Haversine formula.
 *
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in meters
 *
 * @example
 * ```typescript
 * const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
 * // Returns ~3935746 meters (NY to LA)
 * ```
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Check if a point is within a given radius of another point.
 *
 * @param centerLat Center point latitude
 * @param centerLon Center point longitude
 * @param pointLat Point to check latitude
 * @param pointLon Point to check longitude
 * @param radiusMeters Radius in meters (0 means always visible)
 * @returns True if point is within radius (or radius is 0 = global)
 */
export function isWithinRadius(
    centerLat: number,
    centerLon: number,
    pointLat: number,
    pointLon: number,
    radiusMeters: number
): boolean {
    // Global visibility (radius = 0) is always visible
    if (radiusMeters === 0) {
        return true;
    }

    const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
    return distance <= radiusMeters;
}

/**
 * Check if a point is within given bounding box.
 *
 * @param lat Point latitude
 * @param lng Point longitude
 * @param bounds Bounding box [minLng, minLat, maxLng, maxLat]
 * @returns True if point is within bounds
 */
export function isPointInBounds(
    lat: number,
    lng: number,
    bounds: [number, number, number, number]
): boolean {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/**
 * Calculate the center of a bounding box.
 *
 * @param bounds Bounding box [minLng, minLat, maxLng, maxLat]
 * @returns Center point { lat, lng }
 */
export function getBoundsCenter(
    bounds: [number, number, number, number]
): { lat: number; lng: number } {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    return {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
    };
}

/**
 * Calculate the approximate span of a bounding box.
 *
 * @param bounds Bounding box [minLng, minLat, maxLng, maxLat]
 * @returns Maximum span in degrees
 */
export function getBoundsSpan(bounds: [number, number, number, number]): number {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;
    return Math.max(lngSpan, latSpan);
}
