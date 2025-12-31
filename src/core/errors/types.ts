/**
 * Error Types & Classification
 *
 * Centralized type definitions for the error handling system.
 * Provides consistent error classification across the app.
 */

// =============================================================================
// Error Types
// =============================================================================

/**
 * High-level error categories
 */
export type ErrorType =
    | 'network'      // Connection/timeout errors
    | 'auth'         // Authentication/authorization errors
    | 'validation'   // Input validation errors
    | 'permission'   // Access denied (banned, kicked, etc.)
    | 'notFound'     // Resource not found
    | 'conflict'     // Resource conflict (already exists)
    | 'server'       // Server-side errors (5xx)
    | 'unknown';     // Unclassified errors

/**
 * Error severity levels for UI treatment
 */
export type ErrorSeverity =
    | 'critical'  // Full screen modal, blocks interaction
    | 'high'      // Persistent banner
    | 'medium'    // Toast with action button
    | 'low';      // Inline indicator

/**
 * Error codes matching backend
 */
export const ErrorCode = {
    // Auth errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',

    // Room errors
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
    ROOM_CLOSED: 'ROOM_CLOSED',
    ROOM_FULL: 'ROOM_FULL',
    ALREADY_JOINED: 'ALREADY_JOINED',
    NOT_A_PARTICIPANT: 'NOT_A_PARTICIPANT',

    // User errors
    USER_BANNED: 'BANNED',
    USER_KICKED: 'KICKED',
    USER_BLOCKED: 'BLOCKED',
    ALREADY_REPORTED: 'ALREADY_REPORTED',
    ALREADY_BLOCKED: 'ALREADY_BLOCKED',

    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',

    // Generic
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// Classified Error
// =============================================================================

/**
 * Structured error after classification
 */
export interface ClassifiedError {
    /** High-level error category */
    type: ErrorType;
    /** UI treatment level */
    severity: ErrorSeverity;
    /** User-friendly message */
    message: string;
    /** Error code for programmatic handling */
    code: ErrorCodeType;
    /** Whether the error can be recovered from (retry, etc.) */
    isRecoverable: boolean;
    /** HTTP status code if applicable */
    statusCode?: number;
    /** Original error for logging */
    originalError: unknown;
}

// =============================================================================
// Error Context
// =============================================================================

/**
 * Context for error handling decisions
 */
export interface ErrorContext {
    /** Operation being performed (e.g., 'sendMessage', 'joinRoom') */
    operation: string;
    /** Current screen name */
    screen?: string;
    /** Room ID if in a room context */
    roomId?: string;
    /** User ID if relevant */
    userId?: string;
    /** Whether to show UI feedback */
    silent?: boolean;
}

// =============================================================================
// Error Actions
// =============================================================================

/**
 * Type of UI action to take for an error
 */
export type ErrorActionType =
    | 'toast'     // Show toast notification
    | 'banner'    // Show persistent banner
    | 'modal'     // Show modal dialog
    | 'redirect'  // Redirect to another screen
    | 'silent';   // No UI feedback

/**
 * Retry configuration for recoverable errors
 */
export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Backoff strategy */
    backoff: 'fixed' | 'exponential';
    /** Base delay in milliseconds */
    baseDelay: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Predicate to determine if error should be retried */
    retryOn?: (error: unknown) => boolean;
}

/**
 * Action to take in response to an error
 */
export interface ErrorAction {
    /** Type of UI feedback */
    type: ErrorActionType;
    /** User-friendly message to display */
    message: string;
    /** Retry configuration if recoverable */
    retry?: RetryConfig;
    /** Redirect target if type is 'redirect' */
    redirectTo?: string;
    /** Additional action data */
    data?: Record<string, unknown>;
}

// =============================================================================
// Default Retry Configurations
// =============================================================================

export const DEFAULT_RETRY_CONFIGS = {
    network: {
        maxAttempts: 3,
        backoff: 'exponential' as const,
        baseDelay: 1000,
        maxDelay: 10000,
    },
    message: {
        maxAttempts: 5,
        backoff: 'exponential' as const,
        baseDelay: 500,
        maxDelay: 5000,
    },
    auth: {
        maxAttempts: 1,
        backoff: 'fixed' as const,
        baseDelay: 0,
        maxDelay: 0,
    },
} as const;
