/**
 * Services Index
 *
 * Central export for all application services.
 */

export { api, ApiError } from './api';
export { storage, secureStorage } from './storage';
export { wsService } from './websocket';
export { authService } from './auth';
export { roomService } from './room';
export { messageService } from './message';
export { blockService } from './block';
export { settingsService } from './settings';
export { onboardingService } from './onboarding';

// Re-export constants
export { STORAGE_KEYS, WS_EVENTS } from '../constants';

// Re-export types
export type {
  ConnectionState,
  NewMessagePayload,
  MessageAckPayload,
  TypingPayload,
  UserJoinedPayload,
  UserLeftPayload,
  UserKickedPayload,
  UserBannedPayload,
  RoomClosedPayload,
  SubscribedPayload,
  ErrorPayload,
} from './websocket';

export type { ParticipantDTO, BannedUserDTO } from './room';
export type { BlockedUser } from './block';
export type { UserSettings, LocalSettings, ViewMode, LocationMode } from './settings';
export type { OnboardingStatus } from './onboarding';
