import Constants from 'expo-constants';

/**
 * Single source of truth for the app version.
 * Pulled from app.json (version field).
 */
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
