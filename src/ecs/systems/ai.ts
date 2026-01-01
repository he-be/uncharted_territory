import { world, type Entity } from '../world';
import { calculatePrice } from '../../utils/economyUtils';
import { STATION_CONFIGS, type StationType } from '../../data/stations';
import type { ItemId } from '../../data/items';

const ARRIVAL_RADIUS = 50;

// OPTIMIZATION: Cache Station Entity lookups
// Key: StationID, Value: Entity
const stationCache = new Map<string, Entity>();

export const aiSystem = (_delta: number) => {
  const aiEntities = world.with(
    'transform',
    'velocity',
    'aiState',
    'speedStats',
    'wallet',
    'totalProfit'
  );
  const stations = world.with('station', 'transform', 'stationType', 'inventory');

  // Update Cache if size mismatch (Basic invalidation strategy)
  // For a real game, handles removal properly. Here stations are static.
  if (stationCache.size !== stations.size) {
    stationCache.clear();
    for (const s of stations) {
      stationCache.set(s.id, s);
    }
  }

  // Optimization: Throttle Planning
  let processedPlanning = false;

  // Profiling Accumulators
  let tPlanning = 0;
  let tExec = 0;
  let tWhere = 0;
  const startTotal = performance.now();

  for (const entity of aiEntities) {
    // ----------------------------------------------------
    // PLAN
    // ----------------------------------------------------
    if (entity.aiState === 'PLANNING') {
      if (processedPlanning) continue;
      processedPlanning = true;

      const tPStart = performance.now();
      const possibleRoutes: Array<{
        buyStationId: string;
        sellStationId: string;
        itemId: ItemId;
        score: number;
        expectedProfit: number;
      }> = [];

      const stationList = Array.from(stations);

      for (const producer of stationList) {
        const pConfig = STATION_CONFIGS[producer.stationType as StationType];
        if (!pConfig.production?.produces) continue;

        for (const production of pConfig.production.produces) {
          const itemId = production.itemId;
          // Check stock at producer
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
                const distToProducer = Phaser.Math.Distance.Between(
                  entity.transform.x,
                  entity.transform.y,
                  producer.transform.x,
                  producer.transform.y
                );
                const distToConsumer = Phaser.Math.Distance.Between(
                  producer.transform.x,
                  producer.transform.y,
                  consumer.transform.x,
                  consumer.transform.y
                );
                const totalDist = distToProducer + distToConsumer;
                const time = totalDist / entity.speedStats.maxSpeed;
                const cargoCapacity = 10;
                const totalProfit = profitPerUnit * cargoCapacity;
                const score = totalProfit / (time + 1);

                possibleRoutes.push({
                  buyStationId: producer.id,
                  sellStationId: consumer.id,
                  itemId: itemId,
                  score: score,
                  expectedProfit: totalProfit,
                });
              }
            }
          }
        }
      }

      if (possibleRoutes.length > 0) {
        possibleRoutes.sort((a, b) => b.score - a.score);
        const candidates = possibleRoutes.slice(0, 3);
        const chosenRoute = candidates[Math.floor(Math.random() * candidates.length)];

        entity.tradeRoute = {
          buyStationId: chosenRoute.buyStationId,
          sellStationId: chosenRoute.sellStationId,
          itemId: chosenRoute.itemId,
          state: 'MOVING_TO_BUY',
        };
        entity.aiState = 'EXECUTING_TRADE';
      }
      tPlanning += performance.now() - tPStart;
    }

    // ----------------------------------------------------
    // EXECUTE
    // ----------------------------------------------------
    if (entity.aiState === 'EXECUTING_TRADE' && entity.tradeRoute) {
      const tEStart = performance.now();
      const route = entity.tradeRoute;

      let targetId = '';
      if (route.state === 'MOVING_TO_BUY' || route.state === 'BUYING') {
        targetId = route.buyStationId;
      } else {
        targetId = route.sellStationId;
      }

      // OPTIMIZED LOOKUP
      const tW0 = performance.now();
      const targetStation = stationCache.get(targetId); // O(1) Lookup
      tWhere += performance.now() - tW0;

      if (!targetStation || !targetStation.transform) {
        entity.aiState = 'PLANNING';
        entity.tradeRoute = undefined;
        tExec += performance.now() - tEStart;
        continue;
      }

      const targetX = targetStation.transform.x;
      const targetY = targetStation.transform.y;

      const dx = targetX - entity.transform.x;
      const dy = targetY - entity.transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const angle = Math.atan2(dy, dx);
      entity.transform.rotation = angle;
      entity.velocity.vx = Math.cos(angle) * entity.speedStats.maxSpeed;
      entity.velocity.vy = Math.sin(angle) * entity.speedStats.maxSpeed;

      if (dist < ARRIVAL_RADIUS) {
        entity.velocity.vx = 0;
        entity.velocity.vy = 0;

        if (route.state === 'MOVING_TO_BUY') {
          const buyPrice = calculatePrice(targetStation, route.itemId);
          const amount = 10;
          const cost = buyPrice * amount;

          if (
            (entity.wallet || 0) >= cost &&
            (targetStation.inventory?.[route.itemId] || 0) >= amount
          ) {
            entity.wallet! -= cost;
            targetStation.inventory![route.itemId]! -= amount;
            if (targetStation.wallet === undefined) targetStation.wallet = 0;
            targetStation.wallet += cost;

            if (!entity.cargo) entity.cargo = {};
            if (!entity.cargo[route.itemId]) entity.cargo[route.itemId] = 0;
            entity.cargo[route.itemId]! += amount;
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit -= cost;
            route.state = 'MOVING_TO_SELL';
          } else {
            entity.aiState = 'PLANNING';
            entity.tradeRoute = undefined;
          }
        } else if (route.state === 'MOVING_TO_SELL') {
          const sellPrice = calculatePrice(targetStation, route.itemId);
          const amount = entity.cargo?.[route.itemId] || 0;
          const revenue = sellPrice * amount;

          if (amount > 0) {
            entity.wallet! += revenue;
            if (targetStation.wallet === undefined) targetStation.wallet = 0;
            targetStation.wallet -= revenue;
            if (!targetStation.inventory![route.itemId]) targetStation.inventory![route.itemId] = 0;
            targetStation.inventory![route.itemId]! += amount;
            entity.cargo![route.itemId] = 0;
            if (entity.totalProfit === undefined) entity.totalProfit = 0;
            entity.totalProfit += revenue;
          }
          entity.aiState = 'PLANNING';
        }
      }
      tExec += performance.now() - tEStart;
    }
  }

  const totalTime = performance.now() - startTotal;
  // Log if slow, showing breakdown
  if (totalTime > 4) {
    console.warn(
      `[AI PERF] Total: ${totalTime.toFixed(2)}ms | Plan: ${tPlanning.toFixed(2)} | Exec: ${tExec.toFixed(2)} | Where: ${tWhere.toFixed(2)}`
    );
  }
};
