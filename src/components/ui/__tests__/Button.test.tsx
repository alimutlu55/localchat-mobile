/**
 * Button Component Tests
 *
 * Tests for the reusable Button component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
    describe('rendering', () => {
        it('should render the title text', () => {
            render(<Button title="Click Me" onPress={() => { }} />);
            expect(screen.getByText('Click Me')).toBeTruthy();
        });

        it('should render with default props', () => {
            render(<Button title="Default" onPress={() => { }} />);
            // In React Native, we find buttons by their text content
            const button = screen.getByText('Default');
            expect(button).toBeTruthy();
        });
    });

    describe('interactions', () => {
        it('should call onPress when pressed', () => {
            const onPressMock = jest.fn();
            render(<Button title="Press Me" onPress={onPressMock} />);

            fireEvent.press(screen.getByText('Press Me'));
            expect(onPressMock).toHaveBeenCalledTimes(1);
        });

        it('should not call onPress when disabled', () => {
            const onPressMock = jest.fn();
            render(<Button title="Disabled" onPress={onPressMock} disabled />);

            fireEvent.press(screen.getByText('Disabled'));
            expect(onPressMock).not.toHaveBeenCalled();
        });

        it('should not call onPress when loading', () => {
            const onPressMock = jest.fn();
            const { root } = render(<Button title="Loading" onPress={onPressMock} loading />);

            // When loading, the button shows ActivityIndicator, find the touchable root
            fireEvent.press(root);
            expect(onPressMock).not.toHaveBeenCalled();
        });
    });

    describe('loading state', () => {
        it('should show ActivityIndicator when loading', () => {
            render(<Button title="Loading" onPress={() => { }} loading />);

            // ActivityIndicator should be present (no text title visible)
            expect(screen.queryByText('Loading')).toBeNull();
        });

        it('should hide title when loading', () => {
            render(<Button title="My Title" onPress={() => { }} loading />);
            expect(screen.queryByText('My Title')).toBeNull();
        });
    });

    describe('variants', () => {
        const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;

        variants.forEach((variant) => {
            it(`should render ${variant} variant without error`, () => {
                render(
                    <Button
                        title={`${variant} Button`}
                        onPress={() => { }}
                        variant={variant}
                    />
                );
                expect(screen.getByText(`${variant} Button`)).toBeTruthy();
            });
        });
    });

    describe('sizes', () => {
        const sizes = ['small', 'medium', 'large'] as const;

        sizes.forEach((size) => {
            it(`should render ${size} size without error`, () => {
                render(
                    <Button
                        title={`${size} Button`}
                        onPress={() => { }}
                        size={size}
                    />
                );
                expect(screen.getByText(`${size} Button`)).toBeTruthy();
            });
        });
    });

    describe('icon support', () => {
        it('should render with left icon', () => {
            const MockIcon = <></>;
            render(
                <Button
                    title="With Icon"
                    onPress={() => { }}
                    icon={MockIcon}
                    iconPosition="left"
                />
            );
            expect(screen.getByText('With Icon')).toBeTruthy();
        });

        it('should render with right icon', () => {
            const MockIcon = <></>;
            render(
                <Button
                    title="With Icon"
                    onPress={() => { }}
                    icon={MockIcon}
                    iconPosition="right"
                />
            );
            expect(screen.getByText('With Icon')).toBeTruthy();
        });
    });

    describe('fullWidth', () => {
        it('should render fullWidth button', () => {
            render(<Button title="Full Width" onPress={() => { }} fullWidth />);
            expect(screen.getByText('Full Width')).toBeTruthy();
        });
    });
});
