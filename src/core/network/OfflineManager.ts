/**
 * Offline Manager
 *
 * Unified offline handling with operation queuing and network monitoring.
 * Automatically processes queued operations when connection is restored.
 *
 * @example
 * ```typescript
 * import { offlineManager } from '@/core/network';
 *
 * // Execute with offline support
 * await offlineManager.execute(
 *   () => api.sendMessage(roomId, content),
 *   {
 *     type: 'sendMessage',
 *     priority: 'high',
 *     context: { roomId },
 *   }
 * );
 *
 * // Check if online
 * if (offlineManager.isOnline()) {
 *   // Do online-only operation
 * }
 * ```
 */

import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { createLogger } from '../../shared/utils/logger';
import { useNetworkStore, ConnectionState } from './NetworkStore';
import { operationQueue, OperationPriority } from './OperationQueue';

const log = createLogger('OfflineManager');

// =============================================================================
// Types
// =============================================================================

export interface OfflineExecuteOptions {
    /** Operation type for queue grouping */
    type: string;
    /** Priority level */
    priority?: OperationPriority;
    /** Additional context for logging */
    context?: Record<string, unknown>;
    /** Whether to queue if offline (default: true) */
    queueIfOffline?: boolean;
    /** Maximum retry attempts */
    maxAttempts?: number;
}

type NetworkChangeHandler = (isOnline: boolean) => void;

// =============================================================================
// Offline Manager Class
// =============================================================================

class OfflineManager {
    private initialized = false;
    private unsubscribeNetInfo: (() => void) | null = null;
    private appStateSubscription: { remove: () => void } | null = null;
    private networkChangeHandlers = new Set<NetworkChangeHandler>();
    private operationIdCounter = 0;

    /**
     * Initialize the offline manager
     * Call once at app startup
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        log.debug('Initializing offline manager...');

        // Subscribe to network state changes
        this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetInfoChange.bind(this));

        // Subscribe to app state changes
        this.appStateSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange.bind(this)
        );

        // Get initial network state
        const state = await NetInfo.fetch();
        this.updateNetworkState(state);

        // Subscribe to operation queue to update pending count
        operationQueue.subscribe((stats) => {
            useNetworkStore.getState().setLastError(
                stats.total > 0 ? `${stats.total} pending operations` : null
            );
        });

        this.initialized = true;
        log.info('Offline manager initialized');
    }

    /**
     * Cleanup the offline manager
     */
    cleanup(): void {
        this.unsubscribeNetInfo?.();
        this.appStateSubscription?.remove();
        this.networkChangeHandlers.clear();
        this.initialized = false;
        log.debug('Offline manager cleanup complete');
    }

    /**
     * Check if device is online
     */
    isOnline(): boolean {
        return useNetworkStore.getState().isOnline;
    }

    /**
     * Get WebSocket connection state
     */
    getWsState(): ConnectionState {
        return useNetworkStore.getState().wsState;
    }

    /**
     * Check if fully connected (online + WebSocket)
     */
    isConnected(): boolean {
        const state = useNetworkStore.getState();
        return state.isOnline && state.wsState === 'connected';
    }

    /**
     * Execute an operation with offline support
     * If offline, queues the operation for later
     */
    async execute<T>(
        operation: () => Promise<T>,
        options: OfflineExecuteOptions
    ): Promise<T> {
        const {
            type,
            priority = 'normal',
            context,
            queueIfOffline = true,
            maxAttempts = 3,
        } = options;

        // If online, execute immediately
        if (this.isOnline()) {
            try {
                return await operation();
            } catch (error) {
                // If it's a network error and queuing is enabled, queue it
                if (queueIfOffline && this.isNetworkError(error)) {
                    this.queueOperation(operation, { type, priority, context, maxAttempts });
                    throw error;
                }
                throw error;
            }
        }

        // If offline and queuing is enabled
        if (queueIfOffline) {
            this.queueOperation(operation, { type, priority, context, maxAttempts });
            throw new Error('Operation queued - device is offline');
        }

        throw new Error('Device is offline');
    }

    /**
     * Queue an operation for later execution
     */
    queueOperation<T>(
        operation: () => Promise<T>,
        options: {
            type: string;
            priority?: OperationPriority;
            context?: Record<string, unknown>;
            maxAttempts?: number;
        }
    ): string {
        const id = `op-${++this.operationIdCounter}-${Date.now()}`;

        operationQueue.enqueue({
            id,
            type: options.type,
            operation,
            priority: options.priority ?? 'normal',
            context: options.context,
            maxAttempts: options.maxAttempts,
        });

        useNetworkStore.getState().incrementPending();

        return id;
    }

    /**
     * Process all queued operations
     */
    async processQueue(): Promise<{ success: number; failed: number }> {
        if (!this.isOnline()) {
            log.debug('Cannot process queue - device is offline');
            return { success: 0, failed: 0 };
        }

        const result = await operationQueue.processAll();

        // Update pending count
        const stats = operationQueue.getStats();
        for (let i = 0; i < result.success + result.failed; i++) {
            useNetworkStore.getState().decrementPending();
        }

        return result;
    }

    /**
     * Subscribe to network state changes
     */
    onNetworkChange(handler: NetworkChangeHandler): () => void {
        this.networkChangeHandlers.add(handler);
        return () => this.networkChangeHandlers.delete(handler);
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        return operationQueue.getStats();
    }

    /**
     * Clear the operation queue
     */
    clearQueue(): void {
        const stats = operationQueue.getStats();
        operationQueue.clear();

        // Reset pending count
        for (let i = 0; i < stats.total; i++) {
            useNetworkStore.getState().decrementPending();
        }
    }

    // ===========================================================================
    // Private Helpers
    // ===========================================================================

    private handleNetInfoChange(state: NetInfoState): void {
        this.updateNetworkState(state);
    }

    private handleAppStateChange(nextAppState: AppStateStatus): void {
        if (nextAppState === 'active') {
            // App came to foreground - check network and process queue
            NetInfo.fetch().then((state) => {
                this.updateNetworkState(state);

                if (state.isConnected) {
                    // Delay queue processing slightly to allow WebSocket to reconnect
                    setTimeout(() => {
                        if (this.isConnected()) {
                            this.processQueue();
                        }
                    }, 2000);
                }
            });
        }
    }

    private updateNetworkState(state: NetInfoState): void {
        const isOnline = state.isConnected ?? false;
        const wasOnline = useNetworkStore.getState().isOnline;

        useNetworkStore.getState().setOnline(isOnline);

        // Notify handlers if state changed
        if (wasOnline !== isOnline) {
            log.info('Network state changed', { isOnline });
            this.networkChangeHandlers.forEach((handler) => handler(isOnline));

            // Process queue when coming back online
            if (isOnline && operationQueue.hasPending()) {
                // Delay to allow WebSocket to reconnect first
                setTimeout(() => {
                    if (this.isOnline()) {
                        this.processQueue();
                    }
                }, 2000);
            }
        }
    }

    private isNetworkError(error: unknown): boolean {
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return (
                msg.includes('network') ||
                msg.includes('fetch') ||
                msg.includes('timeout') ||
                msg.includes('connection') ||
                error.name === 'AbortError'
            );
        }
        return false;
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const offlineManager = new OfflineManager();
export default offlineManager;
