import type { ItemId } from './items';

export type StationType = 'trading' | 'factory' | 'mining';

export interface ProductionRule {
  consumes: { itemId: ItemId; rate: number }[]; // rate per tick? or per batch
  produces: { itemId: ItemId; rate: number }[];
  interval: number; // ms
}

export interface StationConfig {
  type: StationType;
  production?: ProductionRule;
  initInventory: Partial<Record<ItemId, number>>;
}

export const STATION_CONFIGS: Record<StationType, StationConfig> = {
  trading: {
    type: 'trading',
    // Trading stations (like Earth/Main) produce Food/Energy? Or just market?
    // Let's say they produce Food/Energy for now to feed the loop.
    production: {
      consumes: [{ itemId: 'goods', rate: 1 }],
      produces: [
        { itemId: 'food', rate: 10 },
        { itemId: 'energy', rate: 10 },
      ],
      interval: 2000,
    },
    initInventory: { food: 500, energy: 500, goods: 0 },
  },
  mining: {
    type: 'mining',
    production: {
      consumes: [
        { itemId: 'energy', rate: 1 },
        { itemId: 'food', rate: 1 },
      ],
      produces: [{ itemId: 'ore', rate: 2 }],
      interval: 1000,
    },
    initInventory: { food: 50, energy: 50, ore: 0 },
  },
  factory: {
    type: 'factory',
    production: {
      consumes: [
        { itemId: 'ore', rate: 2 },
        { itemId: 'energy', rate: 1 },
      ],
      produces: [{ itemId: 'goods', rate: 1 }],
      interval: 1000,
    },
    initInventory: { food: 100, energy: 100, ore: 0, goods: 0 },
  },
};
