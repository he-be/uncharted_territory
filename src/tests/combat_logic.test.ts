import { describe, it, expect, vi, beforeEach } from 'vitest';
import { world, type Entity } from '../ecs/world';
import { combatSystem } from '../ecs/systems/combatSystem';

// Mock Phaser math/distance
vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) =>
          Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
      },
    },
    Time: {
      now: 0,
    },
  },
}));

describe('Combat System Logic', () => {
  beforeEach(() => {
    for (const e of world.entities) {
      world.remove(e);
    }
  });

  it('Releases victim from combat when attacker is killed by a third party', () => {
    // 1. Setup Entities

    // Victim (Trader)
    const trader: Partial<Entity> = {
      id: 'trader-1',
      faction: 'TRADER',
      transform: { x: 0, y: 0, rotation: 0 },
      combatStats: {
        hp: 100,
        maxHp: 100,
        shields: 50,
        maxShields: 50,
        shieldRechargeRate: 5,
        lastDamageTime: 0,
      },
      sectorId: 'sector-1',
      aiState: 'PLANNING',
      combatEncounter: undefined,
      combatTarget: undefined,
    };
    world.add(trader as Entity);

    // Attacker (Pirate)
    const pirate: Partial<Entity> = {
      id: 'pirate-1',
      faction: 'PIRATE',
      transform: { x: 50, y: 0, rotation: 0 }, // Close range
      combatStats: {
        hp: 50,
        maxHp: 50,
        shields: 0,
        maxShields: 0,
        shieldRechargeRate: 0,
        lastDamageTime: 0,
      },
      sectorId: 'sector-1',
      aiState: 'PLANNING',
      combatEncounter: undefined,
      combatTarget: undefined,
    };
    world.add(pirate as Entity);

    // Savior (Hunter)
    const hunter: Partial<Entity> = {
      id: 'hunter-1',
      faction: 'BOUNTY_HUNTER',
      transform: { x: 60, y: 0, rotation: 0 }, // Close to pirate
      combatStats: {
        hp: 100,
        maxHp: 100,
        shields: 100,
        maxShields: 100,
        shieldRechargeRate: 10,
        lastDamageTime: 0,
      },
      sectorId: 'sector-1',
      aiState: 'PLANNING',
      combatEncounter: undefined,
      combatTarget: undefined,
    };
    world.add(hunter as Entity);

    // Mock Scene for Time
    const mockScene = { time: { now: 1000 } } as Phaser.Scene;

    // 2. Engage Pirate -> Trader
    // START BATTLE: Pirate Attacks Trader
    pirate.combatTarget = trader.id;
    // Run system to let it detect and lock
    combatSystem(mockScene, 16);

    // Verify Lock
    expect(pirate.aiState).toBe('COMBAT');
    expect(trader.aiState).toBe('COMBAT');
    expect(pirate.combatEncounter?.encounterId).toBeDefined();
    expect(trader.combatEncounter?.encounterId).toBe(pirate.combatEncounter!.encounterId);

    // 3. Engage Hunter -> Pirate
    hunter.combatTarget = pirate.id;
    // Run system to let hunter join
    mockScene.time.now += 1000;
    combatSystem(mockScene, 16);

    // Hunter should be attacking Pirate
    expect(hunter.aiState).toBe('COMBAT');
    expect(pirate.combatTarget).toBe(trader.id);

    // 4. Hunter Kills Pirate
    // Force Pirate HP low so next hit kills
    if (pirate.combatStats) pirate.combatStats.hp = 1;

    // Advance time to allow fire cooldown
    mockScene.time.now += 2000;
    combatSystem(mockScene, 16);

    // Pirate should be dead/removed
    const deadPirate = world.entities.find((e) => e.id === 'pirate-1');
    expect(deadPirate).toBeUndefined();

    // 5. CHECK TRADER STATUS
    // Trader should be released ('PLANNING')
    expect(trader.aiState).toBe('PLANNING');
    expect(trader.combatEncounter).toBeUndefined();
  });
});
