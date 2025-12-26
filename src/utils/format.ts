/**
 * Format Utilities
 * 
 * Helper functions for formatting various data types for display
 */

/**
 * Format distance in meters to human-readable string
 * 
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "50m away", "2.5km away")
 */
export function formatDistance(meters: number): string {
  if (meters === undefined || meters === null) {
    return 'Unknown distance';
  }

  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }

  const km = meters / 1000;
  
  if (km < 10) {
    return `${km.toFixed(1)}km away`;
  }

  return `${Math.round(km)}km away`;
}

/**
 * Format distance (short version, no "away")
 * 
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "50m", "2.5km")
 */
export function formatDistanceShort(meters: number): string {
  if (meters === undefined || meters === null) {
    return '—';
  }

  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  const km = meters / 1000;
  
  if (km < 10) {
    return `${km.toFixed(1)}km`;
  }

  return `${Math.round(km)}km`;
}

/**
 * Get distance color based on distance
 * 
 * @param meters Distance in meters
 * @returns Color code
 */
export function getDistanceColor(meters: number): string {
  if (meters < 500) {
    return '#16a34a'; // Green - very close
  }
  
  if (meters < 2000) {
    return '#ea580c'; // Orange - nearby
  }
  
  return '#6b7280'; // Gray - far
}

/**
 * Sort rooms by distance (closest first)
 * 
 * @param rooms Array of rooms
 * @returns Sorted array
 */
export function sortByDistance<T extends { distance?: number }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const distA = a.distance ?? Infinity;
    const distB = b.distance ?? Infinity;
    return distA - distB;
  });
}
