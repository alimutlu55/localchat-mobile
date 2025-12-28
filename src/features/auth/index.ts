/**
 * Auth Feature Module Exports
 *
 * Public API for authentication functionality.
 */

// Hooks
export { useAuth } from './hooks/useAuth';
export { useUpdateProfile } from './hooks/useUpdateProfile';

// Store
export {
    useAuthStore,
    initializeAuthStore,
    selectIsAuthenticated as selectAuthIsAuthenticated,
    selectIsLoading as selectAuthIsLoading,
    selectError as selectAuthError,
    selectStatus,
    selectUser as selectAuthUser,
    selectIsTransitioning,
} from './store/AuthStore';
export type { AuthStore, AuthStoreState, AuthStoreActions, AuthStatus } from './store/AuthStore';
