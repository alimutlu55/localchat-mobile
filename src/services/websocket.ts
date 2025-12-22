/**
 * WebSocket Service
 *
 * Handles real-time communication with the backend WebSocket server.
 * Provides automatic reconnection, room subscriptions, and message handling.
 *
 * @example
 * ```typescript
 * // Connect and subscribe to a room
 * await wsService.connect();
 * wsService.subscribe(roomId);
 *
 * // Listen for messages
 * wsService.on('message.new', (payload) => {
 *   console.log('New message:', payload);
 * });
 *
 * // Send a message
 * wsService.sendMessage(roomId, 'Hello!');
 * ```
 */

import { AppState, AppStateStatus } from 'react-native';
import { API_CONFIG, WS_EVENTS, STORAGE_KEYS } from '../constants';
import { secureStorage } from './storage';

/**
 * WebSocket connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Event payload types
 */
export interface NewMessagePayload {
  roomId: string;
  messageId: string;
  content: string;
  senderId: string;
  senderDisplayName: string;
  senderProfilePhotoUrl?: string;
  createdAt: string;
  clientMessageId?: string;
}

export interface MessageAckPayload {
  clientMessageId: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'failed';
  timestamp: string;
}

export interface TypingPayload {
  roomId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

export interface UserJoinedPayload {
  roomId: string;
  userId: string;
  displayName: string;
  profilePhotoUrl?: string;
  timestamp: string;
}

export interface UserLeftPayload {
  roomId: string;
  userId: string;
  displayName: string;
  timestamp: string;
}

export interface UserKickedPayload {
  roomId: string;
  userId: string;
  reason?: string;
}

export interface UserBannedPayload {
  roomId: string;
  userId: string;
  reason?: string;
}

export interface RoomClosedPayload {
  roomId: string;
  closedBy: string;
  timestamp: string;
}

export interface SubscribedPayload {
  roomId: string;
  success: boolean;
}

export interface ErrorPayload {
  code: string;
  message: string;
  roomId?: string;
}

/**
 * Event handler type
 */
type EventHandler<T = unknown> = (payload: T) => void;

/**
 * WebSocket Service class
 */
class WebSocketService {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private subscribedRooms = new Set<string>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private messageQueue: Array<{ type: string; payload: unknown }> = [];
  private appStateSubscription: { remove: () => void } | null = null;
  private authToken: string | null = null;

  constructor() {
    this.setupAppStateListener();
  }

  /**
   * Setup app state listener for background/foreground handling
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // App came to foreground
      if (this.connectionState === 'disconnected') {
        this.connect();
      }
    } else if (nextAppState === 'background') {
      // App went to background - keep connection alive but reduce activity
      this.stopHeartbeat();
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to WebSocket server
   * Implements authentication handshake:
   * 1. Connect to WS endpoint
   * 2. Receive auth_required from server
   * 3. Send auth message with token
   * 4. Receive auth_success or auth_error
   */
  async connect(): Promise<boolean> {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      return this.isConnected();
    }

    this.connectionState = 'connecting';
    this.emitStateChange();

    try {
      const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        console.warn('[WS] No auth token available');
        this.connectionState = 'disconnected';
        this.emitStateChange();
        return false;
      }

      // Store token for auth handshake
      this.authToken = token;

      return new Promise((resolve) => {
        this.ws = new WebSocket(API_CONFIG.WS_URL);

        this.ws.onopen = () => {
          console.log('[WS] Socket opened, waiting for auth_required...');
          // Don't mark as connected yet - wait for auth handshake
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data, resolve);
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Closed:', event.code, event.reason);
          this.handleDisconnect();
          if (this.connectionState === 'connecting') {
            resolve(false);
          }
        };

        // Connection timeout
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            console.error('[WS] Connection timeout');
            this.ws?.close();
            resolve(false);
          }
        }, 15000);
      });
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.connectionState = 'disconnected';
      this.emitStateChange();
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.subscribedRooms.clear();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.emitStateChange();
  }

  /**
   * Handle incoming message
   * Processes auth handshake and routes events to handlers
   */
  private handleMessage(data: string, connectResolve?: (value: boolean) => void): void {
    try {
      const message = JSON.parse(data);
      const { type, payload } = message;

      console.log(`[WS] Received: ${type}`);

      // Handle authentication flow
      switch (type) {
        case WS_EVENTS.AUTH_REQUIRED:
          console.log('[WS] Auth required, sending credentials...');
          this.sendAuth();
          return;

        case WS_EVENTS.AUTH_SUCCESS:
          console.log('[WS] Authentication successful!');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribeRooms();
          this.flushMessageQueue();
          this.emitStateChange();
          connectResolve?.(true);
          return;

        case WS_EVENTS.AUTH_ERROR:
          console.error('[WS] Authentication failed:', payload);
          this.connectionState = 'disconnected';
          this.emitStateChange();
          connectResolve?.(false);
          return;

        case WS_EVENTS.SERVER_PING:
          // Respond to server ping with pong
          this.send(WS_EVENTS.PONG, {});
          return;

        case WS_EVENTS.SERVER_PONG:
          // Received pong response to our ping
          return;
      }

      // Emit to registered handlers
      const handlers = this.eventHandlers.get(type);
      if (handlers) {
        handlers.forEach((handler) => handler(payload));
      }

      // Also emit to wildcard handlers
      const wildcardHandlers = this.eventHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler({ type, payload }));
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  }

  /**
   * Send authentication message
   */
  private sendAuth(): void {
    if (!this.authToken || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send auth - no token or socket not open');
      return;
    }

    const authMessage = {
      type: WS_EVENTS.AUTH,
      payload: {
        accessToken: this.authToken,
        clientInfo: {
          platform: 'IOS',
          appVersion: '1.0.0',
          deviceId: 'mobile-app',
        },
      },
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.connectionState = 'disconnected';
    this.emitStateChange();

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    this.connectionState = 'reconnecting';
    this.emitStateChange();

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[WS] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', {});
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message through WebSocket
   */
  private send(type: string, payload: unknown): boolean {
    if (!this.isConnected()) {
      this.messageQueue.push({ type, payload });
      return false;
    }

    try {
      this.ws!.send(JSON.stringify({ type, payload }));
      return true;
    } catch (error) {
      console.error('[WS] Send error:', error);
      this.messageQueue.push({ type, payload });
      return false;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message.type, message.payload);
      }
    }
  }

  /**
   * Resubscribe to rooms after reconnection
   */
  private resubscribeRooms(): void {
    this.subscribedRooms.forEach((roomId) => {
      this.send(WS_EVENTS.SUBSCRIBE, { roomId });
    });
  }

  /**
   * Emit connection state change
   */
  private emitStateChange(): void {
    const handlers = this.eventHandlers.get('connectionStateChange');
    if (handlers) {
      handlers.forEach((handler) => handler(this.connectionState));
    }
  }

  /**
   * Subscribe to a room
   */
  subscribe(roomId: string): void {
    this.subscribedRooms.add(roomId);
    this.send(WS_EVENTS.SUBSCRIBE, { roomId });
  }

  /**
   * Unsubscribe from a room
   */
  unsubscribe(roomId: string): void {
    this.subscribedRooms.delete(roomId);
    this.send(WS_EVENTS.UNSUBSCRIBE, { roomId });
  }

  /**
   * Send a chat message
   */
  sendMessage(roomId: string, content: string, clientMessageId: string): void {
    this.send(WS_EVENTS.SEND_MESSAGE, {
      roomId,
      content,
      clientMessageId,
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(roomId: string, isTyping: boolean): void {
    const event = isTyping ? WS_EVENTS.TYPING_START : WS_EVENTS.TYPING_STOP;
    this.send(event, { roomId });
  }

  /**
   * Mark messages as read
   */
  markRead(roomId: string, messageIds: string[]): void {
    this.send(WS_EVENTS.MARK_READ, { roomId, messageIds });
  }

  /**
   * Register event handler
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    this.disconnect();
    this.eventHandlers.clear();
    this.appStateSubscription?.remove();
  }
}

/**
 * Singleton WebSocket service instance
 */
export const wsService = new WebSocketService();

export default wsService;

