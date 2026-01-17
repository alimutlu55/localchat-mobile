import { useUserStore } from '../UserStore';
import { DEFAULT_FREE_LIMITS } from '../../../../types/subscription';
import { User } from '../../../../types';

describe('UserStore', () => {
    beforeEach(() => {
        useUserStore.getState().reset();
    });

    it('should have correct initial state', () => {
        const state = useUserStore.getState();
        expect(state.currentUser).toBeNull();
        expect(state.userId).toBeNull();
        expect(state.isPro).toBe(false);
        expect(state.subscriptionLimits).toEqual(DEFAULT_FREE_LIMITS);
    });

    it('should set and clear user correctly', () => {
        const mockUser: User = {
            id: 'user-123',
            displayName: 'Test User',
            profilePhotoUrl: 'https://example.com/photo.jpg',
            isAnonymous: false,
        } as User;

        useUserStore.getState().setUser(mockUser);

        let state = useUserStore.getState();
        expect(state.currentUser).toEqual(mockUser);
        expect(state.userId).toBe('user-123');

        useUserStore.getState().clearUser();

        state = useUserStore.getState();
        expect(state.currentUser).toBeNull();
        expect(state.userId).toBeNull();
        expect(state.isPro).toBe(false);
        expect(state.subscriptionLimits).toEqual(DEFAULT_FREE_LIMITS);
    });

    it('should update isPro status', () => {
        useUserStore.getState().setIsPro(true);
        expect(useUserStore.getState().isPro).toBe(true);

        useUserStore.getState().setIsPro(false);
        expect(useUserStore.getState().isPro).toBe(false);
    });

    it('should update subscription limits', () => {
        const customLimits = {
            tierName: 'pro',
            dailyRoomLimit: 20,
            maxRoomDurationHours: 168,
            maxParticipants: 1000,
            showAds: false,
        };

        useUserStore.getState().setSubscriptionLimits(customLimits);
        expect(useUserStore.getState().subscriptionLimits).toEqual(customLimits);
    });

    it('should handle optimistic user updates', () => {
        const mockUser: User = {
            id: 'user-123',
            displayName: 'Initial Name',
            isAnonymous: false,
        } as User;

        useUserStore.getState().setUser(mockUser);
        useUserStore.getState().updateUser({ displayName: 'Updated Name' });

        expect(useUserStore.getState().currentUser?.displayName).toBe('Updated Name');
    });
});
