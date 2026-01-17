import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConnectionBanner } from '../../../src/components/chat/ConnectionBanner';
import { useNetworkStatus } from '../../../src/core/network';
import { useAuth } from '../../../src/features/auth';
import { wsService } from '../../../src/services/websocket';

// Mock dependencies
jest.mock('../../../src/core/network', () => ({
    useNetworkStatus: jest.fn(),
}));

jest.mock('../../../src/features/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../../src/services/websocket', () => ({
    wsService: {
        manualReconnect: jest.fn(),
    },
}));

import { Animated } from 'react-native';

describe('ConnectionBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock animations to prevent "remove is not a function" errors
        jest.spyOn(Animated, 'timing').mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        } as any);
        jest.spyOn(Animated, 'spring').mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        } as any);
        jest.spyOn(Animated, 'parallel').mockReturnValue({
            start: jest.fn(),
            stop: jest.fn(),
        } as any);
    });

    const setup = (
        wsState: 'connected' | 'connecting' | 'disconnected' | 'reconnecting',
        isOnline: boolean = true,
        authStatus: string = 'authenticated'
    ) => {
        (useNetworkStatus as jest.Mock).mockReturnValue({
            wsState,
            isOnline,
        });
        (useAuth as jest.Mock).mockReturnValue({
            status: authStatus,
        });
        return render(<ConnectionBanner />);
    };

    it('renders nothing when connected', () => {
        const { toJSON } = setup('connected');
        expect(toJSON()).toBeNull();
    });

    it('renders nothing when user is guest', () => {
        const { toJSON } = setup('disconnected', true, 'guest');
        expect(toJSON()).toBeNull();
    });

    it('renders nothing when transitioning (loggingOut)', () => {
        const { toJSON } = setup('disconnected', true, 'loggingOut');
        expect(toJSON()).toBeNull();
    });

    it('renders reconnecting state when wsState is connecting', () => {
        const { getByText } = setup('connecting');
        expect(getByText('Reconnecting...')).toBeTruthy();
    });

    it('renders reconnecting state when wsState is reconnecting', () => {
        const { getByText } = setup('reconnecting');
        expect(getByText('Reconnecting...')).toBeTruthy();
    });

    it('renders disconnected state with Retry button when wsState is disconnected', () => {
        const { getByText } = setup('disconnected');
        expect(getByText('Reconnecting...')).toBeTruthy(); // Message is always Reconnecting...
        expect(getByText('Retry')).toBeTruthy();
    });

    it('calls manualReconnect when Retry button is pressed', () => {
        const { getByText } = setup('disconnected');
        const retryButton = getByText('Retry');

        fireEvent.press(retryButton);
        expect(wsService.manualReconnect).toHaveBeenCalledTimes(1);
    });

    it('treats offline as reconnecting state even if wsState is connected (edge case)', () => {
        // If isOnline is false, it forces 'reconnecting' state
        const { getByText } = setup('connected', false);
        expect(getByText('Reconnecting...')).toBeTruthy();
    });
});
