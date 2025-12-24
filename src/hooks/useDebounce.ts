/**
 * useDebounce Hook
 *
 * Debounces a value to prevent excessive updates/re-renders.
 * Useful for search inputs, API calls, expensive calculations.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 * 
 * @example
 * const searchQuery = useDebounce(inputValue, 300);
 * 
 * useEffect(() => {
 *   if (searchQuery) {
 *     performSearch(searchQuery);
 *   }
 * }, [searchQuery]);
 */

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up timeout to update debounced value
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clean up timeout if value changes before delay completes
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * useThrottle Hook
 *
 * Throttles a value to limit update frequency.
 * Useful for scroll handlers, resize handlers, etc.
 * 
 * @param value - The value to throttle
 * @param interval - Throttle interval in milliseconds (default: 200ms)
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, interval: number = 200): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

    useEffect(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdated;

        if (timeSinceLastUpdate >= interval) {
            setThrottledValue(value);
            setLastUpdated(now);
        } else {
            const timeoutId = setTimeout(() => {
                setThrottledValue(value);
                setLastUpdated(Date.now());
            }, interval - timeSinceLastUpdate);

            return () => clearTimeout(timeoutId);
        }
    }, [value, interval, lastUpdated]);

    return throttledValue;
}
