/**
 * useChatInput Hook
 *
 * Manages chat input state and typing indicator logic.
 * Separated from message handling for single responsibility.
 *
 * @example
 * ```typescript
 * const {
 *   inputText,
 *   setInputText,
 *   handleSubmit,
 *   typingUsers,
 * } = useChatInput(roomId, onSendMessage);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { wsService, WS_EVENTS } from '../../../services';
import { useUserId } from '../../user/store';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ChatInput');

// Typing indicator timeout (stop typing after 3s of inactivity)
const TYPING_TIMEOUT_MS = 3000;

// =============================================================================
// Types
// =============================================================================

export interface UseChatInputReturn {
  /** Current input text */
  inputText: string;
  /** Update input text (also sends typing indicator) */
  setInputText: (text: string) => void;
  /** Submit the current input */
  handleSubmit: () => void;
  /** Clear the input */
  clearInput: () => void;
  /** List of users currently typing */
  typingUsers: string[];
  /** Whether send is disabled (empty input) */
  canSend: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatInput(
  roomId: string,
  onSendMessage: (content: string) => void
): UseChatInputReturn {
  const userId = useUserId();

  const [inputText, setInputTextState] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // ==========================================================================
  // Typing Indicator - Sending
  // ==========================================================================

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (isTypingRef.current === isTyping) return;
      isTypingRef.current = isTyping;
      wsService.sendTyping(roomId, isTyping);
    },
    [roomId]
  );

  const setInputText = useCallback(
    (text: string) => {
      setInputTextState(text);

      if (text.length > 0) {
        // Start typing
        sendTypingIndicator(true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing
        typingTimeoutRef.current = setTimeout(() => {
          sendTypingIndicator(false);
        }, TYPING_TIMEOUT_MS);
      } else {
        // Stop typing when input is cleared
        sendTypingIndicator(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    },
    [sendTypingIndicator]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Ensure we stop typing when leaving
      if (isTypingRef.current) {
        wsService.sendTyping(roomId, false);
      }
    };
  }, [roomId]);

  // ==========================================================================
  // Typing Indicator - Receiving
  // ==========================================================================

  useEffect(() => {
    const unsubTyping = wsService.on(WS_EVENTS.USER_TYPING, (payload: any) => {
      if (payload.roomId !== roomId) return;
      if (payload.userId === userId) return;

      const displayName = payload.displayName;

      if (payload.isTyping) {
        setTypingUsers((prev) =>
          prev.includes(displayName) ? prev : [...prev, displayName]
        );
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== displayName));
      }
    });

    return () => {
      unsubTyping();
    };
  }, [roomId, userId]);

  // ==========================================================================
  // Submit Handler
  // ==========================================================================

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInputTextState('');

    // Stop typing indicator
    sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [inputText, onSendMessage, sendTypingIndicator]);

  const clearInput = useCallback(() => {
    setInputTextState('');
    sendTypingIndicator(false);
  }, [sendTypingIndicator]);

  const canSend = inputText.trim().length > 0;

  return {
    inputText,
    setInputText,
    handleSubmit,
    clearInput,
    typingUsers,
    canSend,
  };
}

export default useChatInput;
