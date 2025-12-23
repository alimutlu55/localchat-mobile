/**
 * Room Service
 *
 * Handles all room-related operations including fetching rooms,
 * creating rooms, joining/leaving, and participant management.
 *
 * @example
 * ```typescript
 * // Get nearby rooms
 * const rooms = await roomService.getNearbyRooms(37.7749, -122.4194, 5000);
 *
 * // Create a room
 * const room = await roomService.createRoom({ title: 'My Room', ... });
 *
 * // Join a room
 * await roomService.joinRoom(roomId);
 * ```
 */

import { api } from './api';
import { Room, RoomParticipant, CreateRoomRequest, RoomCategory, RoomSortBy } from '../types';
import { randomizeForRoomCreation, randomizeForRoomJoin, randomizeForDiscovery } from '../utils/locationPrivacy';

/**
 * Room DTO from backend
 */
interface RoomDTO {
  id: string;
  title: string;
  description?: string;
  category: string;
  emoji: string;
  participantCount: number;
  maxParticipants: number;
  distanceMeters: number;
  distanceDisplay?: string;
  latitude: number;
  longitude: number;
  expiresAt: string;
  createdAt: string;
  radiusMeters?: number;
  status: string;
  activityLevel?: string;
  hasJoined?: boolean;
  isCreator?: boolean;
}

/**
 * Participant DTO from backend
 */
export interface ParticipantDTO {
  userId: string;
  displayName: string;
  profilePhotoUrl?: string;
  joinedAt: string;
  role: 'creator' | 'moderator' | 'participant';
}

/**
 * Banned User DTO
 */
export interface BannedUserDTO {
  userId: string;
  bannedAt: string;
  reason?: string;
}

/**
 * Transform backend DTO to frontend Room model
 */
function transformRoom(dto: RoomDTO): Room {
  const now = Date.now();
  const createdAt = new Date(dto.createdAt);

  // Handle null/undefined expiresAt (for 'until_inactive' rooms)
  let expiresAt: Date;
  let timeRemaining: string;
  let isExpiringSoon: boolean;

  if (dto.expiresAt) {
    expiresAt = new Date(dto.expiresAt);
    const timeUntilExpiry = expiresAt.getTime() - now;
    timeRemaining = formatTimeRemaining(timeUntilExpiry);
    isExpiringSoon = timeUntilExpiry > 0 && timeUntilExpiry < 30 * 60 * 1000;
  } else {
    // No expiry (until_inactive) - set far future date
    expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000); // 1 year from now
    timeRemaining = 'No expiry';
    isExpiringSoon = false;
  }

  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    category: dto.category as RoomCategory,
    emoji: dto.emoji,
    participantCount: dto.participantCount,
    maxParticipants: dto.maxParticipants,
    distance: dto.distanceMeters,
    distanceDisplay: dto.distanceDisplay,
    latitude: dto.latitude,
    longitude: dto.longitude,
    expiresAt,
    createdAt,
    timeRemaining,
    isNew: now - createdAt.getTime() < 30 * 60 * 1000,
    isHighActivity: dto.activityLevel === 'high' || dto.activityLevel === 'very_high',
    isFull: dto.participantCount >= dto.maxParticipants,
    isExpiringSoon,
    radius: dto.radiusMeters,
    status: dto.status as Room['status'],
    hasJoined: dto.hasJoined,
    isCreator: dto.isCreator,
  };
}

/**
 * Format time remaining for display
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Room Service class
 */
class RoomService {
  /**
   * Get nearby rooms via /rooms/discover endpoint
   * Backend returns: { data: { content: RoomDTO[], hasNext: boolean, ... } }
   */
  async getNearbyRooms(
    latitude: number,
    longitude: number,
    radius: number = 5000,
    sortBy: RoomSortBy = 'distance',
    category?: RoomCategory
  ): Promise<Room[]> {
    const randomized = randomizeForDiscovery(latitude, longitude);

    const params = new URLSearchParams({
      latitude: randomized.lat.toString(),
      longitude: randomized.lng.toString(),
      radiusMeters: radius.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    // Backend wraps response in ApiResponse { data: ... }
    const response = await api.get<{ data: { content: RoomDTO[] } }>(`/rooms/discover?${params}`);
    return response.data.content.map(transformRoom);
  }

  /**
   * Get a single room by ID
   * Backend returns: { data: RoomDetailDTO }
   */
  async getRoom(roomId: string): Promise<Room> {
    const response = await api.get<{ data: RoomDTO }>(`/rooms/${roomId}`);
    return transformRoom(response.data);
  }

  /**
   * Get rooms the user has joined or created via /rooms/me
   * Backend returns: { data: RoomDTO[] }
   */
  async getMyRooms(): Promise<Room[]> {
    const response = await api.get<{ data: RoomDTO[] }>('/rooms/me');
    return response.data.map(transformRoom);
  }

  /**
   * Get rooms created by the user
   * Backend returns: { data: RoomDTO[] }
   */
  async getCreatedRooms(): Promise<Room[]> {
    const response = await api.get<{ data: RoomDTO[] }>('/rooms/created');
    return response.data.map(transformRoom);
  }

  /**
   * Create a new room
   * Backend returns: { data: RoomDTO }
   */
  async createRoom(request: CreateRoomRequest): Promise<Room> {
    // Use at least 500m for privacy randomization, even if room radius is smaller
    const privacyBaseRadius = Math.max(request.radiusMeters, 500);
    const randomized = randomizeForRoomCreation(request.latitude, request.longitude, privacyBaseRadius);
    const safeRequest = {
      ...request,
      latitude: randomized.lat,
      longitude: randomized.lng,
    };
    const response = await api.post<{ data: RoomDTO }>('/rooms', safeRequest);
    return transformRoom(response.data);
  }

  /**
   * Join a room - requires user location
   * Backend returns: { data: RoomParticipantDTO }
   */
  async joinRoom(roomId: string, latitude: number, longitude: number, roomRadius: number = 500): Promise<void> {
    const randomized = randomizeForRoomJoin(latitude, longitude, roomRadius);
    await api.post(`/rooms/${roomId}/join`, {
      latitude: randomized.lat,
      longitude: randomized.lng
    });
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    await api.post(`/rooms/${roomId}/leave`, {});
  }

  /**
   * Close a room (creator only)
   */
  async closeRoom(roomId: string): Promise<void> {
    await api.post(`/rooms/${roomId}/close`, {});
  }

  /**
   * Extend room duration
   * Backend expects: { duration: '1h' | '3h' | etc }
   */
  async extendRoom(roomId: string, duration: string): Promise<Room> {
    const response = await api.post<{ data: RoomDTO }>(`/rooms/${roomId}/extend`, { duration });
    return transformRoom(response.data);
  }

  /**
   * Get room participants
   * Backend returns: { data: ParticipantDTO[] }
   */
  async getParticipants(roomId: string): Promise<ParticipantDTO[]> {
    const response = await api.get<{ data: ParticipantDTO[] }>(
      `/rooms/${roomId}/participants`
    );
    return response.data;
  }

  /**
   * Kick a user from the room (creator only)
   * Backend endpoint: POST /rooms/{roomId}/kick/{userId}
   */
  async kickUser(roomId: string, userId: string): Promise<void> {
    await api.post(`/rooms/${roomId}/kick/${userId}`, {});
  }

  /**
   * Ban a user from the room (creator only)
   * Backend endpoint: POST /rooms/{roomId}/ban/{userId}
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    await api.post(`/rooms/${roomId}/ban/${userId}`, { reason });
  }

  /**
   * Unban a user from the room (creator only)
   * Backend endpoint: DELETE /rooms/{roomId}/ban/{userId}
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/ban/${userId}`);
  }

  /**
   * Get banned users for a room
   * Backend endpoint: GET /rooms/{roomId}/bans
   * Backend returns: { data: BannedUserDTO[] }
   */
  async getBannedUsers(roomId: string): Promise<BannedUserDTO[]> {
    const response = await api.get<{ data: BannedUserDTO[] }>(
      `/rooms/${roomId}/bans`
    );
    return response.data;
  }

  /**
   * Report a room
   */
  async reportRoom(roomId: string, reason: string, details?: string): Promise<void> {
    await api.post('/reports', {
      targetType: 'ROOM',
      targetId: roomId,
      reason: reason.toUpperCase().replace('-', '_'),
      details,
    });
  }
}

/**
 * Singleton room service instance
 */
export const roomService = new RoomService();

export default roomService;

