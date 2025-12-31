/**
 * Retry Engine
 *
 * Configurable retry engine with exponential backoff support.
 * Used for automatic retries of failed operations.
 *
 * @example
 * ```typescript
 * import { retryEngine } from '@/core/network';
 *
 * const result = await retryEngine.execute(
 *   () => api.sendMessage(roomId, content),
 *   {
 *     maxAttempts: 3,
 *     backoff: 'exponential',
 *     baseDelay: 1000,
 *     maxDelay: 10000,
 *   }
 * );
 * ```
 */

import { createLogger } from '../../shared/utils/logger';
import { RetryConfig } from '../errors/types';

const log = createLogger('RetryEngine');

// =============================================================================
// Types
// =============================================================================

export interface RetryOptions extends RetryConfig {
    /** Called before each retry attempt */
    onRetry?: (attempt: number, delay: number, error: unknown) => void;
    /** Called when all retries are exhausted */
    onExhausted?: (error: unknown) => void;
}

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: unknown;
    attempts: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelay: 1000,
    maxDelay: 30000,
};

// =============================================================================
// Retry Engine Class
// =============================================================================

class RetryEngine {
    /**
     * Execute an operation with automatic retries
     *
     * @param operation - The async function to execute
     * @param options - Retry configuration options
     * @returns The result of the operation
     * @throws The last error if all retries are exhausted
     */
    async execute<T>(
        operation: () => Promise<T>,
        options: Partial<RetryOptions> = {}
    ): Promise<T> {
        const config: RetryOptions = { ...DEFAULT_CONFIG, ...options };
        let lastError: unknown;

        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
                const result = await operation();

                if (attempt > 1) {
                    log.info('Operation succeeded after retry', { attempt });
                }

                return result;
            } catch (error) {
                lastError = error;

                // Check if we should retry this error
                if (config.retryOn && !config.retryOn(error)) {
                    log.debug('Error not retryable', { attempt, error });
                    throw error;
                }

                // Check if we've exhausted all attempts
                if (attempt === config.maxAttempts) {
                    log.warn('All retry attempts exhausted', {
                        attempts: attempt,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    config.onExhausted?.(error);
                    throw error;
                }

                // Calculate delay
                const delay = this.calculateDelay(attempt, config);

                log.debug('Retrying operation', {
                    attempt,
                    maxAttempts: config.maxAttempts,
                    delay,
                    error: error instanceof Error ? error.message : String(error)
                });

                // Notify callback
                config.onRetry?.(attempt, delay, error);

                // Wait before retrying
                await this.sleep(delay);
            }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError;
    }

    /**
     * Execute with result wrapper (doesn't throw)
     */
    async executeWithResult<T>(
        operation: () => Promise<T>,
        options: Partial<RetryOptions> = {}
    ): Promise<RetryResult<T>> {
        let attempts = 0;

        try {
            const config: RetryOptions = { ...DEFAULT_CONFIG, ...options };

            for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
                attempts = attempt;

                try {
                    const data = await operation();
                    return { success: true, data, attempts };
                } catch (error) {
                    if (config.retryOn && !config.retryOn(error)) {
                        return { success: false, error, attempts };
                    }

                    if (attempt === config.maxAttempts) {
                        config.onExhausted?.(error);
                        return { success: false, error, attempts };
                    }

                    const delay = this.calculateDelay(attempt, config);
                    config.onRetry?.(attempt, delay, error);
                    await this.sleep(delay);
                }
            }

            return { success: false, error: new Error('Unexpected retry loop exit'), attempts };
        } catch (error) {
            return { success: false, error, attempts };
        }
    }

    /**
     * Create a retryable version of an async function
     */
    wrap<TArgs extends any[], TResult>(
        fn: (...args: TArgs) => Promise<TResult>,
        options: Partial<RetryOptions> = {}
    ): (...args: TArgs) => Promise<TResult> {
        return (...args: TArgs) => this.execute(() => fn(...args), options);
    }

    // ===========================================================================
    // Private Helpers
    // ===========================================================================

    private calculateDelay(attempt: number, config: RetryConfig): number {
        if (config.backoff === 'fixed') {
            return config.baseDelay;
        }

        // Exponential backoff with jitter
        const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
        const delay = exponentialDelay + jitter;

        return Math.min(delay, config.maxDelay);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const retryEngine = new RetryEngine();
export default retryEngine;
