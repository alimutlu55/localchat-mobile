/**
 * Auth Test Utilities
 *
 * Shared utilities for testing authentication flows.
 * These helpers make tests more readable and reduce boilerplate.
 */

import { act, waitFor } from '@testing-library/react-native';
import { useAuthStore, AuthStatus } from '../../src/features/auth/store/AuthStore';
import { useUserStore } from '../../src/features/user/store/UserStore';
import { useRoomStore } from '../../src/features/rooms/store/RoomStore';
import { eventBus } from '../../src/core/events';
import { mockUser, createMockUser } from '../mocks/authMocks';
import { User } from '../../src/types';

// =============================================================================
// Store Reset Utilities
// =============================================================================

/**
 * Initial state for AuthStore
 */
export const initialAuthState = {
  status: 'unknown' as AuthStatus,
  isInitializing: true,
  isLoading: false,
  error: null,
  isAuthenticated: false,
};
/**
 * Reset AuthStore to initial state
 */
export function resetAuthStore() {
  useAuthStore.setState(initialAuthState);
}

/**
 * Reset UserStore to initial state
 */
export function resetUserStore() {
  const store = useUserStore.getState();
  if (typeof store.clearUser === 'function') {
    store.clearUser();
  } else {
    useUserStore.setState({ currentUser: null } as any);
  }
}

/**
 * Reset RoomStore to initial state
 */
export function resetRoomStore() {
  useRoomStore.getState().reset?.();
}

/**
 * Reset all stores to initial state and clear EventBus
 */
export function resetAllStores() {
  resetAuthStore();
  resetUserStore();
  resetRoomStore();
  eventBus.clear();
}

// =============================================================================
// State Setup Utilities
// =============================================================================

/**
 * Set up authenticated state with mock user
 */
export function setupAuthenticatedState(user: User = mockUser) {
  useAuthStore.setState({
    status: 'authenticated',
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
  });

  const userStore = useUserStore.getState();
  if (typeof userStore.setUser === 'function') {
    userStore.setUser(user);
  } else {
    useUserStore.setState({ currentUser: user } as any);
  }
}
/**
 * Set up guest state (not authenticated)
 */
export function setupGuestState() {
  useAuthStore.setState({
    status: 'guest',
    isAuthenticated: false,
    isInitializing: false,
    isLoading: false,
    error: null,
  });
  resetUserStore();
}

/**
 * Set up loading state (app initializing)
 */
export function setupLoadingState() {
  useAuthStore.setState({
    status: 'loading',
    isAuthenticated: false,
    isInitializing: true,
    isLoading: true,
    error: null,
  });
  resetUserStore();
}

/**
 * Set up authenticating state (login in progress)
 */
export function setupAuthenticatingState() {
  useAuthStore.setState({
    status: 'authenticating',
    isAuthenticated: false,
    isInitializing: false,
    isLoading: true,
    error: null,
  });
  resetUserStore();
}

/**
 * Set up logging out state
 */
export function setupLoggingOutState(user: User = mockUser) {
  useAuthStore.setState({
    status: 'loggingOut',
    isAuthenticated: true,
    isInitializing: false,
    isLoading: true,
    error: null,
  });

  const userStore = useUserStore.getState();
  if (typeof userStore.setUser === 'function') {
    userStore.setUser(user);
  } else {
    useUserStore.setState({ currentUser: user } as any);
  }
}

// =============================================================================
// Async Helpers
// =============================================================================

/**
 * Wait for auth state to reach target status
 * @param targetStatus - The auth status to wait for
 * @param timeout - Maximum time to wait in ms (default: 5000)
 */
export async function waitForAuthState(
  targetStatus: AuthStatus,
  timeout = 5000
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for auth status: ${targetStatus}`));
    }, timeout);

    // Check immediately
    if (useAuthStore.getState().status === targetStatus) {
      clearTimeout(timer);
      resolve();
      return;
    }

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.status === targetStatus) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Wait for auth state to NOT be a specific status
 */
export async function waitForAuthStateNot(
  notStatus: AuthStatus,
  timeout = 5000
): Promise<AuthStatus> {
  return new Promise<AuthStatus>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for auth status to change from: ${notStatus}`));
    }, timeout);

    // Check immediately
    const currentStatus = useAuthStore.getState().status;
    if (currentStatus !== notStatus) {
      clearTimeout(timer);
      resolve(currentStatus);
      return;
    }

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.status !== notStatus) {
        clearTimeout(timer);
        unsubscribe();
        resolve(state.status);
      }
    });
  });
}

/**
 * Perform login and wait for authenticated state
 */
export async function performLogin(
  email = 'test@example.com',
  password = 'password123'
): Promise<void> {
  await act(async () => {
    await useAuthStore.getState().login(email, password);
  });
  await waitFor(() => {
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
}

/**
 * Perform logout and wait for guest state
 */
export async function performLogout(): Promise<void> {
  await act(async () => {
    await useAuthStore.getState().logout();
  });
  await waitFor(() => {
    expect(useAuthStore.getState().status).toBe('guest');
  });
}

// =============================================================================
// State Transition Recording
// =============================================================================

/**
 * Record auth state transitions for verification
 */
export function recordStateTransitions(): {
  getTransitions: () => AuthStatus[];
  stop: () => void;
} {
  const transitions: AuthStatus[] = [useAuthStore.getState().status];

  const unsubscribe = useAuthStore.subscribe((state) => {
    const lastStatus = transitions[transitions.length - 1];
    if (state.status !== lastStatus) {
      transitions.push(state.status);
    }
  });

  return {
    getTransitions: () => [...transitions],
    stop: unsubscribe,
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that auth state invariants hold
 */
export function assertAuthInvariants() {
  const state = useAuthStore.getState();

  // Invariant 1: authenticated status requires non-null user in getUser()
  if (state.status === 'authenticated') {
    const user = state.getUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBeDefined();
  }

  // Invariant 2: guest status requires null in getUser()
  if (state.status === 'guest') {
    expect(state.getUser()).toBeNull();
  }
  // Invariant 3: isAuthenticated matches status
  expect(state.isAuthenticated).toBe(state.status === 'authenticated');

  // Invariant 4: isTransitioning helper works correctly
  const transitioningStates: AuthStatus[] = ['unknown', 'loading', 'authenticating', 'loggingOut'];
  expect(state.isTransitioning?.() ?? transitioningStates.includes(state.status)).toBe(
    transitioningStates.includes(state.status)
  );
}

/**
 * Assert valid state transition
 */
export function assertValidTransition(from: AuthStatus, to: AuthStatus) {
  const validTransitions: Record<AuthStatus, AuthStatus[]> = {
    unknown: ['loading'],
    loading: ['guest', 'authenticated'],
    guest: ['authenticating'],
    authenticating: ['authenticated', 'guest'],
    authenticated: ['loggingOut'],
    loggingOut: ['guest'],
  };

  expect(validTransitions[from]).toContain(to);
}

// =============================================================================
// Mock Data Factories
// =============================================================================

export { createMockUser };

/**
 * Create multiple mock users
 */
export function createMockUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUser({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      displayName: `User ${i + 1}`,
    })
  );
}

// =============================================================================
// Cleanup Verification
// =============================================================================

/**
 * Verify that cleanup was performed correctly after logout
 */
export function assertCleanupComplete() {
  const authState = useAuthStore.getState();
  const userState = useUserStore.getState();

  // Auth store should be in guest state
  expect(authState.status).toBe('guest');
  expect(authState.getUser()).toBeNull();
  expect(authState.isAuthenticated).toBe(false);

  // User store should be cleared
  const currentUser = userState.currentUser || (userState as any).user;
  expect(currentUser).toBeFalsy();

  // Room store should be reset (check if function exists)
  const roomState = useRoomStore.getState();
  if ('activeRoomId' in roomState) {
    expect(roomState.activeRoomId).toBeNull();
  }
}
// =============================================================================
// Time Control Helpers
// =============================================================================

/**
 * Advance timers and flush promises
 */
export async function advanceTimersAndFlush(ms: number) {
  jest.advanceTimersByTime(ms);
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

/**
 * Run all timers and flush promises
 */
export async function runAllTimersAndFlush() {
  jest.runAllTimers();
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}
