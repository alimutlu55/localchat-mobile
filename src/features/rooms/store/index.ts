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
  selectIsLoading,
  selectPagination,
  // Derived hooks
  useStoreRoom,
  useIsRoomJoinedStore,
  useMyRoomsStore,
  useDiscoveredRoomsStore,
  useActiveRoomsStore,
  // Types
  type RoomStore,
  type RoomStoreState,
  type RoomStoreActions,
} from './RoomStore';

export { RoomStoreProvider } from './RoomStoreProvider';
