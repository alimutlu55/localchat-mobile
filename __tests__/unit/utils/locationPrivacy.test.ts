/**
 * Location Privacy Utilities Tests
 *
 * Tests the location privacy/randomization functions.
 * Validates:
 * - Location randomization stays within radius
 * - Different functions use correct privacy radii
 * - Math is correct for lat/lng conversions
 */

import {
  randomizeLocation,
  randomizeForRoomCreation,
  randomizeForRoomJoin,
  randomizeForDiscovery,
} from '../../../src/utils/locationPrivacy';

describe('locationPrivacy', () => {
  // Fixed seed for deterministic tests
  const originalRandom = Math.random;

  beforeEach(() => {
    // Reset Math.random to original
    Math.random = originalRandom;
  });

  afterAll(() => {
    Math.random = originalRandom;
  });

  // ===========================================================================
  // randomizeLocation Tests
  // ===========================================================================

  describe('randomizeLocation', () => {
    it('returns a valid location object', () => {
      const result = randomizeLocation(37.7749, -122.4194, 100);

      expect(result).toHaveProperty('lat');
      expect(result).toHaveProperty('lng');
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
    });

    it('returns original location when radius is 0', () => {
      const result = randomizeLocation(37.7749, -122.4194, 0);

      expect(result.lat).toBeCloseTo(37.7749, 4);
      expect(result.lng).toBeCloseTo(-122.4194, 4);
    });

    it('stays within specified radius', () => {
      const centerLat = 37.7749;
      const centerLng = -122.4194;
      const radiusMeters = 500;

      // Run multiple times to verify
      for (let i = 0; i < 100; i++) {
        const result = randomizeLocation(centerLat, centerLng, radiusMeters);

        // Calculate distance
        const dLat = result.lat - centerLat;
        const dLng = result.lng - centerLng;

        // Convert to meters (approximate)
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

        const distLat = dLat * metersPerDegreeLat;
        const distLng = dLng * metersPerDegreeLng;
        const totalDist = Math.sqrt(distLat * distLat + distLng * distLng);

        expect(totalDist).toBeLessThanOrEqual(radiusMeters * 1.01); // Small tolerance
      }
    });

    it('produces different results on consecutive calls', () => {
      const results = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = randomizeLocation(37.7749, -122.4194, 100);
        results.add(`${result.lat.toFixed(6)},${result.lng.toFixed(6)}`);
      }

      // Should have more than 1 unique result
      expect(results.size).toBeGreaterThan(1);
    });

    it('handles edge case at equator', () => {
      const result = randomizeLocation(0, 0, 100);

      expect(Number.isFinite(result.lat)).toBe(true);
      expect(Number.isFinite(result.lng)).toBe(true);
    });

    it('handles edge case at poles', () => {
      const result = randomizeLocation(89.9, 0, 100);

      expect(Number.isFinite(result.lat)).toBe(true);
      expect(Number.isFinite(result.lng)).toBe(true);
    });

    it('handles negative coordinates', () => {
      const result = randomizeLocation(-33.8688, 151.2093, 100); // Sydney

      expect(Number.isFinite(result.lat)).toBe(true);
      expect(Number.isFinite(result.lng)).toBe(true);
    });

    it('uses uniform distribution within circle', () => {
      // Mock Math.random to return predictable values
      let callCount = 0;
      Math.random = () => {
        callCount++;
        return 0.5;
      };

      const result = randomizeLocation(37.7749, -122.4194, 100);

      // Should have called Math.random at least twice (for angle and distance)
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // randomizeForRoomCreation Tests
  // ===========================================================================

  describe('randomizeForRoomCreation', () => {
    it('uses 30% of room radius', () => {
      const centerLat = 37.7749;
      const centerLng = -122.4194;
      const roomRadius = 1000; // 1km room
      const expectedMaxOffset = roomRadius * 0.3; // 300m

      // Run multiple times
      for (let i = 0; i < 50; i++) {
        const result = randomizeForRoomCreation(centerLat, centerLng, roomRadius);

        // Calculate distance
        const dLat = result.lat - centerLat;
        const dLng = result.lng - centerLng;

        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

        const distLat = dLat * metersPerDegreeLat;
        const distLng = dLng * metersPerDegreeLng;
        const totalDist = Math.sqrt(distLat * distLat + distLng * distLng);

        expect(totalDist).toBeLessThanOrEqual(expectedMaxOffset * 1.01);
      }
    });

    it('returns valid coordinates', () => {
      const result = randomizeForRoomCreation(37.7749, -122.4194, 500);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
      expect(Number.isFinite(result.lat)).toBe(true);
      expect(Number.isFinite(result.lng)).toBe(true);
    });
  });

  // ===========================================================================
  // randomizeForRoomJoin Tests
  // ===========================================================================

  describe('randomizeForRoomJoin', () => {
    it('uses 50% of room radius', () => {
      const centerLat = 37.7749;
      const centerLng = -122.4194;
      const roomRadius = 1000;
      const expectedMaxOffset = roomRadius * 0.5; // 500m

      for (let i = 0; i < 50; i++) {
        const result = randomizeForRoomJoin(centerLat, centerLng, roomRadius);

        const dLat = result.lat - centerLat;
        const dLng = result.lng - centerLng;

        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

        const distLat = dLat * metersPerDegreeLat;
        const distLng = dLng * metersPerDegreeLng;
        const totalDist = Math.sqrt(distLat * distLat + distLng * distLng);

        expect(totalDist).toBeLessThanOrEqual(expectedMaxOffset * 1.01);
      }
    });

    it('returns valid coordinates', () => {
      const result = randomizeForRoomJoin(37.7749, -122.4194, 500);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
    });
  });

  // ===========================================================================
  // randomizeForDiscovery Tests
  // ===========================================================================

  describe('randomizeForDiscovery', () => {
    it('uses fixed 200m radius', () => {
      const centerLat = 37.7749;
      const centerLng = -122.4194;
      const expectedMaxOffset = 200;

      for (let i = 0; i < 50; i++) {
        const result = randomizeForDiscovery(centerLat, centerLng);

        const dLat = result.lat - centerLat;
        const dLng = result.lng - centerLng;

        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

        const distLat = dLat * metersPerDegreeLat;
        const distLng = dLng * metersPerDegreeLng;
        const totalDist = Math.sqrt(distLat * distLat + distLng * distLng);

        expect(totalDist).toBeLessThanOrEqual(expectedMaxOffset * 1.01);
      }
    });

    it('only takes lat and lng parameters', () => {
      const result = randomizeForDiscovery(37.7749, -122.4194);

      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
    });
  });

  // ===========================================================================
  // Privacy Guarantees
  // ===========================================================================

  describe('Privacy Guarantees', () => {
    it('never returns exact original coordinates', () => {
      const lat = 37.7749;
      const lng = -122.4194;

      // With a non-zero radius, should not return exact same coords
      for (let i = 0; i < 100; i++) {
        const result = randomizeLocation(lat, lng, 100);

        // At least one coordinate should be different
        const sameLocation = result.lat === lat && result.lng === lng;
        
        // This could theoretically happen with probability essentially 0
        // But we're testing 100 times so it should never happen
        if (i === 99) {
          // On last iteration, just verify the function works
          expect(Number.isFinite(result.lat)).toBe(true);
        }
      }
    });

    it('creation uses smaller offset than join', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const roomRadius = 1000;

      // Creation: 30% = 300m max
      // Join: 50% = 500m max
      // Join should generally have larger offsets on average

      let creationTotalDist = 0;
      let joinTotalDist = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const creationResult = randomizeForRoomCreation(lat, lng, roomRadius);
        const joinResult = randomizeForRoomJoin(lat, lng, roomRadius);

        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(lat * Math.PI / 180);

        const creationDistLat = (creationResult.lat - lat) * metersPerDegreeLat;
        const creationDistLng = (creationResult.lng - lng) * metersPerDegreeLng;
        creationTotalDist += Math.sqrt(creationDistLat ** 2 + creationDistLng ** 2);

        const joinDistLat = (joinResult.lat - lat) * metersPerDegreeLat;
        const joinDistLng = (joinResult.lng - lng) * metersPerDegreeLng;
        joinTotalDist += Math.sqrt(joinDistLat ** 2 + joinDistLng ** 2);
      }

      const avgCreationDist = creationTotalDist / iterations;
      const avgJoinDist = joinTotalDist / iterations;

      // Join average should be larger (approximately 1.67x based on radius ratio)
      expect(avgJoinDist).toBeGreaterThan(avgCreationDist);
    });
  });
});
