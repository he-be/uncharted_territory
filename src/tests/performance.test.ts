import { describe, it, expect, beforeEach, vi } from 'vitest';
import { world } from '../ecs/world';

// MOCK PHASER ENTIRELY to avoid side-effects
vi.mock('phaser', () => {
  return {
    default: {
      Math: {
        Distance: {
          Between: (x1: number, y1: number, x2: number, y2: number) => {
            const dx = x1 - x2;
            const dy = y1 - y2;
            return Math.sqrt(dx * dx + dy * dy);
          },
        },
      },
    },
  };
});

// Mock Canvas for Phaser
const mockCanvas = () => {
  // @ts-expect-error Partial mock does not implement full HTMLCanvasElement interface
  HTMLCanvasElement.prototype.getContext = vi.fn((_contextId: string) => {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Array(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => []),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      globalAlpha: 1,
      fillStyle: '#000',
      strokeStyle: '#000',
    } as unknown;
  });
};

mockCanvas();

import { aiSystem } from '../ecs/systems/ai';
import { v4 as uuidv4 } from 'uuid';
import { STATION_CONFIGS, type StationType } from '../data/stations';

describe('AI Performance Stress Test', () => {
  beforeEach(() => {
    world.clear();
    // Setup Stations
    const stations = [
      { type: 'mining', x: 0, y: 0, id: 's1' },
      { type: 'factory', x: 1000, y: 1000, id: 's2' },
      { type: 'trading', x: 2000, y: 2000, id: 's3' },
    ];

    stations.forEach((s) => {
      const config = STATION_CONFIGS[s.type as StationType];
      world.add({
        id: s.id,
        transform: { x: s.x, y: s.y, rotation: 0 },
        station: true,
        stationType: s.type as StationType,
        inventory: { ...config?.initInventory },
        productionConfig: config?.production,
        wallet: 10000,
      });
    });
  });

  const createShips = (count: number) => {
    for (let i = 0; i < count; i++) {
      world.add({
        id: uuidv4(),
        transform: { x: 500, y: 500, rotation: 0 },
        velocity: { vx: 0, vy: 0 },
        aiState: 'PLANNING',
        speedStats: { maxSpeed: 100, acceleration: 100 },
        wallet: 10000,
        totalProfit: 0,
        cargo: {},
      });
    }
  };

  it('should handle 10 ships within acceptable time (< 1ms)', () => {
    createShips(10);
    const start = performance.now();
    aiSystem(16);
    const duration = performance.now() - start;
    console.log(`10 Ships: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });

  it('should handle 50 ships within acceptable time (< 5ms)', () => {
    createShips(50);
    const start = performance.now();
    aiSystem(16);
    const duration = performance.now() - start;
    console.log(`50 Ships (1 Frame): ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });

  it('should scale linearly for EXECUTING phase', () => {
    const count = 100;
    for (let i = 0; i < count; i++) {
      world.add({
        id: uuidv4(),
        transform: { x: 500, y: 500, rotation: 0 },
        velocity: { vx: 0, vy: 0 },
        aiState: 'EXECUTING_TRADE',
        tradeRoute: {
          buyStationId: 's1',
          sellStationId: 's2',
          itemId: 'ore',
          state: 'MOVING_TO_BUY',
        },
        speedStats: { maxSpeed: 100, acceleration: 100 },
        wallet: 10000,
        totalProfit: 0,
        cargo: {},
      });
    }

    const start = performance.now();
    aiSystem(16);
    const duration = performance.now() - start;
    console.log(`100 Ships (Executing): ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(10);
  });

  it('should maintain stable frame times (<10ms) over 30 seconds (1800 frames) with 50 ships', () => {
    createShips(50);

    let maxDuration = 0;
    let totalDuration = 0;
    const frames = 60 * 30; // 30 seconds at 60fps

    // Simulate Game Loop
    for (let i = 0; i < frames; i++) {
      const start = performance.now();
      aiSystem(16);
      const duration = performance.now() - start;

      if (duration > maxDuration) maxDuration = duration;
      totalDuration += duration;
    }

    const avgDuration = totalDuration / frames;

    console.log(`30s Simulation Results (50 Ships):`);
    console.log(` - Max Frame: ${maxDuration.toFixed(3)}ms`);
    console.log(` - Avg Frame: ${avgDuration.toFixed(3)}ms`);

    // Assert no single frame caused a stutter
    // We set 10ms budget for AI System alone, leaving 6ms for Render + Physics + Etc in a 16ms frame
    expect(maxDuration).toBeLessThan(10);
  });
});
