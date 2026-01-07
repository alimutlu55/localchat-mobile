import { calcOptimalZoomForCluster, MAX_CLUSTERING_ZOOM } from '../clustering';

describe('clustering utils', () => {
    describe('calcOptimalZoomForCluster', () => {
        it('should calculate correct zoom for normal bounds', () => {
            // Bounds with 0.1 degree span
            const boundsSpan = 0.1;
            const result = calcOptimalZoomForCluster(boundsSpan, 5);

            // result should be > 5 and <= MAX_CLUSTERING_ZOOM
            expect(result).toBeGreaterThan(5);
            expect(result).toBeLessThanOrEqual(MAX_CLUSTERING_ZOOM);
        });

        it('should handle zero-span bounds by jumping to max zoom (within limit)', () => {
            const boundsSpan = 0;
            const currentZoom = 1;
            const result = calcOptimalZoomForCluster(boundsSpan, currentZoom);

            // Should not be NaN or Infinity
            expect(result).not.toBeNaN();
            expect(isFinite(result)).toBe(true);

            // In our code, for zero span it should return currentZoom + 6 (limited by 12)
            expect(result).toBe(Math.min(currentZoom + 6, MAX_CLUSTERING_ZOOM));
        });

        it('should limit the zoom jump to 6 levels', () => {
            // Very tiny bounds span
            const boundsSpan = 0.00001;
            const currentZoom = 1;
            const result = calcOptimalZoomForCluster(boundsSpan, currentZoom);

            // 1 + 6 = 7
            expect(result).toBe(7);
        });

        it('should not exceed MAX_CLUSTERING_ZOOM (12)', () => {
            const boundsSpan = 0.00001;
            const currentZoom = 10;
            const result = calcOptimalZoomForCluster(boundsSpan, currentZoom);

            expect(result).toBe(MAX_CLUSTERING_ZOOM);
        });
    });
});
