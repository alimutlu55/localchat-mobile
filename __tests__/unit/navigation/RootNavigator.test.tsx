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
import { useSession } from '../../../src/core/session/useSession';

// Mock dependencies
jest.mock('../../../src/features/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../../src/core/session/useSession', () => ({
  useSession: jest.fn(),
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
  ConsentScreen: () => null,
  ConsentPreferencesScreen: () => null,
  CustomPaywallScreen: () => null,
}));

jest.mock('../../../src/screens/settings', () => ({
  LocationSettingsScreen: () => null,
  LanguageSettingsScreen: () => null,
  DataControlsScreen: () => null,
  BlockedUsersScreen: () => null,
  ReportProblemScreen: () => null,
  ManageSubscriptionScreen: () => null,
}));

jest.mock('../../../src/navigation/AuthNavigator', () => ({
  AuthNavigator: () => {
    const { Text } = require('react-native');
    return <Text testID="auth-navigator">Auth</Text>;
  },
}));

jest.mock('../../../src/navigation/MainNavigator', () => {
  const { Text } = require('react-native');
  return () => <Text testID="discovery-screen">MainNavigator</Text>;
});

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
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      isInitializing: false,
    });
    (useAuth as jest.Mock).mockReturnValue({
      status: 'authenticated',
      isTransitioning: false,
    });
  });

  // ===========================================================================
  // Initialization & Loading
  // ===========================================================================

  describe('Initialization', () => {
    it('returns null when isInitializing is true', () => {
      (useSession as jest.Mock).mockReturnValue({
        status: 'unknown',
        isInitializing: true,
      });
      // useAuth result doesn't matter here if isInitializing is checked first

      const { toJSON } = renderNavigator();
      expect(toJSON()).toBeNull();
    });

    it('shows loading overlay when status is "loggingOut"', () => {
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      const { getByTestId } = renderNavigator();
      expect(getByTestId('loading-overlay')).toBeTruthy();
    });
  });

  // ===========================================================================
  // Auth States
  // ===========================================================================

  describe('Auth States', () => {
    it('shows AuthNavigator when status is "needsAuth" (guest/logged out)', () => {
      (useSession as jest.Mock).mockReturnValue({
        status: 'needsAuth',
        isInitializing: false,
      });
      (useAuth as jest.Mock).mockReturnValue({
        status: 'guest',
        isTransitioning: false,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('auth-navigator')).toBeTruthy();
    });

    it('shows AuthNavigator when status is "authenticating"', () => {
      // In this case session might still be needsAuth, but authStatus is authenticating
      (useSession as jest.Mock).mockReturnValue({
        status: 'needsAuth',
        isInitializing: false,
      });
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
      (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isInitializing: false,
      });
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
    it('transitions from initializing to auth', async () => {
      // 1. Initializing
      (useSession as jest.Mock).mockReturnValue({
        status: 'unknown',
        isInitializing: true,
      });
      const { toJSON, rerender, getByTestId } = renderNavigator();
      expect(toJSON()).toBeNull();

      // 2. Auth needed
      (useSession as jest.Mock).mockReturnValue({
        status: 'needsAuth',
        isInitializing: false,
      });
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

    it('transitions from initializing to authenticated', async () => {
      // 1. Initializing
      (useSession as jest.Mock).mockReturnValue({
        status: 'unknown',
        isInitializing: true,
      });
      const { toJSON, rerender, getByTestId } = renderNavigator();
      expect(toJSON()).toBeNull();

      // 2. Authenticated
      (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isInitializing: false,
      });
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
      // 1. Authenticated
      (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isInitializing: false,
      });
      (useAuth as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isTransitioning: false,
      });

      const { getByTestId, rerender } = renderNavigator();
      expect(getByTestId('discovery-screen')).toBeTruthy();

      // 2. Start logout - CRITICAL: should show loading overlay
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      rerender(
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      );

      expect(getByTestId('loading-overlay')).toBeTruthy();
      // App screens still mounted underneath
      expect(getByTestId('discovery-screen')).toBeTruthy();

      // 3. Logout complete -> guest
      (useAuth as jest.Mock).mockReturnValue({
        status: 'guest',
        isTransitioning: false,
      });
      (useSession as jest.Mock).mockReturnValue({
        status: 'needsAuth',
        isInitializing: false,
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
    it('shows loading overlay and KEEPS app screens mounted during loggingOut', () => {
      (useSession as jest.Mock).mockReturnValue({
        status: 'authenticated',
        isInitializing: false,
      });
      (useAuth as jest.Mock).mockReturnValue({
        status: 'loggingOut',
        isTransitioning: true,
      });

      const { getByTestId } = renderNavigator();

      expect(getByTestId('loading-overlay')).toBeTruthy();
      expect(getByTestId('discovery-screen')).toBeTruthy();
      // queryByTestId('auth-navigator') might be present because RegistrationAuth screen uses it
      // so we don't assert its absence here, just presence of app screens
    });
  });
});
