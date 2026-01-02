import { describe, it, expect, vi, beforeEach } from 'vitest';
import { combatSystem } from '../ecs/systems/combatSystem';
import { world } from '../ecs/world';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
      },
    },
  },
}));

describe('Combat System Performance', () => {
  beforeEach(() => {
    // Clear world
    for (const e of world.entities) {
      world.remove(e);
    }
  });

  it('should handle high load (1500 entities, 300 pirates)', () => {
    // Setup 1200 Traders
    for (let i = 0; i < 1200; i++) {
      world.add({
        id: `trader-${i}`,
        faction: 'TRADER',
        combatStats: { hp: 100, maxHp: 100, shields: 50, maxShields: 50, shieldRechargeRate: 5 },
        transform: { x: Math.random() * 5000, y: Math.random() * 5000, rotation: 0 },
        sectorId: 'sector-1',
        totalProfit: Math.random() * 1000,
        velocity: { vx: 0, vy: 0 },
      });
    }

    // Setup 300 Pirates
    for (let i = 0; i < 300; i++) {
      world.add({
        id: `pirate-${i}`,
        faction: 'PIRATE',
        combatStats: { hp: 100, maxHp: 100, shields: 50, maxShields: 50, shieldRechargeRate: 5 },
        transform: { x: Math.random() * 5000, y: Math.random() * 5000, rotation: 0 },
        sectorId: 'sector-1',
        combatTarget: `trader-${i}`, // Active combat
        velocity: { vx: 0, vy: 0 },
      });
    }

    const start = performance.now();
    const frames = 50; // Reduced frames to save test time but enough to avg

    for (let f = 0; f < frames; f++) {
      combatSystem({ time: { now: f * 16 } } as unknown as Phaser.Scene, 16);
    }

    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / frames;

    console.log(
      `[Perf High Load] Total: ${totalTime.toFixed(2)}ms | Avg: ${avgTime.toFixed(2)}ms/frame`
    );

    expect(avgTime).toBeLessThan(10.0); // Should be < 10ms for playability
  });
});
