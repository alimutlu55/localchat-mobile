import { AppState } from 'react-native';
import { wsService } from '../../../src/services/websocket';
import { eventBus } from '../../../src/core/events';
import { useNetworkStore } from '../../../src/core/network';
import { secureStorage } from '../../../src/services/storage';
import { api } from '../../../src/services/api';
import { WS_EVENTS } from '../../../src/constants';

// Mock dependencies
jest.mock('../../../src/core/events', () => ({
    eventBus: {
        emit: jest.fn(),
    },
}));

jest.mock('../../../src/core/network', () => ({
    useNetworkStore: {
        getState: jest.fn(() => ({
            setWsState: jest.fn(),
        })),
    },
}));

jest.mock('../../../src/core/network/OfflineManager', () => ({
    offlineManager: {
        onNetworkChange: jest.fn(() => jest.fn()),
    },
}));

jest.mock('../../../src/services/storage', () => ({
    secureStorage: {
        get: jest.fn(),
    },
}));

jest.mock('../../../src/services/api', () => ({
    api: {
        refreshAccessToken: jest.fn(),
    },
}));

// Mock Constants
jest.mock('../../../src/constants', () => ({
    API_CONFIG: {
        WS_URL: 'ws://mock-url',
    },
    WS_EVENTS: {
        AUTH_REQUIRED: 'auth_required',
        AUTH: 'auth',
        AUTH_SUCCESS: 'auth_success',
        AUTH_ERROR: 'auth_error',
        SUBSCRIBE: 'subscribe',
        UNSUBSCRIBE: 'unsubscribe',
        SEND_MESSAGE: 'send_message',
        MESSAGE_NEW: 'message.new',
    },
    STORAGE_KEYS: {
        AUTH_TOKEN: 'auth_token',
    },
}));

describe('WebSocketService', () => {
    const mockToken = 'mock-jwt-token';
    let mockSetWsState: jest.Mock;
    let createdWs: any;

    // Define MockWebSocket inside to have access to captured variable or just use outer var
    class MockWebSocket {
        onopen: () => void = () => { };
        onmessage: (event: any) => void = () => { };
        onclose: () => void = () => { };
        onerror: (error: any) => void = () => { };
        readyState: number = 0; // CONNECTING
        send: jest.Mock = jest.fn();
        close: jest.Mock = jest.fn();

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string | URL) {
            this.readyState = MockWebSocket.CONNECTING;
            createdWs = this;
            setTimeout(() => {
                this.readyState = MockWebSocket.OPEN;
                if (this.onopen) this.onopen();
            }, 10);
        }
    }

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Reset captured instance
        createdWs = undefined;

        // Mock global WebSocket
        global.WebSocket = MockWebSocket as any;

        mockSetWsState = jest.fn();
        (useNetworkStore.getState as jest.Mock).mockReturnValue({
            setWsState: mockSetWsState,
        });

        (secureStorage.get as jest.Mock).mockResolvedValue(mockToken);
        (api.refreshAccessToken as jest.Mock).mockResolvedValue(false);
    });

    afterEach(() => {
        wsService.cleanup();
        jest.useRealTimers();
    });

    const waitForWsCreation = async () => {
        // Run pending promises
        for (let i = 0; i < 3; i++) await Promise.resolve();
        jest.advanceTimersByTime(50);
    };

    describe('Connection', () => {
        it('connects successfully with valid token', async () => {
            const connectPromise = wsService.connect();

            // Allow async token retrieval and WS creation to happen
            await waitForWsCreation();

            expect(createdWs).toBeTruthy();

            // Simulate AUTH_REQUIRED
            createdWs.onmessage({
                data: JSON.stringify({ type: WS_EVENTS.AUTH_REQUIRED }),
            });

            // Verify AUTH sent
            expect(createdWs.send).toHaveBeenCalledWith(expect.stringContaining(WS_EVENTS.AUTH));
            expect(createdWs.send).toHaveBeenCalledWith(expect.stringContaining(mockToken));

            // Simulate AUTH_SUCCESS
            createdWs.onmessage({
                data: JSON.stringify({ type: WS_EVENTS.AUTH_SUCCESS }),
            });

            const result = await connectPromise;
            expect(result).toBe(true);
            expect(mockSetWsState).toHaveBeenCalledWith('connected');
        });

        it('fails to connect if no token', async () => {
            (secureStorage.get as jest.Mock).mockResolvedValue(null);

            const result = await wsService.connect();

            expect(result).toBe(false);
            expect(mockSetWsState).toHaveBeenCalledWith('disconnected');
        });

        it('handles auth error', async () => {
            const connectPromise = wsService.connect();
            await waitForWsCreation();

            createdWs.onmessage({
                data: JSON.stringify({ type: WS_EVENTS.AUTH_REQUIRED }),
            });

            // Simulate AUTH_ERROR
            createdWs.onmessage({
                data: JSON.stringify({ type: WS_EVENTS.AUTH_ERROR }),
            });

            const result = await connectPromise;
            expect(result).toBe(false);
            expect(mockSetWsState).toHaveBeenCalledWith('disconnected');
        });
    });

    describe('Reconnection', () => {
        it('attempts to reconnect on disconnect with backoff', async () => {
            // Establish connection first
            const connectPromise = wsService.connect();
            await waitForWsCreation();
            createdWs.onmessage({ data: JSON.stringify({ type: WS_EVENTS.AUTH_SUCCESS }) });
            await connectPromise;

            // Clear previous calls
            mockSetWsState.mockClear();
            const connectSpy = jest.spyOn(wsService, 'connect');

            // Simulate disconnect
            createdWs.onclose();

            expect(mockSetWsState).toHaveBeenCalledWith('reconnecting');

            // First retry: 2s
            // We need to advance timers but also allow async promises in scheduleReconnect
            jest.advanceTimersByTime(2000);
            await Promise.resolve(); // For the async callback in setTimeout

            expect(connectSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Events', () => {
        it('routes incoming messages to eventBus', async () => {
            // Establish connection
            const connectPromise = wsService.connect();
            await waitForWsCreation();
            createdWs.onmessage({ data: JSON.stringify({ type: WS_EVENTS.AUTH_SUCCESS }) });
            await connectPromise;

            const payload = {
                roomId: 'room-1',
                content: 'Hello',
                senderId: 'user-1'
            };

            // Simulate incoming message
            createdWs.onmessage({
                data: JSON.stringify({
                    type: WS_EVENTS.MESSAGE_NEW,
                    payload
                })
            });

            expect(eventBus.emit).toHaveBeenCalledWith('message.new', expect.objectContaining({
                content: 'Hello',
                roomId: 'room-1'
            }));
        });
    });

    describe('Sending', () => {
        it('sends message immediately if connected', async () => {
            // Establish connection
            const connectPromise = wsService.connect();
            await waitForWsCreation();
            createdWs.onmessage({ data: JSON.stringify({ type: WS_EVENTS.AUTH_SUCCESS }) });
            await connectPromise;

            wsService.sendMessage('room-1', 'Test', 'client-id-1');

            expect(createdWs.send).toHaveBeenCalledWith(expect.stringContaining('Test'));
        });

        it('queues message if disconnected and sends upon connection', async () => {
            // Ensure disconnected
            wsService.disconnect();

            wsService.sendMessage('room-1', 'Queued', 'client-id-2');

            // Now connect
            const connectPromise = wsService.connect();
            await waitForWsCreation();

            // Capture the NEW socket
            const currentWs = createdWs;

            currentWs.onmessage({ data: JSON.stringify({ type: WS_EVENTS.AUTH_REQUIRED }) });
            currentWs.onmessage({ data: JSON.stringify({ type: WS_EVENTS.AUTH_SUCCESS }) });

            await connectPromise;

            expect(currentWs.send).toHaveBeenCalledWith(expect.stringContaining('Queued'));
        });
    });
});
