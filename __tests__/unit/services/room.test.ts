/**
 * Room Service Unit Tests
 *
 * Tests the room service in isolation.
 * Validates:
 * - Room CRUD operations
 * - Participant management
 * - Location privacy
 * - Error handling
 */

import { roomService } from '../../../src/services/room';
import { api } from '../../../src/services/api';

// Mock dependencies
jest.mock('../../../src/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../../src/utils/locationPrivacy', () => ({
  randomizeForRoomCreation: jest.fn((lat, lng) => ({ lat, lng })),
  randomizeForRoomJoin: jest.fn((lat, lng) => ({ lat, lng })),
  randomizeForDiscovery: jest.fn((lat, lng) => ({ lat, lng })),
}));

describe('RoomService', () => {
  const mockRoomDTO = {
    id: 'room-123',
    title: 'Test Room',
    description: 'A test room',
    category: 'social',
    categoryIcon: '👋',
    participantCount: 5,
    maxParticipants: 20,
    distanceMeters: 150,
    distanceDisplay: '150m away',
    latitude: 37.7749,
    longitude: -122.4194,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    radiusMeters: 500,
    status: 'active',
    activityLevel: 'high',
    hasJoined: false,
    isCreator: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // getNearbyRooms Tests
  // ===========================================================================

  describe('getNearbyRooms', () => {
    it('calls API with location and pagination params', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          content: [mockRoomDTO],
          page: 0,
          pageSize: 20,
          totalElements: 1,
          hasNext: false,
        },
      });

      await roomService.getNearbyRooms(37.7749, -122.4194);

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/discover')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('latitude=37.7749')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('longitude=-122.4194')
      );
    });

    it('supports pagination parameters', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          content: [],
          page: 2,
          pageSize: 10,
          totalElements: 100,
          hasNext: true,
        },
      });

      await roomService.getNearbyRooms(37.7749, -122.4194, 2, 10);

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=10')
      );
    });

    it('supports radius filter', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { content: [], hasNext: false, totalElements: 0 },
      });

      await roomService.getNearbyRooms(37.7749, -122.4194, 0, 20, 5000);

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('radiusMeters=5000')
      );
    });

    it('supports category filter', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { content: [], hasNext: false, totalElements: 0 },
      });

      await roomService.getNearbyRooms(37.7749, -122.4194, 0, 20, undefined, 'social');

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('category=social')
      );
    });

    it('transforms DTO to Room model', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          content: [mockRoomDTO],
          hasNext: false,
          totalElements: 1,
        },
      });

      const result = await roomService.getNearbyRooms(37.7749, -122.4194);

      expect(result.rooms[0]).toEqual(
        expect.objectContaining({
          id: 'room-123',
          title: 'Test Room',
          emoji: '👋',
          participantCount: 5,
          distance: 150,
          isHighActivity: true,
        })
      );
    });

    it('returns pagination metadata', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          content: [mockRoomDTO],
          hasNext: true,
          totalElements: 50,
        },
      });

      const result = await roomService.getNearbyRooms(37.7749, -122.4194);

      expect(result.hasNext).toBe(true);
      expect(result.totalElements).toBe(50);
    });
  });

  // ===========================================================================
  // getRoom Tests
  // ===========================================================================

  describe('getRoom', () => {
    it('fetches single room by ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockRoomDTO });

      const room = await roomService.getRoom('room-123');

      expect(api.get).toHaveBeenCalledWith('/rooms/room-123');
      expect(room.id).toBe('room-123');
    });
  });

  // ===========================================================================
  // getMyRooms Tests
  // ===========================================================================

  describe('getMyRooms', () => {
    it('fetches user joined/created rooms', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [mockRoomDTO] });

      const rooms = await roomService.getMyRooms();

      expect(api.get).toHaveBeenCalledWith('/rooms/me');
      expect(rooms).toHaveLength(1);
    });
  });

  // ===========================================================================
  // createRoom Tests
  // ===========================================================================

  describe('createRoom', () => {
    it('creates room with required fields', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockRoomDTO });

      const request = {
        title: 'New Room',
        category: 'social' as const,
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 500,
        expirationHours: 2,
      };

      const room = await roomService.createRoom(request);

      expect(api.post).toHaveBeenCalledWith(
        '/rooms',
        expect.objectContaining({
          title: 'New Room',
          category: 'social',
        })
      );
      expect(room.id).toBe('room-123');
    });

    it('applies location privacy randomization', async () => {
      const { randomizeForRoomCreation } = require('../../../src/utils/locationPrivacy');
      (api.post as jest.Mock).mockResolvedValue({ data: mockRoomDTO });

      await roomService.createRoom({
        title: 'Test',
        category: 'social' as const,
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 500,
        expirationHours: 1,
      });

      expect(randomizeForRoomCreation).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // joinRoom Tests
  // ===========================================================================

  describe('joinRoom', () => {
    it('sends join request with location', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.joinRoom('room-123', 37.7749, -122.4194, 500);

      expect(api.post).toHaveBeenCalledWith(
        '/rooms/room-123/join',
        expect.objectContaining({
          latitude: expect.any(Number),
          longitude: expect.any(Number),
        })
      );
    });
  });

  // ===========================================================================
  // leaveRoom Tests
  // ===========================================================================

  describe('leaveRoom', () => {
    it('sends leave request', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.leaveRoom('room-123');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/leave', {});
    });
  });

  // ===========================================================================
  // closeRoom Tests
  // ===========================================================================

  describe('closeRoom', () => {
    it('sends close request', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.closeRoom('room-123');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/close', {});
    });
  });

  // ===========================================================================
  // extendRoom Tests
  // ===========================================================================

  describe('extendRoom', () => {
    it('extends room duration', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockRoomDTO });

      await roomService.extendRoom('room-123', '1h');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/extend', { duration: '1h' });
    });
  });

  // ===========================================================================
  // Participant Management Tests
  // ===========================================================================

  describe('getParticipants', () => {
    it('fetches room participants', async () => {
      const participants = [
        { userId: 'user-1', displayName: 'User 1', role: 'creator' },
        { userId: 'user-2', displayName: 'User 2', role: 'participant' },
      ];
      (api.get as jest.Mock).mockResolvedValue({ data: participants });

      const result = await roomService.getParticipants('room-123');

      expect(api.get).toHaveBeenCalledWith('/rooms/room-123/participants');
      expect(result).toHaveLength(2);
    });
  });

  describe('kickUser', () => {
    it('kicks user from room', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.kickUser('room-123', 'user-bad');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/kick/user-bad', {});
    });
  });

  describe('banUser', () => {
    it('bans user from room', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.banUser('room-123', 'user-bad', 'Spam');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/ban/user-bad', { reason: 'Spam' });
    });

    it('bans user without reason', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.banUser('room-123', 'user-bad');

      expect(api.post).toHaveBeenCalledWith('/rooms/room-123/ban/user-bad', { reason: undefined });
    });
  });

  describe('unbanUser', () => {
    it('unbans user from room', async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await roomService.unbanUser('room-123', 'user-unbanned');

      expect(api.delete).toHaveBeenCalledWith('/rooms/room-123/ban/user-unbanned');
    });
  });

  describe('getBannedUsers', () => {
    it('fetches banned users list', async () => {
      const banned = [{ userId: 'user-1', bannedAt: '2024-01-01', reason: 'Spam' }];
      (api.get as jest.Mock).mockResolvedValue({ data: banned });

      const result = await roomService.getBannedUsers('room-123');

      expect(api.get).toHaveBeenCalledWith('/rooms/room-123/bans');
      expect(result).toHaveLength(1);
    });
  });

  // ===========================================================================
  // reportRoom Tests
  // ===========================================================================

  describe('reportRoom', () => {
    it('reports room with reason', async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await roomService.reportRoom('room-123', 'spam', 'Selling stuff');

      expect(api.post).toHaveBeenCalledWith('/reports', {
        targetType: 'ROOM',
        targetId: 'room-123',
        reason: 'SPAM',
        details: 'Selling stuff',
      });
    });
  });

  // ===========================================================================
  // getClusters Tests
  // ===========================================================================

  describe('getClusters', () => {
    it('fetches clustered rooms for map', async () => {
      const clusterResponse = {
        type: 'FeatureCollection',
        features: [],
        metadata: { totalRooms: 0, totalClusters: 0 },
      };
      (api.get as jest.Mock).mockResolvedValue(clusterResponse);

      const result = await roomService.getClusters(-123, 36, -121, 38, 10);

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/clusters')
      );
      expect(result.type).toBe('FeatureCollection');
    });

    it('supports category filter for clusters', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        type: 'FeatureCollection',
        features: [],
      });

      await roomService.getClusters(-123, 36, -121, 38, 10, 'events');

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('category=events')
      );
    });
  });

  // ===========================================================================
  // Room Transformation Tests
  // ===========================================================================

  describe('Room Transformation', () => {
    it('calculates isNew for recent rooms', async () => {
      const recentRoom = {
        ...mockRoomDTO,
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
      };
      (api.get as jest.Mock).mockResolvedValue({ data: recentRoom });

      const room = await roomService.getRoom('room-123');

      expect(room.isNew).toBe(true);
    });

    it('calculates isNew=false for older rooms', async () => {
      const oldRoom = {
        ...mockRoomDTO,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 60 mins ago
      };
      (api.get as jest.Mock).mockResolvedValue({ data: oldRoom });

      const room = await roomService.getRoom('room-123');

      expect(room.isNew).toBe(false);
    });

    it('calculates isFull when at capacity', async () => {
      const fullRoom = {
        ...mockRoomDTO,
        participantCount: 20,
        maxParticipants: 20,
      };
      (api.get as jest.Mock).mockResolvedValue({ data: fullRoom });

      const room = await roomService.getRoom('room-123');

      expect(room.isFull).toBe(true);
    });

    it('calculates isExpiringSoon for rooms expiring soon', async () => {
      const expiringRoom = {
        ...mockRoomDTO,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 mins
      };
      (api.get as jest.Mock).mockResolvedValue({ data: expiringRoom });

      const room = await roomService.getRoom('room-123');

      expect(room.isExpiringSoon).toBe(true);
    });

    it('handles null expiresAt (until_inactive)', async () => {
      const noExpiryRoom = {
        ...mockRoomDTO,
        expiresAt: null,
      };
      (api.get as jest.Mock).mockResolvedValue({ data: noExpiryRoom });

      const room = await roomService.getRoom('room-123');

      expect(room.timeRemaining).toBe('No expiry');
      expect(room.isExpiringSoon).toBe(false);
    });

    it('maps categoryIcon to emoji', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockRoomDTO });

      const room = await roomService.getRoom('room-123');

      expect(room.emoji).toBe('👋');
    });
  });
});
