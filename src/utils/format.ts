/**
 * Format Utilities
 *
 * Helper functions for formatting various data types for display.
 * Centralized to ensure consistent formatting across the app.
 */

// Re-export geo utilities for backward compatibility
// (calculateDistance was previously in this file)
export { calculateDistance } from './geo';

// =============================================================================
// Distance Formatting
// =============================================================================

/**
 * Format distance in meters to human-readable string
 *
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "Nearby", "2.5km away")
 */
export function formatDistance(meters: number | undefined | null): string {
  if (meters === undefined || meters === null) {
    return '—';
  }

  // Privacy Rule: "Nearby" for anything within 1km
  if (meters <= 1000) {
    return 'Nearby';
  }

  const km = meters / 1000;

  if (km < 10) {
    return `~${km.toFixed(1)}km away`;
  }

  return `~${Math.round(km)}km away`;
}

/**
 * Format distance (short version, no "away")
 *
 * @param meters Distance in meters
 * @returns Formatted string (e.g., "Nearby", "~2.5km")
 */
export function formatDistanceShort(meters: number | undefined | null): string {
  if (meters === undefined || meters === null) {
    return '—';
  }

  if (meters <= 1000) {
    return 'Nearby';
  }

  const km = meters / 1000;

  if (km < 10) {
    return `~${km.toFixed(1)}km`;
  }

  return `~${Math.round(km)}km`;
}

/**
 * Get distance color based on distance
 *
 * @param meters Distance in meters
 * @returns Color code
 */
export function getDistanceColor(meters: number | undefined | null): string {
  if (meters === undefined || meters === null) {
    return '#6b7280'; // Gray
  }

  if (meters <= 1000) {
    return '#16a34a'; // Green - Nearby (Privacy Zone)
  }

  if (meters < 5000) {
    return '#FF6410'; // Orange - Medium Range
  }

  return '#6b7280'; // Gray - Far
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

// =============================================================================
// Time Formatting
// =============================================================================

/**
 * Format time remaining until a date (e.g., room expiry)
 *
 * @param expiresAt Target date
 * @returns Formatted string (e.g., "2h 30m left", "15m left", "Expired")
 */
export function formatTimeRemaining(expiresAt: Date | string | number | undefined | null): string {
  if (!expiresAt) {
    return 'No expiry';
  }

  const target = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  // Check for invalid date
  if (isNaN(target.getTime())) {
    return 'No expiry';
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m left`;
  }

  return `${minutes}m left`;
}

/**
 * Format milliseconds to time remaining string
 *
 * @param ms Milliseconds remaining
 * @returns Formatted string (e.g., "2h 30m", "15m", "Expired")
 */
export function formatTimeRemainingMs(ms: number): string {
  if (ms <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Get color for time remaining based on urgency
 *
 * @param expiresAt Target date
 * @returns Color code
 */
export function getTimeColor(expiresAt: Date | string | number | undefined | null): string {
  if (!expiresAt) {
    return '#9ca3af'; // Gray - no expiry
  }

  const target = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  if (isNaN(target.getTime())) {
    return '#9ca3af'; // Gray - invalid
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const minutesRemaining = diffMs / 60000;

  if (minutesRemaining <= 0) {
    return '#ef4444'; // Red - expired
  }

  if (minutesRemaining <= 30) {
    return '#FF6410'; // Orange - expiring soon
  }

  return '#9ca3af'; // Gray - plenty of time
}

/**
 * Check if expiry time is within "soon" threshold
 *
 * @param expiresAt Target date
 * @param thresholdMinutes Minutes threshold (default: 30)
 * @returns True if expiring soon
 */
export function isExpiringSoon(
  expiresAt: Date | string | number | undefined | null,
  thresholdMinutes: number = 30
): boolean {
  if (!expiresAt) return false;

  const target = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (isNaN(target.getTime())) return false;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const minutesRemaining = diffMs / 60000;

  return minutesRemaining > 0 && minutesRemaining <= thresholdMinutes;
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

