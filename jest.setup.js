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
jest.mock('lucide-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    const createMockIcon = (name) => {
        const MockIcon = (props) => React.createElement(View, { testID: `icon-${name}`, ...props });
        MockIcon.displayName = name;
        return MockIcon;
    };

    return new Proxy({}, {
        get: (_, iconName) => createMockIcon(iconName),
    });
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
