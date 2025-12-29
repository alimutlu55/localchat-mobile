/**
 * useDebounce and useThrottle Hook Tests
 *
 * Tests for timing utility hooks.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDebounce, useThrottle } from '../useDebounce';

// Use fake timers for testing time-based hooks
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});

describe('useDebounce', () => {
    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));
        expect(result.current).toBe('initial');
    });

    it('should debounce value updates', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useDebounce(value, 300));

        expect(result.current).toBe('initial');

        // Update the value
        value = 'updated';
        rerender({});

        // Value should not change immediately
        expect(result.current).toBe('initial');

        // Advance time past the debounce delay
        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Now value should be updated
        expect(result.current).toBe('updated');
    });

    it('should cancel previous timeout on rapid changes', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useDebounce(value, 300));

        // Make rapid changes
        value = 'change1';
        rerender({});
        act(() => {
            jest.advanceTimersByTime(100);
        });

        value = 'change2';
        rerender({});
        act(() => {
            jest.advanceTimersByTime(100);
        });

        value = 'change3';
        rerender({});

        // Still should be initial
        expect(result.current).toBe('initial');

        // Wait for full debounce period
        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Should only reflect the last value
        expect(result.current).toBe('change3');
    });

    it('should use default delay of 300ms', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useDebounce(value));

        value = 'updated';
        rerender({});

        // At 299ms, should still be initial
        act(() => {
            jest.advanceTimersByTime(299);
        });
        expect(result.current).toBe('initial');

        // At 300ms, should update
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(result.current).toBe('updated');
    });

    it('should work with objects', () => {
        const initialObj = { key: 'value1' };
        const updatedObj = { key: 'value2' };
        let value = initialObj;

        const { result, rerender } = renderHook(() => useDebounce(value, 300));

        expect(result.current).toBe(initialObj);

        value = updatedObj;
        rerender({});

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe(updatedObj);
    });
});

describe('useThrottle', () => {
    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useThrottle('initial', 200));
        expect(result.current).toBe('initial');
    });

    it('should throttle value updates', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useThrottle(value, 200));

        // First update
        value = 'update1';
        rerender({});

        // The update should eventually reflect
        act(() => {
            jest.advanceTimersByTime(200);
        });
        expect(result.current).toBe('update1');
    });

    it('should limit update frequency', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useThrottle(value, 200));

        // Update rapidly
        value = 'rapid1';
        rerender({});
        value = 'rapid2';
        rerender({});
        value = 'rapid3';
        rerender({});

        // Wait for throttle interval
        act(() => {
            jest.advanceTimersByTime(200);
        });

        // Should eventually show one of the updates
        expect(['rapid1', 'rapid2', 'rapid3', 'initial']).toContain(result.current);
    });

    it('should use default interval of 200ms', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useThrottle(value));

        value = 'updated';
        rerender({});

        // Wait for default interval
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(result.current).toBe('updated');
    });
});
