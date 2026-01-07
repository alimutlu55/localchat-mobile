/**
 * useViewportRooms Hook Tests
 *
 * Tests for viewport-synchronized room discovery that powers the List View
 * synchronization with the Map View.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useViewportRooms, UseViewportRoomsReturn } from '../useViewportRooms';
import { roomService } from '../../../../services';
import { useRoomStore } from '../../../../features/rooms/store';
import { eventBus } from '../../../../core/events';
import { Room } from '../../../../types';

// Mock roomService
jest.mock('../../../../services', () => ({
    roomService: {
        getViewportRooms: jest.fn(),
    },
}));

// Mock useRoomStore
jest.mock('../../../../features/rooms/store', () => {
    const mockState = {
        rooms: new Map(),
        joinedRoomIds: new Set<string>(),
        createdRoomIds: new Set<string>(),
        hiddenRoomIds: new Set<string>(),
        setRooms: jest.fn(),
    };

    const mockStore = (selector: any) => selector(mockState);
    mockStore.getState = () => mockState;

    return {
        useRoomStore: mockStore,
    };
});

// Mock logger
jest.mock('../../../../shared/utils/logger', () => ({
    createLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }),
}));

// Mock EventBus
jest.mock('../../../../core/events', () => {
    const listeners: Record<string, Function[]> = {};
    return {
        eventBus: {
            on: jest.fn((event, cb) => {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(cb);
                return () => {
                    listeners[event] = listeners[event].filter(l => l !== cb);
                };
            }),
            emit: jest.fn((event, payload) => {
                if (listeners[event]) {
                    listeners[event].forEach(cb => cb(payload));
                }
            }),
        },
    };
});

describe('useViewportRooms', () => {
    const mockBounds: [number, number, number, number] = [10, 50, 11, 51];
    const mockUserLocation = { latitude: 50.5, longitude: 10.5 };

    const createMockRoom = (id: string, lat: number = 50.5, lng: number = 10.5): Room => ({
        id,
        title: `Room ${id}`,
        description: 'Test room',
        category: 'GENERAL',
        latitude: lat,
        longitude: lng,
        radiusMeters: 1000,
        status: 'active',
        participantCount: 5,
        maxParticipants: 100,
        creatorId: 'creator-1',
        createdAt: new Date(),
        lastActivityAt: new Date(),
        isCreator: false,
        emoji: '🏠',
        distance: 100,
        expiresAt: new Date().toISOString(),
        timeRemaining: '1h',
    } as unknown as Room);

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Reset store state
        const state = useRoomStore.getState() as any;
        state.rooms.clear();
        state.joinedRoomIds.clear();
        state.createdRoomIds.clear();
        state.hiddenRoomIds.clear();

        // Default roomService mock
        (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
            rooms: [],
            hasNext: false,
            totalElements: 0,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Basic Functionality', () => {
        it('should fetch rooms when enabled', async () => {
            const mockRooms = [createMockRoom('room-1'), createMockRoom('room-2')];
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: mockRooms,
                hasNext: false,
                totalElements: 2,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    userLocation: mockUserLocation,
                    enabled: true,
                })
            );

            // Fast-forward debounce timer
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(roomService.getViewportRooms).toHaveBeenCalledWith(
                10, // minLng
                50, // minLat
                11, // maxLng
                51, // maxLat
                50.5, // userLat
                10.5, // userLng
                undefined, // category
                0, // page
                20 // pageSize
            );
        });

        it('should not fetch when disabled', async () => {
            renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    userLocation: mockUserLocation,
                    enabled: false,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(500);
            });

            expect(roomService.getViewportRooms).not.toHaveBeenCalled();
        });

        it('should return rooms in response', async () => {
            const mockRooms = [createMockRoom('room-1'), createMockRoom('room-2')];
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: mockRooms,
                hasNext: false,
                totalElements: 2,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.rooms.length).toBe(2);
            });

            expect(result.current.totalCount).toBe(2);
            expect(result.current.hasMore).toBe(false);
        });
    });

    describe('Pagination', () => {
        it('should support loading more rooms', async () => {
            const page0Rooms = [createMockRoom('room-1')];
            const page1Rooms = [createMockRoom('room-2')];

            (roomService.getViewportRooms as jest.Mock)
                .mockResolvedValueOnce({
                    rooms: page0Rooms,
                    hasNext: true,
                    totalElements: 2,
                })
                .mockResolvedValueOnce({
                    rooms: page1Rooms,
                    hasNext: false,
                    totalElements: 2,
                });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            // Initial fetch
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.hasMore).toBe(true);
            });

            // Load more
            await act(async () => {
                await result.current.loadMore();
            });

            expect(roomService.getViewportRooms).toHaveBeenCalledTimes(2);
            // Second call should be page 1
            expect(roomService.getViewportRooms).toHaveBeenLastCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                undefined,
                undefined,
                undefined,
                1, // page 1
                20
            );
        });

        it('should not load more when hasMore is false', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [createMockRoom('room-1')],
                hasNext: false,
                totalElements: 1,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.hasMore).toBe(false);
            });

            // Try to load more
            await act(async () => {
                await result.current.loadMore();
            });

            // Should only have been called once (initial fetch)
            expect(roomService.getViewportRooms).toHaveBeenCalledTimes(1);
        });
    });

    describe('Bounds Change Handling', () => {
        it('should refetch when bounds change significantly', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [],
                hasNext: false,
                totalElements: 0,
            });

            const { result, rerender } = renderHook<UseViewportRoomsReturn, { bounds: [number, number, number, number] }>(
                ({ bounds }) =>
                    useViewportRooms({
                        bounds,
                        enabled: true,
                    }),
                {
                    initialProps: { bounds: mockBounds },
                }
            );

            // Initial fetch
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(1);
            });

            // Change bounds significantly via EventBus
            const newBounds: [number, number, number, number] = [10.5, 50.5, 11.5, 51.5];

            await act(async () => {
                eventBus.emit('discovery.clusteringCompleted', {
                    bounds: newBounds,
                    zoom: 12,
                    category: 'GENERAL'
                });
            });

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(2);
            });
        });

        it('should fetch immediately on each event emission (no internal double-debounce)', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [],
                hasNext: false,
                totalElements: 0,
            });

            const { result } = renderHook<UseViewportRoomsReturn, { bounds: [number, number, number, number] }>(
                ({ bounds }) =>
                    useViewportRooms({
                        bounds,
                        enabled: true,
                    }),
                {
                    initialProps: { bounds: mockBounds },
                }
            );

            // Initial fetch
            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
            expect(roomService.getViewportRooms).toHaveBeenCalledTimes(1);

            // Two distinct stable clustering events
            const newBounds1: [number, number, number, number] = [10.1, 50.1, 11.1, 51.1];
            const newBounds2: [number, number, number, number] = [10.2, 50.2, 11.2, 51.2];

            await act(async () => {
                eventBus.emit('discovery.clusteringCompleted', {
                    bounds: newBounds1,
                    zoom: 12,
                    category: 'GENERAL'
                });
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(2);
            });

            await act(async () => {
                eventBus.emit('discovery.clusteringCompleted', {
                    bounds: newBounds2,
                    zoom: 12,
                    category: 'GENERAL'
                });
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(3);
            });
        });
    });

    describe('Category Filtering', () => {
        it('should pass category to API', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [],
                hasNext: false,
                totalElements: 0,
            });

            renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    category: 'FOOD_DINING',
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(roomService.getViewportRooms).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                undefined,
                undefined,
                'FOOD_DINING', // category
                0,
                20
            );
        });

        it('should refetch when category changes', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [],
                hasNext: false,
                totalElements: 0,
            });

            const { rerender } = renderHook<UseViewportRoomsReturn, { category: string | undefined }>(
                ({ category }) =>
                    useViewportRooms({
                        bounds: mockBounds,
                        category,
                        enabled: true,
                    }),
                {
                    initialProps: { category: undefined as string | undefined },
                }
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(roomService.getViewportRooms).toHaveBeenCalledTimes(1);

            // Change category
            rerender({ category: 'SOCIAL_MEETUPS' });

            await act(async () => {
                jest.advanceTimersByTime(100); // Should fetch immediately on category change
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Error Handling', () => {
        it('should set error state on API failure', async () => {
            (roomService.getViewportRooms as jest.Mock).mockRejectedValue(
                new Error('Network error')
            );

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.error).toBe('Network error');
            });

            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('Store Integration', () => {
        it('should hydrate rooms with joined status', async () => {
            const state = useRoomStore.getState() as any;
            state.joinedRoomIds.add('room-1');

            const mockRooms = [createMockRoom('room-1')];
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: mockRooms,
                hasNext: false,
                totalElements: 1,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.rooms.length).toBe(1);
            });

            expect(result.current.rooms[0].hasJoined).toBe(true);
        });

        it('should filter out hidden rooms', async () => {
            const state = useRoomStore.getState() as any;
            state.hiddenRoomIds.add('room-2');

            const mockRooms = [createMockRoom('room-1'), createMockRoom('room-2')];
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: mockRooms,
                hasNext: false,
                totalElements: 2,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(result.current.rooms.length).toBe(1);
            });

            expect(result.current.rooms[0].id).toBe('room-1');
        });

        it('should call setRooms to update store', async () => {
            const state = useRoomStore.getState() as any;
            const mockRooms = [createMockRoom('room-1')];

            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: mockRooms,
                hasNext: false,
                totalElements: 1,
            });

            renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(state.setRooms).toHaveBeenCalledWith(mockRooms);
            });
        });
    });

    describe('Refetch', () => {
        it('should reset pagination on refetch', async () => {
            (roomService.getViewportRooms as jest.Mock).mockResolvedValue({
                rooms: [createMockRoom('room-1')],
                hasNext: false,
                totalElements: 1,
            });

            const { result } = renderHook(() =>
                useViewportRooms({
                    bounds: mockBounds,
                    enabled: true,
                })
            );

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(roomService.getViewportRooms).toHaveBeenCalledTimes(1);
            });

            // Manually refetch
            await act(async () => {
                await result.current.refetch();
            });

            // Should have called with page 0 again
            expect(roomService.getViewportRooms).toHaveBeenLastCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.anything(),
                undefined,
                undefined,
                undefined,
                0, // page reset to 0
                20
            );
        });
    });
});
