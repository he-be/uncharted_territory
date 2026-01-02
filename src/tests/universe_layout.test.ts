import { describe, it, expect } from 'vitest';
import { SECTORS, getSectorWorldPosition } from '../data/universe';

describe('Universe Layout Verification', () => {
  it('should place sectors vastly far apart (Global Coords)', () => {
    const STATION_SPREAD = 4000; // Stations are +/- 2000 from center
    const MIN_DISTANCE_THRESHOLD = 150000; // Sectors should be very far

    for (let i = 0; i < SECTORS.length; i++) {
      for (let j = i + 1; j < SECTORS.length; j++) {
        const s1 = SECTORS[i];
        const s2 = SECTORS[j];

        const p1 = getSectorWorldPosition(s1);
        const p2 = getSectorWorldPosition(s2);

        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

        // Assert Center-to-Center distance
        expect(
          dist,
          `Distance between ${s1.name} and ${s2.name} is too small: ${dist}`
        ).toBeGreaterThan(MIN_DISTANCE_THRESHOLD);

        // Simulate Station Positions and check worst case (closest possible stations)
        // If stations are at the "edge" of their sector towards each other.
        const p1_edge = {
          x: p1.x + (p2.x > p1.x ? STATION_SPREAD : -STATION_SPREAD),
          y: p1.y + (p2.y > p1.y ? STATION_SPREAD : -STATION_SPREAD),
        };
        const p2_edge = {
          x: p2.x + (p1.x > p2.x ? STATION_SPREAD : -STATION_SPREAD),
          y: p2.y + (p1.y > p2.y ? STATION_SPREAD : -STATION_SPREAD),
        };

        const edgeDist = Math.sqrt(
          Math.pow(p2_edge.x - p1_edge.x, 2) + Math.pow(p2_edge.y - p1_edge.y, 2)
        );
        expect(
          edgeDist,
          `Stations between ${s1.name} and ${s2.name} might overlap! Dist: ${edgeDist}`
        ).toBeGreaterThan(10000); // 10k unit buffer roughly
      }
    }
  });

  it('should have correct world scale', () => {
    // Core Sector 1 is at 400,300 UI
    // Core Sector 2 is at 600,200 UI
    // Delta UI = 200, -100
    // Dist UI = ~223
    // World Dist should be ~223,000

    const s1 = SECTORS[0];
    const s2 = SECTORS[1];
    const p1 = getSectorWorldPosition(s1);
    const p2 = getSectorWorldPosition(s2);

    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    expect(dist).toBeGreaterThan(200000);
  });
});
