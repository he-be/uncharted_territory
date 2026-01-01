import { ITEMS, type ItemId } from '../data/items';
import { STATION_CONFIGS, type StationType } from '../data/stations';
import type { Entity } from '../ecs/world';

export const calculatePrice = (station: Entity, itemId: ItemId): number => {
  const itemDef = ITEMS[itemId];
  if (!itemDef) return 0;

  const basePrice = itemDef.basePrice;

  // Get Target Stock from static config
  // Use a fallback target if not defined to avoid division by zero or weirdness
  const stationType = station.stationType as StationType;
  const config = STATION_CONFIGS[stationType];

  // Default target to 100 if missing (should not happen if data is correct)
  const targetStock = config?.initInventory?.[itemId] || 100;

  const currentStock = station.inventory?.[itemId] || 0;

  // Formula: Price = Base * (2.0 - (Current / Target))
  // Logic:
  // If Current == 0, Mult = 2.0 (Double Price)
  // If Current == Target, Mult = 1.0 (Base Price)
  // If Current == 2*Target, Mult = 0.0 (Free? We should clamp)

  let multiplier = 2.0 - currentStock / targetStock;

  // Clamp: Min 0.1x (Don't give it away for free), Max 2.0x
  if (multiplier < 0.1) multiplier = 0.1;
  if (multiplier > 2.0) multiplier = 2.0;

  return Math.max(1, Math.round(basePrice * multiplier));
};
