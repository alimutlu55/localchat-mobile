/**
 * Clustering Utilities
 *
 * Shared constants and functions for room clustering.
 * These values MUST match the backend (R2dbcRoomClusteringRepository.kt).
 *
 * @see localchat/room/src/main/kotlin/com/localchat/room/infrastructure/persistence/R2dbcRoomClusteringRepository.kt
 */

/**
 * EPS (epsilon) values by zoom level for DBSCAN clustering.
 * Determines the maximum distance between points to form a cluster.
 *
 * Values are in degrees (1 degree ≈ 111km at equator).
 *
 * IMPORTANT: These values MUST stay in sync with the backend.
 * If you change these, update the backend as well.
 */
export const EPS_BY_ZOOM: Record<number, number> = {
    0: 15.0,      // 1650km - continental
    1: 8.0,       // 880km - sub-continental
    2: 4.0,       // 440km - large region
    3: 2.0,       // 220km - small region
    4: 1.0,       // 110km - country/province
    5: 0.5,       // 55km - metro area
    6: 0.25,      // 27km - city
    7: 0.1,       // 11km - city district
    8: 0.05,      // 5.5km - neighborhood
    9: 0.02,      // 2.2km - local area
    10: 0.01,     // 1.1km - street
    11: 0.005,    // 550m - block
    12: 0.002,    // 220m - building cluster (max zoom for clustering)
    13: 0.001,    // 110m - adjacent buildings (individual rooms only)
    14: 0.0005,   // 55m - same building
    15: 0.0002,   // 22m - essentially same spot
    16: 0.0001,   // 11m - same spot
    17: 0.00005,
    18: 0.00002,
    19: 0.00001,
    20: 0.00001,
};

/**
 * Privacy threshold zoom level.
 * Beyond this zoom, no rooms are returned to protect exact locations.
 */
export const PRIVACY_ZOOM_THRESHOLD = 12;

/**
 * Maximum zoom level for clustering.
 * At this zoom and higher, individual rooms are shown instead of clusters.
 */
export const MAX_CLUSTERING_ZOOM = 12;

/**
 * Get the eps value for a given zoom level.
 *
 * @param zoom Map zoom level (0-20)
 * @returns Eps value in degrees
 */
export function getEpsForZoom(zoom: number): number {
    const effectiveZoom = Math.max(0, Math.min(20, Math.floor(zoom)));
    return EPS_BY_ZOOM[effectiveZoom] ?? 0.00001;
}

/**
 * Calculate optimal zoom to split a cluster based on its bounds span.
 * Finds the lowest zoom where eps is smaller than the cluster's internal spread.
 *
 * @param boundsSpan The span of the cluster's expansion bounds (max of lng/lat span)
 * @param currentZoom Current map zoom level
 * @returns Optimal target zoom for cluster expansion
 */
export function calcOptimalZoomForCluster(
    boundsSpan: number,
    currentZoom: number
): number {
    // If no span (rooms at same coordinate), don't jump too far
    // This protects against "fast zooming" into a single point
    // ZERO-SPAN PROTECTION: If bounds have no span (single point cluster),
    // we jump 6 zoom levels to expand quickly while staying within the 1-12 limit.
    if (boundsSpan <= 0) {
        return Math.min(currentZoom + 6, MAX_CLUSTERING_ZOOM);
    }

    // We want eps to be about 1/3 of bounds span to get meaningful splits
    const targetEps = boundsSpan / 3;

    for (let z = currentZoom + 1; z <= MAX_CLUSTERING_ZOOM; z++) {
        const eps = EPS_BY_ZOOM[z] ?? 0.001;
        if (eps <= targetEps) {
            // AGGRESSIVE ZOOM LIMIT: We limit the jump to 10 levels per click.
            // This allows adequate expansion from world view (zoom 1) to room-level
            // (zoom 11+) in a single click, preventing the need for double-clicking.
            return Math.min(Math.max(z, currentZoom + 1), currentZoom + 10, MAX_CLUSTERING_ZOOM);
        }
    }

    return Math.min(currentZoom + 3, MAX_CLUSTERING_ZOOM);
}

/**
 * Calculate animation duration for map camera transitions.
 * Longer distance/zoom changes = longer duration for smoother experience.
 *
 * @param zoomDelta Change in zoom level
 * @param distanceKm Approximate distance to travel (optional)
 * @returns Duration in milliseconds
 */
export function calcAnimationDuration(
    zoomDelta: number,
    distanceKm: number = 0
): number {
    // Base duration increases with zoom change
    const zoomDuration = Math.min(Math.abs(zoomDelta) * 300, 1500);

    // Add time for distance (roughly 100ms per 100km)
    const distanceDuration = Math.min(distanceKm, 2000);

    return Math.max(500, zoomDuration + distanceDuration);
}

/**
 * Format cluster count for display.
 *
 * @param count Number of rooms in cluster
 * @returns Formatted string (e.g., "5", "1.2k", "10k+")
 */
export function formatClusterCount(count: number): string {
    if (count < 1000) {
        return count.toString();
    }
    if (count < 10000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return `${Math.floor(count / 1000)}k+`;
}
