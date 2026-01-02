import { world } from '../world';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS, getSectorWorldPosition, type UniverseSector } from '../../data/universe';
import { ITEMS, type ItemId } from '../../data/items';

// Configuration
const BASE_CHECK_INTERVAL = 60000; // 60s
const CHECK_VARIANCE = 10000; // +/- 10s
const TRADER_SPAWN_RATE = 0.05; // Chance per frame to spawn a trader (throttled)
const PIRATE_WEALTH_THRESHOLD = 200; // Wealth increase needed to spawn 1 pirate
const MAX_PIRATES_PER_WAVE = 5;
const BOUNTY_HUNTER_CHANCE = 0.3; // 30% chance per Pirate to spawn a Hunter

interface SectorState {
  lastCheckTime: number;
  nextCheckInterval: number;
  lastTotalWealth: number;
}

let traderCount = 0;
let initialized = false;

// Optimization: Cached counts
const updateCounts = () => {
  traderCount = 0;
  for (const e of world.entities) {
    if (e.faction === 'TRADER') traderCount++;
  }
};

const sectorStates = new Map<string, SectorState>();

export const npcSpawnerSystem = (scene: Phaser.Scene) => {
  const now = scene.time.now;
  const existingNpcs = world.with('aiState');
  const maxNpcs = 300; // Increased limit

  // Initialize Sector States if needed
  if (sectorStates.size === 0) {
    SECTORS.forEach((s) => {
      sectorStates.set(s.id, {
        lastCheckTime: now,
        nextCheckInterval:
          BASE_CHECK_INTERVAL + (Math.random() * CHECK_VARIANCE * 2 - CHECK_VARIANCE),
        lastTotalWealth: calculateSectorWealth(s.id),
      });
    });
  }

  // Initialize Spawner subscriptions
  if (!initialized) {
    updateCounts(); // Initial count
    world.onEntityAdded.subscribe((e) => {
      if (e.faction === 'TRADER') traderCount++;
    });
    world.onEntityRemoved.subscribe((e) => {
      if (e.faction === 'TRADER') traderCount--;
    });
    initialized = true;
  }

  // 1. Trader Spawning (Baseline Activity)
  // Simple random spawning to keep economy moving
  if (existingNpcs.size < maxNpcs) {
    if (Math.random() < TRADER_SPAWN_RATE) {
      // Check SPECIFIC Trader Cap (Optimized)
      const MAX_TRADERS = 250;
      if (traderCount < MAX_TRADERS) {
        spawnTrader(scene);
      }
    }
  }

  // 2. Dynamic Spawning Logic
  for (const sector of SECTORS) {
    const state = sectorStates.get(sector.id)!;

    if (now - state.lastCheckTime > state.nextCheckInterval) {
      // Time to check this sector
      const currentWealth = calculateSectorWealth(sector.id);
      const deltaWealth = currentWealth - state.lastTotalWealth;

      console.log(
        `[Spawner] Checking ${sector.name}: Wealth ${currentWealth} (Delta: ${deltaWealth})`
      );

      // A. Pirate Spawning (Based on Wealth Increase)
      if (deltaWealth > 0) {
        const piratesToSpawn = Math.min(
          Math.floor(deltaWealth / PIRATE_WEALTH_THRESHOLD),
          MAX_PIRATES_PER_WAVE
        );

        if (piratesToSpawn > 0) {
          console.log(
            `[Spawner] Wealth Spike in ${sector.name}! Attempting to spawn ${piratesToSpawn} Pirates.`
          );
          for (let i = 0; i < piratesToSpawn; i++) {
            if (existingNpcs.size < maxNpcs) {
              spawnShip(scene, sector, 'PIRATE');
            } else {
              console.log('[Spawner] NPC Cap Reached. Skipping Pirate Spawn.');
              break;
            }
          }
        }
      }

      // B. Bounty Hunter Spawning (Counter-Piracy)
      // Count pirates in this sector
      let pirateCount = 0;
      for (const e of world.with('faction', 'sectorId')) {
        if (e.faction === 'PIRATE' && e.sectorId === sector.id) {
          pirateCount++;
        }
      }

      if (pirateCount > 0) {
        // Chance to spawn BH based on pirate count
        // e.g. 3 pirates => 3 checks
        for (let i = 0; i < pirateCount; i++) {
          if (Math.random() < BOUNTY_HUNTER_CHANCE) {
            if (existingNpcs.size < maxNpcs) {
              console.log(
                `[Spawner] Pirate activity detected in ${sector.name}. Dispatching Bounty Hunter.`
              );
              spawnShip(scene, sector, 'BOUNTY_HUNTER');
            } else {
              console.log('[Spawner] NPC Cap Reached. Skipping Bounty Hunter Spawn.');
              break;
            }
          }
        }
      }

      // Update State
      state.lastCheckTime = now;
      state.lastTotalWealth = currentWealth;
      state.nextCheckInterval =
        BASE_CHECK_INTERVAL + (Math.random() * CHECK_VARIANCE * 2 - CHECK_VARIANCE);
    }
  }
};

// Helper: Calculate Total Wealth in Sector (Stations + Traders)
const calculateSectorWealth = (sectorId: string): number => {
  let total = 0;
  // Stations
  for (const s of world.with('station', 'wallet', 'inventory', 'sectorId')) {
    if (s.sectorId === sectorId) {
      total += s.wallet || 0;
      if (s.inventory) {
        for (const [id, count] of Object.entries(s.inventory)) {
          const item = ITEMS[id as ItemId];
          if (item) total += count * item.basePrice;
        }
      }
    }
  }
  // Traders (Only count goods, not abstract wallet for now as it fluctuates too wildly? No, verify wallet growth)
  for (const t of world.with('faction', 'totalProfit', 'sectorId')) {
    if (t.sectorId === sectorId && t.faction === 'TRADER') {
      total += t.totalProfit || 0;
    }
  }
  return total;
};

// Helper: Spawn Trader (Random Sector)
const spawnTrader = (scene: Phaser.Scene) => {
  const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
  spawnShip(scene, sector, 'TRADER');
};

// Generic Ship Spawner
const spawnShip = (
  scene: Phaser.Scene,
  sector: UniverseSector,
  faction: 'TRADER' | 'PIRATE' | 'BOUNTY_HUNTER'
) => {
  const sectorPos = getSectorWorldPosition(sector);

  // Random Pos in sector
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 4000;
  const x = sectorPos.x + Math.cos(angle) * radius;
  const y = sectorPos.y + Math.sin(angle) * radius;

  let spriteKey = 'npc_trader';
  if (faction === 'PIRATE') spriteKey = 'npc_pirate';
  if (faction === 'BOUNTY_HUNTER') spriteKey = 'npc_fighter';

  const sprite = scene.add.sprite(x, y, spriteKey);
  sprite.setScale(0.12);
  sprite.setDepth(2);

  // Stats based on faction
  let hp = 100;
  let shields = 50;
  let speed = 100;

  if (faction === 'PIRATE') {
    hp = 120;
    shields = 60;
    speed = 120;
  } else if (faction === 'BOUNTY_HUNTER') {
    hp = 200; // Stronger
    shields = 150;
    speed = 140; // Faster
  }

  world.add({
    id: uuidv4(),
    transform: { x, y, rotation: angle },
    velocity: { vx: 0, vy: 0 },
    sprite: sprite,
    aiState: 'PLANNING',
    speedStats: { maxSpeed: speed, acceleration: 100 },
    cargo: {},
    wallet: 1000,
    totalProfit: 0, // Track accumulation
    sectorId: sector.id,
    faction: faction,
    combatStats: {
      hp,
      maxHp: hp,
      shields,
      maxShields: shields,
      shieldRechargeRate: 5,
    },
    piracy: faction === 'PIRATE' ? { revenue: 0 } : undefined,
  });
};
