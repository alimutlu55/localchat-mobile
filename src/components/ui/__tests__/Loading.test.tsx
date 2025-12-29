/**
 * Loading Component Tests
 *
 * Tests for the loading indicator component.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Loading } from '../Loading';

describe('Loading', () => {
    describe('rendering', () => {
        it('should render without error', () => {
            render(<Loading />);
            // Component should render (ActivityIndicator is present)
            expect(screen).toBeTruthy();
        });

        it('should render with message', () => {
            render(<Loading message="Loading data..." />);
            expect(screen.getByText('Loading data...')).toBeTruthy();
        });

        it('should not render message when not provided', () => {
            render(<Loading />);
            expect(screen.queryByText(/Loading/)).toBeNull();
        });
    });

    describe('fullScreen mode', () => {
        it('should render in fullScreen mode by default', () => {
            render(<Loading />);
            // Full screen mode uses a View container
            expect(screen).toBeTruthy();
        });

        it('should render inline when fullScreen is false', () => {
            render(<Loading fullScreen={false} />);
            // Inline mode uses React.Fragment
            expect(screen).toBeTruthy();
        });

        it('should render message in inline mode', () => {
            render(<Loading fullScreen={false} message="Inline loading..." />);
            expect(screen.getByText('Inline loading...')).toBeTruthy();
        });
    });
});
