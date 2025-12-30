/**
 * EventBus - Central Event Management System
 *
 * A lightweight, type-safe event bus for decoupling WebSocket events from consumers.
 *
 * Design Decisions:
 * - Singleton pattern: One bus for the entire app
 * - Type-safe events: Each event type has defined payload
 * - Unsubscribe returns: Cleanup functions for easy useEffect integration
 * - Debug mode: Optional logging for development
 *
 * Why an Event Bus?
 * - Decouples WebSocket service from UI components
 * - Eliminates duplicate event handlers across contexts/hooks
 * - Enables event filtering (e.g., by roomId)
 * - Makes testing easier (mock the bus, not the WebSocket)
 *
 * @example
 * ```typescript
 * // Subscribe to events
 * const unsub = eventBus.on('room.userJoined', (payload) => {
 *   console.log(`${payload.userName} joined room ${payload.roomId}`);
 * });
 *
 * // Emit events
 * eventBus.emit('room.userJoined', { roomId: '123', userId: '456', userName: 'Alice' });
 *
 * // Cleanup
 * unsub();
 * ```
 */

import { createLogger } from '../../shared/utils/logger';

const log = createLogger('EventBus');

// =============================================================================
// Event Type Definitions
// =============================================================================

/**
 * Room Events - Related to room lifecycle and membership
 */
export interface RoomEvents {
  'room.created': {
    roomId: string;
    room: any; // Full room object from server
  };
  'room.updated': {
    roomId: string;
    updates: Partial<{
      title: string;
      description: string;
      participantCount: number;
      status: string;
    }>;
  };
  'room.closed': {
    roomId: string;
    closedBy: string;
  };
  'room.expiring': {
    roomId: string;
    roomName?: string;
    expiresAt: string;
    minutesRemaining: number;
  };
  'room.userJoined': {
    roomId: string;
    userId: string;
    userName: string;
    participantCount?: number;
  };
  'room.userLeft': {
    roomId: string;
    userId: string;
    userName?: string;
    participantCount?: number;
  };
  'room.userKicked': {
    roomId: string;
    kickedUserId: string;
    kickedBy: string;
    userName?: string;
  };
  'room.userBanned': {
    roomId: string;
    bannedUserId: string;
    bannedBy: string;
    reason?: string;
    userName?: string;
  };
  'room.userUnbanned': {
    roomId: string;
    unbannedUserId: string;
    unbannedBy: string;
  };
  'room.participantCountUpdated': {
    roomId: string;
    participantCount: number;
  };
}

/**
 * Message Events - Related to chat messages
 */
export interface MessageEvents {
  'message.new': {
    roomId: string;
    roomName?: string;
    messageId: string;
    content: string;
    type?: 'USER' | 'SYSTEM';
    systemMessageType?: string;
    sender: {
      id: string;
      displayName: string;
      profilePhotoUrl?: string;
    };
    createdAt: string;
    clientMessageId?: string;
  };
  'message.ack': {
    clientMessageId: string;
    messageId: string;
    status: 'sent' | 'delivered' | 'failed';
    timestamp: string;
  };
  'message.reaction': {
    roomId: string;
    messageId: string;
    reactions: Array<{
      emoji: string;
      count: number;
      userReacted: boolean;
    }>;
  };
  'message.read': {
    roomId: string;
    readerId: string;
    lastReadMessageId: string;
  };
}

/**
 * Typing Events - Related to typing indicators
 */
export interface TypingEvents {
  'typing.start': {
    roomId: string;
    userId: string;
    displayName: string;
  };
  'typing.stop': {
    roomId: string;
    userId: string;
    displayName?: string; // May not be available in stop events
  };
}

/**
 * Connection Events - Related to WebSocket connection state
 */
export interface ConnectionEvents {
  'connection.stateChanged': {
    state: 'connected' | 'disconnected' | 'reconnecting' | 'connecting';
    previousState?: string;
  };
  'connection.error': {
    code: string;
    message: string;
  };
}

/**
 * User Events - Related to user profile updates
 */
export interface UserEvents {
  'user.profileUpdated': {
    userId: string;
    displayName?: string;
    profilePhotoUrl?: string;
  };
}

/**
 * All events combined
 */
export interface AllEvents extends RoomEvents, MessageEvents, TypingEvents, ConnectionEvents, UserEvents { }

/**
 * Event names as a union type
 */
export type EventName = keyof AllEvents;

/**
 * Event handler type
 */
export type EventHandler<T extends EventName> = (payload: AllEvents[T]) => void;

// =============================================================================
// EventBus Implementation
// =============================================================================

class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private debugMode = __DEV__;

  /**
   * Subscribe to an event
   * @param event Event name
   * @param handler Callback function
   * @returns Unsubscribe function
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    if (this.debugMode) {
      log.debug('Subscribed to event', { event, handlerCount: this.handlers.get(event)!.size });
    }

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Handler to remove
   */
  off<T extends EventName>(event: T, handler: EventHandler<T>): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);

      if (this.debugMode) {
        log.debug('Unsubscribed from event', { event, remainingHandlers: eventHandlers.size });
      }

      // Clean up empty sets
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event Event name
   * @param payload Event data
   */
  emit<T extends EventName>(event: T, payload: AllEvents[T]): void {
    const eventHandlers = this.handlers.get(event);

    if (this.debugMode) {
      log.debug('Emitting event', { event, handlerCount: eventHandlers?.size || 0 });
    }

    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          log.error('Event handler error', { event, error });
        }
      });
    }
  }

  /**
   * Subscribe to an event for a specific room
   * Convenience method that filters by roomId
   * @param event Event name (must have roomId in payload)
   * @param roomId Room to filter for
   * @param handler Callback function
   * @returns Unsubscribe function
   */
  onRoom<T extends keyof RoomEvents | keyof MessageEvents>(
    event: T,
    roomId: string,
    handler: EventHandler<T>
  ): () => void {
    const wrappedHandler = (payload: any) => {
      if (payload.roomId === roomId) {
        handler(payload);
      }
    };

    // Store reference for cleanup
    (wrappedHandler as any)._original = handler;
    (wrappedHandler as any)._roomId = roomId;

    return this.on(event as EventName, wrappedHandler);
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
    log.debug('All handlers cleared');
  }

  /**
   * Get handler count for an event (useful for debugging)
   */
  getHandlerCount(event: EventName): number {
    return this.handlers.get(event)?.size || 0;
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Global event bus instance
 * Import this to subscribe/emit events throughout the app
 */
export const eventBus = new EventBus();

export default eventBus;
