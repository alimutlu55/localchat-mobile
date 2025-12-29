/**
 * useChatInput Hook Tests
 *
 * Tests the chat input state management and typing indicators.
 * Validates:
 * - Input text management
 * - Typing indicator sending
 * - Typing indicator receiving
 * - Submit handling
 * - Cleanup on unmount
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useChatInput } from '../../../../../src/features/chat/hooks/useChatInput';
import { eventBus } from '../../../../../src/core/events';
import { wsService } from '../../../../../src/services';

// Mock dependencies
jest.mock('../../../../../src/services', () => ({
  wsService: {
    sendTyping: jest.fn(),
  },
}));

jest.mock('../../../../../src/features/user/store', () => ({
  useUserId: jest.fn(() => 'current-user-123'),
}));

jest.mock('../../../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useChatInput', () => {
  const roomId = 'room-123';
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    eventBus.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // Input Text Management
  // ===========================================================================

  describe('Input Text Management', () => {
    it('starts with empty input', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      expect(result.current.inputText).toBe('');
    });

    it('updates input text', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      expect(result.current.inputText).toBe('Hello');
    });

    it('clears input text', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
        result.current.clearInput();
      });

      expect(result.current.inputText).toBe('');
    });

    it('canSend is true when input has content', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      expect(result.current.canSend).toBe(false);

      act(() => {
        result.current.setInputText('Hello');
      });

      expect(result.current.canSend).toBe(true);
    });

    it('canSend is false for whitespace only', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('   ');
      });

      expect(result.current.canSend).toBe(false);
    });
  });

  // ===========================================================================
  // Typing Indicator - Sending
  // ===========================================================================

  describe('Typing Indicator Sending', () => {
    it('sends typing start when input changes', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('H');
      });

      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, true);
    });

    it('does not send duplicate typing starts', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('H');
        result.current.setInputText('He');
        result.current.setInputText('Hel');
      });

      // Should only call once with true
      expect(wsService.sendTyping).toHaveBeenCalledTimes(1);
      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, true);
    });

    it('sends typing stop when input is cleared', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      jest.clearAllMocks();

      act(() => {
        result.current.setInputText('');
      });

      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, false);
    });

    it('sends typing stop after timeout', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      jest.clearAllMocks();

      // Advance time past typing timeout (3 seconds)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, false);
    });

    it('resets timeout on continued typing', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('H');
      });

      // Advance 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Continue typing
      act(() => {
        result.current.setInputText('He');
      });

      // Advance another 2 seconds (total 4 from first input, but 2 from last)
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Should NOT have stopped yet (timeout was reset)
      expect(wsService.sendTyping).not.toHaveBeenCalledWith(roomId, false);

      // Advance final second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Now should have stopped
      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, false);
    });
  });

  // ===========================================================================
  // Typing Indicator - Receiving
  // ===========================================================================

  describe('Typing Indicator Receiving', () => {
    it('adds user to typing list on typing.start', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId,
          userId: 'other-user',
          displayName: 'Other User',
        });
      });

      expect(result.current.typingUsers).toContain('Other User');
    });

    it('ignores typing from current user', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId,
          userId: 'current-user-123',
          displayName: 'Current User',
        });
      });

      expect(result.current.typingUsers).not.toContain('Current User');
    });

    it('ignores typing from other rooms', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId: 'other-room',
          userId: 'other-user',
          displayName: 'Other User',
        });
      });

      expect(result.current.typingUsers).toHaveLength(0);
    });

    it('removes user from typing list on typing.stop', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId,
          userId: 'other-user',
          displayName: 'Other User',
        });
      });

      expect(result.current.typingUsers).toContain('Other User');

      act(() => {
        eventBus.emit('typing.stop', {
          roomId,
          userId: 'other-user',
          displayName: 'Other User',
        });
      });

      expect(result.current.typingUsers).not.toContain('Other User');
    });

    it('does not duplicate users in typing list', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId,
          userId: 'other-user',
          displayName: 'Other User',
        });
        eventBus.emit('typing.start', {
          roomId,
          userId: 'other-user',
          displayName: 'Other User',
        });
      });

      expect(result.current.typingUsers.filter((u) => u === 'Other User')).toHaveLength(1);
    });

    it('handles multiple typing users', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        eventBus.emit('typing.start', {
          roomId,
          userId: 'user-1',
          displayName: 'User One',
        });
        eventBus.emit('typing.start', {
          roomId,
          userId: 'user-2',
          displayName: 'User Two',
        });
      });

      expect(result.current.typingUsers).toHaveLength(2);
      expect(result.current.typingUsers).toContain('User One');
      expect(result.current.typingUsers).toContain('User Two');
    });
  });

  // ===========================================================================
  // Submit Handling
  // ===========================================================================

  describe('Submit Handling', () => {
    it('calls onSendMessage with trimmed text', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('  Hello World  ');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello World');
    });

    it('clears input after submit', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.inputText).toBe('');
    });

    it('does not submit empty input', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('does not submit whitespace only', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('   ');
        result.current.handleSubmit();
      });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('stops typing indicator on submit', () => {
      const { result } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      jest.clearAllMocks();

      act(() => {
        result.current.handleSubmit();
      });

      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, false);
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe('Cleanup', () => {
    it('stops typing on unmount if was typing', () => {
      const { result, unmount } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      jest.clearAllMocks();

      unmount();

      expect(wsService.sendTyping).toHaveBeenCalledWith(roomId, false);
    });

    it('clears timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      act(() => {
        result.current.setInputText('Hello');
      });

      unmount();

      // Advancing timers should not cause errors
      act(() => {
        jest.advanceTimersByTime(5000);
      });
    });

    it('unsubscribes from events on unmount', () => {
      const { unmount } = renderHook(() => useChatInput(roomId, mockOnSendMessage));

      expect(eventBus.getHandlerCount('typing.start')).toBeGreaterThan(0);
      expect(eventBus.getHandlerCount('typing.stop')).toBeGreaterThan(0);

      unmount();

      expect(eventBus.getHandlerCount('typing.start')).toBe(0);
      expect(eventBus.getHandlerCount('typing.stop')).toBe(0);
    });
  });
});
