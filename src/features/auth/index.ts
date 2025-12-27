/**
 * Auth Feature Module Exports
 *
 * Public API for authentication functionality.
 */

// Hooks
export { useAuth } from './hooks/useAuth';
export { useUpdateProfile } from './hooks/useUpdateProfile';

// Store
export { useAuthStore, initializeAuthStore } from './store/AuthStore';
export type { AuthStore, AuthStoreState, AuthStoreActions } from './store/AuthStore';
