/**
 * AuthStore - Zustand-based Authentication State Management
 *
 * Handles authentication flows using a state machine approach.
 * 
 * State Machine:
 *   unknown → loading → guest ←─────────────┐
 *                ↓        ↓                  │
 *                ↓   authenticating          │
 *                ↓        ↓                  │
 *                └──→ authenticated ────→ loggingOut
 *
 * Design Principles:
 * - State machine prevents race conditions during auth transitions
 * - Explicit states for loading/logout prevent crashes from stale closures
 * - Works with UserStore: After login, calls UserStore.setUser()
 * - Manages WebSocket: Connects/disconnects on auth state change
 * - Cleanup is orchestrated before state transitions
 */

import { create } from 'zustand';
import { authService } from '../../../services/auth';
import { wsService } from '../../../services';
import { useUserStore } from '../../user/store/UserStore';
import { useRoomStore } from '../../rooms/store/RoomStore';
import { useAppStore } from '../../../shared/stores';
import { eventBus } from '../../../core/events';
import { createLogger } from '../../../shared/utils/logger';
import { getErrorMessage } from '../../../shared/utils/errors';
import { User } from '../../../types';

const log = createLogger('AuthStore');

// =============================================================================
// Auth Status (State Machine)
// =============================================================================

/**
 * Authentication status representing discrete states in the auth lifecycle.
 * Using explicit states prevents race conditions during transitions.
 */
export type AuthStatus =
    | 'unknown'        // App just opened, haven't checked storage yet
    | 'loading'        // Checking stored credentials
    | 'guest'          // No authenticated user, show auth screens
    | 'authenticating' // Login/register in progress
    | 'authenticated'  // User is logged in
    | 'loggingOut';    // Logout in progress, cleanup running

// =============================================================================
// Types
// =============================================================================

export interface AuthStoreState {
    /**
     * Current auth status (state machine state)
     * Replaces boolean isAuthenticated for safer transitions
     */
    status: AuthStatus;

    /**
     * Current authenticated user (single source of truth)
     * @deprecated Use UserStore.currentUser instead
     */
    user?: User | null;

    /**
     * Whether auth is still initializing (app startup)
     * @deprecated Use status === 'unknown' || status === 'loading' instead
     */
    isInitializing: boolean;

    /**
     * Loading state for auth operations (login, register, etc)
     * @deprecated Use status === 'authenticating' instead
     */
    isLoading: boolean;

    /**
     * Error message from auth operations
     */
    error: string | null;

    /**
     * Whether user is authenticated
     * @deprecated Use status === 'authenticated' instead
     */
    isAuthenticated: boolean;
}

export interface AuthStoreActions {
    /**
     * Login with email and password
     */
    login: (email: string, password: string) => Promise<void>;

    /**
     * Register new user
     */
    register: (email: string, password: string, displayName: string) => Promise<void>;

    loginAnonymous: (displayName?: string) => Promise<void>;

    /**
     * Try to restore an existing anonymous session
     */
    tryRestoreAnonymousSession: () => Promise<{ user: User | null; isNewUser: boolean }>;

    /**
     * Login with Google OAuth
     */
    loginWithGoogle: (idToken: string) => Promise<void>;

    /**
     * Logout user - orchestrated cleanup before state transition
     */
    logout: () => Promise<void>;

    /**
     * Delete user account - soft delete, irreversible
     * Calls API, clears session, transitions to guest
     */
    deleteAccount: () => Promise<void>;

    /**
     * Hard delete user account and ALL data - irreversible
     * Calls API, clears session, transitions to guest
     */
    hardDeleteAccount: () => Promise<void>;

    /**
     * Clear error message
     */
    clearError: () => void;

    /**
     * Update loading state
     * @deprecated Use status transitions instead
     */
    setLoading: (isLoading: boolean) => void;

    /**
     * Set error
     */
    setError: (error: string | null) => void;

    /**
     * Update isAuthenticated flag
     * @deprecated Use status transitions instead
     */
    setAuthenticated: (isAuthenticated: boolean) => void;

    /**
     * Get the current user synchronously
     * Returns null if not authenticated
     */
    getUser: () => User | null;

    /**
     * Check if currently in a transition state (loading, authenticating, loggingOut)
     * Navigation should show loading screen during transitions
     */
    isTransitioning: () => boolean;
}

export type AuthStore = AuthStoreState & AuthStoreActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: AuthStoreState = {
    status: 'unknown',
    isInitializing: true, // Deprecated - kept for backward compatibility
    isLoading: false, // Deprecated - kept for backward compatibility
    error: null,
    isAuthenticated: false, // Deprecated - kept for backward compatibility
};

// =============================================================================
// Helper: Orchestrated Session Cleanup
// =============================================================================

/**
 * Performs cleanup in deterministic order during logout.
 * This prevents race conditions where components access cleared state.
 */
async function cleanupSession(): Promise<void> {
    log.debug('Starting session cleanup...');

    // 1. Disconnect WebSocket first (stops incoming events)
    wsService.disconnect();

    // 2. Small delay to allow pending WS operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 3. Clear room store (removes all room subscriptions and data)
    useRoomStore.getState().reset();

    // 4. Clear user store
    useUserStore.getState().clearUser();

    // 5. Clear auth tokens from storage
    await authService.logout();

    log.debug('Session cleanup complete');
}

/**
 * Minimum time to show loading screen during logout.
 * This prevents jarring flickering when logout is very fast.
 */
const MIN_LOGOUT_DURATION_MS = 400;

// =============================================================================
// Store Implementation
// =============================================================================

export const useAuthStore = create<AuthStore>()((set, get) => ({
    // Initial state
    ...initialState,

    // =========================================================================
    // Actions
    // =========================================================================

    login: async (email: string, password: string) => {
        const currentStatus = get().status;

        // Prevent login if already authenticated or in transition
        if (currentStatus === 'authenticated' || currentStatus === 'authenticating' || currentStatus === 'loggingOut') {
            log.warn('Login blocked - invalid state', { currentStatus });
            return;
        }

        set({ status: 'authenticating', isLoading: true, error: null });
        useAppStore.getState().setAuthState('authenticating', null);

        try {
            log.debug('Login attempt', { email });

            // Call auth service
            const user = await authService.login(email, password);

            // Update UserStore with logged-in user (kept for backward compatibility)
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({
                status: 'authenticated',
                isAuthenticated: true,
                isLoading: false,
                isInitializing: false,
            });
            useAppStore.getState().setAuthState('authenticated', user.id);
            eventBus.emit('session.authChanged', { isAuthenticated: true, user });
            log.debug('Login successful', { userId: user.id });
        } catch (err) {
            const message = getErrorMessage(err, 'Login failed');
            log.warn('Login unsuccessful', { reason: message });
            set({
                status: 'guest',
                error: message,
                isLoading: false,
                isAuthenticated: false,
            });
            throw err;
        }
    },

    register: async (email: string, password: string, displayName: string) => {
        const currentStatus = get().status;

        // Prevent register if already authenticated or in transition
        if (currentStatus === 'authenticated' || currentStatus === 'authenticating' || currentStatus === 'loggingOut') {
            log.warn('Register blocked - invalid state', { currentStatus });
            return;
        }

        set({ status: 'authenticating', isLoading: true, error: null });
        useAppStore.getState().setAuthState('authenticating', null);

        try {
            log.debug('Register attempt', { email, displayName });

            // Call auth service
            const user = await authService.register(email, password, displayName);

            // Update UserStore with new user (kept for backward compatibility)
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({
                status: 'authenticated',
                isAuthenticated: true,
                isLoading: false,
                isInitializing: false,
            });
            useAppStore.getState().setAuthState('authenticated', user.id);
            eventBus.emit('session.authChanged', { isAuthenticated: true, user });
            log.debug('Registration successful', { userId: user.id });
        } catch (err) {
            const message = getErrorMessage(err, 'Registration failed');
            log.warn('Registration unsuccessful', { reason: message });
            set({
                status: 'guest',
                error: message,
                isLoading: false,
                isAuthenticated: false,
            });
            useAppStore.getState().setAuthState('guest', null);
            throw err;
        }
    },

    tryRestoreAnonymousSession: async () => {
        const currentStatus = get().status;

        // Only allow restoration if in a neutral state
        if (currentStatus === 'authenticated' || currentStatus === 'authenticating' || currentStatus === 'loggingOut') {
            log.warn('Session restore blocked - invalid state', { currentStatus });
            return { user: get().user || null, isNewUser: false };
        }

        set({ status: 'authenticating', isLoading: true, error: null });
        useAppStore.getState().setAuthState('authenticating', null);

        try {
            log.debug('Anonymous session restoration attempt');

            // Call auth service
            const result = await authService.tryRestoreAnonymousSession();

            if (result.user && !result.isNewUser) {
                // Existing user restored!
                useUserStore.getState().setUser(result.user);
                await wsService.connect();

                set({
                    status: 'authenticated',
                    isAuthenticated: true,
                    isLoading: false,
                    isInitializing: false,
                    user: result.user
                });
                useAppStore.getState().setAuthState('authenticated', result.user.id);
                eventBus.emit('session.authChanged', { isAuthenticated: true, user: result.user });
                log.debug('Anonymous session restoration successful', { userId: result.user.id });
            } else {
                // No existing user found, or it's a new device
                set({
                    status: 'guest',
                    isLoading: false,
                    isAuthenticated: false,
                });
                useAppStore.getState().setAuthState('guest', null);
                log.debug('No anonymous session found to restore');
            }

            return result;
        } catch (err) {
            const message = getErrorMessage(err, 'Session restoration failed');
            log.warn('Anonymous session restoration error', { reason: message });
            set({
                status: 'guest',
                error: message,
                isLoading: false,
                isAuthenticated: false,
            });
            return { user: null, isNewUser: true };
        }
    },

    loginAnonymous: async (displayName?: string) => {
        const currentStatus = get().status;

        // Prevent login if already authenticated or in transition
        if (currentStatus === 'authenticated' || currentStatus === 'authenticating' || currentStatus === 'loggingOut') {
            log.warn('Anonymous login blocked - invalid state', { currentStatus });
            return;
        }

        set({ status: 'authenticating', isLoading: true, error: null });
        useAppStore.getState().setAuthState('authenticating', null);

        try {
            log.debug('Anonymous login attempt', { displayName });

            // Call auth service
            const user = await authService.loginAnonymous(displayName);

            // Update UserStore with anonymous user (kept for backward compatibility)
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({
                status: 'authenticated',
                isAuthenticated: true,
                isLoading: false,
                isInitializing: false,
            });
            useAppStore.getState().setAuthState('authenticated', user.id);
            eventBus.emit('session.authChanged', { isAuthenticated: true, user });
            log.debug('Anonymous login successful', { userId: user.id });
        } catch (err) {
            const message = getErrorMessage(err, 'Anonymous login failed');
            log.warn('Anonymous login unsuccessful', { reason: message });
            set({
                status: 'guest',
                error: message,
                isLoading: false,
                isAuthenticated: false,
            });
            useAppStore.getState().setAuthState('guest', null);
            throw err;
        }
    },

    loginWithGoogle: async (idToken: string) => {
        const currentStatus = get().status;

        // Prevent login if already authenticated or in transition
        if (currentStatus === 'authenticated' || currentStatus === 'authenticating' || currentStatus === 'loggingOut') {
            log.warn('Google login blocked - invalid state', { currentStatus });
            return;
        }

        set({ status: 'authenticating', isLoading: true, error: null });
        useAppStore.getState().setAuthState('authenticating', null);

        try {
            log.debug('Google login attempt');

            // Call auth service
            const user = await authService.loginWithGoogle(idToken);

            // Update UserStore
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({
                status: 'authenticated',
                isAuthenticated: true,
                isLoading: false,
                isInitializing: false,
            });
            useAppStore.getState().setAuthState('authenticated', user.id);
            eventBus.emit('session.authChanged', { isAuthenticated: true, user });
            log.debug('Google login successful', { userId: user.id });
        } catch (err) {
            const message = getErrorMessage(err, 'Google login failed');
            log.warn('Google login unsuccessful', { reason: message });
            set({
                status: 'guest',
                error: message,
                isLoading: false,
                isAuthenticated: false,
            });
            useAppStore.getState().setAuthState('guest', null);
            throw err;
        }
    },

    logout: async () => {
        const currentStatus = get().status;

        // Prevent double logout or logout during other transitions
        if (currentStatus === 'loggingOut' || currentStatus === 'guest' || currentStatus === 'authenticating') {
            log.warn('Logout blocked - invalid state', { currentStatus });
            return;
        }

        // CRITICAL: Set loggingOut FIRST - this keeps navigation stable
        // Navigation will show loading screen during loggingOut state
        set({ status: 'loggingOut', isLoading: true });
        useAppStore.getState().setAuthState('loggingOut', null);
        log.debug('Logout initiated - entering loggingOut state');

        // Track start time to ensure minimum logout duration
        const startTime = Date.now();

        try {
            // Perform orchestrated cleanup (WS, stores, tokens)
            await cleanupSession();

            // Ensure minimum logout duration for smooth UX
            // This prevents jarring flickering when cleanup is very fast
            const elapsed = Date.now() - startTime;
            if (elapsed < MIN_LOGOUT_DURATION_MS) {
                await new Promise((resolve) => setTimeout(resolve, MIN_LOGOUT_DURATION_MS - elapsed));
            }

            // ONLY NOW transition to guest - navigation can safely switch
            set({
                status: 'guest',
                isAuthenticated: false,
                isLoading: false,
                isInitializing: false,
                error: null,
            });
            useAppStore.getState().setAuthState('guest', null);
            eventBus.emit('session.authChanged', { isAuthenticated: false, user: null });
            log.debug('Logout successful - transitioned to guest state');
        } catch (err) {
            log.error('Logout cleanup failed', { err });

            // Ensure UserStore is cleared even if other cleanup fails
            useUserStore.getState().clearUser();

            // Even if cleanup fails, we must transition to guest
            // Otherwise user is stuck in loggingOut state
            set({
                status: 'guest',
                isAuthenticated: false,
                isLoading: false,
                isInitializing: false,
            });
            useAppStore.getState().setAuthState('guest', null);
        }
    },

    deleteAccount: async () => {
        const currentStatus = get().status;

        // Only allow delete from authenticated or guest state
        if (currentStatus !== 'authenticated' && currentStatus !== 'guest') {
            log.warn('Delete account blocked - invalid state', { currentStatus });
            return;
        }

        set({ status: 'loggingOut', isLoading: true, error: null });
        useAppStore.getState().setAuthState('loggingOut', null);
        log.debug('Delete account initiated');

        const startTime = Date.now();

        try {
            // Disconnect WebSocket first
            wsService.disconnect();

            // Small delay to allow pending WS operations to complete
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Call delete account API (this clears tokens too)
            await authService.deleteAccount();

            // Clear stores
            useRoomStore.getState().reset();
            useUserStore.getState().clearUser();

            // Ensure minimum duration for smooth UX
            const elapsed = Date.now() - startTime;
            if (elapsed < MIN_LOGOUT_DURATION_MS) {
                await new Promise((resolve) => setTimeout(resolve, MIN_LOGOUT_DURATION_MS - elapsed));
            }

            set({
                status: 'guest',
                isAuthenticated: false,
                isLoading: false,
                isInitializing: false,
                error: null,
            });
            useAppStore.getState().setAuthState('guest', null);
            eventBus.emit('session.authChanged', { isAuthenticated: false, user: null });
            log.info('Account deleted successfully');
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to delete account');
            log.error('Delete account failed', { error: message });
            // Revert to previous state on failure
            set({
                status: currentStatus,
                isLoading: false,
                error: message,
            });
            throw err;
        }
    },

    hardDeleteAccount: async () => {
        const currentStatus = get().status;

        // Only allow delete from authenticated state
        if (currentStatus !== 'authenticated') {
            log.warn('Hard delete account blocked - invalid state', { currentStatus });
            return;
        }

        // CRITICAL: Set loggingOut FIRST
        set({ status: 'loggingOut', isLoading: true, error: null });
        useAppStore.getState().setAuthState('loggingOut', null);
        log.debug('Hard delete account initiated');

        const startTime = Date.now();

        try {
            // 1. Disconnect WebSocket
            wsService.disconnect();

            // 2. Small delay
            await new Promise((resolve) => setTimeout(resolve, 50));

            // 3. Call hard delete API (clears storage tokens internally)
            await authService.hardDeleteAccount();

            // 4. Clear all app stores
            useRoomStore.getState().reset();
            useUserStore.getState().clearUser();

            // 5. Ensure minimum duration
            const elapsed = Date.now() - startTime;
            if (elapsed < MIN_LOGOUT_DURATION_MS) {
                await new Promise((resolve) => setTimeout(resolve, MIN_LOGOUT_DURATION_MS - elapsed));
            }

            // 6. Transition to guest
            set({
                status: 'guest',
                isAuthenticated: false,
                isLoading: false,
                isInitializing: false,
                error: null,
            });
            useAppStore.getState().setAuthState('guest', null);
            eventBus.emit('session.authChanged', { isAuthenticated: false, user: null });
            log.info('Account hard-deleted successfully');
        } catch (err) {
            const message = getErrorMessage(err, 'Failed to hard-delete account');
            log.error('Hard delete account failed', { error: message });
            // Revert to previous state on failure
            set({
                status: currentStatus,
                isLoading: false,
                error: message,
            });
            throw err;
        }
    },

    clearError: () => {
        set({ error: null });
    },

    setLoading: (isLoading: boolean) => {
        // Deprecated - kept for backward compatibility
        set({ isLoading });
    },

    setError: (error: string | null) => {
        set({ error });
    },

    setAuthenticated: (isAuthenticated: boolean) => {
        // Deprecated - kept for backward compatibility
        // Updates both old boolean and new status
        set({
            isAuthenticated,
            status: isAuthenticated ? 'authenticated' : 'guest',
        });
    },

    getUser: () => {
        // Safe guard: only return user data if we are in a state that should have it
        // and it exists in the UserStore
        const status = get().status;
        if (status !== 'authenticated' && status !== 'loggingOut') {
            return null;
        }
        return useUserStore.getState().currentUser;
    },

    isTransitioning: () => {
        const status = get().status;
        return status === 'unknown' || status === 'loading' || status === 'authenticating' || status === 'loggingOut';
    },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectError = (state: AuthStore) => state.error;
export const selectStatus = (state: AuthStore) => state.status;
export const selectUser = (state: AuthStore) => {
    // Note: This returns from UserStore. 
    // It will NOT trigger a re-render when UserStore changes if used via useAuthStore.
    // Use useCurrentUser() instead.
    return useUserStore.getState().currentUser;
};

/**
 * Selector to check if navigation should show loading screen
 * Returns true during any transition state
 */
export const selectIsTransitioning = (state: AuthStore) => {
    const { status } = state;
    return status === 'unknown' || status === 'loading' || status === 'authenticating' || status === 'loggingOut';
};

// =============================================================================
// Initialization Helper
// =============================================================================

/**
 * Initialize auth state from storage
 * Call this once on app startup
 */
export async function initializeAuthStore(): Promise<void> {
    // Transition from unknown to loading
    useAuthStore.setState({ status: 'loading' });
    useAppStore.getState().setAuthState('loading', null);
    log.debug('Initializing auth store - status: loading');

    try {
        // Let authService initialize and load cached user
        const user = await authService.initialize();

        if (user) {
            // User is logged in, update stores
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            // Transition to authenticated with user data
            useAuthStore.setState({
                status: 'authenticated',
                isAuthenticated: true,
                isInitializing: false,
                isLoading: false,
            });
            useAppStore.getState().setAuthState('authenticated', user.id);
            log.debug('Auth initialized with user', { userId: user.id, status: 'authenticated' });
        } else {
            // No user, transition to guest
            useAuthStore.setState({
                status: 'guest',
                isAuthenticated: false,
                isInitializing: false,
                isLoading: false,
            });
            useAppStore.getState().setAuthState('guest', null);
            log.debug('Auth initialized - no user', { status: 'guest' });
        }
    } catch (err) {
        log.error('Auth initialization error', { error: err });
        // On error, transition to guest (safe default)
        useAuthStore.setState({
            status: 'guest',
            isAuthenticated: false,
            isInitializing: false,
            isLoading: false,
        });
        useAppStore.getState().setAuthState('guest', null);
    }
}

export default useAuthStore;
