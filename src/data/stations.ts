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

export const STATION_CONFIGS: Record<StationType, StationConfig> = {
  trading: {
    type: 'trading',
    production: {
      produces: [
        { itemId: 'food', rate: 200 },
        { itemId: 'energy', rate: 200 },
      ],
      interval: 10000,
    },
    initInventory: { food: 5000, energy: 5000 },
  },
  mining_ore: {
    type: 'mining_ore',
    color: 0xffffff,
    production: {
      consumes: [
        { itemId: 'food', rate: 10 },
        { itemId: 'energy', rate: 10 },
      ],
      produces: [{ itemId: 'ore', rate: 100 }], // Batch 100
      interval: 15000, // 15s (Avg 6.6/s)
    },
    initInventory: { food: 500, energy: 500, ore: 0 },
  },
  mining_gas: {
    type: 'mining_gas',
    color: 0x00ff00,
    production: {
      consumes: [
        { itemId: 'food', rate: 10 },
        { itemId: 'energy', rate: 10 },
      ],
      produces: [{ itemId: 'gas', rate: 100 }], // Batch 100
      interval: 15000,
    },
    initInventory: { food: 500, energy: 500, gas: 0 },
  },
  mining_crystal: {
    type: 'mining_crystal',
    color: 0xd000ff,
    production: {
      consumes: [
        { itemId: 'food', rate: 10 },
        { itemId: 'energy', rate: 10 },
      ],
      produces: [{ itemId: 'crystal', rate: 50 }], // Batch 50
      interval: 20000, // 20s
    },
    initInventory: { food: 500, energy: 500, crystal: 0 },
  },
  factory_steel: {
    type: 'factory_steel',
    color: 0xffffff,
    production: {
      consumes: [
        { itemId: 'food', rate: 40 },
        { itemId: 'energy', rate: 40 },
        { itemId: 'ore', rate: 200 },
      ],
      produces: [{ itemId: 'steel', rate: 100 }],
      interval: 40000,
    },
    // Target: Ore 1000 (5 batches), Steel 500 (5 batches)
    initInventory: { food: 1000, energy: 1000, ore: 1000, steel: 500 },
  },
  factory_fuel: {
    type: 'factory_fuel',
    color: 0xffa500,
    production: {
      consumes: [
        { itemId: 'food', rate: 40 },
        { itemId: 'energy', rate: 40 },
        { itemId: 'gas', rate: 200 },
      ],
      produces: [{ itemId: 'fuel', rate: 80 }],
      interval: 40000,
    },
    // Target: Gas 1000, Fuel 400
    initInventory: { food: 1000, energy: 1000, gas: 1000, fuel: 400 },
  },
  factory_electronics: {
    type: 'factory_electronics',
    color: 0x00ffff,
    production: {
      consumes: [
        { itemId: 'food', rate: 40 },
        { itemId: 'energy', rate: 40 },
        { itemId: 'crystal', rate: 100 },
      ],
      produces: [{ itemId: 'electronics', rate: 50 }],
      interval: 40000,
    },
    // Target: Crystal 500, Elec 250
    initInventory: { food: 1000, energy: 1000, crystal: 500, electronics: 250 },
  },
  factory_engine: {
    type: 'factory_engine',
    color: 0xff4444,
    production: {
      consumes: [
        { itemId: 'food', rate: 60 },
        { itemId: 'energy', rate: 60 },
        { itemId: 'steel', rate: 80 },
        { itemId: 'fuel', rate: 40 },
      ],
      produces: [{ itemId: 'engine', rate: 20 }],
      interval: 40000,
    },
    // Target: Steel 800, Fuel 400, Engine 100
    initInventory: { food: 1000, energy: 1000, steel: 800, fuel: 400, engine: 100 },
  },
  factory_sensors: {
    type: 'factory_sensors',
    color: 0x44ff44,
    production: {
      consumes: [
        { itemId: 'food', rate: 60 },
        { itemId: 'energy', rate: 60 },
        { itemId: 'electronics', rate: 50 },
        { itemId: 'crystal', rate: 20 },
      ],
      produces: [{ itemId: 'sensors', rate: 20 }],
      interval: 40000,
    },
    // Target: Elec 500, Crystal 200, Sensors 100
    initInventory: { food: 1000, energy: 1000, electronics: 500, crystal: 200, sensors: 100 },
  },
  shipyard: {
    type: 'shipyard',
    color: 0xffffff,
    production: {
      consumes: [
        { itemId: 'food', rate: 100 },
        { itemId: 'energy', rate: 100 },
        { itemId: 'engine', rate: 10 },
        { itemId: 'sensors', rate: 10 },
        { itemId: 'steel', rate: 50 },
      ],
      produces: [{ itemId: 'spaceship', rate: 1 }],
      interval: 20000,
    },
    initInventory: {
      food: 5000,
      energy: 5000,
      engine: 200,
      sensors: 200,
      steel: 1000,
      spaceship: 0, // Rare item, expensive
    },
  },
};
