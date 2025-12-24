/**
 * Message Service
 *
 * Handles all message-related operations including fetching history,
 * sending messages, and message reporting.
 *
 * @example
 * ```typescript
 * // Get message history
 * const { messages, hasMore } = await messageService.getHistory(roomId);
 *
 * // Send a message (via WebSocket)
 * wsService.sendMessage(roomId, 'Hello!', clientMessageId);
 * ```
 */

import { api } from './api';
import { ChatMessage, MessageStatus } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Message DTO from backend
 * Backend uses: { id, roomId, content, createdAt, sender: { id, displayName, profilePhotoUrl } }
 */
interface MessageDTO {
  id: string;
  roomId: string;
  senderId: string;
  senderDisplayName?: string;
  senderProfilePhotoUrl?: string;
  content: string;
  createdAt: string;
  type: 'USER' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  clientMessageId?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    userReacted: boolean;
  }>;
  isDeleted?: boolean;
}

/**
 * Pagination options
 */
interface PaginationOptions {
  limit?: number;
  before?: string;
  after?: string;
}

/**
 * Message history response
 */
interface MessageHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  cursor?: string;
}

/**
 * Transform backend DTO to frontend ChatMessage model
 */
function transformMessage(dto: MessageDTO): ChatMessage {
  // Normalize type
  const type = dto.type?.toLowerCase() === 'system' ? 'system' : 'user';

  // Normalize status
  let status: MessageStatus = 'delivered';
  if (dto.status) {
    const s = dto.status.toLowerCase();
    if (s === 'sent') status = 'sent';
    else if (s === 'delivered') status = 'delivered';
    else if (s === 'read') status = 'read';
    else if (s === 'failed') status = 'failed';
  }

  return {
    id: dto.id,
    type,
    content: dto.content,
    timestamp: new Date(dto.createdAt),
    userId: dto.senderId,
    userName: dto.senderDisplayName || 'Anonymous User',
    userProfilePhoto: dto.senderProfilePhotoUrl,
    status,
    clientMessageId: dto.clientMessageId,
    reactions: dto.reactions,
    isDeleted: dto.isDeleted,
  };
}

/**
 * Message Service class
 */
class MessageService {
  /**
   * Get message history for a room
   * Backend endpoint: GET /messages/room/{roomId}
   * Backend returns: { data: { messages, hasMore, oldestMessageId } }
   */
  async getHistory(
    roomId: string,
    options: PaginationOptions = {}
  ): Promise<MessageHistoryResponse> {
    const { limit = 50, before, after } = options;

    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);
    if (after) params.append('after', after);

    const response = await api.get<{
      data: {
        messages: MessageDTO[];
        hasMore: boolean;
        oldestMessageId?: string;
      };
    }>(`/messages/room/${roomId}?${params}`);

    const messages = response.data.messages.map(transformMessage);
    // The backend returns messages in chronological order (oldest first)
    // So messages[0] is the oldest message in this batch.
    // Its timestamp is the 'before' cursor for the next (older) batch.
    const cursor = messages.length > 0 ? messages[0].timestamp.toISOString() : undefined;

    return {
      messages,
      hasMore: response.data.hasMore,
      cursor,
    };
  }

  /**
   * Get a single message by ID
   */
  async getMessage(roomId: string, messageId: string): Promise<ChatMessage> {
    // Backend doesn't have /messages/{messageId} endpoint yet
    // For now, we fetch history and find the message
    const { messages } = await this.getHistory(roomId, { limit: 50 });
    const message = messages.find(m => m.id === messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    return message;
  }

  /**
   * Report a message
   */
  async reportMessage(
    roomId: string,
    messageId: string,
    reason: string,
    details?: string
  ): Promise<void> {
    await api.post('/reports', {
      targetType: 'MESSAGE',
      targetId: messageId,
      reason: reason.toUpperCase().replace('-', '_'),
      details,
    });
  }

  /**
   * Delete a message (sender or room creator only)
   */
  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}`);
  }

  /**
   * Generate a unique client message ID for optimistic updates
   */
  generateClientMessageId(): string {
    return generateUUID();
  }

  /**
   * Create an optimistic message for immediate UI display
   */
  createOptimisticMessage(
    content: string,
    userId: string,
    userName: string,
    userProfilePhoto?: string
  ): ChatMessage {
    return {
      id: `temp-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
      userId,
      userName,
      userProfilePhoto,
      status: 'sending',
      clientMessageId: this.generateClientMessageId(),
    };
  }
}

/**
 * Singleton message service instance
 */
export const messageService = new MessageService();

export default messageService;

