/**
 * useAuth Hook
 *
 * Unified hook combining AuthStore + UserStore for backwards compatibility.
 * Provides the same API as the old AuthContext.
 *
 * NEW: Now also exposes the auth status state machine for proper transition handling.
 *
 * @example
 * ```typescript
 * const { user, login, logout, isAuthenticated, status } = useAuth();
 *
 * // Login
 * await login('email@example.com', 'password');
 *
 * // Check auth state (legacy)
 * if (isAuthenticated) {
 *   console.log('Welcome', user.displayName);
 * }
 *
 * // Check auth state (new - preferred)
 * if (status === 'authenticated') {
 *   console.log('Welcome', user.displayName);
 * }
 *
 * // Check if in transition (should show loading)
 * if (isTransitioning) {
 *   return <LoadingScreen />;
 * }
 * ```
 */

import { useAuthStore, AuthStatus } from '../store/AuthStore';
import { useCurrentUser } from '../../user/store';
import { useUpdateProfile } from './useUpdateProfile';

/**
 * Combined auth hook
 * Provides authentication state and actions
 */
export function useAuth() {
    // Auth state from AuthStore - new state machine approach
    const status = useAuthStore((state) => state.status);
    const authUser = useAuthStore((state) => state.user);

    // Auth actions from AuthStore
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const loginAnonymous = useAuthStore((state) => state.loginAnonymous);
    const logout = useAuthStore((state) => state.logout);
    const error = useAuthStore((state) => state.error);
    const clearError = useAuthStore((state) => state.clearError);

    // Deprecated state - kept for backward compatibility
    const isInitializing = useAuthStore((state) => state.isInitializing);
    const isLoading = useAuthStore((state) => state.isLoading);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // User data from UserStore (kept for backward compatibility)
    // Prefer authUser from AuthStore for new code
    const userStoreUser = useCurrentUser();

    // Use auth store user if available, fallback to user store
    const user = authUser ?? userStoreUser;

    // Profile update hook
    const { updateProfile } = useUpdateProfile();

    // Computed: check if in a transition state
    // Navigation should show loading screen during transitions
    const isTransitioning = status === 'unknown' || status === 'loading' || status === 'authenticating' || status === 'loggingOut';

    return {
        // User data (prefer this over accessing stores directly)
        user,

        // Auth state - NEW state machine status
        status,

        // Computed helper for navigation guards
        isTransitioning,

        // Auth state - DEPRECATED (kept for backward compatibility)
        isInitializing, // Use isTransitioning instead
        isLoading,      // Use status === 'authenticating' instead
        isAuthenticated, // Use status === 'authenticated' instead
        error,

        // Auth actions
        login,
        register,
        loginAnonymous,
        logout,
        clearError,

        // Profile action
        updateProfile,
    };
}

export default useAuth;
