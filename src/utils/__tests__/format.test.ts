/**
 * Format Utilities Tests
 *
 * Tests for distance calculation and formatting functions.
 */

import {
    calculateDistance,
    formatDistance,
    formatDistanceShort,
    getDistanceColor,
    sortByDistance,
} from '../format';

describe('format utilities', () => {
    describe('calculateDistance', () => {
        it('should return 0 for the same point', () => {
            const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
            expect(distance).toBe(0);
        });

        it('should calculate distance between two known points', () => {
            // New York to Los Angeles (approximately 3,944 km)
            const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
            // Allow 5% tolerance for the Haversine approximation
            expect(distance).toBeGreaterThan(3_900_000);
            expect(distance).toBeLessThan(4_000_000);
        });

        it('should calculate short distances accurately', () => {
            // ~111km for 1 degree of latitude at equator
            const distance = calculateDistance(0, 0, 1, 0);
            expect(distance).toBeGreaterThan(110_000);
            expect(distance).toBeLessThan(112_000);
        });

        it('should handle negative coordinates', () => {
            const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
            // Sydney to Melbourne (~714 km)
            expect(distance).toBeGreaterThan(700_000);
            expect(distance).toBeLessThan(730_000);
        });
    });

    describe('formatDistance', () => {
        it('should return "Distance unknown" for undefined', () => {
            expect(formatDistance(undefined)).toBe('Distance unknown');
        });

        it('should return "Distance unknown" for null', () => {
            expect(formatDistance(null as unknown as number)).toBe('Distance unknown');
        });

        it('should format distances under 1km in meters', () => {
            expect(formatDistance(50)).toBe('50m away');
            expect(formatDistance(500)).toBe('500m away');
            expect(formatDistance(999)).toBe('999m away');
        });

        it('should round meters to nearest integer', () => {
            expect(formatDistance(50.7)).toBe('51m away');
            expect(formatDistance(50.2)).toBe('50m away');
        });

        it('should format distances 1-10km with one decimal', () => {
            expect(formatDistance(1000)).toBe('1.0km away');
            expect(formatDistance(2500)).toBe('2.5km away');
            expect(formatDistance(9999)).toBe('10.0km away');
        });

        it('should format distances 10km+ as rounded integers', () => {
            expect(formatDistance(10000)).toBe('10km away');
            expect(formatDistance(15700)).toBe('16km away');
            expect(formatDistance(100000)).toBe('100km away');
        });
    });

    describe('formatDistanceShort', () => {
        it('should return "—" for undefined', () => {
            expect(formatDistanceShort(undefined)).toBe('—');
        });

        it('should return "—" for null', () => {
            expect(formatDistanceShort(null as unknown as number)).toBe('—');
        });

        it('should format distances under 1km in meters without "away"', () => {
            expect(formatDistanceShort(50)).toBe('50m');
            expect(formatDistanceShort(500)).toBe('500m');
        });

        it('should format distances 1-10km with one decimal without "away"', () => {
            expect(formatDistanceShort(2500)).toBe('2.5km');
        });

        it('should format distances 10km+ as rounded integers without "away"', () => {
            expect(formatDistanceShort(15700)).toBe('16km');
        });
    });

    describe('getDistanceColor', () => {
        it('should return green for distances under 500m', () => {
            expect(getDistanceColor(0)).toBe('#16a34a');
            expect(getDistanceColor(100)).toBe('#16a34a');
            expect(getDistanceColor(499)).toBe('#16a34a');
        });

        it('should return orange for distances 500m-2000m', () => {
            expect(getDistanceColor(500)).toBe('#ea580c');
            expect(getDistanceColor(1000)).toBe('#ea580c');
            expect(getDistanceColor(1999)).toBe('#ea580c');
        });

        it('should return gray for distances 2000m+', () => {
            expect(getDistanceColor(2000)).toBe('#6b7280');
            expect(getDistanceColor(5000)).toBe('#6b7280');
            expect(getDistanceColor(100000)).toBe('#6b7280');
        });
    });

    describe('sortByDistance', () => {
        it('should return empty array for empty input', () => {
            expect(sortByDistance([])).toEqual([]);
        });

        it('should return single item unchanged', () => {
            const items = [{ id: 1, distance: 100 }];
            expect(sortByDistance(items)).toEqual([{ id: 1, distance: 100 }]);
        });

        it('should sort items by distance ascending', () => {
            const items = [
                { id: 1, distance: 500 },
                { id: 2, distance: 100 },
                { id: 3, distance: 300 },
            ];
            const sorted = sortByDistance(items);
            expect(sorted.map((i) => i.id)).toEqual([2, 3, 1]);
        });

        it('should handle undefined distances by placing them last', () => {
            const items = [
                { id: 1, distance: undefined },
                { id: 2, distance: 100 },
                { id: 3, distance: undefined },
            ];
            const sorted = sortByDistance(items);
            expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
        });

        it('should not mutate the original array', () => {
            const items = [
                { id: 1, distance: 500 },
                { id: 2, distance: 100 },
            ];
            const original = [...items];
            sortByDistance(items);
            expect(items).toEqual(original);
        });
    });
});
