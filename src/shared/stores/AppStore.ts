/**
 * AppStore - Shared Application State
 *
 * A lightweight store that holds cross-cutting state that multiple features need.
 * This breaks circular dependencies between feature stores.
 *
 * Design Principles:
 * - Minimal surface area: only state that MUST be shared
 * - Read-only for consumers: only AuthStore can update auth state
 * - No business logic: just state and events
 *
 * Usage:
 * - AuthStore updates this store on auth state changes
 * - UserStoreProvider, RoomStoreProvider subscribe to this for cleanup
 * - Other features subscribe via selectors/hooks
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { AuthStatus } from '../../features/auth/store/AuthStore';
import { createLogger } from '../utils/logger';

const log = createLogger('AppStore');

// =============================================================================
// Types
// =============================================================================

export interface AppState {
    /**
     * Current authentication status
     * Mirrors AuthStore.status for cross-feature access
     */
    authStatus: AuthStatus;

    /**
     * Current user ID (null if not authenticated)
     * Allows features to check auth without importing AuthStore
     */
    currentUserId: string | null;

    /**
     * Whether user is authenticated (convenience accessor)
     */
    isAuthenticated: boolean;
}

export interface AppActions {
    /**
     * Update auth state (called by AuthStore only)
     * @internal
     */
    setAuthState: (status: AuthStatus, userId: string | null) => void;

    /**
     * Reset to initial state (called on logout/cleanup)
     * @internal
     */
    reset: () => void;
}

export type AppStore = AppState & AppActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: AppState = {
    authStatus: 'unknown',
    currentUserId: null,
    isAuthenticated: false,
};

// =============================================================================
// Store Implementation
// =============================================================================

export const useAppStore = create<AppStore>()(
    subscribeWithSelector((set) => ({
        ...initialState,

        setAuthState: (status: AuthStatus, userId: string | null) => {
            const isAuthenticated = status === 'authenticated';
            log.debug('Auth state updated', { status, userId: userId?.substring(0, 8), isAuthenticated });
            set({ authStatus: status, currentUserId: userId, isAuthenticated });
        },

        reset: () => {
            log.debug('AppStore reset');
            set(initialState);
        },
    }))
);

// =============================================================================
// Selectors
// =============================================================================

export const selectAuthStatus = (state: AppStore) => state.authStatus;
export const selectCurrentUserId = (state: AppStore) => state.currentUserId;
export const selectIsAuthenticated = (state: AppStore) => state.isAuthenticated;
export const selectIsLoggingOut = (state: AppStore) => state.authStatus === 'loggingOut';

// =============================================================================
// Hooks for Common Patterns
// =============================================================================

/**
 * Hook to check if user is authenticated
 * Use this instead of importing AuthStore in features
 */
export function useIsAuthenticated(): boolean {
    return useAppStore(selectIsAuthenticated);
}

/**
 * Hook to get current user ID
 * Returns null if not authenticated
 */
export function useCurrentUserId(): string | null {
    return useAppStore(selectCurrentUserId);
}

/**
 * Hook to check if app is in logout transition
 * Used by providers to know when to cleanup
 */
export function useIsLoggingOut(): boolean {
    return useAppStore(selectIsLoggingOut);
}

export default useAppStore;
