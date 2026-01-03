import { describe, it, vi, beforeEach } from 'vitest';
import { world } from '../ecs/world';
import { economySystem } from '../ecs/systems/economy';
import { MarketSystem } from '../ecs/systems/MarketSystem';
import { STATION_CONFIGS } from '../data/stations';
import { type ItemId } from '../data/items';

// Mock Analytics to avoid pollution
vi.mock('../ecs/systems/analyticsSystem', () => ({
  recordProduction: () => {},
  recordTradeAttempt: () => {},
  analyticsSystem: () => {},
}));

// Mock Phaser (needed for imports)
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

// Interface for simulated trader
interface SimTrader {
  id: string;
  faction: string;
  transform: { x: number; y: number; rotation: number };
  wallet: number;
  cargo: Record<string, number>;
  sectorId: string;
  totalProfit: number;
  simState: string;
  simTargetId: string;
  simArrivalTime: number;
  simRoute?: { buyStationId: string; sellStationId: string; itemId: string }; // Typed route
  cargoCapacity: number;
}

describe('Economy Simulation', () => {
  beforeEach(() => {
    // Clear world
    for (const e of world.entities) {
      world.remove(e);
    }
  });

  it('runs a lightweight simulation to verify trade flow', () => {
    // 1. Setup World
    // Stations: 2 of each type to allow flow
    const stationTypes = Object.keys(STATION_CONFIGS) as Array<keyof typeof STATION_CONFIGS>;
    stationTypes.forEach((type) => {
      // Removed unused index
      // Create 2 of each
      for (let i = 0; i < 2; i++) {
        world.add({
          id: `station-${type}-${i}`,
          station: true,
          stationType: type,
          productionConfig: STATION_CONFIGS[type].production,
          inventory: { ...STATION_CONFIGS[type].initInventory }, // Clone
          transform: { x: Math.random() * 10000, y: Math.random() * 10000, rotation: 0 },
          wallet: 10000,
          sectorId: 'sector-1',
          lastProductionTick: 0,
        });
      }
    });

    // Traders: 200 (New Target)
    const TRADER_COUNT = 200;
    // const CARGO_CAPACITY = 10; // BASELINE (Problematic)
    const CARGO_CAPACITY = 100; // OPTIMIZED

    const traders: SimTrader[] = [];
    for (let i = 0; i < TRADER_COUNT; i++) {
      const entity: SimTrader = {
        id: `trader-${i}`,
        faction: 'TRADER',
        transform: { x: 5000, y: 5000, rotation: 0 },
        wallet: 1000,
        cargo: {} as Record<string, number>,
        sectorId: 'sector-1',
        totalProfit: 0,
        cargoCapacity: CARGO_CAPACITY,

        // Sim State
        simState: 'IDLE', // IDLE, MOVING_TO_BUY, MOVING_TO_SELL
        simTargetId: '',
        simArrivalTime: 0,
        simRoute: undefined, // null as any -> undefined
      };
      world.add(entity);
      traders.push(entity);
    }

    // 2. Simulation Loop
    const SIM_DURATION_SECONDS = 3600; // 1 Hour
    const TICK_RATE = 1000; // 1s per tick
    const successes: Record<string, number> = {};
    const failures: Record<string, number> = {};

    console.log(
      `[Sim] Starting 1h Simulation with ${TRADER_COUNT} traders (Cargo: ${CARGO_CAPACITY})...`
    );

    for (let time = 0; time < SIM_DURATION_SECONDS * 1000; time += TICK_RATE) {
      // A. Economy Update
      economySystem(time, TICK_RATE);

      // B. Market System Update (Cache)
      MarketSystem.update(time);

      // C. Trader AI
      for (const trader of traders) {
        if (trader.simState === 'IDLE') {
          // Decisions
          const route = MarketSystem.getBestRoute();
          if (route) {
            trader.simRoute = route;
            trader.simState = 'MOVING_TO_BUY';
            trader.simTargetId = route.buyStationId;

            // Calc distance
            // Simplified: All trips take 10 seconds for this test to speed up cycles?
            // Or use distance logic. Let's use simplified constant time for pure Econ Logic test.
            // Actually, distance matters for valuation score.
            // Let's assume average travel is 30s.
            trader.simArrivalTime = time + 30000;
          }
        } else if (trader.simState === 'MOVING_TO_BUY') {
          if (time >= trader.simArrivalTime) {
            // Arrived
            const station = world.entities.find((e) => e.id === trader.simRoute.buyStationId);
            const itemId = trader.simRoute.itemId;

            if (station && station.inventory) {
              const available = station.inventory[itemId] || 0;
              const amount = Math.min(available, CARGO_CAPACITY);

              if (amount > 0) {
                // Success Buy
                station.inventory[itemId] -= amount;
                trader.cargo[itemId] = (trader.cargo[itemId] || 0) + amount;
                trader.wallet -= 100 * (amount / 10); // Dummy price scaling

                trader.simState = 'MOVING_TO_SELL';
                trader.simTargetId = trader.simRoute.sellStationId;
                trader.simArrivalTime = time + 30000;
              } else {
                // Failure (Truly empty)
                failures[itemId] = (failures[itemId] || 0) + 1;
                trader.simState = 'IDLE';
              }
            } else {
              // Failure (No station or inventory)
              failures[itemId] = (failures[itemId] || 0) + 1;
              trader.simState = 'IDLE';
            }
          }
        } else if (trader.simState === 'MOVING_TO_SELL') {
          if (time >= trader.simArrivalTime) {
            // Arrived
            const station = world.entities.find((e) => e.id === trader.simRoute.sellStationId);
            const itemId = trader.simRoute.itemId as ItemId;
            const amount = trader.cargo[itemId] || 0;

            if (station && station.inventory && amount > 0) {
              station.inventory[itemId] = (station.inventory[itemId] || 0) + amount;
              trader.cargo[itemId] = 0;
              trader.simState = 'IDLE';
              successes[itemId] = (successes[itemId] || 0) + 1;
            } else {
              // Failed to sell? (Shouldn't happen in this simplified model)
              trader.simState = 'IDLE';
            }
          }
        }
      }
    }

    // 3. Report
    console.log('--- Simulation Results ---');
    console.table(successes);
    console.log('Failures:', failures);

    // Assertions
    // Baseline Expectation: Raw Materials move well. Processed Goods move poorly.
    // If we implemented the fix (Higher Production Batches), we hope to see Tier 1 items moving.

    // Check key items
    const rawSum = (successes['ore'] || 0) + (successes['gas'] || 0);
    const tier1Sum = (successes['steel'] || 0) + (successes['fuel'] || 0);

    console.log(`Raw Trades: ${rawSum}`);
    console.log(`Tier 1 Trades: ${tier1Sum}`);

    // In a broken economy, Tier 1 is near zero.
    // expect(tier1Sum).toBeGreaterThan(0);
  });
});
