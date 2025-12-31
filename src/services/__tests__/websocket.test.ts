/**
 * WebSocket Service Tests
 *
 * Tests for WebSocket connection, reconnection, and state management.
 */

import { wsService } from '../websocket';
import { useNetworkStore } from '../../core/network';

// Mock secure storage
jest.mock('../storage', () => ({
    secureStorage: {
        get: jest.fn().mockResolvedValue('mock-token'),
    },
}));

// Mock API for token refresh
jest.mock('../api', () => ({
    api: {
        refreshAccessToken: jest.fn().mockResolvedValue(true),
    },
}));

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((error: any) => void) | null = null;

    constructor() {
        // Simulate connection opening after a tick
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.();
        }, 10);
    }

    send = jest.fn();
    close = jest.fn(() => {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ code: 1000, reason: 'test close' });
    });

    // Helper to simulate auth_required message
    simulateAuthRequired() {
        this.onmessage?.({ data: JSON.stringify({ type: 'auth_required' }) });
    }

    // Helper to simulate auth_success
    simulateAuthSuccess() {
        this.onmessage?.({ data: JSON.stringify({ type: 'auth_success' }) });
    }

    // Helper to simulate auth_error
    simulateAuthError(message = 'Auth failed') {
        this.onmessage?.({
            data: JSON.stringify({ type: 'auth_error', payload: { message } }),
        });
    }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocket Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Reset NetworkStore
        useNetworkStore.setState({
            wsState: 'disconnected',
            isOnline: true,
        });

        // Reset wsService internal state via disconnect
        wsService.disconnect();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Connection State Management', () => {
        it('should have initial disconnected state', () => {
            expect(wsService.getConnectionState()).toBe('disconnected');
        });

        it('should transition to connecting when connect() is called', async () => {
            const connectPromise = wsService.connect();

            // Allow promise to start
            await Promise.resolve();

            expect(wsService.getConnectionState()).toBe('connecting');

            // Cleanup
            await jest.runAllTimersAsync();
        });

        it('should report isConnected() as false when disconnected', () => {
            expect(wsService.isConnected()).toBe(false);
        });
    });

    describe('Reconnection Settings', () => {
        it('should have 10 max reconnect attempts configured', () => {
            // Access private property via any cast for testing
            const service = wsService as any;
            expect(service.maxReconnectAttempts).toBe(10);
        });

        it('should have 3 second reconnect delay configured', () => {
            const service = wsService as any;
            expect(service.reconnectDelay).toBe(3000);
        });
    });

    describe('manualReconnect()', () => {
        it('should reset reconnect attempts to 0', () => {
            const service = wsService as any;
            service.reconnectAttempts = 5;

            wsService.manualReconnect();

            expect(service.reconnectAttempts).toBe(0);
        });

        it('should transition through reconnecting to connecting (via connect() call)', () => {
            // manualReconnect sets 'reconnecting' then calls connect() which sets 'connecting'
            wsService.manualReconnect();
            // After connect() starts, state becomes 'connecting'
            expect(wsService.getConnectionState()).toBe('connecting');
        });

        it('should emit state change to NetworkStore', () => {
            wsService.manualReconnect();

            // NetworkStore should reflect the connecting state (after connect() is called)
            const networkState = useNetworkStore.getState();
            expect(networkState.wsState).toBe('connecting');
        });
    });

    describe('Auto-Retry State Transitions', () => {
        it('should stay in reconnecting state during auto-retry loop', async () => {
            const service = wsService as any;
            service.reconnectAttempts = 3; // Mid-loop

            // Simulate disconnect
            service.handleDisconnect();

            expect(wsService.getConnectionState()).toBe('reconnecting');
        });

        it('should transition to disconnected after max attempts exhausted', async () => {
            const service = wsService as any;
            service.reconnectAttempts = 10; // At max

            // Simulate disconnect
            service.handleDisconnect();

            expect(wsService.getConnectionState()).toBe('disconnected');
        });

        it('should log when all auto-reconnect attempts are exhausted', () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const service = wsService as any;
            service.reconnectAttempts = 10;

            service.handleDisconnect();

            expect(consoleSpy).toHaveBeenCalledWith('[WS] All auto-reconnect attempts exhausted');
            consoleSpy.mockRestore();
        });
    });

    describe('scheduleReconnect()', () => {
        it('should use fixed 3-second delay (not exponential)', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            const service = wsService as any;
            service.reconnectAttempts = 0;
            service.connectionState = 'reconnecting';

            service.scheduleReconnect();

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

            // Test on 5th attempt - should still be 3 seconds, not 32 seconds
            service.reconnectAttempts = 5;
            service.scheduleReconnect();

            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 3000);

            setTimeoutSpy.mockRestore();
        });
    });

    describe('NetworkStore Integration', () => {
        it('should update NetworkStore wsState on state changes', () => {
            const service = wsService as any;

            service.connectionState = 'connecting';
            service.emitStateChange();
            expect(useNetworkStore.getState().wsState).toBe('connecting');

            service.connectionState = 'connected';
            service.emitStateChange();
            expect(useNetworkStore.getState().wsState).toBe('connected');

            service.connectionState = 'disconnected';
            service.emitStateChange();
            expect(useNetworkStore.getState().wsState).toBe('disconnected');

            service.connectionState = 'reconnecting';
            service.emitStateChange();
            expect(useNetworkStore.getState().wsState).toBe('reconnecting');
        });
    });

    describe('disconnect()', () => {
        it('should set state to disconnected', () => {
            wsService.disconnect();
            expect(wsService.getConnectionState()).toBe('disconnected');
        });

        it('should clear subscribed rooms', async () => {
            const service = wsService as any;
            service.subscribedRooms.add('room-1');
            service.subscribedRooms.add('room-2');

            wsService.disconnect();

            expect(service.subscribedRooms.size).toBe(0);
        });
    });
});

describe('WebSocket Retry Flow Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useNetworkStore.setState({
            wsState: 'disconnected',
            isOnline: true,
        });
        wsService.disconnect();
    });

    it('should stay in reconnecting state during auto-retry attempts (e.g., attempt 5)', async () => {
        jest.useFakeTimers();
        const service = wsService as any;
        service.reconnectAttempts = 5;
        const spy = jest.spyOn(service, 'scheduleReconnect');

        service.handleDisconnect();

        expect(wsService.getConnectionState()).toBe('reconnecting');

        // Advance timers and flush microtasks
        jest.advanceTimersByTime(3000);
        await Promise.resolve();

        // After timer, it should have incremented and tried to connect
        expect(service.reconnectAttempts).toBe(6);
        expect(wsService.getConnectionState()).toBe('connecting');

        spy.mockRestore();
        jest.useRealTimers();
    });

    it('should transition to disconnected after final attempt (attempt 10)', () => {
        const service = wsService as any;
        const consoleSpy = jest.spyOn(console, 'log');
        service.reconnectAttempts = 10;

        service.handleDisconnect();

        expect(wsService.getConnectionState()).toBe('disconnected');
        expect(consoleSpy).toHaveBeenCalledWith('[WS] All auto-reconnect attempts exhausted');

        consoleSpy.mockRestore();
    });

    it('should allow manual retry after auto-retry exhaustion', () => {
        const service = wsService as any;
        service.reconnectAttempts = 10;
        service.connectionState = 'disconnected';

        // User clicks retry
        wsService.manualReconnect();

        // Should reset attempts and transition to connecting (via connect() call)
        expect(service.reconnectAttempts).toBe(0);
        expect(wsService.getConnectionState()).toBe('connecting');
    });
});
