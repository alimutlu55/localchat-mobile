/**
 * Application Constants
 *
 * Centralized configuration for the LocalChat mobile app.
 * Environment-specific values should be loaded from env variables in production.
 */

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
    JOIN: '#f97316',       // Orange
    ENTER: '#22c55e',      // Green
    JOINING: '#f97316',    // Orange (with opacity in UI)
    SUCCESS: '#22c55e',    // Green
    ERROR: '#ef4444',      // Red
    DISABLED: '#d1d5db',   // Gray
    DISABLED_TEXT: '#6b7280',
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
  DEFAULT_ZOOM: 14,
  MIN_ZOOM: 10,
  MAX_ZOOM: 18,

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
  { id: 'FOOD', emoji: '🍕', label: 'Food & Dining', color: '#f97316' },
  { id: 'EVENTS', emoji: '🎉', label: 'Events & Gatherings', color: '#f59e0b' },
  { id: 'SPORTS', emoji: '⚽', label: 'Sports & Recreation', color: '#22c55e' },
  { id: 'TRAFFIC', emoji: '🚗', label: 'Traffic & Transit', color: '#3b82f6' },
  { id: 'NEIGHBORHOOD', emoji: '🏘️', label: 'Neighborhood', color: '#8b5cf6' },
  { id: 'LOST_FOUND', emoji: '🔍', label: 'Lost & Found', color: '#ec4899' },
  { id: 'EMERGENCY', emoji: '🚨', label: 'Emergency & Safety', color: '#ef4444' },
  { id: 'GENERAL', emoji: '💬', label: 'General', color: '#6366f1' },
] as const;

