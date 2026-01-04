/**
 * Type Exports
 */

// User types
export type {
  User,
  UserDTO,
  AuthState,
  LoginRequest,
  RegisterRequest,
  AnonymousLoginRequest,
  GoogleLoginRequest,
  AuthResponse,
  ProfileUpdateRequest,
} from './user';

// Room types
export type {
  Room,
  RoomCategory,
  RoomDuration,
  RoomSortBy,
  CreateRoomRequest,
  RoomParticipant,
  ClusterRequest,
  ClusterResponse,
  ClusterMetadata,
  ClusterFeature,
  ClusterProperties,
  SerializedRoom,
} from './room';

// Room serialization utilities
export { serializeRoom, deserializeRoom } from './room';

// Message types
export type {
  ChatMessage,
  MessageStatus,
  MessageReaction,
  SystemMessageType,
  ReportReason,
  MessageReport,
} from './message';

// WebSocket event payload types
export type {
  MessageNewPayload,
  MessageAckPayload,
  MessageReadPayload,
  MessageReactionPayload,
  UserTypingPayload,
  UserJoinedPayload,
  UserLeftPayload,
  UserKickedPayload,
  UserBannedPayload,
  ProfileUpdatedPayload,
  RoomClosedPayload,
  RoomUpdatedPayload,
} from './websocket';
