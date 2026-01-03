export enum DroneTier {
  T1 = 1,
  T2 = 2,
  T3 = 3,
  T4 = 4,
  T5 = 5,
}

export interface DroneConfig {
  tier: DroneTier;
  cost: number;
  upkeep: number; // Daily energy cost
  power: number; // Combat power
}

// Configuration from Design Doc
export const DRONE_SPECS: Record<DroneTier, DroneConfig> = {
  [DroneTier.T1]: { tier: DroneTier.T1, cost: 100, upkeep: 1, power: 10 },
  [DroneTier.T2]: { tier: DroneTier.T2, cost: 300, upkeep: 3, power: 35 }, // 3.5x power for 3x cost
  [DroneTier.T3]: { tier: DroneTier.T3, cost: 800, upkeep: 8, power: 100 }, // 10x power for 8x cost
  [DroneTier.T4]: { tier: DroneTier.T4, cost: 2500, upkeep: 25, power: 350 },
  [DroneTier.T5]: { tier: DroneTier.T5, cost: 10000, upkeep: 100, power: 1500 },
};

export interface NpcState {
  id: string;
  role: 'TRADER' | 'PIRATE';
  wealth: number;
  droneCapacity: number;
  drones: Record<DroneTier, number>; // Count per tier
}

export const INITIAL_CAPACITY = 10;
export const CAPACITY_EXPANSION_COST_FACTOR = 2000; // * (capacity / 5)
