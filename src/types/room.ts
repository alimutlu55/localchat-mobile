/**
 * Room Types for BubbleUp Mobile
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
  | 'TRAFFIC_TRANSIT'
  | 'EVENTS_FESTIVALS'
  | 'SAFETY_HAZARDS'
  | 'LOST_FOUND'
  | 'SPORTS_FITNESS'
  | 'FOOD_DINING'
  | 'SOCIAL_MEETUPS'
  | 'ATMOSPHERE_MUSIC'
  | 'SIGHTSEEING_GEMS'
  | 'NEWS_INTEL'
  | 'RETAIL_WAIT'
  | 'DEALS_POPUPS'
  | 'MARKETS_FINDS'
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
  shouldRandomize?: boolean; // If true, apply 500m privacy offset
}

// =============================================================================
// Server-Side Clustering Types
// =============================================================================

/**
 * Request for server-side room clustering
 */
export interface ClusterRequest {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
  category?: string;
}

/**
 * Server cluster response - GeoJSON FeatureCollection
 */
export interface ClusterResponse {
  type: 'FeatureCollection';
  features: ClusterFeature[];
  metadata: ClusterMetadata;
}

/**
 * Metadata about clustering response
 */
export interface ClusterMetadata {
  totalRooms: number;
  clusterCount: number;
  individualCount: number;
  zoom: number;
  processingTimeMs: number;
  clustered: boolean;
}

/**
 * GeoJSON Feature - either a cluster or individual room
 */
export interface ClusterFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: ClusterProperties;
}

/**
 * Properties for cluster or room feature
 */
export interface ClusterProperties {
  cluster: boolean;
  // Cluster-specific properties
  clusterId?: number;
  pointCount?: number;
  pointCountAbbreviated?: string;
  // Bounding box of all points in this cluster [minLng, minLat, maxLng, maxLat]
  // Used to zoom to fit all children when cluster is clicked
  expansionBounds?: [number, number, number, number];
  // Room-specific properties (when cluster = false)
  roomId?: string;
  title?: string;
  category?: string;
  categoryIcon?: string;
  participantCount?: number;
  status?: string;
  expiresAt?: string;
  // Room state properties
  isNew?: boolean;
  isHighActivity?: boolean;
  isExpiringSoon?: boolean;
  hasJoined?: boolean;
  isCreator?: boolean;
  timeRemaining?: string;
}

// =============================================================================
// Navigation Serialization Types
// =============================================================================

/**
 * SerializedRoom - Room with Date fields as ISO strings
 * Use this type for navigation params to avoid React Navigation warnings.
 */
export interface SerializedRoom extends Omit<Room, 'expiresAt' | 'createdAt'> {
  expiresAt: string;
  createdAt: string;
}

/**
 * Serialize a Room for navigation params
 * Converts Date objects to ISO strings
 */
export function serializeRoom(room: Room): SerializedRoom {
  return {
    ...room,
    expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
  };
}

/**
 * Deserialize a SerializedRoom back to Room
 * Converts ISO strings back to Date objects
 */
export function deserializeRoom(serialized: SerializedRoom | Room): Room {
  return {
    ...serialized,
    expiresAt: typeof serialized.expiresAt === 'string' ? new Date(serialized.expiresAt) : serialized.expiresAt,
    createdAt: typeof serialized.createdAt === 'string' ? new Date(serialized.createdAt) : serialized.createdAt,
  } as Room;
}

