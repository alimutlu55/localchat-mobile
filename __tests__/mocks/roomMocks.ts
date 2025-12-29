/**
 * Room & WebSocket Test Mocks
 *
 * Centralized mocks for room-related services and WebSocket events.
 */

import { Room } from '../../src/types';

// =============================================================================
// Mock Room Data
// =============================================================================

export const mockRoom: Room = {
  id: 'room-123',
  title: 'Test Room',
  description: 'A test room for testing',
  latitude: 40.7128,
  longitude: -74.006,
  radius: 500,
  category: 'GENERAL',
  emoji: '💬',
  participantCount: 5,
  maxParticipants: 50,
  distance: 100,
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  createdAt: new Date(),
  timeRemaining: '1h',
  status: 'active',
  isNew: false,
  isCreator: false,
  hasJoined: false,
};

export const mockJoinedRoom: Room = {
  ...mockRoom,
  id: 'room-456',
  title: 'Joined Room',
  hasJoined: true,
};

export const mockCreatedRoom: Room = {
  ...mockRoom,
  id: 'room-789',
  title: 'My Created Room',
  isCreator: true,
  hasJoined: true,
};

/**
 * Create mock room with optional overrides
 */
export function createMockRoom(overrides: Partial<Room> = {}): Room {
  return {
    ...mockRoom,
    id: `room-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Create multiple mock rooms
 */
export function createMockRooms(count: number): Room[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRoom({
      id: `room-${i + 1}`,
      title: `Room ${i + 1}`,
      participantCount: i + 1,
    })
  );
}

// =============================================================================
// Room Service Mock
// =============================================================================

export const mockRoomService = {
  getRoom: jest.fn(),
  getRooms: jest.fn(),
  createRoom: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  closeRoom: jest.fn(),
  getMyRooms: jest.fn(),
  getNearbyRooms: jest.fn(),
  kickUser: jest.fn(),
  banUser: jest.fn(),
  unbanUser: jest.fn(),
  getBannedUsers: jest.fn(),
  updateRoom: jest.fn(),
};

/**
 * Reset room service mock to default successful behavior
 */
export function resetRoomServiceMock() {
  Object.values(mockRoomService).forEach((fn) => fn.mockReset());

  mockRoomService.getRoom.mockResolvedValue(mockRoom);
  mockRoomService.getRooms.mockResolvedValue([mockRoom]);
  mockRoomService.createRoom.mockResolvedValue(mockCreatedRoom);
  mockRoomService.joinRoom.mockResolvedValue({ success: true });
  mockRoomService.leaveRoom.mockResolvedValue({ success: true });
  mockRoomService.closeRoom.mockResolvedValue({ success: true });
  mockRoomService.getMyRooms.mockResolvedValue([mockJoinedRoom]);
  mockRoomService.getNearbyRooms.mockResolvedValue([mockRoom]);
  mockRoomService.kickUser.mockResolvedValue({ success: true });
  mockRoomService.banUser.mockResolvedValue({ success: true });
  mockRoomService.unbanUser.mockResolvedValue({ success: true });
  mockRoomService.getBannedUsers.mockResolvedValue([]);
  mockRoomService.updateRoom.mockResolvedValue(mockRoom);
}

// =============================================================================
// WebSocket Event Payloads
// =============================================================================

export const mockWsPayloads = {
  roomCreated: (room: Partial<Room> = {}) => ({
    roomId: room.id || 'room-new',
    room: {
      id: room.id || 'room-new',
      title: room.title || 'New Room',
      description: room.description || '',
      location: {
        latitude: room.latitude || 40.7128,
        longitude: room.longitude || -74.006,
      },
      radiusMeters: room.radius || 500,
      category: room.category || 'general',
      participantCount: room.participantCount || 1,
      expiresAt: room.expiresAt?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
      creatorId: 'creator-123',
    },
  }),

  roomUpdated: (roomId: string, updates: Partial<Room> = {}) => ({
    roomId,
    updates: {
      title: updates.title,
      description: updates.description,
      participantCount: updates.participantCount,
      status: updates.status,
    },
  }),

  roomClosed: (roomId: string, closedBy: string = 'user-123') => ({
    roomId,
    closedBy,
  }),

  roomExpiring: (roomId: string, minutesRemaining: number = 5) => ({
    roomId,
    expiresAt: new Date(Date.now() + minutesRemaining * 60000).toISOString(),
    minutesRemaining,
  }),

  userJoined: (roomId: string, userId: string, userName: string = 'Test User') => ({
    roomId,
    userId,
    userName,
    participantCount: 6,
  }),

  userLeft: (roomId: string, userId: string, userName?: string) => ({
    roomId,
    userId,
    userName,
    participantCount: 4,
  }),

  userKicked: (roomId: string, kickedUserId: string, kickedBy: string) => ({
    roomId,
    kickedUserId,
    kickedBy,
    userName: 'Kicked User',
  }),

  userBanned: (roomId: string, bannedUserId: string, bannedBy: string, reason?: string) => ({
    roomId,
    bannedUserId,
    bannedBy,
    reason,
    userName: 'Banned User',
  }),

  userUnbanned: (roomId: string, unbannedUserId: string, unbannedBy: string) => ({
    roomId,
    unbannedUserId,
    unbannedBy,
  }),

  participantCountUpdated: (roomId: string, participantCount: number) => ({
    roomId,
    participantCount,
  }),

  messageNew: (roomId: string, content: string, senderId: string = 'sender-123') => ({
    roomId,
    messageId: `msg-${Date.now()}`,
    content,
    sender: {
      id: senderId,
      displayName: 'Sender Name',
      profilePhotoUrl: undefined,
    },
    createdAt: new Date().toISOString(),
    clientMessageId: `client-${Date.now()}`,
  }),

  typingStart: (roomId: string, userId: string, displayName: string = 'Typing User') => ({
    roomId,
    userId,
    displayName,
  }),

  typingStop: (roomId: string, userId: string) => ({
    roomId,
    userId,
  }),

  connectionStateChanged: (state: 'connected' | 'disconnected' | 'reconnecting' | 'connecting') => ({
    state,
  }),
};

// =============================================================================
// EventBus Test Helper
// =============================================================================

/**
 * Create a test EventBus that tracks emissions and subscriptions
 */
export function createTestEventBus() {
  const handlers = new Map<string, Set<Function>>();
  const emittedEvents: Array<{ event: string; payload: any }> = [];

  return {
    on: jest.fn((event: string, handler: Function) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    }),

    off: jest.fn((event: string, handler: Function) => {
      handlers.get(event)?.delete(handler);
    }),

    emit: jest.fn((event: string, payload: any) => {
      emittedEvents.push({ event, payload });
      handlers.get(event)?.forEach((handler) => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`Handler error for ${event}:`, e);
        }
      });
    }),

    clear: jest.fn(() => {
      handlers.clear();
      emittedEvents.length = 0;
    }),

    getHandlerCount: (event: string) => handlers.get(event)?.size || 0,

    getEmittedEvents: () => [...emittedEvents],

    getEmittedEventsOfType: (event: string) =>
      emittedEvents.filter((e) => e.event === event),

    simulateEvent: (event: string, payload: any) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },

    _handlers: handlers,
    _emittedEvents: emittedEvents,
  };
}

// =============================================================================
// Reset All Mocks
// =============================================================================

export function resetAllRoomMocks() {
  resetRoomServiceMock();
}
