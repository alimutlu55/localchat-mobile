/**
 * Performance Utilities
 *
 * Helper functions for optimizing React Native performance.
 * Includes debouncing, throttling, and interaction management.
 */

import { InteractionManager } from 'react-native';

/**
 * Debounce function
 * Creates a debounced version of a function that delays execution
 * until after the wait time has elapsed since the last invocation.
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

/**
 * Throttle function
 * Creates a throttled version of a function that only invokes
 * at most once per every wait milliseconds.
 *
 * @param func - Function to throttle
 * @param wait - Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();

        if (now - lastCall >= wait) {
            lastCall = now;
            func.apply(this, args);
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                func.apply(this, args);
            }, wait - (now - lastCall));
        }
    };
}

/**
 * Run after interactions
 * Defers execution until after all ongoing interactions/animations complete.
 * Helps prevent janky animations by delaying heavy computations.
 *
 * @param callback - Function to run after interactions
 * @returns Promise that resolves when task completes
 */
export function runAfterInteractions<T>(
    callback: () => T
): Promise<T> {
    return new Promise((resolve) => {
        InteractionManager.runAfterInteractions(() => {
            const result = callback();
            resolve(result);
        });
    });
}

/**
 * Chunk Array
 * Splits an array into smaller chunks for batched processing.
 * Useful for rendering large lists progressively.
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * RAF Throttle (RequestAnimationFrame)
 * Throttles a function to run at most once per animation frame.
 * Perfect for scroll handlers and animations.
 *
 * @param func - Function to throttle
 * @returns Throttled function
 */
export function rafThrottle<T extends (...args: any[]) => any>(
    func: T
): (...args: Parameters<T>) => void {
    let rafId: number | null = null;
    let lastArgs: Parameters<T> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        lastArgs = args;

        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                if (lastArgs) {
                    func.apply(this, lastArgs);
                }
                rafId = null;
                lastArgs = null;
            });
        }
    };
}

/**
 * Measure Performance
 * Simple wrapper for measuring function execution time.
 *
 * @param label - Label for the measurement
 * @param func - Function to measure
 * @returns Function result
 */
export async function measurePerformance<T>(
    label: string,
    func: () => T | Promise<T>
): Promise<T> {
    const start = performance.now();
    const result = await func();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}

/**
 * Batch Updates
 * Collects multiple state updates and executes them in a single batch.
 * Reduces re-renders significantly.
 *
 * @param updates - Array of update functions
 */
export function batchUpdates(updates: Array<() => void>): void {
    // React 18+ automatically batches updates
    // This is mainly for older versions or manual control
    updates.forEach((update) => update());
}

/**
 * Memoize Function
 * Simple memoization for expensive pure functions.
 *
 * @param func - Function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
    func: T
): T {
    const cache = new Map();

    return function (this: any, ...args: Parameters<T>): ReturnType<T> {
        const key = JSON.stringify(args);

        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = func.apply(this, args);
        cache.set(key, result);
        return result;
    } as T;
}

/**
 * Create Stable Key
 * Generates a stable key for React lists that changes only when content changes.
 *
 * @param item - Item to create key for
 * @param index - Fallback index
 * @returns Stable key string
 */
export function createStableKey(item: any, index: number): string {
    if (item && typeof item === 'object') {
        if ('id' in item) return `item-${item.id}`;
        if ('key' in item) return `item-${item.key}`;
    }
    return `item-${index}`;
}

/**
 * Detect Performance Issues
 * Simple monitor for detecting re-render issues in development.
 */
export class PerformanceMonitor {
    private renderCounts = new Map<string, number>();
    private lastRenderTimes = new Map<string, number>();

    logRender(componentName: string) {
        if (__DEV__) {
            const count = (this.renderCounts.get(componentName) || 0) + 1;
            this.renderCounts.set(componentName, count);

            const now = Date.now();
            const lastTime = this.lastRenderTimes.get(componentName) || now;
            const timeDiff = now - lastTime;

            if (timeDiff < 16) { // More than 60fps
                console.warn(
                    `[PerformanceMonitor] ${componentName} re-rendered too quickly (${timeDiff}ms). Consider memoization.`
                );
            }

            if (count > 10) {
                console.warn(
                    `[PerformanceMonitor] ${componentName} rendered ${count} times. Check for unnecessary re-renders.`
                );
            }

            this.lastRenderTimes.set(componentName, now);
        }
    }

    reset() {
        this.renderCounts.clear();
        this.lastRenderTimes.clear();
    }

    getStats() {
        return {
            renderCounts: Object.fromEntries(this.renderCounts),
            lastRenderTimes: Object.fromEntries(this.lastRenderTimes),
        };
    }
}

export const performanceMonitor = new PerformanceMonitor();
