import { DRONE_SPECS, DroneTier, type DroneConfig } from './combat/types';

interface CombatFleet {
  name: string;
  drones: Record<DroneTier, number>;
}

const getFleetPower = (fleet: CombatFleet): number => {
  let power = 0;
  for (const t of Object.values(DroneTier)) {
    if (typeof t === 'number') {
      const count = fleet.drones[t as DroneTier] || 0;
      power += count * DRONE_SPECS[t as DroneTier].power;
    }
  }
  return power;
};

const getFleetHealth = (fleet: CombatFleet): number => {
  // Assumption: HP is proportional to cost/10 for now? Or just tracked as "Drone Count"
  // For auto-resolve, we often just use "HP = Drone Count" and Probability of kill per tick.
  // BUT, higher tier drones should be harder to kill.
  // Let's assume Auto-Resolve uses "Fleet HP" where T1=10hp, T2=30hp, T3=100hp (matching cost roughly)
  let hp = 0;
  for (const t of Object.values(DroneTier)) {
    if (typeof t === 'number') {
      const count = fleet.drones[t as DroneTier] || 0;
      // HP roughly Cost / 10
      const unitHp = DRONE_SPECS[t as DroneTier].cost / 10;
      hp += count * unitHp;
    }
  }
  return hp;
};

const simulateBattle = (
  fleetA: CombatFleet,
  fleetB: CombatFleet
): { winner: string; rounds: number; remainingPercent: number } => {
  // Clone to avoid mutating original for repeat runs
  let hpA = getFleetHealth(fleetA);
  let hpB = getFleetHealth(fleetB);
  const maxHpA = hpA;
  const maxHpB = hpB;

  let powerA = getFleetPower(fleetA);
  let powerB = getFleetPower(fleetB);

  let rounds = 0;
  while (hpA > 0 && hpB > 0 && rounds < 1000) {
    rounds++;

    // Damage Calculation
    // Random fluctuation 0.8 - 1.2
    const dmgA = powerA * (0.8 + Math.random() * 0.4) * 0.1; // 10% of power applied as damage per round?
    const dmgB = powerB * (0.8 + Math.random() * 0.4) * 0.1;

    hpB -= dmgA;
    hpA -= dmgB;

    // In a real sim, power would degrade as HP (drones) are lost.
    // Let's model that linear degradation.
    powerA = (hpA / maxHpA) * getFleetPower(fleetA);
    powerB = (hpB / maxHpB) * getFleetPower(fleetB);

    if (powerA < 0) powerA = 0;
    if (powerB < 0) powerB = 0;
  }

  if (hpA > 0) return { winner: fleetA.name, rounds, remainingPercent: hpA / maxHpA };
  return { winner: fleetB.name, rounds, remainingPercent: hpB / maxHpB };
};

const runScenario = (name: string, fA: CombatFleet, fB: CombatFleet, iterations = 100) => {
  let winsA = 0;
  let totalRounds = 0;
  let totalRem = 0;

  for (let i = 0; i < iterations; i++) {
    const res = simulateBattle(fA, fB);
    if (res.winner === fA.name) {
      winsA++;
      totalRem += res.remainingPercent;
    }
    totalRounds += res.rounds;
  }

  console.log(`Scenario: ${name}`);
  console.log(`  ${fA.name} Win Rate: ${((winsA / iterations) * 100).toFixed(1)}%`);
  console.log(`  Avg Rounds: ${(totalRounds / iterations).toFixed(1)}`);

  console.log(`  Avg Winner Remaining HP: ${((totalRem / Math.max(1, winsA)) * 100).toFixed(1)}%`);
  console.log('------------------------------------------------');
};

// Scenarios
// 1. Baseline
const s1_A: CombatFleet = {
  name: '10 T1',
  drones: { [DroneTier.T1]: 10 } as Record<DroneTier, number>,
};
const s1_B: CombatFleet = {
  name: '10 T1 (B)',
  drones: { [DroneTier.T1]: 10 } as Record<DroneTier, number>,
};

// 2. Quantity (20 T1) vs Quality (10 T2)
// Cost: 2000 vs 3000
const s2_A: CombatFleet = {
  name: '20 T1',
  drones: { [DroneTier.T1]: 20 } as Record<DroneTier, number>,
};
const s2_B: CombatFleet = {
  name: '10 T2',
  drones: { [DroneTier.T2]: 10 } as Record<DroneTier, number>,
};

// 3. Swarm (30 T1) vs Elite (5 T3)
// Cost: 3000 vs 4000
const s3_A: CombatFleet = {
  name: '30 T1',
  drones: { [DroneTier.T1]: 30 } as Record<DroneTier, number>,
};
const s3_B: CombatFleet = {
  name: '5 T3',
  drones: { [DroneTier.T3]: 5 } as Record<DroneTier, number>,
};

console.log('--- Combat Balance Simulation ---');
runScenario('Baseline Equal', s1_A, s1_B);
runScenario('Quantity (20 T1) vs Quality (10 T2)', s2_A, s2_B);
runScenario('Swarm (30 T1) vs Elite (5 T3)', s3_A, s3_B);
