/**
 * Room Types for LocalChat Mobile
 *
 * These types mirror the backend DTOs and provide type safety
 * throughout the application.
 */

/**
 * Room - UI model for chat rooms
 */
export interface Room {
  id: string;
  title: string;
  description?: string;
  category: RoomCategory;
  emoji: string;
  participantCount: number;
  maxParticipants: number;
  distance: number;
  distanceDisplay?: string;
  latitude?: number;
  longitude?: number;
  expiresAt: Date;
  createdAt: Date;
  timeRemaining: string;
  isNew?: boolean;
  isHighActivity?: boolean;
  isFull?: boolean;
  isExpiringSoon?: boolean;
  position?: { x: number; y: number };
  radius?: number;
  status?: RoomStatus;
  hasJoined?: boolean;
  isCreator?: boolean;
}

/**
 * Room Category - matches backend RoomCategory enum
 */
export type RoomCategory =
  | 'TRAFFIC'
  | 'EVENTS'
  | 'EMERGENCY'
  | 'LOST_FOUND'
  | 'SPORTS'
  | 'FOOD'
  | 'NEIGHBORHOOD'
  | 'GENERAL';

/**
 * Room Status - matches backend RoomStatus enum
 */
export type RoomStatus = 'active' | 'expiring' | 'expired' | 'closed';

/**
 * Room Duration - for UI display
 */
export type RoomDuration = 'short' | 'medium' | 'long' | 'extended';

/**
 * Backend Duration Format - what the API expects
 */
export type BackendDuration = '1h' | '3h' | '6h' | '24h' | 'until_inactive';

/**
 * Activity Level - from backend
 */
export type ActivityLevel = 'low' | 'medium' | 'high' | 'very_high';

/**
 * Identity Type - for room creation
 */
export type IdentityType = 'anonymous' | 'authenticated';

/**
 * Room Sort Options
 */
export type RoomSortBy = 'distance' | 'activity' | 'created' | 'expiring';

/**
 * Room Participant
 */
export interface RoomParticipant {
  userId: string;
  displayName: string;
  profilePhotoUrl?: string;
  joinedAt: Date;
  role: 'creator' | 'moderator' | 'participant';
}

/**
 * Create Room Request - matches backend CreateRoomCommand
 */
export interface CreateRoomRequest {
  title: string;
  description?: string;
  category: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  duration: BackendDuration;
  maxParticipants?: number;
}

