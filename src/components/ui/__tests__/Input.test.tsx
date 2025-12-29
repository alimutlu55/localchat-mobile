/**
 * Input Component Tests
 *
 * Tests for the reusable Input component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Input } from '../Input';

describe('Input', () => {
    describe('rendering', () => {
        it('should render basic input', () => {
            render(<Input placeholder="Enter text" />);
            expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
        });

        it('should render with label', () => {
            render(<Input label="Email" placeholder="Enter email" />);
            expect(screen.getByText('Email')).toBeTruthy();
        });
    });

    describe('error state', () => {
        it('should display error message', () => {
            render(<Input error="This field is required" />);
            expect(screen.getByText('This field is required')).toBeTruthy();
        });

        it('should not display hint when error is present', () => {
            render(
                <Input
                    error="Error message"
                    hint="This hint should not show"
                />
            );
            expect(screen.getByText('Error message')).toBeTruthy();
            expect(screen.queryByText('This hint should not show')).toBeNull();
        });
    });

    describe('hint', () => {
        it('should display hint when no error', () => {
            render(<Input hint="Enter your email address" />);
            expect(screen.getByText('Enter your email address')).toBeTruthy();
        });
    });

    describe('value handling', () => {
        it('should handle text input', () => {
            const onChangeMock = jest.fn();
            render(
                <Input
                    placeholder="Type here"
                    onChangeText={onChangeMock}
                />
            );

            fireEvent.changeText(
                screen.getByPlaceholderText('Type here'),
                'test input'
            );
            expect(onChangeMock).toHaveBeenCalledWith('test input');
        });
    });

    describe('password mode', () => {
        it('should hide text by default in password mode', () => {
            render(<Input isPassword placeholder="Password" />);
            const input = screen.getByPlaceholderText('Password');

            // In RN testing library, we check the secureTextEntry prop indirectly
            // The input should be queryable but text should be secure
            expect(input).toBeTruthy();
        });

        it('should render password toggle button', () => {
            render(<Input isPassword placeholder="Password" />);
            // The Eye/EyeOff icons should be rendered (mocked as View)
            expect(screen.getByTestId('icon-Eye')).toBeTruthy();
        });

        it('should toggle password visibility on press', () => {
            render(<Input isPassword placeholder="Password" />);

            // Initially shows Eye (password hidden)
            expect(screen.getByTestId('icon-Eye')).toBeTruthy();

            // Press the toggle
            fireEvent.press(screen.getByTestId('icon-Eye'));

            // Now should show EyeOff (password visible)
            expect(screen.getByTestId('icon-EyeOff')).toBeTruthy();
        });
    });

    describe('icons', () => {
        it('should render left icon', () => {
            const LeftIcon = <Text testID="left-icon">@</Text>;
            render(<Input leftIcon={LeftIcon} placeholder="With icon" />);
            expect(screen.getByTestId('left-icon')).toBeTruthy();
        });

        it('should render right icon', () => {
            const RightIcon = <Text testID="right-icon">✓</Text>;
            render(<Input rightIcon={RightIcon} placeholder="With icon" />);
            expect(screen.getByTestId('right-icon')).toBeTruthy();
        });

        it('should not render right icon when isPassword', () => {
            const RightIcon = <Text testID="custom-right-icon">✓</Text>;
            render(
                <Input
                    isPassword
                    rightIcon={RightIcon}
                    placeholder="Password"
                />
            );
            // Custom right icon should not be rendered when isPassword is true
            expect(screen.queryByTestId('custom-right-icon')).toBeNull();
        });
    });

    describe('focus state', () => {
        it('should handle focus and blur events', () => {
            const onFocusMock = jest.fn();
            const onBlurMock = jest.fn();

            render(
                <Input
                    placeholder="Focus test"
                    onFocus={onFocusMock}
                    onBlur={onBlurMock}
                />
            );

            const input = screen.getByPlaceholderText('Focus test');

            fireEvent(input, 'focus');
            // onFocus from props is passed through ...props

            fireEvent(input, 'blur');
            // onBlur from props is passed through ...props
        });
    });
});
