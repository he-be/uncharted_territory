import type { ItemId } from './items';

export type StationType =
  | 'trading'
  | 'mining_ore'
  | 'mining_gas'
  | 'mining_crystal'
  | 'factory_steel'
  | 'factory_fuel'
  | 'factory_electronics'
  | 'factory_engine'
  | 'factory_sensors'
  | 'shipyard';

export interface ProductionRule {
  consumes?: { itemId: ItemId; rate: number }[];
  produces?: { itemId: ItemId; rate: number }[];
  interval: number; // ms
}

export interface StationConfig {
  type: StationType;
  color?: number; // visual tint
  production?: ProductionRule;
  initInventory: Partial<Record<ItemId, number>>;
}

const COMMON_CONSUMPTION = [
  { itemId: 'food' as ItemId, rate: 1 },
  { itemId: 'energy' as ItemId, rate: 1 },
];

export const STATION_CONFIGS: Record<StationType, StationConfig> = {
  trading: {
    type: 'trading',
    production: {
      produces: [
        { itemId: 'food', rate: 50 },
        { itemId: 'energy', rate: 50 },
      ], // Source of life
      interval: 5000,
    },
    initInventory: { food: 1000, energy: 1000 },
  },
  mining_ore: {
    type: 'mining_ore',
    color: 0xffffff,
    production: {
      consumes: COMMON_CONSUMPTION,
      produces: [{ itemId: 'ore', rate: 5 }],
      interval: 2000,
    },
    initInventory: { food: 100, energy: 100, ore: 0 },
  },
  mining_gas: {
    type: 'mining_gas',
    color: 0x00ff00, // Green
    production: {
      consumes: COMMON_CONSUMPTION,
      produces: [{ itemId: 'gas', rate: 5 }],
      interval: 2000,
    },
    initInventory: { food: 100, energy: 100, gas: 0 },
  },
  mining_crystal: {
    type: 'mining_crystal',
    color: 0xd000ff, // Purple
    production: {
      consumes: COMMON_CONSUMPTION,
      produces: [{ itemId: 'crystal', rate: 3 }],
      interval: 3000,
    },
    initInventory: { food: 100, energy: 100, crystal: 0 },
  },
  factory_steel: {
    type: 'factory_steel',
    color: 0xffffff,
    production: {
      consumes: [...COMMON_CONSUMPTION, { itemId: 'ore', rate: 5 }],
      produces: [{ itemId: 'steel', rate: 2 }],
      interval: 3000,
    },
    initInventory: { food: 100, energy: 100, ore: 0, steel: 0 },
  },
  factory_fuel: {
    type: 'factory_fuel',
    color: 0xffa500, // Orange
    production: {
      consumes: [...COMMON_CONSUMPTION, { itemId: 'gas', rate: 5 }],
      produces: [{ itemId: 'fuel', rate: 2 }],
      interval: 3000,
    },
    initInventory: { food: 100, energy: 100, gas: 0, fuel: 0 },
  },
  factory_electronics: {
    type: 'factory_electronics',
    color: 0x00ffff, // Cyan
    production: {
      consumes: [...COMMON_CONSUMPTION, { itemId: 'crystal', rate: 5 }],
      produces: [{ itemId: 'electronics', rate: 2 }],
      interval: 4000,
    },
    initInventory: { food: 100, energy: 100, crystal: 0, electronics: 0 },
  },
  factory_engine: {
    type: 'factory_engine',
    color: 0xff4444, // Red
    production: {
      consumes: [...COMMON_CONSUMPTION, { itemId: 'steel', rate: 2 }, { itemId: 'fuel', rate: 2 }],
      produces: [{ itemId: 'engine', rate: 1 }],
      interval: 5000,
    },
    initInventory: { food: 100, energy: 100, steel: 0, fuel: 0, engine: 0 },
  },
  factory_sensors: {
    type: 'factory_sensors',
    color: 0x44ff44, // Green
    production: {
      consumes: [
        ...COMMON_CONSUMPTION,
        { itemId: 'electronics', rate: 2 },
        { itemId: 'crystal', rate: 1 },
      ],
      produces: [{ itemId: 'sensors', rate: 1 }],
      interval: 5000,
    },
    initInventory: { food: 100, energy: 100, electronics: 0, crystal: 0, sensors: 0 },
  },
  shipyard: {
    type: 'shipyard',
    color: 0xffffff,
    production: {
      consumes: [
        ...COMMON_CONSUMPTION,
        { itemId: 'engine', rate: 1 },
        { itemId: 'sensors', rate: 1 },
        { itemId: 'steel', rate: 5 }, // Hull
      ],
      produces: [{ itemId: 'spaceship', rate: 1 }],
      interval: 10000,
    },
    initInventory: {
      food: 500,
      energy: 500,
      engine: 10,
      sensors: 10,
      steel: 50,
      spaceship: 0,
    },
  },
};
