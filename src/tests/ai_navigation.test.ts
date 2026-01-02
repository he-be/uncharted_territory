import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiSystem } from '../ecs/systems/ai';

// Mock pathfinding to use internal mocked data
vi.mock('../data/universe', () => ({
  SECTORS: [
    { id: 'sec-1', x: 0, y: 0, name: 'S1', type: 'core' },
    { id: 'sec-2', x: 1, y: 0, name: 'S2', type: 'core' },
    { id: 'sec-3', x: 2, y: 0, name: 'S3', type: 'core' },
  ],
  CONNECTIONS: [
    { from: 'sec-1', to: 'sec-2' },
    { from: 'sec-2', to: 'sec-3' },
  ],
  getSectorWorldPosition: () => ({ x: 0, y: 0 }),
}));

const mockWith = vi.fn();
vi.mock('../ecs/world', () => ({
  world: {
    with: (...args: unknown[]) => mockWith(...args),
    add: vi.fn(),
  },
}));

describe('AI Multi-Sector Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should target the correct gate for a multi-hop destination', async () => {
    // Setup Entities
    const npc = {
      id: 'npc-1',
      sectorId: 'sec-1',
      transform: { x: 0, y: 0, rotation: 0 },
      velocity: { vx: 0, vy: 0 },
      aiState: 'EXECUTING_TRADE',
      tradeRoute: {
        buyStationId: 'station-C',
        sellStationId: 'station-A',
        itemId: 'ore',
        state: 'MOVING_TO_BUY',
      },
      speedStats: { maxSpeed: 100, acceleration: 10 },
      wallet: 1000,
      totalProfit: 0,
    };

    const stationC = {
      id: 'station-C',
      sectorId: 'sec-3',
      transform: { x: 5000, y: 5000, rotation: 0 },
      station: true,
      stationType: 'factory',
      inventory: {},
    };

    const gate1to2 = {
      id: 'gate-1-2',
      sectorId: 'sec-1',
      transform: { x: 2000, y: 0, rotation: 0 },
      gate: { destinationSectorId: 'sec-2', destinationGateId: 'gate-2-1' },
    };

    const gate2to3 = {
      id: 'gate-2-3',
      sectorId: 'sec-2',
      transform: { x: 2000, y: 0, rotation: 0 },
      gate: { destinationSectorId: 'sec-3', destinationGateId: 'gate-3-2' },
    };

    mockWith.mockImplementation((...components: string[]) => {
      if (components.includes('aiState')) return [npc];
      if (components.includes('station')) return [stationC];
      if (components.includes('gate')) return [gate1to2, gate2to3];
      return [];
    });

    // Debug: Check Path
    const { findPath } = await import('../utils/pathfinding');
    const path = findPath('sec-1', 'sec-3');
    console.log('Test Path:', path);

    // Run AI System
    aiSystem(16);

    console.log('NPC Rot:', npc.transform.rotation);

    // Expected
    const expectedAngle = 0; // towards 2000,0
    expect(npc.transform.rotation).toBeCloseTo(expectedAngle, 0.1);
  });
});
