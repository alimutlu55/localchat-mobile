/**
 * useRoom Hook Tests
 *
 * Tests the room data hook.
 * Validates:
 * - Initial room loading
 * - Store integration
 * - Cache behavior
 * - Refresh functionality
 * - Error handling
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRoom } from '../../../../../src/features/rooms/hooks/useRoom';
import { roomService } from '../../../../../src/services';

// Mock dependencies
jest.mock('../../../../../src/services', () => ({
  roomService: {
    getRoom: jest.fn(),
  },
}));

// Create a mock store state that can be mutated
const mockStoreState = {
  rooms: new Map(),
  joinedRoomIds: new Set<string>(),
  setRoom: jest.fn(),
};

// Mock the store module - use factory function that returns the mock
jest.mock('../../../../../src/features/rooms/store', () => {
  const mockFn = jest.fn((selector: any) => {
    // Access the outer mockStoreState
    const state = {
      rooms: new Map(),
      joinedRoomIds: new Set<string>(),
      setRoom: jest.fn(),
    };
    return selector(state);
  });
  
  // Add getState method
  (mockFn as any).getState = jest.fn(() => ({
    rooms: new Map(),
    joinedRoomIds: new Set<string>(),
    setRoom: jest.fn(),
  }));
  
  return {
    useRoomStore: mockFn,
  };
});

jest.mock('../../../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Get access to the mock after it's created
const { useRoomStore } = jest.requireMock('../../../../../src/features/rooms/store');

describe('useRoom', () => {
  const mockRoom = {
    id: 'room-123',
    title: 'Test Room',
    description: 'A test room',
    category: 'social',
    emoji: '👋',
    participantCount: 5,
    maxParticipants: 20,
    distance: 150,
    latitude: 37.7749,
    longitude: -122.4194,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    timeRemaining: '1h 0m',
    isNew: false,
    isHighActivity: true,
    isFull: false,
    isExpiringSoon: false,
    status: 'active' as const,
  };

  // Track setRoom calls
  const mockSetRoom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetRoom.mockClear();
    
    // Reset store state
    mockStoreState.rooms.clear();
    mockStoreState.joinedRoomIds.clear();
    
    // Default mock implementation
    useRoomStore.mockImplementation((selector: any) => {
      const state = {
        rooms: mockStoreState.rooms,
        joinedRoomIds: mockStoreState.joinedRoomIds,
        setRoom: mockSetRoom,
      };
      return selector(state);
    });
    useRoomStore.getState.mockReturnValue({
      rooms: mockStoreState.rooms,
      joinedRoomIds: mockStoreState.joinedRoomIds,
      setRoom: mockSetRoom,
    });

    // Default mock
    (roomService.getRoom as jest.Mock).mockResolvedValue(mockRoom);
  });

  // ===========================================================================
  // Initial Load Tests
  // ===========================================================================

  describe('Initial Load', () => {
    it('fetches room when not in store', async () => {
      const { result } = renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(roomService.getRoom).toHaveBeenCalledWith('room-123');
    });

    it('sets room in store after fetch', async () => {
      const { result } = renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSetRoom).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'room-123' })
      );
    });

    it('returns loading true initially', () => {
      const { result } = renderHook(() => useRoom('room-123'));

      expect(result.current.isLoading).toBe(true);
    });

    it('returns null room while loading', () => {
      const { result } = renderHook(() => useRoom('room-123'));

      expect(result.current.room).toBeNull();
    });
  });

  // ===========================================================================
  // Cached Room Tests
  // ===========================================================================

  describe('Cached Room', () => {
    beforeEach(() => {
      mockStoreState.rooms.set('room-123', mockRoom);
    });

    it('returns stored room immediately', () => {
      // Update mock to return stored room
      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
      });

      const { result } = renderHook(() => useRoom('room-123'));

      expect(result.current.room).not.toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('still fetches fresh data by default', async () => {
      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
      });

      renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(roomService.getRoom).toHaveBeenCalled();
      });
    });

    it('skips fetch when skipFetchIfCached is true', async () => {
      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
      });

      renderHook(() => useRoom('room-123', { skipFetchIfCached: true }));

      // Give it time to potentially fetch
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(roomService.getRoom).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Joined Status Tests
  // ===========================================================================

  describe('Joined Status', () => {
    it('includes hasJoined flag when user has joined', async () => {
      mockStoreState.joinedRoomIds.add('room-123');
      mockStoreState.rooms.set('room-123', mockRoom);

      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
          joinedRoomIds: new Set(['room-123']),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
        joinedRoomIds: new Set(['room-123']),
      });

      const { result } = renderHook(() => useRoom('room-123'));

      expect(result.current.room?.hasJoined).toBe(true);
    });

    it('hasJoined is false when user has not joined', async () => {
      mockStoreState.rooms.set('room-123', mockRoom);

      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
          joinedRoomIds: new Set(),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
        joinedRoomIds: new Set(),
      });

      const { result } = renderHook(() => useRoom('room-123'));

      expect(result.current.room?.hasJoined).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('sets error on fetch failure', async () => {
      (roomService.getRoom as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('clears error on successful refresh', async () => {
      (roomService.getRoom as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockRoom);

      const { result } = renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ===========================================================================
  // Refresh Tests
  // ===========================================================================

  describe('Refresh', () => {
    it('sets isRefreshing during refresh', async () => {
      mockStoreState.rooms.set('room-123', mockRoom);
      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
      });

      let resolveGetRoom: (value: any) => void;
      (roomService.getRoom as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGetRoom = resolve;
          })
      );

      const { result } = renderHook(() => useRoom('room-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refresh();
      });

      expect(result.current.isRefreshing).toBe(true);

      await act(async () => {
        resolveGetRoom!(mockRoom);
        await refreshPromise;
      });

      expect(result.current.isRefreshing).toBe(false);
    });

    it('fetches fresh room data on refresh', async () => {
      mockStoreState.rooms.set('room-123', mockRoom);
      useRoomStore.mockImplementation((selector: any) => {
        const state = {
          ...mockStoreState,
          rooms: new Map([['room-123', mockRoom]]),
        };
        return selector(state);
      });
      useRoomStore.getState.mockReturnValue({
        ...mockStoreState,
        rooms: new Map([['room-123', mockRoom]]),
      });

      const { result } = renderHook(() =>
        useRoom('room-123', { skipFetchIfCached: true })
      );

      // Clear initial call if any
      jest.clearAllMocks();

      await act(async () => {
        await result.current.refresh();
      });

      expect(roomService.getRoom).toHaveBeenCalledWith('room-123');
    });
  });

  // ===========================================================================
  // Undefined RoomId Tests
  // ===========================================================================

  describe('Undefined roomId', () => {
    it('does not fetch when roomId is undefined', () => {
      const { result } = renderHook(() => useRoom(undefined));

      expect(roomService.getRoom).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.room).toBeNull();
    });
  });

  // ===========================================================================
  // RoomId Change Tests
  // ===========================================================================

  describe('RoomId Change', () => {
    it('fetches new room when roomId changes', async () => {
      const { result, rerender } = renderHook(({ id }) => useRoom(id), {
        initialProps: { id: 'room-123' },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      rerender({ id: 'room-456' });

      await waitFor(() => {
        expect(roomService.getRoom).toHaveBeenCalledWith('room-456');
      });
    });
  });
});
