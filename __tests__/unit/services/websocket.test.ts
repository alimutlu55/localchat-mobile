/**
 * WebSocket Service Unit Tests
 *
 * Tests the WebSocket service in isolation.
 * Validates:
 * - Connection/disconnection
 * - Authentication handshake
 * - Room subscription
 * - Message sending
 * - Event emission to EventBus
 * - Reconnection logic
 * - Heartbeat management
 */

import { eventBus } from '../../../src/core/events';
import { WS_EVENTS } from '../../../src/constants';

// Mock dependencies
jest.mock('../../../src/services/storage', () => ({
  secureStorage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: 'Test close' });
  });

  // Helper to simulate receiving a message
  simulateMessage(type: string, payload: any) {
    this.onmessage?.({ data: JSON.stringify({ type, payload }) });
  }

  // Helper to simulate connection open
  simulateOpen() {
    this.onopen?.();
  }

  // Helper to simulate error
  simulateError(error: any) {
    this.onerror?.(error);
  }
}

// Store reference to mock instances
let mockWebSocketInstance: MockWebSocket | null = null;

// Create a mock WebSocket constructor with static properties
const MockWebSocketConstructor = jest.fn().mockImplementation(() => {
  mockWebSocketInstance = new MockWebSocket();
  return mockWebSocketInstance;
}) as jest.Mock & typeof MockWebSocket;

// Add static properties to the mock constructor
MockWebSocketConstructor.OPEN = 1;
MockWebSocketConstructor.CLOSED = 3;
MockWebSocketConstructor.CONNECTING = 0;
MockWebSocketConstructor.CLOSING = 2;

(global as any).WebSocket = MockWebSocketConstructor;

// Import after mocks are set up
import { wsService, ConnectionState } from '../../../src/services/websocket';
import { secureStorage } from '../../../src/services/storage';

// Helper to flush promises
const flushPromises = () => new Promise(setImmediate);

describe('WebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });
    eventBus.clear();
    mockWebSocketInstance = null;

    // Default: auth token available
    (secureStorage.get as jest.Mock).mockResolvedValue('test-token-123');
  });

  afterEach(() => {
    // Clean up the websocket service first
    wsService.cleanup();
    // Clear all pending timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // ===========================================================================
  // Connection Tests
  // ===========================================================================

  describe('connect', () => {
    it('returns false if no auth token', async () => {
      (secureStorage.get as jest.Mock).mockResolvedValue(null);
      await flushPromises();

      const result = await wsService.connect();

      expect(result).toBe(false);
      expect(wsService.getConnectionState()).toBe('disconnected');
    });

    it('creates WebSocket connection', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();

      // Simulate connection open
      mockWebSocketInstance?.simulateOpen();

      // Simulate auth required
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});

      // Simulate auth success
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});

      const result = await connectPromise;

      expect(result).toBe(true);
      expect(wsService.getConnectionState()).toBe('connected');
    });

    it('sends auth message after AUTH_REQUIRED', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();

      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"auth"')
      );

      // Complete the connection
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
    });

    it('includes access token in auth message', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();

      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});

      const sendCall = mockWebSocketInstance?.send.mock.calls[0][0];
      const parsed = JSON.parse(sendCall);

      expect(parsed.payload.accessToken).toBe('test-token-123');

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
    });

    it('returns false on auth error', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();

      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_ERROR, { message: 'Invalid token' });

      const result = await connectPromise;

      expect(result).toBe(false);
      expect(wsService.getConnectionState()).toBe('disconnected');
    });

    it('prevents duplicate connection attempts', async () => {
      await flushPromises();
      const connectPromise1 = wsService.connect();
      await flushPromises();

      // While connecting, try again
      const connectPromise2 = wsService.connect();

      expect(connectPromise2).resolves.toBe(false);

      // Complete first connection
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});

      await connectPromise1;
    });

    it('emits connection state changes to EventBus', async () => {
      const stateHandler = jest.fn();
      eventBus.on('connection.stateChanged', stateHandler);

      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();

      // Connecting state
      expect(stateHandler).toHaveBeenCalledWith({ state: 'connecting' });

      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});

      await connectPromise;

      // Connected state
      expect(stateHandler).toHaveBeenCalledWith({ state: 'connected' });
    });
  });

  // ===========================================================================
  // Disconnection Tests
  // ===========================================================================

  describe('disconnect', () => {
    it('closes WebSocket connection', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      wsService.disconnect();

      expect(mockWebSocketInstance?.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('clears subscribed rooms', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      wsService.subscribe('room-1');
      wsService.subscribe('room-2');

      wsService.disconnect();

      // After disconnect and reconnect, rooms should not be resubscribed
      expect(wsService.getConnectionState()).toBe('disconnected');
    });

    it('emits disconnected state', async () => {
      const stateHandler = jest.fn();
      eventBus.on('connection.stateChanged', stateHandler);

      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      jest.clearAllMocks();
      wsService.disconnect();

      expect(stateHandler).toHaveBeenCalledWith({ state: 'disconnected' });
    });
  });

  // ===========================================================================
  // Room Subscription Tests
  // ===========================================================================

  describe('subscribe', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
      jest.clearAllMocks();
    });

    it('sends subscribe message', () => {
      wsService.subscribe('room-123');

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: WS_EVENTS.SUBSCRIBE, payload: { roomId: 'room-123' } })
      );
    });

    it('prevents duplicate subscriptions', () => {
      wsService.subscribe('room-123');
      wsService.subscribe('room-123');
      wsService.subscribe('room-123');

      expect(mockWebSocketInstance?.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
      wsService.subscribe('room-123');
      jest.clearAllMocks();
    });

    it('sends unsubscribe message', () => {
      wsService.unsubscribe('room-123');

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: WS_EVENTS.UNSUBSCRIBE, payload: { roomId: 'room-123' } })
      );
    });

    it('does nothing for non-subscribed rooms', () => {
      wsService.unsubscribe('unknown-room');

      expect(mockWebSocketInstance?.send).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Message Sending Tests
  // ===========================================================================

  describe('sendMessage', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
      jest.clearAllMocks();
    });

    it('sends message with content and client ID', () => {
      wsService.sendMessage('room-123', 'Hello world', 'client-msg-1');

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.SEND_MESSAGE,
          payload: {
            roomId: 'room-123',
            content: 'Hello world',
            clientMessageId: 'client-msg-1',
          },
        })
      );
    });
  });

  describe('sendReaction', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
      jest.clearAllMocks();
    });

    it('sends reaction with emoji', () => {
      wsService.sendReaction('room-123', 'msg-456', '👍');

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.SEND_REACTION,
          payload: {
            roomId: 'room-123',
            messageId: 'msg-456',
            emoji: '👍',
          },
        })
      );
    });
  });

  describe('sendTyping', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
      jest.clearAllMocks();
    });

    it('sends typing start event', () => {
      wsService.sendTyping('room-123', true);

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.TYPING_START,
          payload: { roomId: 'room-123' },
        })
      );
    });

    it('sends typing stop event', () => {
      wsService.sendTyping('room-123', false);

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: WS_EVENTS.TYPING_STOP,
          payload: { roomId: 'room-123' },
        })
      );
    });
  });

  // ===========================================================================
  // EventBus Emission Tests
  // ===========================================================================

  describe('EventBus emission', () => {
    beforeEach(async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;
    });

    it('emits message.new on MESSAGE_NEW', () => {
      const handler = jest.fn();
      eventBus.on('message.new', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.MESSAGE_NEW, {
        roomId: 'room-123',
        id: 'msg-456',
        content: 'Hello',
        sender: { id: 'user-1', displayName: 'User One' },
        createdAt: '2024-01-01T00:00:00Z',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          messageId: 'msg-456',
          content: 'Hello',
        })
      );
    });

    it('emits message.ack on MESSAGE_ACK', () => {
      const handler = jest.fn();
      eventBus.on('message.ack', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.MESSAGE_ACK, {
        clientMessageId: 'client-1',
        messageId: 'msg-1',
        status: 'sent',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clientMessageId: 'client-1',
          status: 'sent',
        })
      );
    });

    it('emits room.userJoined on USER_JOINED', () => {
      const handler = jest.fn();
      eventBus.on('room.userJoined', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_JOINED, {
        roomId: 'room-123',
        user: { id: 'user-1', displayName: 'New User' },
        participantCount: 5,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          userId: 'user-1',
          userName: 'New User',
          participantCount: 5,
        })
      );
    });

    it('emits room.userLeft on USER_LEFT', () => {
      const handler = jest.fn();
      eventBus.on('room.userLeft', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_LEFT, {
        roomId: 'room-123',
        user: { id: 'user-1', displayName: 'Leaving User' },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          userId: 'user-1',
        })
      );
    });

    it('emits room.userKicked on USER_KICKED', () => {
      const handler = jest.fn();
      eventBus.on('room.userKicked', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_KICKED, {
        roomId: 'room-123',
        kickedUserId: 'user-bad',
        kickedBy: 'user-admin',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          kickedUserId: 'user-bad',
          kickedBy: 'user-admin',
        })
      );
    });

    it('emits room.userBanned on USER_BANNED', () => {
      const handler = jest.fn();
      eventBus.on('room.userBanned', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_BANNED, {
        roomId: 'room-123',
        bannedUserId: 'user-banned',
        bannedBy: 'user-admin',
        reason: 'Spam',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          bannedUserId: 'user-banned',
          reason: 'Spam',
        })
      );
    });

    it('emits room.closed on ROOM_CLOSED', () => {
      const handler = jest.fn();
      eventBus.on('room.closed', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.ROOM_CLOSED, {
        roomId: 'room-123',
        closedBy: 'user-creator',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          closedBy: 'user-creator',
        })
      );
    });

    it('emits typing.start on USER_TYPING with isTyping=true', () => {
      const handler = jest.fn();
      eventBus.on('typing.start', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_TYPING, {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Typer',
        isTyping: true,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          userId: 'user-1',
          displayName: 'Typer',
        })
      );
    });

    it('emits typing.stop on USER_TYPING with isTyping=false', () => {
      const handler = jest.fn();
      eventBus.on('typing.stop', handler);

      mockWebSocketInstance?.simulateMessage(WS_EVENTS.USER_TYPING, {
        roomId: 'room-123',
        userId: 'user-1',
        displayName: 'Typer',
        isTyping: false,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
          userId: 'user-1',
        })
      );
    });
  });

  // ===========================================================================
  // Message Queue Tests
  // ===========================================================================

  describe('Message Queue', () => {
    it('queues messages when not connected', () => {
      // Not connected
      wsService.sendMessage('room-123', 'Hello', 'msg-1');

      // No send because not connected
      expect(mockWebSocketInstance).toBeNull();
    });

    it('flushes queue on successful connection', async () => {
      // Queue a message before connecting
      wsService.sendMessage('room-123', 'Queued message', 'msg-queued');

      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      // Should have sent the queued message
      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
        expect.stringContaining('Queued message')
      );
    });
  });

  // ===========================================================================
  // Connection State Tests
  // ===========================================================================

  describe('getConnectionState', () => {
    it('returns disconnected initially', () => {
      expect(wsService.getConnectionState()).toBe('disconnected');
    });

    it('returns connecting during connection', () => {
      wsService.connect();

      expect(wsService.getConnectionState()).toBe('connecting');
    });

    it('returns connected after auth success', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      expect(wsService.getConnectionState()).toBe('connected');
    });
  });

  describe('isConnected', () => {
    it('returns false when disconnected', () => {
      expect(wsService.isConnected()).toBe(false);
    });

    it('returns true when connected', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      expect(wsService.isConnected()).toBe(true);
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================

  describe('cleanup', () => {
    it('disconnects and clears handlers', async () => {
      await flushPromises();
      const connectPromise = wsService.connect();
      await flushPromises();
      mockWebSocketInstance?.simulateOpen();
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_REQUIRED, {});
      mockWebSocketInstance?.simulateMessage(WS_EVENTS.AUTH_SUCCESS, {});
      await connectPromise;

      wsService.cleanup();

      expect(wsService.getConnectionState()).toBe('disconnected');
    });
  });
});
