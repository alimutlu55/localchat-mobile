/**
 * AuthStore - Zustand-based Authentication State Management
 *
 * Handles authentication flows only (login, logout, register).
 * User data is managed by UserStore, not here.
 *
 * Design Principles:
 * - Separation of concerns: Auth flow ≠ User data
 * - Works with UserStore: After login, calls UserStore.setUser()
 * - Manages WebSocket: Connects/disconnects on auth state change
 * - Minimal API surface: Only auth-related state and actions
 */

import { create } from 'zustand';
import { authService } from '../../../services/auth';
import { wsService } from '../../../services';
import { useUserStore } from '../../user/store/UserStore';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('AuthStore');

// =============================================================================
// Types
// =============================================================================

export interface AuthStoreState {
    /**
     * Whether auth is still initializing (app startup)
     * Used by RootNavigator to show loading screen
     */
    isInitializing: boolean;

    /**
     * Loading state for auth operations (login, register, etc)
     * Does NOT trigger navigator remount
     */
    isLoading: boolean;

    /**
     * Error message from auth operations
     */
    error: string | null;

    /**
     * Whether user is authenticated (derived from UserStore)
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

    /**
     * Login anonymously
     */
    loginAnonymous: (displayName?: string) => Promise<void>;

    /**
     * Logout user
     */
    logout: () => Promise<void>;

    /**
     * Clear error message
     */
    clearError: () => void;

    /**
     * Update loading state
     */
    setLoading: (isLoading: boolean) => void;

    /**
     * Set error
     */
    setError: (error: string | null) => void;

    /**
     * Update isAuthenticated flag
     */
    setAuthenticated: (isAuthenticated: boolean) => void;
}

export type AuthStore = AuthStoreState & AuthStoreActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: AuthStoreState = {
    isInitializing: true, // Start with true, set to false after auth initialization
    isLoading: false, // Operation loading, start false
    error: null,
    isAuthenticated: false,
};

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
        set({ isLoading: true, error: null });

        try {
            log.debug('Login attempt', { email });

            // Call auth service
            const user = await authService.login(email, password);

            // Update UserStore with logged-in user
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({ isAuthenticated: true, isLoading: false });
            log.debug('Login successful', { userId: user.id });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';
            // Use warn instead of error - invalid credentials is expected user behavior
            log.warn('Login unsuccessful', { reason: message });
            set({ error: message, isLoading: false, isAuthenticated: false });
            throw err;
        }
    },

    register: async (email: string, password: string, displayName: string) => {
        set({ isLoading: true, error: null });

        try {
            log.debug('Register attempt', { email, displayName });

            // Call auth service
            const user = await authService.register(email, password, displayName);

            // Update UserStore with new user
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({ isAuthenticated: true, isLoading: false });
            log.debug('Registration successful', { userId: user.id });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Registration failed';
            // Use warn instead of error - registration failures are expected scenarios
            log.warn('Registration unsuccessful', { reason: message });
            set({ error: message, isLoading: false, isAuthenticated: false });
            throw err;
        }
    },

    loginAnonymous: async (displayName?: string) => {
        set({ isLoading: true, error: null });

        try {
            log.debug('Anonymous login attempt', { displayName });

            // Call auth service
            const user = await authService.loginAnonymous(displayName);

            // Update UserStore with anonymous user
            useUserStore.getState().setUser(user);

            // Connect WebSocket
            await wsService.connect();

            set({ isAuthenticated: true, isLoading: false });
            log.debug('Anonymous login successful', { userId: user.id });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Anonymous login failed';
            // Use warn instead of error - anonymous login failures are usually expected
            log.warn('Anonymous login unsuccessful', { reason: message });
            set({ error: message, isLoading: false, isAuthenticated: false });
            throw err;
        }
    },

    logout: async () => {
        set({ isLoading: true });

        try {
            log.debug('Logout initiated');

            // Disconnect WebSocket first
            wsService.disconnect();

            // Call auth service to clear tokens
            await authService.logout();

            // Clear UserStore
            useUserStore.getState().clearUser();

            set({ isAuthenticated: false, isLoading: false, error: null });
            log.debug('Logout successful');
        } catch (err) {
            log.error('Logout error', { error: err });
            // Even if logout fails, clear local state
            useUserStore.getState().clearUser();
            set({ isAuthenticated: false, isLoading: false });
        }
    },

    clearError: () => {
        set({ error: null });
    },

    setLoading: (isLoading: boolean) => {
        set({ isLoading });
    },

    setError: (error: string | null) => {
        set({ error });
    },

    setAuthenticated: (isAuthenticated: boolean) => {
        set({ isAuthenticated });
    },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
export const selectError = (state: AuthStore) => state.error;

// =============================================================================
// Initialization Helper
// =============================================================================

/**
 * Initialize auth state from storage
 * Call this once on app startup
 */
export async function initializeAuthStore(): Promise<void> {
    const store = useAuthStore.getState();

    try {
        log.debug('Initializing auth store...');

        // Let authService initialize and load cached user
        const user = await authService.initialize();

        if (user) {
            // User is logged in, update stores
            useUserStore.getState().setUser(user);
            store.setAuthenticated(true);

            // Connect WebSocket
            await wsService.connect();

            log.debug('Auth initialized with user', { userId: user.id });
        } else {
            // No user, not authenticated
            store.setAuthenticated(false);
            log.debug('Auth initialized - no user');
        }
    } catch (err) {
        log.error('Auth initialization error', { error: err });
        store.setAuthenticated(false);
    } finally {
        // Mark initialization as complete - this allows navigator to render
        useAuthStore.setState({ isInitializing: false });
    }
}

export default useAuthStore;
