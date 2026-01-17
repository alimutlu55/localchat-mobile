/**
 * Jest Setup File
 * 
 * Global mocks and configuration for React Native testing with Expo.
 */

// Mock expo-notifications before anything else
jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-token' })),
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    dismissNotificationAsync: jest.fn(),
    AndroidImportance: {
        DEFAULT: 3,
        HIGH: 4,
        LOW: 2,
        MAX: 5,
        MIN: 1,
        NONE: 0,
    },
}));

// Mock lucide-react-native icons
// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    const createMockIcon = (name) => {
        const MockIcon = (props) => React.createElement(View, { testID: `icon-${name}`, ...props });
        MockIcon.displayName = name;
        return MockIcon;
    };

    // Use a proxy to handle any icon name import
    const text = new Proxy(
        { __esModule: true },
        {
            get: (target, prop) => {
                if (prop === '__esModule') return true;
                if (prop === 'default') return target;
                if (typeof prop === 'string') {
                    return createMockIcon(prop);
                }
                return Reflect.get(target, prop);
            },
        }
    );

    return text;
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({
        coords: { latitude: 0, longitude: 0, accuracy: 10 },
    })),
    watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
    Accuracy: {
        Lowest: 1,
        Low: 2,
        Balanced: 3,
        High: 4,
        Highest: 5,
        BestForNavigation: 6,
    },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(() => Promise.resolve(null)),
    setItemAsync: jest.fn(() => Promise.resolve()),
    deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(),
    fetch: jest.fn().mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
    }),
    useNetInfo: jest.fn().mockReturnValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
    }),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

// Mock React Native Image.prefetch for avatar caching tests
// Using direct modification since jest-expo has complex react-native mocking
const RNImage = require('react-native').Image;
if (RNImage) {
    RNImage.prefetch = jest.fn(() => Promise.resolve(true));
    RNImage.getSize = jest.fn((_, success) => success?.(100, 100));
    RNImage.queryCache = jest.fn(() => Promise.resolve({}));
}

// Global test utilities
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

// Mock requestAnimationFrame for React Native Animated - make it asynchronous to avoid recursion issues
global.requestAnimationFrame = (callback) => {
    // Use setTimeout to make it asynchronous, preventing synchronous stack overflows
    return setTimeout(() => callback(Date.now()), 0);
};
global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

// Suppress React Native warning about act() for async updates
global.IS_REACT_ACT_ENVIRONMENT = true;

// Clean up any pending timers after each test to prevent worker exit issues
afterEach(() => {
    jest.clearAllTimers();
});

// Ensure all timers are cleaned up after all tests
afterAll(() => {
    jest.useRealTimers();
});

// Mock react-native-purchases
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
        getOfferings: jest.fn(),
    },
    LOG_LEVEL: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        VERBOSE: 4,
    },
}));

// Mock react-native-purchases-ui
jest.mock('react-native-purchases-ui', () => ({
    __esModule: true,
    default: {
        presentPaywall: jest.fn(),
        presentCustomerCenter: jest.fn(),
    },
    PAYWALL_RESULT: {
        NOT_PRESENTED: 'NOT_PRESENTED',
        ERROR: 'ERROR',
        CANCELLED: 'CANCELLED',
        PURCHASED: 'PURCHASED',
        RESTORED: 'RESTORED',
    },
}));

// Mock EventEmitter for NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    const { EventEmitter } = require('events');
    return EventEmitter;
});

// Mock expo-constants
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: {
            version: '1.0.0',
            extra: {
                eas: {
                    projectId: 'mock-project-id',
                },
            },
        },
    },
}));

// Mock Keyboard
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    dismiss: jest.fn(),
    isVisible: jest.fn().mockReturnValue(false),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
    openBrowserAsync: jest.fn().mockResolvedValue({ type: 'opened' }),
    WebBrowserPresentationStyle: {
        PAGE_SHEET: 'pageSheet',
    },
}));

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => ({
    BannerAd: jest.fn(({ unitId, size, requestOptions, onAdLoaded, onAdFailedToLoad }) => {
        // Simulate ad loading behavior if needed, or just render a View
        const React = require('react');
        const { View } = require('react-native');
        return React.createElement(View, { testID: 'mock-banner-ad', unitId, size });
    }),
    BannerAdSize: {
        ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
        FULL_BANNER: 'FULL_BANNER',
    },
    TestIds: {
        BANNER: 'ca-app-pub-3940256099942544/6300978111',
    },
    useForeground: jest.fn(),
    AdEventType: {
        LOADED: 'LOADED',
        ERROR: 'ERROR',
    },
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
    return {
        NavigationContainer: ({ children }) => children,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            dispatch: jest.fn(),
        }),
        useRoute: () => ({ params: {} }),
        createNavigationContainerRef: jest.fn(),
    };
});

// Mock @maplibre/maplibre-react-native
jest.mock('@maplibre/maplibre-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    return {
        MapView: (props) => React.createElement(View, { testID: 'map-view', ...props }, props.children),
        Camera: (props) => React.createElement(View, { testID: 'map-camera', ...props }),
        ShapeSource: (props) => React.createElement(View, { testID: 'shape-source', ...props }, props.children),
        CircleLayer: (props) => React.createElement(View, { testID: 'circle-layer', ...props }),
        FillLayer: (props) => React.createElement(View, { testID: 'fill-layer', ...props }),
        LineLayer: (props) => React.createElement(View, { testID: 'line-layer', ...props }),
        SymbolLayer: (props) => React.createElement(View, { testID: 'symbol-layer', ...props }),
        Images: (props) => React.createElement(View, { testID: 'images', ...props }),
        ImageSource: ({ children }) => React.createElement(View, { testID: 'image-source' }, children),
        VectorSource: (props) => React.createElement(View, { testID: 'vector-source', ...props }),
        PointAnnotation: ({ children, ...props }) => React.createElement(View, { testID: 'point-annotation', ...props }, children),
        Callout: ({ children }) => React.createElement(View, { testID: 'callout' }, children),
        UserLocation: () => null,
        setAccessToken: jest.fn(),
        LocationPuck: () => null,
        StyleURL: {
            Street: 'mapbox://styles/mapbox/streets-v11',
            Dark: 'mapbox://styles/mapbox/dark-v10',
            Light: 'mapbox://styles/mapbox/light-v10',
        },
    };
});

// Mock supercluster
jest.mock('supercluster', () => {
    return class MockSupercluster {
        load() { }
        getClusters() { return []; }
        getLeaves() { return []; }
        getTile() { return null; }
        getClusterExpansionZoom() { return 0; }
    };
});

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
    const React = require('react');
    const { View } = require('react-native');
    const BottomSheet = React.forwardRef(({ children, ...props }, ref) => {
        return React.createElement(View, { testID: 'bottom-sheet', ...props }, children);
    });
    return {
        __esModule: true,
        default: BottomSheet,
        BottomSheetScrollView: React.forwardRef(({ children, ...props }, ref) => {
            return React.createElement(View, { testID: 'bottom-sheet-scroll-view', ...props }, children);
        }),
        BottomSheetView: React.forwardRef(({ children, ...props }, ref) => {
            return React.createElement(View, { testID: 'bottom-sheet-view', ...props }, children);
        }),
        useBottomSheetModal: () => ({
            present: jest.fn(),
            dismiss: jest.fn(),
        }),
        BottomSheetModal: React.forwardRef(({ children, ...props }, ref) => {
            return React.createElement(View, { testID: 'bottom-sheet-modal', ...props }, children);
        }),
        BottomSheetModalProvider: ({ children }) => children,
        useBottomSheet: () => ({
            expand: jest.fn(),
            collapse: jest.fn(),
            snapToIndex: jest.fn(),
            close: jest.fn(),
        }),
    };
});
