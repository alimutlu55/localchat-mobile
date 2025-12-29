/**
 * Auth Test Mocks
 *
 * Centralized mocks for authentication-related services.
 * These mocks allow isolation of auth logic from network/storage dependencies.
 */

import { User } from '../../src/types';

// =============================================================================
// Mock User Data
// =============================================================================

export const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  profilePhotoUrl: undefined,
  bio: undefined,
  isAnonymous: false,
  createdAt: new Date('2024-01-01'),
  lastActiveAt: new Date(),
};

export const mockAnonymousUser: User = {
  id: 'anon-456',
  email: undefined,
  displayName: 'Anonymous User',
  profilePhotoUrl: undefined,
  bio: undefined,
  isAnonymous: true,
  createdAt: new Date('2024-01-01'),
  lastActiveAt: new Date(),
};

/**
 * Create mock user with optional overrides
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    ...mockUser,
    id: `user-${Date.now()}`,
    ...overrides,
  };
}

// =============================================================================
// Auth Service Mock
// =============================================================================

export const mockAuthService = {
  initialize: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  loginAnonymous: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  getCurrentUser: jest.fn(),
  getUser: jest.fn(),
  isAuthenticated: jest.fn(),
  updateProfile: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  upgradeAccount: jest.fn(),
};

/**
 * Reset auth service mock to default successful behavior
 */
export function resetAuthServiceMock() {
  Object.values(mockAuthService).forEach((fn) => fn.mockReset());

  mockAuthService.initialize.mockResolvedValue(null);
  mockAuthService.login.mockResolvedValue(mockUser);
  mockAuthService.register.mockResolvedValue(mockUser);
  mockAuthService.loginAnonymous.mockResolvedValue(mockAnonymousUser);
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.refreshToken.mockResolvedValue(true);
  mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
  mockAuthService.getUser.mockReturnValue(mockUser);
  mockAuthService.isAuthenticated.mockResolvedValue(false);
  mockAuthService.updateProfile.mockResolvedValue(mockUser);
}

// =============================================================================
// WebSocket Service Mock
// =============================================================================

export const mockWsService = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn(),
  isConnected: jest.fn().mockReturnValue(false),
  getConnectionState: jest.fn().mockReturnValue('disconnected'),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  sendMessage: jest.fn(),
  sendTyping: jest.fn(),
  sendReaction: jest.fn(),
  markRead: jest.fn(),
  updateProfile: jest.fn(),
  on: jest.fn().mockReturnValue(() => {}),
  off: jest.fn(),
  cleanup: jest.fn(),
};

/**
 * Reset WS service mock to default behavior
 */
export function resetWsServiceMock() {
  Object.values(mockWsService).forEach((fn) => {
    if (typeof fn.mockReset === 'function') {
      fn.mockReset();
    }
  });

  mockWsService.connect.mockResolvedValue(true);
  mockWsService.isConnected.mockReturnValue(false);
  mockWsService.getConnectionState.mockReturnValue('disconnected');
  mockWsService.on.mockReturnValue(() => {});
}

// =============================================================================
// Storage Mocks
// =============================================================================

export const mockSecureStorage = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
};

export const mockStorage = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
};

/**
 * Reset storage mocks
 */
export function resetStorageMocks() {
  mockSecureStorage.get.mockReset();
  mockSecureStorage.set.mockReset().mockResolvedValue(undefined);
  mockSecureStorage.remove.mockReset().mockResolvedValue(undefined);

  mockStorage.get.mockReset();
  mockStorage.set.mockReset().mockResolvedValue(undefined);
  mockStorage.remove.mockReset().mockResolvedValue(undefined);
}

// =============================================================================
// API Service Mock
// =============================================================================

export const mockApiService = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
};

/**
 * Reset API service mock
 */
export function resetApiServiceMock() {
  Object.values(mockApiService).forEach((fn) => fn.mockReset());
}

// =============================================================================
// EventBus Mock Helpers
// =============================================================================

/**
 * Create a spy for EventBus that tracks subscriptions
 */
export function createEventBusSpy() {
  const handlers = new Map<string, Set<Function>>();

  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    }),
    off: jest.fn((event: string, handler: Function) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: jest.fn((event: string, payload: unknown) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    }),
    clear: jest.fn(() => {
      handlers.clear();
    }),
    getHandlerCount: (event: string) => handlers.get(event)?.size || 0,
    _handlers: handlers,
  };
}

// =============================================================================
// Reset All Mocks
// =============================================================================

/**
 * Reset all auth-related mocks to default state
 */
export function resetAllAuthMocks() {
  resetAuthServiceMock();
  resetWsServiceMock();
  resetStorageMocks();
  resetApiServiceMock();
}
