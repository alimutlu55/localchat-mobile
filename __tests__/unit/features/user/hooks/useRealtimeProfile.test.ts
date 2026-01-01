/**
 * useRealtimeProfile Hook Tests
 *
 * Tests for the real-time profile synchronization hook that keeps
 * participant avatars and display names updated.
 *
 * CRITICAL: These tests prevent regression of the avatar sync fix where
 * avatars wouldn't show on first render of Room Details screen.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRealtimeProfile } from '../../../../../src/features/user/hooks/useRealtimeProfile';
import { eventBus } from '../../../../../src/core/events/EventBus';
import { useUserStore } from '../../../../../src/features/user/store';

// Mock the UserStore
jest.mock('../../../../../src/features/user/store', () => ({
    useUserStore: jest.fn(),
}));

// Mock EventBus
jest.mock('../../../../../src/core/events/EventBus', () => ({
    eventBus: {
        on: jest.fn(),
        emit: jest.fn(),
    },
}));

const mockedUseUserStore = useUserStore as jest.MockedFunction<typeof useUserStore>;
const mockedEventBus = eventBus as jest.Mocked<typeof eventBus>;

describe('useRealtimeProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock: no current user
        mockedUseUserStore.mockImplementation((selector: any) => {
            const state = {
                userId: null,
                currentUser: null,
            };
            return selector(state);
        });

        // Default EventBus subscription returns unsubscribe function
        mockedEventBus.on.mockReturnValue(() => { });
    });

    describe('initial state', () => {
        it('returns initial data on first render', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: 'https://example.com/avatar.jpg',
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            expect(result.current).toEqual(initialData);
        });

        it('returns initial data without profilePhotoUrl', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: undefined,
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            expect(result.current.profilePhotoUrl).toBeUndefined();
            expect(result.current.displayName).toBe('Test User');
        });
    });

    describe('syncs when initialData changes', () => {
        it('updates state when profilePhotoUrl changes from undefined to a URL', () => {
            // Start with no avatar (simulates initial fetch without avatar)
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: undefined as string | undefined,
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            // Initially no avatar
            expect(result.current.profilePhotoUrl).toBeUndefined();

            // Simulate parent re-render with avatar URL (after fetch completes)
            const updatedData = {
                ...initialData,
                profilePhotoUrl: 'https://example.com/new-avatar.jpg',
            };

            rerender({ data: updatedData });

            // Avatar should now be set
            expect(result.current.profilePhotoUrl).toBe('https://example.com/new-avatar.jpg');
        });

        it('updates state when displayName changes', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Old Name',
                profilePhotoUrl: 'https://example.com/avatar.jpg',
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            expect(result.current.displayName).toBe('Old Name');

            // Update display name
            const updatedData = {
                ...initialData,
                displayName: 'New Name',
            };

            rerender({ data: updatedData });

            expect(result.current.displayName).toBe('New Name');
        });

        it('handles changing avatar URLs', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: 'https://example.com/avatar1.jpg',
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            expect(result.current.profilePhotoUrl).toBe('https://example.com/avatar1.jpg');

            // Change to different avatar
            rerender({
                data: {
                    ...initialData,
                    profilePhotoUrl: 'https://example.com/avatar2.jpg',
                },
            });

            expect(result.current.profilePhotoUrl).toBe('https://example.com/avatar2.jpg');
        });

        it('preserves other fields when updating profile data', () => {
            interface ExtendedProfile {
                userId: string;
                displayName: string;
                profilePhotoUrl?: string;
                customField: string;
            }

            const initialData: ExtendedProfile = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: undefined,
                customField: 'custom-value',
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            // Add avatar
            rerender({
                data: {
                    ...initialData,
                    profilePhotoUrl: 'https://example.com/avatar.jpg',
                },
            });

            // Custom field should still be preserved
            expect(result.current.customField).toBe('custom-value');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/avatar.jpg');
        });
    });

    describe('EventBus profile updates', () => {
        it('subscribes to user.profileUpdated events', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
            };

            renderHook(() => useRealtimeProfile(initialData));

            expect(mockedEventBus.on).toHaveBeenCalledWith(
                'user.profileUpdated',
                expect.any(Function)
            );
        });

        it('updates state when profile update event is received for matching user', () => {
            let eventHandler: ((payload: any) => void) | null = null;

            mockedEventBus.on.mockImplementation((event, handler) => {
                if (event === 'user.profileUpdated') {
                    eventHandler = handler;
                }
                return () => { };
            });

            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: undefined as string | undefined,
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            // Simulate profile update event
            act(() => {
                eventHandler?.({
                    userId: 'user-123',
                    displayName: 'Updated Name',
                    profilePhotoUrl: 'https://example.com/new-avatar.jpg',
                });
            });

            expect(result.current.displayName).toBe('Updated Name');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/new-avatar.jpg');
        });

        it('ignores profile update events for different users', () => {
            let eventHandler: ((payload: any) => void) | null = null;

            mockedEventBus.on.mockImplementation((event, handler) => {
                if (event === 'user.profileUpdated') {
                    eventHandler = handler;
                }
                return () => { };
            });

            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: 'https://example.com/original.jpg',
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            // Simulate profile update event for DIFFERENT user
            act(() => {
                eventHandler?.({
                    userId: 'different-user',
                    displayName: 'Different Name',
                    profilePhotoUrl: 'https://example.com/different.jpg',
                });
            });

            // State should not change
            expect(result.current.displayName).toBe('Test User');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/original.jpg');
        });

        it('unsubscribes from events on unmount', () => {
            const unsubscribe = jest.fn();
            mockedEventBus.on.mockReturnValue(unsubscribe);

            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
            };

            const { unmount } = renderHook(() => useRealtimeProfile(initialData));

            expect(unsubscribe).not.toHaveBeenCalled();

            unmount();

            expect(unsubscribe).toHaveBeenCalled();
        });
    });

    describe('current user sync from UserStore', () => {
        it('uses UserStore data for current user', () => {
            mockedUseUserStore.mockImplementation((selector: any) => {
                const state = {
                    userId: 'current-user-123',
                    currentUser: {
                        id: 'current-user-123',
                        displayName: 'Store Display Name',
                        profilePhotoUrl: 'https://example.com/store-avatar.jpg',
                    },
                };
                return selector(state);
            });

            const initialData = {
                userId: 'current-user-123',
                displayName: 'Initial Name',
                profilePhotoUrl: undefined as string | undefined,
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            // Should use UserStore data since this is the current user
            expect(result.current.displayName).toBe('Store Display Name');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/store-avatar.jpg');
        });

        it('does not use UserStore data for other users', () => {
            mockedUseUserStore.mockImplementation((selector: any) => {
                const state = {
                    userId: 'current-user-123',
                    currentUser: {
                        id: 'current-user-123',
                        displayName: 'Store Display Name',
                        profilePhotoUrl: 'https://example.com/store-avatar.jpg',
                    },
                };
                return selector(state);
            });

            const initialData = {
                userId: 'different-user-456', // Not the current user
                displayName: 'Other User',
                profilePhotoUrl: 'https://example.com/other-avatar.jpg',
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            // Should keep initial data, not use UserStore
            expect(result.current.displayName).toBe('Other User');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/other-avatar.jpg');
        });
    });

    describe('edge cases', () => {
        it('handles null profilePhotoUrl correctly', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Test User',
                profilePhotoUrl: 'https://example.com/avatar.jpg',
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            // Remove avatar (set to undefined)
            rerender({
                data: {
                    ...initialData,
                    profilePhotoUrl: undefined,
                },
            });

            expect(result.current.profilePhotoUrl).toBeUndefined();
        });

        it('handles empty string displayName', () => {
            const initialData = {
                userId: 'user-123',
                displayName: '',
                profilePhotoUrl: undefined,
            };

            const { result } = renderHook(() => useRealtimeProfile(initialData));

            expect(result.current.displayName).toBe('');
        });

        it('handles rapid prop changes', () => {
            const initialData = {
                userId: 'user-123',
                displayName: 'Name 1',
                profilePhotoUrl: 'https://example.com/1.jpg',
            };

            const { result, rerender } = renderHook(
                ({ data }) => useRealtimeProfile(data),
                { initialProps: { data: initialData } }
            );

            // Rapid updates
            for (let i = 2; i <= 5; i++) {
                rerender({
                    data: {
                        userId: 'user-123',
                        displayName: `Name ${i}`,
                        profilePhotoUrl: `https://example.com/${i}.jpg`,
                    },
                });
            }

            // Should have the last value
            expect(result.current.displayName).toBe('Name 5');
            expect(result.current.profilePhotoUrl).toBe('https://example.com/5.jpg');
        });
    });
});
