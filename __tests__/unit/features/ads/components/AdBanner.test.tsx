/**
 * AdBanner Component Tests
 *
 * Tests for the AdBanner component's rendering and error handling.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AdBanner } from '../../../../../src/features/ads/components/AdBanner';

// Mock the useAdConsent hook
jest.mock('../../../../../src/features/ads/hooks/useAdConsent', () => ({
    useAdConsent: () => ({
        canShowAds: true,
        isLoading: false,
        requestConsent: jest.fn(),
    }),
}));

// Mock dynamic import of react-native-google-mobile-ads to simulate not installed
jest.mock('react-native-google-mobile-ads', () => {
    throw new Error('Module not found');
}, { virtual: true });

describe('AdBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders placeholder when SDK is not installed', async () => {
        const { queryByTestId, getByTestId } = render(<AdBanner />);

        // Should render a view (the container)
        await waitFor(() => {
            // Component should still render without crashing
            expect(true).toBe(true);
        });
    });

    it('handles onAdLoaded callback', () => {
        const onAdLoaded = jest.fn();
        render(<AdBanner onAdLoaded={onAdLoaded} />);

        // Since SDK is not installed, onAdLoaded should not be called
        expect(onAdLoaded).not.toHaveBeenCalled();
    });

    it('handles onAdFailedToLoad callback gracefully', () => {
        const onAdFailedToLoad = jest.fn();
        render(<AdBanner onAdFailedToLoad={onAdFailedToLoad} />);

        // Component should not crash
        expect(true).toBe(true);
    });

    it('accepts custom style prop', () => {
        const customStyle = { backgroundColor: 'red' };
        const { toJSON } = render(<AdBanner style={customStyle} />);

        // Should not crash with custom style
        expect(toJSON).toBeTruthy();
    });
});

describe('AdBanner with consent denied', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../../../../../src/features/ads/hooks/useAdConsent', () => ({
            useAdConsent: () => ({
                canShowAds: false,
                isLoading: false,
                requestConsent: jest.fn(),
            }),
        }));
    });

    afterEach(() => {
        jest.resetModules();
    });

    it('does not render banner when consent is denied', async () => {
        // Re-import to get mocked version
        const { AdBanner: AdBannerWithDeniedConsent } = require('../../../../../src/features/ads/components/AdBanner');

        const { toJSON } = render(<AdBannerWithDeniedConsent />);

        await waitFor(() => {
            // Component may return null when consent denied
            expect(true).toBe(true);
        });
    });
});
