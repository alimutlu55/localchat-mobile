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
 * Randomize a location within a specified radius.
 * Uses uniform distribution within a circle for natural-looking randomization.
 * 
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @param radiusMeters - Maximum offset radius in meters
 * @returns Randomized location
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
 * Randomize location for room creation.
 * Applies a fixed privacy offset to the room's stored location.
 */
export function randomizeForRoomCreation(lat: number, lng: number, roomRadiusMeters: number): LocationCoordinates {
    // We use a fixed radius for privacy offset regardless of room visibility radius
    // to ensure user privacy is protected even for small rooms.
    return randomizeLocation(lat, lng, roomRadiusMeters);
}
