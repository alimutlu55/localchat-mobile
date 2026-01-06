/**
 * Session Module
 *
 * Standalone module for unified session management.
 * Coordinates authentication and consent status atomically.
 */

export { sessionManager } from './SessionManager';
export { useSession } from './useSession';
export type {
    SessionState,
    SessionStatus,
    SessionInitResult,
} from './types';
export { initialSessionState } from './types';
