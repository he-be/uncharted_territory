export type ItemId =
  | 'ore'
  | 'gas'
  | 'crystal'
  | 'steel'
  | 'fuel'
  | 'electronics'
  | 'engine'
  | 'sensors'
  | 'spaceship'
  | 'food'
  | 'energy';

export interface Item {
  id: ItemId;
  name: string;
  basePrice: number;
  description: string;
}

export const ITEMS: Record<ItemId, Item> = {
  ore: {
    id: 'ore',
    name: 'Iron Ore',
    basePrice: 10,
    description: 'Raw iron mined from asteroids.',
  },
  gas: {
    id: 'gas',
    name: 'Tibanna Gas',
    basePrice: 15,
    description: 'Volatile gas cloud harvest.',
  },
  crystal: {
    id: 'crystal',
    name: 'Kyber Crystal',
    basePrice: 20,
    description: 'Rare resonant crystals.',
  },
  steel: {
    id: 'steel',
    name: 'Reinforced Steel',
    basePrice: 40,
    description: 'Refined alloy for construction.',
  },
  fuel: { id: 'fuel', name: 'Hyper Fuel', basePrice: 50, description: 'Refined fuel for engines.' },
  electronics: {
    id: 'electronics',
    name: 'Microchips',
    basePrice: 60,
    description: 'Advanced computing logic.',
  },
  engine: {
    id: 'engine',
    name: 'Ion Engine',
    basePrice: 200,
    description: 'Starship propulsion system.',
  },
  sensors: {
    id: 'sensors',
    name: 'Sensor Array',
    basePrice: 200,
    description: 'Long-range scanner suite.',
  },
  spaceship: {
    id: 'spaceship',
    name: 'Starship Hull',
    basePrice: 2000,
    description: 'A spaceworthy vessel.',
  },
  food: { id: 'food', name: 'Rations', basePrice: 5, description: 'Crew sustenance.' },
  energy: {
    id: 'energy',
    name: 'Energy Cells',
    basePrice: 10,
    description: 'Universal power units.',
  },
};
