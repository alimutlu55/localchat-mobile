/**
 * useUserLocation Hook Tests
 *
 * Tests the user location hook.
 * Validates:
 * - Location fetching
 * - Permission handling
 * - Location watching
 * - Error states
 * - Cleanup on unmount
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    Balanced: 3,
  },
}));

// Mock logger
jest.mock('../../../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock LocationPermissionStore
jest.mock('../../../../../src/shared/stores/LocationConsentStore', () => ({
  useLocationPermission: jest.fn(),
  useLocationPermissionStore: {
    getState: () => ({ reset: jest.fn() }),
  },
}));

import { useUserLocation } from '../../../../../src/features/discovery/hooks/useUserLocation';
import { useLocationPermission } from '../../../../../src/shared/stores/LocationConsentStore';

describe('useUserLocation', () => {
  const mockLocation = {
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
    },
  };

  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: permission granted
    (useLocationPermission as jest.Mock).mockReturnValue({
      isGranted: true,
      isChecked: true,
      checkPermission: jest.fn().mockResolvedValue(true),
      requestPermission: jest.fn().mockResolvedValue(true),
    });

    // Default: location available
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);

    // Default: watch returns subscription
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: mockRemove,
    });
  });

  // ===========================================================================
  // Initial Load Tests
  // ===========================================================================

  describe('Initial Load', () => {
    it('fetches location on mount', async () => {
      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.location).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
      });
    });

    it('requests permission on mount', async () => {
      const checkPermission = jest.fn().mockResolvedValue(true);
      (useLocationPermission as jest.Mock).mockReturnValue({
        isGranted: true,
        isChecked: true,
        checkPermission,
      });

      renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(checkPermission).toHaveBeenCalled();
      });
    });

    it('starts watching location when watch=true (default)', async () => {
      renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(Location.watchPositionAsync).toHaveBeenCalled();
      });
    });

    it('does not watch when watch=false', async () => {
      renderHook(() => useUserLocation({ watch: false }));

      await waitFor(() => {
        expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
      });

      expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Permission Tests
  // ===========================================================================

  describe('Permission Handling', () => {
    it('sets permissionDenied when permission not granted', async () => {
      const checkPermission = jest.fn().mockResolvedValue(false);
      (useLocationPermission as jest.Mock).mockReturnValue({
        isGranted: false,
        isChecked: true,
        checkPermission,
      });

      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.permissionDenied).toBe(true);
      expect(result.current.error).toBe('Location permission not granted');
    });

    it('does not fetch location when permission denied', async () => {
      const checkPermission = jest.fn().mockResolvedValue(false);
      (useLocationPermission as jest.Mock).mockReturnValue({
        isGranted: false,
        isChecked: true,
        checkPermission,
      });

      renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(checkPermission).toHaveBeenCalled();
      });

      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('handles location fetch error', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location unavailable')
      );

      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to get location');
      expect(result.current.location).toBeNull();
    });

    it('handles watch setup error gracefully', async () => {
      (Location.watchPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Watch failed')
      );

      const { result } = renderHook(() => useUserLocation());

      // Should still get initial location
      await waitFor(() => {
        expect(result.current.location).not.toBeNull();
      });
    });
  });

  // ===========================================================================
  // Location Watching Tests
  // ===========================================================================

  describe('Location Watching', () => {
    it('updates location when watch callback fires', async () => {
      let watchCallback: ((location: typeof mockLocation) => void) | null = null;

      (Location.watchPositionAsync as jest.Mock).mockImplementation(
        async (_options, callback) => {
          watchCallback = callback;
          return { remove: mockRemove };
        }
      );

      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate location update
      act(() => {
        watchCallback?.({
          coords: {
            latitude: 38.0,
            longitude: -123.0,
          },
        });
      });

      expect(result.current.location).toEqual({
        latitude: 38.0,
        longitude: -123.0,
      });
    });

    it('uses correct watch options', async () => {
      renderHook(() =>
        useUserLocation({
          distanceInterval: 100,
          timeInterval: 5000,
        })
      );

      await waitFor(() => {
        expect(Location.watchPositionAsync).toHaveBeenCalled();
      });

      expect(Location.watchPositionAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          distanceInterval: 100,
          timeInterval: 5000,
        }),
        expect.any(Function)
      );
    });
  });

  // ===========================================================================
  // Refresh Tests
  // ===========================================================================

  describe('refresh', () => {
    it('refetches location', async () => {
      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      // Update mock to return different location
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 40.0, longitude: -74.0 },
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
      expect(result.current.location).toEqual({
        latitude: 40.0,
        longitude: -74.0,
      });
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================

  describe('Cleanup', () => {
    it('removes watch subscription on unmount', async () => {
      const { unmount } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(Location.watchPositionAsync).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // State Tests
  // ===========================================================================

  describe('State Management', () => {
    it('starts with loading=true', () => {
      const { result } = renderHook(() => useUserLocation());

      expect(result.current.isLoading).toBe(true);
    });

    it('sets loading=false after fetch', async () => {
      const { result } = renderHook(() => useUserLocation());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('clears error on successful refresh', async () => {
      // First fetch fails
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Fail')
      );

      const { result } = renderHook(() => useUserLocation({ watch: false }));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to get location');
      });

      // Refresh succeeds
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.location).not.toBeNull();
    });
  });
});
