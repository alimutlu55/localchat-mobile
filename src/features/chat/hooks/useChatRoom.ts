/**
 * useChatRoom - Facade Hook
 *
 * A convenience hook that combines all the hooks needed for a chat room screen.
 * This provides a single entry point for chat room functionality,
 * reducing imports and simplifying the screen component.
 *
 * Usage:
 * ```tsx
 * const chat = useChatRoom('room-123', {
 *   onAccessDenied: (reason) => handleAccessDenied(reason),
 * });
 * 
 * // Access messages
 * chat.messages.messages
 * chat.messages.sendMessage(text)
 * 
 * // Access input
 * chat.input.inputText
 * chat.input.setInputText(value)
 * chat.input.handleSubmit()
 * chat.input.canSend
 * ```
 */

import {
    useChatMessages,
    UseChatMessagesOptions,
    UseChatMessagesReturn,
} from './useChatMessages';
import { useChatInput, UseChatInputReturn } from './useChatInput';

// =============================================================================
// Types
// =============================================================================

export interface UseChatRoomReturn {
    /** Message-related state and actions */
    messages: UseChatMessagesReturn;

    /** Input-related state and actions */
    input: UseChatInputReturn;

    /** Convenience: true if messages are loading */
    isLoading: boolean;

    /** Convenience: true if connected to WebSocket */
    isConnected: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatRoom(
    roomId: string,
    options: UseChatMessagesOptions = {}
): UseChatRoomReturn {
    // Use underlying hooks
    const messages = useChatMessages(roomId, options);
    const input = useChatInput(roomId, messages.sendMessage);

    // Compute convenience properties
    const isLoading = messages.isLoading;
    const isConnected = messages.connectionState === 'connected';

    return {
        messages,
        input,
        isLoading,
        isConnected,
    };
}

export default useChatRoom;
