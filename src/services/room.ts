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
import { Room, RoomParticipant, CreateRoomRequest, RoomCategory, RoomSortBy, ClusterResponse } from '../types';
import { randomizeForRoomCreation } from '../utils/locationPrivacy';
import { createLogger } from '../shared/utils/logger';
import { formatTimeRemainingMs, isExpiringSoon as checkIsExpiringSoon } from '../utils/format';

const log = createLogger('RoomService');

/**
 * Room DTO from backend
 * Matches backend RoomSummaryDTO structure
 */
interface RoomDTO {
  id: string;
  title: string;
  description?: string;
  category: string;
  categoryIcon: string; // Backend sends categoryIcon (persistent emoji from room.category.icon)
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
  displayName?: string;
  profilePhotoUrl?: string;
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
    timeRemaining = formatTimeRemainingMs(timeUntilExpiry);
    isExpiringSoon = checkIsExpiringSoon(expiresAt);
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
    emoji: dto.categoryIcon, // Map backend's categoryIcon to frontend's emoji field
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

class RoomService {
  /**
   * Get nearby rooms via /rooms/discover endpoint with pagination support
   * Backend returns: { data: { content: RoomDTO[], page, pageSize, hasNext, ... } }
   * 
   * @param latitude User's latitude
   * @param longitude User's longitude
   * @param page Page number (0-indexed), default 0
   * @param pageSize Number of rooms per page, default 20
   * @param radius Optional search radius (for display purposes)
   * @param category Optional category filter
   * @returns Paginated room results with hasNext indicator
   */
  async getNearbyRooms(
    latitude: number,
    longitude: number,
    page: number = 0,
    pageSize: number = 20,
    radius?: number,
    category?: RoomCategory
  ): Promise<{ rooms: Room[]; hasNext: boolean; totalElements: number }> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (radius) {
      params.append('radiusMeters', radius.toString());
    }

    if (category) {
      params.append('category', category);
    }


    // Backend wraps response in ApiResponse { data: PagedResult<RoomDTO> }
    const response = await api.get<{
      data: {
        content: RoomDTO[];
        page: number;
        pageSize: number;
        totalElements: number;
        hasNext: boolean;
      }
    }>(`/rooms/discover?${params}`);


    return {
      rooms: response.data.content.map(transformRoom),
      hasNext: response.data.hasNext,
      totalElements: response.data.totalElements,
    };
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
    // Use a fixed privacy radius (200m) for room creation
    // The visibility radius (radiusMeters) controls who can SEE the room, not where it's placed
    // These are separate concerns: privacy offset should not scale with visibility range
    const FIXED_PRIVACY_RADIUS = 200;
    const randomized = randomizeForRoomCreation(request.latitude, request.longitude, FIXED_PRIVACY_RADIUS);
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
    log.info('joinRoom start', { roomId, latitude, longitude, roomRadius });
    await api.post(`/rooms/${roomId}/join`, {
      latitude,
      longitude
    });
    log.info('joinRoom finished', { roomId });
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
    log.info('closeRoom start', { roomId });
    await api.post(`/rooms/${roomId}/close`, {});
    log.info('closeRoom finished', { roomId });
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

  /**
   * Get clustered rooms within a bounding box (server-side clustering).
   * Use this for low zoom levels to reduce client-side computation.
   * 
   * @param minLng Western boundary longitude
   * @param minLat Southern boundary latitude
   * @param maxLng Eastern boundary longitude
   * @param maxLat Northern boundary latitude
   * @param zoom Current map zoom level (1-20)
   * @param category Optional category filter
   * @param userLat User's latitude for visibility filtering
   * @param userLng User's longitude for visibility filtering
   * @returns ClusterResponse with GeoJSON features and metadata
   */
  async getClusters(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    zoom: number,
    category?: string,
    userLat?: number,
    userLng?: number
  ): Promise<ClusterResponse> {
    const params = new URLSearchParams({
      minLng: minLng.toString(),
      minLat: minLat.toString(),
      maxLng: maxLng.toString(),
      maxLat: maxLat.toString(),
      zoom: zoom.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    // Pass user location for visibility filtering
    // Nearby rooms are only visible if user is within the room's radius
    if (userLat !== undefined && userLng !== undefined) {
      params.append('userLat', userLat.toString());
      params.append('userLng', userLng.toString());
    }

    // Server returns ClusterResponse. We support both direct GeoJSON and ApiResponse-wrapped
    console.log(`[RoomService] getClusters: zoom=${zoom}, bounds=[${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
    const response = await api.get<any>(`/rooms/clusters?${params}`);

    // Handle both { data: ClusterResponse } and direct ClusterResponse
    const clusterData: ClusterResponse = response.data || response;

    console.log(`[RoomService] getClusters: response received, featureCount=${clusterData.features?.length ?? 0}`);
    return clusterData;
  }

  /**
   * Search rooms by query text
   * Backend searches across ALL rooms in database (not just nearby)
   * 
   * @param query Search text (title, description, category)
   * @param latitude Optional user latitude for distance calculation
   * @param longitude Optional user longitude for distance calculation
   * @param radiusMeters Optional search radius in meters
   * @param limit Maximum number of results (default: 50)
   * @returns Array of rooms matching search query
   */
  async searchRooms(
    query: string,
    latitude?: number,
    longitude?: number,
    radiusMeters?: number,
    limit: number = 50
  ): Promise<Room[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const params = new URLSearchParams({
      query: query.trim(),
      limit: limit.toString(),
    });

    if (latitude !== undefined && longitude !== undefined) {
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());
    }

    if (radiusMeters !== undefined) {
      params.append('radiusMeters', radiusMeters.toString());
    }

    const response = await api.get<{ data: RoomDTO[] }>(`/rooms/search?${params}`);
    return response.data.map(transformRoom);
  }
}

/**
 * Singleton room service instance
 */
export const roomService = new RoomService();

export default roomService;

