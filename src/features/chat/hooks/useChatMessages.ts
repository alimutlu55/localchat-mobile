/**
 * useChatMessages Hook
 *
 * Manages chat message state, WebSocket subscriptions, and message operations.
 * Extracted from ChatRoomScreen to separate concerns.
 *
 * Responsibilities:
 * - Load message history on mount
 * - Subscribe to real-time message updates
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
import { messageService, wsService, WS_EVENTS, roomService } from '../../../services';
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
import { createLogger } from '../../../shared/utils/logger';
import { isNotParticipant, isUserBanned } from '../../../shared/utils/errors';
import { useRoomStore } from '../../rooms/store';

const log = createLogger('ChatMessages');

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

function createSystemMessage(
  type: 'user_joined' | 'user_left' | 'user_kicked' | 'user_banned',
  userName: string
): string {
  switch (type) {
    case 'user_joined':
      return `${userName} joined the room`;
    case 'user_left':
      return `${userName} left the room`;
    case 'user_kicked':
      return `${userName} was removed from the room`;
    case 'user_banned':
      return `${userName} was banned from the room`;
    default:
      return '';
  }
}

function makeSystemMessage(
  type: 'user_joined' | 'user_left' | 'user_kicked' | 'user_banned',
  userName: string
): ChatMessage {
  return {
    id: `system-${type}-${Date.now()}`,
    type: 'system',
    content: createSystemMessage(type, userName),
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
    // Subscribe to room on mount
    wsService.subscribe(roomId);
    log.debug('Subscribed to room', { roomId });

    // Load initial messages
    loadMessages();

    // Cleanup on unmount
    return () => {
      wsService.unsubscribe(roomId);
      log.debug('Unsubscribed from room', { roomId });
    };
  }, [roomId, loadMessages]);

  // ==========================================================================
  // Message Event Handlers
  // ==========================================================================

  useEffect(() => {
    // Handle new messages
    const unsubMessage = wsService.on<MessageNewPayload>(WS_EVENTS.MESSAGE_NEW, (payload) => {
      if (payload.roomId !== roomId) return;

      setMessages((prev) => {
        // Check for duplicate by id or clientMessageId
        const existingIndex = prev.findIndex(
          (m) =>
            m.id === payload.id ||
            (payload.clientMessageId && m.clientMessageId === payload.clientMessageId)
        );

        if (existingIndex !== -1) {
          // Update the optimistic message with server data
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            id: payload.id,
            status: 'delivered' as MessageStatus,
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
              id: payload.id,
              status: 'delivered' as MessageStatus,
            };
            return updated;
          }
        }

        // New message from another user
        const newMessage: ChatMessage = {
          id: payload.id,
          type: 'user',
          content: payload.content,
          timestamp: new Date(payload.createdAt),
          userId: payload.sender.id,
          userName: payload.sender.displayName || 'Anonymous User',
          userProfilePhoto: payload.sender.profilePhotoUrl,
          status: 'delivered',
          clientMessageId: payload.clientMessageId,
        };

        return [...prev, newMessage];
      });
    });

    // Handle message acknowledgments
    const unsubAck = wsService.on<MessageAckPayload>(WS_EVENTS.MESSAGE_ACK, (payload) => {
      const { clientMessageId, messageId, status } = payload;

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

    // Handle messages read event - update status to 'read' for own messages
    // This is triggered when another user reads messages in the room
    const unsubRead = wsService.on<MessageReadPayload>(WS_EVENTS.MESSAGE_READ, (payload) => {
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
          // If we can't find the message, mark all our messages as read
          // This handles the case where messages were loaded after the read event
          return prev.map((msg) => {
            if (msg.userId === userId && msg.status !== 'read') {
              return { ...msg, status: 'read' as MessageStatus };
            }
            return msg;
          });
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

    // Handle reactions
    const unsubReaction = wsService.on<MessageReactionPayload>(WS_EVENTS.MESSAGE_REACTION, (payload) => {
      if (payload.roomId !== roomId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { ...msg, reactions: payload.reactions }
            : msg
        )
      );
    });

    // Handle connection state changes
    const unsubConnection = wsService.on('connectionStateChange', (state: string) => {
      if (state === 'connected') {
        setConnectionState('connected');
      } else if (state === 'reconnecting') {
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
  // Room/User Event Handlers
  // ==========================================================================

  useEffect(() => {
    // Handle room closed
    const unsubRoomClosed = wsService.on<RoomClosedPayload>(WS_EVENTS.ROOM_CLOSED, (payload) => {
      if (payload.roomId === roomId) {
        optionsRef.current.onRoomClosed?.();
      }
    });

    // Handle user joined (show system message)
    const unsubUserJoined = wsService.on<UserJoinedPayload>(WS_EVENTS.USER_JOINED, (payload) => {
      if (payload.roomId !== roomId) return;

      const joinedUserId = payload.user?.id;
      const joinedDisplayName = payload.user?.displayName || 'Someone';

      // Show system message for others joining
      if (joinedUserId !== userId) {
        setMessages((prev) => [
          ...prev,
          makeSystemMessage('user_joined', joinedDisplayName),
        ]);
      }
    });

    // Handle user left (show system message)
    const unsubUserLeft = wsService.on<UserLeftPayload>(WS_EVENTS.USER_LEFT, (payload) => {
      if (payload.roomId !== roomId) return;

      // Show system message for others leaving
      if (payload.userId !== userId) {
        const displayName = payload.displayName || 'Someone';
        setMessages((prev) => [
          ...prev,
          makeSystemMessage('user_left', displayName),
        ]);
      }
    });

    // Handle user kicked
    const unsubUserKicked = wsService.on<UserKickedPayload>(WS_EVENTS.USER_KICKED, async (payload) => {
      if (payload.roomId !== roomId) return;

      // If current user was kicked
      if (payload.kickedUserId === userId) {
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

      // Show system message for others
      setMessages((prev) => [
        ...prev,
        makeSystemMessage('user_kicked', payload.displayName || 'A user'),
      ]);

      // Update participant count if provided
      if (payload.participantCount !== undefined) {
        try {
          updateRoom(roomId, { participantCount: payload.participantCount });
        } catch (err) {
          // ignore
        }
        return;
      }

      // Fallback: fetch fresh room and update cache
      try {
        const fresh = await roomService.getRoom(roomId);
        setRoom(fresh);
      } catch (err) {
        console.error('Failed to refresh room after kick', err);
      }
    });

    // Handle user banned
    const unsubUserBanned = wsService.on<UserBannedPayload>(WS_EVENTS.USER_BANNED, async (payload) => {
      if (payload.roomId !== roomId) return;

      // If current user was banned
      if (payload.bannedUserId === userId) {
        optionsRef.current.onUserBanned?.(payload.reason);
        try {
          const fresh = await roomService.getRoom(roomId);
          setRoom(fresh);
        } catch (err) {
          // ignore
        }
        return;
      }

      // Show system message for others
      setMessages((prev) => [
        ...prev,
        makeSystemMessage('user_banned', payload.displayName || 'A user'),
      ]);

      if (payload.participantCount !== undefined) {
        try {
          updateRoom(roomId, { participantCount: payload.participantCount });
        } catch (err) {
          // ignore
        }
        return;
      }

      try {
        const fresh = await roomService.getRoom(roomId);
        setRoom(fresh);
      } catch (err) {
        console.error('Failed to refresh room after ban', err);
      }
    });

    return () => {
      unsubRoomClosed();
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

  return {
    messages,
    isLoading,
    error,
    connectionState,
    sendMessage,
    addReaction,
    refresh,
    markMessagesAsRead,
  };
}

export default useChatMessages;
