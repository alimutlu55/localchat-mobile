import {
    DEFAULT_FREE_LIMITS
} from '../../types/subscription';
import { subscriptionApi } from '../subscriptionApi';
import { api } from '../api';

// Mock API
jest.mock('../api', () => ({
    api: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

// Mock RevenueCat service
jest.mock('../revenueCat', () => ({
    __esModule: true,
    revenueCatService: {
        getCustomerInfo: jest.fn(),
        ENTITLEMENT_ID: 'BubbleUp Pro',
    },
    ENTITLEMENT_ID: 'BubbleUp Pro',
}));

// Mock react-native-purchases
jest.mock('react-native-purchases', () => {
    const mock = {
        getAppUserID: jest.fn(),
    };
    return {
        __esModule: true,
        default: mock,
        ...mock,
    };
});

describe('SubscriptionApiService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        subscriptionApi.clearCache();
    });

    it('should fetch and cache subscription status', async () => {
        const mockInfo = {
            isPro: true,
            manifest: { ...DEFAULT_FREE_LIMITS, tierName: 'pro' },
        };
        (api.get as jest.Mock).mockResolvedValue(mockInfo);

        const result1 = await subscriptionApi.getStatus();
        const result2 = await subscriptionApi.getStatus();

        expect(api.get).toHaveBeenCalledTimes(1);
        expect(result1).toEqual(mockInfo);
        expect(result2).toEqual(mockInfo);
    });

    it('should force refresh cache when requested', async () => {
        (api.get as jest.Mock).mockResolvedValue({ isPro: false, manifest: DEFAULT_FREE_LIMITS });

        await subscriptionApi.getStatus();
        await subscriptionApi.getStatus(true);

        expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('should debounce concurrent sync requests', async () => {
        // Mock performSync to control its execution
        const mockInfo = { isPro: true, manifest: { tierName: 'pro' } };

        // Use a promise that we can control to simulate a long-running sync
        let resolveSync: (value: any) => void;
        const syncPromise = new Promise((resolve) => {
            resolveSync = resolve;
        });

        const performSyncSpy = jest.spyOn(subscriptionApi as any, 'performSync')
            .mockReturnValue(syncPromise);

        // Trigger two syncs simultaneously
        const p1 = subscriptionApi.syncToBackend({ id: 'mock' });
        const p2 = subscriptionApi.syncToBackend({ id: 'mock' });

        // Should only call performSync once
        expect(performSyncSpy).toHaveBeenCalledTimes(1);

        // Resolve the first one
        resolveSync!(mockInfo);

        const [res1, res2] = await Promise.all([p1, p2]);

        expect(res1).toEqual(mockInfo);
        expect(res2).toEqual(mockInfo);

        performSyncSpy.mockRestore();
    });

    it('should return default free info on API failure and no cache', async () => {
        (api.get as jest.Mock).mockRejectedValue(new Error('API Down'));

        const result = await subscriptionApi.getStatus();

        expect(result.isPro).toBe(false);
        expect(result.manifest).toEqual(DEFAULT_FREE_LIMITS);
    });
});
