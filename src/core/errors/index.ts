/**
 * Core Errors Module
 *
 * Re-exports all error handling utilities for convenient imports.
 *
 * @example
 * ```typescript
 * import { errorHandler, ErrorType, ErrorSeverity } from '@/core/errors';
 * ```
 */

export * from './types';
export { errorHandler, default } from './ErrorHandler';
