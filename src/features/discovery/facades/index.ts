/**
 * Discovery Facades
 *
 * Clean abstractions for accessing room data and cluster transformations.
 * These facades provide explicit boundaries between discovery components
 * and underlying stores/utilities.
 */

export { RoomFacade, useRoomFacade } from './RoomFacade';
export { ClusterFacade } from './ClusterFacade';
