/**
 * Session Types
 *
 * Defines the session state interface for unified session management.
 * SessionManager coordinates auth status and consent status atomically.
 */

import { User } from '../../types';

// =============================================================================
// Session Status
// =============================================================================

/**
 * Discrete session states representing the combined auth + consent status.
 * Navigation should use these states for screen selection.
 */
export type SessionStatus =
    | 'unknown'        // App just opened, checking session
    | 'loading'        // Validating session with backend
    | 'needsConsent'   // No consent or needs re-consent
    | 'needsAuth'      // Has consent but not authenticated
    | 'authenticated'  // Fully authenticated with valid consent
    | 'sessionError';  // Session validation failed

// =============================================================================
// Session State
// =============================================================================

/**
 * Complete session state returned by SessionManager.
 * Single source of truth for navigation decisions.
 */
export interface SessionState {
    /** Current session status */
    status: SessionStatus;

    /** Device ID (stable identifier for this installation) */
    deviceId: string | null;

    /** Current user if authenticated */
    user: User | null;

    /** Consent information */
    consent: {
        /** Whether user has given any consent */
        hasConsent: boolean;
        /** Whether consent version requires re-consent */
        needsReconsent: boolean;
        /** Current consent version */
        version: string | null;
    };

    /** Error message if session validation failed */
    error: string | null;
}

// =============================================================================
// Initialization Result
// =============================================================================

/**
 * Result of session initialization.
 * Contains the final session state after validation.
 */
export interface SessionInitResult {
    /** Resolved session state */
    state: SessionState;
    /** Whether this is a fresh session (new device/user) */
    isNewSession: boolean;
    /** Whether session was restored from storage */
    wasRestored: boolean;
}

// =============================================================================
// Initial State
// =============================================================================

/**
 * Initial session state before initialization.
 */
export const initialSessionState: SessionState = {
    status: 'unknown',
    deviceId: null,
    user: null,
    consent: {
        hasConsent: false,
        needsReconsent: true,
        version: null,
    },
    error: null,
};
