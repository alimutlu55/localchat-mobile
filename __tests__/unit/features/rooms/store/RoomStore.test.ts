/**
 * RoomStore Unit Tests
 *
 * Tests the room store state management in isolation.
 * Validates:
 * - Room CRUD operations
 * - Membership tracking (joined rooms)
 * - Discovery state
 * - Mute functionality
 * - State consistency
 */

import { act } from '@testing-library/react-native';
import { useRoomStore, RoomStore } from '../../../../../src/features/rooms/store/RoomStore';
import { Room } from '../../../../../src/types';
import { mockRoom, mockJoinedRoom, createMockRoom, createMockRooms } from '../../../../mocks/roomMocks';

// Mock storage
jest.mock('../../../../../src/services/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

describe('RoomStore', () => {
  // Get fresh state helper
  const getState = () => useRoomStore.getState();
  
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      getState().reset();
    });
  });

  // ===========================================================================
  // Initial State Tests
  // ===========================================================================

  describe('Initial State', () => {
    it('starts with empty rooms map', () => {
      expect(getState().rooms.size).toBe(0);
    });

    it('starts with empty joined room IDs', () => {
      expect(getState().joinedRoomIds.size).toBe(0);
    });

    it('starts with empty discovered room IDs', () => {
      expect(getState().discoveredRoomIds.size).toBe(0);
    });

    it('starts with empty muted room IDs', () => {
      expect(getState().mutedRoomIds.size).toBe(0);
    });

    it('starts with isLoading false', () => {
      expect(getState().isLoading).toBe(false);
    });

    it('starts with no selected room', () => {
      expect(getState().selectedRoomId).toBeNull();
    });
  });

  // ===========================================================================
  // Room Data Operations
  // ===========================================================================

  describe('setRoom', () => {
    it('adds a new room to the store', () => {
      act(() => {
        getState().setRoom(mockRoom);
      });

      expect(getState().rooms.size).toBe(1);
      expect(getState().rooms.get(mockRoom.id)).toEqual(mockRoom);
    });

    it('updates an existing room', () => {
      const updatedRoom = { ...mockRoom, title: 'Updated Title' };

      act(() => {
        getState().setRoom(mockRoom);
        getState().setRoom(updatedRoom);
      });

      expect(getState().rooms.size).toBe(1);
      expect(getState().rooms.get(mockRoom.id)?.title).toBe('Updated Title');
    });

    it('preserves existing fields when updating with partial data', () => {
      const originalRoom = { ...mockRoom, isCreator: true, hasJoined: true };
      const partialUpdate = { ...mockRoom, title: 'New Title', isCreator: undefined };

      act(() => {
        getState().setRoom(originalRoom);
        getState().setRoom(partialUpdate as Room);
      });

      const storedRoom = getState().rooms.get(mockRoom.id);
      expect(storedRoom?.title).toBe('New Title');
      expect(storedRoom?.isCreator).toBe(true); // Preserved
    });
  });

  describe('setRooms (batch)', () => {
    it('adds multiple rooms at once', () => {
      const rooms = createMockRooms(5);

      act(() => {
        getState().setRooms(rooms);
      });

      expect(getState().rooms.size).toBe(5);
      rooms.forEach((room) => {
        expect(getState().rooms.has(room.id)).toBe(true);
      });
    });

    it('does nothing with empty array', () => {
      act(() => {
        getState().setRooms([]);
      });

      expect(getState().rooms.size).toBe(0);
    });

    it('merges with existing rooms', () => {
      const existingRoom = createMockRoom({ id: 'existing', title: 'Existing' });
      const newRooms = createMockRooms(3);

      act(() => {
        getState().setRoom(existingRoom);
        getState().setRooms(newRooms);
      });

      expect(getState().rooms.size).toBe(4);
      expect(getState().rooms.has('existing')).toBe(true);
    });
  });

  describe('updateRoom', () => {
    it('updates specific fields of a room', () => {
      act(() => {
        getState().setRoom(mockRoom);
        getState().updateRoom(mockRoom.id, { participantCount: 10 });
      });

      expect(getState().rooms.get(mockRoom.id)?.participantCount).toBe(10);
    });

    it('does nothing for non-existent room', () => {
      act(() => {
        getState().updateRoom('non-existent', { title: 'New Title' });
      });

      expect(getState().rooms.size).toBe(0);
    });

    it('preserves other fields when updating', () => {
      act(() => {
        getState().setRoom(mockRoom);
        getState().updateRoom(mockRoom.id, { title: 'New Title' });
      });

      const room = getState().rooms.get(mockRoom.id);
      expect(room?.title).toBe('New Title');
      expect(room?.description).toBe(mockRoom.description);
      expect(room?.participantCount).toBe(mockRoom.participantCount);
    });
  });

  describe('removeRoom', () => {
    it('removes a room from the store', () => {
      act(() => {
        getState().setRoom(mockRoom);
        getState().removeRoom(mockRoom.id);
      });

      expect(getState().rooms.size).toBe(0);
      expect(getState().rooms.has(mockRoom.id)).toBe(false);
    });

    it('also removes from joined and discovered sets', () => {
      act(() => {
        getState().setRoom(mockRoom);
        getState().addJoinedRoom(mockRoom.id);
        getState().addDiscoveredRoomIds([mockRoom.id]);
        getState().removeRoom(mockRoom.id);
      });

      expect(getState().joinedRoomIds.has(mockRoom.id)).toBe(false);
      expect(getState().discoveredRoomIds.has(mockRoom.id)).toBe(false);
    });

    it('does nothing for non-existent room', () => {
      act(() => {
        getState().setRoom(mockRoom);
        getState().removeRoom('non-existent');
      });

      expect(getState().rooms.size).toBe(1);
    });
  });

  describe('getRoom', () => {
    it('returns room by ID', () => {
      act(() => {
        getState().setRoom(mockRoom);
      });

      expect(getState().getRoom(mockRoom.id)).toEqual(mockRoom);
    });

    it('returns undefined for non-existent room', () => {
      expect(getState().getRoom('non-existent')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Membership Operations
  // ===========================================================================

  describe('addJoinedRoom', () => {
    it('adds room ID to joined set', () => {
      act(() => {
        getState().addJoinedRoom('room-1');
      });

      expect(getState().joinedRoomIds.has('room-1')).toBe(true);
      expect(getState().joinedRoomIds.size).toBe(1);
    });

    it('does not duplicate if already joined', () => {
      act(() => {
        getState().addJoinedRoom('room-1');
        getState().addJoinedRoom('room-1');
      });

      expect(getState().joinedRoomIds.size).toBe(1);
    });
  });

  describe('removeJoinedRoom', () => {
    it('removes room ID from joined set', () => {
      act(() => {
        getState().addJoinedRoom('room-1');
        getState().removeJoinedRoom('room-1');
      });

      expect(getState().joinedRoomIds.has('room-1')).toBe(false);
      expect(getState().joinedRoomIds.size).toBe(0);
    });

    it('does nothing if not joined', () => {
      act(() => {
        getState().removeJoinedRoom('room-1');
      });

      expect(getState().joinedRoomIds.size).toBe(0);
    });
  });

  describe('isJoined', () => {
    it('returns true for joined room', () => {
      act(() => {
        getState().addJoinedRoom('room-1');
      });

      expect(getState().isJoined('room-1')).toBe(true);
    });

    it('returns false for non-joined room', () => {
      expect(getState().isJoined('room-1')).toBe(false);
    });
  });

  describe('setJoinedRoomIds', () => {
    it('replaces all joined room IDs', () => {
      act(() => {
        getState().addJoinedRoom('old-room');
        getState().setJoinedRoomIds(new Set(['new-1', 'new-2']));
      });

      expect(getState().joinedRoomIds.has('old-room')).toBe(false);
      expect(getState().joinedRoomIds.has('new-1')).toBe(true);
      expect(getState().joinedRoomIds.has('new-2')).toBe(true);
      expect(getState().joinedRoomIds.size).toBe(2);
    });
  });

  // ===========================================================================
  // Discovery Operations
  // ===========================================================================

  describe('setDiscoveredRoomIds', () => {
    it('sets discovered room IDs', () => {
      act(() => {
        getState().setDiscoveredRoomIds(new Set(['room-1', 'room-2']));
      });

      expect(getState().discoveredRoomIds.size).toBe(2);
      expect(getState().discoveredRoomIds.has('room-1')).toBe(true);
    });
  });

  describe('addDiscoveredRoomIds', () => {
    it('adds to existing discovered IDs', () => {
      act(() => {
        getState().setDiscoveredRoomIds(new Set(['room-1']));
        getState().addDiscoveredRoomIds(['room-2', 'room-3']);
      });

      expect(getState().discoveredRoomIds.size).toBe(3);
    });

    it('does not duplicate existing IDs', () => {
      act(() => {
        getState().setDiscoveredRoomIds(new Set(['room-1']));
        getState().addDiscoveredRoomIds(['room-1', 'room-2']);
      });

      expect(getState().discoveredRoomIds.size).toBe(2);
    });
  });

  // ===========================================================================
  // Mute Operations
  // ===========================================================================

  describe('muteRoom', () => {
    it('adds room to muted set', () => {
      act(() => {
        getState().muteRoom('room-1');
      });

      expect(getState().mutedRoomIds.has('room-1')).toBe(true);
    });

    it('does not duplicate', () => {
      act(() => {
        getState().muteRoom('room-1');
        getState().muteRoom('room-1');
      });

      expect(getState().mutedRoomIds.size).toBe(1);
    });
  });

  describe('unmuteRoom', () => {
    it('removes room from muted set', () => {
      act(() => {
        getState().muteRoom('room-1');
        getState().unmuteRoom('room-1');
      });

      expect(getState().mutedRoomIds.has('room-1')).toBe(false);
    });
  });

  describe('toggleMuteRoom', () => {
    it('toggles mute state', () => {
      act(() => {
        getState().toggleMuteRoom('room-1');
      });
      expect(getState().mutedRoomIds.has('room-1')).toBe(true);

      act(() => {
        getState().toggleMuteRoom('room-1');
      });
      expect(getState().mutedRoomIds.has('room-1')).toBe(false);
    });
  });

  describe('isRoomMuted', () => {
    it('returns correct mute status', () => {
      expect(getState().isRoomMuted('room-1')).toBe(false);

      act(() => {
        getState().muteRoom('room-1');
      });

      expect(getState().isRoomMuted('room-1')).toBe(true);
    });
  });

  // ===========================================================================
  // UI State Operations
  // ===========================================================================

  describe('setSelectedRoom', () => {
    it('sets selected room ID', () => {
      act(() => {
        getState().setSelectedRoom('room-1');
      });

      expect(getState().selectedRoomId).toBe('room-1');
    });

    it('can clear selection', () => {
      act(() => {
        getState().setSelectedRoom('room-1');
        getState().setSelectedRoom(null);
      });

      expect(getState().selectedRoomId).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets loading state', () => {
      act(() => {
        getState().setLoading(true);
      });

      expect(getState().isLoading).toBe(true);

      act(() => {
        getState().setLoading(false);
      });

      expect(getState().isLoading).toBe(false);
    });
  });

  describe('setPagination', () => {
    it('updates pagination state', () => {
      act(() => {
        getState().setPagination(3, false);
      });

      expect(getState().currentPage).toBe(3);
      expect(getState().hasMoreRooms).toBe(false);
    });
  });

  // ===========================================================================
  // Reset
  // ===========================================================================

  describe('reset', () => {
    it('resets store to initial state', () => {
      // Populate store
      act(() => {
        getState().setRoom(mockRoom);
        getState().addJoinedRoom(mockRoom.id);
        getState().addDiscoveredRoomIds([mockRoom.id]);
        getState().muteRoom(mockRoom.id);
        getState().setSelectedRoom(mockRoom.id);
        getState().setLoading(true);
        getState().setPagination(5, false);
      });

      // Verify populated
      expect(getState().rooms.size).toBe(1);

      // Reset
      act(() => {
        getState().reset();
      });

      // Verify reset
      expect(getState().rooms.size).toBe(0);
      expect(getState().joinedRoomIds.size).toBe(0);
      expect(getState().discoveredRoomIds.size).toBe(0);
      expect(getState().mutedRoomIds.size).toBe(0);
      expect(getState().selectedRoomId).toBeNull();
      expect(getState().isLoading).toBe(false);
      expect(getState().currentPage).toBe(0);
      expect(getState().hasMoreRooms).toBe(true);
    });
  });

  // ===========================================================================
  // State Consistency Tests
  // ===========================================================================

  describe('State Consistency', () => {
    it('joined rooms are subset of all rooms', () => {
      const rooms = createMockRooms(5);

      act(() => {
        getState().setRooms(rooms);
        getState().addJoinedRoom(rooms[0].id);
        getState().addJoinedRoom(rooms[2].id);
      });

      // All joined rooms should exist in rooms map
      getState().joinedRoomIds.forEach((roomId) => {
        expect(getState().rooms.has(roomId)).toBe(true);
      });
    });

    it('removing room cleans up all references', () => {
      const room = createMockRoom();

      act(() => {
        getState().setRoom(room);
        getState().addJoinedRoom(room.id);
        getState().addDiscoveredRoomIds([room.id]);
        getState().setSelectedRoom(room.id);
        getState().removeRoom(room.id);
      });

      expect(getState().rooms.has(room.id)).toBe(false);
      expect(getState().joinedRoomIds.has(room.id)).toBe(false);
      expect(getState().discoveredRoomIds.has(room.id)).toBe(false);
      // Note: selectedRoomId is NOT automatically cleared by removeRoom
      // This is intentional - UI should handle this separately
    });

    it('batch operations maintain consistency', () => {
      const rooms = createMockRooms(10);
      const joinedIds = [rooms[0].id, rooms[3].id, rooms[7].id];

      act(() => {
        getState().setRooms(rooms);
        joinedIds.forEach((id) => getState().addJoinedRoom(id));
        getState().addDiscoveredRoomIds(rooms.map((r) => r.id));
      });

      expect(getState().rooms.size).toBe(10);
      expect(getState().joinedRoomIds.size).toBe(3);
      expect(getState().discoveredRoomIds.size).toBe(10);

      // Remove some rooms
      act(() => {
        getState().removeRoom(rooms[0].id);
        getState().removeRoom(rooms[5].id);
      });

      expect(getState().rooms.size).toBe(8);
      expect(getState().joinedRoomIds.size).toBe(2); // One was removed
      expect(getState().discoveredRoomIds.size).toBe(8);
    });
  });
});
