import Purchases from 'react-native-purchases';
import { revenueCatService, ENTITLEMENT_ID } from '../revenueCat';
import { subscriptionApi } from '../subscriptionApi';

// Mock Purchases
jest.mock('react-native-purchases', () => ({
    __esModule: true,
    default: {
        configure: jest.fn(),
        setLogLevel: jest.fn(),
        logIn: jest.fn(),
        logOut: jest.fn(),
        getAppUserID: jest.fn(),
        getCustomerInfo: jest.fn(),
        restorePurchases: jest.fn(),
        purchasePackage: jest.fn(),
    },
    LOG_LEVEL: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        VERBOSE: 4,
    },
}));

// Mock SubscriptionApi
jest.mock('../subscriptionApi', () => ({
    subscriptionApi: {
        syncToBackend: jest.fn(),
    },
}));

// Mock UserStore
jest.mock('../../features/user/store/UserStore', () => ({
    useUserStore: {
        getState: jest.fn(() => ({
            setIsPro: jest.fn(),
            setSubscriptionLimits: jest.fn(),
        })),
    },
}));

describe('RevenueCatService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should configure Purchases only once', async () => {
        await revenueCatService.configure();
        await revenueCatService.configure();

        expect(Purchases.configure).toHaveBeenCalledTimes(1);
    });

    it('should login user and verify identity', async () => {
        const userId = 'user-123';
        const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
        mockPurchases.getAppUserID.mockResolvedValueOnce('old-id').mockResolvedValue('user-123');
        mockPurchases.logIn.mockResolvedValue({ customerInfo: {} as any, created: true });

        await revenueCatService.loginUser(userId);

        expect(mockPurchases.logIn).toHaveBeenCalledWith(userId);
    });

    it('should skip login if already logged in as same user', async () => {
        const userId = 'user-123';
        const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
        mockPurchases.getAppUserID.mockResolvedValue(userId);

        await revenueCatService.loginUser(userId);

        expect(mockPurchases.logIn).not.toHaveBeenCalled();
        expect(mockPurchases.getCustomerInfo).toHaveBeenCalled();
    });

    it('should logout user correctly', async () => {
        const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
        mockPurchases.getAppUserID.mockResolvedValue('user-123');

        await revenueCatService.logoutUser();

        expect(mockPurchases.logOut).toHaveBeenCalled();
    });

    it('should correctly identify Pro status', () => {
        const mockInfo = {
            entitlements: {
                active: {
                    [ENTITLEMENT_ID]: { identifier: ENTITLEMENT_ID }
                }
            }
        };

        expect(revenueCatService.isPro(mockInfo as any)).toBe(true);
        expect(revenueCatService.isPro({ entitlements: { active: {} } } as any)).toBe(false);
    });

    it('should sync with backend after restore', async () => {
        const mockCustomerInfo = { entitlements: { active: {} } };
        const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
        mockPurchases.getAppUserID.mockResolvedValue('user-123');
        mockPurchases.restorePurchases.mockResolvedValue(mockCustomerInfo as any);
        mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

        await revenueCatService.restorePurchases();

        expect(subscriptionApi.syncToBackend).toHaveBeenCalledWith(mockCustomerInfo);
    });
});
