/**
 * useAuth Hook
 *
 * Unified hook combining AuthStore + UserStore for backwards compatibility.
 * Provides the same API as the old AuthContext.
 *
 * @example
 * ```typescript
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * // Login
 * await login('email@example.com', 'password');
 *
 * // Check auth state
 * if (isAuthenticated) {
 *   console.log('Welcome', user.displayName);
 * }
 * ```
 */

import { useAuthStore } from '../store/AuthStore';
import { useCurrentUser } from '../../user/store';
import { useUpdateProfile } from './useUpdateProfile';

/**
 * Combined auth hook
 * Provides authentication state and actions
 */
export function useAuth() {
    // Auth state from AuthStore
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const loginAnonymous = useAuthStore((state) => state.loginAnonymous);
    const logout = useAuthStore((state) => state.logout);
    const isInitializing = useAuthStore((state) => state.isInitializing);
    const isLoading = useAuthStore((state) => state.isLoading);
    const error = useAuthStore((state) => state.error);
    const clearError = useAuthStore((state) => state.clearError);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // User data from UserStore
    const user = useCurrentUser();

    // Profile update hook
    const { updateProfile } = useUpdateProfile();

    return {
        // User data
        user,

        // Auth state
        isInitializing, // Use this for showing app loading screen
        isLoading,      // Use this for operation loading indicators
        isAuthenticated,
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
