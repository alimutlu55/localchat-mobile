/**
 * WebSocket Service
 *
 * Handles real-time communication with the backend WebSocket server.
 * Provides automatic reconnection, room subscriptions, and message handling.
 *
 * Architecture:
 * - WebSocket events are emitted to the central EventBus
 * - Feature modules subscribe to EventBus, NOT directly to wsService
 * - Legacy wsService.on() is kept for backward compatibility but deprecated
 *
 * @example
 * ```typescript
 * // Connect and subscribe to a room
 * await wsService.connect();
 * wsService.subscribe(roomId);
 *
 * // NEW: Listen via EventBus (preferred)
 * import { eventBus } from '@/core/events';
 * eventBus.on('message.new', (payload) => {
 *   console.log('New message:', payload);
 * });
 *
 * // DEPRECATED: Direct wsService.on() - use EventBus instead
 * wsService.on('message.new', (payload) => { ... });
 *
 * // Send a message
 * wsService.sendMessage(roomId, 'Hello!');
 * ```
 */

import { AppState, AppStateStatus } from 'react-native';
import { eventBus } from '../core/events';
import { useNetworkStore } from '../core/network';
import { API_CONFIG, WS_EVENTS, STORAGE_KEYS } from '../constants';
import { secureStorage } from './storage';
import { api } from './api';
import { APP_VERSION } from '../version';

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
  kickedUserId: string;
  kickedBy: string;
  displayName?: string;
}

export interface UserBannedPayload {
  roomId: string;
  bannedUserId: string;
  bannedBy: string;
  reason?: string;
  displayName?: string;
}

export interface UserUnbannedPayload {
  roomId: string;
  unbannedUserId: string;
  unbannedBy: string;
  displayName?: string;
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
  private maxReconnectAttempts = Infinity;
  private minReconnectDelay = 2000;    // Start with 2 seconds
  private maxReconnectDelay = 60000;   // Cap at 60 seconds
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private subscribedRooms = new Set<string>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private messageQueue: Array<{ type: string; payload: unknown }> = [];
  private appStateSubscription: { remove: () => void } | null = null;
  private authToken: string | null = null;

  constructor() {
    this.setupAppStateListener();
    this.setupNetworkListener();
  }

  /**
   * Setup network status listener to trigger immediate reconnect when online
   */
  private setupNetworkListener(): void {
    const { offlineManager } = require('../core/network/OfflineManager');
    this.networkUnsubscribe = offlineManager.onNetworkChange((isOnline: boolean) => {
      if (isOnline && (this.connectionState === 'disconnected' || this.connectionState === 'reconnecting')) {
        this.manualReconnect();
      }
    });
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
      let token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        this.connectionState = 'disconnected';
        this.emitStateChange();
        return false;
      }

      // Try to refresh the token before connecting to ensure it's valid
      const refreshed = await api.refreshAccessToken();
      if (refreshed) {
        token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
      }

      // Store token for auth handshake
      this.authToken = token;

      return new Promise((resolve) => {
        this.ws = new WebSocket(API_CONFIG.WS_URL);

        this.ws.onopen = () => {
          // Socket opened, waiting for auth_required
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data, resolve);
        };

        this.ws.onerror = () => {
          // Error handled by onclose
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
          if (this.connectionState === 'connecting') {
            resolve(false);
          }
        };

        // Connection timeout
        const timeout = setTimeout(() => {
          if (this.connectionState === 'connecting') {
            console.warn('[WS] Connection timeout (15s)');
            this.ws?.close();
            resolve(false);
          }
        }, 15000);
      });
    } catch (error) {
      // Respect auto-retry state
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connectionState = 'reconnecting';
      } else {
        this.connectionState = 'disconnected';
      }
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
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.emitStateChange();
  }

  /**
   * Manual reconnect triggered by user (e.g., clicking Retry button)
   * Resets retry counter and starts fresh connection attempt
   */
  manualReconnect(): void {
    this.reconnectAttempts = 0;
    this.connectionState = 'reconnecting';
    this.emitStateChange();
    this.connect();
  }

  /**
   * Handle incoming message
   * Processes auth handshake and routes events to handlers
   */
  private handleMessage(data: string, connectResolve?: (value: boolean) => void): void {
    try {
      const message = JSON.parse(data);
      const { type, payload } = message;

      // Handle authentication flow
      switch (type) {
        case WS_EVENTS.AUTH_REQUIRED:
          this.sendAuth();
          return;

        case WS_EVENTS.AUTH_SUCCESS:
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribeRooms();
          this.flushMessageQueue();
          this.emitStateChange();
          connectResolve?.(true);
          return;

        case WS_EVENTS.AUTH_ERROR:
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

      // Emit to registered handlers (DEPRECATED - for backward compatibility)
      const handlers = this.eventHandlers.get(type);
      if (handlers) {
        handlers.forEach((handler) => handler(payload));
      }

      // Also emit to wildcard handlers (DEPRECATED)
      const wildcardHandlers = this.eventHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler({ type, payload }));
      }

      this.emitToEventBus(type, payload);
    } catch (error) {
      // Failed to parse message - ignore
    }
  }

  /**
   * Send authentication message
   */
  private sendAuth(): void {
    if (!this.authToken || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage = {
      type: WS_EVENTS.AUTH,
      payload: {
        accessToken: this.authToken,
        clientInfo: {
          platform: 'IOS',
          appVersion: APP_VERSION,
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

    // If we've already set the state to 'disconnected' (e.g. auth_error), don't auto-retry
    if (this.connectionState === 'disconnected') {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.connectionState = 'reconnecting';
      this.emitStateChange();
      this.scheduleReconnect();
    } else {
      // All auto-retries exhausted
      this.connectionState = 'disconnected';
      this.emitStateChange();
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate exponential delay: 2s, 4s, 8s, 16s, 32s, then capped at maxReconnectDelay
    const delay = Math.min(
      this.minReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;

      // Before connecting, ensure we have a fresh token if we've been trying for a while
      if (this.reconnectAttempts % 3 === 0) {
        try {
          await api.refreshAccessToken();
          const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
          if (token) this.authToken = token;
        } catch (e) {
          console.error('[WS] Token refresh failed during reconnect', e);
        }
      }

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
   * Note: This is called on AUTH_SUCCESS to restore room subscriptions
   */
  private resubscribeRooms(): void {
    const rooms = Array.from(this.subscribedRooms);
    if (rooms.length === 0) {
      return;
    }

    // Send subscribe for each room
    rooms.forEach((roomId) => {
      this.send(WS_EVENTS.SUBSCRIBE, { roomId });
    });
  }

  /**
   * Emit connection state change
   */
  private emitStateChange(): void {
    // Sync with NetworkStore for unified state management
    useNetworkStore.getState().setWsState(this.connectionState);

    // Legacy handlers (DEPRECATED)
    const handlers = this.eventHandlers.get('connectionStateChange');
    if (handlers) {
      handlers.forEach((handler) => handler(this.connectionState));
    }

    // NEW: Emit to EventBus
    eventBus.emit('connection.stateChanged', {
      state: this.connectionState,
    });
  }

  /**
   * Map WebSocket events to EventBus events and emit
   * This decouples feature modules from the WebSocket implementation
   */
  private emitToEventBus(type: string, payload: any): void {
    switch (type) {
      // Message events
      case WS_EVENTS.MESSAGE_NEW:
        eventBus.emit('message.new', {
          roomId: payload.roomId,
          roomName: payload.roomName, // Include room name for notifications
          messageId: payload.id || payload.messageId, // Backend sends 'id', not 'messageId'
          content: payload.content,
          type: payload.type, // 'USER' or 'SYSTEM'
          systemMessageType: payload.systemMessageType,
          sender: payload.sender || {
            id: payload.senderId,
            displayName: payload.senderDisplayName,
            profilePhotoUrl: payload.senderProfilePhotoUrl,
          },
          createdAt: payload.createdAt,
          clientMessageId: payload.clientMessageId,
        });
        break;

      case WS_EVENTS.MESSAGE_ACK:
        eventBus.emit('message.ack', {
          clientMessageId: payload.clientMessageId,
          messageId: payload.messageId,
          status: payload.status,
          timestamp: payload.timestamp,
        });
        break;

      case WS_EVENTS.MESSAGE_REACTION:
        eventBus.emit('message.reaction', {
          roomId: payload.roomId,
          messageId: payload.messageId,
          reactions: payload.reactions,
        });
        break;

      case WS_EVENTS.MESSAGE_READ:
        eventBus.emit('message.read', {
          roomId: payload.roomId,
          readerId: payload.readerId,
          lastReadMessageId: payload.lastReadMessageId,
        });
        break;

      // Room events
      case WS_EVENTS.ROOM_CREATED:
        eventBus.emit('room.created', {
          roomId: payload.roomId || payload.room?.id,
          room: payload.room || payload,
        });
        break;

      case WS_EVENTS.ROOM_UPDATED:
        eventBus.emit('room.updated', {
          roomId: payload.roomId,
          updates: payload,
        });
        break;

      case WS_EVENTS.ROOM_CLOSED:
        eventBus.emit('room.closed', {
          roomId: payload.roomId,
          closedBy: payload.closedBy,
        });
        break;

      case WS_EVENTS.ROOM_EXPIRING:
        eventBus.emit('room.expiring', {
          roomId: payload.roomId,
          expiresAt: payload.expiresAt,
          minutesRemaining: payload.minutesRemaining || 0,
        });
        break;

      case WS_EVENTS.USER_JOINED:
        // Backend sends user object: { id, displayName, profilePhotoUrl }
        eventBus.emit('room.userJoined', {
          roomId: payload.roomId,
          userId: payload.user?.id || payload.userId,
          userName: payload.user?.displayName || payload.displayName,
          participantCount: payload.participantCount,
        });
        break;

      case WS_EVENTS.USER_LEFT:
        // Backend sends user object: { id, displayName, profilePhotoUrl }
        eventBus.emit('room.userLeft', {
          roomId: payload.roomId,
          userId: payload.user?.id || payload.userId,
          userName: payload.user?.displayName || payload.displayName,
          participantCount: payload.participantCount,
        });
        break;

      case WS_EVENTS.USER_KICKED:
        eventBus.emit('room.userKicked', {
          roomId: payload.roomId,
          kickedUserId: payload.kickedUserId,
          kickedBy: payload.kickedBy,
          userName: payload.displayName,
          participantCount: payload.participantCount,
        });
        break;

      case WS_EVENTS.USER_BANNED:
        eventBus.emit('room.userBanned', {
          roomId: payload.roomId,
          bannedUserId: payload.bannedUserId,
          bannedBy: payload.bannedBy,
          reason: payload.reason,
          userName: payload.displayName,
          participantCount: payload.participantCount,
        });
        break;

      case WS_EVENTS.USER_UNBANNED:
        eventBus.emit('room.userUnbanned', {
          roomId: payload.roomId,
          unbannedUserId: payload.unbannedUserId,
          unbannedBy: payload.unbannedBy,
        });
        break;

      case WS_EVENTS.PARTICIPANT_COUNT:
        eventBus.emit('room.participantCountUpdated', {
          roomId: payload.roomId,
          participantCount: payload.participantCount,
        });
        break;

      // Typing events
      case WS_EVENTS.USER_TYPING:
        if (payload.isTyping) {
          eventBus.emit('typing.start', {
            roomId: payload.roomId,
            userId: payload.userId,
            displayName: payload.displayName,
          });
        } else {
          eventBus.emit('typing.stop', {
            roomId: payload.roomId,
            userId: payload.userId,
            displayName: payload.displayName, // Include displayName if available
          });
        }
        break;

      // Connection errors
      case WS_EVENTS.ERROR:
        eventBus.emit('connection.error', {
          code: payload.code || 'UNKNOWN',
          message: payload.message || 'Unknown error',
        });
        break;

      // User events
      case WS_EVENTS.PROFILE_UPDATED:
        eventBus.emit('user.profileUpdated', {
          userId: payload.userId,
          displayName: payload.displayName,
          profilePhotoUrl: payload.profilePhotoUrl,
        });
        break;

      default:
        // Unknown events are not emitted to EventBus
        break;
    }
  }

  /**
   * Subscribe to a room
   */
  subscribe(roomId: string): void {
    if (this.subscribedRooms.has(roomId)) {
      return;
    }

    this.subscribedRooms.add(roomId);
    this.send(WS_EVENTS.SUBSCRIBE, { roomId });
  }

  /**
   * Force subscribe to a room (always sends, used after reconnection)
   * Unlike subscribe(), this always sends the message even if we think we're subscribed
   */
  forceSubscribe(roomId: string): void {
    this.subscribedRooms.add(roomId);
    this.send(WS_EVENTS.SUBSCRIBE, { roomId });
  }

  /**
   * Unsubscribe from a room
   */
  unsubscribe(roomId: string): void {
    if (!this.subscribedRooms.has(roomId)) {
      return;
    }

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
   * Send a message reaction
   */
  sendReaction(roomId: string, messageId: string, emoji: string): void {
    this.send(WS_EVENTS.SEND_REACTION, {
      roomId,
      messageId,
      emoji,
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
   * Update user profile via WebSocket
   * Broadcasts changes to all connected clients immediately
   */
  updateProfile(updates: { displayName?: string; profilePhotoUrl?: string }): void {
    this.send(WS_EVENTS.UPDATE_PROFILE, updates);
  }

  /**
   * Mark messages as read
   * Backend expects a single messageId (the last read message)
   */
  markRead(roomId: string, messageIds: string[]): void {
    if (messageIds.length === 0) return;

    // Send the last message ID (most recent message that was read)
    const lastMessageId = messageIds[messageIds.length - 1];
    this.send(WS_EVENTS.MARK_READ, { roomId, messageId: lastMessageId });
  }

  /**
   * Register event handler
   * 
   * @deprecated Use eventBus.on() from '@/core/events' instead.
   * This method is kept for backward compatibility during migration.
   * 
   * Example migration:
   * ```typescript
   * // Before (deprecated):
   * wsService.on('new_message', handler);
   * 
   * // After (preferred):
   * import { eventBus } from '@/core/events';
   * eventBus.on('message.new', handler);
   * ```
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
   * 
   * @deprecated Use the unsubscribe function returned by eventBus.on() instead.
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
    this.networkUnsubscribe?.();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/**
 * Singleton WebSocket service instance
 */
export const wsService = new WebSocketService();

export default wsService;

