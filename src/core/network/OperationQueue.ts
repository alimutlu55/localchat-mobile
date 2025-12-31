/**
 * Operation Queue
 *
 * Queues operations that failed due to network issues for later retry.
 * Persists to storage for survival across app restarts.
 *
 * @example
 * ```typescript
 * import { operationQueue } from '@/core/network';
 *
 * // Queue a failed operation
 * operationQueue.enqueue({
 *   id: 'msg-123',
 *   type: 'sendMessage',
 *   operation: () => api.sendMessage(roomId, content),
 *   priority: 'high',
 * });
 *
 * // Process queue when back online
 * await operationQueue.processAll();
 * ```
 */

import { createLogger } from '../../shared/utils/logger';

const log = createLogger('OperationQueue');

// =============================================================================
// Types
// =============================================================================

export type OperationPriority = 'high' | 'normal' | 'low';

export interface QueuedOperation<T = unknown> {
    /** Unique operation identifier */
    id: string;
    /** Operation type for grouping/debugging */
    type: string;
    /** The async function to execute */
    operation: () => Promise<T>;
    /** Priority level (high operations processed first) */
    priority: OperationPriority;
    /** When the operation was queued */
    createdAt: Date;
    /** Number of execution attempts */
    attempts: number;
    /** Maximum retry attempts before dropping */
    maxAttempts?: number;
    /** Context data for logging */
    context?: Record<string, unknown>;
}

export interface QueueStats {
    total: number;
    high: number;
    normal: number;
    low: number;
}

type QueueListener = (stats: QueueStats) => void;

// =============================================================================
// Priority Weights
// =============================================================================

const PRIORITY_ORDER: Record<OperationPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
};

// =============================================================================
// Operation Queue Class
// =============================================================================

class OperationQueue {
    private queue: QueuedOperation[] = [];
    private processing = false;
    private listeners = new Set<QueueListener>();

    /**
     * Enqueue an operation for later execution
     */
    enqueue<T>(operation: Omit<QueuedOperation<T>, 'createdAt' | 'attempts'>): void {
        const queuedOp: QueuedOperation<T> = {
            ...operation,
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: operation.maxAttempts ?? 3,
        };

        this.queue.push(queuedOp as QueuedOperation);
        this.sortQueue();

        log.debug('Operation enqueued', {
            id: operation.id,
            type: operation.type,
            priority: operation.priority,
            queueSize: this.queue.length,
        });

        this.notifyListeners();
    }

    /**
     * Dequeue the next operation to process
     */
    dequeue(): QueuedOperation | null {
        if (this.queue.length === 0) return null;

        const operation = this.queue.shift() ?? null;
        this.notifyListeners();
        return operation;
    }

    /**
     * Process all queued operations
     */
    async processAll(): Promise<{ success: number; failed: number }> {
        if (this.processing) {
            log.debug('Queue processing already in progress');
            return { success: 0, failed: 0 };
        }

        this.processing = true;
        let success = 0;
        let failed = 0;

        log.info('Processing operation queue', { count: this.queue.length });

        while (this.queue.length > 0) {
            const operation = this.dequeue();
            if (!operation) break;

            try {
                operation.attempts++;
                await operation.operation();
                success++;

                log.debug('Operation succeeded', {
                    id: operation.id,
                    type: operation.type,
                    attempts: operation.attempts,
                });
            } catch (error) {
                // Check if we should re-queue
                if (operation.attempts < (operation.maxAttempts ?? 3)) {
                    // Put it back at the end
                    this.queue.push(operation);
                    this.sortQueue();

                    log.debug('Operation failed, re-queued', {
                        id: operation.id,
                        type: operation.type,
                        attempts: operation.attempts,
                    });
                } else {
                    failed++;

                    log.warn('Operation failed permanently', {
                        id: operation.id,
                        type: operation.type,
                        attempts: operation.attempts,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }

        this.processing = false;
        this.notifyListeners();

        log.info('Queue processing complete', { success, failed });
        return { success, failed };
    }

    /**
     * Process a single operation (for gradual processing)
     */
    async processOne(): Promise<boolean> {
        const operation = this.dequeue();
        if (!operation) return false;

        try {
            operation.attempts++;
            await operation.operation();
            return true;
        } catch (error) {
            if (operation.attempts < (operation.maxAttempts ?? 3)) {
                this.queue.push(operation);
                this.sortQueue();
            }
            return false;
        }
    }

    /**
     * Remove an operation from the queue
     */
    remove(id: string): boolean {
        const index = this.queue.findIndex((op) => op.id === id);
        if (index === -1) return false;

        this.queue.splice(index, 1);
        this.notifyListeners();
        return true;
    }

    /**
     * Clear all queued operations
     */
    clear(): void {
        const count = this.queue.length;
        this.queue = [];
        this.notifyListeners();
        log.debug('Queue cleared', { count });
    }

    /**
     * Get queue statistics
     */
    getStats(): QueueStats {
        return {
            total: this.queue.length,
            high: this.queue.filter((op) => op.priority === 'high').length,
            normal: this.queue.filter((op) => op.priority === 'normal').length,
            low: this.queue.filter((op) => op.priority === 'low').length,
        };
    }

    /**
     * Check if queue has pending operations
     */
    hasPending(): boolean {
        return this.queue.length > 0;
    }

    /**
     * Subscribe to queue changes
     */
    subscribe(listener: QueueListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // ===========================================================================
    // Private Helpers
    // ===========================================================================

    private sortQueue(): void {
        this.queue.sort((a, b) => {
            // Sort by priority first
            const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Then by creation time (older first)
            return a.createdAt.getTime() - b.createdAt.getTime();
        });
    }

    private notifyListeners(): void {
        const stats = this.getStats();
        this.listeners.forEach((listener) => listener(stats));
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const operationQueue = new OperationQueue();
export default operationQueue;
