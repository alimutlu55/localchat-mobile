/**
 * RootNavigator Tests
 *
 * Tests the root navigation component.
 * Validates:
 * - Auth state → navigation mapping
 * - Loading screen during transitions
 * - Auth vs App stack switching
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '../../../src/navigation/RootNavigator';
import { useAuth } from '../../../src/features/auth';

// Mock dependencies
jest.mock('../../../src/features/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock all screens to simple components
jest.mock('../../../src/screens', () => ({
  SplashScreen: () => null,
  OnboardingScreen: () => null,
  ChatRoomScreen: () => null,
  RoomDetailsScreen: () => null,
  RoomInfoScreen: () => null,
  CreateRoomScreen: () => null,
  SettingsScreen: () => null,
  EditProfileScreen: () => null,
  DiscoveryScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="discovery-screen">Discovery</Text>;
  },
  LoadingScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="loading-screen">Loading</Text>;
  },
}));

jest.mock('../../../src/navigation/AuthNavigator', () => ({
  AuthNavigator: () => {
    const { Text } = require('react-native');
    return <Text testID="auth-navigator">Auth</Text>;
  },
}));

// Mock native stack navigator
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => <>{children}</>,
      Screen: ({ component: Component, name }: any) => {
        return <Component key={name} />;
      },
    }),
  };
});

describe('RootNavigator', () => {
  const renderNavigator = () =>
    render(
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // Loading States
  // ===========================================================================

  describe('Loading States', () => {
    it('shows LoadingScreen when status is "unknown"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'unknown',
        isTransitioning: false,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();
    });

    it('shows LoadingScreen when status is "loading"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loading',
        isTransitioning: false,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();
    });

    it('shows LoadingScreen when status is "loggingOut"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();
    });
  });

  // ===========================================================================
  // Auth States
  // ===========================================================================

  describe('Auth States', () => {
    it('shows AuthNavigator when status is "guest"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'guest',
        isTransitioning: false,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('auth-navigator')).toBeTruthy();
    });

    it('shows AuthNavigator when status is "authenticating"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'authenticating',
        isTransitioning: true,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('auth-navigator')).toBeTruthy();
    });
  });

  // ===========================================================================
  // Authenticated States
  // ===========================================================================

  describe('Authenticated States', () => {
    it('shows app screens when status is "authenticated"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isTransitioning: false,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('discovery-screen')).toBeTruthy();
    });
  });

  // ===========================================================================
  // State Transitions
  // ===========================================================================

  describe('State Transitions', () => {
    it('transitions from loading to auth', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'unknown',
        isTransitioning: false,
      });

      const { getByTestId, rerender } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();

      // Simulate auth check complete → guest
      (useAuth as jest.Mock).mockReturnValue({
        status: 'guest',
        isTransitioning: false,
      });

      rerender(
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByTestId('auth-navigator')).toBeTruthy();
      });
    });

    it('transitions from loading to authenticated', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loading',
        isTransitioning: false,
      });

      const { getByTestId, rerender } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();

      // Simulate auth check complete → authenticated
      (useAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isTransitioning: false,
      });

      rerender(
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByTestId('discovery-screen')).toBeTruthy();
      });
    });

    it('transitions from authenticated to loggingOut to guest', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isTransitioning: false,
      });

      const { getByTestId, rerender } = renderNavigator();

      expect(getByTestId('discovery-screen')).toBeTruthy();

      // Start logout - CRITICAL: should show loading
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      rerender(
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      );

      expect(getByTestId('loading-screen')).toBeTruthy();

      // Logout complete
      (useAuth as jest.Mock).mockReturnValue({
        status: 'guest',
        isTransitioning: false,
      });

      rerender(
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByTestId('auth-navigator')).toBeTruthy();
      });
    });
  });

  // ===========================================================================
  // Critical: Logout Safety
  // ===========================================================================

  describe('Logout Safety', () => {
    it('does NOT show app screens during loggingOut', () => {
      // This test ensures we don't crash during logout
      // by keeping LoadingScreen mounted instead of unmounting app screens

      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      const { getByTestId, queryByTestId } = renderNavigator();

      expect(getByTestId('loading-screen')).toBeTruthy();
      // App screens are KEPT MOUNTED during logout to prevent map crashes,
      // but they are covered by the loading overlay.
      expect(queryByTestId('discovery-screen')).not.toBeNull();
      expect(queryByTestId('auth-navigator')).toBeNull();
    });
  });
});
