import { world } from '../world';
import { v4 as uuidv4 } from 'uuid';
import { SECTORS, getSectorWorldPosition, type UniverseSector } from '../../data/universe';
import { ITEMS, type ItemId } from '../../data/items';

// Configuration
const BASE_CHECK_INTERVAL = 60000; // 60s
const CHECK_VARIANCE = 10000; // +/- 10s
const PIRATE_WEALTH_THRESHOLD = 15000; // Wealth increase needed to spawn 1 pirate (Increased 5x)
const MAX_PIRATES_PER_WAVE = 5;
const BOUNTY_HUNTER_CHANCE = 0.4; // 50% chance per Pirate to spawn a Hunter
const PIRATE_GRACE_PERIOD = 120000; // 2 minutes

interface SectorState {
  lastCheckTime: number;
  nextCheckInterval: number;
  lastTotalWealth: number;
}

let traderCount = 0;
let initialized = false;
let initialSpawningDone = false;

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
  const maxNpcs = 200; // Optimal fleet size for Cargo 100

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

  // Initial Fixed Spawn (3 Traders per Sector)
  if (!initialSpawningDone) {
    initialSpawningDone = true;
    SECTORS.forEach((sector) => {
      for (let i = 0; i < 3; i++) {
        spawnShip(scene, sector, 'TRADER');
      }
    });
    console.log('[Spawner] Initial Deployment: 3 Traders per sector.');
  }

  // 1. Trader Spawning (Production Based + Fallback)
  if (existingNpcs.size < maxNpcs) {
    // A. Production Based (Check Shipyards)
    const shipyards = world.with('stationType', 'inventory', 'sectorId', 'transform');
    for (const shipyard of shipyards) {
      if (shipyard.stationType === 'shipyard' && (shipyard.inventory['spaceship'] || 0) >= 1) {
        // Produce a ship!
        shipyard.inventory['spaceship']! -= 1;
        const s = SECTORS.find((sec) => sec.id === shipyard.sectorId);
        if (s) {
          spawnShip(scene, s, 'TRADER', shipyard.transform.x, shipyard.transform.y);
          // console.log(`[Spawner] Shipyard produced a TRADER in ${s.name}`);
        }
      }
    }

    // B. Fallback (Extinction Prevention)
    const MIN_TRADERS = 10;
    // Low chance fallback if population is critically low
    if (traderCount < MIN_TRADERS) {
      if (Math.random() < 0.05) {
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

      // A. Pirate Spawning (Based on Wealth Increase)
      // ** CHECK: GRACE PERIOD **
      if (now > PIRATE_GRACE_PERIOD) {
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
                break;
              }
            }
          }
        }
      }
      /* else {
         // console.log(`[Spawner] Pirate spawn suppressed (Grace Period: ${(PIRATE_GRACE_PERIOD - now)/1000}s left)`);
      } */

      // B. Bounty Hunter Spawning (Counter-Piracy)
      // Global Cap Check
      let totalHunters = 0;
      for (const e of world.with('faction')) {
        if (e.faction === 'BOUNTY_HUNTER') totalHunters++;
      }
      const GLOBAL_HUNTER_CAP = SECTORS.length * 3; // Cap: 3 per sector avg

      let pirateCount = 0;
      for (const e of world.with('faction', 'sectorId')) {
        if (e.faction === 'PIRATE' && e.sectorId === sector.id) {
          pirateCount++;
        }
      }

      if (pirateCount > 0 && totalHunters < GLOBAL_HUNTER_CAP) {
        for (let i = 0; i < pirateCount; i++) {
          if (Math.random() < BOUNTY_HUNTER_CHANCE) {
            if (existingNpcs.size < maxNpcs) {
              console.log(
                `[Spawner] Pirate activity detected in ${sector.name}. Dispatching Bounty Hunter.`
              );
              spawnShip(scene, sector, 'BOUNTY_HUNTER');
            } else {
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
  faction: 'TRADER' | 'PIRATE' | 'BOUNTY_HUNTER',
  startX?: number,
  startY?: number
) => {
  const sectorPos = getSectorWorldPosition(sector);

  let x: number, y: number;
  const angle = Math.random() * Math.PI * 2;

  if (startX !== undefined && startY !== undefined) {
    x = startX;
    y = startY;
  } else {
    // Random Pos in sector
    const radius = Math.random() * 4000;
    x = sectorPos.x + Math.cos(angle) * radius;
    y = sectorPos.y + Math.sin(angle) * radius;
  }

  let spriteKey = 'npc_trader';
  if (faction === 'PIRATE') spriteKey = 'npc_pirate';
  if (faction === 'BOUNTY_HUNTER') spriteKey = 'npc_fighter';

  const sprite = scene.add.sprite(x, y, spriteKey);
  sprite.setScale(0.12);
  sprite.setDepth(2);

  // Stats based on faction
  let hp = 100;
  let shields = 50;
  let speed = 250; // +50%

  if (faction === 'PIRATE') {
    hp = 120;
    shields = 60;
    speed = 300; // +50%
  } else if (faction === 'BOUNTY_HUNTER') {
    hp = 200; // Stronger
    shields = 150;
    speed = 350; // +50%
  }

  world.add({
    id: uuidv4(),
    transform: { x, y, rotation: angle },
    velocity: { vx: 0, vy: 0 },
    sprite: sprite,
    aiState: 'PLANNING',
    speedStats: { maxSpeed: speed, acceleration: 100 },
    cargo: {},
    cargoCapacity: 100, // Updated to 100 (High Capacity Fleet)
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
