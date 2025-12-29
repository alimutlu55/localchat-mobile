/**
 * Error Utilities Tests
 *
 * Tests the centralized error classification system.
 * Validates:
 * - Error type detection
 * - Error message formatting
 * - AppError class
 */

import {
  isUserBanned,
  isUserKicked,
  isNotParticipant,
  isAuthError,
  isConflictError,
  isNetworkError,
  isRoomClosed,
  isRoomFull,
  getErrorMessage,
  AppError,
  ErrorCode,
} from '../../../../src/shared/utils/errors';

describe('Error Utilities', () => {
  // ===========================================================================
  // isUserBanned
  // ===========================================================================

  describe('isUserBanned', () => {
    it('detects by code', () => {
      expect(isUserBanned({ code: 'BANNED' })).toBe(true);
    });

    it('detects by message containing "banned"', () => {
      expect(isUserBanned({ message: 'User is banned from this room' })).toBe(true);
    });

    it('detects by message containing "ban"', () => {
      expect(isUserBanned({ message: 'You have been ban from the room' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isUserBanned({ message: 'Network error' })).toBe(false);
      expect(isUserBanned({ code: 'NOT_FOUND' })).toBe(false);
    });

    it('handles null/undefined', () => {
      expect(isUserBanned(null)).toBe(false);
      expect(isUserBanned(undefined)).toBe(false);
    });

    it('handles string errors', () => {
      expect(isUserBanned('You are banned')).toBe(true);
      expect(isUserBanned('Some other error')).toBe(false);
    });
  });

  // ===========================================================================
  // isUserKicked
  // ===========================================================================

  describe('isUserKicked', () => {
    it('detects by code', () => {
      expect(isUserKicked({ code: 'KICKED' })).toBe(true);
    });

    it('detects by message containing "kicked"', () => {
      expect(isUserKicked({ message: 'You have been kicked from the room' })).toBe(true);
    });

    it('detects by message containing "removed"', () => {
      expect(isUserKicked({ message: 'You were removed from the room' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isUserKicked({ message: 'Network error' })).toBe(false);
    });
  });

  // ===========================================================================
  // isNotParticipant
  // ===========================================================================

  describe('isNotParticipant', () => {
    it('detects by 403 status', () => {
      expect(isNotParticipant({ status: 403 })).toBe(true);
    });

    it('detects by FORBIDDEN code', () => {
      expect(isNotParticipant({ code: 'FORBIDDEN' })).toBe(true);
    });

    it('detects by NOT_A_PARTICIPANT code', () => {
      expect(isNotParticipant({ code: 'NOT_A_PARTICIPANT' })).toBe(true);
    });

    it('detects by message', () => {
      expect(isNotParticipant({ message: 'Must be in the room to do this' })).toBe(true);
      expect(isNotParticipant({ message: 'You are not a participant' })).toBe(true);
      expect(isNotParticipant({ message: 'Access forbidden' })).toBe(true);
    });
  });

  // ===========================================================================
  // isAuthError
  // ===========================================================================

  describe('isAuthError', () => {
    it('detects by 401 status', () => {
      expect(isAuthError({ status: 401 })).toBe(true);
    });

    it('detects by UNAUTHORIZED code', () => {
      expect(isAuthError({ code: 'UNAUTHORIZED' })).toBe(true);
    });

    it('detects by SESSION_EXPIRED code', () => {
      expect(isAuthError({ code: 'SESSION_EXPIRED' })).toBe(true);
    });

    it('detects by INVALID_TOKEN code', () => {
      expect(isAuthError({ code: 'INVALID_TOKEN' })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isAuthError({ status: 500 })).toBe(false);
      expect(isAuthError({ code: 'NOT_FOUND' })).toBe(false);
    });
  });

  // ===========================================================================
  // isConflictError
  // ===========================================================================

  describe('isConflictError', () => {
    it('detects by 409 status', () => {
      expect(isConflictError({ status: 409 })).toBe(true);
    });

    it('detects by CONFLICT code', () => {
      expect(isConflictError({ code: 'CONFLICT' })).toBe(true);
    });

    it('detects ALREADY_JOINED', () => {
      expect(isConflictError({ code: 'ALREADY_JOINED' })).toBe(true);
    });

    it('detects ALREADY_REPORTED', () => {
      expect(isConflictError({ code: 'ALREADY_REPORTED' })).toBe(true);
    });

    it('detects ALREADY_BLOCKED', () => {
      expect(isConflictError({ code: 'ALREADY_BLOCKED' })).toBe(true);
    });

    it('detects by message containing "already"', () => {
      expect(isConflictError({ message: 'User already in room' })).toBe(true);
    });
  });

  // ===========================================================================
  // isNetworkError
  // ===========================================================================

  describe('isNetworkError', () => {
    it('detects by status 0', () => {
      expect(isNetworkError({ status: 0 })).toBe(true);
    });

    it('detects by NETWORK_ERROR code', () => {
      expect(isNetworkError({ code: 'NETWORK_ERROR' })).toBe(true);
    });

    it('detects by TIMEOUT code', () => {
      expect(isNetworkError({ code: 'TIMEOUT' })).toBe(true);
    });

    it('returns false for server errors', () => {
      expect(isNetworkError({ status: 500 })).toBe(false);
    });
  });

  // ===========================================================================
  // isRoomClosed
  // ===========================================================================

  describe('isRoomClosed', () => {
    it('detects by ROOM_CLOSED code', () => {
      expect(isRoomClosed({ code: 'ROOM_CLOSED' })).toBe(true);
    });

    it('detects by message', () => {
      expect(isRoomClosed({ message: 'Room is closed' })).toBe(true);
      expect(isRoomClosed({ message: 'This room closed' })).toBe(true);
    });
  });

  // ===========================================================================
  // isRoomFull
  // ===========================================================================

  describe('isRoomFull', () => {
    it('detects by ROOM_FULL code', () => {
      expect(isRoomFull({ code: 'ROOM_FULL' })).toBe(true);
    });

    it('detects by message', () => {
      expect(isRoomFull({ message: 'Room is full' })).toBe(true);
      expect(isRoomFull({ message: 'Max participants reached' })).toBe(true);
    });
  });

  // ===========================================================================
  // getErrorMessage
  // ===========================================================================

  describe('getErrorMessage', () => {
    it('returns banned message for banned error', () => {
      expect(getErrorMessage({ code: 'BANNED' })).toBe('You are banned from this room.');
    });

    it('returns kicked message for kicked error', () => {
      expect(getErrorMessage({ code: 'KICKED' })).toBe('You have been removed from this room.');
    });

    it('returns not participant message for forbidden', () => {
      expect(getErrorMessage({ status: 403 })).toBe('You are not a member of this room.');
    });

    it('returns room closed message', () => {
      expect(getErrorMessage({ code: 'ROOM_CLOSED' })).toBe('This room has been closed.');
    });

    it('returns room full message', () => {
      expect(getErrorMessage({ code: 'ROOM_FULL' })).toBe('This room is full.');
    });

    it('returns network message for network error', () => {
      expect(getErrorMessage({ code: 'NETWORK_ERROR' })).toBe(
        'Unable to connect. Please check your internet connection.'
      );
    });

    it('returns auth message for auth error', () => {
      expect(getErrorMessage({ status: 401 })).toBe(
        'Your session has expired. Please log in again.'
      );
    });

    it('capitalizes extracted message', () => {
      // Need status > 0 to avoid being detected as network error (status 0)
      expect(getErrorMessage({ message: 'custom error message', status: 200 })).toBe('Custom error message');
    });

    it('returns network error for empty objects (status defaults to 0)', () => {
      // Empty objects have status 0 which is considered a network error
      expect(getErrorMessage({})).toBe('Unable to connect. Please check your internet connection.');
    });

    it('returns fallback for valid status with no message', () => {
      // With valid status but no message, should use fallback
      expect(getErrorMessage({ status: 200 })).toBe('Something went wrong');
      expect(getErrorMessage({ status: 200 }, 'Custom fallback')).toBe('Custom fallback');
    });

    it('returns fallback for very long messages', () => {
      const longMessage = 'a'.repeat(300);
      // With status > 0 to avoid network error detection
      expect(getErrorMessage({ message: longMessage, status: 200 })).toBe('Something went wrong');
    });
  });

  // ===========================================================================
  // AppError Class
  // ===========================================================================

  describe('AppError', () => {
    describe('constructor', () => {
      it('creates error with code and message', () => {
        const error = new AppError(ErrorCode.USER_BANNED, 'Test message');

        expect(error.code).toBe(ErrorCode.USER_BANNED);
        expect(error.message).toBe('Test message');
        expect(error.name).toBe('AppError');
        expect(error).toBeInstanceOf(Error);
      });

      it('stores original error', () => {
        const original = new Error('Original');
        const error = new AppError(ErrorCode.UNKNOWN, 'Wrapped', original);

        expect(error.originalError).toBe(original);
      });
    });

    describe('static banned', () => {
      it('creates banned error', () => {
        const error = AppError.banned('room-123');

        expect(error.code).toBe(ErrorCode.USER_BANNED);
        expect(error.message).toBe('You are banned from this room.');
      });
    });

    describe('static kicked', () => {
      it('creates kicked error', () => {
        const error = AppError.kicked('room-123');

        expect(error.code).toBe(ErrorCode.USER_KICKED);
        expect(error.message).toBe('You have been removed from this room.');
      });
    });

    describe('static from', () => {
      it('returns same AppError if already AppError', () => {
        const original = new AppError(ErrorCode.USER_BANNED, 'Test');
        const result = AppError.from(original);

        expect(result).toBe(original);
      });

      it('creates banned error from banned error object', () => {
        const result = AppError.from({ code: 'BANNED' });

        expect(result.code).toBe(ErrorCode.USER_BANNED);
      });

      it('creates kicked error from kicked error object', () => {
        const result = AppError.from({ message: 'User was kicked' });

        expect(result.code).toBe(ErrorCode.USER_KICKED);
      });

      it('creates UNKNOWN error for unrecognized errors', () => {
        const result = AppError.from({ message: 'Something happened' });

        expect(result.code).toBe(ErrorCode.UNKNOWN);
        expect(result.message).toBe('something happened');
      });

      it('uses error code when available', () => {
        const result = AppError.from({ code: 'ROOM_FULL', message: 'Room is full' });

        expect(result.code).toBe('ROOM_FULL');
      });

      it('handles null/undefined', () => {
        const result = AppError.from(null);

        expect(result.code).toBe(ErrorCode.UNKNOWN);
        expect(result.message).toBe('An unexpected error occurred');
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('handles deeply nested error structures', () => {
      const nestedError = {
        response: {
          data: {
            message: 'User is banned',
          },
        },
      };

      expect(isUserBanned(nestedError)).toBe(true);
    });

    it('handles error.data.code structure', () => {
      const error = {
        data: {
          code: 'BANNED',
        },
      };

      expect(isUserBanned(error)).toBe(true);
    });

    it('handles error.error.message structure', () => {
      const error = {
        error: {
          message: 'User was kicked from the room',
        },
      };

      expect(isUserKicked(error)).toBe(true);
    });

    it('case insensitive code matching', () => {
      expect(isUserBanned({ code: 'banned' })).toBe(true);
      expect(isAuthError({ code: 'unauthorized' })).toBe(true);
    });

    it('case insensitive message matching', () => {
      expect(isUserBanned({ message: 'USER IS BANNED' })).toBe(true);
      expect(isRoomClosed({ message: 'ROOM IS CLOSED' })).toBe(true);
    });
  });
});
