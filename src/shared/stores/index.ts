/**
 * Shared Stores Index
 *
 * Exports shared state management stores.
 */

export {
    useAppStore,
    useIsAuthenticated,
    useCurrentUserId,
    useIsLoggingOut,
    selectAuthStatus,
    selectCurrentUserId,
    selectIsAuthenticated,
    selectIsLoggingOut,
} from './AppStore';
export type { AppStore, AppState, AppActions } from './AppStore';
