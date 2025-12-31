/**
 * useMyRooms Hook Tests
 *
 * Tests the user's rooms hook.
 * Validates:
 * - Fetching user's rooms
 * - Joined room tracking
 * - Room add/remove operations
 * - Active vs expired filtering
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMyRooms } from '../../../../../src/features/rooms/hooks/useMyRooms';
import { roomService } from '../../../../../src/services';

// Mock dependencies
jest.mock('../../../../../src/services', () => ({
  roomService: {
    getMyRooms: jest.fn(),
  },
}));

jest.mock('../../../../../src/features/user/store', () => ({
  useUserId: jest.fn(() => 'current-user-123'),
}));

// Mock store state
const mockStoreState = {
  rooms: new Map(),
  joinedRoomIds: new Set<string>(),
  createdRoomIds: new Set<string>(),
  setRooms: jest.fn(),
  updateRoom: jest.fn(),
  setJoinedRoomIds: jest.fn(),
  addJoinedRoom: jest.fn(),
  removeJoinedRoom: jest.fn(),
};

jest.mock('../../../../../src/features/rooms/store', () => ({
  useRoomStore: jest.fn((selector) => selector(mockStoreState)),
}));

jest.mock('../../../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useMyRooms', () => {
  const mockRooms = [
    {
      id: 'room-1',
      title: 'Room 1',
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      id: 'room-2',
      title: 'Room 2',
      status: 'active',
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      id: 'room-3',
      title: 'Room 3 (Expired)',
      status: 'expired',
      createdAt: new Date(Date.now() - 2000),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.rooms.clear();
    mockStoreState.joinedRoomIds.clear();

    // Setup store with rooms
    mockRooms.forEach((r) => mockStoreState.rooms.set(r.id, r));
    mockStoreState.joinedRoomIds = new Set(['room-1', 'room-2', 'room-3']);

    (roomService.getMyRooms as jest.Mock).mockResolvedValue(mockRooms);
  });

  // ===========================================================================
  // Basic Hook Tests
  // ===========================================================================

  describe('Basic Hook', () => {
    it('returns rooms from store', () => {
      const { result } = renderHook(() => useMyRooms());

      expect(result.current.rooms).toBeDefined();
      expect(result.current.joinedIds).toBeDefined();
    });

    it('computes rooms from joined IDs', () => {
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          rooms: new Map([
            ['room-1', mockRooms[0]],
            ['room-2', mockRooms[1]],
          ]),
          joinedRoomIds: new Set(['room-1', 'room-2']),
        })
      );

      const { result } = renderHook(() => useMyRooms());

      expect(result.current.rooms.length).toBe(2);
    });

    it('does not auto-fetch by default', () => {
      renderHook(() => useMyRooms());

      expect(roomService.getMyRooms).not.toHaveBeenCalled();
    });

    it('auto-fetches when enabled', async () => {
      renderHook(() => useMyRooms({ autoFetch: true }));

      await waitFor(() => {
        expect(roomService.getMyRooms).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // isJoined Tests
  // ===========================================================================

  describe('isJoined', () => {
    it('returns true for joined rooms', () => {
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          joinedRoomIds: new Set(['room-1', 'room-2']),
        })
      );

      const { result } = renderHook(() => useMyRooms());

      expect(result.current.isJoined('room-1')).toBe(true);
      expect(result.current.isJoined('room-2')).toBe(true);
    });

    it('returns false for non-joined rooms', () => {
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          joinedRoomIds: new Set(['room-1']),
        })
      );

      const { result } = renderHook(() => useMyRooms());

      expect(result.current.isJoined('room-999')).toBe(false);
    });
  });

  // ===========================================================================
  // Refresh Tests
  // ===========================================================================

  describe('refresh', () => {
    it('fetches rooms from API', async () => {
      const { result } = renderHook(() => useMyRooms());

      await act(async () => {
        await result.current.refresh();
      });

      expect(roomService.getMyRooms).toHaveBeenCalled();
    });

    it('updates store with fetched rooms', async () => {
      const { result } = renderHook(() => useMyRooms());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockStoreState.setRooms).toHaveBeenCalledWith(mockRooms);
    });

    it('updates joined room IDs', async () => {
      const { result } = renderHook(() => useMyRooms());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockStoreState.setJoinedRoomIds).toHaveBeenCalled();
    });

    it('sets loading state during fetch', async () => {
      let resolveGetMyRooms: (value: any) => void;
      (roomService.getMyRooms as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGetMyRooms = resolve;
          })
      );

      const { result } = renderHook(() => useMyRooms());

      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveGetMyRooms!(mockRooms);
        await refreshPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('sets error on fetch failure', async () => {
      (roomService.getMyRooms as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMyRooms());

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('skips fetch when not authenticated', async () => {
      const { useUserId } = require('../../../../../src/features/user/store');
      useUserId.mockReturnValue(null);

      const { result } = renderHook(() => useMyRooms());

      await act(async () => {
        await result.current.refresh();
      });

      expect(roomService.getMyRooms).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Add/Remove Room Tests
  // ===========================================================================

  describe('addRoom', () => {
    it('updates store and adds to joined IDs', () => {
      const { result } = renderHook(() => useMyRooms());

      const newRoom = { id: 'room-new', title: 'New Room', status: 'active' as const };

      act(() => {
        result.current.addRoom(newRoom as any);
      });

      expect(mockStoreState.updateRoom).toHaveBeenCalledWith('room-new', newRoom);
      expect(mockStoreState.addJoinedRoom).toHaveBeenCalledWith('room-new');
    });
  });

  describe('removeRoom', () => {
    it('removes from joined IDs', () => {
      const { result } = renderHook(() => useMyRooms());

      act(() => {
        result.current.removeRoom('room-1');
      });

      expect(mockStoreState.removeJoinedRoom).toHaveBeenCalledWith('room-1');
    });
  });

  // ===========================================================================
  // Active/Expired Rooms Tests
  // ===========================================================================

  describe('activeRooms/expiredRooms', () => {
    it('separates active from expired rooms', () => {
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          rooms: new Map(mockRooms.map((r) => [r.id, r])),
          joinedRoomIds: new Set(['room-1', 'room-2', 'room-3']),
        })
      );

      const { result } = renderHook(() => useMyRooms());

      expect(result.current.activeRooms.length).toBe(2);
      expect(result.current.expiredRooms.length).toBe(1);
      expect(result.current.expiredRooms[0].id).toBe('room-3');
    });
  });

  // ===========================================================================
  // Closed Rooms Filter Tests
  // ===========================================================================

  describe('includeClosed option', () => {
    it('excludes closed rooms by default', () => {
      const closedRoom = { id: 'room-closed', title: 'Closed', status: 'closed', createdAt: new Date() };
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          rooms: new Map([
            ['room-1', mockRooms[0]],
            ['room-closed', closedRoom],
          ]),
          joinedRoomIds: new Set(['room-1', 'room-closed']),
        })
      );

      const { result } = renderHook(() => useMyRooms());

      const closedInList = result.current.rooms.find((r) => r.id === 'room-closed');
      expect(closedInList).toBeUndefined();
    });

    it('includes closed rooms when option is true', () => {
      const closedRoom = { id: 'room-closed', title: 'Closed', status: 'closed', createdAt: new Date() };
      const { useRoomStore } = require('../../../../../src/features/rooms/store');
      useRoomStore.mockImplementation((selector: any) =>
        selector({
          ...mockStoreState,
          rooms: new Map([
            ['room-1', mockRooms[0]],
            ['room-closed', closedRoom],
          ]),
          joinedRoomIds: new Set(['room-1', 'room-closed']),
        })
      );

      const { result } = renderHook(() => useMyRooms({ includeClosed: true }));

      const closedInList = result.current.rooms.find((r) => r.id === 'room-closed');
      expect(closedInList).toBeDefined();
    });
  });
});
