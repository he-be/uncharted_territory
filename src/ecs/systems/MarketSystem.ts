import { world } from '../world';
import { STATION_CONFIGS, type StationType } from '../../data/stations';
import { calculatePrice } from '../../utils/economyUtils';
import { findPath } from '../../utils/pathfinding';
import type { ItemId } from '../../data/items';
import Phaser from 'phaser';

export interface TradeRoute {
  buyStationId: string;
  sellStationId: string;
  itemId: ItemId;
  expectedProfit: number;
  score: number;
  distance: number;
}

const UPDATE_INTERVAL = 5000; // 5 seconds
let lastUpdate = 0;
let bestRoutes: TradeRoute[] = [];

export const MarketSystem = {
  update: (time: number) => {
    if (time - lastUpdate < UPDATE_INTERVAL) return;
    lastUpdate = time;

    const stations = world.with('station', 'transform', 'stationType', 'inventory', 'sectorId');
    const stationList = Array.from(stations);
    const routes: TradeRoute[] = [];

    // Pre-calculate routes (O(N^2) but only once every 5 seconds)
    for (const producer of stationList) {
      const pConfig = STATION_CONFIGS[producer.stationType as StationType];
      if (!pConfig.production?.produces) continue;

      for (const production of pConfig.production.produces) {
        const itemId = production.itemId;
        const stock = producer.inventory?.[itemId] || 0;
        if (stock <= 0) continue;

        const buyPrice = calculatePrice(producer, itemId);

        for (const consumer of stationList) {
          if (producer === consumer) continue;

          const cConfig = STATION_CONFIGS[consumer.stationType as StationType];
          const consumes = cConfig.production?.consumes?.some((c) => c.itemId === itemId);

          if (consumes) {
            const sellPrice = calculatePrice(consumer, itemId);
            const profitPerUnit = sellPrice - buyPrice;

            if (profitPerUnit > 0) {
              // Approximate distance
              let dist = 1000; // Default same sector approx
              if (producer.sectorId !== consumer.sectorId) {
                const path = findPath(producer.sectorId!, consumer.sectorId!);
                if (!path) continue; // No path
                dist = path.length * 5000; // Rough cost
              } else {
                dist = Phaser.Math.Distance.Between(
                  producer.transform!.x,
                  producer.transform!.y,
                  consumer.transform!.x,
                  consumer.transform!.y
                );
              }

              const cargoCapacity = 10;
              const totalProfit = profitPerUnit * cargoCapacity;
              // Score: Profit per distance unit
              const score = totalProfit / (dist + 100);

              routes.push({
                buyStationId: producer.id,
                sellStationId: consumer.id,
                itemId: itemId,
                expectedProfit: totalProfit,
                score: score,
                distance: dist,
              });
            }
          }
        }
      }
    }

    routes.sort((a, b) => b.score - a.score);
    bestRoutes = routes.slice(0, 50); // Keep top 50
    // console.log(`[MarketSystem] Updated. Found ${routes.length} routes. Top score: ${bestRoutes[0]?.score.toFixed(2)}`);
  },

  getBestRoute: (): TradeRoute | null => {
    if (bestRoutes.length === 0) return null;
    // Return a random one from top 10 to distribute traffic
    const candidates = bestRoutes.slice(0, Math.min(10, bestRoutes.length));
    return candidates[Math.floor(Math.random() * candidates.length)];
  },
};
