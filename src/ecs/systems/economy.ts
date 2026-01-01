import { world } from '../world';
// import type { ItemId } from '../../data/items';

// Economy System
// Handles production and consumption cycles for stations.

export const economySystem = (time: number, _delta: number) => {
  const stations = world.with('station', 'productionConfig', 'inventory');

  for (const entity of stations) {
    if (!entity.lastProductionTick) entity.lastProductionTick = 0;

    const rule = entity.productionConfig!; // we verified existence with query

    if (time - entity.lastProductionTick > rule.interval) {
      entity.lastProductionTick = time;

      // 1. Check Consumption
      let canProduce = true;
      if (rule.consumes) {
        for (const input of rule.consumes) {
          const currentStock = entity.inventory![input.itemId] || 0;
          if (currentStock < input.rate) {
            canProduce = false;
            // Log/Debug: Shortage of input
            break;
          }
        }
      }

      // 2. Consume & Produce
      if (canProduce) {
        // Consume
        if (rule.consumes) {
          for (const input of rule.consumes) {
            entity.inventory![input.itemId]! -= input.rate;
          }
        }

        // Produce
        if (rule.produces) {
          for (const output of rule.produces) {
            // Initialize if missing (though it should be in defined keys ideally)
            if (entity.inventory![output.itemId] === undefined) {
              entity.inventory![output.itemId] = 0;
            }
            entity.inventory![output.itemId]! += output.rate;
          }
        }
      } else {
        // Optional: Natural Degradation or "Hunger"?
        // For now, if factory stops, it just stops.
      }

      // Natural Consumption (Simulate demand sinking items like food/energy)
      // This is a separate logic from 'production consumption'.
      // For simplicity, let's say ALL stations consume 1 Food and 1 Energy every 10 seconds (Separate tick?)
      // Or just hardcode minimal survival consumption here for now?
      // Let's stick to the defined rules in `data/stations.ts` which merge inputs and lifecycle needs.
    }
  }
};
