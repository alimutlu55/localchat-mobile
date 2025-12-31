/**
 * safeAsync Utility
 *
 * Wraps async operations with standardized error handling.
 * Provides optional toast notifications and fallback values.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const result = await safeAsync(() => api.getProfile(), {
 *   showToast: true,
 *   fallback: null,
 * });
 * if (result.ok) {
 *   setProfile(result.data);
 * }
 *
 * // With retry action
 * const result = await safeAsync(() => roomService.join(roomId), {
 *   showToast: true,
 *   onError: (error) => console.log('Join failed:', error),
 * });
 * ```
 */

import { getErrorMessage, isNetworkError, isAuthError } from './errors';
import type { ToastType } from '../../components/ui/Toast';

// =============================================================================
// Types
// =============================================================================

/**
 * Result type for safeAsync - either success with data or error
 */
export type AsyncResult<T, E = Error> =
    | { ok: true; data: T; error?: never }
    | { ok: false; data?: never; error: E };

/**
 * Options for safeAsync wrapper
 */
export interface SafeAsyncOptions<T> {
    /**
     * Whether to show a toast on error (default: false)
     * Can also be a string to customize the error message
     */
    showToast?: boolean | string;

    /**
     * Toast type to use for errors (default: 'error')
     */
    toastType?: ToastType;

    /**
     * Fallback value to return on error (makes result.ok always true)
     */
    fallback?: T;

    /**
     * Callback when an error occurs
     */
    onError?: (error: unknown) => void;

    /**
     * Optional retry action for the toast
     */
    retryAction?: () => void;

    /**
     * Whether to rethrow the error after handling (default: false)
     */
    rethrow?: boolean;

    /**
     * Custom error message generator
     */
    getErrorMessage?: (error: unknown) => string;
}

// =============================================================================
// Toast Context Reference
// =============================================================================

// This will be set by ToastProvider at app init
// Allows safeAsync to show toasts without needing hook context
let toastFn: ((type: ToastType, message: string, options?: { action?: { label: string; onPress: () => void } }) => void) | null = null;

/**
 * Register the toast function from ToastProvider
 * Called once at app initialization
 */
export function registerToastFunction(
    fn: (type: ToastType, message: string, options?: { action?: { label: string; onPress: () => void } }) => void
) {
    toastFn = fn;
}

/**
 * Unregister the toast function (for cleanup)
 */
export function unregisterToastFunction() {
    toastFn = null;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Safely execute an async operation with standardized error handling
 *
 * @param operation - The async function to execute
 * @param options - Configuration options
 * @returns A Result object with either success data or error
 */
export async function safeAsync<T>(
    operation: () => Promise<T>,
    options: SafeAsyncOptions<T> = {}
): Promise<AsyncResult<T, unknown>> {
    const {
        showToast = false,
        toastType = 'error',
        fallback,
        onError,
        retryAction,
        rethrow = false,
        getErrorMessage: customGetErrorMessage,
    } = options;

    try {
        const data = await operation();
        return { ok: true, data };
    } catch (error) {
        // Call error callback if provided
        onError?.(error);

        // Show toast if requested
        if (showToast && toastFn) {
            const message = typeof showToast === 'string'
                ? showToast
                : customGetErrorMessage?.(error) ?? getErrorMessage(error);

            const toastOptions = retryAction
                ? { action: { label: 'Retry', onPress: retryAction } }
                : undefined;

            toastFn(toastType, message, toastOptions);
        }

        // Rethrow if requested
        if (rethrow) {
            throw error;
        }

        // Return fallback if provided (makes result.ok = true)
        if (fallback !== undefined) {
            return { ok: true, data: fallback };
        }

        // Return error result
        return { ok: false, error };
    }
}

// =============================================================================
// Convenience Wrappers
// =============================================================================

/**
 * Execute an async operation, showing toast and returning fallback on error
 */
export async function safeAsyncWithFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    toastMessage?: string
): Promise<T> {
    const result = await safeAsync(operation, {
        showToast: toastMessage ?? true,
        fallback,
    });
    return result.data as T;
}

/**
 * Execute an async operation, silently catching errors
 */
export async function safeAsyncSilent<T>(
    operation: () => Promise<T>,
    fallback?: T
): Promise<T | undefined> {
    const result = await safeAsync(operation, { fallback });
    return result.ok ? result.data : undefined;
}

export default safeAsync;
