/**
 * Centralized Error Classification & Handling
 *
 * Provides consistent error type detection across the app.
 * All error checking should go through these utilities.
 *
 * @example
 * ```typescript
 * import { AppError, isUserBanned, isAuthError } from '@/shared/utils/errors';
 *
 * try {
 *   await roomService.joinRoom(roomId);
 * } catch (error) {
 *   if (isUserBanned(error)) {
 *     showBannedAlert();
 *   } else if (isAuthError(error)) {
 *     redirectToLogin();
 *   }
 * }
 * ```
 */

// =============================================================================
// Error Codes (matching backend error codes)
// =============================================================================

export const ErrorCode = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Room errors
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_CLOSED: 'ROOM_CLOSED',
  ROOM_FULL: 'ROOM_FULL',
  ALREADY_JOINED: 'ALREADY_JOINED',
  NOT_A_PARTICIPANT: 'NOT_A_PARTICIPANT',

  // User errors
  USER_BANNED: 'BANNED',
  USER_KICKED: 'KICKED',
  USER_BLOCKED: 'BLOCKED',
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  ALREADY_BLOCKED: 'ALREADY_BLOCKED',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',

  // Generic
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Extracts error details from various error shapes (ApiError, plain object, Error)
 */
function extractErrorDetails(error: unknown): {
  message: string;
  code: string;
  status: number;
} {
  if (!error) {
    return { message: '', code: '', status: 0 };
  }

  // Handle structured error objects
  if (typeof error === 'object') {
    const e = error as Record<string, any>;

    // Direct properties
    const message =
      (e.message as string) ||
      (e.data?.message as string) ||
      (e.error?.message as string) ||
      (e.response?.data?.message as string) ||
      '';

    const code =
      (e.code as string) ||
      (e.data?.code as string) ||
      (e.error?.code as string) ||
      '';

    const status =
      (e.status as number) ||
      (e.response?.status as number) ||
      0;

    return {
      message: message.toLowerCase(),
      code: code.toUpperCase(),
      status,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return { message: error.toLowerCase(), code: '', status: 0 };
  }

  return { message: '', code: '', status: 0 };
}

/**
 * Check if error indicates user is banned from a room
 */
export function isUserBanned(error: unknown): boolean {
  const { message, code } = extractErrorDetails(error);
  return (
    code === ErrorCode.USER_BANNED ||
    message.includes('banned') ||
    message.includes('ban')
  );
}

/**
 * Check if error indicates user was kicked from a room
 */
export function isUserKicked(error: unknown): boolean {
  const { message, code } = extractErrorDetails(error);
  return (
    code === ErrorCode.USER_KICKED ||
    message.includes('kicked') ||
    message.includes('removed')
  );
}

/**
 * Check if error indicates user is not a room participant
 */
export function isNotParticipant(error: unknown): boolean {
  const { message, code, status } = extractErrorDetails(error);
  return (
    status === 403 ||
    code === ErrorCode.FORBIDDEN ||
    code === ErrorCode.NOT_A_PARTICIPANT ||
    message.includes('must be in the room') ||
    message.includes('not a participant') ||
    message.includes('forbidden')
  );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const { code, status } = extractErrorDetails(error);
  return (
    status === 401 ||
    code === ErrorCode.UNAUTHORIZED ||
    code === ErrorCode.SESSION_EXPIRED ||
    code === ErrorCode.INVALID_TOKEN
  );
}

/**
 * Check if error indicates resource already exists (conflict)
 */
export function isConflictError(error: unknown): boolean {
  const { message, code, status } = extractErrorDetails(error);
  return (
    status === 409 ||
    code === ErrorCode.CONFLICT ||
    code === ErrorCode.ALREADY_JOINED ||
    code === ErrorCode.ALREADY_REPORTED ||
    code === ErrorCode.ALREADY_BLOCKED ||
    message.includes('already')
  );
}

/**
 * Check if error is a network/connectivity error
 */
export function isNetworkError(error: unknown): boolean {
  const { code, status } = extractErrorDetails(error);
  return (
    status === 0 ||
    code === ErrorCode.NETWORK_ERROR ||
    code === ErrorCode.TIMEOUT
  );
}

/**
 * Check if error indicates room is closed
 */
export function isRoomClosed(error: unknown): boolean {
  const { message, code } = extractErrorDetails(error);
  return (
    code === ErrorCode.ROOM_CLOSED ||
    message.includes('room is closed') ||
    message.includes('room closed')
  );
}

/**
 * Check if error indicates room is full
 */
export function isRoomFull(error: unknown): boolean {
  const { message, code } = extractErrorDetails(error);
  return (
    code === ErrorCode.ROOM_FULL ||
    message.includes('room is full') ||
    message.includes('max participants')
  );
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isUserBanned(error)) {
    return 'You are banned from this room.';
  }
  if (isUserKicked(error)) {
    return 'You have been removed from this room.';
  }
  if (isNotParticipant(error)) {
    return 'You are not a member of this room.';
  }
  if (isRoomClosed(error)) {
    return 'This room has been closed.';
  }
  if (isRoomFull(error)) {
    return 'This room is full.';
  }
  if (isNetworkError(error)) {
    return 'Unable to connect. Please check your internet connection.';
  }
  if (isAuthError(error)) {
    return 'Your session has expired. Please log in again.';
  }

  // Try to extract a meaningful message
  const { message } = extractErrorDetails(error);
  if (message && message.length > 0 && message.length < 200) {
    // Capitalize first letter
    return message.charAt(0).toUpperCase() + message.slice(1);
  }

  return fallback;
}

// =============================================================================
// Custom Error Class
// =============================================================================

/**
 * Application-specific error with code and metadata
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  /**
   * Create a banned user error
   */
  static banned(roomId?: string): AppError {
    return new AppError(ErrorCode.USER_BANNED, 'You are banned from this room.');
  }

  /**
   * Create a kicked user error
   */
  static kicked(roomId?: string): AppError {
    return new AppError(ErrorCode.USER_KICKED, 'You have been removed from this room.');
  }

  /**
   * Create from an unknown error
   */
  static from(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const { message, code } = extractErrorDetails(error);

    // Determine the appropriate error code
    if (isUserBanned(error)) return AppError.banned();
    if (isUserKicked(error)) return AppError.kicked();

    return new AppError(
      (code as ErrorCodeType) || ErrorCode.UNKNOWN,
      message || 'An unexpected error occurred',
      error
    );
  }
}
