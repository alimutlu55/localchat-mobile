/**
 * useChatMessages Hook
 *
 * Manages chat message state, EventBus subscriptions, and message operations.
 * Extracted from ChatRoomScreen to separate concerns.
 *
 * CRITICAL: This hook includes guards against auth state transitions.
 * All EventBus handlers check if still authenticated before processing.
 * This prevents crashes during logout when components may still be mounted.
 *
 * Responsibilities:
 * - Load message history on mount
 * - Subscribe to real-time message updates via EventBus
 * - Handle optimistic message sending
 * - Track message acknowledgments and status
 * - Handle reactions
 *
 * @example
 * ```typescript
 * const {
 *   messages,
 *   isLoading,
 *   sendMessage,
 *   addReaction,
 *   connectionState,
 * } = useChatMessages(roomId);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { eventBus } from '../../../core/events';
import { messageService, wsService, roomService, notificationService } from '../../../services';
import {
  ChatMessage,
  MessageStatus,
  MessageNewPayload,
  MessageAckPayload,
  MessageReadPayload,
  MessageReactionPayload,
  UserJoinedPayload,
  UserLeftPayload,
  UserKickedPayload,
  UserBannedPayload,
  RoomClosedPayload,
} from '../../../types';
import { useUserId, useDisplayName, useAvatarUrl } from '../../user/store';
import { useAuthStore } from '../../auth/store/AuthStore';
import { createLogger } from '../../../shared/utils/logger';
import { isNotParticipant, isUserBanned } from '../../../shared/utils/errors';
import { useRoomStore } from '../../rooms/store';

const log = createLogger('ChatMessages');

// Deduplication: Track processed message IDs to prevent duplicates from server
const processedMessageIds = new Set<string>();
const MESSAGE_DEDUP_TTL = 10000; // 10 seconds

// Deduplication: Track processed kick/ban events to prevent duplicate alerts
const processedKickBanEvents = new Set<string>();
const KICK_BAN_DEDUP_TTL = 5000; // 5 seconds

// Message send timeout: Mark as failed if no ack received
const MESSAGE_SEND_TIMEOUT = 10000; // 10 seconds

/**
 * Helper to check if still authenticated
 * Used in event handlers to prevent processing during logout
 */
function isStillAuthenticated(): boolean {
  const status = useAuthStore.getState().status;
  return status === 'authenticated';
}

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export interface UseChatMessagesOptions {
  /** Called when user is not a participant (kicked/banned) */
  onAccessDenied?: (reason: 'banned' | 'not_participant') => void;
  /** Called when room is closed */
  onRoomClosed?: () => void;
  /** Called when current user is kicked */
  onUserKicked?: () => void;
  /** Called when current user is banned */
  onUserBanned?: (reason?: string) => void;
}

export interface UseChatMessagesReturn {
  /** All messages in the chat */
  messages: ChatMessage[];
  /** Whether initial message load is in progress */
  isLoading: boolean;
  /** Loading error message if any */
  error: string | null;
  /** Current WebSocket connection state */
  connectionState: ConnectionState;
  /** Send a new message */
  sendMessage: (content: string) => void;
  /** Retry sending a failed message */
  retryMessage: (message: ChatMessage) => void;
  /** Add/toggle a reaction on a message */
  addReaction: (messageId: string, emoji: string) => void;
  /** Manually refresh messages */
  refresh: () => Promise<void>;
  /** Mark messages as read (call when user views messages) */
  markMessagesAsRead: (messageIds: string[]) => void;
}

// =============================================================================
// System Message Helpers
// =============================================================================

type SystemMessageType =
  | 'user_joined'
  | 'user_left'
  | 'user_kicked'
  | 'user_banned'
  | 'room_expiring_soon'
  | 'room_closed';

function createSystemMessage(
  type: SystemMessageType,
  context?: string
): string {
  switch (type) {
    case 'user_joined':
      return `${context || 'Someone'} joined the room`;
    case 'user_left':
      return `${context || 'Someone'} left the room`;
    case 'user_kicked':
      return `${context || 'A user'} was removed from the room`;
    case 'user_banned':
      return `${context || 'A user'} was banned from the room`;
    case 'room_expiring_soon':
      return `⏰ This room is expiring in ${context || 'a few minutes'}`;
    case 'room_closed':
      return '🔒 This room has been closed';
    default:
      return '';
  }
}

function makeSystemMessage(
  type: SystemMessageType,
  context?: string
): ChatMessage {
  return {
    id: `system-${type}-${Date.now()}`,
    type: 'system',
    content: createSystemMessage(type, context),
    timestamp: new Date(),
    userId: 'system',
    userName: 'System',
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatMessages(
  roomId: string,
  options: UseChatMessagesOptions = {}
): UseChatMessagesReturn {
  const userId = useUserId();
  const displayName = useDisplayName();
  const avatarUrl = useAvatarUrl();

  // Room store (to update participant counts for UI)
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const setRoom = useRoomStore((s) => s.setRoom);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');

  // Refs for callbacks to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Track message send timeouts by clientMessageId
  const messageTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      messageTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      messageTimeoutsRef.current.clear();
    };
  }, []);

  // GUARD: If no userId, we're likely in a logout transition
  // Return early with empty state to prevent crashes
  if (!userId) {
    return {
      messages: [],
      isLoading: false,
      error: null,
      connectionState: 'disconnected',
      sendMessage: () => {
        log.warn('sendMessage called without userId - likely during logout');
      },
      retryMessage: () => {
        log.warn('retryMessage called without userId - likely during logout');
      },
      addReaction: () => {
        log.warn('addReaction called without userId - likely during logout');
      },
      refresh: async () => { },
      markMessagesAsRead: () => { },
    };
  }

  // ==========================================================================
  // Load Initial Messages
  // ==========================================================================

  const loadMessages = useCallback(async () => {
    log.debug('Loading messages', { roomId });
    setIsLoading(true);
    setError(null);

    try {
      const { messages: history } = await messageService.getHistory(roomId);
      setMessages(history);
      log.info('Loaded messages', { roomId, count: history.length });
    } catch (err) {
      log.error('Failed to load messages', err);

      // Check for access denied
      if (isUserBanned(err)) {
        optionsRef.current.onAccessDenied?.('banned');
        return;
      }
      if (isNotParticipant(err)) {
        optionsRef.current.onAccessDenied?.('not_participant');
        return;
      }

      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // ==========================================================================
  // WebSocket Subscription
  // ==========================================================================

  useEffect(() => {
    // Ensure we're subscribed to the room WebSocket when entering chat
    // This is a safety net in case RoomStoreProvider hasn't subscribed yet
    wsService.subscribe(roomId);
    log.debug('Ensured WebSocket subscription for chat room', { roomId });

    // Load initial messages
    loadMessages();

    // Set this as the active room for notifications (suppress notifications for current room)
    notificationService.setActiveRoom(roomId);

    // Cleanup on unmount - don't unsubscribe here, let RoomStoreProvider manage it
    return () => {
      // Clear active room so notifications can be shown again
      notificationService.setActiveRoom(null);
      log.debug('Cleared active room for notifications', { roomId });
    };
  }, [roomId, loadMessages]);

  // ==========================================================================
  // Message Event Handlers via EventBus
  // ==========================================================================

  useEffect(() => {
    // Handle new messages via EventBus
    const unsubMessage = eventBus.on('message.new', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) {
        log.debug('Skipping message.new - not authenticated');
        return;
      }

      if (payload.roomId !== roomId) return;

      // Deduplication: Skip if we've already processed this message
      if (processedMessageIds.has(payload.messageId)) {
        log.debug('Skipping duplicate message', { messageId: payload.messageId });
        return;
      }
      processedMessageIds.add(payload.messageId);
      setTimeout(() => processedMessageIds.delete(payload.messageId), MESSAGE_DEDUP_TTL);

      setMessages((prev) => {
        // Check for duplicate by id or clientMessageId
        const existingIndex = prev.findIndex(
          (m) =>
            m.id === payload.messageId ||
            (payload.clientMessageId && m.clientMessageId === payload.clientMessageId)
        );

        if (existingIndex !== -1) {
          // Update the optimistic message with server data
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            id: payload.messageId,
            status: 'sent' as MessageStatus,
          };
          return updated;
        }

        // Check if this is our own message from another device
        if (payload.sender.id === userId) {
          const pendingIndex = prev.findIndex(
            (m) =>
              m.userId === userId &&
              m.content === payload.content &&
              m.status === 'sending'
          );
          if (pendingIndex !== -1) {
            const updated = [...prev];
            updated[pendingIndex] = {
              ...updated[pendingIndex],
              id: payload.messageId,
              status: 'sent' as MessageStatus,
            };
            return updated;
          }
        }

        // New message from backend
        const isSystemMessage = payload.type === 'SYSTEM';
        const newMessage: ChatMessage = isSystemMessage
          ? {
            id: payload.messageId,
            type: 'system',
            content: payload.content,
            timestamp: new Date(payload.createdAt),
            userId: payload.sender.id,
            userName: 'System',
            status: 'sent',
          }
          : {
            id: payload.messageId,
            type: 'user',
            content: payload.content,
            timestamp: new Date(payload.createdAt),
            userId: payload.sender.id,
            userName: payload.sender.displayName || 'Anonymous User',
            userProfilePhoto: payload.sender.profilePhotoUrl,
            status: 'sent',
            clientMessageId: payload.clientMessageId,
          };

        return [...prev, newMessage];
      });
    });

    // Handle message acknowledgments via EventBus
    const unsubAck = eventBus.on('message.ack', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      const { clientMessageId, messageId, status } = payload;

      // Clear any pending timeout for this message
      const timeout = messageTimeoutsRef.current.get(clientMessageId);
      if (timeout) {
        clearTimeout(timeout);
        messageTimeoutsRef.current.delete(clientMessageId);
      }

      // Normalize status
      const statusLower = status?.toLowerCase();
      let normalizedStatus: MessageStatus = 'delivered';
      if (statusLower === 'sent') normalizedStatus = 'sent';
      else if (statusLower === 'delivered') normalizedStatus = 'delivered';
      else if (statusLower === 'read') normalizedStatus = 'read';
      else if (statusLower === 'failed') normalizedStatus = 'failed';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.clientMessageId === clientMessageId
            ? { ...msg, id: messageId, status: normalizedStatus }
            : msg
        )
      );
    });

    // Handle messages read event via EventBus - update status to 'read' for own messages
    // This is triggered when another user reads messages in the room
    const unsubRead = eventBus.on('message.read', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      const { readerId, lastReadMessageId } = payload;

      // Only update status if someone else read our messages
      if (readerId === userId) return;

      log.debug('Messages read event received', {
        roomId,
        readerId,
        lastReadMessageId,
        currentUserId: userId
      });

      // Find the index of the last read message
      // All of our messages up to and including this one should be marked as read
      setMessages((prev) => {
        // Find the last read message index
        const lastReadIndex = prev.findIndex((m) => m.id === lastReadMessageId);

        if (lastReadIndex === -1) {
          // If we can't find the message, don't mark anything as read
          // This prevents false positives where we mark messages as read incorrectly
          log.debug('message.read: lastReadMessageId not found, skipping', { lastReadMessageId });
          return prev;
        }

        // Mark all our messages up to and including lastReadIndex as read
        return prev.map((msg, index) => {
          if (msg.userId === userId && index <= lastReadIndex && msg.status !== 'read') {
            return { ...msg, status: 'read' as MessageStatus };
          }
          return msg;
        });
      });
    });

    // Handle reactions via EventBus
    const unsubReaction = eventBus.on('message.reaction', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;
      if (payload.roomId !== roomId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { ...msg, reactions: payload.reactions }
            : msg
        )
      );
    });

    // Handle connection state changes via EventBus
    const unsubConnection = eventBus.on('connection.stateChanged', (payload) => {
      if (payload.state === 'connected') {
        setConnectionState('connected');
        // Force re-subscribe after reconnection (server may have lost subscriptions)
        wsService.forceSubscribe(roomId);
        log.debug('Connection restored, forced resubscribe', { roomId });

        // Auto-resend any messages still in 'sending' status
        // This handles the case where server restarted and messages weren't delivered
        setMessages((prev) => {
          const pendingMessages = prev.filter(
            (m) => m.status === 'sending' && m.clientMessageId
          );

          if (pendingMessages.length > 0) {
            log.info('Resending pending messages after reconnection', {
              count: pendingMessages.length,
            });

            // Resend each pending message
            pendingMessages.forEach((msg) => {
              wsService.sendMessage(roomId, msg.content, msg.clientMessageId!);
            });
          }

          return prev; // No state change, just resending
        });
      } else if (payload.state === 'reconnecting') {
        setConnectionState('reconnecting');
      } else {
        setConnectionState('disconnected');
      }
    });

    return () => {
      unsubMessage();
      unsubAck();
      unsubRead();
      unsubReaction();
      unsubConnection();
    };
  }, [roomId, userId]);

  // ==========================================================================
  // Room/User Event Handlers via EventBus
  // ==========================================================================

  useEffect(() => {
    // Handle room closed via EventBus
    const unsubRoomClosed = eventBus.on('room.closed', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId === roomId) {
        log.info('Room closed', { roomId, closedBy: payload.closedBy });

        // Show system message
        setMessages((prev) => [
          ...prev,
          makeSystemMessage('room_closed'),
        ]);

        // Notify callback to navigate away
        optionsRef.current.onRoomClosed?.();
      }
    });

    // Handle room expiring via EventBus (server sends this before room expires)
    const unsubRoomExpiring = eventBus.on('room.expiring', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      log.info('Room expiring', { roomId, minutesRemaining: payload.minutesRemaining });

      // Show system message for room expiring
      setMessages((prev) => [
        ...prev,
        makeSystemMessage('room_expiring_soon', `${payload.minutesRemaining} minutes`),
      ]);
    });

    // Handle user joined via EventBus
    // Note: System message now comes from backend via message.new event
    const unsubUserJoined = eventBus.on('room.userJoined', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      // System message is now sent by backend and received via message.new
      // This handler can be used for participant count updates if needed
      log.debug('User joined', { userId: payload.userId, userName: payload.userName });
    });

    // Handle user left via EventBus
    // Note: System message now comes from backend via message.new event
    const unsubUserLeft = eventBus.on('room.userLeft', (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      // System message is now sent by backend and received via message.new
      // This handler can be used for participant count updates if needed
      log.debug('User left', { userId: payload.userId, userName: payload.userName });
    });

    // Handle user kicked via EventBus
    const unsubUserKicked = eventBus.on('room.userKicked', async (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      // If current user was kicked
      if (payload.kickedUserId === userId) {
        // Deduplicate to prevent double alerts
        const eventKey = `kick:${roomId}:${userId}`;
        if (processedKickBanEvents.has(eventKey)) {
          log.debug('Skipping duplicate kick event', { eventKey });
          return;
        }
        processedKickBanEvents.add(eventKey);
        setTimeout(() => processedKickBanEvents.delete(eventKey), KICK_BAN_DEDUP_TTL);

        optionsRef.current.onUserKicked?.();
        // Ensure cache is refreshed for UI
        try {
          const fresh = await roomService.getRoom(roomId);
          setRoom(fresh);
        } catch (err) {
          // ignore
        }
        return;
      }

      // System message is now sent by backend via message.new event
      // Just refresh room to get updated participant count
      try {
        const fresh = await roomService.getRoom(roomId);
        setRoom(fresh);
      } catch (err) {
        console.error('Failed to refresh room after kick', err);
      }
    });

    // Handle user banned via EventBus
    const unsubUserBanned = eventBus.on('room.userBanned', async (payload) => {
      // GUARD: Skip if not authenticated (during logout)
      if (!isStillAuthenticated()) return;

      if (payload.roomId !== roomId) return;

      // If current user was banned
      if (payload.bannedUserId === userId) {
        // Deduplicate to prevent double alerts
        const eventKey = `ban:${roomId}:${userId}`;
        if (processedKickBanEvents.has(eventKey)) {
          log.debug('Skipping duplicate ban event', { eventKey });
          return;
        }
        processedKickBanEvents.add(eventKey);
        setTimeout(() => processedKickBanEvents.delete(eventKey), KICK_BAN_DEDUP_TTL);

        optionsRef.current.onUserBanned?.(payload.reason);
        try {
          const fresh = await roomService.getRoom(roomId);
          setRoom(fresh);
        } catch (err) {
          // ignore
        }
        return;
      }

      // System message is now sent by backend via message.new event
      // Just refresh room to get updated participant count
      try {
        const fresh = await roomService.getRoom(roomId);
        setRoom(fresh);
      } catch (err) {
        console.error('Failed to refresh room after ban', err);
      }
    });

    return () => {
      unsubRoomClosed();
      unsubRoomExpiring();
      unsubUserJoined();
      unsubUserLeft();
      unsubUserKicked();
      unsubUserBanned();
    };
  }, [roomId, userId]);

  // ==========================================================================
  // Message Operations
  // ==========================================================================

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      // Generate client message ID for deduplication
      const clientMessageId = messageService.generateClientMessageId();

      // Create optimistic message with user's profile photo
      const optimisticMessage: ChatMessage = {
        id: `temp-${clientMessageId}`,
        type: 'user',
        content: trimmed,
        timestamp: new Date(),
        userId: userId || '',
        userName: displayName || 'You',
        userProfilePhoto: avatarUrl ?? undefined,
        status: 'sending',
        clientMessageId,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Send via WebSocket
      wsService.sendMessage(roomId, trimmed, clientMessageId);

      // Note: We no longer set a timeout to mark messages as failed.
      // Instead, messages stay in 'sending' status and are auto-resent
      // when the connection is restored (see connection.stateChanged handler).
      // This provides a better UX as messages "just work" after reconnection.

      log.debug('Message sent', { roomId, clientMessageId });
    },
    [roomId, userId, displayName, avatarUrl]
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      // Optimistic update
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;

          const reactions = [...(msg.reactions || [])];
          const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

          if (existingIndex !== -1) {
            const reaction = { ...reactions[existingIndex] };
            if (reaction.userReacted) {
              reaction.count = Math.max(0, reaction.count - 1);
              reaction.userReacted = false;
            } else {
              reaction.count += 1;
              reaction.userReacted = true;
            }

            if (reaction.count === 0) {
              reactions.splice(existingIndex, 1);
            } else {
              reactions[existingIndex] = reaction;
            }
          } else {
            reactions.push({ emoji, count: 1, userReacted: true });
          }

          return { ...msg, reactions };
        })
      );

      // Send to server
      wsService.sendReaction(roomId, messageId, emoji);
    },
    [roomId]
  );

  const refresh = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  // Track which message IDs we've already marked as read to avoid duplicates
  const markedAsReadRef = useRef<Set<string>>(new Set());

  /**
   * Mark messages as read
   * Called by the UI when messages come into view
   */
  const markMessagesAsRead = useCallback(
    (messageIds: string[]) => {
      // Filter out messages we've already marked as read
      const newMessageIds = messageIds.filter(
        (id) => !markedAsReadRef.current.has(id)
      );

      if (newMessageIds.length === 0) return;

      // Add to our local tracking set
      newMessageIds.forEach((id) => markedAsReadRef.current.add(id));

      log.debug('Marking messages as read', { roomId, count: newMessageIds.length });

      // Send read receipt to server
      wsService.markRead(roomId, newMessageIds);
    },
    [roomId]
  );

  /**
   * Retry sending a failed message
   * Resets status to 'sending' and resends via WebSocket
   */
  const retryMessage = useCallback(
    (failedMessage: ChatMessage) => {
      if (failedMessage.status !== 'failed' || !failedMessage.clientMessageId) {
        log.warn('Cannot retry: message not failed or missing clientMessageId');
        return;
      }

      const clientMessageId = failedMessage.clientMessageId;

      // Update status back to sending
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, status: 'sending' as const }
            : m
        )
      );

      // Resend via WebSocket
      wsService.sendMessage(roomId, failedMessage.content, clientMessageId);

      // Set new timeout
      const timeoutId = setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId && m.status === 'sending'
              ? { ...m, status: 'failed' as const }
              : m
          )
        );
        messageTimeoutsRef.current.delete(clientMessageId);
        log.warn('Message retry timeout', { roomId, clientMessageId });
      }, MESSAGE_SEND_TIMEOUT);

      messageTimeoutsRef.current.set(clientMessageId, timeoutId);

      log.debug('Message retry initiated', { roomId, clientMessageId });
    },
    [roomId]
  );

  return {
    messages,
    isLoading,
    error,
    connectionState,
    sendMessage,
    retryMessage,
    addReaction,
    refresh,
    markMessagesAsRead,
  };
}

export default useChatMessages;
