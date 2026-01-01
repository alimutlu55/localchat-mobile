/**
 * AuthService Unit Tests
 *
 * Tests the auth service in isolation from stores.
 * Validates:
 * - Login/register/logout flows
 * - Token management
 * - Error handling
 * - User data transformation
 */

import { authService } from '../../../src/services/auth';
import { api, ApiError } from '../../../src/services/api';
import { storage, secureStorage } from '../../../src/services/storage';
import { STORAGE_KEYS } from '../../../src/constants';

// Mock dependencies
jest.mock('../../../src/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    setToken: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
    isAuthError() {
      return this.status === 401;
    }
  },
}));

jest.mock('../../../src/services/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
  secureStorage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../../../src/utils/uuid', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-123'),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('AuthService', () => {
  const mockUserDTO = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    profilePhotoUrl: 'https://example.com/avatar.jpg',
    bio: 'Test bio',
    identityMode: 'authenticated',
    verified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastActiveAt: '2024-01-02T00:00:00.000Z',
  };

  const mockAuthResponse = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    user: mockUserDTO,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset device ID cache
    (storage.get as jest.Mock).mockImplementation((key) => {
      if (key === 'device_id') return Promise.resolve('existing-device-id');
      return Promise.resolve(null);
    });
  });

  // ===========================================================================
  // Login Tests
  // ===========================================================================

  describe('login', () => {
    it('calls API with credentials and device info', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      await authService.login('test@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          deviceId: 'existing-device-id',
          devicePlatform: 'ios',
        }),
        { skipAuth: true }
      );
    });

    it('stores tokens on success', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      await authService.login('test@example.com', 'password123');

      expect(api.setToken).toHaveBeenCalledWith('access-token-123');
      expect(secureStorage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        'refresh-token-123'
      );
    });

    it('stores user data on success', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const user = await authService.login('test@example.com', 'password123');

      expect(storage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_DATA,
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
        })
      );
      expect(user.id).toBe('user-123');
    });

    it('transforms user DTO to User model', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const user = await authService.login('test@example.com', 'password123');

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastActiveAt).toBeInstanceOf(Date);
    });

    it('throws on API error', async () => {
      const error = new Error('Invalid credentials');
      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(authService.login('test@example.com', 'wrong'))
        .rejects.toThrow('Invalid credentials');
    });

    it('generates device ID if not exists', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      await authService.login('test@example.com', 'password123');

      expect(storage.set).toHaveBeenCalledWith('device_id', 'mock-uuid-123');
    });
  });

  // ===========================================================================
  // Register Tests
  // ===========================================================================

  describe('register', () => {
    it('calls API with user data', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      await authService.register('test@example.com', 'password123', 'Test User');

      expect(api.post).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User',
          deviceId: 'existing-device-id',
          devicePlatform: 'ios',
        }),
        { skipAuth: true }
      );
    });

    it('stores tokens and user on success', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const user = await authService.register('test@example.com', 'password123', 'Test User');

      expect(api.setToken).toHaveBeenCalledWith('access-token-123');
      expect(user.email).toBe('test@example.com');
    });

    it('throws on email already exists', async () => {
      const error = new Error('Email already registered');
      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(authService.register('existing@example.com', 'password', 'User'))
        .rejects.toThrow('Email already registered');
    });
  });

  // ===========================================================================
  // Anonymous Login Tests
  // ===========================================================================

  describe('loginAnonymous', () => {
    const mockAnonymousResponse = {
      ...mockAuthResponse,
      user: { ...mockUserDTO, identityMode: 'anonymous', email: undefined },
      isNewUser: true,
    };

    it('calls anonymous endpoint', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAnonymousResponse });

      await authService.loginAnonymous();

      expect(api.post).toHaveBeenCalledWith(
        '/auth/anonymous',
        expect.objectContaining({
          deviceId: 'existing-device-id',
          devicePlatform: 'ios',
          appVersion: '1.0.0',
        }),
        { skipAuth: true }
      );
    });

    it('updates display name for new users', async () => {
      (api.post as jest.Mock)
        .mockResolvedValueOnce({ data: mockAnonymousResponse })
        .mockResolvedValueOnce({ data: { ...mockUserDTO, displayName: 'Custom Name' } });
      (api.patch as jest.Mock).mockResolvedValue({
        data: { ...mockUserDTO, displayName: 'Custom Name' },
      });

      await authService.loginAnonymous('Custom Name');

      expect(api.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.objectContaining({ displayName: 'Custom Name' })
      );
    });

    it('does not update name if not new user', async () => {
      const existingUserResponse = { ...mockAnonymousResponse, isNewUser: false };
      (api.post as jest.Mock).mockReset().mockResolvedValue({ data: existingUserResponse });

      await authService.loginAnonymous('Custom Name');

      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Logout Tests
  // ===========================================================================

  describe('logout', () => {
    it('calls logout API', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await authService.logout();

      expect(api.post).toHaveBeenCalledWith('/auth/logout', {});
    });

    it('clears stored tokens', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await authService.logout();

      expect(secureStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_TOKEN);
      expect(secureStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
      expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA);
    });

    it('clears tokens even if API fails', async () => {
      (api.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await authService.logout();

      expect(secureStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_TOKEN);
      expect(secureStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
    });

    it('clears current user', async () => {
      // First login to set user
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });
      await authService.login('test@example.com', 'password');

      expect(authService.getUser()).not.toBeNull();

      // Then logout
      await authService.logout();

      expect(authService.getUser()).toBeNull();
    });
  });

  // ===========================================================================
  // Token Refresh Tests
  // ===========================================================================

  describe('refreshToken', () => {
    it('calls refresh endpoint with stored token', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue('stored-refresh-token');
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const result = await authService.refreshToken();

      expect(api.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'stored-refresh-token' },
        { skipAuth: true }
      );
      expect(result).toBe(true);
    });

    it('returns false if no refresh token stored', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue(null);

      const result = await authService.refreshToken();

      expect(result).toBe(false);
      expect(api.post).not.toHaveBeenCalled();
    });

    it('updates stored tokens on success', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue('old-refresh-token');
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      await authService.refreshToken();

      expect(api.setToken).toHaveBeenCalledWith('access-token-123');
      expect(secureStorage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.REFRESH_TOKEN,
        'refresh-token-123'
      );
    });

    it('returns false on API error', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue('stored-refresh-token');
      (api.post as jest.Mock).mockRejectedValue(new Error('Token expired'));

      const result = await authService.refreshToken();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Initialize Tests
  // ===========================================================================

  describe('initialize', () => {
    it('returns null if no token stored', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue(null);

      const user = await authService.initialize();

      expect(user).toBeNull();
    });

    it('returns cached user and fetches fresh data', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue('valid-token');
      (storage.get as jest.Mock).mockImplementation((key) => {
        if (key === STORAGE_KEYS.USER_DATA) {
          return Promise.resolve({ id: 'cached-user', displayName: 'Cached' });
        }
        return Promise.resolve(null);
      });
      (api.get as jest.Mock).mockResolvedValue({ data: mockUserDTO });

      const user = await authService.initialize();

      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-123');
    });

    it('tries token refresh on 401', async () => {
      const authError = new (require('../../../src/services/api').ApiError)('Unauthorized', 401);
      (secureStorage.get as jest.Mock)
        .mockResolvedValueOnce('expired-token') // AUTH_TOKEN
        .mockResolvedValueOnce('valid-refresh-token'); // REFRESH_TOKEN
      (storage.get as jest.Mock).mockResolvedValue(null);
      (api.get as jest.Mock)
        .mockRejectedValueOnce(authError)
        .mockResolvedValueOnce({ data: mockUserDTO });
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const user = await authService.initialize();

      expect(api.post).toHaveBeenCalledWith(
        '/auth/refresh',
        expect.any(Object),
        { skipAuth: true }
      );
      expect(user).not.toBeNull();
    });

    it('logs out if refresh fails', async () => {
      const authError = new (require('../../../src/services/api').ApiError)('Unauthorized', 401);
      (secureStorage.get as jest.Mock)
        .mockResolvedValueOnce('expired-token')
        .mockResolvedValueOnce('invalid-refresh-token');
      (storage.get as jest.Mock).mockResolvedValue(null);
      (api.get as jest.Mock).mockRejectedValue(authError);
      (api.post as jest.Mock).mockRejectedValue(new Error('Refresh failed'));

      const user = await authService.initialize();

      expect(user).toBeNull();
      expect(secureStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.AUTH_TOKEN);
    });
  });

  // ===========================================================================
  // Get Current User Tests
  // ===========================================================================

  describe('getCurrentUser', () => {
    it('fetches user from API', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUserDTO });

      const user = await authService.getCurrentUser();

      expect(api.get).toHaveBeenCalledWith('/users/me');
      expect(user.id).toBe('user-123');
    });

    it('caches user data locally', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUserDTO });

      await authService.getCurrentUser();

      expect(storage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_DATA,
        expect.objectContaining({ id: 'user-123' })
      );
    });
  });

  // ===========================================================================
  // Update Profile Tests
  // ===========================================================================

  describe('updateProfile', () => {
    it('calls API with updates', async () => {
      (api.patch as jest.Mock).mockResolvedValue({ data: mockUserDTO });

      await authService.updateProfile({ displayName: 'New Name' });

      expect(api.patch).toHaveBeenCalledWith('/users/me', { displayName: 'New Name' });
    });

    it('updates cached user', async () => {
      const updatedUser = { ...mockUserDTO, displayName: 'Updated Name' };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedUser });

      const user = await authService.updateProfile({ displayName: 'Updated Name' });

      expect(user.displayName).toBe('Updated Name');
      expect(storage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_DATA,
        expect.objectContaining({ displayName: 'Updated Name' })
      );
    });
  });

  // ===========================================================================
  // Password Reset Tests
  // ===========================================================================

  describe('requestPasswordReset', () => {
    it('calls forgot password endpoint', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      expect(api.post).toHaveBeenCalledWith(
        '/auth/forgot-password',
        { email: 'test@example.com' },
        { skipAuth: true }
      );
    });
  });

  describe('resetPassword', () => {
    it('calls reset password endpoint', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await authService.resetPassword('reset-token', 'newPassword123');

      expect(api.post).toHaveBeenCalledWith(
        '/auth/reset-password',
        { token: 'reset-token', newPassword: 'newPassword123' },
        { skipAuth: true }
      );
    });
  });

  // ===========================================================================
  // Upgrade Account Tests
  // ===========================================================================

  describe('upgradeAccount', () => {
    it('upgrades anonymous to full account', async () => {
      // First login anonymously
      const anonymousUser = { ...mockUserDTO, identityMode: 'anonymous', email: undefined };
      (api.post as jest.Mock).mockResolvedValueOnce({
        data: { ...mockAuthResponse, user: anonymousUser },
      });
      await authService.loginAnonymous();

      // Then upgrade
      const upgradedUser = { ...mockUserDTO, identityMode: 'authenticated' };
      (api.post as jest.Mock).mockResolvedValueOnce({ data: upgradedUser });

      const user = await authService.upgradeAccount('test@example.com', 'password123');

      expect(api.post).toHaveBeenCalledWith(
        '/users/me/upgrade',
        { email: 'test@example.com', password: 'password123' }
      );
      expect(user.isAnonymous).toBe(false);
    });
  });

  // ===========================================================================
  // isAuthenticated Tests
  // ===========================================================================

  describe('isAuthenticated', () => {
    it('returns true if token exists', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue('valid-token');

      const result = await authService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('returns false if no token', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue(null);

      const result = await authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
