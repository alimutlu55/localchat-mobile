/**
 * EventBus Unit Tests
 *
 * Tests the central event management system.
 * Validates:
 * - Event subscription/unsubscription
 * - Event emission
 * - Room-filtered subscriptions
 * - Error handling
 * - Cleanup
 */

import { eventBus, EventName } from '../../../../src/core/events/EventBus';

// Mock the logger
jest.mock('../../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock __DEV__
(global as any).__DEV__ = false;

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all handlers before each test
    eventBus.clear();
  });

  // ===========================================================================
  // Subscription Tests
  // ===========================================================================

  describe('on (subscribe)', () => {
    it('subscribes to events', () => {
      const handler = jest.fn();

      eventBus.on('room.created', handler);

      expect(eventBus.getHandlerCount('room.created')).toBe(1);
    });

    it('allows multiple handlers for same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('room.created', handler1);
      eventBus.on('room.created', handler2);

      expect(eventBus.getHandlerCount('room.created')).toBe(2);
    });

    it('returns unsubscribe function', () => {
      const handler = jest.fn();

      const unsubscribe = eventBus.on('room.created', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe function removes handler', () => {
      const handler = jest.fn();

      const unsubscribe = eventBus.on('room.created', handler);
      unsubscribe();

      expect(eventBus.getHandlerCount('room.created')).toBe(0);
    });
  });

  // ===========================================================================
  // Unsubscription Tests
  // ===========================================================================

  describe('off (unsubscribe)', () => {
    it('removes specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('room.created', handler1);
      eventBus.on('room.created', handler2);
      eventBus.off('room.created', handler1);

      expect(eventBus.getHandlerCount('room.created')).toBe(1);
    });

    it('does nothing for non-existent handler', () => {
      const handler = jest.fn();

      // Should not throw
      eventBus.off('room.created', handler);

      expect(eventBus.getHandlerCount('room.created')).toBe(0);
    });

    it('cleans up empty handler sets', () => {
      const handler = jest.fn();

      eventBus.on('room.created', handler);
      eventBus.off('room.created', handler);

      expect(eventBus.getHandlerCount('room.created')).toBe(0);
    });
  });

  // ===========================================================================
  // Emission Tests
  // ===========================================================================

  describe('emit', () => {
    it('calls all handlers for event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on('room.created', handler1);
      eventBus.on('room.created', handler2);

      eventBus.emit('room.created', { roomId: 'room-123', room: {} });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('passes payload to handlers', () => {
      const handler = jest.fn();
      const payload = { roomId: 'room-123', room: { title: 'Test Room' } };

      eventBus.on('room.created', handler);
      eventBus.emit('room.created', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('does not throw for events with no handlers', () => {
      // Should not throw
      expect(() => {
        eventBus.emit('room.created', { roomId: 'room-123', room: {} });
      }).not.toThrow();
    });

    it('continues to other handlers if one throws', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      eventBus.on('room.created', errorHandler);
      eventBus.on('room.created', successHandler);

      // Should not throw
      eventBus.emit('room.created', { roomId: 'room-123', room: {} });

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it('emits only to subscribed event handlers', () => {
      const roomCreatedHandler = jest.fn();
      const roomClosedHandler = jest.fn();

      eventBus.on('room.created', roomCreatedHandler);
      eventBus.on('room.closed', roomClosedHandler);

      eventBus.emit('room.created', { roomId: 'room-123', room: {} });

      expect(roomCreatedHandler).toHaveBeenCalled();
      expect(roomClosedHandler).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Room-Filtered Subscription Tests
  // ===========================================================================

  describe('onRoom', () => {
    it('only triggers for matching roomId', () => {
      const handler = jest.fn();

      eventBus.onRoom('room.userJoined', 'room-123', handler);

      // Emit for matching room
      eventBus.emit('room.userJoined', {
        roomId: 'room-123',
        userId: 'user-1',
        userName: 'Test User',
      });

      // Emit for different room
      eventBus.emit('room.userJoined', {
        roomId: 'room-456',
        userId: 'user-2',
        userName: 'Other User',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-123' })
      );
    });

    it('returns unsubscribe function', () => {
      const handler = jest.fn();

      const unsubscribe = eventBus.onRoom('room.userJoined', 'room-123', handler);
      unsubscribe();

      eventBus.emit('room.userJoined', {
        roomId: 'room-123',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Clear Tests
  // ===========================================================================

  describe('clear', () => {
    it('removes all handlers', () => {
      eventBus.on('room.created', jest.fn());
      eventBus.on('room.closed', jest.fn());
      eventBus.on('message.new', jest.fn());

      eventBus.clear();

      expect(eventBus.getHandlerCount('room.created')).toBe(0);
      expect(eventBus.getHandlerCount('room.closed')).toBe(0);
      expect(eventBus.getHandlerCount('message.new')).toBe(0);
    });
  });

  // ===========================================================================
  // Handler Count Tests
  // ===========================================================================

  describe('getHandlerCount', () => {
    it('returns 0 for unsubscribed events', () => {
      expect(eventBus.getHandlerCount('room.created')).toBe(0);
    });

    it('returns correct count', () => {
      eventBus.on('room.created', jest.fn());
      eventBus.on('room.created', jest.fn());
      eventBus.on('room.created', jest.fn());

      expect(eventBus.getHandlerCount('room.created')).toBe(3);
    });

    it('updates after unsubscribe', () => {
      const handler = jest.fn();

      const unsub = eventBus.on('room.created', handler);
      expect(eventBus.getHandlerCount('room.created')).toBe(1);

      unsub();
      expect(eventBus.getHandlerCount('room.created')).toBe(0);
    });
  });

  // ===========================================================================
  // All Event Types
  // ===========================================================================

  describe('All Event Types', () => {
    const eventPayloads: Partial<Record<EventName, any>> = {
      'room.created': { roomId: 'r1', room: {} },
      'room.updated': { roomId: 'r1', updates: { title: 'New' } },
      'room.closed': { roomId: 'r1', closedBy: 'u1' },
      'room.expiring': { roomId: 'r1', expiresAt: '2024-01-01', minutesRemaining: 5 },
      'room.userJoined': { roomId: 'r1', userId: 'u1', userName: 'Test' },
      'room.userLeft': { roomId: 'r1', userId: 'u1' },
      'room.userKicked': { roomId: 'r1', kickedUserId: 'u1', kickedBy: 'u2' },
      'room.userBanned': { roomId: 'r1', bannedUserId: 'u1', bannedBy: 'u2' },
      'room.userUnbanned': { roomId: 'r1', unbannedUserId: 'u1', unbannedBy: 'u2' },
      'room.participantCountUpdated': { roomId: 'r1', participantCount: 5 },
      'message.new': {
        roomId: 'r1',
        messageId: 'm1',
        content: 'Hello',
        sender: { id: 'u1', displayName: 'User' },
        createdAt: '2024-01-01',
      },
      'message.ack': { clientMessageId: 'c1', messageId: 'm1', status: 'sent', timestamp: '2024-01-01' },
      'message.reaction': { roomId: 'r1', messageId: 'm1', reactions: [] },
      'message.read': { roomId: 'r1', readerId: 'u1', lastReadMessageId: 'm1' },
      'typing.start': { roomId: 'r1', userId: 'u1', displayName: 'User' },
      'typing.stop': { roomId: 'r1', userId: 'u1' },
      'connection.stateChanged': { state: 'connected' },
      'connection.error': { code: 'ERR', message: 'Error' },
      'user.profileUpdated': { userId: 'u1', displayName: 'New Name' },
    };

    Object.entries(eventPayloads).forEach(([event, payload]) => {
      it(`handles ${event} event`, () => {
        const handler = jest.fn();

        eventBus.on(event as EventName, handler);
        eventBus.emit(event as EventName, payload);

        expect(handler).toHaveBeenCalledWith(payload);
      });
    });
  });

  // ===========================================================================
  // Integration-like Tests
  // ===========================================================================

  describe('Typical Usage Patterns', () => {
    it('useEffect pattern: subscribe and cleanup', () => {
      // Simulating React useEffect
      const handler = jest.fn();
      let cleanup: (() => void) | undefined;

      // Mount
      cleanup = eventBus.on('room.userJoined', handler);
      expect(eventBus.getHandlerCount('room.userJoined')).toBe(1);

      // Receive events while mounted
      eventBus.emit('room.userJoined', {
        roomId: 'r1',
        userId: 'u1',
        userName: 'User',
      });
      expect(handler).toHaveBeenCalledTimes(1);

      // Unmount
      cleanup();
      expect(eventBus.getHandlerCount('room.userJoined')).toBe(0);

      // No more events
      eventBus.emit('room.userJoined', {
        roomId: 'r1',
        userId: 'u2',
        userName: 'User2',
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('multiple components subscribing', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      const unsub1 = eventBus.on('message.new', handler1);
      const unsub2 = eventBus.on('message.new', handler2);
      const unsub3 = eventBus.on('message.new', handler3);

      eventBus.emit('message.new', {
        roomId: 'r1',
        messageId: 'm1',
        content: 'Hello',
        sender: { id: 'u1', displayName: 'User' },
        createdAt: '2024-01-01',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      // Component 2 unmounts
      unsub2();

      eventBus.emit('message.new', {
        roomId: 'r1',
        messageId: 'm2',
        content: 'World',
        sender: { id: 'u1', displayName: 'User' },
        createdAt: '2024-01-01',
      });

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1); // Not called again
      expect(handler3).toHaveBeenCalledTimes(2);

      // Cleanup
      unsub1();
      unsub3();
    });
  });
});
