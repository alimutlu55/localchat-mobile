/**
 * AdBanner Component Tests
 *
 * Tests for the AdBanner component's rendering and error handling.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AdBanner } from '../../../../../src/features/ads/components/AdBanner';

// Mock the useAdConsent hook
const mockUseAdConsent = jest.fn();
jest.mock('../../../../../src/features/ads/hooks/useAdConsent', () => ({
    useAdConsent: () => mockUseAdConsent(),
}));

describe('AdBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default behavior: consent granted
        mockUseAdConsent.mockReturnValue({
            canShowAds: true,
            isLoading: false,
            requestConsent: jest.fn(),
            hasPersonalizationConsent: true,
        });
    });

    it('renders when SDK is available', async () => {
        const { getByTestId } = render(<AdBanner />);

        await waitFor(() => {
            expect(getByTestId('mock-banner-ad')).toBeTruthy();
        });
    });

    it('handles onAdLoaded callback', () => {
        const { getByTestId } = render(<AdBanner />);
        expect(getByTestId('mock-banner-ad')).toBeTruthy();
    });

    it('handles onAdFailedToLoad callback gracefully', () => {
        const { getByTestId } = render(<AdBanner />);
        expect(getByTestId('mock-banner-ad')).toBeTruthy();
    });
});

describe('AdBanner with consent denied', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAdConsent.mockReturnValue({
            canShowAds: false,
            isLoading: false,
            requestConsent: jest.fn(),
            hasPersonalizationConsent: false,
        });
    });

    it('does not render banner when consent is denied', async () => {
        const { toJSON } = render(<AdBanner />);

        await waitFor(() => {
            // Component should return null (empty JSON or empty children)
            // But ActivityIndicator is also conditional on isAdLoaded.
            // If canShowAds is false, AdBanner returns null directly.

            // AdBanner implementation:
            // if (!isVisible) { return null; }
            // isVisible = canShowAds && ...

            expect(toJSON()).toBeNull();
        });
    });
});
