import { describe, it, expect, beforeEach, vi } from 'vitest';
import { world } from '../ecs/world';
import { aiSystem } from '../ecs/systems/ai';
import { gateSystem } from '../ecs/systems/gateSystem';
import { movementSystem } from '../ecs/systems/movement';
import { v4 as uuidv4 } from 'uuid';
import { STATION_CONFIGS, type StationType } from '../data/stations';

// Mocks
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

// Mock Canvas (needed if we import files touching main/phaser directly, though ECS usually doesn't)
// Minimal mock if needed.

describe('Multi-Sector AI Travel', () => {
  const SECTOR_A = 'sector-a';
  const SECTOR_B = 'sector-b';

  beforeEach(() => {
    world.clear();

    // 1. Setup Sector A
    // Producer: Mining (has Energy/Food, needs? No, Mining Produces Ore, Consumes Energy/Food)
    // Wait, Mining Init Inventory: food:50, energy:50.
    // We want a trade to happen.
    // Let's explicitly set Inventory to force a trade.
    // Scenario: Ship in A needs to buy 'Food' from B.

    // Station in A (Consumer of Food)
    const miningConfig = STATION_CONFIGS['mining'];
    world.add({
      id: 'mining-a',
      transform: { x: 0, y: 0, rotation: 0 },
      station: true,
      stationType: 'mining',
      inventory: { food: 0, energy: 0, ore: 0 }, // NEEDS FOOD
      productionConfig: miningConfig.production,
      sectorId: SECTOR_A,
      wallet: 10000,
    });

    // Gate A -> B
    world.add({
      id: 'gate-a',
      transform: { x: 1000, y: 0, rotation: 0 },
      name: 'Gate A',
      sectorId: SECTOR_A,
      gate: {
        destinationSectorId: SECTOR_B,
        destinationGateId: 'gate-b',
      },
    });

    // 2. Setup Sector B
    // Producer: Trading (Produces Food)
    const tradingConfig = STATION_CONFIGS['trading'];
    world.add({
      id: 'trading-b',
      transform: { x: 50000, y: 0, rotation: 0 }, // Far away
      station: true,
      stationType: 'trading',
      inventory: { food: 1000, energy: 1000 }, // HAS FOOD
      productionConfig: tradingConfig.production,
      sectorId: SECTOR_B,
      wallet: 10000,
    });

    // Gate B -> A
    world.add({
      id: 'gate-b',
      transform: { x: 48000, y: 0, rotation: 0 },
      name: 'Gate B',
      sectorId: SECTOR_B,
      gate: {
        destinationSectorId: SECTOR_A,
        destinationGateId: 'gate-a',
      },
    });

    // 3. Spawn Ship in A
    world.add({
      id: 'ship-1',
      transform: { x: 0, y: 100, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      aiState: 'PLANNING',
      speedStats: { maxSpeed: 100, acceleration: 100 },
      wallet: 10000,
      totalProfit: 0,
      cargo: {},
      sectorId: SECTOR_A,
    });
  });

  it('should plan a route to Sector B to buy Food', () => {
    // Run AI to Plan
    aiSystem(16);

    const ship = world.with('aiState', 'tradeRoute').first;
    expect(ship).toBeDefined();
    expect(ship!.aiState).toBe('EXECUTING_TRADE');
    expect(ship!.tradeRoute!.state).toBe('MOVING_TO_BUY');
    expect(ship!.tradeRoute!.buyStationId).toBe('trading-b'); // Should target station in B

    // Verify caching works (it should have found the path)
  });

  it('should move towards Gate A when targeting Sector B', () => {
    aiSystem(16); // Plan
    const ship = world.with('velocity').first;

    // Run specific check logic - AI exec frame
    aiSystem(16); // Exec (Set Velocity)

    // Check velocity direction
    // Ship (0,100). Gate A (1000, 0).
    // Should move roughly +x.
    expect(ship!.velocity!.vx).toBeGreaterThan(0);

    // Move ship close to Gate A
    ship!.transform!.x = 990;
    ship!.transform!.y = 0;

    aiSystem(16); // Exec (Arrival & Jump?)

    // Assert Jump Happened
    expect(ship!.sectorId).toBe(SECTOR_B);
    // Assert Position (Gate B is at 48000, 0) + Offset (100, 100)
    expect(ship!.transform!.x).toBeCloseTo(48100, -1);
    expect(ship!.transform!.y).toBeCloseTo(100, -1);
  });
});
