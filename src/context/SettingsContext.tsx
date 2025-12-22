/**
 * SettingsContext - App Settings State Management
 *
 * Manages user settings (both backend and local).
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { settingsService, UserSettings, LocalSettings } from '../services';
import { useAuth } from './AuthContext';

/**
 * Combined App Settings
 */
export interface AppSettings {
  // Backend-synced settings
  defaultView: 'list' | 'map';
  locationMode: 'precise' | 'approximate' | 'manual' | 'off';
  notificationsEnabled: boolean;
  typingIndicatorsEnabled: boolean;
  profanityFilterEnabled: boolean;
  // Local-only settings
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

const DEFAULT_SETTINGS: AppSettings = {
  defaultView: 'list',
  locationMode: 'approximate',
  notificationsEnabled: true,
  typingIndicatorsEnabled: true,
  profanityFilterEnabled: true,
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
 * Settings Context Value
 */
interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Backend setting keys
 */
const BACKEND_KEYS: (keyof UserSettings)[] = [
  'defaultView',
  'locationMode',
  'notificationsEnabled',
  'typingIndicatorsEnabled',
  'profanityFilterEnabled',
];

/**
 * Settings Provider Props
 */
interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * Settings Provider Component
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load settings
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load local settings
      const localSettings = await settingsService.getLocalSettings();

      let backendSettings: UserSettings | null = null;

      if (isAuthenticated) {
        try {
          backendSettings = await settingsService.getSettings();
        } catch (e) {
          console.log('Could not load backend settings');
        }
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...localSettings,
        ...(backendSettings || {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    // Separate backend and local updates
    const backendUpdates: Partial<UserSettings> = {};
    const localUpdates: Partial<LocalSettings> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (BACKEND_KEYS.includes(key as keyof UserSettings)) {
        (backendUpdates as any)[key] = value;
      } else {
        (localUpdates as any)[key] = value;
      }
    }

    // Update state optimistically
    setSettings(prev => ({ ...prev, ...updates }));

    try {
      // Update local settings
      if (Object.keys(localUpdates).length > 0) {
        await settingsService.updateLocalSettings(localUpdates);
      }

      // Update backend settings
      if (Object.keys(backendUpdates).length > 0 && isAuthenticated) {
        await settingsService.updateSettings(backendUpdates);
      }
    } catch (err) {
      // Revert on error
      await loadSettings();
      throw err;
    }
  }, [isAuthenticated, loadSettings]);

  /**
   * Refresh settings
   */
  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  /**
   * Load on mount and auth change
   */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const value: SettingsContextValue = {
    settings,
    isLoading,
    error,
    updateSettings,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * useSettings Hook
 */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default SettingsContext;

