/**
 * useNetworkState Hook
 *
 * Provides unified network state by combining:
 * - WebSocket connection state (from EventBus)
 * - General app connectivity
 *
 * @example
 * ```tsx
 * const { isConnected, wsState, isReconnecting } = useNetworkState();
 *
 * if (!isConnected) {
 *   return <OfflineBanner />;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { eventBus } from '../core/events';
import { wsService } from '../services';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('NetworkState');

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface NetworkState {
    /** Whether WebSocket is connected */
    isConnected: boolean;
    /** Whether currently reconnecting */
    isReconnecting: boolean;
    /** Whether currently in initial connection */
    isConnecting: boolean;
    /** Current WebSocket connection state */
    wsState: ConnectionState;
    /** Number of reconnection attempts (if reconnecting) */
    reconnectAttempts: number;
    /** Manually trigger reconnection */
    reconnect: () => Promise<boolean>;
    /** Get current state synchronously */
    getState: () => ConnectionState;
}

// =============================================================================
// Hook
// =============================================================================

export function useNetworkState(): NetworkState {
    const [wsState, setWsState] = useState<ConnectionState>(() => {
        // Initialize from current WebSocket state
        return wsService.getConnectionState() as ConnectionState;
    });

    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    // Subscribe to connection state changes via EventBus
    useEffect(() => {
        const unsubscribe = eventBus.on('connection.stateChanged', (payload) => {
            const newState = payload.state as ConnectionState;
            log.debug('Connection state changed', { newState });
            setWsState(newState);

            // Reset attempt counter on successful connection
            if (newState === 'connected') {
                setReconnectAttempts(0);
            } else if (newState === 'reconnecting') {
                setReconnectAttempts((prev) => prev + 1);
            }
        });

        return unsubscribe;
    }, []);

    // Handle app state changes (foreground/background)
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // App came to foreground - check connection
                const currentState = wsService.getConnectionState();
                if (currentState === 'disconnected') {
                    log.info('App became active with disconnected WebSocket, triggering reconnect');
                    wsService.connect();
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, []);

    // Manual reconnect function
    const reconnect = useCallback(async (): Promise<boolean> => {
        log.info('Manual reconnect triggered');
        setReconnectAttempts(0);
        return wsService.connect();
    }, []);

    // Synchronous state getter
    const getState = useCallback((): ConnectionState => {
        return wsService.getConnectionState() as ConnectionState;
    }, []);

    return {
        isConnected: wsState === 'connected',
        isReconnecting: wsState === 'reconnecting',
        isConnecting: wsState === 'connecting',
        wsState,
        reconnectAttempts,
        reconnect,
        getState,
    };
}

export default useNetworkState;
