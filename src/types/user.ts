/**
 * User Types for LocalChat Mobile
 */

/**
 * User - authenticated user model
 */
export interface User {
  id: string;
  email?: string;
  displayName: string;
  profilePhotoUrl?: string;
  bio?: string;
  isAnonymous: boolean;
  createdAt: Date;
  lastActiveAt?: Date;
}

/**
 * User DTO from backend
 */
export interface UserDTO {
  id: string;
  email?: string;
  displayName: string;
  profilePhotoUrl?: string;
  bio?: string;
  identityMode: 'anonymous' | 'authenticated';
  verified?: boolean;
  createdAt: string;
  lastActiveAt?: string;
}

/**
 * Auth State
 */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
}

/**
 * Login Request
 */
export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  devicePlatform?: 'ios' | 'android' | 'web';
}

/**
 * Register Request
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  deviceId?: string;
  devicePlatform?: 'ios' | 'android' | 'web';
}

/**
 * Anonymous Login Request
 */
export interface AnonymousLoginRequest {
  deviceId: string;
  devicePlatform: 'ios' | 'android' | 'web';
  appVersion: string;
}

/**
 * Auth Response from backend
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser?: boolean;
  user: UserDTO;
}

/**
 * Profile Update Request
 */
export interface ProfileUpdateRequest {
  displayName?: string;
  profilePhotoUrl?: string;
  bio?: string;
}

/**
 * Google OAuth Login Request
 */
export interface GoogleLoginRequest {
  idToken: string;
  deviceId?: string;
  devicePlatform?: 'ios' | 'android' | 'web';
}
