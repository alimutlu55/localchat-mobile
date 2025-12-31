/**
 * Network State Store
 *
 * Zustand store for unified network state management.
 * Provides a single source of truth for connection status.
 *
 * @example
 * ```typescript
 * import { useNetworkStore } from '@/core/network';
 *
 * const isOnline = useNetworkStore((s) => s.isOnline);
 * const wsState = useNetworkStore((s) => s.wsState);
 * ```
 */

import { create } from 'zustand';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('NetworkStore');

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface NetworkState {
    /** Whether device has internet connectivity */
    isOnline: boolean;
    /** WebSocket connection state */
    wsState: ConnectionState;
    /** Last time the device was online */
    lastOnlineAt: Date | null;
    /** Number of pending operations in queue */
    pendingOperations: number;
    /** Last error that occurred */
    lastError: string | null;
}

export interface NetworkActions {
    /** Set online/offline status */
    setOnline: (online: boolean) => void;
    /** Set WebSocket connection state */
    setWsState: (state: ConnectionState) => void;
    /** Increment pending operations count */
    incrementPending: () => void;
    /** Decrement pending operations count */
    decrementPending: () => void;
    /** Set last error message */
    setLastError: (error: string | null) => void;
    /** Reset to initial state */
    reset: () => void;
}

export type NetworkStore = NetworkState & NetworkActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: NetworkState = {
    isOnline: true, // Assume online initially
    wsState: 'disconnected',
    lastOnlineAt: null,
    pendingOperations: 0,
    lastError: null,
};

// =============================================================================
// Store Implementation
// =============================================================================

export const useNetworkStore = create<NetworkStore>()((set, get) => ({
    ...initialState,

    setOnline: (online: boolean) => {
        const wasOnline = get().isOnline;

        set({
            isOnline: online,
            lastOnlineAt: online ? new Date() : get().lastOnlineAt,
        });

        if (wasOnline !== online) {
            log.info('Network status changed', { online });
        }
    },

    setWsState: (state: ConnectionState) => {
        const previousState = get().wsState;

        set({ wsState: state });

        if (previousState !== state) {
            log.debug('WebSocket state changed', { from: previousState, to: state });
        }
    },

    incrementPending: () => {
        set((s) => ({ pendingOperations: s.pendingOperations + 1 }));
    },

    decrementPending: () => {
        set((s) => ({ pendingOperations: Math.max(0, s.pendingOperations - 1) }));
    },

    setLastError: (error: string | null) => {
        set({ lastError: error });
    },

    reset: () => {
        set(initialState);
        log.debug('Network store reset');
    },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectIsOnline = (state: NetworkStore) => state.isOnline;
export const selectWsState = (state: NetworkStore) => state.wsState;
export const selectIsConnected = (state: NetworkStore) =>
    state.isOnline && state.wsState === 'connected';
export const selectHasPendingOperations = (state: NetworkStore) =>
    state.pendingOperations > 0;

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to get simplified network status
 */
export function useNetworkStatus() {
    const isOnline = useNetworkStore(selectIsOnline);
    const wsState = useNetworkStore(selectWsState);
    const isConnected = useNetworkStore(selectIsConnected);
    const pendingOperations = useNetworkStore((s) => s.pendingOperations);

    return {
        isOnline,
        wsState,
        isConnected,
        pendingOperations,
        isReconnecting: wsState === 'reconnecting',
    };
}

export default useNetworkStore;
