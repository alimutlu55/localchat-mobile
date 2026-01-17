import { renderHook, waitFor } from '@testing-library/react-native';
import { useMembership } from '../useMembership';
import { useUserStore } from '../../store/UserStore';
import { subscriptionApi } from '../../../../services/subscriptionApi';
import { revenueCatService } from '../../../../services/revenueCat';
import { DEFAULT_FREE_LIMITS, DEFAULT_PRO_LIMITS } from '../../../../types/subscription';

// Mock dependencies
jest.mock('../../store/UserStore');
jest.mock('../../../../services/subscriptionApi');
jest.mock('../../../../services/revenueCat');

describe('useMembership', () => {
    const mockSetIsPro = jest.fn();
    const mockSetLimits = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementation for useUserStore
        (useUserStore as any).mockImplementation((selector: any) => selector({
            isPro: false,
            setIsPro: mockSetIsPro,
            subscriptionLimits: DEFAULT_FREE_LIMITS,
            setSubscriptionLimits: mockSetLimits,
            currentUser: { id: 'user-1', isAnonymous: false },
        }));
    });

    it('should correctly report free tier status', () => {
        const { result } = renderHook(() => useMembership());

        expect(result.current.isPro).toBe(false);
        expect(result.current.tier).toBe('free');
        expect(result.current.entitlements.NO_ADS).toBe(false);
    });

    it('should correctly report pro tier status', () => {
        (useUserStore as any).mockImplementation((selector: any) => selector({
            isPro: true,
            setIsPro: mockSetIsPro,
            subscriptionLimits: DEFAULT_PRO_LIMITS,
            setSubscriptionLimits: mockSetLimits,
            currentUser: { id: 'user-1', isAnonymous: false },
        }));

        const { result } = renderHook(() => useMembership());

        expect(result.current.isPro).toBe(true);
        expect(result.current.tier).toBe('pro');
        expect(result.current.entitlements.NO_ADS).toBe(true);
        expect(result.current.entitlements.UNLIMITED_PARTICIPANTS).toBe(true);
    });

    it('SECURITY: should force free tier for anonymous users even if store says Pro', () => {
        (useUserStore as any).mockImplementation((selector: any) => selector({
            isPro: true,
            setIsPro: mockSetIsPro,
            subscriptionLimits: DEFAULT_PRO_LIMITS,
            setSubscriptionLimits: mockSetLimits,
            currentUser: { id: 'anon-1', isAnonymous: true },
        }));

        const { result } = renderHook(() => useMembership());

        expect(result.current.isPro).toBe(false);
        expect(result.current.tier).toBe(DEFAULT_FREE_LIMITS.tierName);
        expect(result.current.entitlements.NO_ADS).toBe(false);
    });

    it('should check specific tiers correctly', () => {
        const { result } = renderHook(() => useMembership());
        expect(result.current.isTier('free')).toBe(true);
        expect(result.current.isTier('pro')).toBe(false);
    });

    it('should handle manual refresh', async () => {
        const mockManifest = { ...DEFAULT_PRO_LIMITS, tierName: 'pro' };
        (subscriptionApi.getStatus as jest.Mock).mockResolvedValue({
            isPro: true,
            manifest: mockManifest,
        });

        const { result } = renderHook(() => useMembership());

        await result.current.refreshMembershipStatus();

        expect(subscriptionApi.getStatus).toHaveBeenCalledWith(true);
        expect(mockSetIsPro).toHaveBeenCalledWith(true);
        expect(mockSetLimits).toHaveBeenCalledWith(mockManifest);
    });

    it('should maintain Pro status if backend says Free but RevenueCat says Pro during refresh', async () => {
        // Current state is Pro
        (useUserStore as any).mockImplementation((selector: any) => selector({
            isPro: true,
            setIsPro: mockSetIsPro,
            subscriptionLimits: DEFAULT_PRO_LIMITS,
            setSubscriptionLimits: mockSetLimits,
            currentUser: { id: 'user-1', isAnonymous: false },
        }));

        // Backend says Free
        (subscriptionApi.getStatus as jest.Mock).mockResolvedValue({
            isPro: false,
            manifest: DEFAULT_FREE_LIMITS,
        });

        // RevenueCat still says Pro
        (revenueCatService.getCustomerInfo as jest.Mock).mockResolvedValue({ entitlements: { active: { 'BubbleUp Pro': {} } } });
        (revenueCatService.isPro as jest.Mock).mockReturnValue(true);

        const { result } = renderHook(() => useMembership());

        await result.current.refreshMembershipStatus();

        // setIsPro should NOT have been called with false
        expect(mockSetIsPro).not.toHaveBeenCalledWith(false);
    });
});
