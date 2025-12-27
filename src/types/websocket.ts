/**
 * WebSocket Event Payload Types
 *
 * Type definitions for all WebSocket event payloads.
 * Ensures type safety when handling real-time events.
 */

// =============================================================================
// Message Events
// =============================================================================

/**
 * Payload for MESSAGE_NEW event
 */
export interface MessageNewPayload {
  id: string;
  roomId: string;
  content: string;
  createdAt: string;
  clientMessageId?: string;
  sender: {
    id: string;
    displayName: string;
    profilePhotoUrl?: string;
  };
}

/**
 * Payload for MESSAGE_ACK event
 */
export interface MessageAckPayload {
  clientMessageId: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

/**
 * Payload for MESSAGE_READ event (messages_read)
 * Sent when a user reads messages in a room
 */
export interface MessageReadPayload {
  roomId: string;
  readerId: string;
  lastReadMessageId: string | null;
  readAt: string;
}

/**
 * Payload for MESSAGE_REACTION event
 */
export interface MessageReactionPayload {
  roomId: string;
  messageId: string;
  reactions: Array<{
    emoji: string;
    count: number;
    userReacted: boolean;
  }>;
}

// =============================================================================
// User Events
// =============================================================================

/**
 * Payload for USER_TYPING event
 */
export interface UserTypingPayload {
  roomId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

/**
 * Payload for USER_JOINED event
 */
export interface UserJoinedPayload {
  roomId: string;
  user: {
    id: string;
    displayName: string;
    profilePhotoUrl?: string;
  };
  participantCount?: number;
}

/**
 * Payload for USER_LEFT event
 */
export interface UserLeftPayload {
  roomId: string;
  userId: string;
  displayName?: string;
  participantCount?: number;
}

/**
 * Payload for USER_KICKED event
 */
export interface UserKickedPayload {
  roomId: string;
  kickedUserId: string;
  displayName?: string;
  participantCount?: number;
}

/**
 * Payload for USER_BANNED event
 */
export interface UserBannedPayload {
  roomId: string;
  bannedUserId: string;
  displayName?: string;
  reason?: string;
  participantCount?: number;
}

/**
 * Payload for PROFILE_UPDATED event
 */
export interface ProfileUpdatedPayload {
  userId: string;
  displayName?: string;
  profilePhotoUrl?: string;
}

// =============================================================================
// Room Events
// =============================================================================

/**
 * Payload for ROOM_CLOSED event
 */
export interface RoomClosedPayload {
  roomId: string;
  reason?: string;
}

/**
 * Payload for ROOM_UPDATED event
 */
export interface RoomUpdatedPayload {
  roomId: string;
  title?: string;
  description?: string;
  participantCount?: number;
}
