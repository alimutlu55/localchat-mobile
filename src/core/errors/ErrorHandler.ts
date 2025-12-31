/**
 * Error Handler Service
 *
 * Centralized error classification and handling for the entire app.
 * Provides consistent error treatment regardless of source.
 *
 * @example
 * ```typescript
 * import { errorHandler } from '@/core/errors';
 *
 * try {
 *   await api.joinRoom(roomId);
 * } catch (error) {
 *   const action = errorHandler.handle(error, { operation: 'joinRoom', roomId });
 *   // Action contains what UI treatment to apply
 * }
 * ```
 */

import { eventBus } from '../events';
import { createLogger } from '../../shared/utils/logger';
import {
    ClassifiedError,
    ErrorAction,
    ErrorActionType,
    ErrorCode,
    ErrorCodeType,
    ErrorContext,
    ErrorSeverity,
    ErrorType,
    DEFAULT_RETRY_CONFIGS,
} from './types';

const log = createLogger('ErrorHandler');

// =============================================================================
// Error Classification Helpers
// =============================================================================

/**
 * Extract error details from various error shapes
 */
function extractErrorDetails(error: unknown): {
    message: string;
    code: string;
    status: number;
} {
    if (!error) {
        return { message: '', code: '', status: 0 };
    }

    if (typeof error === 'object') {
        const e = error as Record<string, any>;

        const message =
            e.message ||
            e.data?.message ||
            e.error?.message ||
            e.response?.data?.message ||
            '';

        const code =
            e.code ||
            e.data?.code ||
            e.error?.code ||
            '';

        const status =
            e.status ||
            e.response?.status ||
            0;

        return {
            message: String(message).toLowerCase(),
            code: String(code).toUpperCase(),
            status: Number(status),
        };
    }

    if (typeof error === 'string') {
        return { message: error.toLowerCase(), code: '', status: 0 };
    }

    return { message: '', code: '', status: 0 };
}

// =============================================================================
// Error Handler Class
// =============================================================================

class ErrorHandler {
    /**
     * Classify an error into a structured format
     */
    classify(error: unknown): ClassifiedError {
        const { message, code, status } = extractErrorDetails(error);

        // Network errors
        if (this.isNetworkError(error, status, code)) {
            return {
                type: 'network',
                severity: 'high',
                message: 'Unable to connect. Please check your internet connection.',
                code: ErrorCode.NETWORK_ERROR,
                isRecoverable: true,
                statusCode: status,
                originalError: error,
            };
        }

        // Timeout errors
        if (code === 'TIMEOUT' || message.includes('timeout')) {
            return {
                type: 'network',
                severity: 'medium',
                message: 'Request timed out. Please try again.',
                code: ErrorCode.TIMEOUT,
                isRecoverable: true,
                statusCode: status,
                originalError: error,
            };
        }

        // Auth errors
        if (status === 401 || code === ErrorCode.UNAUTHORIZED || code === ErrorCode.SESSION_EXPIRED) {
            return {
                type: 'auth',
                severity: 'critical',
                message: 'Your session has expired. Please log in again.',
                code: ErrorCode.SESSION_EXPIRED,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Banned user
        if (code === ErrorCode.USER_BANNED || message.includes('banned')) {
            return {
                type: 'permission',
                severity: 'high',
                message: 'You are banned from this room.',
                code: ErrorCode.USER_BANNED,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Kicked user
        if (code === ErrorCode.USER_KICKED || message.includes('kicked') || message.includes('removed')) {
            return {
                type: 'permission',
                severity: 'high',
                message: 'You have been removed from this room.',
                code: ErrorCode.USER_KICKED,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Not a participant
        if (status === 403 || code === ErrorCode.NOT_A_PARTICIPANT || message.includes('not a participant')) {
            return {
                type: 'permission',
                severity: 'medium',
                message: 'You are not a member of this room.',
                code: ErrorCode.NOT_A_PARTICIPANT,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Room closed
        if (code === ErrorCode.ROOM_CLOSED || message.includes('room is closed')) {
            return {
                type: 'notFound',
                severity: 'medium',
                message: 'This room has been closed.',
                code: ErrorCode.ROOM_CLOSED,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Room full
        if (code === ErrorCode.ROOM_FULL || message.includes('full')) {
            return {
                type: 'conflict',
                severity: 'medium',
                message: 'This room is full.',
                code: ErrorCode.ROOM_FULL,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Conflict errors (already joined, already reported, etc.)
        if (status === 409 || code === ErrorCode.CONFLICT || message.includes('already')) {
            return {
                type: 'conflict',
                severity: 'low',
                message: this.formatConflictMessage(code, message),
                code: code as ErrorCodeType || ErrorCode.CONFLICT,
                isRecoverable: false,
                statusCode: status,
                originalError: error,
            };
        }

        // Server errors
        if (status >= 500) {
            return {
                type: 'server',
                severity: 'high',
                message: 'Something went wrong on our end. Please try again later.',
                code: ErrorCode.SERVER_ERROR,
                isRecoverable: true,
                statusCode: status,
                originalError: error,
            };
        }

        // Unknown errors
        return {
            type: 'unknown',
            severity: 'medium',
            message: this.extractUserMessage(message) || 'Something went wrong.',
            code: ErrorCode.UNKNOWN,
            isRecoverable: true,
            statusCode: status,
            originalError: error,
        };
    }

    /**
     * Handle an error and determine the appropriate action
     */
    handle(error: unknown, context: ErrorContext): ErrorAction {
        const classified = this.classify(error);

        // Log the error
        this.logError(classified, context);

        // Determine action based on error type and context
        const action = this.determineAction(classified, context);

        // Emit event for UI components (unless silent)
        if (!context.silent && action.type !== 'silent') {
            this.emitErrorEvent(classified, action, context);
        }

        return action;
    }

    /**
     * Report an error for analytics/debugging
     */
    report(error: ClassifiedError, context?: ErrorContext): void {
        log.error('Error reported', {
            type: error.type,
            code: error.code,
            severity: error.severity,
            message: error.message,
            context,
        });

        // TODO: Send to error reporting service (Sentry, etc.)
    }

    // ===========================================================================
    // Private Helpers
    // ===========================================================================

    private isNetworkError(error: unknown, status: number, code: string): boolean {
        if (status === 0 || code === ErrorCode.NETWORK_ERROR) return true;

        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return (
                msg.includes('network') ||
                msg.includes('fetch') ||
                msg.includes('connection') ||
                error.name === 'AbortError'
            );
        }

        return false;
    }

    private formatConflictMessage(code: string, message: string): string {
        if (code === ErrorCode.ALREADY_JOINED) return 'You have already joined this room.';
        if (code === ErrorCode.ALREADY_REPORTED) return 'You have already reported this.';
        if (code === ErrorCode.ALREADY_BLOCKED) return 'This user is already blocked.';
        if (message.includes('already')) {
            // Capitalize first letter
            return message.charAt(0).toUpperCase() + message.slice(1);
        }
        return 'This action has already been performed.';
    }

    private extractUserMessage(message: string): string {
        if (!message || message.length === 0 || message.length > 200) {
            return '';
        }
        return message.charAt(0).toUpperCase() + message.slice(1);
    }

    private determineAction(error: ClassifiedError, context: ErrorContext): ErrorAction {
        // Silent mode - no UI
        if (context.silent) {
            return { type: 'silent', message: error.message };
        }

        // Auth errors -> redirect to login
        if (error.type === 'auth') {
            return {
                type: 'redirect',
                message: error.message,
                redirectTo: 'Login',
            };
        }

        // Network errors -> banner with retry
        if (error.type === 'network') {
            return {
                type: 'banner',
                message: error.message,
                retry: DEFAULT_RETRY_CONFIGS.network,
            };
        }

        // Permission errors (banned/kicked) -> modal
        if (error.type === 'permission' && error.severity === 'high') {
            return {
                type: 'modal',
                message: error.message,
            };
        }

        // Server errors -> toast with retry
        if (error.type === 'server' || error.isRecoverable) {
            return {
                type: 'toast',
                message: error.message,
                retry: DEFAULT_RETRY_CONFIGS.network,
            };
        }

        // Default -> toast
        return {
            type: 'toast',
            message: error.message,
        };
    }

    private logError(error: ClassifiedError, context: ErrorContext): void {
        const logLevel = error.severity === 'critical' || error.severity === 'high' ? 'error' : 'warn';

        log[logLevel]('Error handled', {
            type: error.type,
            code: error.code,
            message: error.message,
            operation: context.operation,
            screen: context.screen,
            roomId: context.roomId,
        });
    }

    private emitErrorEvent(error: ClassifiedError, action: ErrorAction, context: ErrorContext): void {
        // Emit to EventBus for UI components to react
        eventBus.emit('connection.error', {
            code: error.code,
            message: error.message,
        });
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const errorHandler = new ErrorHandler();
export default errorHandler;
