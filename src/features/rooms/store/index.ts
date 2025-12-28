/**
 * Room Store Module
 *
 * Exports the Zustand-based room store and selectors.
 */

export {
  useRoomStore,
  // Selectors
  selectRoom,
  selectDiscoveredRooms,
  selectActiveRooms,
  selectMyRooms,
  selectIsJoined,
  selectIsRoomMuted,
  selectIsLoading,
  selectPagination,
  // Derived hooks
  useStoreRoom,
  useIsRoomJoinedStore,
  useIsRoomMutedStore,
  useMyRoomsStore,
  useDiscoveredRoomsStore,
  useActiveRoomsStore,
  // Types
  type RoomStore,
  type RoomStoreState,
  type RoomStoreActions,
} from './RoomStore';

export { RoomStoreProvider } from './RoomStoreProvider';
