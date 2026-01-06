/**
 * Message Types for BubbleUp Mobile
 */

/**
 * ChatMessage - UI model for chat messages
 */
export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  userProfilePhoto?: string;
  status?: MessageStatus;
  clientMessageId?: string;
  reactions?: MessageReaction[];
  isDeleted?: boolean;
}

/**
 * Message Status - tracks delivery state
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Message Reaction
 */
export interface MessageReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

/**
 * System Message Types
 */
export type SystemMessageType =
  | 'user_joined'
  | 'user_left'
  | 'room_created'
  | 'room_settings_changed'
  | 'room_expiring_soon'
  | 'room_extended';

/**
 * Report Reason
 */
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

/**
 * Message Report
 */
export interface MessageReport {
  reason: ReportReason;
  description?: string;
}

/**
 * Typing User - for typing indicators
 */
export interface TypingUser {
  userId: string;
  displayName: string;
  timestamp: number;
}

