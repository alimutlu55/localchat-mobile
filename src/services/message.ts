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

/**
 * Message DTO from backend
 * Backend uses: { id, roomId, content, createdAt, sender: { id, displayName, profilePhotoUrl } }
 */
interface MessageDTO {
  id: string;
  roomId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
    profilePhotoUrl?: string;
  };
  clientMessageId?: string;
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
  return {
    id: dto.id,
    type: 'user',
    content: dto.content,
    timestamp: new Date(dto.createdAt),
    userId: dto.sender.id,
    userName: dto.sender.displayName,
    userProfilePhoto: dto.sender.profilePhotoUrl,
    status: 'delivered',
    clientMessageId: dto.clientMessageId,
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

    return {
      messages: response.data.messages.map(transformMessage),
      hasMore: response.data.hasMore,
      cursor: response.data.oldestMessageId,
    };
  }

  /**
   * Get a single message by ID
   */
  async getMessage(roomId: string, messageId: string): Promise<ChatMessage> {
    const response = await api.get<{ data: MessageDTO }>(`/rooms/${roomId}/messages/${messageId}`);
    return transformMessage(response.data);
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
    await api.delete(`/rooms/${roomId}/messages/${messageId}`);
  }

  /**
   * Generate a unique client message ID for optimistic updates
   */
  generateClientMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

