import {
  DRONE_SPECS,
  DroneTier,
  type NpcState,
  INITIAL_CAPACITY,
  CAPACITY_EXPANSION_COST_FACTOR,
} from './combat/types';

// Utils
const randomNormal = (mean: number, stdDev: number) => {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
};

// Simulation Parameters
const SIM_DAYS = 365;
const NPC_COUNT = 100;
const TRADER_RATIO = 0.8;

// Income Config
const TRADER_INCOME = { mean: 500, std: 200 };
const PIRATE_INCOME = { mean: 400, std: 600 }; // High volatility

// Setup
const npcs: NpcState[] = [];

for (let i = 0; i < NPC_COUNT; i++) {
  const isTrader = Math.random() < TRADER_RATIO;
  npcs.push({
    id: `npc_${i}`,
    role: isTrader ? 'TRADER' : 'PIRATE',
    wealth: 1000, // Initial seed
    droneCapacity: INITIAL_CAPACITY,
    drones: {
      [DroneTier.T1]: 0,
      [DroneTier.T2]: 0,
      [DroneTier.T3]: 0,
      [DroneTier.T4]: 0,
      [DroneTier.T5]: 0,
    },
  });
}

// Logic
const getUpkeep = (npc: NpcState): number => {
  let cost = 0;
  for (const t of Object.values(DroneTier)) {
    if (typeof t === 'number') {
      const count = npc.drones[t as DroneTier] || 0;
      cost += count * DRONE_SPECS[t as DroneTier].upkeep;
    }
  }
  return cost;
};

const getTotalDrones = (npc: NpcState): number => {
  let count = 0;
  for (const val of Object.values(npc.drones)) count += val;
  return count;
};

const simulateDay = (_day: number) => {
  for (const npc of npcs) {
    // 1. Income
    const incomeConfig = npc.role === 'TRADER' ? TRADER_INCOME : PIRATE_INCOME;
    const income = Math.max(0, Math.floor(randomNormal(incomeConfig.mean, incomeConfig.std)));
    npc.wealth += income;

    // 2. Upkeep
    const upkeep = getUpkeep(npc);
    npc.wealth -= upkeep;

    // 3. Bankruptcy / Downsizing
    if (npc.wealth < 0) {
      // Must scrap drones to pay debt (or just lose them)
      // Logic: Scrap efficient drones? Or random?
      // Scrap T1s first (low value)? Or T3 (high upkeep)?
      // Let's say we scrap from Lowest Tier up to maintain quality, OR Highest Tier to save massive upkeep?
      // To recover positive balance quickly, scrapping high upkeep is better.
      // But scraping T3 is a huge loss of asset value.
      // Let's scrap randomly for now until cost covered (simulating fire sale).
      // Actually simple rule: Scrap 1 drone at a time (Highest Upkeep) until wealth >= 0?
      // Or just remove drones until upkeep < 0? No, wealth is already negative.
      // We assume negative wealth forces emergency sale at 50% cost.

      while (npc.wealth < 0 && getTotalDrones(npc) > 0) {
        // Find expensive drone
        let scrapped = false;
        for (let t = DroneTier.T5; t >= DroneTier.T1; t--) {
          if (npc.drones[t] > 0) {
            npc.drones[t]--;
            npc.wealth += DRONE_SPECS[t].cost * 0.5; // Sell back
            scrapped = true;
            break;
          }
        }
        if (!scrapped) break; // Should not happen if count > 0
      }

      if (npc.wealth < 0) npc.wealth = 0; // Reset if still underwater (bankruptcy protection/bailout)
    }

    // 4. Expansion / Replenishment
    // Target Tier based on role? Or just buy what's affordable?
    // Traders prefer T1/T2 (Escort). Pirates prefer T1/T3 (Attack).
    // Simple logic: Fill capacity with Best Affordable.

    // First, Expansion check
    const currentCount = getTotalDrones(npc);
    if (currentCount >= npc.droneCapacity) {
      // Try expand
      const expansionCost = CAPACITY_EXPANSION_COST_FACTOR * (npc.droneCapacity / 5);
      if (npc.wealth > expansionCost * 1.5) {
        // Keep buffer
        npc.wealth -= expansionCost;
        npc.droneCapacity += 5;
        // console.log(`[Day ${day}] ${npc.role} expanded capacity to ${npc.droneCapacity}`);
      }
    }

    // Replenish
    if (currentCount < npc.droneCapacity) {
      // Purchase logic
      // Try to buy highest tier possible with 50% of current wealth?
      // Or fill slots?
      const slots = npc.droneCapacity - currentCount;
      for (let i = 0; i < slots; i++) {
        // Decide Tier: Random weighted by wealth?
        // If Rich (>5000), buy T3. If (>1000) T2. Else T1.
        let targetTier = DroneTier.T1;
        if (npc.wealth > 10000) targetTier = DroneTier.T3;
        else if (npc.wealth > 2000) targetTier = DroneTier.T2;

        if (npc.wealth > DRONE_SPECS[targetTier].cost) {
          npc.wealth -= DRONE_SPECS[targetTier].cost;
          npc.drones[targetTier]++;
        }
      }
    }
  }
};

// Report
console.log('--- Simulation Start ---');
for (let _d = 0; _d < SIM_DAYS; _d++) {
  simulateDay(_d);
  if (_d % 30 === 0) {
    const avgWealth = npcs.reduce((pom, n) => pom + n.wealth, 0) / NPC_COUNT;
    const avgDrones = npcs.reduce((pom, n) => pom + getTotalDrones(n), 0) / NPC_COUNT;
    console.log(
      `Day ${_d}: Avg Wealth: ${avgWealth.toFixed(0)}, Avg Drones: ${avgDrones.toFixed(1)}`
    );
  }
}

console.log('--- Final Stats ---');
// Breakdown by Role
const traders = npcs.filter((n) => n.role === 'TRADER');
const pirates = npcs.filter((n) => n.role === 'PIRATE');

const printStats = (label: string, list: NpcState[]) => {
  const avgWealth = list.reduce((pom, n) => pom + n.wealth, 0) / list.length;
  const avgCap = list.reduce((pom, n) => pom + n.droneCapacity, 0) / list.length;

  let t1 = 0,
    t2 = 0,
    t3 = 0;
  list.forEach((n) => {
    t1 += n.drones[DroneTier.T1];
    t2 += n.drones[DroneTier.T2];
    t3 += n.drones[DroneTier.T3];
  });
  const count = list.length;

  console.log(`${label} (n=${count}):`);
  console.log(`  Wealth: ${avgWealth.toFixed(0)}`);
  console.log(`  Capacity: ${avgCap.toFixed(1)}`);
  console.log(
    `  Fleet Composition: T1=${(t1 / count).toFixed(1)}, T2=${(t2 / count).toFixed(1)}, T3=${(t3 / count).toFixed(1)}`
  );
};

printStats('TRADERS', traders);
printStats('PIRATES', pirates);
