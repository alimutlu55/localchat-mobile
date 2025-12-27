/**
 * Core Events Module
 *
 * Central event management system for the application.
 *
 * Usage:
 * ```typescript
 * import { eventBus } from '@/core/events';
 *
 * // Subscribe
 * const unsub = eventBus.on('room.userJoined', (payload) => { ... });
 *
 * // Emit
 * eventBus.emit('room.userJoined', { roomId, userId, userName });
 *
 * // Cleanup
 * unsub();
 * ```
 */

export {
  eventBus,
  type EventName,
  type EventHandler,
  type AllEvents,
  type RoomEvents,
  type MessageEvents,
  type TypingEvents,
  type ConnectionEvents,
} from './EventBus';
