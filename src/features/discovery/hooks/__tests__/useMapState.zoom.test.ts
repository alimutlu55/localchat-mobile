/**
 * useMapState Hook Tests - Zoom Functionality
 * 
 * Tests for zoom in/out button crash prevention.
 * Ensures proper handling of async operations and ref validation.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMapState } from '../useMapState';

// Mock the logger
jest.mock('../../../../shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('useMapState - Zoom Functionality', () => {
  let mockMapRef: any;
  let mockCameraRef: any;

  beforeEach(() => {
    // Create mock refs with proper structure
    mockMapRef = {
      current: {
        getZoom: jest.fn().mockResolvedValue(5),
        getCenter: jest.fn().mockResolvedValue([0, 0]),
        getVisibleBounds: jest.fn().mockResolvedValue([
          [-10, -10],
          [10, 10],
        ]),
      },
    };

    mockCameraRef = {
      current: {
        setCamera: jest.fn(),
        fitBounds: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not crash when zoomIn is called with valid refs', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomIn
    await act(async () => {
      await result.current.zoomIn();
    });

    // Verify setCamera was called
    expect(mockCameraRef.current.setCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomLevel: 6, // 5 + 1
        animationMode: 'easeTo',
      })
    );
  });

  it('should not crash when zoomOut is called with valid refs', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomOut
    await act(async () => {
      await result.current.zoomOut();
    });

    // Verify setCamera was called
    expect(mockCameraRef.current.setCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomLevel: 4, // 5 - 1
        animationMode: 'easeTo',
      })
    );
  });

  it('should handle null mapRef gracefully in zoomIn', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set camera ref but not map ref
    result.current.cameraRef.current = mockCameraRef.current;
    result.current.mapRef.current = null;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomIn with null mapRef - should not crash
    await act(async () => {
      await result.current.zoomIn();
    });

    // Verify setCamera was NOT called
    expect(mockCameraRef.current.setCamera).not.toHaveBeenCalled();
  });

  it('should handle null cameraRef gracefully in zoomOut', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set map ref but not camera ref
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = null;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomOut with null cameraRef - should not crash
    await act(async () => {
      await result.current.zoomOut();
    });

    // Verify no crash occurred (test passes if we get here)
    expect(true).toBe(true);
  });

  it('should handle refs becoming null during async operations in zoomIn', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Make getZoom delay and then clear camera ref during the delay
    mockMapRef.current.getZoom = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            // Simulate ref being cleared during async operation
            result.current.cameraRef.current = null;
            resolve(5);
          }, 10);
        })
    );

    // Call zoomIn - should not crash
    await act(async () => {
      await result.current.zoomIn();
    });

    // Verify setCamera was NOT called (because ref became null)
    expect(mockCameraRef.current.setCamera).not.toHaveBeenCalled();
  });

  it('should handle component unmount during zoomOut', async () => {
    const { result, unmount } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Make getZoom delay and then unmount during the delay
    mockMapRef.current.getZoom = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(5);
          }, 10);
        })
    );

    // Start zoomOut
    const zoomOutPromise = act(async () => {
      await result.current.zoomOut();
    });

    // Unmount immediately
    unmount();

    // Wait for the promise to resolve - should not crash
    await zoomOutPromise;

    // Test passes if we get here without crashing
    expect(true).toBe(true);
  });

  it('should respect maxZoom limit in zoomIn', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 12,
        maxZoom: 12,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mock getZoom to return 12 (at max)
    mockMapRef.current.getZoom = jest.fn().mockResolvedValue(12);

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomIn when already at max
    await act(async () => {
      await result.current.zoomIn();
    });

    // Verify setCamera was called with maxZoom (12), not exceeding it
    expect(mockCameraRef.current.setCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomLevel: 12, // Should not exceed maxZoom
      })
    );
  });

  it('should respect minZoom limit in zoomOut', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 1,
        minZoom: 1,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Mock getZoom to return 1 (at min)
    mockMapRef.current.getZoom = jest.fn().mockResolvedValue(1);

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomOut when already at min
    await act(async () => {
      await result.current.zoomOut();
    });

    // Verify setCamera was called with minZoom (1), not going below it
    expect(mockCameraRef.current.setCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        zoomLevel: 1, // Should not go below minZoom
      })
    );
  });

  it('should handle errors in native methods gracefully', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Make getZoom throw an error
    mockMapRef.current.getZoom = jest
      .fn()
      .mockRejectedValue(new Error('Native module error'));

    // Mark map as ready
    act(() => {
      result.current.handleMapReady();
    });

    // Call zoomIn - should not crash despite error
    await act(async () => {
      await result.current.zoomIn();
    });

    // Test passes if we get here without crashing
    // setCamera should not be called due to error
    expect(mockCameraRef.current.setCamera).not.toHaveBeenCalled();
  });

  it('should not allow zoom operations when map is not ready', async () => {
    const { result } = renderHook(() =>
      useMapState({
        defaultZoom: 5,
      })
    );

    // Set up refs
    result.current.mapRef.current = mockMapRef.current;
    result.current.cameraRef.current = mockCameraRef.current;

    // Do NOT mark map as ready

    // Call zoomIn when map is not ready
    await act(async () => {
      await result.current.zoomIn();
    });

    // Verify setCamera was NOT called
    expect(mockCameraRef.current.setCamera).not.toHaveBeenCalled();
  });
});
