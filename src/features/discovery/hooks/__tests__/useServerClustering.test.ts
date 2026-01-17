/**
 * useServerClustering Hook Tests
 * 
 * Tests for server-side clustering integration, specifically focusing on
 * the logic for handling optimistic (pending) rooms.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useServerClustering } from '../useServerClustering';
import { roomService } from '../../../../services';
import { useRoomStore } from '../../../../features/rooms/store';
import { ClusterResponse } from '../../../../types';

// Mock roomService
jest.mock('../../../../services', () => ({
    roomService: {
        getClusters: jest.fn(),
    },
}));

// Mock useRoomStore
jest.mock('../../../../features/rooms/store', () => {
    const actual = jest.requireActual('../../../../features/rooms/store');
    const mockState = {
        rooms: new Map(),
        joinedRoomIds: new Set(),
        createdRoomIds: new Set(),
        hiddenRoomIds: new Set(),
        pendingRoomIds: new Set(),
        removePendingRoom: jest.fn(),
    };

    const mockStore = (selector: any) => selector ? selector(mockState) : mockState;
    mockStore.getState = () => mockState;

    return {
        ...actual,
        useRoomStore: mockStore,
    };
});

describe('useServerClustering - Pending Room Logic', () => {
    const mockBounds: [number, number, number, number] = [20, 50, 21, 51];
    const mockZoom = 12;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset store state
        const state = useRoomStore.getState() as any;
        state.rooms.clear();
        state.pendingRoomIds.clear();
        state.removePendingRoom.mockClear();

        // Default roomService mock
        (roomService.getClusters as jest.Mock).mockResolvedValue({
            features: [],
            metadata: { clusterCount: 0, individualCount: 0, totalRooms: 0, processingTimeMs: 0 }
        });
    });

    it('should include pending rooms in output features', async () => {
        const state = useRoomStore.getState() as any;
        const roomId = 'pending-1';
        state.pendingRoomIds.add(roomId);
        state.rooms.set(roomId, {
            id: roomId,
            latitude: 50.5,
            longitude: 20.5,
            title: 'Pending Room',
            category: 'GENERAL'
        });

        const { result } = renderHook(() => useServerClustering({
            bounds: mockBounds,
            zoom: mockZoom,
            enabled: true,
            isMapReady: true
        }));

        // Should include the pending room
        const feature = result.current.features.find(f => f.properties.roomId === roomId);
        expect(feature).toBeTruthy();
        expect(feature?.properties.cluster).toBe(false);
    });

    it('should hide pending room if covered by a cluster (smarter merging)', async () => {
        const state = useRoomStore.getState() as any;
        const roomId = 'pending-covered';
        state.pendingRoomIds.add(roomId);
        state.rooms.set(roomId, {
            id: roomId,
            latitude: 50.5,
            longitude: 20.5,
            title: 'Covered Room',
            category: 'GENERAL'
        });

        // Mock server response with a cluster that covers the pending room
        (roomService.getClusters as jest.Mock).mockResolvedValue({
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [20.5, 50.5] },
                properties: {
                    cluster: true,
                    clusterId: 100,
                    pointCount: 5,
                    expansionBounds: [20.4, 50.4, 20.6, 50.6] // Covers 20.5, 50.5
                }
            }],
            metadata: { clusterCount: 1, individualCount: 0, totalRooms: 5, processingTimeMs: 5 }
        });

        const { result } = renderHook(() => useServerClustering({
            bounds: mockBounds,
            zoom: mockZoom,
            enabled: true,
            isMapReady: true
        }));

        // Wait for fetch to complete
        await act(async () => {
            await result.current.refetch();
        });

        // Should NOT include the pending room because it is covered by a cluster
        const feature = result.current.features.find(f => f.properties.roomId === roomId);
        expect(feature).toBeUndefined();

        // Only the cluster should be present
        expect(result.current.features.length).toBe(1);
        expect(result.current.features[0].properties.cluster).toBe(true);
    });

    it('should NOT remove pending room if server response is empty (prevents disappearance)', async () => {
        const state = useRoomStore.getState() as any;
        const roomId = 'newly-created';
        state.pendingRoomIds.add(roomId);
        state.rooms.set(roomId, {
            id: roomId,
            latitude: 50.5,
            longitude: 20.5,
            title: 'Just Created',
            category: 'GENERAL'
        });

        // Mock empty server response (lag case)
        (roomService.getClusters as jest.Mock).mockResolvedValue({
            features: [],
            metadata: { clusterCount: 0, individualCount: 0, totalRooms: 0, processingTimeMs: 1 }
        });

        const { result } = renderHook(() => useServerClustering({
            bounds: mockBounds,
            zoom: mockZoom,
            enabled: true,
            isMapReady: true
        }));

        await act(async () => {
            await result.current.refetch();
        });

        // Should STILL be in pendingRoomIds (not removed from store)
        expect(state.removePendingRoom).not.toHaveBeenCalled();

        // Should STILL be visible in output features
        const feature = result.current.features.find(f => f.properties.roomId === roomId);
        expect(feature).toBeTruthy();
    });

    it('should remove pending room when confirmed by server as individual room', async () => {
        const state = useRoomStore.getState() as any;
        const roomId = 'confirmed-id';
        state.pendingRoomIds.add(roomId);
        state.rooms.set(roomId, {
            id: roomId,
            latitude: 50.5,
            longitude: 20.5,
            title: 'Confirmed Room',
            category: 'GENERAL'
        });

        // Mock server response that includes the room
        (roomService.getClusters as jest.Mock).mockResolvedValue({
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [20.5, 50.5] },
                properties: {
                    cluster: false,
                    roomId: roomId,
                    title: 'Confirmed Room'
                }
            }],
            metadata: { clusterCount: 0, individualCount: 1, totalRooms: 1, processingTimeMs: 2 }
        });

        const { result } = renderHook(() => useServerClustering({
            bounds: mockBounds,
            zoom: mockZoom,
            enabled: true,
            isMapReady: true
        }));

        await act(async () => {
            await result.current.refetch();
        });

        // Should BE removed from store (confirmed by server)
        expect(state.removePendingRoom).toHaveBeenCalledWith(roomId);
    });

    it('should remove pending room when confirmed by server as part of a cluster', async () => {
        const state = useRoomStore.getState() as any;
        const roomId = 'confirmed-in-cluster';
        state.pendingRoomIds.add(roomId);
        state.rooms.set(roomId, {
            id: roomId,
            latitude: 50.5,
            longitude: 20.5,
            title: 'Clustered Room',
            category: 'GENERAL'
        });

        // Mock server response with a cluster covering the room
        (roomService.getClusters as jest.Mock).mockResolvedValue({
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [20.5, 50.5] },
                properties: {
                    cluster: true,
                    clusterId: 42,
                    pointCount: 10,
                    expansionBounds: [20.4, 50.4, 20.6, 50.6]
                }
            }],
            metadata: { clusterCount: 1, individualCount: 0, totalRooms: 10, processingTimeMs: 5 }
        });

        const { result } = renderHook(() => useServerClustering({
            bounds: mockBounds,
            zoom: mockZoom,
            enabled: true,
            isMapReady: true
        }));

        await act(async () => {
            await result.current.refetch();
        });

        // Should BE removed from store (server says it's in a cluster)
        expect(state.removePendingRoom).toHaveBeenCalledWith(roomId);
    });
});
