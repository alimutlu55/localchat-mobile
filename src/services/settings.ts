/**
 * Settings Service
 *
 * Handles user settings operations.
 */

import { api } from './api';
import { storage } from './storage';

/**
 * View Mode
 */
export type ViewMode = 'list' | 'map';

/**
 * Location Mode
 */
export type LocationMode = 'precise' | 'approximate' | 'manual' | 'off';

/**
 * User Settings from backend
 */
export interface UserSettings {
  defaultView: ViewMode;
  locationMode: LocationMode;
  notificationsEnabled: boolean;
  typingIndicatorsEnabled: boolean;
  profanityFilterEnabled: boolean;
}

/**
 * Update Settings Request
 */
export interface UpdateSettingsRequest {
  defaultView?: ViewMode;
  locationMode?: LocationMode;
  notificationsEnabled?: boolean;
  typingIndicatorsEnabled?: boolean;
  profanityFilterEnabled?: boolean;
}

/**
 * Local Settings (stored on device)
 */
export interface LocalSettings {
  messageNotificationsEnabled: boolean;
  roomUpdatesEnabled: boolean;
  soundsEnabled: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  textSize: 'small' | 'medium' | 'large';
}

const LOCAL_SETTINGS_KEY = '@localchat/local_settings';

const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  messageNotificationsEnabled: true,
  roomUpdatesEnabled: false,
  soundsEnabled: true,
  showOnlineStatus: true,
  showLastSeen: true,
  showReadReceipts: true,
  theme: 'light',
  language: 'en',
  textSize: 'medium',
};

/**
 * Normalize backend response
 */
function normalizeSettings(raw: any): UserSettings {
  return {
    defaultView: (raw.defaultView?.toLowerCase() || 'list') as ViewMode,
    locationMode: (raw.locationMode?.toLowerCase() || 'approximate') as LocationMode,
    notificationsEnabled: raw.notificationsEnabled ?? true,
    typingIndicatorsEnabled: raw.typingIndicatorsEnabled ?? true,
    profanityFilterEnabled: raw.profanityFilterEnabled ?? true,
  };
}

/**
 * Settings Service class
 */
class SettingsService {
  /**
   * Get user settings from backend
   */
  async getSettings(): Promise<UserSettings> {
    const response = await api.get<any>('/users/me/settings');
    return normalizeSettings(response.data || response);
  }

  /**
   * Update user settings on backend
   */
  async updateSettings(updates: UpdateSettingsRequest): Promise<UserSettings> {
    const response = await api.put<any>('/users/me/settings', updates);
    return normalizeSettings(response.data || response);
  }

  /**
   * Get local settings from device storage
   */
  async getLocalSettings(): Promise<LocalSettings> {
    const saved = await storage.get<LocalSettings>(LOCAL_SETTINGS_KEY);
    return saved ? { ...DEFAULT_LOCAL_SETTINGS, ...saved } : DEFAULT_LOCAL_SETTINGS;
  }

  /**
   * Update local settings on device
   */
  async updateLocalSettings(updates: Partial<LocalSettings>): Promise<LocalSettings> {
    const current = await this.getLocalSettings();
    const updated = { ...current, ...updates };
    await storage.set(LOCAL_SETTINGS_KEY, updated);
    return updated;
  }

  /**
   * Reset local settings to defaults
   */
  async resetLocalSettings(): Promise<LocalSettings> {
    await storage.set(LOCAL_SETTINGS_KEY, DEFAULT_LOCAL_SETTINGS);
    return DEFAULT_LOCAL_SETTINGS;
  }
}

export const settingsService = new SettingsService();
export default settingsService;

