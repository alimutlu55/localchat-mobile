import { snapToGrid, randomizeForRoomCreation } from '../locationPrivacy';

describe('locationPrivacy', () => {
    describe('snapToGrid', () => {
        it('should snap coordinates to the center of the grid cell', () => {
            const lat = 41.0082;
            const lng = 28.9784;

            const snapped = snapToGrid(lat, lng);

            // GRID_RESOLUTION_DEGREES = 0.01
            // Expected snap for 41.0082: Math.floor(41.0082 / 0.01) * 0.01 + 0.005 = 41.00 + 0.005 = 41.005
            // Expected snap for 28.9784: Math.floor(28.9784 / 0.01) * 0.01 + 0.005 = 28.97 + 0.005 = 28.975

            expect(snapped.lat).toBeCloseTo(41.005, 6);
            expect(snapped.lng).toBeCloseTo(28.975, 6);
        });

        it('should be deterministic (return same output for different points in the same cell)', () => {
            const p1 = { lat: 41.006, lng: 28.976 };
            const p2 = { lat: 41.009, lng: 28.979 };

            const s1 = snapToGrid(p1.lat, p1.lng);
            const s2 = snapToGrid(p2.lat, p2.lng);

            expect(s1.lat).toBe(s2.lat);
            expect(s1.lng).toBe(s2.lng);
        });
    });

    describe('randomizeForRoomCreation', () => {
        it('should use snapToGrid', () => {
            const lat = 41.0082;
            const lng = 28.9784;

            const result = randomizeForRoomCreation(lat, lng);
            const expected = snapToGrid(lat, lng);

            expect(result).toEqual(expected);
        });
    });
});
