/**
 * API Client Service - Mobile
 *
 * Handles all HTTP requests to the backend API with:
 * - JWT token management
 * - Automatic token refresh on 401
 * - Request/response error handling
 *
 * Mirrors the web implementation at localchat-ui/src/services/api.ts
 */

import { API_CONFIG, STORAGE_KEYS } from '../constants';
import { secureStorage } from './storage';

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isNetworkError(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }
}

/**
 * Request options interface
 */
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

/**
 * Auth error callback type
 */
type AuthErrorCallback = () => void;

/**
 * API Client class - manages tokens internally like the web version
 */
class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private accessToken: string | null = null;
  private onAuthError?: AuthErrorCallback;
  private initialized = false;

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Initialize - load token from secure storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.accessToken = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
    this.initialized = true;
  }

  /**
   * Set the access token and persist to secure storage
   */
  async setToken(token: string): Promise<void> {
    this.accessToken = token;
    await secureStorage.set(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * Get the current access token
   */
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Clear all tokens (logout)
   */
  async clearToken(): Promise<void> {
    this.accessToken = null;
    await secureStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
    await secureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Set callback for auth errors (e.g., logout user)
   */
  setAuthErrorCallback(callback: AuthErrorCallback): void {
    this.onAuthError = callback;
  }

  /**
   * Core request method with error handling and token refresh
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    // Ensure initialized
    await this.initialize();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    };

    if (!options?.skipAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? this.timeout
    );

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && !options?.skipAuth) {
        const refreshed = await this.handleTokenRefresh();
        if (refreshed) {
          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });
          return this.handleResponse<T>(retryResponse);
        }
        // Refresh failed - clear tokens and notify
        await this.clearToken();
        this.onAuthError?.();
        throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired. Please log in again.');
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(0, 'TIMEOUT', 'Request timed out');
        }
        throw new ApiError(0, 'NETWORK_ERROR', error.message);
      }
      throw new ApiError(0, 'UNKNOWN', 'An unexpected error occurred');
    }
  }

  /**
   * Handle response parsing and error extraction
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Handle empty body (201 Created with no content, etc.)
    const text = await response.text();
    if (!text || text.trim() === '') {
      if (response.ok) {
        return {} as T;
      }
      throw new ApiError(
        response.status,
        'API_ERROR',
        `Request failed with status ${response.status}`
      );
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (response.ok) {
        return {} as T;
      }
      throw new ApiError(
        response.status,
        'PARSE_ERROR',
        `Failed to parse response: ${text.substring(0, 100)}`
      );
    }

    if (!response.ok) {
      const errorResponse = data as ApiErrorResponse;
      const message = errorResponse.error?.message || `Request failed with status ${response.status}`;
      throw new ApiError(
        response.status,
        errorResponse.error?.code || 'API_ERROR',
        message,
        errorResponse.error?.details
      );
    }

    return data as T;
  }

  /**
   * Handle token refresh with deduplication
   * Can be called externally (e.g., by WebSocket service) when auth fails
   */
  async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that promise
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = await secureStorage.get(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return false;
    }

    isRefreshing = true;
    refreshPromise = this.performTokenRefresh(refreshToken);

    try {
      return await refreshPromise;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }

  /**
   * Handle token refresh (internal)
   */
  private async handleTokenRefresh(): Promise<boolean> {
    return this.refreshAccessToken();
  }

  /**
   * Perform the actual token refresh API call
   */
  private async performTokenRefresh(refreshToken: string): Promise<boolean> {
    try {
      console.log('[API] Attempting token refresh...');
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns: { data: { accessToken, refreshToken, ... } }
        const newAccessToken = data.data?.accessToken || data.accessToken;
        const newRefreshToken = data.data?.refreshToken || data.refreshToken;

        if (newAccessToken) {
          await this.setToken(newAccessToken);
          if (newRefreshToken) {
            await secureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
          }
          console.log('[API] Token refresh successful');
          return true;
        }
      }
      console.warn('[API] Token refresh failed with status:', response.status);
    } catch (error) {
      console.error('[API] Token refresh error:', error);
    }
    return false;
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, body, options);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, body, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}

// Singleton instance
export const api = new ApiClient();
