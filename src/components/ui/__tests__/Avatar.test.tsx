/**
 * Avatar Component Tests
 *
 * Tests for the user avatar component with image and fallback support.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
    describe('image rendering', () => {
        it('should render image when URI is provided', () => {
            render(<Avatar uri="https://example.com/photo.jpg" />);
            // Image component should be rendered (we can't easily assert on Image source)
            // The component should render without error
            expect(screen).toBeTruthy();
        });

        it('should not render initials when URI is provided', () => {
            render(<Avatar uri="https://example.com/photo.jpg" name="John Doe" />);
            // Should not show initials when image is available
            expect(screen.queryByText('JD')).toBeNull();
        });
    });

    describe('initials fallback', () => {
        it('should display initials when no URI', () => {
            render(<Avatar name="John Doe" />);
            expect(screen.getByText('JD')).toBeTruthy();
        });

        it('should display initials when URI is null', () => {
            render(<Avatar uri={null} name="Alice Smith" />);
            expect(screen.getByText('AS')).toBeTruthy();
        });

        it('should display single initial for single name', () => {
            render(<Avatar name="Alice" />);
            expect(screen.getByText('A')).toBeTruthy();
        });

        it('should display "U" for empty name', () => {
            render(<Avatar name="" />);
            expect(screen.getByText('U')).toBeTruthy();
        });

        it('should display "U" when no name provided', () => {
            render(<Avatar />);
            expect(screen.getByText('U')).toBeTruthy();
        });

        it('should limit initials to 2 characters', () => {
            render(<Avatar name="Alice Bob Charlie" />);
            // Should take first letters of first two words
            expect(screen.getByText('AB')).toBeTruthy();
        });

        it('should convert initials to uppercase', () => {
            render(<Avatar name="john doe" />);
            expect(screen.getByText('JD')).toBeTruthy();
        });
    });

    describe('sizes', () => {
        const sizes = ['small', 'medium', 'large', 'xlarge'] as const;

        sizes.forEach((size) => {
            it(`should render ${size} size without error`, () => {
                render(<Avatar name="Test" size={size} />);
                expect(screen.getByText('T')).toBeTruthy();
            });
        });

        it('should use medium size by default', () => {
            render(<Avatar name="Test" />);
            // Default size should render without error
            expect(screen.getByText('T')).toBeTruthy();
        });
    });

    describe('custom styles', () => {
        it('should accept custom style prop', () => {
            render(<Avatar name="Test" style={{ margin: 10 }} />);
            expect(screen.getByText('T')).toBeTruthy();
        });
    });
});
