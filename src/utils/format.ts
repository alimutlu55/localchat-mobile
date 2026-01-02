/**
 * Format Utilities
 * 
 * Helper functions for formatting various data types for display
 */

/**
 * Calculate distance between two geographic points using Haversine formula
 * 
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in meters
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
 * Format distance in meters to human-readable string
 * 
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "50m away", "2.5km away")
 */
export function formatDistance(meters: number | undefined): string {
  if (meters === undefined || meters === null) {
    return 'Distance unknown';
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
export function formatDistanceShort(meters: number | undefined): string {
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
    return '#FF6410'; // Orange - nearby
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

/**
 * Format a timestamp to relative time ago string
 * 
 * @param date Date object or ISO string or timestamp
 * @returns Formatted string (e.g., "5m ago", "2h ago", "1d ago")
 */
export function formatTimeAgo(date: Date | string | number | undefined | null): string {
  if (!date) {
    return 'Just now';
  }

  const now = new Date();
  const past = date instanceof Date ? date : new Date(date);

  // Check for invalid date
  if (isNaN(past.getTime())) {
    return 'Just now';
  }

  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // For older dates, show the actual date
  return past.toLocaleDateString();
}
