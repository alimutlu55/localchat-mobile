/**
 * Auth Service
 *
 * Handles all authentication-related operations including login,
 * registration, token management, and session handling.
 */

import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants';
import { storage, secureStorage } from './storage';
import { api, ApiError } from './api';
import {
  User,
  UserDTO,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AnonymousLoginRequest,
  ProfileUpdateRequest
} from '../types';

/**
 * Transform UserDTO to User model
 */
function transformUserDTO(dto: UserDTO): User {
  return {
    id: dto.id,
    email: dto.email,
    displayName: dto.displayName,
    profilePhotoUrl: dto.profilePhotoUrl,
    isAnonymous: dto.isAnonymous,
    createdAt: new Date(dto.createdAt),
    lastActiveAt: dto.lastActiveAt ? new Date(dto.lastActiveAt) : undefined,
  };
}

/**
 * Auth Service class
 */
class AuthService {
  private currentUser: User | null = null;

  /**
   * Initialize auth service - load cached user
   */
  async initialize(): Promise<User | null> {
    try {
      const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        return null;
      }

      // Load cached user data
      const cachedUser = await storage.get<User>(STORAGE_KEYS.USER_DATA);
      if (cachedUser) {
        this.currentUser = cachedUser;
      }

      // Validate token and get fresh user data
      try {
        const user = await this.getCurrentUser();
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError()) {
          // Token is invalid, try to refresh
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return this.getCurrentUser();
          }
          // Refresh failed, clear auth state
          await this.logout();
        }
        return null;
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  }

  /**
   * Get or create device ID
   */
  private async getDeviceId(): Promise<string> {
    let deviceId = await storage.get<string>('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      await storage.set('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get device platform
   */
  private getDevicePlatform(): 'ios' | 'android' | 'web' {
    return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  }

  /**
   * Login with email and password
   * Backend returns: { data: { accessToken, refreshToken, user } }
   */
  async login(email: string, password: string): Promise<User> {
    const deviceId = await this.getDeviceId();
    const request: LoginRequest = {
      email,
      password,
      deviceId,
      devicePlatform: this.getDevicePlatform(),
    };

    const response = await api.post<{ data: AuthResponse }>('/auth/login', request, { skipAuth: true });
    await this.handleAuthResponse(response.data);
    return this.currentUser!;
  }

  /**
   * Register new user
   * Backend returns: { data: { accessToken, refreshToken, user } }
   */
  async register(email: string, password: string, displayName: string): Promise<User> {
    const deviceId = await this.getDeviceId();
    const request: RegisterRequest = {
      email,
      password,
      displayName,
      deviceId,
      devicePlatform: this.getDevicePlatform(),
    };

    const response = await api.post<{ data: AuthResponse }>('/auth/register', request, { skipAuth: true });
    await this.handleAuthResponse(response.data);
    return this.currentUser!;
  }

  /**
   * Login anonymously
   * Backend returns: { data: { accessToken, refreshToken, user, isNewUser } }
   */
  async loginAnonymous(displayName?: string): Promise<User> {
    const deviceId = await this.getDeviceId();

    const request: AnonymousLoginRequest = {
      deviceId,
      devicePlatform: this.getDevicePlatform(),
      appVersion: '1.0.0',
    };

    const response = await api.post<{ data: AuthResponse & { isNewUser?: boolean } }>('/auth/anonymous', request, { skipAuth: true });
    await this.handleAuthResponse(response.data);

    // If display name provided and this is a new user, update profile
    if (displayName && response.data.isNewUser) {
      await this.updateProfile({ displayName });
    }

    return this.currentUser!;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Notify server (best effort)
      await api.post('/auth/logout', {}).catch(() => { });
    } finally {
      // Clear local state
      await secureStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);
      await storage.remove(STORAGE_KEYS.USER_DATA);
      this.currentUser = null;
    }
  }

  /**
   * Refresh authentication token
   * Backend returns: { data: { accessToken, refreshToken, user } }
   */
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await secureStorage.get(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        return false;
      }

      const response = await api.post<{ data: AuthResponse }>(
        '/auth/refresh',
        { refreshToken },
        { skipAuth: true }
      );

      await this.handleAuthResponse(response.data);
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Get current user from server
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<{ data: UserDTO }>('/users/me');
    const user = transformUserDTO(response.data);
    this.currentUser = user;
    await storage.set(STORAGE_KEYS.USER_DATA, user);
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: ProfileUpdateRequest): Promise<User> {
    const response = await api.patch<{ data: UserDTO }>('/users/me', updates);
    const user = transformUserDTO(response.data);
    this.currentUser = user;
    await storage.set(STORAGE_KEYS.USER_DATA, user);
    return user;
  }

  /**
   * Upgrade anonymous account to full account
   */
  async upgradeAccount(email: string, password: string): Promise<User> {
    const response = await api.post<{ data: UserDTO }>('/users/me/upgrade', { email, password });
    const user = transformUserDTO(response.data);
    this.currentUser = { ...this.currentUser!, ...user, isAnonymous: false };
    await storage.set(STORAGE_KEYS.USER_DATA, this.currentUser);
    return this.currentUser;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email }, { skipAuth: true });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword }, { skipAuth: true });
  }

  /**
   * Handle auth response - store tokens and user data
   */
  private async handleAuthResponse(response: AuthResponse): Promise<void> {
    const { accessToken, refreshToken, user } = response;

    // Store access token via API client (also persists to secure storage)
    await api.setToken(accessToken);

    // Store refresh token
    if (refreshToken) {
      await secureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    // Transform and store user data
    this.currentUser = transformUserDTO(user);
    await storage.set(STORAGE_KEYS.USER_DATA, this.currentUser);
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Singleton auth service instance
 */
export const authService = new AuthService();

export default authService;

