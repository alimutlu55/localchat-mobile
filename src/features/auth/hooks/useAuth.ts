/**
 * useAuth Hook
 *
 * Provides authentication state and actions.
 *
 * IMPORTANT: This hook does NOT return user data.
 * For user data (avatar, displayName, etc.), use `useCurrentUser()` from '@/features/user/store'.
 *
 * @example
 * ```typescript
 * import { useAuth } from '@/features/auth';
 * import { useCurrentUser } from '@/features/user/store';
 *
 * // Auth state and actions
 * const { login, logout, status, isAuthenticated } = useAuth();
 *
 * // User data (separate concern)
 * const user = useCurrentUser();
 *
 * // Login
 * await login('email@example.com', 'password');
 *
 * // Check auth state
 * if (status === 'authenticated') {
 *   console.log('Welcome', user?.displayName);
 * }
 *
 * // Check if in transition (should show loading)
 * if (isTransitioning) {
 *   return <LoadingScreen />;
 * }
 * ```
 */

import { useAuthStore } from '../store/AuthStore';
import { useUpdateProfile } from './useUpdateProfile';

/**
 * Auth hook - provides authentication state and actions only.
 * Does NOT return user data. Use useCurrentUser() for that.
 */
export function useAuth() {
    // Auth state from AuthStore - state machine approach
    const status = useAuthStore((state) => state.status);

    // Auth actions from AuthStore
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const loginAnonymous = useAuthStore((state) => state.loginAnonymous);
    const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
    const logout = useAuthStore((state) => state.logout);
    const deleteAccount = useAuthStore((state) => state.deleteAccount);
    const hardDeleteAccount = useAuthStore((state) => state.hardDeleteAccount);
    const error = useAuthStore((state) => state.error);
    const clearError = useAuthStore((state) => state.clearError);
    const tryRestoreAnonymousSession = useAuthStore((state) => state.tryRestoreAnonymousSession);

    // Deprecated state - kept for backward compatibility
    const isInitializing = useAuthStore((state) => state.isInitializing);
    const isLoading = useAuthStore((state) => state.isLoading);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    // Profile update hook
    const { updateProfile } = useUpdateProfile();

    // Computed: check if in a transition state
    // Navigation should show loading screen during transitions
    const isTransitioning = status === 'unknown' || status === 'loading' || status === 'authenticating' || status === 'loggingOut';

    return {
        // Auth state - state machine status
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
        loginWithGoogle,
        logout,
        deleteAccount,
        hardDeleteAccount,
        clearError,
        tryRestoreAnonymousSession,

        // Profile action
        updateProfile,
    };
}

export default useAuth;
