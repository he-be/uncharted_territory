export type ItemId = 'ore' | 'food' | 'energy' | 'goods';

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
    description: 'Raw mineral mined from asteroids.',
  },
  food: {
    id: 'food',
    name: 'Synthetic Rations',
    basePrice: 5,
    description: 'Basic sustenance for station crews.',
  },
  energy: {
    id: 'energy',
    name: 'Fuel Cells',
    basePrice: 15,
    description: 'Standardized energy containers.',
  },
  goods: {
    id: 'goods',
    name: 'Consumer Goods',
    basePrice: 50,
    description: 'Processed items for daily life.',
  },
};
