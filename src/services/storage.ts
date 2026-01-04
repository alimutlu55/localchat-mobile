/**
 * Storage Service
 *
 * Provides a unified interface for persistent storage in React Native.
 * Uses AsyncStorage for general data and SecureStore for sensitive data.
 *
 * @example
 * ```typescript
 * // Store user preferences
 * await storage.set('theme', 'dark');
 * const theme = await storage.get('theme');
 *
 * // Store sensitive data securely
 * await storage.setSecure('auth_token', token);
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Standard storage operations using AsyncStorage
 */
export const storage = {
  /**
   * Get a value from storage
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`Storage.get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a value in storage
   */
  async set(key: string, value: unknown): Promise<boolean> {
    try {
      const stringValue = typeof value === 'string'
        ? value
        : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
      return true;
    } catch (error) {
      console.error(`Storage.set error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Remove a value from storage
   */
  async remove(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Storage.remove error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Clear all storage
   */
  async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage.clear error:', error);
      return false;
    }
  },

  /**
   * Get all keys in storage
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    } catch (error) {
      console.error('Storage.getAllKeys error:', error);
      return [];
    }
  },

  /**
   * Get multiple values at once
   */
  async multiGet<T = string>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result = new Map<string, T | null>();

      for (const [key, value] of pairs) {
        if (value === null) {
          result.set(key, null);
        } else {
          try {
            result.set(key, JSON.parse(value) as T);
          } catch {
            result.set(key, value as unknown as T);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Storage.multiGet error:', error);
      return new Map();
    }
  },
};

/**
 * Secure storage operations using SecureStore
 * Use for sensitive data like tokens, passwords, etc.
 */
export const secureStorage = {
  /**
   * Get a value from secure storage
   */
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStorage.get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a value in secure storage
   */
  async set(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error(`SecureStorage.set error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Remove a value from secure storage
   */
  async remove(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error(`SecureStorage.remove error for key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Device storage for device-specific identifiers
 */
const DEVICE_ID_KEY = '@localchat/device_id';

export const deviceStorage = {
  /**
   * Get device ID, generating one if it doesn't exist
   */
  async getDeviceId(): Promise<string> {
    const existing = await storage.get<string>(DEVICE_ID_KEY);
    if (existing) return existing;

    // Generate new UUID
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    await storage.set(DEVICE_ID_KEY, newId);
    return newId;
  },

  /**
   * Set device ID
   */
  async setDeviceId(deviceId: string): Promise<boolean> {
    return storage.set(DEVICE_ID_KEY, deviceId);
  },
};

export default storage;

