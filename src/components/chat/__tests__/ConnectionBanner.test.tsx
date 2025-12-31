/**
 * ConnectionBanner Component Tests
 *
 * Tests for the self-contained connection status banner.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { ConnectionBanner } from '../ConnectionBanner';
import { useNetworkStore } from '../../../core/network';
import { wsService } from '../../../services/websocket';

// Mock wsService
jest.mock('../../../services/websocket', () => ({
    wsService: {
        manualReconnect: jest.fn(),
    },
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
    WifiOff: () => null,
    RefreshCw: () => null,
}));

describe('ConnectionBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Reset NetworkStore to default connected state
        useNetworkStore.setState({
            wsState: 'connected',
            isOnline: true,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Visibility', () => {
        it('should not render when connected', () => {
            useNetworkStore.setState({ wsState: 'connected', isOnline: true });

            const { root } = render(<ConnectionBanner />);

            // Banner should return null or have 0 height when connected
            // Due to animation, we check that it doesn't show content
            expect(screen.queryByText('Reconnecting...')).toBeNull();
        });

        it('should render when wsState is disconnected', () => {
            useNetworkStore.setState({ wsState: 'disconnected', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.getByText('Reconnecting...')).toBeTruthy();
        });

        it('should render when wsState is reconnecting', () => {
            useNetworkStore.setState({ wsState: 'reconnecting', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.getByText('Reconnecting...')).toBeTruthy();
        });

        it('should render when wsState is connecting', () => {
            useNetworkStore.setState({ wsState: 'connecting', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.getByText('Reconnecting...')).toBeTruthy();
        });

        it('should render when offline regardless of wsState', () => {
            useNetworkStore.setState({ wsState: 'connected', isOnline: false });

            render(<ConnectionBanner />);

            expect(screen.getByText('Reconnecting...')).toBeTruthy();
        });
    });

    describe('Retry Button', () => {
        it('should show Retry button only when state is disconnected', () => {
            useNetworkStore.setState({ wsState: 'disconnected', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.getByText('Retry')).toBeTruthy();
        });

        it('should NOT show Retry button when reconnecting', () => {
            useNetworkStore.setState({ wsState: 'reconnecting', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.queryByText('Retry')).toBeNull();
        });

        it('should NOT show Retry button when connecting', () => {
            useNetworkStore.setState({ wsState: 'connecting', isOnline: true });

            render(<ConnectionBanner />);

            expect(screen.queryByText('Retry')).toBeNull();
        });

        it('should NOT show Retry button when offline (even if underlying state would be disconnected)', () => {
            useNetworkStore.setState({ wsState: 'disconnected', isOnline: false });

            render(<ConnectionBanner />);

            // When offline, we show 'reconnecting' state (no retry button)
            expect(screen.queryByText('Retry')).toBeNull();
        });
    });

    describe('Retry Button Interaction', () => {
        it('should call wsService.manualReconnect when Retry button is pressed', () => {
            useNetworkStore.setState({ wsState: 'disconnected', isOnline: true });

            render(<ConnectionBanner />);

            const retryButton = screen.getByText('Retry');
            fireEvent.press(retryButton);

            expect(wsService.manualReconnect).toHaveBeenCalledTimes(1);
        });

        it('should log when retry is triggered', () => {
            const consoleSpy = jest.spyOn(console, 'log');
            useNetworkStore.setState({ wsState: 'disconnected', isOnline: true });

            render(<ConnectionBanner />);

            const retryButton = screen.getByText('Retry');
            fireEvent.press(retryButton);

            expect(consoleSpy).toHaveBeenCalledWith('[ConnectionBanner] Manual retry triggered');
            consoleSpy.mockRestore();
        });
    });

    describe('State Priority', () => {
        it('should prioritize isOnline=false over wsState', () => {
            // Even if wsState is 'connected', offline should show banner
            useNetworkStore.setState({ wsState: 'connected', isOnline: false });

            render(<ConnectionBanner />);

            // Banner should be visible (no Retry button because offline → reconnecting)
            expect(screen.getByText('Reconnecting...')).toBeTruthy();
            expect(screen.queryByText('Retry')).toBeNull();
        });
    });

    describe('Message Display', () => {
        it('should always display "Reconnecting..." message', () => {
            const states: Array<'disconnected' | 'connecting' | 'reconnecting'> = [
                'disconnected',
                'connecting',
                'reconnecting',
            ];

            states.forEach((wsState) => {
                useNetworkStore.setState({ wsState, isOnline: true });
                const { unmount } = render(<ConnectionBanner />);

                expect(screen.getByText('Reconnecting...')).toBeTruthy();

                unmount();
            });
        });
    });
});

describe('ConnectionBanner State Transitions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useNetworkStore.setState({
            wsState: 'connected',
            isOnline: true,
        });
    });

    it('should react to NetworkStore state changes', async () => {
        const { rerender } = render(<ConnectionBanner />);

        // Initially connected - no banner content
        expect(screen.queryByText('Reconnecting...')).toBeNull();

        // Update store to disconnected
        useNetworkStore.setState({ wsState: 'disconnected' });
        rerender(<ConnectionBanner />);

        // Banner should now show
        expect(screen.getByText('Reconnecting...')).toBeTruthy();
    });

    it('should hide when transitioning from disconnected to connected', async () => {
        // Start disconnected
        useNetworkStore.setState({ wsState: 'disconnected', isOnline: true });
        const { rerender } = render(<ConnectionBanner />);

        expect(screen.getByText('Reconnecting...')).toBeTruthy();

        // Transition to connected
        useNetworkStore.setState({ wsState: 'connected' });
        rerender(<ConnectionBanner />);

        // Animation starts - content should eventually hide
        // For unit test, we verify the component returns null when connected
        expect(screen.queryByText('Reconnecting...')).toBeNull();
    });
});
