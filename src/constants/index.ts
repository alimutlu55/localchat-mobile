/**
 * Application Constants
 *
 * Centralized configuration for the BubbleUp mobile app.
 * Environment-specific values should be loaded from env variables in production.
 */
import { theme } from '../core/theme';

/**
 * API Configuration
 */
export const API_CONFIG = {
  // Base URL for REST API
  BASE_URL: __DEV__
    ? 'http://localhost:8080/api/v1'
    : 'https://api.localchat.app/api/v1',

  // WebSocket URL
  WS_URL: __DEV__
    ? 'ws://localhost:8080/ws'
    : 'wss://api.localchat.app/ws',

  // Request timeout in milliseconds
  TIMEOUT: 30000,

  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

/**
 * Storage Keys
 * SecureStore only allows: alphanumeric, ".", "-", "_"
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'localchat.auth_token',
  REFRESH_TOKEN: 'localchat.refresh_token',
  USER_DATA: 'localchat.user_data',
  SETTINGS: 'localchat.settings',
  LANGUAGE: 'localchat.language',
  ONBOARDING_COMPLETE: 'localchat.onboarding_complete',
};

/**
 * Room Configuration
 */
export const ROOM_CONFIG = {
  // Maximum message length
  MAX_MESSAGE_LENGTH: 1000,

  // Default search radius in meters
  DEFAULT_RADIUS: 5000,

  // Maximum participants per room
  MAX_PARTICIPANTS: 50,

  // Duration options in minutes
  DURATION_OPTIONS: {
    short: 60,      // 1 hour
    medium: 180,    // 3 hours
    long: 480,      // 8 hours
    extended: 1440, // 24 hours
  },

  // Refresh interval for room list (ms)
  REFRESH_INTERVAL: 30000,

  /**
   * Timing constants for room card join flow
   * Matches web implementation for consistency
   */
  TIMING: {
    MIN_LOADING_MS: 1500,
    SUCCESS_DISPLAY_MS: 1500,
    ERROR_DISPLAY_MS: 2500,
  },

  /**
   * Button colors for room joining flow
   */
  COLORS: {
    JOIN: theme.tokens.room.join,
    ENTER: theme.tokens.room.enter,
    JOINING: theme.tokens.room.join,
    SUCCESS: theme.tokens.room.success,
    ERROR: theme.tokens.room.error,
    DISABLED: theme.tokens.room.disabled,
    DISABLED_TEXT: theme.tokens.room.disabledText,
  },
};

/**
 * Helper to execute join with minimum loading time
 * Prevents jarring quick flashes of loading states
 */
export async function executeJoinWithMinLoading<T>(
  joinPromise: Promise<T>,
  minLoadingMs: number = ROOM_CONFIG.TIMING.MIN_LOADING_MS
): Promise<T> {
  const [result] = await Promise.all([
    joinPromise,
    new Promise((resolve) => setTimeout(resolve, minLoadingMs))
  ]);
  return result;
}

/**
 * Map Configuration
 */
export const MAP_CONFIG = {
  // Default map center (will be overridden by user location)
  DEFAULT_CENTER: {
    latitude: 37.7749,
    longitude: -122.4194,
  },

  // Default zoom levels
  DEFAULT_ZOOM: 12,
  MIN_ZOOM: 10,
  MAX_ZOOM: 12,

  // Cluster configuration
  CLUSTER_RADIUS: 50,
  MIN_CLUSTER_SIZE: 2,
};

/**
 * Animation Configuration
 */
export const ANIMATION_CONFIG = {
  // Spring animation defaults
  SPRING: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },

  // Duration in milliseconds
  DURATION: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
};

/**
 * WebSocket Events
 * 
 * Event names must match backend ServerMessageSerializer output exactly.
 * Backend uses snake_case for all event types.
 */
export const WS_EVENTS = {
  // Outgoing events (client -> server)
  AUTH: 'auth',
  SUBSCRIBE: 'subscribe_room',
  UNSUBSCRIBE: 'unsubscribe_room',
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',
  UPDATE_PROFILE: 'update_profile',
  PING: 'ping',
  PONG: 'pong',
  SEND_REACTION: 'send_reaction',

  // Incoming events (server -> client)
  AUTH_REQUIRED: 'auth_required',
  AUTH_SUCCESS: 'auth_success',
  AUTH_ERROR: 'auth_error',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  MESSAGE_NEW: 'new_message',
  MESSAGE_ACK: 'message_ack',
  MESSAGE_READ: 'messages_read',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_TYPING: 'typing',
  USER_KICKED: 'user_kicked',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned',
  ROOM_CREATED: 'room_created',
  ROOM_CLOSED: 'room_closed',
  ROOM_UPDATED: 'room_updated',
  ROOM_EXPIRING: 'room_expiring',
  PROFILE_UPDATED: 'profile_updated',
  PARTICIPANT_COUNT: 'participant_count_updated',
  ERROR: 'error',
  SERVER_PING: 'ping',
  SERVER_PONG: 'pong',
  MESSAGE_REACTION: 'message_reaction',
};

/**
 * Category Configuration
 * Matches backend RoomCategory enum exactly
 */
export const CATEGORIES = [
  // Pulse Family
  { id: 'LOST_FOUND', emoji: '🔍', label: 'Lost & Found', color: theme.tokens.categories.lostFound },
  { id: 'TRAFFIC_TRANSIT', emoji: '🚦', label: 'Traffic & Transit', color: theme.tokens.categories.trafficTransit },
  { id: 'SAFETY_HAZARDS', emoji: '🚨', label: 'Safety & Hazards', color: theme.tokens.categories.safetyHazards },

  // Spirit Family
  { id: 'SOCIAL_MEETUPS', emoji: '👋', label: 'Social & Meetups', color: theme.tokens.categories.socialMeetups },
  { id: 'ATMOSPHERE_MUSIC', emoji: '✨', label: 'Atmosphere & Music', color: theme.tokens.categories.atmosphereMusic },
  { id: 'EVENTS_FESTIVALS', emoji: '🎉', label: 'Events & Festivals', color: theme.tokens.categories.eventsFestivals },

  // Flow Family
  { id: 'SIGHTSEEING_GEMS', emoji: '📸', label: 'Hidden Gems & Sightseeing', color: theme.tokens.categories.sightseeingGems },
  { id: 'NEWS_INTEL', emoji: '🎙️', label: 'News & Intel', color: theme.tokens.categories.newsIntel },
  { id: 'RETAIL_WAIT', emoji: '🛍️', label: 'Wait times & Retail', color: theme.tokens.categories.retailWait },

  // Play Family
  { id: 'SPORTS_FITNESS', emoji: '⚽', label: 'Sports & Fitness', color: theme.tokens.categories.sportsFitness },
  { id: 'DEALS_POPUPS', emoji: '🏷️', label: 'Deals & Pop-ups', color: theme.tokens.categories.dealsPopups },
  { id: 'MARKETS_FINDS', emoji: '🧺', label: 'Markets & Finds', color: theme.tokens.categories.marketsFinds },

  // Essential
  { id: 'FOOD_DINING', emoji: '🍕', label: 'Food & Dining', color: theme.tokens.categories.foodDining },
  { id: 'GENERAL', emoji: '💬', label: 'General', color: theme.tokens.categories.general },
] as const;

/**
 * Get emoji for a category ID with fallback
 */
export function getCategoryEmoji(categoryId?: string): string {
  if (!categoryId) return '💬';
  const id = categoryId.toUpperCase();
  // Handle legacy mapping
  if (id === 'NEIGHBORHOOD') return '💬';

  const category = CATEGORIES.find(c => c.id === id);
  return category?.emoji || '💬';
}

/**
 * Get color for a category ID with fallback
 */
export function getCategoryColor(categoryId?: string): string {
  if (!categoryId) return theme.tokens.categories.general;
  const id = categoryId.toUpperCase();
  // Handle legacy mapping
  if (id === 'NEIGHBORHOOD') return theme.tokens.categories.general;

  const category = CATEGORIES.find(c => c.id === id);
  return category?.color || theme.tokens.categories.general;
}
